import { 
  InsertGpu, InsertRental, InsertUser, InsertReview, InsertNotification, InsertPayment,
  Gpu, Rental, User, Review, Notification, Payment
} from "@shared/schema";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, data: Partial<User>): Promise<User | undefined>;
  
  // GPU methods
  getGpu(id: number): Promise<Gpu | undefined>;
  listGpus(available?: boolean): Promise<Gpu[]>;
  createGpu(gpu: InsertGpu): Promise<Gpu>;
  updateGpu(id: number, data: Partial<Gpu>): Promise<Gpu | undefined>;
  deleteGpu(id: number): Promise<boolean>;
  getGpusByOwnerId(ownerId: number): Promise<Gpu[]>;
  
  // GPU Analytics methods
  analyzeGpuUsage(): Promise<void>;
  getGpuTaskAnalysis(gpuId: number): Promise<{ 
    popularityScore: number | null; 
    commonTasks: string | null;
    lastAnalyzed: Date | null;
  }>;
  getFrequentlyListedGpus(limit?: number): Promise<Gpu[]>;
  
  // Rental methods
  getRental(id: number): Promise<Rental | undefined>;
  listRentals(): Promise<Rental[]>;
  createRental(rental: InsertRental): Promise<Rental>;
  updateRental(id: number, data: Partial<Rental>): Promise<Rental | undefined>;
  getRentalsByRenterId(renterId: number): Promise<Rental[]>;
  getActiveRentalsByRenterId(renterId: number): Promise<Rental[]>;
  getRentalsByGpuId(gpuId: number): Promise<Rental[]>;
  
  // Review methods
  getReview(id: number): Promise<Review | undefined>;
  getReviewsByGpuId(gpuId: number): Promise<Review[]>;
  getReviewsByReviewerId(reviewerId: number): Promise<Review[]>;
  createReview(review: InsertReview): Promise<Review>;
  updateReview(id: number, data: Partial<Review>): Promise<Review | undefined>;
  deleteReview(id: number): Promise<boolean>;
  getAverageRatingForGpu(gpuId: number): Promise<number>;
  
  // Notification methods
  getNotification(id: number): Promise<Notification | undefined>;
  getNotificationsByUserId(userId: number): Promise<Notification[]>;
  getUnreadNotificationsByUserId(userId: number): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(id: number): Promise<Notification | undefined>;
  markAllNotificationsAsRead(userId: number): Promise<boolean>;
  deleteNotification(id: number): Promise<boolean>;
  
  // Payment methods
  createPayment(payment: InsertPayment): Promise<Payment>;
  getPayment(id: number): Promise<Payment | undefined>;
  getPaymentByPaymentIntentId(paymentIntentId: string): Promise<Payment | undefined>;
  getPaymentsByUserId(userId: number): Promise<Payment[]>;
  updatePayment(id: number, data: Partial<Payment>): Promise<Payment | undefined>;
  updateUserStripeCustomerId(userId: number, stripeCustomerId: string): Promise<User | undefined>;
  
  // For auth session storage
  sessionStore: session.SessionStore;
  
  // Database setup
  initDb(): Promise<void>;
}

