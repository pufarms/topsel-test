import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const userTiers = ["준회원", "start회원", "driving회원", "top회원"] as const;
export type UserTier = typeof userTiers[number];

// 회원 등급 (6단계)
export const memberGrades = ["PENDING", "ASSOCIATE", "START", "DRIVING", "TOP"] as const;
export type MemberGrade = typeof memberGrades[number];

export const memberGradeLabels: Record<MemberGrade, string> = {
  PENDING: "보류중",
  ASSOCIATE: "준회원",
  START: "Start회원",
  DRIVING: "Driving회원",
  TOP: "Top회원",
};

// 회원 상태
export const memberStatuses = ["활성", "비활성"] as const;
export type MemberStatus = typeof memberStatuses[number];

export const adminRoles = ["SUPER_ADMIN", "ADMIN"] as const;
export type AdminRole = typeof adminRoles[number];

export const menuPermissions = [
  "dashboard",
  "admin_management",
  "partner_management",
  "user_management",
  "order_management",
  "product_management",
  "settlement_management",
  "stats_management",
  "coupon_management",
  "page_management",
  "site_settings",
  "gallery_management"
] as const;
export type MenuPermission = typeof menuPermissions[number];

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  role: text("role").notNull().default("ADMIN"),
  permissions: jsonb("permissions").$type<string[]>().default([]),
  tier: text("tier").notNull().default("준회원"),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  productName: text("product_name").notNull(),
  quantity: integer("quantity").notNull(),
  price: integer("price").notNull(),
  recipientName: text("recipient_name").notNull(),
  recipientPhone: text("recipient_phone").notNull(),
  recipientAddress: text("recipient_address").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  role: true,
  permissions: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
});

export const loginSchema = z.object({
  username: z.string().min(4, "아이디는 4자 이상이어야 합니다"),
  password: z.string().min(6, "비밀번호는 6자 이상이어야 합니다"),
});

export const registerSchema = z.object({
  username: z.string().min(4, "아이디는 4자 이상이어야 합니다"),
  password: z.string().min(6, "비밀번호는 6자 이상이어야 합니다"),
  name: z.string().min(2, "이름은 2자 이상이어야 합니다"),
  phone: z.string().optional(),
  email: z.string().email("유효한 이메일을 입력해주세요").optional().or(z.literal("")),
});

export const insertAdminSchema = z.object({
  username: z.string().min(4, "아이디는 4자 이상이어야 합니다"),
  password: z.string().min(6, "비밀번호는 6자 이상이어야 합니다"),
  name: z.string().min(2, "이름은 2자 이상이어야 합니다"),
  phone: z.string().optional(),
  email: z.string().email("유효한 이메일을 입력해주세요").optional().or(z.literal("")),
  role: z.enum(adminRoles),
  permissions: z.array(z.string()).optional(),
});

export const updateAdminSchema = insertAdminSchema.partial().omit({ username: true }).extend({
  password: z.string().min(6, "비밀번호는 6자 이상이어야 합니다").optional().or(z.literal("")),
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  userId: true,
  createdAt: true,
}).extend({
  productName: z.string().min(1, "상품명을 입력해주세요"),
  quantity: z.number().min(1, "수량은 1 이상이어야 합니다"),
  price: z.number().min(0, "가격은 0 이상이어야 합니다"),
  recipientName: z.string().min(1, "수령인을 입력해주세요"),
  recipientPhone: z.string().min(1, "연락처를 입력해주세요"),
  recipientAddress: z.string().min(1, "주소를 입력해주세요"),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;

export const imageCategories = ["배너", "상품", "아이콘", "기타"] as const;
export type ImageCategory = typeof imageCategories[number];

export const imageSubcategories = pgTable("image_subcategories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  category: text("category").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSubcategorySchema = createInsertSchema(imageSubcategories).omit({
  id: true,
  createdAt: true,
});

export type InsertSubcategory = z.infer<typeof insertSubcategorySchema>;
export type ImageSubcategory = typeof imageSubcategories.$inferSelect;

export const images = pgTable("images", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  filename: text("filename").notNull(),
  storagePath: text("storage_path").notNull(),
  publicUrl: text("public_url").notNull(),
  category: text("category").notNull().default("기타"),
  subcategory: text("subcategory"),
  fileSize: integer("file_size").notNull(),
  mimeType: text("mime_type").notNull(),
  width: integer("width"),
  height: integer("height"),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  uploadedBy: varchar("uploaded_by").references(() => users.id),
});

export const insertImageSchema = createInsertSchema(images).omit({
  id: true,
  uploadedAt: true,
});

export type InsertImage = z.infer<typeof insertImageSchema>;
export type Image = typeof images.$inferSelect;

