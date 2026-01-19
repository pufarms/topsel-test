import { type User, type InsertUser, type Order, type InsertOrder, type Image, type InsertImage, type ImageSubcategory, type InsertSubcategory, users, orders, images, imageSubcategories } from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";
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
  updateUserTier(userId: string, tier: string): Promise<User | undefined>;
  
  getOrdersByUserId(userId: string): Promise<Order[]>;
  getAllOrders(): Promise<(Order & { user?: { name: string; email: string } })[]>;
  createOrder(userId: string, order: InsertOrder): Promise<Order>;

  createImage(insertImage: InsertImage): Promise<Image>;
  getAllImages(): Promise<Image[]>;
  getImagesByCategory(category: string): Promise<Image[]>;
  getImage(id: string): Promise<Image | undefined>;
  deleteImage(id: string): Promise<boolean>;

  getAllSubcategories(): Promise<ImageSubcategory[]>;
  getSubcategoriesByCategory(category: string): Promise<ImageSubcategory[]>;
  createSubcategory(data: InsertSubcategory): Promise<ImageSubcategory>;
  updateSubcategory(id: string, name: string): Promise<ImageSubcategory | undefined>;
  deleteSubcategory(id: string): Promise<boolean>;
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

  async updateUserTier(userId: string, tier: string): Promise<User | undefined> {
    const [user] = await db.update(users).set({ tier }).where(eq(users.id, userId)).returning();
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

  async createImage(insertImage: InsertImage): Promise<Image> {
    const [image] = await db.insert(images).values(insertImage).returning();
    return image;
  }

  async getAllImages(): Promise<Image[]> {
    return db.select().from(images).orderBy(desc(images.uploadedAt));
  }

  async getImagesByCategory(category: string): Promise<Image[]> {
    return db.select().from(images).where(eq(images.category, category)).orderBy(desc(images.uploadedAt));
  }

  async getImage(id: string): Promise<Image | undefined> {
    const [image] = await db.select().from(images).where(eq(images.id, id));
    return image;
  }

  async deleteImage(id: string): Promise<boolean> {
    const result = await db.delete(images).where(eq(images.id, id)).returning();
    return result.length > 0;
  }

  async getAllSubcategories(): Promise<ImageSubcategory[]> {
    return db.select().from(imageSubcategories).orderBy(imageSubcategories.category, imageSubcategories.name);
  }

  async getSubcategoriesByCategory(category: string): Promise<ImageSubcategory[]> {
    return db.select().from(imageSubcategories).where(eq(imageSubcategories.category, category)).orderBy(imageSubcategories.name);
  }

  async createSubcategory(data: InsertSubcategory): Promise<ImageSubcategory> {
    const [subcategory] = await db.insert(imageSubcategories).values(data).returning();
    return subcategory;
  }

  async updateSubcategory(id: string, name: string): Promise<ImageSubcategory | undefined> {
    const [subcategory] = await db.update(imageSubcategories).set({ name }).where(eq(imageSubcategories.id, id)).returning();
    return subcategory;
  }

  async deleteSubcategory(id: string): Promise<boolean> {
    const result = await db.delete(imageSubcategories).where(eq(imageSubcategories.id, id)).returning();
    return result.length > 0;
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
