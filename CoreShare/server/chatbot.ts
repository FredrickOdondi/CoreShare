/**
 * Chat with Cori - Chatbot Module
 * 
 * This module implements the chatbot functionality for CoreShare,
 * allowing users to get information about GPU sharing and the platform.
 * It uses the OpenRouter API to access advanced language models.
 */
import { randomUUID } from 'crypto';
import OpenAI from 'openai';
import { db } from './db';
import { gpus, rentals, reviews, payments, users } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { storage } from './storage';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

interface ChatSession {
  id: string;
  messages: Message[];
  lastActivity: Date;
  userId?: number; // Optional user ID for personalized responses
}

// Store chat sessions in memory (would use a database in production)
const chatSessions: Record<string, ChatSession> = {};

// Response cache for frequently asked questions (in-memory LRU cache)
interface CacheEntry {
  response: string;
  timestamp: Date;
  expiresAt: Date;
}

const responseCache: Map<string, CacheEntry> = new Map();
const CACHE_SIZE_LIMIT = 100; // Maximum number of cached responses
const CACHE_TTL = 60 * 60 * 1000; // Cache TTL: 1 hour in milliseconds

// Initialize OpenAI client with OpenRouter API key
const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': 'https://coreshare.com', // Replace with actual domain
    'X-Title': 'CoreShare Assistant'
  }
});

// System prompt for Cori
const SYSTEM_PROMPT = `You are Cori, the helpful AI assistant for CoreShare, a platform for renting and sharing GPUs.
You help users understand how the platform works and provide information about available GPUs,
pricing, and the GPU rental/sharing process. You can also analyze GPU specifications and 
make recommendations based on user needs. You can help users create new GPU listings.

The CoreShare platform allows:
- GPU owners to rent out their hardware when not in use
- Users to rent high-performance GPUs for computing tasks
- Secure payment processing and user verification
- Reviews and ratings for GPUs and renters

When responding:
- Be friendly, helpful, and concise
- Provide specific information about available GPUs when asked
- Explain the rental and sharing process
- Help users understand GPU specifications and what they mean
- Assist with troubleshooting common issues

If a user asks to create a new GPU listing or add a GPU to the platform:
1. Confirm that they want to create a new listing
2. Ask them for the required GPU information: name, manufacturer, VRAM (in GB), price per hour
3. Collect optional technical specifications if they have them: CUDA cores, base clock, boost clock, etc.
4. When you have the essential information, tell them you're creating the listing
5. Create the listing by using the createGpuListing function
6. Confirm when the listing is created successfully or explain any errors

If a user asks to stop a GPU rental or asks you to stop a running GPU:
1. Check if they have any active rentals
2. If they do, confirm which rental they want to stop
3. Use the stopRental function to stop the rental
4. Confirm when the rental is stopped successfully or explain any errors

If a user asks to change the theme to light mode or dark mode:
1. Confirm that they want to change the theme
2. Use the toggleTheme function to switch between light and dark mode
3. Confirm the theme change

If you don't know an answer, admit it rather than making up information.
`;

// Knowledge base for fallback responses when API is unavailable
const knowledgeBase = {
  greeting: [
    "Hi there! I'm Cori, your CoreShare assistant. How can I help you today?",
    "Hello! I'm Cori, here to help with your GPU sharing needs. What can I do for you?",
    "Welcome to CoreShare! I'm Cori, your AI assistant. How may I assist you today?"
  ],
  gpuSharing: [
    "CoreShare is a platform that allows people to rent and share GPUs for computing tasks.",
    "Our platform enables GPU owners to earn money by renting out their hardware when it's not in use.",
    "You can find high-performance GPUs for rent at competitive prices on CoreShare."
  ],
  fallback: [
    "I'm having trouble connecting to my knowledge base right now. Could you try again in a moment?",
    "I apologize, but my advanced features are temporarily unavailable. I can still help with basic questions about CoreShare.",
    "Sorry, I'm experiencing a connection issue. Please try your question again shortly."
  ]
};

/**
 * Creates a new chat session
 */
export function createChatSession(userId?: number): string {
  const sessionId = randomUUID();
  const systemMessage: Message = {
    id: randomUUID(),
    role: 'system',
    content: SYSTEM_PROMPT,
    timestamp: new Date()
  };
  
  chatSessions[sessionId] = {
    id: sessionId,
    messages: [systemMessage],
    lastActivity: new Date(),
    userId: userId
  };
  return sessionId;
}