// 택배사 목록
export const shippingCompanies = ["CJ대한통운", "한진택배", "롯데택배", "우체국택배", "로젠택배", "기타"] as const;
export type ShippingCompany = typeof shippingCompanies[number];

// 협력업체 상태
export const partnerStatuses = ["활성", "비활성"] as const;
export type PartnerStatus = typeof partnerStatuses[number];

// 상품 테이블
export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productCode: text("product_code").notNull().unique(),
  productName: text("product_name").notNull(),
  category: text("category"),
  price: integer("price").notNull().default(0),
  status: text("status").notNull().default("활성"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

// 협력업체 테이블
export const partners = pgTable("partners", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  companyName: text("company_name").notNull(),
  businessNumber: text("business_number").notNull(),
  representative: text("representative").notNull(),
  address: text("address").notNull(),
  phone1: text("phone1").notNull(),
  phone2: text("phone2"),
  shippingCompany: text("shipping_company"),
  status: text("status").notNull().default("활성"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPartnerSchema = createInsertSchema(partners).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const partnerFormSchema = z.object({
  username: z.string().min(4, "아이디는 4자 이상이어야 합니다"),
  password: z.string().min(6, "비밀번호는 6자 이상이어야 합니다").optional().or(z.literal("")),
  companyName: z.string().min(1, "업체명을 입력해주세요"),
  businessNumber: z.string().regex(/^\d{3}-\d{2}-\d{5}$/, "사업자번호 형식: 000-00-00000"),
  representative: z.string().min(1, "대표자명을 입력해주세요"),
  address: z.string().min(1, "주소를 입력해주세요"),
  phone1: z.string().min(1, "연락처-1을 입력해주세요"),
  phone2: z.string().optional().or(z.literal("")),
  shippingCompany: z.string().optional().or(z.literal("")),
  status: z.enum(partnerStatuses),
});

export type InsertPartner = z.infer<typeof insertPartnerSchema>;
export type Partner = typeof partners.$inferSelect;

// 협력업체-상품 연결 테이블
export const partnerProducts = pgTable("partner_products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  partnerId: varchar("partner_id").notNull().references(() => partners.id),
  productId: varchar("product_id").notNull().references(() => products.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPartnerProductSchema = createInsertSchema(partnerProducts).omit({
  id: true,
  createdAt: true,
});

export type InsertPartnerProduct = z.infer<typeof insertPartnerProductSchema>;
export type PartnerProduct = typeof partnerProducts.$inferSelect;

// 회원(셀러) 테이블
export const members = pgTable("members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  grade: text("grade").notNull().default("PENDING"),
  companyName: text("company_name").notNull(),
  businessNumber: text("business_number").notNull(),
  businessAddress: text("business_address"),
  representative: text("representative").notNull(),
  phone: text("phone").notNull(),
  managerName: text("manager_name"),
  managerPhone: text("manager_phone"),
  email: text("email"),
  deposit: integer("deposit").notNull().default(0),
  point: integer("point").notNull().default(0),
  status: text("status").notNull().default("활성"),
  memo: text("memo"),
  approvedAt: timestamp("approved_at"),
  approvedBy: varchar("approved_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertMemberSchema = createInsertSchema(members).omit({
  id: true,
  approvedAt: true,
  approvedBy: true,
  createdAt: true,
  updatedAt: true,
});

export const memberFormSchema = z.object({
  username: z.string().min(4, "아이디는 4자 이상이어야 합니다"),
  password: z.string().min(6, "비밀번호는 6자 이상이어야 합니다").optional().or(z.literal("")),
  grade: z.enum(memberGrades),
  companyName: z.string().min(1, "상호명을 입력해주세요"),
  businessNumber: z.string().regex(/^\d{3}-\d{2}-\d{5}$/, "사업자번호 형식: 000-00-00000"),
  businessAddress: z.string().optional().or(z.literal("")),
  representative: z.string().min(1, "대표자명을 입력해주세요"),
  phone: z.string().min(1, "대표연락처를 입력해주세요"),
  managerName: z.string().optional().or(z.literal("")),
  managerPhone: z.string().optional().or(z.literal("")),
  email: z.string().email("유효한 이메일을 입력해주세요").optional().or(z.literal("")),
  deposit: z.number().default(0),
  point: z.number().default(0),
  status: z.enum(memberStatuses),
  memo: z.string().optional().or(z.literal("")),
});

export const updateMemberSchema = memberFormSchema.partial().omit({ username: true, businessNumber: true, companyName: true });

export const bulkUpdateMemberSchema = z.object({
  memberIds: z.array(z.string()),
  grade: z.enum(memberGrades).optional(),
  depositAdjust: z.number().optional(),
  pointAdjust: z.number().optional(),
  memoAdd: z.string().optional(),
});

export type InsertMember = z.infer<typeof insertMemberSchema>;
export type Member = typeof members.$inferSelect;

// 회원 수정 이력 테이블
export const memberLogs = pgTable("member_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  memberId: varchar("member_id").notNull().references(() => members.id),
  changedBy: varchar("changed_by").notNull().references(() => users.id),
  changeType: text("change_type").notNull(),
  previousValue: text("previous_value"),
  newValue: text("new_value"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMemberLogSchema = createInsertSchema(memberLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertMemberLog = z.infer<typeof insertMemberLogSchema>;
export type MemberLog = typeof memberLogs.$inferSelect;

// 카테고리 레벨
export const categoryLevels = ["large", "medium", "small"] as const;
export type CategoryLevel = typeof categoryLevels[number];

export const categoryLevelLabels: Record<CategoryLevel, string> = {
  large: "대분류",
  medium: "중분류",
  small: "소분류",
};

// 카테고리 테이블
export const categories = pgTable("categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  level: text("level").notNull(),
  parentId: varchar("parent_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const categoryFormSchema = z.object({
  name: z.string().min(1, "분류명을 입력해주세요"),
  level: z.enum(categoryLevels),
  parentId: z.string().nullable().optional(),
});

export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categories.$inferSelect;

// 상품등록 상태
export const productRegistrationStatuses = ["active", "suspended"] as const;
export type ProductRegistrationStatus = typeof productRegistrationStatuses[number];

// 상품등록 (공급가 계산) 테이블
export const productRegistrations = pgTable("product_registrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  status: text("status").notNull().default("active"),
  suspendedAt: timestamp("suspended_at"),
  suspendReason: text("suspend_reason"),
  
  categoryLarge: text("category_large"),
  categoryMedium: text("category_medium"),
  categorySmall: text("category_small"),
  weight: text("weight").notNull(),
  productCode: text("product_code").notNull().unique(),
  productName: text("product_name").notNull(),
  
  sourceProduct: text("source_product"),
  sourcePrice: integer("source_price"),
  lossRate: integer("loss_rate").notNull().default(0),
  sourceWeight: integer("source_weight"),
  unitPrice: integer("unit_price"),
  sourceProductTotal: integer("source_product_total"),
  
  boxCost: integer("box_cost").notNull().default(0),
  materialCost: integer("material_cost").notNull().default(0),
  outerBoxCost: integer("outer_box_cost").notNull().default(0),
  wrappingCost: integer("wrapping_cost").notNull().default(0),
  laborCost: integer("labor_cost").notNull().default(0),
  shippingCost: integer("shipping_cost").notNull().default(0),
  totalCost: integer("total_cost"),
  
  startMarginRate: real("start_margin_rate"),
  startPrice: integer("start_price"),
  startMargin: integer("start_margin"),
  
  drivingMarginRate: real("driving_margin_rate"),
  drivingPrice: integer("driving_price"),
  drivingMargin: integer("driving_margin"),
  
  topMarginRate: real("top_margin_rate"),
  topPrice: integer("top_price"),
  topMargin: integer("top_margin"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertProductRegistrationSchema = createInsertSchema(productRegistrations).omit({
  id: true,
  unitPrice: true,
  sourceProductTotal: true,
  totalCost: true,
  startPrice: true,
  startMargin: true,
  drivingPrice: true,
  drivingMargin: true,
  topPrice: true,
  topMargin: true,
  createdAt: true,
  updatedAt: true,
});

export const productRegistrationFormSchema = z.object({
  categoryLarge: z.string().nullable().optional(),
  categoryMedium: z.string().nullable().optional(),
  categorySmall: z.string().nullable().optional(),
  weight: z.string().min(1, "중량을 입력해주세요"),
  productCode: z.string().min(1, "상품코드를 입력해주세요"),
  productName: z.string().min(1, "상품명을 입력해주세요"),
  sourceProduct: z.string().nullable().optional(),
  sourcePrice: z.number().nullable().optional(),
  lossRate: z.number().default(0),
  sourceWeight: z.number().nullable().optional(),
  boxCost: z.number().default(0),
  materialCost: z.number().default(0),
  outerBoxCost: z.number().default(0),
  wrappingCost: z.number().default(0),
  laborCost: z.number().default(0),
  shippingCost: z.number().default(0),
  startMarginRate: z.number().nullable().optional(),
  drivingMarginRate: z.number().nullable().optional(),
  topMarginRate: z.number().nullable().optional(),
});

export type InsertProductRegistration = z.infer<typeof insertProductRegistrationSchema>;
export type ProductRegistration = typeof productRegistrations.$inferSelect;

// 차주 예상공급가 상품 (회원 공개용)
export const supplyStatuses = ["supply", "suspended"] as const;
export type SupplyStatus = typeof supplyStatuses[number];

export const nextWeekProducts = pgTable("next_week_products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productCode: text("product_code").notNull().unique(),
  productName: text("product_name").notNull(),
  categoryLarge: text("category_large"),
  categoryMedium: text("category_medium"),
  categorySmall: text("category_small"),
  weight: text("weight").notNull(),
  startPrice: integer("start_price").notNull(),
  drivingPrice: integer("driving_price").notNull(),
  topPrice: integer("top_price").notNull(),
  supplyStatus: text("supply_status").notNull().default("supply"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertNextWeekProductSchema = createInsertSchema(nextWeekProducts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertNextWeekProduct = z.infer<typeof insertNextWeekProductSchema>;
export type NextWeekProduct = typeof nextWeekProducts.$inferSelect;

// Current Products (현재 공급가 상품)
export const currentProducts = pgTable("current_products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productCode: text("product_code").notNull().unique(),
  productName: text("product_name").notNull(),
  categoryLarge: text("category_large"),
  categoryMedium: text("category_medium"),
  categorySmall: text("category_small"),
  weight: text("weight").notNull(),
  startPrice: integer("start_price").notNull(),
  drivingPrice: integer("driving_price").notNull(),
  topPrice: integer("top_price").notNull(),
  supplyStatus: text("supply_status").notNull().default("supply"), // 'supply' | 'suspended'
  suspendedAt: timestamp("suspended_at"),
  suspendReason: text("suspend_reason"),
  appliedAt: timestamp("applied_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCurrentProductSchema = createInsertSchema(currentProducts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCurrentProduct = z.infer<typeof insertCurrentProductSchema>;
export type CurrentProduct = typeof currentProducts.$inferSelect;

// 재료 타입
export const materialTypes = ["raw", "semi", "sub"] as const;
export type MaterialType = typeof materialTypes[number];

export const materialTypeLabels: Record<MaterialType, string> = {
  raw: "원재료",
  semi: "반재료",
  sub: "부재료",
};

// 재료 대분류
export const materialCategoriesLarge = pgTable("material_categories_large", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertMaterialCategoryLargeSchema = createInsertSchema(materialCategoriesLarge).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertMaterialCategoryLarge = z.infer<typeof insertMaterialCategoryLargeSchema>;
export type MaterialCategoryLarge = typeof materialCategoriesLarge.$inferSelect;

// 재료 중분류
export const materialCategoriesMedium = pgTable("material_categories_medium", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  largeCategoryId: varchar("large_category_id").notNull().references(() => materialCategoriesLarge.id),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertMaterialCategoryMediumSchema = createInsertSchema(materialCategoriesMedium).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertMaterialCategoryMedium = z.infer<typeof insertMaterialCategoryMediumSchema>;
export type MaterialCategoryMedium = typeof materialCategoriesMedium.$inferSelect;

// 재료 소분류
export const materialCategoriesSmall = pgTable("material_categories_small", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  mediumCategoryId: varchar("medium_category_id").notNull().references(() => materialCategoriesMedium.id),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertMaterialCategorySmallSchema = createInsertSchema(materialCategoriesSmall).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertMaterialCategorySmall = z.infer<typeof insertMaterialCategorySmallSchema>;
export type MaterialCategorySmall = typeof materialCategoriesSmall.$inferSelect;

// 재료
export const materials = pgTable("materials", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  materialType: text("material_type").notNull(),
  largeCategoryId: varchar("large_category_id").notNull().references(() => materialCategoriesLarge.id),
  mediumCategoryId: varchar("medium_category_id").notNull().references(() => materialCategoriesMedium.id),
  smallCategoryId: varchar("small_category_id").references(() => materialCategoriesSmall.id),
  materialCode: text("material_code").notNull().unique(),
  materialName: text("material_name").notNull(),
  currentStock: real("current_stock").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertMaterialSchema = createInsertSchema(materials).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const materialFormSchema = z.object({
  materialType: z.enum(materialTypes),
  largeCategoryId: z.string().min(1, "대분류를 선택해주세요"),
  mediumCategoryId: z.string().min(1, "중분류를 선택해주세요"),
  smallCategoryId: z.string().optional(),
  materialCode: z.string().optional(),
  materialName: z.string().min(1, "재료명을 입력해주세요"),
  currentStock: z.number().default(0),
});

export type InsertMaterial = z.infer<typeof insertMaterialSchema>;
export type Material = typeof materials.$inferSelect;
