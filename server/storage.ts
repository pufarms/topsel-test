import { type User, type InsertUser, type Order, type InsertOrder, type Image, type InsertImage, type ImageSubcategory, type InsertSubcategory, type Partner, type InsertPartner, type Product, type InsertProduct, type PartnerProduct, type InsertPartnerProduct, users, orders, images, imageSubcategories, partners, products, partnerProducts } from "@shared/schema";
import { db } from "./db";
import { eq, desc, or, ilike, and, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";
import { createHash } from "crypto";

function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(data: { username: string; password: string; name: string; phone?: string; email?: string; role?: string; permissions?: string[] }): Promise<User>;
  updateUser(id: string, data: Partial<{ password: string; name: string; phone: string; email: string; role: string; permissions: string[] }>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
  getAllUsers(): Promise<User[]>;
  getAdminUsers(): Promise<User[]>;
  validatePassword(username: string, password: string): Promise<User | null>;
  updateLastLogin(userId: string): Promise<void>;
  updateUserTier(userId: string, tier: string): Promise<User | undefined>;
  
  getOrdersByUserId(userId: string): Promise<Order[]>;
  getAllOrders(): Promise<(Order & { user?: { name: string; username: string } })[]>;
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

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(data: { username: string; password: string; name: string; phone?: string; email?: string; role?: string; permissions?: string[] }): Promise<User> {
    const [user] = await db.insert(users).values({
      username: data.username,
      password: hashPassword(data.password),
      name: data.name,
      phone: data.phone || null,
      email: data.email || null,
      role: data.role || "ADMIN",
      permissions: data.permissions || [],
    }).returning();
    return user;
  }

  async updateUser(id: string, data: Partial<{ password: string; name: string; phone: string; email: string; role: string; permissions: string[] }>): Promise<User | undefined> {
    const updateData: any = { ...data, updatedAt: new Date() };
    if (data.password) {
      updateData.password = hashPassword(data.password);
    }
    const [user] = await db.update(users).set(updateData).where(eq(users.id, id)).returning();
    return user;
  }

  async deleteUser(id: string): Promise<boolean> {
    // Delete related orders first
    await db.delete(orders).where(eq(orders.userId, id));
    const result = await db.delete(users).where(eq(users.id, id)).returning();
    return result.length > 0;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(desc(users.createdAt));
  }

  async getAdminUsers(): Promise<User[]> {
    return db.select().from(users).where(
      or(eq(users.role, "SUPER_ADMIN"), eq(users.role, "ADMIN"))
    ).orderBy(desc(users.createdAt));
  }

  async validatePassword(username: string, password: string): Promise<User | null> {
    const user = await this.getUserByUsername(username);
    if (!user) return null;
    if (user.password !== hashPassword(password)) return null;
    return user;
  }

  async updateLastLogin(userId: string): Promise<void> {
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId));
  }

  async updateUserTier(userId: string, tier: string): Promise<User | undefined> {
    const [user] = await db.update(users).set({ tier, updatedAt: new Date() }).where(eq(users.id, userId)).returning();
    return user;
  }

  async getOrdersByUserId(userId: string): Promise<Order[]> {
    return db.select().from(orders).where(eq(orders.userId, userId));
  }

  async getAllOrders(): Promise<(Order & { user?: { name: string; username: string } })[]> {
    const allOrders = await db.select().from(orders);
    const allUsers = await db.select().from(users);
    
    return allOrders.map(order => {
      const user = allUsers.find(u => u.id === order.userId);
      return {
        ...order,
        user: user ? { name: user.name, username: user.username } : undefined,
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

  // Product methods
  async getAllProducts(): Promise<Product[]> {
    return db.select().from(products).orderBy(products.productCode);
  }

  async getProduct(id: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product;
  }

  async searchProducts(query: string): Promise<Product[]> {
    return db.select().from(products).where(
      or(
        ilike(products.productCode, `%${query}%`),
        ilike(products.productName, `%${query}%`)
      )
    ).orderBy(products.productCode);
  }

  async createProduct(data: InsertProduct): Promise<Product> {
    const [product] = await db.insert(products).values(data).returning();
    return product;
  }

  async getProductByCode(code: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.productCode, code));
    return product;
  }

  // Partner methods
  async getAllPartners(): Promise<Partner[]> {
    return db.select().from(partners).orderBy(desc(partners.createdAt));
  }

  async getPartner(id: string): Promise<Partner | undefined> {
    const [partner] = await db.select().from(partners).where(eq(partners.id, id));
    return partner;
  }

  async getPartnerByUsername(username: string): Promise<Partner | undefined> {
    const [partner] = await db.select().from(partners).where(eq(partners.username, username));
    return partner;
  }

  async createPartner(data: { username: string; password: string; companyName: string; businessNumber: string; representative: string; address: string; phone1: string; phone2?: string; shippingCompany?: string; status?: string }): Promise<Partner> {
    const [partner] = await db.insert(partners).values({
      username: data.username,
      password: hashPassword(data.password),
      companyName: data.companyName,
      businessNumber: data.businessNumber,
      representative: data.representative,
      address: data.address,
      phone1: data.phone1,
      phone2: data.phone2 || null,
      shippingCompany: data.shippingCompany || null,
      status: data.status || "활성",
    }).returning();
    return partner;
  }

  async updatePartner(id: string, data: Partial<{ password: string; companyName: string; businessNumber: string; representative: string; address: string; phone1: string; phone2: string; shippingCompany: string; status: string }>): Promise<Partner | undefined> {
    const updateData: any = { ...data, updatedAt: new Date() };
    if (data.password) {
      updateData.password = hashPassword(data.password);
    }
    const [partner] = await db.update(partners).set(updateData).where(eq(partners.id, id)).returning();
    return partner;
  }

  async deletePartner(id: string): Promise<boolean> {
    // Delete related partner products first
    await db.delete(partnerProducts).where(eq(partnerProducts.partnerId, id));
    const result = await db.delete(partners).where(eq(partners.id, id)).returning();
    return result.length > 0;
  }

  // Partner Product methods
  async getPartnerProducts(partnerId: string): Promise<(PartnerProduct & { product: Product })[]> {
    const pProducts = await db.select().from(partnerProducts).where(eq(partnerProducts.partnerId, partnerId));
    const productIds = pProducts.map(pp => pp.productId);
    if (productIds.length === 0) return [];
    
    const prods = await db.select().from(products).where(inArray(products.id, productIds));
    return pProducts.map(pp => ({
      ...pp,
      product: prods.find(p => p.id === pp.productId)!,
    })).filter(pp => pp.product);
  }

  async addPartnerProduct(partnerId: string, productId: string): Promise<PartnerProduct> {
    const [pp] = await db.insert(partnerProducts).values({ partnerId, productId }).returning();
    return pp;
  }

  async removePartnerProduct(partnerId: string, productId: string): Promise<boolean> {
    const result = await db.delete(partnerProducts).where(
      and(eq(partnerProducts.partnerId, partnerId), eq(partnerProducts.productId, productId))
    ).returning();
    return result.length > 0;
  }

  async setPartnerProducts(partnerId: string, productIds: string[]): Promise<void> {
    // Remove all existing
    await db.delete(partnerProducts).where(eq(partnerProducts.partnerId, partnerId));
    // Add new ones
    if (productIds.length > 0) {
      await db.insert(partnerProducts).values(
        productIds.map(productId => ({ partnerId, productId }))
      );
    }
  }

  async getPartnerProductCount(partnerId: string): Promise<number> {
    const result = await db.select().from(partnerProducts).where(eq(partnerProducts.partnerId, partnerId));
    return result.length;
  }
}

export const storage = new DatabaseStorage();