/**
 * Gets a chat session by ID
 */
export function getChatSession(sessionId: string): ChatSession | undefined {
  return chatSessions[sessionId];
}

/**
 * Gets all messages for a chat session
 */
export function getChatMessages(sessionId: string): Message[] | null {
  const session = chatSessions[sessionId];
  if (!session) return null;
  
  // Filter out system messages for client-side display
  return session.messages.filter(msg => msg.role !== 'system');
}

/**
 * Process a user message and generate a response
 */
export async function processMessage(sessionId: string, message: string): Promise<Message> {
  // Get or create session
  let session = chatSessions[sessionId];
  if (!session) {
    sessionId = createChatSession();
    session = chatSessions[sessionId];
  }

  // Add user message
  const userMessage: Message = {
    id: randomUUID(),
    role: 'user',
    content: message,
    timestamp: new Date()
  };
  
  session.messages.push(userMessage);
  session.lastActivity = new Date();

  try {
    // Check if we have a cached response for this message
    // Only use cache for simple informational queries, not for commands/actions
    const shouldCheckCache = !message.toLowerCase().includes('create') && 
                           !message.toLowerCase().includes('stop') &&
                           !message.toLowerCase().includes('theme');
    
    if (shouldCheckCache) {
      const cachedResponse = getCachedResponse(message);
      if (cachedResponse) {
        console.log(`Using cached response for: "${message.substring(0, 30)}..."`);
        
        // Create bot message from cache
        const botMessage: Message = {
          id: randomUUID(),
          role: 'assistant',
          content: cachedResponse,
          timestamp: new Date()
        };
        
        // Add to session
        session.messages.push(botMessage);
        return botMessage;
      }
    }
    
    // Start timing the request
    const requestStartTime = Date.now();
    
    // Prepare conversation history for API call
    const conversationHistory = session.messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    // Get real-time GPU data for context
    // We'll implement batch processing for database calls here
    let contextPromise = getContextData(session.userId);
    
    // While waiting for context data, start preparing the API call
    let contextData: string | null = null;
    
    // Wait for context data with a timeout
    try {
      const CONTEXT_TIMEOUT = 500; // 500ms timeout
      const timeoutPromise = new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), CONTEXT_TIMEOUT);
      });
      
      // Race between context retrieval and timeout
      contextData = await Promise.race([contextPromise, timeoutPromise]);
    } catch (error) {
      console.warn('Error or timeout fetching context data:', error);
      contextData = null;
    }
    
    if (contextData) {
      // Add context as a system message
      const contextMessage: Message = {
        id: randomUUID(),
        role: 'system',
        content: `Current CoreShare data for reference:\n${contextData}`,
        timestamp: new Date()
      };
      
      // Add to session but don't include in history sent to API
      session.messages.push(contextMessage);
      conversationHistory.push({
        role: contextMessage.role,
        content: contextMessage.content
      });
    }

    // Call OpenAI API via OpenRouter
    const response = await openai.chat.completions.create({
      model: 'openai/gpt-3.5-turbo', // Can be upgraded to more powerful models
      messages: conversationHistory,
      temperature: 0.7,
      max_tokens: 1000
    });

    // Calculate request time
    const requestEndTime = Date.now();
    const requestTime = requestEndTime - requestStartTime;
    console.log(`AI request completed in ${requestTime}ms`);

    // Get bot response
    const botResponse = response.choices[0].message.content || randomResponse(knowledgeBase.fallback);
    
    // Cache the response if it's a general informational query
    if (shouldCheckCache) {
      cacheResponse(message, botResponse);
    }
    
    // Create bot message
    const botMessage: Message = {
      id: randomUUID(),
      role: 'assistant',
      content: botResponse,
      timestamp: new Date()
    };
    
    // Add to session
    session.messages.push(botMessage);
    return botMessage;
  } catch (error) {
    console.error('Error calling AI API:', error);
    
    // Fallback to basic response if API fails
    const fallbackMessage: Message = {
      id: randomUUID(),
      role: 'assistant',
      content: generateFallbackResponse(message),
      timestamp: new Date()
    };
    
    session.messages.push(fallbackMessage);
    return fallbackMessage;
  }
}

/**
 * Get contextual data from the database to enhance chatbot responses
 * Optimized with batch processing for database queries
 */
