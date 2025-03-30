import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { z } from "zod";
import { 
  insertGpuSchema, 
  insertRentalSchema,
  insertReviewSchema,
  insertNotificationSchema
} from "@shared/schema";
import * as chatbot from "./chatbot";

// Middleware to check if user is authenticated
const isAuthenticated = (req: any, res: any, next: any) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Not authenticated" });
};

// Middleware to check user role
const hasRole = (roles: string[]) => (req: any, res: any, next: any) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  
  if (roles.includes(req.user.role) || req.user.role === "both") {
    return next();
  }
  
  res.status(403).json({ message: "Access forbidden" });
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication routes
  setupAuth(app);
  
  // GPU Management Routes
  
  // Get all GPUs
  app.get("/api/gpus", async (req, res) => {
    try {
      const available = req.query.available === "true" ? true : 
                        req.query.available === "false" ? false : 
                        undefined;
      
      const gpus = await storage.listGpus(available);
      res.json(gpus);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Get GPU by ID
  app.get("/api/gpus/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid GPU ID" });
      }
      
      const gpu = await storage.getGpu(id);
      if (!gpu) {
        return res.status(404).json({ message: "GPU not found" });
      }
      
      res.json(gpu);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Create GPU (rentee only)
  app.post("/api/gpus", isAuthenticated, hasRole(["rentee"]), async (req, res) => {
    try {
      const validation = insertGpuSchema.safeParse({
        ...req.body,
        ownerId: req.user.id
      });
      
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Invalid GPU data", 
          errors: validation.error.format() 
        });
      }
      
      const newGpu = await storage.createGpu(validation.data);
      res.status(201).json(newGpu);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Update GPU (owner only)
  app.patch("/api/gpus/:id", isAuthenticated, hasRole(["rentee"]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid GPU ID" });
      }
      
      const gpu = await storage.getGpu(id);
      if (!gpu) {
        return res.status(404).json({ message: "GPU not found" });
      }
      
      // Owner verification
      if (gpu.ownerId !== req.user.id) {
        return res.status(403).json({ message: "You don't own this GPU" });
      }
      
      const updatedGpu = await storage.updateGpu(id, req.body);
      res.json(updatedGpu);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Delete GPU (owner only)
  app.delete("/api/gpus/:id", isAuthenticated, hasRole(["rentee"]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid GPU ID" });
      }
      
      const gpu = await storage.getGpu(id);
      if (!gpu) {
        return res.status(404).json({ message: "GPU not found" });
      }
      
      // Owner verification
      if (gpu.ownerId !== req.user.id) {
        return res.status(403).json({ message: "You don't own this GPU" });
      }
      
      // Check if GPU is currently rented
      if (!gpu.available) {
        return res.status(400).json({ message: "Cannot delete a GPU that is currently rented" });
      }
      
      await storage.deleteGpu(id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Get GPUs by owner
  app.get("/api/users/:id/gpus", async (req, res) => {
    try {
      const ownerId = parseInt(req.params.id);
      if (isNaN(ownerId)) {
        return res.status(400).json({ message: "Invalid owner ID" });
      }
      
      const gpus = await storage.getGpusByOwnerId(ownerId);
      res.json(gpus);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Get my GPUs (for current user)
  app.get("/api/my/gpus", isAuthenticated, hasRole(["rentee"]), async (req, res) => {
    try {
      const gpus = await storage.getGpusByOwnerId(req.user.id);
      res.json(gpus);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Rental Management Routes
  
  // Rent a GPU
  app.post("/api/rentals", isAuthenticated, hasRole(["renter"]), async (req, res) => {
    try {
      const validation = insertRentalSchema.safeParse({
        ...req.body,
        renterId: req.user.id
      });
      
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Invalid rental data", 
          errors: validation.error.format() 
        });
      }
      
      // Fetch the latest GPU data directly from the database
      const gpu = await storage.getGpu(validation.data.gpuId);
      if (!gpu) {
        return res.status(404).json({ message: "GPU not found" });
      }
      
      // Double-check availability
      if (!gpu.available) {
        return res.status(400).json({ message: "GPU is not available for rent" });
      }
      
      // Create the rental
      const rental = await storage.createRental(validation.data);
      
      // Mark GPU as unavailable
      await storage.updateGpu(gpu.id, { available: false });
      
      // Create a notification for the GPU owner
      await storage.createNotification({
        userId: gpu.ownerId,
        title: "New GPU Rental",
        message: `Your GPU ${gpu.name} has been rented`,
        type: 'rental_started',
        relatedId: rental.id
      });
      
      res.status(201).json(rental);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Stop rental (complete or cancel)
  app.patch("/api/rentals/:id/stop", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid rental ID" });
      }
      
      const rental = await storage.getRental(id);
      if (!rental) {
        return res.status(404).json({ message: "Rental not found" });
      }
      
      const gpu = await storage.getGpu(rental.gpuId);
      if (!gpu) {
        return res.status(404).json({ message: "Associated GPU not found" });
      }
      
      // Permission check - only the renter or GPU owner can stop a rental
      if (rental.renterId !== req.user.id && gpu.ownerId !== req.user.id) {
        return res.status(403).json({ message: "Permission denied" });
      }
      
      // Only active rentals can be stopped
      if (rental.status !== "running") {
        return res.status(400).json({ message: "Only active rentals can be stopped" });
      }
      
      const endTime = new Date();
      const durationMs = endTime.getTime() - rental.startTime.getTime();
      const durationHours = durationMs / (1000 * 60 * 60);
      const totalCost = parseFloat((durationHours * gpu.pricePerHour).toFixed(2));
      
      const updatedRental = await storage.updateRental(id, {
        status: "completed",
        endTime,
        totalCost
      });
      
      // Make GPU available again
      await storage.updateGpu(gpu.id, { available: true });
      
      // Create notification for GPU owner that rental is completed
      await storage.createNotification({
        userId: gpu.ownerId,
        title: "Rental Completed",
        message: `Your GPU ${gpu.name} rental has been completed`,
        type: 'rental_completed',
        relatedId: rental.id
      });
      
      // Create notification for renter with cost information
      await storage.createNotification({
        userId: rental.renterId,
        title: "Rental Bill",
        message: `Your rental of ${gpu.name} has been completed. Total cost: Ksh ${totalCost}`,
        type: 'rental_bill',
        relatedId: rental.id
      });
      
      res.json(updatedRental);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Get my rentals (for current user)
  app.get("/api/my/rentals", isAuthenticated, hasRole(["renter"]), async (req, res) => {
    try {
      const status = req.query.status as string;
      let rentals = await storage.getRentalsByRenterId(req.user.id);
      
      if (status) {
        rentals = rentals.filter(rental => rental.status === status);
      }
      
      res.json(rentals);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Get active rentals for GPU owner dashboard
  app.get("/api/my/customers", isAuthenticated, hasRole(["rentee"]), async (req, res) => {
    try {
      // Get all GPUs owned by the current user
      const ownedGpus = await storage.getGpusByOwnerId(req.user.id);
      const ownedGpuIds = ownedGpus.map(gpu => gpu.id);
      
      // Get all rentals
      const allRentals = await storage.listRentals();
      
      // Filter rentals for owned GPUs
      const customerRentals = allRentals.filter(rental => 
        ownedGpuIds.includes(rental.gpuId)
      );
      
      res.json(customerRentals);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Dashboard stats endpoints
  
  // Get dashboard stats for the current user
  app.get("/api/dashboard/stats", isAuthenticated, async (req, res) => {
    try {
      const user = req.user;
      const stats: any = {};
      
      if (user.role === "renter" || user.role === "both") {
        // Get active rentals for renter
        const activeRentals = await storage.getActiveRentalsByRenterId(user.id);
        
        // Calculate total spent and usage hours
        const allRentals = await storage.getRentalsByRenterId(user.id);
        let totalSpent = 0;
        let totalHours = 0;
        
        for (const rental of allRentals) {
          if (rental.totalCost) {
            totalSpent += rental.totalCost;
          }
          
          if (rental.startTime && rental.endTime) {
            const durationMs = rental.endTime.getTime() - rental.startTime.getTime();
            totalHours += durationMs / (1000 * 60 * 60);
          } else if (rental.startTime && rental.status === "running") {
            const durationMs = new Date().getTime() - rental.startTime.getTime();
            totalHours += durationMs / (1000 * 60 * 60);
          }
        }
        
        stats.renter = {
          activeRentals: activeRentals.length,
          totalSpent: parseFloat(totalSpent.toFixed(2)),
          totalHours: parseFloat(totalHours.toFixed(2)),
          activeGpus: activeRentals.length
        };
      }
      
      if (user.role === "rentee" || user.role === "both") {
        // Get GPUs for owner
        const ownedGpus = await storage.getGpusByOwnerId(user.id);
        const totalGpus = ownedGpus.length;
        const activeGpus = ownedGpus.filter(gpu => !gpu.available).length;
        
        // Calculate income
        const allRentals = await storage.listRentals();
        const ownedGpuIds = ownedGpus.map(gpu => gpu.id);
        const relevantRentals = allRentals.filter(rental => 
          ownedGpuIds.includes(rental.gpuId)
        );
        
        let totalIncome = 0;
        for (const rental of relevantRentals) {
          if (rental.totalCost) {
            totalIncome += rental.totalCost;
          }
        }
        
        stats.rentee = {
          totalGpus,
          activeGpus,
          availableGpus: totalGpus - activeGpus,
          totalIncome: parseFloat(totalIncome.toFixed(2))
        };
      }
      
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Reviews Management Routes
  
  // Get reviews for a GPU
  app.get("/api/gpus/:id/reviews", async (req, res) => {
    try {
      const gpuId = parseInt(req.params.id);
      if (isNaN(gpuId)) {
        return res.status(400).json({ message: "Invalid GPU ID" });
      }
      
      const reviews = await storage.getReviewsByGpuId(gpuId);
      res.json(reviews);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Get average rating for a GPU
  app.get("/api/gpus/:id/rating", async (req, res) => {
    try {
      const gpuId = parseInt(req.params.id);
      if (isNaN(gpuId)) {
        return res.status(400).json({ message: "Invalid GPU ID" });
      }
      
      const averageRating = await storage.getAverageRatingForGpu(gpuId);
      res.json({ averageRating });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Create a review
  app.post("/api/reviews", isAuthenticated, hasRole(["renter"]), async (req, res) => {
    try {
      const validation = insertReviewSchema.safeParse({
        ...req.body,
        reviewerId: req.user.id
      });
      
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Invalid review data", 
          errors: validation.error.format() 
        });
      }
      
      // Check if the rental exists and belongs to the user
      const rental = await storage.getRental(validation.data.rentalId);
      if (!rental) {
        return res.status(404).json({ message: "Rental not found" });
      }
      
      if (rental.renterId !== req.user.id) {
        return res.status(403).json({ message: "You can only review your own rentals" });
      }
      
      // Check if the rental is completed
      if (rental.status !== "completed") {
        return res.status(400).json({ message: "You can only review completed rentals" });
      }
      
      // Check if user already reviewed this rental
      const existingReviews = await storage.getReviewsByReviewerId(req.user.id);
      const alreadyReviewed = existingReviews.some(review => review.rentalId === validation.data.rentalId);
      
      if (alreadyReviewed) {
        return res.status(400).json({ message: "You have already reviewed this rental" });
      }
      
      const newReview = await storage.createReview(validation.data);
      res.status(201).json(newReview);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Update a review
  app.patch("/api/reviews/:id", isAuthenticated, hasRole(["renter"]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid review ID" });
      }
      
      const review = await storage.getReview(id);
      if (!review) {
        return res.status(404).json({ message: "Review not found" });
      }
      
      // Only the reviewer can update their review
      if (review.reviewerId !== req.user.id) {
        return res.status(403).json({ message: "You can only update your own reviews" });
      }
      
      const updatedReview = await storage.updateReview(id, req.body);
      res.json(updatedReview);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Delete a review
  app.delete("/api/reviews/:id", isAuthenticated, hasRole(["renter"]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid review ID" });
      }
      
      const review = await storage.getReview(id);
      if (!review) {
        return res.status(404).json({ message: "Review not found" });
      }
      
      // Only the reviewer can delete their review
      if (review.reviewerId !== req.user.id) {
        return res.status(403).json({ message: "You can only delete your own reviews" });
      }
      
      await storage.deleteReview(id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Get reviews by the current user
  app.get("/api/my/reviews", isAuthenticated, hasRole(["renter"]), async (req, res) => {
    try {
      const reviews = await storage.getReviewsByReviewerId(req.user.id);
      res.json(reviews);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Chatbot Routes
  
  // Create a new chat session
  app.post("/api/chat/session", async (req, res) => {
    try {
      const sessionId = chatbot.createChatSession();
      res.json({ sessionId });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Send a message to the chatbot
  app.post("/api/chat/message", async (req, res) => {
    try {
      const { sessionId, message } = req.body;
      
      if (!sessionId || !message) {
        return res.status(400).json({ message: "Session ID and message are required" });
      }
      
      const response = chatbot.processMessage(sessionId, message);
      res.json(response);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Get all messages for a chat session
  app.get("/api/chat/session/:sessionId", async (req, res) => {
    try {
      const { sessionId } = req.params;
      
      if (!sessionId) {
        return res.status(400).json({ message: "Session ID is required" });
      }
      
      const messages = chatbot.getChatMessages(sessionId);
      
      if (!messages) {
        return res.status(404).json({ message: "Chat session not found" });
      }
      
      res.json(messages);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Notification Management Routes
  
  // Get all notifications for the current user
  app.get("/api/notifications", isAuthenticated, async (req, res) => {
    try {
      const notifications = await storage.getNotificationsByUserId(req.user.id);
      res.json(notifications);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Get unread notifications for the current user
  app.get("/api/notifications/unread", isAuthenticated, async (req, res) => {
    try {
      const notifications = await storage.getUnreadNotificationsByUserId(req.user.id);
      res.json(notifications);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Mark a notification as read
  app.patch("/api/notifications/:id/read", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid notification ID" });
      }
      
      const notification = await storage.getNotification(id);
      if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
      }
      
      // Make sure the notification belongs to the user
      if (notification.userId !== req.user.id) {
        return res.status(403).json({ message: "Permission denied" });
      }
      
      const updatedNotification = await storage.markNotificationAsRead(id);
      res.json(updatedNotification);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Mark all notifications as read
  app.post("/api/notifications/mark-all-read", isAuthenticated, async (req, res) => {
    try {
      await storage.markAllNotificationsAsRead(req.user.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Delete a notification
  app.delete("/api/notifications/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid notification ID" });
      }
      
      const notification = await storage.getNotification(id);
      if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
      }
      
      // Make sure the notification belongs to the user
      if (notification.userId !== req.user.id) {
        return res.status(403).json({ message: "Permission denied" });
      }
      
      await storage.deleteNotification(id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  const httpServer = createServer(app);
  return httpServer;
}
