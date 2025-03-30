# Chat with Cori - Maintenance Guide

## Overview

Chat with Cori is an AI-powered chatbot integrated into the CoreShare platform. The chatbot helps users understand GPU specifications, provides platform information, and can even assist with creating new GPU listings. This guide explains how the chatbot is implemented and how to maintain, troubleshoot, and extend its functionality.

## Architecture

The chatbot is built using a client-server architecture:

1. **Backend Components**:
   - `server/chatbot.ts`: Core implementation with message processing and session management
   - `server/routes.ts`: API endpoints exposing chatbot functionality
   - OpenRouter API integration for LLM (Large Language Model) access

2. **Frontend Components**:
   - `client/src/components/chat/chat-with-cori.tsx`: UI component for the chatbot
   - Floating chat button with expandable chat interface
   - Message history and real-time conversation

3. **Data Flow**:
   - User messages are sent to the server via API endpoints
   - Server processes messages using OpenRouter API
   - Responses are returned to the client and displayed in the chat interface

## Configuration

### API Keys and Environment Variables

The chatbot requires an OpenRouter API key to function:

```
OPENROUTER_API_KEY=your_api_key_here
```

This key should be added to your environment variables. In production, use secure environment variable management.

### System Prompt

The chatbot's behavior is defined by a system prompt located in `server/chatbot.ts`. This prompt can be updated to change Cori's personality, capabilities, and knowledge base.

```typescript
const SYSTEM_PROMPT = `You are Cori, the helpful AI assistant for CoreShare, a platform for renting and sharing GPUs.
You help users understand how the platform works and provide information about available GPUs,
pricing, and the GPU rental/sharing process. You can also analyze GPU specifications and 
make recommendations based on user needs. You can help users create new GPU listings.
...`;
```

### Fallback Responses

When the AI API is unavailable, the chatbot uses local fallback responses from the knowledge base:

```typescript
const knowledgeBase = {
  greeting: [...],
  gpuSharing: [...],
  fallback: [...]
};
```

These can be extended to improve offline functionality.

## Key Features

### 1. GPU Information Retrieval

The chatbot can access real-time GPU data from the database to provide accurate information about available GPUs, their specifications, and pricing.

### 2. GPU Listing Creation

Users can create new GPU listings by describing their GPU specifications to Cori. The chatbot will:
- Extract key information like name, manufacturer, VRAM, and price
- Request missing required information
- Submit the listing to the database

### 3. Personalized Assistance

When users are logged in, Cori can provide personalized information about:
- Their current GPU rentals
- GPUs they own
- Rental history and recommendations

### 4. Context-Aware Conversations

The system maintains chat sessions with message history, allowing for contextual conversations where the bot remembers previous exchanges.

## API Endpoints

The chatbot exposes the following API endpoints:

1. **Create Session**
   - `POST /api/chat/session`
   - Creates a new chat session
   - Returns a session ID

2. **Send Message**
   - `POST /api/chat/message`
   - Sends a user message to the chatbot
   - Required parameters: `sessionId` and `message`

3. **Get Message History**
   - `GET /api/chat/session/:sessionId`
   - Retrieves message history for a session

4. **Create GPU via Chatbot**
   - `POST /api/chat/create-gpu`
   - Creates a new GPU listing from processed chat information
   - Requires authentication

## Maintenance Tasks

### Regular Maintenance

1. **Update System Prompt**
   - Periodically review and update the system prompt to improve chatbot capabilities
   - Add new features or information about CoreShare as the platform evolves

2. **Expand Knowledge Base**
   - Add new fallback responses to handle more topics without API access
   - Update existing responses to reflect current information

3. **Monitor Session Storage**
   - Session data is currently stored in memory
   - In a production environment, consider moving to a persistent database

### Troubleshooting

#### Common Issues and Solutions

1. **Chatbot Unavailable**
   - Check if the OpenRouter API key is valid
   - Ensure the environment variable is properly set
   - Look for error logs in the server console

2. **Poor Quality Responses**
   - Review the system prompt for accuracy and clarity
   - Consider upgrading to a more advanced model 
   - Update the context data generation function to provide more relevant information

3. **Session Management Issues**
   - Check the session cleanup interval (currently 24 hours)
   - Monitor server memory usage if storing many sessions

4. **GPU Creation Failures**
   - Verify the validation logic in the `createGpuListing` function
   - Check database connection and permissions

## How to Extend the Chatbot

### Adding New Capabilities

1. **Extend the System Prompt**
   - Add instructions for new capabilities in the `SYSTEM_PROMPT` constant
   - Be specific about how the chatbot should handle new tasks

2. **Implement Backend Functions**
   - Add new functions to `chatbot.ts` for specialized tasks
   - Expose these through API endpoints in `routes.ts`

3. **Update the UI Component**
   - Modify `chat-with-cori.tsx` to support new interactions
   - Add UI elements for specialized capabilities if needed

### Upgrading the AI Model

The chatbot is configured to use `openai/gpt-3.5-turbo` by default. To upgrade:

```typescript
// Update in server/chatbot.ts
const response = await openai.chat.completions.create({
  model: 'openai/gpt-4', // Upgraded to GPT-4
  messages: conversationHistory,
  temperature: 0.7,
  max_tokens: 1000
});
```

Different models have different capabilities and cost considerations.

### Integrating with Other Platform Features

To connect the chatbot with new CoreShare features:

1. Update the `getContextData` function to include data from the new features
2. Modify the system prompt to instruct the chatbot about these features
3. Add any necessary API endpoints to support new interactions

## Security Considerations

1. **API Key Protection**
   - Store the OpenRouter API key securely
   - Never expose it in client-side code

2. **User Authentication**
   - GPU creation requires authentication
   - Consider adding authentication for all chatbot interactions in production

3. **Input Validation**
   - All user inputs should be validated before processing
   - Prevent injection attacks and malicious inputs

4. **Rate Limiting**
   - Implement rate limiting on chatbot endpoints to prevent abuse
   - Monitor usage patterns for suspicious activity

## Performance Optimization

1. **Caching Common Responses**
   - Consider caching responses to frequent questions
   - Implement a TTL (Time To Live) for cached responses

2. **Database Query Optimization**
   - Review and optimize database queries in `getContextData`
   - Add indexes for frequently accessed fields

3. **Session Management**
   - Implement a more efficient session storage mechanism for production
   - Consider using Redis or a similar in-memory database

## Future Enhancements Roadmap

1. **Analytics Integration**
   - Track user interactions to improve the chatbot
   - Identify common questions and pain points

2. **Multi-language Support**
   - Add capability to detect and respond in multiple languages
   - Translate system prompts and fallback responses

3. **Advanced GPU Recommendations**
   - Implement more sophisticated recommendation algorithms
   - Use rental history and reviews to suggest appropriate GPUs for specific tasks

4. **Voice Interface**
   - Add speech-to-text and text-to-speech capabilities
   - Enable voice interactions with the chatbot

## Conclusion

The Chat with Cori chatbot is a powerful tool for enhancing user experience on the CoreShare platform. By properly maintaining and extending its capabilities, you can ensure it remains a valuable asset for both GPU renters and owners.

For questions or support, contact the CoreShare development team.