async function getContextData(userId?: number): Promise<string | null> {
  try {
    // Start performance tracking
    const startTime = performance.now();
    
    // Create an array of promises for parallel execution
    const queries: Promise<any>[] = [];
    
    // Query 1: Get available GPUs
    const availableGpusPromise = db.select({
      id: gpus.id,
      name: gpus.name,
      manufacturer: gpus.manufacturer,
      vram: gpus.vram,
      pricePerHour: gpus.pricePerHour,
      available: gpus.available
    }).from(gpus)
      .where(eq(gpus.available, true))
      .limit(10);
    
    queries.push(availableGpusPromise);
    
    // Add user-specific queries if user is authenticated
    let userRentalsPromise: Promise<any> | null = null;
    let userGpusPromise: Promise<any> | null = null;
    
    if (userId) {
      // Query 2: Get user's active rentals
      userRentalsPromise = db.select().from(rentals)
        .where(eq(rentals.renterId, userId))
        .limit(5);
      
      // Query 3: Get user's own GPUs
      userGpusPromise = db.select().from(gpus)
        .where(eq(gpus.ownerId, userId))
        .limit(5);
      
      queries.push(userRentalsPromise);
      queries.push(userGpusPromise);
    }
    
    // Execute all queries in parallel
    const results = await Promise.all(queries);
    
    // Parse results
    const availableGpus = results[0];
    let userRentals: any[] = [];
    let userGpus: any[] = [];
    
    if (userId) {
      userRentals = results[1];
      userGpus = results[2];
    }
    
    // Format the data as a string
    let contextString = "Available GPUs:\n";
    
    if (availableGpus.length > 0) {
      availableGpus.forEach((gpu: any) => {
        contextString += `- ${gpu.name} (${gpu.manufacturer}): ${gpu.vram}GB VRAM, $${gpu.pricePerHour}/hour\n`;
      });
    } else {
      contextString += "No GPUs are currently available for rent.\n";
    }
    
    if (userId) {
      if (userRentals.length > 0) {
        contextString += "\nUser's Active Rentals:\n";
        userRentals.forEach((rental: any) => {
          contextString += `- Rental #${rental.id}: GPU ID ${rental.gpuId}, Status: ${rental.status}\n`;
        });
      }
      
      if (userGpus.length > 0) {
        contextString += "\nUser's Listed GPUs:\n";
        userGpus.forEach((gpu: any) => {
          contextString += `- ${gpu.name}: $${gpu.pricePerHour}/hour, Available: ${gpu.available ? 'Yes' : 'No'}\n`;
        });
      }
    }
    
    // Log performance
    const endTime = performance.now();
    console.log(`Context data fetched in ${Math.round(endTime - startTime)}ms with batch processing`);
    
    return contextString;
  } catch (error) {
    console.error('Error fetching context data:', error);
    return null;
  }
}

/**
 * Generate a fallback response based on user input (used when API fails)
 */
function generateFallbackResponse(message: string): string {
  const normalizedMessage = message.toLowerCase();
  
  // Check for greeting
  if (containsAny(normalizedMessage, ['hello', 'hi', 'hey', 'greetings'])) {
    return randomResponse(knowledgeBase.greeting);
  }
  
  // Check for questions about CoreShare/GPU sharing
  if (containsAny(normalizedMessage, ['what is coreshare', 'about coreshare', 'gpu sharing', 'platform'])) {
    return randomResponse(knowledgeBase.gpuSharing);
  }
  
  // Fallback response if no matches
  return randomResponse(knowledgeBase.fallback);
}

/**
 * Helper to check if a string contains any of the given phrases
 */
function containsAny(text: string, phrases: string[]): boolean {
  return phrases.some(phrase => text.includes(phrase));
}

/**
 * Get a random response from an array of possible responses
 */
function randomResponse(responses: string[]): string {
  const index = Math.floor(Math.random() * responses.length);
  return responses[index];
}

/**
 * Add a response to the cache
 */
function cacheResponse(query: string, response: string): void {
  // Normalize the query (lowercase, trim whitespace)
  const normalizedQuery = query.toLowerCase().trim();
  
  // Create cache entry
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CACHE_TTL);
  
  // Add to cache
  responseCache.set(normalizedQuery, {
    response,
    timestamp: now,
    expiresAt
  });
  
  // Check if cache size limit is exceeded
  if (responseCache.size > CACHE_SIZE_LIMIT) {
    // Remove the oldest entry
    // Using Array.from() to handle iterator in a more compatible way
    const keys = Array.from(responseCache.keys());
    if (keys.length > 0) {
      responseCache.delete(keys[0]);
    }
  }
}

