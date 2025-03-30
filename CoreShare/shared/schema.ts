import { pgTable, text, serial, integer, boolean, timestamp, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull(), // 'renter', 'rentee', or 'both'
  email: text("email"), // Email can be null in the database
  stripeCustomerId: text("stripe_customer_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

// GPU table
export const gpus = pgTable("gpus", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  manufacturer: text("manufacturer").notNull(),
  vram: integer("vram").notNull(), // in GB
  cudaCores: integer("cuda_cores"),
  baseClock: doublePrecision("base_clock"), // in GHz
  boostClock: doublePrecision("boost_clock"), // in GHz
  pricePerHour: doublePrecision("price_per_hour").notNull(),
  available: boolean("available").notNull().default(true),
  ownerId: integer("owner_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  // Thermal and power efficiency fields
  tdp: integer("tdp"), // Thermal Design Power in watts
  maxTemp: integer("max_temp"), // Maximum temperature in Celsius
  powerDraw: integer("power_draw"), // Typical power consumption in watts
  coolingSystem: text("cooling_system"), // Type of cooling (e.g., "Air", "Liquid")
  // Additional fields for details view
  memoryType: text("memory_type"), // e.g., GDDR6X
  psuRecommendation: integer("psu_recommendation"), // Recommended PSU wattage
  powerConnectors: text("power_connectors"), // e.g., "1x 8-pin + 1x 6-pin"
  // AI analysis fields
  popularityScore: integer("popularity_score"),
  commonTasks: text("common_tasks"),
  lastAnalyzed: timestamp("last_analyzed"),
});

// Rental table
export const rentals = pgTable("rentals", {
  id: serial("id").primaryKey(),
  gpuId: integer("gpu_id").notNull(),
  renterId: integer("renter_id").notNull(),
  task: text("task"),
  startTime: timestamp("start_time").notNull().defaultNow(),
  endTime: timestamp("end_time"),
  status: text("status").notNull().default("running"), // 'running', 'completed', 'cancelled'
  totalCost: doublePrecision("total_cost"),
  paymentIntentId: text("payment_intent_id"),
  paymentStatus: text("payment_status").default("unpaid"), // 'unpaid', 'paid', 'refunded'
  createdAt: timestamp("created_at").defaultNow(),
});

// Reviews table
export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  rating: integer("rating").notNull(), // 1-5 stars
  comment: text("comment"),
  gpuId: integer("gpu_id").notNull(),
  rentalId: integer("rental_id").notNull(),
  reviewerId: integer("reviewer_id").notNull(), // The user who left the review
  createdAt: timestamp("created_at").defaultNow(),
});

// Notifications table
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(), // The user who receives the notification
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type").notNull(), // 'rental_request', 'credentials', 'system', etc.
  relatedId: integer("related_id"), // Related entity ID (e.g., rental ID, GPU ID)
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Payments table to track all transactions
export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(), // User who made the payment
  rentalId: integer("rental_id"), // Related rental (if applicable)
  amount: doublePrecision("amount").notNull(), // Amount in dollars
  paymentIntentId: text("payment_intent_id"), // Stripe payment intent ID
  status: text("status").notNull().default("pending"), // 'pending', 'succeeded', 'failed', 'refunded'
  paymentMethod: text("payment_method"), // e.g., 'card', 'bank_transfer'
  metadata: text("metadata"), // Store any additional info as JSON string
  createdAt: timestamp("created_at").defaultNow(),
});

// Schema validation
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  name: true,
  role: true,
  email: true,
});

export const insertGpuSchema = createInsertSchema(gpus).pick({
  name: true,
  manufacturer: true,
  vram: true,
  cudaCores: true,
  baseClock: true,
  boostClock: true,
  pricePerHour: true,
  ownerId: true,
  available: true,
  tdp: true,
  maxTemp: true,
  powerDraw: true,
  coolingSystem: true,
  memoryType: true,
  psuRecommendation: true,
  powerConnectors: true,
});

export const insertRentalSchema = createInsertSchema(rentals).pick({
  gpuId: true,
  renterId: true,
  task: true,
});

export const insertReviewSchema = createInsertSchema(reviews).pick({
  rating: true,
  comment: true,
  gpuId: true,
  rentalId: true,
  reviewerId: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).pick({
  userId: true,
  title: true,
  message: true,
  type: true,
  relatedId: true,
});

export const insertPaymentSchema = createInsertSchema(payments).pick({
  userId: true,
  rentalId: true,
  amount: true,
  paymentIntentId: true,
  status: true,
  paymentMethod: true,
  metadata: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Gpu = typeof gpus.$inferSelect;
export type InsertGpu = z.infer<typeof insertGpuSchema>;

export type Rental = typeof rentals.$inferSelect;
export type InsertRental = z.infer<typeof insertRentalSchema>;

export type Review = typeof reviews.$inferSelect & { 
  reviewerName?: string; // Additional field from join queries
};
export type InsertReview = z.infer<typeof insertReviewSchema>;

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;

// Extended Types for Frontend
export const loginSchema = insertUserSchema.pick({
  username: true,
  password: true,
});

export type LoginData = z.infer<typeof loginSchema>;
