import { type User, type InsertUser, type Order, type InsertOrder, type Image, type InsertImage, type ImageSubcategory, type InsertSubcategory, type Partner, type InsertPartner, type Product, type InsertProduct, type PartnerProduct, type InsertPartnerProduct, type Member, type InsertMember, type MemberLog, type InsertMemberLog, type Category, type InsertCategory, type ProductRegistration, type InsertProductRegistration, type NextWeekProduct, type InsertNextWeekProduct, type CurrentProduct, type InsertCurrentProduct, type MaterialCategoryLarge, type InsertMaterialCategoryLarge, type MaterialCategoryMedium, type InsertMaterialCategoryMedium, type MaterialCategorySmall, type InsertMaterialCategorySmall, type Material, type InsertMaterial, type ProductMapping, type InsertProductMapping, type ProductMaterialMapping, type InsertProductMaterialMapping, type ProductStock, type InsertProductStock, type StockHistory, type InsertStockHistory, type SiteSetting, type InsertSiteSetting, type HeaderMenu, type InsertHeaderMenu, type Page, type InsertPage, users, orders, images, imageSubcategories, partners, products, partnerProducts, members, memberLogs, categories, productRegistrations, nextWeekProducts, currentProducts, materialCategoriesLarge, materialCategoriesMedium, materialCategoriesSmall, materials, productMappings, productMaterialMappings, productStocks, stockHistory, siteSettings, headerMenus, pages } from "@shared/schema";
import { db } from "./db";
import { eq, desc, or, ilike, and, inArray, gte, lte, like } from "drizzle-orm";
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
  validateMemberPassword(username: string, password: string): Promise<Member | null>;
  updateLastLogin(userId: string): Promise<void>;
  updateMemberLastLogin(memberId: string): Promise<void>;
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

  // Partner methods
  getAllPartners(): Promise<Partner[]>;
  getPartner(id: string): Promise<Partner | undefined>;
  createPartner(data: InsertPartner): Promise<Partner>;
  updatePartner(id: string, data: Partial<InsertPartner>): Promise<Partner | undefined>;
  deletePartner(id: string): Promise<boolean>;

  // Product methods
  getAllProducts(): Promise<Product[]>;
  getProduct(id: string): Promise<Product | undefined>;
  createProduct(data: InsertProduct): Promise<Product>;
  updateProduct(id: string, data: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: string): Promise<boolean>;

  // Partner Product methods
  getPartnerProducts(partnerId: string): Promise<(PartnerProduct & { product: Product })[]>;
  addPartnerProduct(partnerId: string, productId: string): Promise<PartnerProduct>;
  removePartnerProduct(partnerId: string, productId: string): Promise<boolean>;
  updatePartnerProducts(partnerId: string, productIds: string[]): Promise<void>;

  // Member methods
  getAllMembers(): Promise<Member[]>;
  getMember(id: string): Promise<Member | undefined>;
  getMemberByUsername(username: string): Promise<Member | undefined>;
  createMember(data: InsertMember): Promise<Member>;
  updateMember(id: string, data: Partial<InsertMember>): Promise<Member | undefined>;
  deleteMember(id: string): Promise<boolean>;
  bulkUpdateMembers(ids: string[], data: Partial<InsertMember>): Promise<Member[]>;
  getMemberLogs(memberId: string): Promise<(MemberLog & { changedByUser?: { name: string } })[]>;
  createMemberLog(data: InsertMemberLog): Promise<MemberLog>;

  // Category methods
  getAllCategories(): Promise<Category[]>;
  getCategoriesByLevel(level: string): Promise<Category[]>;
  getCategoriesByParent(parentId: string): Promise<Category[]>;
  getCategory(id: string): Promise<Category | undefined>;
  createCategory(data: InsertCategory): Promise<Category>;
  updateCategory(id: string, data: Partial<InsertCategory>): Promise<Category | undefined>;
  deleteCategory(id: string): Promise<boolean>;
  hasChildCategories(id: string): Promise<boolean>;
  getProductCountByCategory(categoryName: string, level: string): Promise<number>;

  // Product Registration methods
  getAllProductRegistrations(status?: string): Promise<ProductRegistration[]>;
  getProductRegistration(id: string): Promise<ProductRegistration | undefined>;
  getProductRegistrationByCode(code: string): Promise<ProductRegistration | undefined>;
  createProductRegistration(data: any): Promise<ProductRegistration>;
  updateProductRegistration(id: string, data: any): Promise<ProductRegistration | undefined>;
  bulkUpdateProductRegistrations(ids: string[], data: any): Promise<ProductRegistration[]>;
  deleteProductRegistration(id: string): Promise<boolean>;
  bulkDeleteProductRegistrations(ids: string[]): Promise<number>;
  suspendProductRegistrations(ids: string[], reason: string): Promise<number>;
  resumeProductRegistrations(ids: string[]): Promise<number>;

  // Next Week Products methods (차주 예상공급가)
  getAllNextWeekProducts(): Promise<NextWeekProduct[]>;
  getNextWeekProduct(id: string): Promise<NextWeekProduct | undefined>;
  getNextWeekProductByCode(code: string): Promise<NextWeekProduct | undefined>;
  createNextWeekProduct(data: InsertNextWeekProduct): Promise<NextWeekProduct>;
  updateNextWeekProduct(id: string, data: Partial<InsertNextWeekProduct>): Promise<NextWeekProduct | undefined>;
  upsertNextWeekProduct(data: InsertNextWeekProduct): Promise<NextWeekProduct>;
  bulkDeleteNextWeekProducts(ids: string[]): Promise<number>;

  // Current Products methods (현재 공급가)
  getAllCurrentProducts(): Promise<CurrentProduct[]>;
  getCurrentProductsByStatus(status: string): Promise<CurrentProduct[]>;
  getCurrentProduct(id: string): Promise<CurrentProduct | undefined>;
  getCurrentProductByCode(code: string): Promise<CurrentProduct | undefined>;
  createCurrentProduct(data: InsertCurrentProduct): Promise<CurrentProduct>;
  updateCurrentProduct(id: string, data: Partial<InsertCurrentProduct>): Promise<CurrentProduct | undefined>;
  upsertCurrentProduct(data: InsertCurrentProduct): Promise<CurrentProduct>;
  suspendCurrentProducts(ids: string[], reason: string): Promise<number>;
  resumeCurrentProducts(ids: string[]): Promise<number>;
  deleteCurrentProduct(id: string): Promise<boolean>;
  bulkDeleteCurrentProducts(ids: string[]): Promise<number>;

  // Material Category Large methods (재료 대분류)
  getAllMaterialCategoriesLarge(): Promise<MaterialCategoryLarge[]>;
  getMaterialCategoryLarge(id: string): Promise<MaterialCategoryLarge | undefined>;
  getMaterialCategoryLargeByName(name: string): Promise<MaterialCategoryLarge | undefined>;
  createMaterialCategoryLarge(data: InsertMaterialCategoryLarge): Promise<MaterialCategoryLarge>;
  updateMaterialCategoryLarge(id: string, data: Partial<InsertMaterialCategoryLarge>): Promise<MaterialCategoryLarge | undefined>;
  deleteMaterialCategoryLarge(id: string): Promise<boolean>;

  // Material Category Medium methods (재료 중분류)
  getAllMaterialCategoriesMedium(): Promise<MaterialCategoryMedium[]>;
  getMaterialCategoriesMediumByLarge(largeCategoryId: string): Promise<MaterialCategoryMedium[]>;
  getMaterialCategoryMedium(id: string): Promise<MaterialCategoryMedium | undefined>;
  getMaterialCategoryMediumByName(largeCategoryId: string, name: string): Promise<MaterialCategoryMedium | undefined>;
  createMaterialCategoryMedium(data: InsertMaterialCategoryMedium): Promise<MaterialCategoryMedium>;
  updateMaterialCategoryMedium(id: string, data: Partial<InsertMaterialCategoryMedium>): Promise<MaterialCategoryMedium | undefined>;
  deleteMaterialCategoryMedium(id: string): Promise<boolean>;

  // Material Category Small methods (재료 소분류)
  getAllMaterialCategoriesSmall(): Promise<MaterialCategorySmall[]>;
  getMaterialCategoriesSmallByMedium(mediumCategoryId: string): Promise<MaterialCategorySmall[]>;
  getMaterialCategorySmall(id: string): Promise<MaterialCategorySmall | undefined>;
  getMaterialCategorySmallByName(mediumCategoryId: string, name: string): Promise<MaterialCategorySmall | undefined>;
  createMaterialCategorySmall(data: InsertMaterialCategorySmall): Promise<MaterialCategorySmall>;
  updateMaterialCategorySmall(id: string, data: Partial<InsertMaterialCategorySmall>): Promise<MaterialCategorySmall | undefined>;
  deleteMaterialCategorySmall(id: string): Promise<boolean>;

  // Material methods (재료)
  getAllMaterials(): Promise<Material[]>;
  getMaterialsByCategory(largeCategoryId?: string, mediumCategoryId?: string): Promise<Material[]>;
  getMaterialsBySmallCategory(smallCategoryId: string): Promise<Material[]>;
  getMaterial(id: string): Promise<Material | undefined>;
  getMaterialByCode(code: string): Promise<Material | undefined>;
  getMaterialByName(name: string): Promise<Material | undefined>;
  createMaterial(data: InsertMaterial): Promise<Material>;
  updateMaterial(id: string, data: Partial<InsertMaterial>): Promise<Material | undefined>;
  deleteMaterial(id: string): Promise<boolean>;
  bulkDeleteMaterials(ids: string[]): Promise<number>;
  getNextMaterialCode(type: string): Promise<string>;

  // Product Mapping methods (상품 매핑)
  getAllProductMappings(): Promise<ProductMapping[]>;
  getProductMapping(id: string): Promise<ProductMapping | undefined>;
  getProductMappingByCode(productCode: string): Promise<ProductMapping | undefined>;
  createProductMapping(data: InsertProductMapping): Promise<ProductMapping>;
  updateProductMapping(id: string, data: Partial<InsertProductMapping>): Promise<ProductMapping | undefined>;
  updateProductMappingByCode(productCode: string, data: Partial<InsertProductMapping>): Promise<ProductMapping | undefined>;
  deleteProductMapping(productCode: string): Promise<boolean>;
  bulkCreateProductMappings(data: InsertProductMapping[]): Promise<ProductMapping[]>;

  // Product Material Mapping methods (상품-재료 매핑)
  getProductMaterialMappings(productCode: string): Promise<ProductMaterialMapping[]>;
  createProductMaterialMapping(data: InsertProductMaterialMapping): Promise<ProductMaterialMapping>;
  deleteProductMaterialMappingsByProduct(productCode: string): Promise<number>;
  replaceProductMaterialMappings(productCode: string, mappings: Omit<InsertProductMaterialMapping, "productCode">[]): Promise<ProductMaterialMapping[]>;

  // Product Stock methods (재고 관리)
  getAllProductStocks(): Promise<ProductStock[]>;
  getProductStocksWithStock(): Promise<ProductStock[]>;
  getProductStock(productCode: string): Promise<ProductStock | undefined>;
  createProductStock(data: InsertProductStock): Promise<ProductStock>;
  updateProductStock(productCode: string, currentStock: number): Promise<ProductStock | undefined>;
  increaseProductStock(productCode: string, quantity: number, productName?: string): Promise<ProductStock>;
  decreaseProductStock(productCode: string, quantity: number): Promise<ProductStock | undefined>;
  deleteProductStock(productCode: string): Promise<void>;

  // Stock History methods (재고 이력)
  createStockHistory(data: InsertStockHistory): Promise<StockHistory>;
  getStockHistoryByItemCode(itemCode: string): Promise<StockHistory[]>;
  getAllStockHistory(): Promise<StockHistory[]>;
  getFilteredStockHistory(params: {
    stockType?: string;
    actionType?: string;
    source?: string;
    adminId?: string;
    startDate?: Date;
    endDate?: Date;
    keyword?: string;
  }): Promise<StockHistory[]>;
  getStockHistoryAdmins(): Promise<string[]>;

  // Site Settings methods
  getAllSiteSettings(): Promise<SiteSetting[]>;
  getSiteSettingsByCategory(category: string): Promise<SiteSetting[]>;
  getPublicSiteSettings(): Promise<SiteSetting[]>;
  updateSiteSettings(settings: Record<string, string>): Promise<void>;
  seedSiteSettings(): Promise<void>;

  // Header Menu methods
  getAllHeaderMenus(): Promise<HeaderMenu[]>;
  getVisibleHeaderMenus(): Promise<HeaderMenu[]>;
  getHeaderMenu(id: string): Promise<HeaderMenu | undefined>;
  createHeaderMenu(data: InsertHeaderMenu): Promise<HeaderMenu>;
  updateHeaderMenu(id: string, data: Partial<InsertHeaderMenu>): Promise<HeaderMenu | undefined>;
  deleteHeaderMenu(id: string): Promise<boolean>;
  updateHeaderMenuOrder(menus: { id: string; sortOrder: number }[]): Promise<void>;
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

  async validateMemberPassword(username: string, password: string): Promise<Member | null> {
    const member = await this.getMemberByUsername(username);
    if (!member) return null;
    if (member.password !== hashPassword(password)) return null;
    return member;
  }

  async updateLastLogin(userId: string): Promise<void> {
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId));
  }

  async updateMemberLastLogin(memberId: string): Promise<void> {
    await db.update(members).set({ lastLoginAt: new Date() }).where(eq(members.id, memberId));
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

  async updateProduct(id: string, data: Partial<InsertProduct>): Promise<Product | undefined> {
    const [product] = await db.update(products)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    return product;
  }

  async deleteProduct(id: string): Promise<boolean> {
    const [deleted] = await db.delete(products).where(eq(products.id, id)).returning();
    return !!deleted;
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

  async updatePartnerProducts(partnerId: string, productIds: string[]): Promise<void> {
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

  // Member methods
  async getAllMembers(): Promise<Member[]> {
    return db.select().from(members).orderBy(desc(members.createdAt));
  }

  async getMember(id: string): Promise<Member | undefined> {
    const [member] = await db.select().from(members).where(eq(members.id, id));
    return member;
  }

  async getMemberByUsername(username: string): Promise<Member | undefined> {
    const [member] = await db.select().from(members).where(eq(members.username, username));
    return member;
  }

  async getMembersByGrade(grade: string): Promise<Member[]> {
    return db.select().from(members).where(eq(members.grade, grade)).orderBy(desc(members.createdAt));
  }

  async getMemberStats(): Promise<{ total: number; pending: number; associate: number; start: number; driving: number; top: number }> {
    const allMembers = await db.select().from(members);
    return {
      total: allMembers.length,
      pending: allMembers.filter(m => m.grade === "PENDING").length,
      associate: allMembers.filter(m => m.grade === "ASSOCIATE").length,
      start: allMembers.filter(m => m.grade === "START").length,
      driving: allMembers.filter(m => m.grade === "DRIVING").length,
      top: allMembers.filter(m => m.grade === "TOP").length,
    };
  }

  async createMember(data: {
    username: string;
    password: string;
    companyName: string;
    businessNumber: string;
    representative: string;
    phone: string;
    businessAddress?: string;
    managerName?: string;
    managerPhone?: string;
    email?: string;
    grade?: string;
    status?: string;
    memo?: string;
  }): Promise<Member> {
    const [member] = await db.insert(members).values({
      username: data.username,
      password: hashPassword(data.password),
      companyName: data.companyName,
      businessNumber: data.businessNumber,
      representative: data.representative,
      phone: data.phone,
      businessAddress: data.businessAddress || null,
      managerName: data.managerName || null,
      managerPhone: data.managerPhone || null,
      email: data.email || null,
      grade: data.grade || "PENDING",
      status: data.status || "활성",
      memo: data.memo || null,
    }).returning();
    return member;
  }

  async updateMember(id: string, data: Partial<{
    password: string;
    grade: string;
    businessAddress: string;
    representative: string;
    phone: string;
    managerName: string;
    managerPhone: string;
    email: string;
    deposit: number;
    point: number;
    status: string;
    memo: string;
    approvedAt: Date;
    approvedBy: string;
  }>): Promise<Member | undefined> {
    const updateData: any = { ...data, updatedAt: new Date() };
    if (data.password) {
      updateData.password = hashPassword(data.password);
    }
    const [member] = await db.update(members).set(updateData).where(eq(members.id, id)).returning();
    return member;
  }

  async bulkUpdateMembers(memberIds: string[], data: {
    grade?: string;
    depositAdjust?: number;
    pointAdjust?: number;
    memoAdd?: string;
  }): Promise<Member[]> {
    const updatedMembers: Member[] = [];
    for (const memberId of memberIds) {
      const member = await this.getMember(memberId);
      if (!member) continue;
      
      const updateData: any = { updatedAt: new Date() };
      if (data.grade) updateData.grade = data.grade;
      if (data.depositAdjust) updateData.deposit = member.deposit + data.depositAdjust;
      if (data.pointAdjust) updateData.point = member.point + data.pointAdjust;
      if (data.memoAdd) updateData.memo = member.memo ? `${member.memo}\n${data.memoAdd}` : data.memoAdd;
      
      const [updated] = await db.update(members).set(updateData).where(eq(members.id, memberId)).returning();
      if (updated) updatedMembers.push(updated);
    }
    return updatedMembers;
  }

  async deleteMember(id: string): Promise<boolean> {
    await db.delete(memberLogs).where(eq(memberLogs.memberId, id));
    const result = await db.delete(members).where(eq(members.id, id)).returning();
    return result.length > 0;
  }

  async resetMemberPassword(id: string, newPassword: string): Promise<Member | undefined> {
    const [member] = await db.update(members).set({ 
      password: hashPassword(newPassword),
      updatedAt: new Date()
    }).where(eq(members.id, id)).returning();
    return member;
  }

  async approveMember(memberId: string, approvedById: string): Promise<Member | undefined> {
    const [member] = await db.update(members).set({
      grade: "ASSOCIATE",
      approvedAt: new Date(),
      approvedBy: approvedById,
      updatedAt: new Date(),
    }).where(eq(members.id, memberId)).returning();
    return member;
  }

  // Member Log methods
  async getMemberLogs(memberId: string): Promise<(MemberLog & { changedByUser?: { name: string } })[]> {
    const logs = await db.select().from(memberLogs).where(eq(memberLogs.memberId, memberId)).orderBy(desc(memberLogs.createdAt));
    const allUsers = await db.select().from(users);
    
    return logs.map(log => ({
      ...log,
      changedByUser: allUsers.find(u => u.id === log.changedBy),
    }));
  }

  async createMemberLog(data: InsertMemberLog): Promise<MemberLog> {
    const [log] = await db.insert(memberLogs).values(data).returning();
    return log;
  }

  // Category methods
  async getAllCategories(): Promise<Category[]> {
    return db.select().from(categories).orderBy(categories.level, categories.name);
  }

  async getCategoriesByLevel(level: string): Promise<Category[]> {
    return db.select().from(categories).where(eq(categories.level, level)).orderBy(categories.name);
  }

  async getCategoriesByParent(parentId: string): Promise<Category[]> {
    return db.select().from(categories).where(eq(categories.parentId, parentId)).orderBy(categories.name);
  }

  async getCategory(id: string): Promise<Category | undefined> {
    const [cat] = await db.select().from(categories).where(eq(categories.id, id));
    return cat;
  }

  async createCategory(data: InsertCategory): Promise<Category> {
    const [cat] = await db.insert(categories).values(data).returning();
    return cat;
  }

  async updateCategory(id: string, data: Partial<InsertCategory>): Promise<Category | undefined> {
    const [cat] = await db.update(categories).set({ ...data, updatedAt: new Date() }).where(eq(categories.id, id)).returning();
    return cat;
  }

  async deleteCategory(id: string): Promise<boolean> {
    const result = await db.delete(categories).where(eq(categories.id, id)).returning();
    return result.length > 0;
  }

  async hasChildCategories(id: string): Promise<boolean> {
    const children = await db.select().from(categories).where(eq(categories.parentId, id));
    return children.length > 0;
  }

  async getProductCountByCategory(categoryName: string, level: string): Promise<number> {
    let whereClause;
    if (level === 'large') {
      whereClause = eq(productRegistrations.categoryLarge, categoryName);
    } else if (level === 'medium') {
      whereClause = eq(productRegistrations.categoryMedium, categoryName);
    } else {
      whereClause = eq(productRegistrations.categorySmall, categoryName);
    }
    const prods = await db.select().from(productRegistrations).where(whereClause);
    return prods.length;
  }

  // Product Registration methods
  async getAllProductRegistrations(status?: string): Promise<ProductRegistration[]> {
    if (status) {
      return db.select().from(productRegistrations).where(eq(productRegistrations.status, status)).orderBy(desc(productRegistrations.createdAt));
    }
    return db.select().from(productRegistrations).orderBy(desc(productRegistrations.createdAt));
  }

  async getProductRegistration(id: string): Promise<ProductRegistration | undefined> {
    const [pr] = await db.select().from(productRegistrations).where(eq(productRegistrations.id, id));
    return pr;
  }

  async getProductRegistrationByCode(code: string): Promise<ProductRegistration | undefined> {
    const [pr] = await db.select().from(productRegistrations).where(eq(productRegistrations.productCode, code));
    return pr;
  }

  async createProductRegistration(data: any): Promise<ProductRegistration> {
    const calculated = this.calculateProductFields(data);
    const [pr] = await db.insert(productRegistrations).values({ ...data, ...calculated }).returning();
    return pr;
  }

  async updateProductRegistration(id: string, data: any): Promise<ProductRegistration | undefined> {
    // Merge with existing data to preserve fields not being updated
    const existing = await this.getProductRegistration(id);
    if (!existing) return undefined;
    
    const merged = { ...existing, ...data };
    const calculated = this.calculateProductFields(merged);
    const [pr] = await db.update(productRegistrations).set({ ...data, ...calculated, updatedAt: new Date() }).where(eq(productRegistrations.id, id)).returning();
    return pr;
  }

  async bulkUpdateProductRegistrations(ids: string[], data: any): Promise<ProductRegistration[]> {
    const updated: ProductRegistration[] = [];
    for (const id of ids) {
      const existing = await this.getProductRegistration(id);
      if (existing) {
        const merged = { ...existing, ...data };
        const calculated = this.calculateProductFields(merged);
        const [pr] = await db.update(productRegistrations).set({ ...data, ...calculated, updatedAt: new Date() }).where(eq(productRegistrations.id, id)).returning();
        if (pr) updated.push(pr);
      }
    }
    return updated;
  }

  async deleteProductRegistration(id: string): Promise<boolean> {
    const result = await db.delete(productRegistrations).where(eq(productRegistrations.id, id)).returning();
    return result.length > 0;
  }

  async bulkDeleteProductRegistrations(ids: string[]): Promise<number> {
    let deleted = 0;
    for (const id of ids) {
      const result = await db.delete(productRegistrations).where(eq(productRegistrations.id, id)).returning();
      if (result.length > 0) deleted++;
    }
    return deleted;
  }

  async suspendProductRegistrations(ids: string[], reason: string): Promise<number> {
    let updated = 0;
    for (const id of ids) {
      const result = await db.update(productRegistrations).set({
        status: 'suspended',
        suspendedAt: new Date(),
        suspendReason: reason,
        updatedAt: new Date(),
      }).where(eq(productRegistrations.id, id)).returning();
      if (result.length > 0) updated++;
    }
    return updated;
  }

  async resumeProductRegistrations(ids: string[]): Promise<number> {
    let updated = 0;
    for (const id of ids) {
      const result = await db.update(productRegistrations).set({
        status: 'active',
        suspendedAt: null,
        suspendReason: null,
        updatedAt: new Date(),
      }).where(eq(productRegistrations.id, id)).returning();
      if (result.length > 0) updated++;
    }
    return updated;
  }

  private calculateProductFields(data: any): Partial<ProductRegistration> {
    const sourcePrice = data.sourcePrice || 0;
    const lossRate = data.lossRate || 0;
    const sourceWeight = data.sourceWeight || 1;
    const weight = parseFloat(data.weight) || 0;
    
    const unitPrice = sourceWeight > 0 ? Math.round((sourcePrice * (1 + lossRate / 100)) / sourceWeight) : 0;
    const sourceProductTotal = Math.round(weight * unitPrice);
    
    const boxCost = data.boxCost || 0;
    const materialCost = data.materialCost || 0;
    const outerBoxCost = data.outerBoxCost || 0;
    const wrappingCost = data.wrappingCost || 0;
    const laborCost = data.laborCost || 0;
    const shippingCost = data.shippingCost || 0;
    
    const totalCost = sourceProductTotal + boxCost + materialCost + outerBoxCost + wrappingCost + laborCost + shippingCost;
    
    const startMarginRate = data.startMarginRate;
    const startPrice = startMarginRate != null ? Math.round(totalCost * (1 + startMarginRate / 100)) : null;
    const startMargin = startPrice != null ? startPrice - totalCost : null;
    
    const drivingMarginRate = data.drivingMarginRate;
    const drivingPrice = drivingMarginRate != null ? Math.round(totalCost * (1 + drivingMarginRate / 100)) : null;
    const drivingMargin = drivingPrice != null ? drivingPrice - totalCost : null;
    
    const topMarginRate = data.topMarginRate;
    const topPrice = topMarginRate != null ? Math.round(totalCost * (1 + topMarginRate / 100)) : null;
    const topMargin = topPrice != null ? topPrice - totalCost : null;
    
    return {
      unitPrice,
      sourceProductTotal,
      totalCost,
      startPrice,
      startMargin,
      drivingPrice,
      drivingMargin,
      topPrice,
      topMargin,
    };
  }

  // Next Week Products methods
  async getAllNextWeekProducts(): Promise<NextWeekProduct[]> {
    return db.select().from(nextWeekProducts).orderBy(desc(nextWeekProducts.updatedAt));
  }

  async getNextWeekProduct(id: string): Promise<NextWeekProduct | undefined> {
    const [product] = await db.select().from(nextWeekProducts).where(eq(nextWeekProducts.id, id));
    return product;
  }

  async getNextWeekProductByCode(code: string): Promise<NextWeekProduct | undefined> {
    const [product] = await db.select().from(nextWeekProducts).where(eq(nextWeekProducts.productCode, code));
    return product;
  }

  async createNextWeekProduct(data: InsertNextWeekProduct): Promise<NextWeekProduct> {
    const [product] = await db.insert(nextWeekProducts).values(data).returning();
    return product;
  }

  async updateNextWeekProduct(id: string, data: Partial<InsertNextWeekProduct>): Promise<NextWeekProduct | undefined> {
    const [product] = await db.update(nextWeekProducts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(nextWeekProducts.id, id))
      .returning();
    return product;
  }

  async upsertNextWeekProduct(data: InsertNextWeekProduct): Promise<NextWeekProduct> {
    const existing = await this.getNextWeekProductByCode(data.productCode);
    if (existing) {
      const updated = await this.updateNextWeekProduct(existing.id, data);
      return updated!;
    }
    return this.createNextWeekProduct(data);
  }

  async bulkDeleteNextWeekProducts(ids: string[]): Promise<number> {
    const result = await db.delete(nextWeekProducts).where(inArray(nextWeekProducts.id, ids)).returning();
    return result.length;
  }

  // Current Products methods (현재 공급가)
  async getAllCurrentProducts(): Promise<CurrentProduct[]> {
    return db.select().from(currentProducts).orderBy(desc(currentProducts.updatedAt));
  }

  async getCurrentProductsByStatus(status: string): Promise<CurrentProduct[]> {
    return db.select().from(currentProducts)
      .where(eq(currentProducts.supplyStatus, status))
      .orderBy(desc(currentProducts.updatedAt));
  }

  async getCurrentProduct(id: string): Promise<CurrentProduct | undefined> {
    const [product] = await db.select().from(currentProducts).where(eq(currentProducts.id, id));
    return product;
  }

  async getCurrentProductByCode(code: string): Promise<CurrentProduct | undefined> {
    const [product] = await db.select().from(currentProducts).where(eq(currentProducts.productCode, code));
    return product;
  }

  async createCurrentProduct(data: InsertCurrentProduct): Promise<CurrentProduct> {
    const [product] = await db.insert(currentProducts).values(data).returning();
    return product;
  }

  async updateCurrentProduct(id: string, data: Partial<InsertCurrentProduct>): Promise<CurrentProduct | undefined> {
    const [product] = await db.update(currentProducts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(currentProducts.id, id))
      .returning();
    return product;
  }

  async upsertCurrentProduct(data: InsertCurrentProduct): Promise<CurrentProduct> {
    const existing = await this.getCurrentProductByCode(data.productCode);
    if (existing) {
      const updated = await this.updateCurrentProduct(existing.id, data);
      return updated!;
    }
    return this.createCurrentProduct(data);
  }

  async suspendCurrentProducts(ids: string[], reason: string): Promise<number> {
    const result = await db.update(currentProducts)
      .set({ supplyStatus: "suspended", suspendedAt: new Date(), suspendReason: reason, updatedAt: new Date() })
      .where(inArray(currentProducts.id, ids))
      .returning();
    return result.length;
  }

  async resumeCurrentProducts(ids: string[]): Promise<number> {
    const result = await db.update(currentProducts)
      .set({ supplyStatus: "supply", suspendedAt: null, suspendReason: null, updatedAt: new Date() })
      .where(inArray(currentProducts.id, ids))
      .returning();
    return result.length;
  }

  async deleteCurrentProduct(id: string): Promise<boolean> {
    const [deleted] = await db.delete(currentProducts).where(eq(currentProducts.id, id)).returning();
    return !!deleted;
  }

  async bulkDeleteCurrentProducts(ids: string[]): Promise<number> {
    const result = await db.delete(currentProducts).where(inArray(currentProducts.id, ids)).returning();
    return result.length;
  }

  // Material Category Large methods (재료 대분류)
  async getAllMaterialCategoriesLarge(): Promise<MaterialCategoryLarge[]> {
    return db.select().from(materialCategoriesLarge).orderBy(materialCategoriesLarge.sortOrder);
  }

  async getMaterialCategoryLarge(id: string): Promise<MaterialCategoryLarge | undefined> {
    const [category] = await db.select().from(materialCategoriesLarge).where(eq(materialCategoriesLarge.id, id));
    return category;
  }

  async getMaterialCategoryLargeByName(name: string): Promise<MaterialCategoryLarge | undefined> {
    const [category] = await db.select().from(materialCategoriesLarge).where(eq(materialCategoriesLarge.name, name));
    return category;
  }

  async createMaterialCategoryLarge(data: InsertMaterialCategoryLarge): Promise<MaterialCategoryLarge> {
    const [category] = await db.insert(materialCategoriesLarge).values(data).returning();
    return category;
  }

  async updateMaterialCategoryLarge(id: string, data: Partial<InsertMaterialCategoryLarge>): Promise<MaterialCategoryLarge | undefined> {
    const [category] = await db.update(materialCategoriesLarge)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(materialCategoriesLarge.id, id))
      .returning();
    return category;
  }

  async deleteMaterialCategoryLarge(id: string): Promise<boolean> {
    const [deleted] = await db.delete(materialCategoriesLarge).where(eq(materialCategoriesLarge.id, id)).returning();
    return !!deleted;
  }

  // Material Category Medium methods (재료 중분류)
  async getAllMaterialCategoriesMedium(): Promise<MaterialCategoryMedium[]> {
    return db.select().from(materialCategoriesMedium).orderBy(materialCategoriesMedium.sortOrder);
  }

  async getMaterialCategoriesMediumByLarge(largeCategoryId: string): Promise<MaterialCategoryMedium[]> {
    return db.select().from(materialCategoriesMedium)
      .where(eq(materialCategoriesMedium.largeCategoryId, largeCategoryId))
      .orderBy(materialCategoriesMedium.sortOrder);
  }

  async getMaterialCategoryMedium(id: string): Promise<MaterialCategoryMedium | undefined> {
    const [category] = await db.select().from(materialCategoriesMedium).where(eq(materialCategoriesMedium.id, id));
    return category;
  }

  async getMaterialCategoryMediumByName(largeCategoryId: string, name: string): Promise<MaterialCategoryMedium | undefined> {
    const [category] = await db.select().from(materialCategoriesMedium)
      .where(and(
        eq(materialCategoriesMedium.largeCategoryId, largeCategoryId),
        eq(materialCategoriesMedium.name, name)
      ));
    return category;
  }

  async createMaterialCategoryMedium(data: InsertMaterialCategoryMedium): Promise<MaterialCategoryMedium> {
    const [category] = await db.insert(materialCategoriesMedium).values(data).returning();
    return category;
  }

  async updateMaterialCategoryMedium(id: string, data: Partial<InsertMaterialCategoryMedium>): Promise<MaterialCategoryMedium | undefined> {
    const [category] = await db.update(materialCategoriesMedium)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(materialCategoriesMedium.id, id))
      .returning();
    return category;
  }

  async deleteMaterialCategoryMedium(id: string): Promise<boolean> {
    const [deleted] = await db.delete(materialCategoriesMedium).where(eq(materialCategoriesMedium.id, id)).returning();
    return !!deleted;
  }

  // Material Category Small methods (재료 소분류)
  async getAllMaterialCategoriesSmall(): Promise<MaterialCategorySmall[]> {
    return db.select().from(materialCategoriesSmall).orderBy(materialCategoriesSmall.sortOrder);
  }

  async getMaterialCategoriesSmallByMedium(mediumCategoryId: string): Promise<MaterialCategorySmall[]> {
    return db.select().from(materialCategoriesSmall)
      .where(eq(materialCategoriesSmall.mediumCategoryId, mediumCategoryId))
      .orderBy(materialCategoriesSmall.sortOrder);
  }

  async getMaterialCategorySmall(id: string): Promise<MaterialCategorySmall | undefined> {
    const [category] = await db.select().from(materialCategoriesSmall).where(eq(materialCategoriesSmall.id, id));
    return category;
  }

  async getMaterialCategorySmallByName(mediumCategoryId: string, name: string): Promise<MaterialCategorySmall | undefined> {
    const [category] = await db.select().from(materialCategoriesSmall)
      .where(and(
        eq(materialCategoriesSmall.mediumCategoryId, mediumCategoryId),
        eq(materialCategoriesSmall.name, name)
      ));
    return category;
  }

  async createMaterialCategorySmall(data: InsertMaterialCategorySmall): Promise<MaterialCategorySmall> {
    const [category] = await db.insert(materialCategoriesSmall).values(data).returning();
    return category;
  }

  async updateMaterialCategorySmall(id: string, data: Partial<InsertMaterialCategorySmall>): Promise<MaterialCategorySmall | undefined> {
    const [category] = await db.update(materialCategoriesSmall)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(materialCategoriesSmall.id, id))
      .returning();
    return category;
  }

  async deleteMaterialCategorySmall(id: string): Promise<boolean> {
    const [deleted] = await db.delete(materialCategoriesSmall).where(eq(materialCategoriesSmall.id, id)).returning();
    return !!deleted;
  }

  // Material methods (재료)
  async getAllMaterials(): Promise<Material[]> {
    return db.select().from(materials).orderBy(desc(materials.createdAt));
  }

  async getMaterialsByCategory(largeCategoryId?: string, mediumCategoryId?: string): Promise<Material[]> {
    if (mediumCategoryId) {
      return db.select().from(materials)
        .where(eq(materials.mediumCategoryId, mediumCategoryId))
        .orderBy(desc(materials.createdAt));
    }
    if (largeCategoryId) {
      return db.select().from(materials)
        .where(eq(materials.largeCategoryId, largeCategoryId))
        .orderBy(desc(materials.createdAt));
    }
    return this.getAllMaterials();
  }

  async getMaterialsBySmallCategory(smallCategoryId: string): Promise<Material[]> {
    return db.select().from(materials)
      .where(eq(materials.smallCategoryId, smallCategoryId))
      .orderBy(desc(materials.createdAt));
  }

  async getMaterial(id: string): Promise<Material | undefined> {
    const [material] = await db.select().from(materials).where(eq(materials.id, id));
    return material;
  }

  async getMaterialByCode(code: string): Promise<Material | undefined> {
    const [material] = await db.select().from(materials).where(eq(materials.materialCode, code));
    return material;
  }

  async createMaterial(data: InsertMaterial): Promise<Material> {
    const [material] = await db.insert(materials).values(data).returning();
    return material;
  }

  async updateMaterial(id: string, data: Partial<InsertMaterial>): Promise<Material | undefined> {
    const [material] = await db.update(materials)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(materials.id, id))
      .returning();
    return material;
  }

  async deleteMaterial(id: string): Promise<boolean> {
    const [deleted] = await db.delete(materials).where(eq(materials.id, id)).returning();
    return !!deleted;
  }

  async bulkDeleteMaterials(ids: string[]): Promise<number> {
    const result = await db.delete(materials).where(inArray(materials.id, ids)).returning();
    return result.length;
  }

  async getNextMaterialCode(type: string): Promise<string> {
    const prefix = type === "raw" ? "R" : type === "semi" ? "S" : "B";
    const allMaterials = await db.select().from(materials).where(eq(materials.materialType, type));
    const maxNum = allMaterials.reduce((max, m) => {
      const match = m.materialCode.match(new RegExp(`^${prefix}(\\d+)$`));
      if (match) {
        const num = parseInt(match[1], 10);
        return num > max ? num : max;
      }
      return max;
    }, 0);
    return `${prefix}${String(maxNum + 1).padStart(3, "0")}`;
  }

  async getMaterialByName(name: string): Promise<Material | undefined> {
    const [material] = await db.select().from(materials).where(eq(materials.materialName, name));
    return material;
  }

  // Product Mapping methods
  async getAllProductMappings(): Promise<ProductMapping[]> {
    return db.select().from(productMappings).orderBy(desc(productMappings.createdAt));
  }

  async getProductMapping(id: string): Promise<ProductMapping | undefined> {
    const [mapping] = await db.select().from(productMappings).where(eq(productMappings.id, id));
    return mapping;
  }

  async getProductMappingByCode(productCode: string): Promise<ProductMapping | undefined> {
    const [mapping] = await db.select().from(productMappings).where(eq(productMappings.productCode, productCode));
    return mapping;
  }

  async createProductMapping(data: InsertProductMapping): Promise<ProductMapping> {
    const [mapping] = await db.insert(productMappings).values(data).returning();
    return mapping;
  }

  async updateProductMapping(id: string, data: Partial<InsertProductMapping>): Promise<ProductMapping | undefined> {
    const [mapping] = await db.update(productMappings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(productMappings.id, id))
      .returning();
    return mapping;
  }

  async updateProductMappingByCode(productCode: string, data: Partial<InsertProductMapping>): Promise<ProductMapping | undefined> {
    const [mapping] = await db.update(productMappings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(productMappings.productCode, productCode))
      .returning();
    return mapping;
  }

  async deleteProductMapping(productCode: string): Promise<boolean> {
    await db.delete(productMaterialMappings).where(eq(productMaterialMappings.productCode, productCode));
    const [deleted] = await db.delete(productMappings).where(eq(productMappings.productCode, productCode)).returning();
    return !!deleted;
  }

  async bulkCreateProductMappings(data: InsertProductMapping[]): Promise<ProductMapping[]> {
    if (data.length === 0) return [];
    const mappings = await db.insert(productMappings).values(data).returning();
    return mappings;
  }

  // Product Material Mapping methods
  async getProductMaterialMappings(productCode: string): Promise<ProductMaterialMapping[]> {
    return db.select().from(productMaterialMappings)
      .where(eq(productMaterialMappings.productCode, productCode))
      .orderBy(productMaterialMappings.createdAt);
  }

  async createProductMaterialMapping(data: InsertProductMaterialMapping): Promise<ProductMaterialMapping> {
    const [mapping] = await db.insert(productMaterialMappings).values(data).returning();
    return mapping;
  }

  async deleteProductMaterialMappingsByProduct(productCode: string): Promise<number> {
    const result = await db.delete(productMaterialMappings)
      .where(eq(productMaterialMappings.productCode, productCode))
      .returning();
    return result.length;
  }

  async replaceProductMaterialMappings(productCode: string, mappings: Omit<InsertProductMaterialMapping, "productCode">[]): Promise<ProductMaterialMapping[]> {
    await db.delete(productMaterialMappings).where(eq(productMaterialMappings.productCode, productCode));
    
    if (mappings.length === 0) {
      await db.update(productMappings)
        .set({ mappingStatus: "incomplete", updatedAt: new Date() })
        .where(eq(productMappings.productCode, productCode));
      return [];
    }
    
    const dataToInsert = mappings.map(m => ({ ...m, productCode }));
    const result = await db.insert(productMaterialMappings).values(dataToInsert).returning();
    
    await db.update(productMappings)
      .set({ mappingStatus: "complete", updatedAt: new Date() })
      .where(eq(productMappings.productCode, productCode));
    
    return result;
  }

  // Product Stock methods
  async getAllProductStocks(): Promise<ProductStock[]> {
    return db.select().from(productStocks).orderBy(desc(productStocks.updatedAt));
  }

  async getProductStocksWithStock(): Promise<ProductStock[]> {
    const { gt } = await import("drizzle-orm");
    return db.select().from(productStocks)
      .where(gt(productStocks.currentStock, 0))
      .orderBy(desc(productStocks.updatedAt));
  }

  async getProductStock(productCode: string): Promise<ProductStock | undefined> {
    const [stock] = await db.select().from(productStocks)
      .where(eq(productStocks.productCode, productCode));
    return stock;
  }

  async createProductStock(data: InsertProductStock): Promise<ProductStock> {
    const [stock] = await db.insert(productStocks).values(data).returning();
    return stock;
  }

  async updateProductStock(productCode: string, currentStock: number): Promise<ProductStock | undefined> {
    const [updated] = await db.update(productStocks)
      .set({ currentStock, updatedAt: new Date() })
      .where(eq(productStocks.productCode, productCode))
      .returning();
    return updated;
  }

  async increaseProductStock(productCode: string, quantity: number, productName?: string): Promise<ProductStock> {
    const existing = await this.getProductStock(productCode);
    if (existing) {
      const newStock = existing.currentStock + quantity;
      const updated = await this.updateProductStock(productCode, newStock);
      return updated!;
    } else {
      return this.createProductStock({
        productCode,
        productName: productName || productCode,
        currentStock: quantity,
      });
    }
  }

  async decreaseProductStock(productCode: string, quantity: number): Promise<ProductStock | undefined> {
    const existing = await this.getProductStock(productCode);
    if (!existing) return undefined;
    const newStock = Math.max(0, existing.currentStock - quantity);
    return this.updateProductStock(productCode, newStock);
  }

  async deleteProductStock(productCode: string): Promise<void> {
    await db.delete(productStocks).where(eq(productStocks.productCode, productCode));
  }

  // Stock History methods
  async createStockHistory(data: InsertStockHistory): Promise<StockHistory> {
    const [history] = await db.insert(stockHistory).values(data).returning();
    return history;
  }

  async getStockHistoryByItemCode(itemCode: string): Promise<StockHistory[]> {
    return db.select().from(stockHistory)
      .where(eq(stockHistory.itemCode, itemCode))
      .orderBy(desc(stockHistory.createdAt));
  }

  async getAllStockHistory(): Promise<StockHistory[]> {
    return db.select().from(stockHistory)
      .orderBy(desc(stockHistory.createdAt));
  }

  async getFilteredStockHistory(params: {
    stockType?: string;
    actionType?: string;
    source?: string;
    adminId?: string;
    startDate?: Date;
    endDate?: Date;
    keyword?: string;
  }): Promise<StockHistory[]> {
    const conditions = [];
    
    if (params.stockType && params.stockType !== "all") {
      conditions.push(eq(stockHistory.stockType, params.stockType));
    }
    if (params.actionType && params.actionType !== "all") {
      conditions.push(eq(stockHistory.actionType, params.actionType));
    }
    if (params.source && params.source !== "all") {
      conditions.push(eq(stockHistory.source, params.source));
    }
    if (params.adminId && params.adminId !== "all") {
      conditions.push(eq(stockHistory.adminId, params.adminId));
    }
    if (params.startDate) {
      conditions.push(gte(stockHistory.createdAt, params.startDate));
    }
    if (params.endDate) {
      const endOfDay = new Date(params.endDate);
      endOfDay.setHours(23, 59, 59, 999);
      conditions.push(lte(stockHistory.createdAt, endOfDay));
    }
    if (params.keyword) {
      const keyword = `%${params.keyword}%`;
      conditions.push(
        or(
          like(stockHistory.itemCode, keyword),
          like(stockHistory.itemName, keyword),
          like(stockHistory.orderId, keyword)
        )
      );
    }
    
    if (conditions.length === 0) {
      return db.select().from(stockHistory)
        .orderBy(desc(stockHistory.createdAt));
    }
    
    return db.select().from(stockHistory)
      .where(and(...conditions))
      .orderBy(desc(stockHistory.createdAt));
  }

  async getStockHistoryAdmins(): Promise<string[]> {
    const results = await db.selectDistinct({ adminId: stockHistory.adminId })
      .from(stockHistory)
      .orderBy(stockHistory.adminId);
    return results.map(r => r.adminId);
  }

  // ==================== Site Settings ====================
  async getAllSiteSettings(): Promise<SiteSetting[]> {
    return db.select().from(siteSettings).orderBy(siteSettings.category);
  }

  async getSiteSettingsByCategory(category: string): Promise<SiteSetting[]> {
    return db.select().from(siteSettings).where(eq(siteSettings.category, category));
  }

  async getPublicSiteSettings(): Promise<SiteSetting[]> {
    return db.select().from(siteSettings).where(
      or(
        eq(siteSettings.category, "header"),
        eq(siteSettings.category, "footer"),
        eq(siteSettings.category, "general")
      )
    );
  }

  async updateSiteSettings(settings: Record<string, string>): Promise<void> {
    for (const [key, value] of Object.entries(settings)) {
      await db.update(siteSettings)
        .set({ 
          settingValue: String(value),
          updatedAt: new Date()
        })
        .where(eq(siteSettings.settingKey, key));
    }
  }

  async seedSiteSettings(): Promise<void> {
    const existingSettings = await db.select().from(siteSettings);
    if (existingSettings.length > 0) {
      return; // Already seeded
    }

    const initialSettings: InsertSiteSetting[] = [
      // 헤더 설정
      { settingKey: "header_logo_url", settingValue: "/logo.png", settingType: "string", category: "header", description: "헤더 로고 이미지 URL" },
      { settingKey: "header_logo_alt", settingValue: "탑셀러", settingType: "string", category: "header", description: "로고 대체 텍스트" },
      { settingKey: "header_show_login", settingValue: "true", settingType: "boolean", category: "header", description: "로그인 버튼 표시 여부" },
      { settingKey: "header_show_register", settingValue: "true", settingType: "boolean", category: "header", description: "회원가입 버튼 표시 여부" },
      { settingKey: "header_show_cart", settingValue: "true", settingType: "boolean", category: "header", description: "장바구니 버튼 표시 여부" },
      
      // 푸터 설정
      { settingKey: "footer_company_name", settingValue: "현 농업회사법인 주식회사", settingType: "string", category: "footer", description: "회사명" },
      { settingKey: "footer_ceo_name", settingValue: "", settingType: "string", category: "footer", description: "대표자명" },
      { settingKey: "footer_biz_number", settingValue: "", settingType: "string", category: "footer", description: "사업자등록번호" },
      { settingKey: "footer_address", settingValue: "", settingType: "string", category: "footer", description: "회사 주소" },
      { settingKey: "footer_phone", settingValue: "", settingType: "string", category: "footer", description: "대표 전화번호" },
      { settingKey: "footer_email", settingValue: "", settingType: "string", category: "footer", description: "대표 이메일" },
      { settingKey: "footer_copyright", settingValue: "Copyright © 2025 TopSeller. All rights reserved.", settingType: "string", category: "footer", description: "저작권 문구" },
      { settingKey: "footer_show_terms", settingValue: "true", settingType: "boolean", category: "footer", description: "이용약관 링크 표시" },
      { settingKey: "footer_show_privacy", settingValue: "true", settingType: "boolean", category: "footer", description: "개인정보처리방침 링크 표시" },
      
      // 일반 설정
      { settingKey: "site_name", settingValue: "탑셀러", settingType: "string", category: "general", description: "사이트 이름" },
      { settingKey: "site_description", settingValue: "B2B 과일 도매 플랫폼", settingType: "string", category: "general", description: "사이트 설명" },
    ];

    for (const setting of initialSettings) {
      await db.insert(siteSettings).values(setting);
    }
  }

  // ==================== Header Menus ====================
  async getAllHeaderMenus(): Promise<HeaderMenu[]> {
    return db.select().from(headerMenus).orderBy(headerMenus.sortOrder);
  }

  async getVisibleHeaderMenus(): Promise<HeaderMenu[]> {
    return db.select().from(headerMenus)
      .where(eq(headerMenus.isVisible, "true"))
      .orderBy(headerMenus.sortOrder);
  }

  async getHeaderMenu(id: string): Promise<HeaderMenu | undefined> {
    const [menu] = await db.select().from(headerMenus).where(eq(headerMenus.id, id));
    return menu;
  }

  async createHeaderMenu(data: InsertHeaderMenu): Promise<HeaderMenu> {
    const [menu] = await db.insert(headerMenus).values(data).returning();
    return menu;
  }

  async updateHeaderMenu(id: string, data: Partial<InsertHeaderMenu>): Promise<HeaderMenu | undefined> {
    const [menu] = await db.update(headerMenus)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(headerMenus.id, id))
      .returning();
    return menu;
  }

  async deleteHeaderMenu(id: string): Promise<boolean> {
    const result = await db.delete(headerMenus).where(eq(headerMenus.id, id)).returning();
    return result.length > 0;
  }

  async updateHeaderMenuOrder(menus: { id: string; sortOrder: number }[]): Promise<void> {
    for (const menu of menus) {
      await db.update(headerMenus)
        .set({ sortOrder: menu.sortOrder, updatedAt: new Date() })
        .where(eq(headerMenus.id, menu.id));
    }
  }

  // ==================== Pages ====================
  async getAllPages(): Promise<Page[]> {
    return db.select().from(pages).orderBy(pages.category, pages.sortOrder);
  }

  async getPagesByCategory(category: string): Promise<Page[]> {
    return db.select().from(pages)
      .where(eq(pages.category, category))
      .orderBy(pages.sortOrder);
  }

  async getPage(id: string): Promise<Page | undefined> {
    const [page] = await db.select().from(pages).where(eq(pages.id, id));
    return page;
  }

  async createPage(data: InsertPage): Promise<Page> {
    const [page] = await db.insert(pages).values(data).returning();
    return page;
  }

  async updatePage(id: string, data: Partial<InsertPage>): Promise<Page | undefined> {
    const [page] = await db.update(pages)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(pages.id, id))
      .returning();
    return page;
  }

  async deletePage(id: string): Promise<boolean> {
    // Check if system page (can't delete)
    const existingPage = await this.getPage(id);
    if (existingPage?.isSystem === "true") {
      return false;
    }
    const result = await db.delete(pages).where(eq(pages.id, id)).returning();
    return result.length > 0;
  }

  async seedDefaultPages(): Promise<void> {
    // Check if pages already exist
    const existingPages = await db.select().from(pages);
    if (existingPages.length > 0) {
      return;
    }

    const defaultPages = [
      // 1. 기본페이지
      { name: "로그인", path: "/login", description: "회원 로그인 페이지", category: "기본페이지", accessLevel: "all", status: "active", sortOrder: 1, icon: "LogIn", isSystem: "true" },
      { name: "로그아웃", path: "/logout", description: "로그아웃 처리", category: "기본페이지", accessLevel: "all", status: "active", sortOrder: 2, icon: "LogOut", isSystem: "true" },
      { name: "회원가입", path: "/register", description: "신규 회원 가입 페이지", category: "기본페이지", accessLevel: "all", status: "active", sortOrder: 3, icon: "UserPlus", isSystem: "true" },
      { name: "이용약관", path: "/terms", description: "서비스 이용약관", category: "기본페이지", accessLevel: "all", status: "draft", sortOrder: 4, icon: "FileText", isSystem: "true" },
      { name: "개인정보처리방침", path: "/privacy", description: "개인정보 처리방침", category: "기본페이지", accessLevel: "all", status: "draft", sortOrder: 5, icon: "Shield", isSystem: "true" },
      { name: "개인정보 제3자 동의", path: "/third-party-consent", description: "개인정보 제3자 제공 동의", category: "기본페이지", accessLevel: "all", status: "draft", sortOrder: 6, icon: "Users", isSystem: "true" },

      // 2. 메인/서브페이지
      { name: "메인 페이지", path: "/", description: "메인 랜딩 페이지", category: "메인/서브페이지", accessLevel: "all", status: "active", sortOrder: 1, icon: "Home", isSystem: "true" },
      { name: "서브페이지", path: "/sub", description: "서브 페이지 (예정)", category: "메인/서브페이지", accessLevel: "all", status: "draft", sortOrder: 2, icon: "Layout", isSystem: "false" },

      // 3. 회원마이페이지
      { name: "마이페이지 대시보드", path: "/dashboard", description: "회원 전용 대시보드", category: "회원마이페이지", accessLevel: "ASSOCIATE", status: "active", sortOrder: 1, icon: "LayoutDashboard", isSystem: "true" },
      { name: "회원정보", path: "/mypage", description: "회원 정보 및 수정", category: "회원마이페이지", accessLevel: "ASSOCIATE", status: "active", sortOrder: 2, icon: "User", isSystem: "true" },

      // 4. 주문관리페이지
      { name: "주문등록", path: "/orders/create", description: "새 주문 등록", category: "주문관리페이지", accessLevel: "ASSOCIATE", status: "draft", sortOrder: 1, icon: "ShoppingCart", isSystem: "false" },
      { name: "취소건 관리", path: "/orders/cancelled", description: "취소된 주문 관리", category: "주문관리페이지", accessLevel: "ASSOCIATE", status: "draft", sortOrder: 2, icon: "XCircle", isSystem: "false" },
      { name: "운송장 다운로드", path: "/orders/shipping", description: "운송장 파일 다운로드", category: "주문관리페이지", accessLevel: "ASSOCIATE", status: "draft", sortOrder: 3, icon: "Download", isSystem: "false" },
      { name: "배송중 리스트", path: "/orders/shipping-list", description: "배송 중인 주문 목록", category: "주문관리페이지", accessLevel: "ASSOCIATE", status: "draft", sortOrder: 4, icon: "Truck", isSystem: "false" },
      { name: "배송완료 리스트", path: "/orders/completed", description: "배송 완료된 주문 목록", category: "주문관리페이지", accessLevel: "ASSOCIATE", status: "draft", sortOrder: 5, icon: "CheckCircle", isSystem: "false" },

      // 5. 통계관리페이지
      { name: "상품별 통계관리", path: "/stats/products", description: "상품별 통계 조회", category: "통계관리페이지", accessLevel: "START", status: "draft", sortOrder: 1, icon: "BarChart", isSystem: "false" },
      { name: "정산 관리", path: "/stats/settlement", description: "정산 내역 관리", category: "통계관리페이지", accessLevel: "START", status: "draft", sortOrder: 2, icon: "DollarSign", isSystem: "false" },

      // 6. 가이드페이지
      { name: "회원가입과 등급", path: "/guide/membership", description: "회원가입, 자격, 등급, 혜택 안내", category: "가이드페이지", accessLevel: "all", status: "draft", sortOrder: 1, icon: "BookOpen", isSystem: "false" },
      { name: "주문/발주 관리", path: "/guide/orders", description: "주문발주 순서, 엑셀 일괄주문, 취소 관리", category: "가이드페이지", accessLevel: "all", status: "draft", sortOrder: 2, icon: "ClipboardList", isSystem: "false" },
      { name: "상품", path: "/guide/products", description: "공급상품, 현재/차주공급가, 리스트 주요사항", category: "가이드페이지", accessLevel: "all", status: "draft", sortOrder: 3, icon: "Package", isSystem: "false" },
      { name: "예치금/포인트 정산", path: "/guide/settlement", description: "예치금/포인트 정산, 충전, 세금계산서", category: "가이드페이지", accessLevel: "all", status: "draft", sortOrder: 4, icon: "Wallet", isSystem: "false" },
      { name: "혜택과 지원", path: "/guide/benefits", description: "콘텐츠 제공, 지원금, 할인, 후불결제", category: "가이드페이지", accessLevel: "all", status: "draft", sortOrder: 5, icon: "Gift", isSystem: "false" },

      // 7. 게시판관리페이지
      { name: "공지게시판", path: "/board/notice", description: "공지사항 게시판", category: "게시판관리페이지", accessLevel: "all", status: "draft", sortOrder: 1, icon: "MessageSquare", isSystem: "false" },
      { name: "일반 게시판", path: "/board/general", description: "일반 공개 게시판", category: "게시판관리페이지", accessLevel: "all", status: "draft", sortOrder: 2, icon: "MessageSquare", isSystem: "false" },
      { name: "회원전용 게시판", path: "/board/members", description: "회원 전용 게시판", category: "게시판관리페이지", accessLevel: "ASSOCIATE", status: "draft", sortOrder: 3, icon: "MessageCircle", isSystem: "false" },

      // 8. 기타페이지
      { name: "공개 레이아웃 미리보기", path: "/public-preview", description: "헤더/푸터 설정 미리보기 (테스트용)", category: "기타페이지", accessLevel: "all", status: "active", sortOrder: 1, icon: "Eye", isSystem: "false" },
    ];

    for (const page of defaultPages) {
      await db.insert(pages).values(page);
    }
  }
}

export const storage = new DatabaseStorage();