/**
 * Get a cached response if available
 */
function getCachedResponse(query: string): string | null {
  // Normalize the query
  const normalizedQuery = query.toLowerCase().trim();
  
  // Check if query is in cache
  const cacheEntry = responseCache.get(normalizedQuery);
  if (!cacheEntry) return null;
  
  // Check if cache entry is expired
  const now = new Date();
  if (now > cacheEntry.expiresAt) {
    // Remove expired entry
    responseCache.delete(normalizedQuery);
    return null;
  }
  
  // Return cached response
  return cacheEntry.response;
}

/**
 * Clean up old cache entries
 */
function cleanupExpiredCache(): void {
  const now = new Date();
  
  // Remove expired entries using Array.from to avoid iterator issues
  Array.from(responseCache.entries()).forEach(([key, entry]) => {
    if (now > entry.expiresAt) {
      responseCache.delete(key);
    }
  });
}

/**
 * Clean up old chat sessions (called periodically)
 */
export function cleanupOldSessions(): void {
  const now = new Date();
  const SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours
  
  Object.keys(chatSessions).forEach(sessionId => {
    const session = chatSessions[sessionId];
    const timeSinceLastActivity = now.getTime() - session.lastActivity.getTime();
    
    if (timeSinceLastActivity > SESSION_TIMEOUT_MS) {
      delete chatSessions[sessionId];
    }
  });
  
  // Also clean up expired cache entries
  cleanupExpiredCache();
}

// Run cleanup every hour
setInterval(cleanupOldSessions, 60 * 60 * 1000);

/**
 * Stop a running GPU rental
 * This is used by the chatbot to stop a user's active rental when prompted
 */
export async function stopRental(
  userId: number,
  rentalId?: number
): Promise<{ success: boolean; message: string; rentalId?: number }> {
  try {
    // Validate inputs
    if (!userId) {
      return { success: false, message: "You need to be logged in to stop a rental." };
    }
    
    // If no rentalId provided, check if user has any active rentals
    if (!rentalId) {
      // Get active rentals for the user
      const activeRentals = await db.select().from(rentals)
        .where(and(
          eq(rentals.renterId, userId),
          eq(rentals.status, "running")
        ));
      
      if (activeRentals.length === 0) {
        return { success: false, message: "You don't have any active GPU rentals to stop." };
      }
      
      if (activeRentals.length === 1) {
        // If user has exactly one active rental, use that one
        rentalId = activeRentals[0].id;
      } else {
        // If user has multiple active rentals, we need them to specify which one
        let rentalsList = "You have multiple active rentals. Please specify which one you'd like to stop:\n";
        activeRentals.forEach(rental => {
          rentalsList += `- Rental #${rental.id}: GPU ID ${rental.gpuId}\n`;
        });
        return { success: false, message: rentalsList };
      }
    }
    
    // Get the rental
    const rental = await storage.getRental(rentalId);
    if (!rental) {
      return { success: false, message: "Rental not found." };
    }
    
    // Check if user owns the rental or the GPU
    if (rental.renterId !== userId) {
      // Check if user is the GPU owner
      const gpu = await storage.getGpu(rental.gpuId);
      if (!gpu || gpu.ownerId !== userId) {
        return { success: false, message: "You don't have permission to stop this rental." };
      }
    }
    
    // Check if rental is active
    if (rental.status !== "running") {
      return { success: false, message: "This rental is not currently active." };
    }
    
    // Stop the rental
    const endTime = new Date();
    const durationMs = endTime.getTime() - rental.startTime.getTime();
    const durationHours = durationMs / (1000 * 60 * 60);
    
    // Get GPU to calculate cost
    const gpu = await storage.getGpu(rental.gpuId);
    if (!gpu) {
      return { success: false, message: "Associated GPU not found." };
    }
    
    const totalCost = parseFloat((durationHours * gpu.pricePerHour).toFixed(2));
    
    // Update rental
    const updatedRental = await storage.updateRental(rentalId, {
      status: "completed",
      endTime,
      totalCost
    });
    
    // Make GPU available again
    await storage.updateGpu(gpu.id, { available: true });
    
    // Create notifications
    await storage.createNotification({
      userId: gpu.ownerId,
      title: "Rental Completed",
      message: `Your GPU ${gpu.name} rental has been completed`,
      type: 'rental_completed',
      relatedId: rental.id
    });
    
    await storage.createNotification({
      userId: rental.renterId,
      title: "Rental Bill",
      message: `Your rental of ${gpu.name} GPU has ended. Total cost: $${totalCost.toFixed(2)}`,
      type: 'rental_bill',
      relatedId: rental.id
    });
    
    return { 
      success: true, 
      message: `Successfully stopped rental #${rentalId}. Final cost: $${totalCost.toFixed(2)}.`,
      rentalId: rentalId
    };
  } catch (error) {
    console.error("Error stopping rental:", error);
    return { 
      success: false, 
      message: "An error occurred while stopping the rental. Please try again." 
    };
  }
}

