/**
 * Chat with Cori - Chatbot Module
 * 
 * This module implements the chatbot functionality for CoreShare,
 * allowing users to get information about GPU sharing and the platform.
 */
import { randomUUID } from 'crypto';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatSession {
  id: string;
  messages: Message[];
  lastActivity: Date;
}

// Store chat sessions in memory (would use a database in production)
const chatSessions: Record<string, ChatSession> = {};

// Knowledge base for Cori
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
  pricing: [
    "GPU rental prices are set by the owners, usually on a per-hour basis.",
    "Prices vary based on the GPU model, performance, and availability.",
    "You can see the hourly rate for each GPU on its listing page."
  ],
  howToRent: [
    "To rent a GPU, simply browse available units, select one that meets your needs, and click 'Rent'.",
    "You'll need to create an account and provide payment information before renting.",
    "Once your rental is approved, you'll get access information for the GPU."
  ],
  howToShare: [
    "To share your GPU, go to 'My GPUs' and click 'Add New GPU'.",
    "You'll need to provide details about your GPU including model, specifications, and pricing.",
    "Once listed, renters can find and request to use your GPU."
  ],
  paymentMethods: [
    "CoreShare supports credit/debit cards and M-Pesa for payments.",
    "All transactions are secure and protected."
  ],
  security: [
    "CoreShare uses secure connections and encryption to protect your data.",
    "We have security measures in place to ensure safe GPU sharing."
  ],
  support: [
    "For technical support, please email support@coreshare.com",
    "Our support team is available Monday through Friday, 9 AM to 5 PM EAT."
  ],
  fallback: [
    "I'm not sure I understand. Could you rephrase your question?",
    "I don't have information on that specific topic. Is there something else I can help with?",
    "I'm still learning and don't have an answer for that yet. Can I help with something else?"
  ]
};

/**
 * Creates a new chat session
 */
export function createChatSession(): string {
  const sessionId = randomUUID();
  chatSessions[sessionId] = {
    id: sessionId,
    messages: [],
    lastActivity: new Date()
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
  return session.messages;
}

/**
 * Process a user message and generate a response
 */
export function processMessage(sessionId: string, message: string): Message {
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

  // Generate response
  const response = generateResponse(message);
  const botMessage: Message = {
    id: randomUUID(),
    role: 'assistant',
    content: response,
    timestamp: new Date()
  };
  
  session.messages.push(botMessage);
  return botMessage;
}

/**
 * Generate a response based on user input
 */
function generateResponse(message: string): string {
  const normalizedMessage = message.toLowerCase();
  
  // Check for greeting
  if (containsAny(normalizedMessage, ['hello', 'hi', 'hey', 'greetings'])) {
    return randomResponse(knowledgeBase.greeting);
  }
  
  // Check for questions about CoreShare/GPU sharing
  if (containsAny(normalizedMessage, ['what is coreshare', 'about coreshare', 'gpu sharing', 'platform'])) {
    return randomResponse(knowledgeBase.gpuSharing);
  }
  
  // Pricing questions
  if (containsAny(normalizedMessage, ['price', 'cost', 'how much', 'pricing'])) {
    return randomResponse(knowledgeBase.pricing);
  }
  
  // How to rent
  if (containsAny(normalizedMessage, ['how to rent', 'rent gpu', 'renting', 'use gpu'])) {
    return randomResponse(knowledgeBase.howToRent);
  }
  
  // How to share
  if (containsAny(normalizedMessage, ['how to share', 'share gpu', 'sharing', 'provide gpu', 'list gpu'])) {
    return randomResponse(knowledgeBase.howToShare);
  }
  
  // Payment methods
  if (containsAny(normalizedMessage, ['payment', 'pay', 'transaction', 'mpesa', 'credit card'])) {
    return randomResponse(knowledgeBase.paymentMethods);
  }
  
  // Security
  if (containsAny(normalizedMessage, ['secure', 'security', 'safe', 'protection'])) {
    return randomResponse(knowledgeBase.security);
  }
  
  // Support
  if (containsAny(normalizedMessage, ['support', 'help', 'contact', 'issue', 'problem'])) {
    return randomResponse(knowledgeBase.support);
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