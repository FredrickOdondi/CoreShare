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
import { eq } from 'drizzle-orm';
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
    // Prepare conversation history for API call
    const conversationHistory = session.messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    // Get real-time GPU data for context
    const contextData = await getContextData(session.userId);
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

    // Get bot response
    const botResponse = response.choices[0].message.content || randomResponse(knowledgeBase.fallback);
    
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
 */
async function getContextData(userId?: number): Promise<string | null> {
  try {
    // Get available GPUs
    const availableGpus = await db.select({
      id: gpus.id,
      name: gpus.name,
      manufacturer: gpus.manufacturer,
      vram: gpus.vram,
      pricePerHour: gpus.pricePerHour,
      available: gpus.available
    }).from(gpus)
      .where(eq(gpus.available, true))
      .limit(10);
    
    // Get user-specific data if authenticated
    let userData = null;
    if (userId) {
      // Get user's active rentals if any
      const userRentals = await db.select().from(rentals)
        .where(eq(rentals.renterId, userId))
        .limit(5);
      
      // Get user's own GPUs if any
      const userGpus = await db.select().from(gpus)
        .where(eq(gpus.ownerId, userId))
        .limit(5);
      
      userData = {
        rentals: userRentals,
        gpus: userGpus
      };
    }
    
    // Format the data as a string
    let contextString = "Available GPUs:\n";
    
    if (availableGpus.length > 0) {
      availableGpus.forEach(gpu => {
        contextString += `- ${gpu.name} (${gpu.manufacturer}): ${gpu.vram}GB VRAM, $${gpu.pricePerHour}/hour\n`;
      });
    } else {
      contextString += "No GPUs are currently available for rent.\n";
    }
    
    if (userData) {
      if (userData.rentals.length > 0) {
        contextString += "\nUser's Active Rentals:\n";
        userData.rentals.forEach(rental => {
          contextString += `- Rental #${rental.id}: GPU ID ${rental.gpuId}, Status: ${rental.status}\n`;
        });
      }
      
      if (userData.gpus.length > 0) {
        contextString += "\nUser's Listed GPUs:\n";
        userData.gpus.forEach(gpu => {
          contextString += `- ${gpu.name}: $${gpu.pricePerHour}/hour, Available: ${gpu.available ? 'Yes' : 'No'}\n`;
        });
      }
    }
    
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
}

// Run cleanup every hour
setInterval(cleanupOldSessions, 60 * 60 * 1000);

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
  description?: string,
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
    
    // Create GPU listing
    const newGpu = await storage.createGpu({
      name,
      manufacturer,
      vram,
      pricePerHour,
      ownerId: userId,
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