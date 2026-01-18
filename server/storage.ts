import { type User, type InsertUser, type Order, type InsertOrder, users, orders } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { createHash } from "crypto";

function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  validatePassword(email: string, password: string): Promise<User | null>;
  
  getOrdersByUserId(userId: string): Promise<Order[]>;
  getAllOrders(): Promise<(Order & { user?: { name: string; email: string } })[]>;
  createOrder(userId: string, order: InsertOrder): Promise<Order>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values({
      ...insertUser,
      password: hashPassword(insertUser.password),
    }).returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async validatePassword(email: string, password: string): Promise<User | null> {
    const user = await this.getUserByEmail(email);
    if (!user) return null;
    if (user.password !== hashPassword(password)) return null;
    return user;
  }

  async getOrdersByUserId(userId: string): Promise<Order[]> {
    return db.select().from(orders).where(eq(orders.userId, userId));
  }

  async getAllOrders(): Promise<(Order & { user?: { name: string; email: string } })[]> {
    const allOrders = await db.select().from(orders);
    const allUsers = await db.select().from(users);
    
    return allOrders.map(order => {
      const user = allUsers.find(u => u.id === order.userId);
      return {
        ...order,
        user: user ? { name: user.name, email: user.email } : undefined,
      };
    });
  }

  async createOrder(userId: string, insertOrder: InsertOrder): Promise<Order> {
    const [order] = await db.insert(orders).values({
      ...insertOrder,
      userId,
    }).returning();
    return order;
  }
}

export const storage = new DatabaseStorage();

export async function seedAdminUser() {
  const adminEmail = "admin@admin.com";
  const existingAdmin = await storage.getUserByEmail(adminEmail);
  
  if (!existingAdmin) {
    const [adminUser] = await db.insert(users).values({
      email: adminEmail,
      password: hashPassword("admin123"),
      name: "관리자",
      role: "admin",
    }).returning();
    console.log("Admin user created: admin@admin.com / admin123");
    return adminUser;
  }
  return existingAdmin;
}