/**
 * Toggle the application theme (light/dark mode)
 * This function doesn't actually change the theme, it just returns a success message
 * The UI will handle the actual theme change through the client-side theme toggle
 */
export function toggleTheme(): { success: boolean; message: string; action: string } {
  return {
    success: true,
    message: "Theme preference updated. You can toggle back anytime by asking me to switch the theme.",
    action: "toggleTheme"
  };
}

/**
 * Creates a new GPU listing
 * This is used by the chatbot to add GPUs to the marketplace when a user requests it
 */
export async function createGpuListing(
  userId: number,
  name: string,
  manufacturer: string,
  vram: number,
  pricePerHour: number,
  technicalSpecs?: Record<string, any>
): Promise<{ success: boolean; message: string; gpuId?: number }> {
  try {
    // Validate inputs
    if (!userId) {
      return { success: false, message: "You need to be logged in to create a GPU listing." };
    }
    
    if (!name || !manufacturer) {
      return { success: false, message: "GPU name and manufacturer are required." };
    }
    
    if (isNaN(vram) || vram <= 0) {
      return { success: false, message: "VRAM must be a positive number." };
    }
    
    if (isNaN(pricePerHour) || pricePerHour <= 0) {
      return { success: false, message: "Price per hour must be a positive number." };
    }
    
    // Format technical specs as JSON string if provided
    let specs = {};
    if (technicalSpecs) {
      specs = { ...technicalSpecs };
    }
    
    console.log(`Creating GPU listing for: ${name} (${manufacturer}) with ${vram}GB VRAM at $${pricePerHour}/hr`);
    
    // Create GPU listing with available set to true by default
    const newGpu = await storage.createGpu({
      name,
      manufacturer,
      vram,
      pricePerHour,
      ownerId: userId,
      available: true, // Explicitly set available to true
      // Optional technical specifications - if provided in the request
      cudaCores: technicalSpecs?.cudaCores ? Number(technicalSpecs.cudaCores) : undefined,
      baseClock: technicalSpecs?.baseClock ? Number(technicalSpecs.baseClock) : undefined,
      boostClock: technicalSpecs?.boostClock ? Number(technicalSpecs.boostClock) : undefined,
      tdp: technicalSpecs?.tdp ? Number(technicalSpecs.tdp) : undefined,
      maxTemp: technicalSpecs?.maxTemp ? Number(technicalSpecs.maxTemp) : undefined,
      powerDraw: technicalSpecs?.powerDraw ? Number(technicalSpecs.powerDraw) : undefined,
      coolingSystem: technicalSpecs?.coolingSystem || undefined,
      memoryType: technicalSpecs?.memoryType || undefined,
      psuRecommendation: technicalSpecs?.psuRecommendation ? Number(technicalSpecs.psuRecommendation) : undefined,
      powerConnectors: technicalSpecs?.powerConnectors || undefined
    });
    
    console.log(`Successfully created GPU with ID: ${newGpu.id}`);
    
    // Create a notification for the user
    await storage.createNotification({
      userId,
      title: "New GPU Listed",
      type: "GPU_LISTED",
      message: `Your GPU "${name}" has been successfully listed on the marketplace.`
    });
    
    return { 
      success: true, 
      message: `Successfully created a listing for ${name} GPU.`,
      gpuId: newGpu.id
    };
  } catch (error) {
    console.error("Error creating GPU listing:", error);
    return { 
      success: false, 
      message: "An error occurred while creating the GPU listing. Please try again." 
    };
  }
}