# Cori Chatbot Database Integration Reference

## Overview

This technical reference documents how the Chat with Cori chatbot interfaces with the CoreShare database. The chatbot has been designed to access database information in real-time to provide accurate and up-to-date responses to users.

## Database Schema Integration

The chatbot interacts with the following database tables:

1. **gpus** - GPU listings with specifications and availability
2. **rentals** - Active and historical rental information
3. **users** - User profiles for personalized assistance
4. **reviews** - User feedback on GPU performance
5. **notifications** - System notifications created by chatbot actions

## Key Integration Points

### 1. Real-time GPU Data Access

**Location**: `server/chatbot.ts` - `getContextData()` function

```typescript
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
```

The chatbot queries the database for currently available GPUs to provide up-to-date information to users. This query is executed every time a new user message is processed, ensuring that the chatbot always has the latest information.

### 2. User-Specific Data Access

When a user is authenticated, the chatbot can access personalized information:

```typescript
// Get user's active rentals if any
const userRentals = await db.select().from(rentals)
  .where(eq(rentals.renterId, userId))
  .limit(5);

// Get user's own GPUs if any
const userGpus = await db.select().from(gpus)
  .where(eq(gpus.ownerId, userId))
  .limit(5);
```

This allows the chatbot to provide personalized assistance based on:
- GPUs the user is currently renting
- GPUs the user owns and has listed for rent
- Recent rental history

### 3. GPU Creation

**Location**: `server/chatbot.ts` - `createGpuListing()` function

The chatbot can create new GPU listings directly in the database:

```typescript
const newGpu = await storage.createGpu({
  name,
  manufacturer,
  vram,
  pricePerHour,
  ownerId: userId,
  available: true,
  // Optional technical specifications
  cudaCores: technicalSpecs?.cudaCores ? Number(technicalSpecs.cudaCores) : undefined,
  // Additional fields...
});
```

This function is called when a user asks Cori to create a new GPU listing. The chatbot extracts the necessary information from the conversation and formats it for database insertion.

### 4. Notification Creation

After creating a GPU listing, the chatbot also creates a notification in the database:

```typescript
await storage.createNotification({
  userId,
  title: "New GPU Listed",
  type: "GPU_LISTED",
  message: `Your GPU "${name}" has been successfully listed on the marketplace.`
});
```

This notification appears in the user's notification center, confirming the successful creation of the listing.

## AI Analysis Integration

The chatbot is aware of and can explain the AI analysis feature, which includes:

1. **Popularity Scores**: Stored in the `popularity_score` field of the `gpus` table
2. **Common Tasks**: Stored in the `common_tasks` field as a comma-separated list
3. **Analysis Timestamp**: Stored in the `last_analyzed` field

Example of how the chatbot can access this information:

```typescript
// Get GPU with analysis data
const gpuWithAnalysis = await db.select({
  id: gpus.id,
  name: gpus.name,
  popularityScore: gpus.popularityScore,
  commonTasks: gpus.commonTasks,
  lastAnalyzed: gpus.lastAnalyzed
}).from(gpus)
  .where(eq(gpus.id, gpuId))
  .limit(1);
```

This allows Cori to inform users about a GPU's popularity and common use cases when they inquire about specific models.

## Extending Database Integration

### Adding New Data Sources

To extend the chatbot with new database tables or fields:

1. Update the imports in `server/chatbot.ts`:
   ```typescript
   import { gpus, rentals, reviews, payments, users, newTable } from '@shared/schema';
   ```

2. Modify the `getContextData()` function to include the new data:
   ```typescript
   // Add query for new data
   const newData = await db.select().from(newTable)
     .where(eq(newTable.relevantField, relevantValue))
     .limit(10);
   
   // Format and add to context string
   contextString += "\nNew Data:\n";
   newData.forEach(item => {
     contextString += `- ${item.field1}: ${item.field2}\n`;
   });
   ```

3. Update the system prompt to inform the chatbot about the new data source and how to use it.

### Optimizing Database Queries

For performance optimization:

1. Use selective field queries instead of `select()` to reduce data transfer
2. Add appropriate indexes to frequently queried fields
3. Consider caching frequently accessed data with a short TTL
4. Use transactions for operations that update multiple tables

## Security Considerations

### Data Access Control

The chatbot currently has read access to multiple tables but write access is limited to:
- Creating GPU listings
- Creating notifications

When extending the chatbot's capabilities, maintain this principle of least privilege:
- Restrict write access to only necessary tables
- Validate all input data before database operations
- Ensure proper authentication for sensitive operations

### SQL Injection Prevention

The chatbot uses Drizzle ORM which provides protection against SQL injection. When extending functionality:
- Continue using the ORM for database operations
- Never construct raw SQL strings from user input
- Use parameterized queries if raw SQL is absolutely necessary

## Maintenance and Troubleshooting

### Database Connection Issues

If the chatbot fails to retrieve data:

1. Check database connection parameters in `server/db.ts`
2. Verify that the `DATABASE_URL` environment variable is correctly set
3. Ensure the database server is running and accessible
4. Check for schema version mismatches after migrations

### Query Performance Monitoring

For production environments, consider:

1. Adding logging for slow queries (>500ms)
2. Implementing query timeout limits to prevent hanging
3. Setting up monitoring for database connection pool usage

## Conclusion

The Chat with Cori chatbot's deep integration with the CoreShare database enables it to provide accurate, personalized assistance to users. By understanding these integration points, developers can effectively maintain and extend the chatbot's capabilities as the platform evolves.