export class PostgresStorage implements IStorage {
  sessionStore: session.SessionStore;
  
  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true,
    });
  }
  
  async initDb(): Promise<void> {
    try {
      // Create users table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(255) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          name VARCHAR(255) NOT NULL,
          role VARCHAR(50) NOT NULL DEFAULT 'renter',
          email VARCHAR(255),
          stripe_customer_id VARCHAR(255),
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
      
      // Create gpus table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS gpus (
          id SERIAL PRIMARY KEY,
          owner_id INTEGER NOT NULL REFERENCES users(id),
          name VARCHAR(255) NOT NULL,
          manufacturer VARCHAR(255) NOT NULL,
          description TEXT,
          vram INTEGER NOT NULL,
          cuda_cores INTEGER,
          base_clock FLOAT,
          boost_clock FLOAT,
          price_per_hour FLOAT NOT NULL,
          available BOOLEAN NOT NULL DEFAULT true,
          tdp INTEGER,
          max_temp INTEGER,
          power_draw INTEGER,
          cooling_system VARCHAR(255),
          memory_type VARCHAR(255),
          psu_recommendation VARCHAR(255),
          power_connectors VARCHAR(255),
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
      
      // Create rentals table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS rentals (
          id SERIAL PRIMARY KEY,
          gpu_id INTEGER NOT NULL REFERENCES gpus(id),
          renter_id INTEGER NOT NULL REFERENCES users(id),
          status VARCHAR(50) NOT NULL DEFAULT 'running',
          task VARCHAR(255),
          start_time TIMESTAMP NOT NULL DEFAULT NOW(),
          end_time TIMESTAMP,
          total_cost FLOAT,
          payment_intent_id VARCHAR(255),
          payment_status VARCHAR(50) DEFAULT 'unpaid',
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
      
      // Create reviews table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS reviews (
          id SERIAL PRIMARY KEY,
          rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
          comment TEXT,
          gpu_id INTEGER NOT NULL REFERENCES gpus(id),
          rental_id INTEGER NOT NULL REFERENCES rentals(id),
          reviewer_id INTEGER NOT NULL REFERENCES users(id),
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
      
      // Create notifications table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS notifications (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id),
          title VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          type VARCHAR(50) NOT NULL,
          related_id INTEGER,
          read BOOLEAN NOT NULL DEFAULT false,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
      
      // Create payments table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS payments (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id),
          rental_id INTEGER REFERENCES rentals(id),
          amount FLOAT NOT NULL,
          payment_intent_id VARCHAR(255),
          status VARCHAR(50) NOT NULL DEFAULT 'pending',
          payment_method VARCHAR(50),
          metadata TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
      
      // Check if we need to seed data
      const usersResult = await pool.query('SELECT COUNT(*) FROM users');
      const userCount = parseInt(usersResult.rows[0].count);
      
      if (userCount === 0) {
        await this.seedInitialData();
      }
    } catch (error) {
      console.error('Error initializing database', error);
      throw error;
    }
  }
  
  async getUser(id: number): Promise<User | undefined> {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    if (result.rows.length === 0) return undefined;
    
    const user = result.rows[0] as User;
    // Convert database snake_case to camelCase for the frontend
    return this.mapDatabaseUserToUserModel(user);
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) return undefined;
    
    const user = result.rows[0] as User;
    // Convert database snake_case to camelCase for the frontend
    return this.mapDatabaseUserToUserModel(user);
  }
  
  // Helper method to convert database column names to our schema's camelCase
  private mapDatabaseUserToUserModel(dbUser: any): User {
    return {
      id: dbUser.id,
      username: dbUser.username,
      password: dbUser.password,
      name: dbUser.name,
      role: dbUser.role,
      email: dbUser.email,
      stripeCustomerId: dbUser.stripe_customer_id,
      createdAt: dbUser.created_at,
    };
  }
  
  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await pool.query(`
      INSERT INTO users (username, password, name, role, email)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [
      insertUser.username, 
      insertUser.password, 
      insertUser.name, 
      insertUser.role || 'renter', // Default to renter if not specified
      insertUser.email // Using the email field now passed from the registration form
    ]);
    
    const user = result.rows[0];
    return this.mapDatabaseUserToUserModel(user);
  }
  
  async getGpu(id: number): Promise<Gpu | undefined> {
    const result = await pool.query('SELECT * FROM gpus WHERE id = $1', [id]);
    if (result.rows.length === 0) return undefined;
    
    const gpu = result.rows[0];
    return this.mapDatabaseGpuToGpuModel(gpu);
  }
  
  async listGpus(available?: boolean): Promise<Gpu[]> {
    let query = 'SELECT * FROM gpus';
    const params: any[] = [];
    
    if (available !== undefined) {
      query += ' WHERE available = $1';
      params.push(available);
    }
    
    const result = await pool.query(query, params);
    return result.rows.map(gpu => this.mapDatabaseGpuToGpuModel(gpu));
  }
  
  // Helper method to convert database column names to our schema's camelCase
  private mapDatabaseGpuToGpuModel(dbGpu: any): Gpu {
    return {
      id: dbGpu.id,
      name: dbGpu.name,
      manufacturer: dbGpu.manufacturer,
      vram: dbGpu.vram,
      cudaCores: dbGpu.cuda_cores,
      baseClock: dbGpu.base_clock,
      boostClock: dbGpu.boost_clock,
      pricePerHour: dbGpu.price_per_hour,
      available: dbGpu.available,
      ownerId: dbGpu.owner_id,
      createdAt: dbGpu.created_at,
      tdp: dbGpu.tdp,
      maxTemp: dbGpu.max_temp,
      powerDraw: dbGpu.power_draw,
      coolingSystem: dbGpu.cooling_system,
      memoryType: dbGpu.memory_type,
      psuRecommendation: dbGpu.psu_recommendation,
      powerConnectors: dbGpu.power_connectors,
      // AI analysis fields
      popularityScore: dbGpu.popularity_score,
      commonTasks: dbGpu.common_tasks,
      lastAnalyzed: dbGpu.last_analyzed
    };
  }
  
  async createGpu(insertGpu: InsertGpu): Promise<Gpu> {
    const result = await pool.query(`
      INSERT INTO gpus (
        owner_id, name, manufacturer, vram, cuda_cores, base_clock, boost_clock, price_per_hour,
        tdp, max_temp, power_draw, cooling_system, memory_type, psu_recommendation, power_connectors, available
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *
    `, [
      insertGpu.ownerId,
      insertGpu.name,
      insertGpu.manufacturer,
      insertGpu.vram,
      insertGpu.cudaCores || null,
      insertGpu.baseClock || null,
      insertGpu.boostClock || null,
      insertGpu.pricePerHour,
      insertGpu.tdp || null,
      insertGpu.maxTemp || null,
      insertGpu.powerDraw || null,
      insertGpu.coolingSystem || null,
      insertGpu.memoryType || null,
      insertGpu.psuRecommendation || null,
      insertGpu.powerConnectors || null,
      true // Always create GPUs as available
    ]);
    
    return this.mapDatabaseGpuToGpuModel(result.rows[0]);
  }
  
  async updateGpu(id: number, data: Partial<Gpu>): Promise<Gpu | undefined> {
    const setClause: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;
    
    // Build the SET clause dynamically based on the data provided
    Object.entries(data).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'createdAt') {
        let columnName = key;
        // Convert camelCase to snake_case for DB column names
        if (key === 'ownerId') columnName = 'owner_id';
        if (key === 'boostClock') columnName = 'boost_clock';
        if (key === 'pricePerHour') columnName = 'price_per_hour';
        if (key === 'cudaCores') columnName = 'cuda_cores';
        if (key === 'baseClock') columnName = 'base_clock';
        if (key === 'tdp') columnName = 'tdp';
        if (key === 'maxTemp') columnName = 'max_temp';
        if (key === 'powerDraw') columnName = 'power_draw';
        if (key === 'coolingSystem') columnName = 'cooling_system';
        if (key === 'memoryType') columnName = 'memory_type';
        if (key === 'psuRecommendation') columnName = 'psu_recommendation';
        if (key === 'powerConnectors') columnName = 'power_connectors';
        
        setClause.push(`${columnName} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
      }
    });
    
    if (setClause.length === 0) return this.getGpu(id);
    
    params.push(id);
    const query = `
      UPDATE gpus
      SET ${setClause.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;
    
    const result = await pool.query(query, params);
    return result.rows[0] as Gpu | undefined;
  }
  
  async deleteGpu(id: number): Promise<boolean> {
    const result = await pool.query('DELETE FROM gpus WHERE id = $1', [id]);
    return result.rowCount > 0;
  }
  
  async getGpusByOwnerId(ownerId: number): Promise<Gpu[]> {
    const result = await pool.query('SELECT * FROM gpus WHERE owner_id = $1', [ownerId]);
    return result.rows.map(gpu => this.mapDatabaseGpuToGpuModel(gpu));
  }
  
  // AI Analysis methods
  async analyzeGpuUsage(): Promise<void> {
    try {
      // 1. Get all GPUs
      const gpus = await this.listGpus();
      
      for (const gpu of gpus) {
        // 2. Get rentals for this GPU
        const rentals = await this.getRentalsByGpuId(gpu.id);
        
        // 3. If there are no rentals, skip this GPU
        if (rentals.length === 0) {
          continue;
        }
        
        // 4. Calculate popularity score (based on rental frequency)
        const popularityScore = Math.min(100, Math.floor((rentals.length / gpus.length) * 100));
        
        // 5. Analyze common tasks
        const tasks = rentals
          .filter(rental => rental.task) // Filter out null tasks
          .map(rental => rental.task?.toLowerCase().trim()) // Normalize tasks
          .filter((task): task is string => !!task); // Filter out undefined and null
        
        // Group tasks by frequency
        const taskFrequency: Record<string, number> = {};
        tasks.forEach(task => {
          if (task in taskFrequency) {
            taskFrequency[task]++;
          } else {
            taskFrequency[task] = 1;
          }
        });
        
        // Sort tasks by frequency (most common first)
        const sortedTasks = Object.entries(taskFrequency)
          .sort((a, b) => b[1] - a[1])
          .map(([task]) => task)
          .slice(0, 3); // Get top 3 tasks
        
        // Format common tasks string
        const commonTasks = sortedTasks.length > 0 
          ? sortedTasks.join(', ')
          : null;
        
        // 6. Update GPU with analysis results
        await pool.query(`
          UPDATE gpus 
          SET 
            popularity_score = $1,
            common_tasks = $2,
            last_analyzed = NOW()
          WHERE id = $3
        `, [popularityScore, commonTasks, gpu.id]);
      }
    } catch (error) {
      console.error('Error analyzing GPU usage:', error);
    }
  }
  
  async getRentalsByGpuId(gpuId: number): Promise<Rental[]> {
    const result = await pool.query('SELECT * FROM rentals WHERE gpu_id = $1', [gpuId]);
    return result.rows.map(rental => this.mapDatabaseRentalToRentalModel(rental));
  }
  
  async getGpuTaskAnalysis(gpuId: number): Promise<{ 
    popularityScore: number | null; 
    commonTasks: string | null;
    lastAnalyzed: Date | null;
  }> {
    const result = await pool.query(`
      SELECT popularity_score, common_tasks, last_analyzed
      FROM gpus
      WHERE id = $1
    `, [gpuId]);
    
    if (result.rows.length === 0) {
      return {
        popularityScore: null,
        commonTasks: null,
        lastAnalyzed: null
      };
    }
    
    return {
      popularityScore: result.rows[0].popularity_score,
      commonTasks: result.rows[0].common_tasks,
      lastAnalyzed: result.rows[0].last_analyzed
    };
  }
  
  async getFrequentlyListedGpus(limit: number = 5): Promise<Gpu[]> {
    const result = await pool.query(`
      SELECT * FROM gpus
      WHERE popularity_score IS NOT NULL
      ORDER BY popularity_score DESC
      LIMIT $1
    `, [limit]);
    
    return result.rows.map(gpu => this.mapDatabaseGpuToGpuModel(gpu));
  }
  
  async getRental(id: number): Promise<Rental | undefined> {
    const result = await pool.query('SELECT * FROM rentals WHERE id = $1', [id]);
    if (result.rows.length === 0) return undefined;
    
    const rental = result.rows[0];
    return this.mapDatabaseRentalToRentalModel(rental);
  }
  
  async listRentals(): Promise<Rental[]> {
    const result = await pool.query('SELECT * FROM rentals');
    return result.rows.map(rental => this.mapDatabaseRentalToRentalModel(rental));
  }
  
  // Helper method to convert database column names to our schema's camelCase
  private mapDatabaseRentalToRentalModel(dbRental: any): Rental {
    return {
      id: dbRental.id,
      gpuId: dbRental.gpu_id,
      renterId: dbRental.renter_id,
      task: dbRental.task,
      startTime: dbRental.start_time,
      endTime: dbRental.end_time,
      status: dbRental.status,
      totalCost: dbRental.total_cost,
      paymentIntentId: dbRental.payment_intent_id,
      paymentStatus: dbRental.payment_status,
      createdAt: dbRental.created_at,
      // New fields for rental approval process
      approvedAt: dbRental.approved_at,
      approvedById: dbRental.approved_by_id,
      loginCredentials: dbRental.login_credentials,
      rejectionReason: dbRental.rejection_reason,
    };
  }
  
  // Helper method to convert database column names to our schema's camelCase
  private mapDatabaseReviewToReviewModel(dbReview: any): Review {
    return {
      id: dbReview.id,
      rating: dbReview.rating,
      comment: dbReview.comment,
      gpuId: dbReview.gpu_id,
      rentalId: dbReview.rental_id,
      reviewerId: dbReview.reviewer_id,
      createdAt: dbReview.created_at,
      // Include additional fields from joins if present
      reviewerName: dbReview.reviewer_name,
    };
  }
  
  async createRental(insertRental: InsertRental & { status?: string }): Promise<Rental> {
    const result = await pool.query(`
      INSERT INTO rentals (gpu_id, renter_id, status, task, start_time)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [
      insertRental.gpuId,
      insertRental.renterId,
      insertRental.status || 'pending_approval', // Use the new default status
      insertRental.task,
      new Date()
    ]);
    
    const rental = result.rows[0];
    return this.mapDatabaseRentalToRentalModel(rental);
  }
  
  async updateRental(id: number, data: Partial<Rental>): Promise<Rental | undefined> {
    const setClause: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;
    
    // Build the SET clause dynamically based on the data provided
    Object.entries(data).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'createdAt') {
        let columnName = key;
        // Convert camelCase to snake_case for DB column names
        if (key === 'gpuId') columnName = 'gpu_id';
        if (key === 'renterId') columnName = 'renter_id';
        if (key === 'startTime') columnName = 'start_time';
        if (key === 'endTime') columnName = 'end_time';
        if (key === 'totalCost') columnName = 'total_cost';
        if (key === 'paymentIntentId') columnName = 'payment_intent_id';
        if (key === 'paymentStatus') columnName = 'payment_status';
        // New rental approval process fields
        if (key === 'approvedAt') columnName = 'approved_at';
        if (key === 'approvedById') columnName = 'approved_by_id';
        if (key === 'loginCredentials') columnName = 'login_credentials';
        if (key === 'rejectionReason') columnName = 'rejection_reason';
        
        setClause.push(`${columnName} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
      }
    });
    
    if (setClause.length === 0) return this.getRental(id);
    
    params.push(id);
    const query = `
      UPDATE rentals
      SET ${setClause.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;
    
    const result = await pool.query(query, params);
    if (result.rows.length === 0) return undefined;
    
    return this.mapDatabaseRentalToRentalModel(result.rows[0]);
  }
  
  async getRentalsByRenterId(renterId: number): Promise<Rental[]> {
    const result = await pool.query('SELECT * FROM rentals WHERE renter_id = $1', [renterId]);
    return result.rows.map(rental => this.mapDatabaseRentalToRentalModel(rental));
  }
  
  async getActiveRentalsByRenterId(renterId: number): Promise<Rental[]> {
    const result = await pool.query(`
      SELECT * FROM rentals 
      WHERE renter_id = $1 AND status = 'running'
    `, [renterId]);
    
    return result.rows.map(rental => this.mapDatabaseRentalToRentalModel(rental));
  }
  
  // Review methods implementation
  async getReview(id: number): Promise<Review | undefined> {
    const result = await pool.query('SELECT * FROM reviews WHERE id = $1', [id]);
    if (result.rows.length === 0) return undefined;
    
    return this.mapDatabaseReviewToReviewModel(result.rows[0]);
  }
  
  async getReviewsByGpuId(gpuId: number): Promise<Review[]> {
    const result = await pool.query(`
      SELECT r.*, u.username as reviewer_name
      FROM reviews r
      JOIN users u ON r.reviewer_id = u.id
      WHERE r.gpu_id = $1
      ORDER BY r.created_at DESC
    `, [gpuId]);
    
    return result.rows.map(review => this.mapDatabaseReviewToReviewModel(review));
  }
  
  async getReviewsByReviewerId(reviewerId: number): Promise<Review[]> {
    const result = await pool.query('SELECT * FROM reviews WHERE reviewer_id = $1', [reviewerId]);
    return result.rows.map(review => this.mapDatabaseReviewToReviewModel(review));
  }
  
  async createReview(insertReview: InsertReview): Promise<Review> {
    const result = await pool.query(`
      INSERT INTO reviews (rating, comment, gpu_id, rental_id, reviewer_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [
      insertReview.rating,
      insertReview.comment,
      insertReview.gpuId,
      insertReview.rentalId,
      insertReview.reviewerId
    ]);
    
    // Get the username for the reviewer
    const userResult = await pool.query('SELECT username FROM users WHERE id = $1', [insertReview.reviewerId]);
    const username = userResult.rows[0]?.username;
    
    const review = result.rows[0];
    return {
      ...this.mapDatabaseReviewToReviewModel(review),
      reviewerName: username
    };
  }
  
  async updateReview(id: number, data: Partial<Review>): Promise<Review | undefined> {
    const setClause: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;
    
    // Build the SET clause dynamically based on the data provided
    Object.entries(data).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'createdAt' && key !== 'reviewerName') {
        let columnName = key;
        // Convert camelCase to snake_case for DB column names
        if (key === 'gpuId') columnName = 'gpu_id';
        if (key === 'rentalId') columnName = 'rental_id';
        if (key === 'reviewerId') columnName = 'reviewer_id';
        
        setClause.push(`${columnName} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
      }
    });
    
    if (setClause.length === 0) return this.getReview(id);
    
    params.push(id);
    const query = `
      UPDATE reviews
      SET ${setClause.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;
    
    const result = await pool.query(query, params);
    if (result.rows.length === 0) return undefined;
    
    return this.mapDatabaseReviewToReviewModel(result.rows[0]);
  }
  
  async deleteReview(id: number): Promise<boolean> {
    const result = await pool.query('DELETE FROM reviews WHERE id = $1', [id]);
    return result.rowCount ? result.rowCount > 0 : false;
  }
  
  async getAverageRatingForGpu(gpuId: number): Promise<number> {
    const result = await pool.query(`
      SELECT COALESCE(AVG(rating), 0) as average_rating
      FROM reviews
      WHERE gpu_id = $1
    `, [gpuId]);
    
    return parseFloat(result.rows[0].average_rating);
  }
  
  // Notification methods implementation
  private mapDatabaseNotificationToNotificationModel(dbNotification: any): Notification {
    return {
      id: dbNotification.id,
      userId: dbNotification.user_id,
      title: dbNotification.title,
      message: dbNotification.message,
      type: dbNotification.type,
      read: dbNotification.read,
      relatedId: dbNotification.related_id,
      createdAt: dbNotification.created_at,
    };
  }
  
  async getNotification(id: number): Promise<Notification | undefined> {
    const result = await pool.query('SELECT * FROM notifications WHERE id = $1', [id]);
    if (result.rows.length === 0) return undefined;
    
    return this.mapDatabaseNotificationToNotificationModel(result.rows[0]);
  }
  
  async getNotificationsByUserId(userId: number): Promise<Notification[]> {
    const result = await pool.query(
      'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC', 
      [userId]
    );
    
    return result.rows.map(notification => this.mapDatabaseNotificationToNotificationModel(notification));
  }
  
  async getUnreadNotificationsByUserId(userId: number): Promise<Notification[]> {
    const result = await pool.query(
      'SELECT * FROM notifications WHERE user_id = $1 AND read = false ORDER BY created_at DESC', 
      [userId]
    );
    
    return result.rows.map(notification => this.mapDatabaseNotificationToNotificationModel(notification));
  }
  
  async createNotification(insertNotification: InsertNotification): Promise<Notification> {
    const result = await pool.query(`
      INSERT INTO notifications (user_id, title, message, type, related_id, read)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      insertNotification.userId,
      insertNotification.title,
      insertNotification.message,
      insertNotification.type,
      insertNotification.relatedId || null,
      false // Default to unread
    ]);
    
    return this.mapDatabaseNotificationToNotificationModel(result.rows[0]);
  }
  
  async markNotificationAsRead(id: number): Promise<Notification | undefined> {
    const result = await pool.query(`
      UPDATE notifications
      SET read = true
      WHERE id = $1
      RETURNING *
    `, [id]);
    
    if (result.rows.length === 0) return undefined;
    
    return this.mapDatabaseNotificationToNotificationModel(result.rows[0]);
  }
  
  async markAllNotificationsAsRead(userId: number): Promise<boolean> {
    const result = await pool.query(`
      UPDATE notifications
      SET read = true
      WHERE user_id = $1 AND read = false
    `, [userId]);
    
    return result.rowCount !== null && result.rowCount > 0;
  }
  
  async deleteNotification(id: number): Promise<boolean> {
    const result = await pool.query('DELETE FROM notifications WHERE id = $1', [id]);
    return result.rowCount !== null && result.rowCount > 0;
  }
  
  private async seedInitialData(): Promise<void> {
    // Create a demo owner account
    const demoOwnerResult = await pool.query(`
      INSERT INTO users (username, password, name, role)
      VALUES ('ownerdemo', '5d41402abc4b2a76b9719d911017c592.afc7fb73a4e0b8a55d785644323eba29', 'Owner Demo', 'rentee')
      RETURNING *
    `);
    
    const ownerId = demoOwnerResult.rows[0].id;
    
    // Create some GPUs owned by this user
    const gpusResult = await pool.query(`
      INSERT INTO gpus (owner_id, name, manufacturer, vram, boost_clock, price_per_hour)
      VALUES 
        ($1, 'NVIDIA RTX 4090', 'NVIDIA', 24, 2.5, 75),
        ($1, 'AMD Radeon RX 7900 XTX', 'AMD', 24, 2.3, 65),
        ($1, 'NVIDIA RTX 3090', 'NVIDIA', 24, 1.7, 55)
      RETURNING id
    `, [ownerId]);
    
    // Create a demo renter account
    const renterResult = await pool.query(`
      INSERT INTO users (username, password, name, role)
      VALUES ('renterdemo', '5d41402abc4b2a76b9719d911017c592.afc7fb73a4e0b8a55d785644323eba29', 'Renter Demo', 'renter')
      RETURNING id
    `);
    
    const renterId = renterResult.rows[0].id;
    
    // Create a sample rental for the demo renter
    const rentalResult = await pool.query(`
      INSERT INTO rentals (gpu_id, renter_id, status, task, start_time, end_time)
      VALUES ($1, $2, 'completed', 'Training a machine learning model', NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day')
      RETURNING id
    `, [gpusResult.rows[0].id, renterId]);
    
    // Add a sample review for that rental
    await pool.query(`
      INSERT INTO reviews (rating, comment, gpu_id, rental_id, reviewer_id)
      VALUES (5, 'Great performance for my deep learning workload!', $1, $2, $3)
    `, [gpusResult.rows[0].id, rentalResult.rows[0].id, renterId]);
  }

  // User update
  async updateUser(id: number, data: Partial<User>): Promise<User | undefined> {
    const setClause: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;
    
    // Build the SET clause dynamically based on the data provided
    Object.entries(data).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'createdAt') {
        let columnName = key;
        // Convert camelCase to snake_case for DB column names
        if (key === 'stripeCustomerId') columnName = 'stripe_customer_id';
        if (key === 'createdAt') columnName = 'created_at';
        
        setClause.push(`${columnName} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
      }
    });
    
    if (setClause.length === 0) return this.getUser(id);
    
    params.push(id);
    const query = `
      UPDATE users
      SET ${setClause.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;
    
    const result = await pool.query(query, params);
    if (result.rows.length === 0) return undefined;
    
    return this.mapDatabaseUserToUserModel(result.rows[0]);
  }
  
  // Payment methods
  
  async createPayment(payment: InsertPayment): Promise<Payment> {
    const result = await pool.query(`
      INSERT INTO payments (user_id, rental_id, amount, payment_intent_id, status, payment_method, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      payment.userId,
      payment.rentalId || null,
      payment.amount,
      payment.paymentIntentId || null,
      payment.status || 'pending',
      payment.paymentMethod || null,
      payment.metadata || null
    ]);
    
    return this.mapDatabasePaymentToPaymentModel(result.rows[0]);
  }
  
  async getPayment(id: number): Promise<Payment | undefined> {
    const result = await pool.query('SELECT * FROM payments WHERE id = $1', [id]);
    if (result.rows.length === 0) return undefined;
    
    return this.mapDatabasePaymentToPaymentModel(result.rows[0]);
  }
  
  async getPaymentByPaymentIntentId(paymentIntentId: string): Promise<Payment | undefined> {
    const result = await pool.query('SELECT * FROM payments WHERE payment_intent_id = $1', [paymentIntentId]);
    if (result.rows.length === 0) return undefined;
    
    return this.mapDatabasePaymentToPaymentModel(result.rows[0]);
  }
  
  async getPaymentsByUserId(userId: number): Promise<Payment[]> {
    const result = await pool.query('SELECT * FROM payments WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
    return result.rows.map(payment => this.mapDatabasePaymentToPaymentModel(payment));
  }
  
  async updatePayment(id: number, data: Partial<Payment>): Promise<Payment | undefined> {
    const setClause: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;
    
    // Build the SET clause dynamically based on the data provided
    Object.entries(data).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'createdAt') {
        let columnName = key;
        // Convert camelCase to snake_case for DB column names
        if (key === 'userId') columnName = 'user_id';
        if (key === 'rentalId') columnName = 'rental_id';
        if (key === 'paymentIntentId') columnName = 'payment_intent_id';
        if (key === 'paymentMethod') columnName = 'payment_method';
        
        setClause.push(`${columnName} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
      }
    });
    
    if (setClause.length === 0) return this.getPayment(id);
    
    params.push(id);
    const query = `
      UPDATE payments
      SET ${setClause.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;
    
    const result = await pool.query(query, params);
    if (result.rows.length === 0) return undefined;
    
    return this.mapDatabasePaymentToPaymentModel(result.rows[0]);
  }
  
  async updateUserStripeCustomerId(userId: number, stripeCustomerId: string): Promise<User | undefined> {
    const result = await pool.query(`
      UPDATE users
      SET stripe_customer_id = $1
      WHERE id = $2
      RETURNING *
    `, [stripeCustomerId, userId]);
    
    if (result.rows.length === 0) return undefined;
    
    return this.mapDatabaseUserToUserModel(result.rows[0]);
  }
  
  // Helper method to map payment data
  private mapDatabasePaymentToPaymentModel(dbPayment: any): Payment {
    return {
      id: dbPayment.id,
      userId: dbPayment.user_id,
      rentalId: dbPayment.rental_id,
      amount: dbPayment.amount,
      paymentIntentId: dbPayment.payment_intent_id,
      status: dbPayment.status,
      paymentMethod: dbPayment.payment_method,
      metadata: dbPayment.metadata,
      createdAt: dbPayment.created_at,
    };
  }
}

export const storage = new PostgresStorage();
