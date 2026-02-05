import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, timestamp, jsonb, boolean, serial, decimal, index } from "drizzle-orm/pg-core";
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
  memberName: text("member_name"),
  companyName: text("company_name").notNull(),
  businessNumber: text("business_number").notNull(),
  businessAddress: text("business_address"),
  representative: text("representative").notNull(),
  phone: text("phone").notNull(),
  ceoBirth: text("ceo_birth"),
  ceoCi: text("ceo_ci"),
  mailNo: text("mail_no"),
  managerName: text("manager_name"),
  managerPhone: text("manager_phone"),
  manager2Name: text("manager2_name"),
  manager2Phone: text("manager2_phone"),
  manager3Name: text("manager3_name"),
  manager3Phone: text("manager3_phone"),
  email: text("email"),
  deposit: integer("deposit").notNull().default(0),
  point: integer("point").notNull().default(0),
  status: text("status").notNull().default("활성"),
  memo: text("memo"),
  businessLicenseUrl: text("business_license_url"),
  mailFilePath: text("mail_file_path"),
  profileImageUrl: text("profile_image_url"),
  signatureData: text("signature_data"),
  approvedAt: timestamp("approved_at"),
  approvedBy: varchar("approved_by").references(() => users.id),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertMemberSchema = createInsertSchema(members).omit({
  id: true,
  approvedAt: true,
  approvedBy: true,
  lastLoginAt: true,
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
  
  mappingStatus: text("mapping_status").notNull().default("incomplete"),
  
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

// 재료 타입 (레거시 - 호환성 유지)
export const materialTypes = ["raw", "semi", "sub"] as const;
export type MaterialType = typeof materialTypes[number];

export const materialTypeLabels: Record<MaterialType, string> = {
  raw: "원재료",
  semi: "반재료",
  sub: "부재료",
};

// 재료 타입 테이블 (동적 관리용)
export const materialTypesTable = pgTable("material_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertMaterialTypeSchema = createInsertSchema(materialTypesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertMaterialType = z.infer<typeof insertMaterialTypeSchema>;
export type MaterialTypeRecord = typeof materialTypesTable.$inferSelect;

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

// 상품 매핑 상태
export const mappingStatuses = ["complete", "incomplete"] as const;
export type MappingStatus = typeof mappingStatuses[number];

// 상품 매핑 테이블 (상품 정보)
export const productMappings = pgTable("product_mappings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productCode: text("product_code").notNull().unique(),
  productName: text("product_name").notNull(),
  categoryLarge: text("category_large"),
  categoryMedium: text("category_medium"),
  categorySmall: text("category_small"),
  usageStatus: text("usage_status").notNull().default("Y"),
  mappingStatus: text("mapping_status").notNull().default("incomplete"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertProductMappingSchema = createInsertSchema(productMappings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertProductMapping = z.infer<typeof insertProductMappingSchema>;
export type ProductMapping = typeof productMappings.$inferSelect;

// 상품-재료 매핑 테이블
export const productMaterialMappings = pgTable("product_material_mappings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productCode: text("product_code").notNull(),
  materialCode: text("material_code").notNull(),
  materialName: text("material_name").notNull(),
  materialType: text("material_type").notNull().default("raw"),
  quantity: real("quantity").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertProductMaterialMappingSchema = createInsertSchema(productMaterialMappings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertProductMaterialMapping = z.infer<typeof insertProductMaterialMappingSchema>;
export type ProductMaterialMapping = typeof productMaterialMappings.$inferSelect;

// 공급상품 재고 테이블
export const productStocks = pgTable("product_stocks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productCode: text("product_code").notNull().unique(),
  productName: text("product_name").notNull(),
  currentStock: integer("current_stock").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertProductStockSchema = createInsertSchema(productStocks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertProductStock = z.infer<typeof insertProductStockSchema>;
export type ProductStock = typeof productStocks.$inferSelect;

// 재고 이력 유형 (공급상품/원재료/반재료/부재료)
export const stockHistoryTypes = ["product", "raw", "semi", "sub"] as const;
export type StockHistoryType = typeof stockHistoryTypes[number];

// 재고 이력 액션 유형
export const stockActionTypes = ["in", "out", "adjust"] as const;
export type StockActionType = typeof stockActionTypes[number];

// 재고 이력 처리방식 (수동/자동-주문연동)
export const stockSourceTypes = ["manual", "order"] as const;
export type StockSourceType = typeof stockSourceTypes[number];

// 재고 조정 사유
export const adjustReasons = ["파손", "오차 수정", "폐기", "기타"] as const;
export type AdjustReason = typeof adjustReasons[number];

// 재고 이력 테이블
export const stockHistory = pgTable("stock_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  stockType: text("stock_type").notNull(), // product | raw | semi | sub
  actionType: text("action_type").notNull(), // in | out | adjust
  itemCode: text("item_code").notNull(), // 상품코드 또는 재료코드
  itemName: text("item_name").notNull(), // 상품명 또는 재료명
  quantity: integer("quantity").notNull(), // +/- 수량
  beforeStock: integer("before_stock"), // 변경 전 재고
  afterStock: integer("after_stock"), // 변경 후 재고
  reason: text("reason"), // 조정 사유
  note: text("note"), // 비고
  adminId: varchar("admin_id").notNull(), // 담당자 ID
  source: text("source").notNull().default("manual"), // 처리방식: manual | order
  orderId: text("order_id"), // 주문번호 (미래 연동용)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertStockHistorySchema = createInsertSchema(stockHistory).omit({
  id: true,
  createdAt: true,
});

export type InsertStockHistory = z.infer<typeof insertStockHistorySchema>;
export type StockHistory = typeof stockHistory.$inferSelect;

// ==================== 사이트 설정 ====================
export const siteSettings = pgTable("site_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  settingKey: varchar("setting_key", { length: 100 }).unique().notNull(),
  settingValue: text("setting_value"),
  settingType: varchar("setting_type", { length: 20 }).default("string"), // 'string', 'boolean', 'json', 'number'
  category: varchar("category", { length: 50 }).default("general"), // 'header', 'footer', 'general'
  description: varchar("description", { length: 200 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSiteSettingSchema = createInsertSchema(siteSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSiteSetting = z.infer<typeof insertSiteSettingSchema>;
export type SiteSetting = typeof siteSettings.$inferSelect;

// ==================== Header Menus ====================
// menuType: "system" (로그인, 로그아웃, 회원가입, 장바구니 등 시스템 메뉴) | "custom" (사용자 정의 메뉴)
// systemKey: 시스템 메뉴 식별자 (login, logout, register, cart, mypage 등)
export const headerMenus = pgTable("header_menus", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 100 }).notNull(),
  path: varchar("path", { length: 255 }).notNull(),
  menuType: varchar("menu_type", { length: 20 }).default("custom"), // "system" | "custom"
  systemKey: varchar("system_key", { length: 50 }), // login, logout, register, cart, mypage
  sortOrder: integer("sort_order").default(0),
  isVisible: varchar("is_visible", { length: 10 }).default("true"),
  openInNewTab: varchar("open_in_new_tab", { length: 10 }).default("false"),
  showWhenLoggedIn: varchar("show_when_logged_in", { length: 10 }).default("true"), // 로그인 시 표시
  showWhenLoggedOut: varchar("show_when_logged_out", { length: 10 }).default("true"), // 비로그인 시 표시
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertHeaderMenuSchema = createInsertSchema(headerMenus).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertHeaderMenu = z.infer<typeof insertHeaderMenuSchema>;
export type HeaderMenu = typeof headerMenus.$inferSelect;

// ==================== Page Management ====================
// 페이지 카테고리
export const pageCategories = [
  "기본페이지",
  "메인/서브페이지",
  "회원마이페이지",
  "주문관리(관리자)",
  "통계관리페이지",
  "가이드페이지",
  "게시판관리페이지",
  "기타페이지"
] as const;
export type PageCategory = typeof pageCategories[number];

// 접근권한 레벨 (all = 모든 회원, 그 외는 해당 등급 이상)
export const pageAccessLevels = ["all", "ASSOCIATE", "START", "DRIVING", "TOP"] as const;
export type PageAccessLevel = typeof pageAccessLevels[number];

export const pageAccessLevelLabels: Record<PageAccessLevel, string> = {
  all: "전체 공개",
  ASSOCIATE: "준회원 이상",
  START: "Start회원 이상",
  DRIVING: "Driving회원 이상",
  TOP: "Top회원 전용",
};

// 페이지 상태
export const pageStatuses = ["active", "draft", "hidden"] as const;
export type PageStatus = typeof pageStatuses[number];

// 페이지 콘텐츠 섹션 타입
export const pageSectionTypes = ["hero", "hero_advanced", "hero_slider", "text", "image", "image_text", "text_image", "heading", "button", "divider", "cards", "features", "video_gallery", "stats_cards", "icon_cards", "cta", "cta_advanced", "announcement_marquee", "content_two_blocks"] as const;
export type PageSectionType = typeof pageSectionTypes[number];

// 페이지 콘텐츠 섹션 인터페이스
export interface PageSection {
  id: string;
  type: PageSectionType;
  order: number;
  data: {
    title?: string;
    subtitle?: string;
    text?: string;
    description?: string;
    imageUrl?: string;
    imageAlt?: string;
    buttonText?: string;
    buttonLink?: string;
    buttonNewTab?: boolean;
    secondaryButtonText?: string;
    secondaryButtonLink?: string;
    secondaryButtonNewTab?: boolean;
    backgroundColor?: string;
    backgroundType?: 'gradient' | 'image' | 'color';
    backgroundImage?: string;
    textColor?: string;
    // Content positioning
    contentAlign?: 'left' | 'center' | 'right';
    contentVerticalAlign?: 'top' | 'center' | 'bottom';
    // Element-level grid positioning (1-16 columns)
    elementPositions?: Record<string, { col: number; span: number }>;
    // Advanced section fields
    promoBadge?: string;
    promoBadgeLink?: string;
    theme?: 'light' | 'dark';
    layout?: 'image-text' | 'text-image';
    sectionTitle?: string;
    sectionSubtitle?: string;
    sectionDescription?: string;
    paragraphs?: string[];
    benefits?: string[];
    // Stats for hero_advanced and stats_cards
    stats?: Array<{
      value: string;
      suffix?: string;
      label: string;
      color?: string;
    }>;
    // Videos for video_gallery
    videos?: Array<{
      id: string;
      thumbnail?: string;
    }>;
    // Slides for hero_slider
    slides?: Array<{
      id: string;
      imageUrl: string;
      imageAlt?: string;
      link?: string;
    }>;
    // Slider settings
    slideDuration?: number;
    fadeSpeed?: number;
    autoPlay?: boolean;
    // Extended items for icon_cards
    items?: Array<{
      id?: string;
      title?: string;
      description?: string;
      imageUrl?: string;
      icon?: string;
      iconBg?: string;
      iconColor?: string;
      link?: string;
    }>;
    // Content Two Blocks section
    block1Bg?: string;
    block2Bg?: string;
    block1?: {
      label?: string;
      title?: string;
      description?: string;
      image?: string;
      imageAlt?: string;
      items?: string[];
    };
    block2?: {
      label?: string;
      title?: string;
      description?: string;
      image?: string;
      imageAlt?: string;
      items?: string[];
    };
  };
}

// 페이지 콘텐츠 구조
export interface PageContent {
  sections: PageSection[];
  meta?: {
    title?: string;
    description?: string;
    keywords?: string;
  };
}

export const pages = pgTable("pages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 100 }).notNull(), // 페이지 이름
  path: varchar("path", { length: 255 }).notNull(), // URL 경로
  description: text("description"), // 설명
  category: varchar("category", { length: 50 }).notNull(), // 8개 카테고리 중 하나
  accessLevel: varchar("access_level", { length: 20 }).default("all").notNull(), // 접근권한
  status: varchar("status", { length: 20 }).default("active").notNull(), // active, draft, hidden
  sortOrder: integer("sort_order").default(0), // 정렬 순서
  icon: varchar("icon", { length: 50 }), // 아이콘 이름 (lucide-react)
  isSystem: varchar("is_system", { length: 10 }).default("false"), // 시스템 페이지 여부 (삭제 불가)
  content: jsonb("content").$type<PageContent>(), // 페이지 콘텐츠 (동적 섹션들)
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPageSchema = createInsertSchema(pages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPage = z.infer<typeof insertPageSchema>;
export type Page = typeof pages.$inferSelect;

// 공지사항 테이블
export const announcements = pgTable("announcements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  content: text("content"),
  isImportant: varchar("is_important", { length: 10 }).default("false"),
  isVisible: varchar("is_visible", { length: 10 }).default("true"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAnnouncementSchema = createInsertSchema(announcements).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAnnouncement = z.infer<typeof insertAnnouncementSchema>;
export type Announcement = typeof announcements.$inferSelect;

// 약관 버전 관리 테이블
export const termVersions = pgTable("term_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  version: text("version").notNull(),
  termType: text("term_type").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  isActive: text("is_active").notNull().default("true"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: varchar("created_by").references(() => users.id),
});

export const insertTermVersionSchema = createInsertSchema(termVersions).omit({
  id: true,
  createdAt: true,
});

export type InsertTermVersion = z.infer<typeof insertTermVersionSchema>;
export type TermVersion = typeof termVersions.$inferSelect;

// 약관 동의 기록 테이블 (법적 증빙용)
export const termAgreements = pgTable("term_agreements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  memberId: varchar("member_id").references(() => members.id),
  memberUsername: text("member_username").notNull(),
  memberName: text("member_name"),
  companyName: text("company_name"),
  businessNumber: text("business_number"),
  representative: text("representative"),
  agreedAt: timestamp("agreed_at").defaultNow().notNull(),
  serviceTermVersion: text("service_term_version"),
  serviceTermContent: text("service_term_content"),
  serviceTermAgreed: text("service_term_agreed").notNull().default("true"),
  privacyTermVersion: text("privacy_term_version"),
  privacyTermContent: text("privacy_term_content"),
  privacyTermAgreed: text("privacy_term_agreed").notNull().default("true"),
  thirdPartyTermVersion: text("third_party_term_version"),
  thirdPartyTermContent: text("third_party_term_content"),
  thirdPartyTermAgreed: text("third_party_term_agreed").notNull().default("true"),
  signatureData: text("signature_data"),
  signatureHash: text("signature_hash"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  contentHash: text("content_hash"),
  ceoBirth: text("ceo_birth"),
  ceoCi: text("ceo_ci"),
  ceoPhone: text("ceo_phone"),
  memberStatus: text("member_status").notNull().default("active"),
});

export const deletedMembers = pgTable("deleted_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  originalMemberId: varchar("original_member_id").notNull(),
  username: text("username").notNull(),
  companyName: text("company_name").notNull(),
  businessNumber: text("business_number"),
  representative: text("representative"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  detailAddress: text("detail_address"),
  grade: text("grade"),
  deposit: integer("deposit").default(0),
  point: integer("point").default(0),
  status: text("status"),
  memo: text("memo"),
  signatureData: text("signature_data"),
  deletedAt: timestamp("deleted_at").defaultNow().notNull(),
  deletedBy: varchar("deleted_by"),
  retentionUntil: timestamp("retention_until").notNull(),
  originalCreatedAt: timestamp("original_created_at"),
});

export const deletedMemberOrders = pgTable("deleted_member_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  deletedMemberId: varchar("deleted_member_id").notNull().references(() => deletedMembers.id),
  originalOrderId: varchar("original_order_id"),
  productName: text("product_name"),
  quantity: integer("quantity"),
  price: integer("price"),
  recipientName: text("recipient_name"),
  recipientPhone: text("recipient_phone"),
  recipientAddress: text("recipient_address"),
  orderCreatedAt: timestamp("order_created_at"),
  archivedAt: timestamp("archived_at").defaultNow().notNull(),
});

export const insertTermAgreementSchema = createInsertSchema(termAgreements).omit({
  id: true,
});

export type InsertTermAgreement = z.infer<typeof insertTermAgreementSchema>;
export type TermAgreement = typeof termAgreements.$inferSelect;

export const insertDeletedMemberSchema = createInsertSchema(deletedMembers).omit({
  id: true,
});

export type InsertDeletedMember = z.infer<typeof insertDeletedMemberSchema>;
export type DeletedMember = typeof deletedMembers.$inferSelect;

export const insertDeletedMemberOrderSchema = createInsertSchema(deletedMemberOrders).omit({
  id: true,
});

export type InsertDeletedMemberOrder = z.infer<typeof insertDeletedMemberOrderSchema>;
export type DeletedMemberOrder = typeof deletedMemberOrders.$inferSelect;

// 알림톡 템플릿 설정
export const alimtalkTemplates = pgTable("alimtalk_templates", {
  id: serial("id").primaryKey(),
  templateCode: text("template_code").notNull().unique(),
  templateId: text("template_id").notNull().unique(),
  templateName: text("template_name").notNull(),
  description: text("description"),
  isAuto: boolean("is_auto").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  totalSent: integer("total_sent").notNull().default(0),
  totalCost: integer("total_cost").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// 알림톡 발송 이력
export const alimtalkHistory = pgTable("alimtalk_history", {
  id: serial("id").primaryKey(),
  templateId: integer("template_id").references(() => alimtalkTemplates.id).notNull(),
  recipientCount: integer("recipient_count").notNull(),
  successCount: integer("success_count").notNull(),
  failCount: integer("fail_count").notNull(),
  cost: integer("cost").notNull(),
  sentBy: varchar("sent_by").references(() => users.id),
  sentAt: timestamp("sent_at").notNull().defaultNow(),
  responseData: jsonb("response_data"),
});

// 브랜드톡 템플릿
export const brandtalkTemplates = pgTable("brandtalk_templates", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  buttonName: text("button_name"),
  buttonUrl: text("button_url"),
  totalSent: integer("total_sent").notNull().default(0),
  lastSentAt: timestamp("last_sent_at"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// 브랜드톡 발송 이력
export const brandtalkHistory = pgTable("brandtalk_history", {
  id: serial("id").primaryKey(),
  templateId: integer("template_id").references(() => brandtalkTemplates.id),
  title: text("title").notNull(),
  message: text("message").notNull(),
  recipientCount: integer("recipient_count").notNull(),
  successCount: integer("success_count").notNull(),
  failCount: integer("fail_count").notNull(),
  cost: integer("cost").notNull(),
  sentBy: varchar("sent_by").references(() => users.id),
  sentAt: timestamp("sent_at").notNull().defaultNow(),
  responseData: jsonb("response_data"),
});

export const insertAlimtalkTemplateSchema = createInsertSchema(alimtalkTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAlimtalkTemplate = z.infer<typeof insertAlimtalkTemplateSchema>;
export type AlimtalkTemplate = typeof alimtalkTemplates.$inferSelect;

export const insertAlimtalkHistorySchema = createInsertSchema(alimtalkHistory).omit({
  id: true,
  sentAt: true,
});

export type InsertAlimtalkHistory = z.infer<typeof insertAlimtalkHistorySchema>;
export type AlimtalkHistory = typeof alimtalkHistory.$inferSelect;

export const insertBrandtalkTemplateSchema = createInsertSchema(brandtalkTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertBrandtalkTemplate = z.infer<typeof insertBrandtalkTemplateSchema>;
export type BrandtalkTemplate = typeof brandtalkTemplates.$inferSelect;

export const insertBrandtalkHistorySchema = createInsertSchema(brandtalkHistory).omit({
  id: true,
  sentAt: true,
});

export type InsertBrandtalkHistory = z.infer<typeof insertBrandtalkHistorySchema>;
export type BrandtalkHistory = typeof brandtalkHistory.$inferSelect;

// 주문 상태 (4단계 워크플로우 + 예외 상태)
// 1. 대기 (주문조정 단계)
// 2. 상품준비중 (운송장 출력 단계)
// 3. 배송준비중 (회원취소건 접수 단계)
// 4. 배송중
// 예외: 주문조정, 취소
export const pendingOrderStatuses = ["대기", "주문조정", "상품준비중", "배송준비중", "배송중", "취소"] as const;
export type PendingOrderStatus = typeof pendingOrderStatuses[number];

// 주문대기 테이블
export const pendingOrders = pgTable("pending_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sequenceNumber: text("sequence_number").notNull().unique(),
  orderNumber: text("order_number").notNull().unique(),
  memberId: varchar("member_id").notNull().references(() => members.id),
  memberCompanyName: text("member_company_name").notNull(),
  status: text("status").notNull().default("대기"),
  
  categoryLarge: text("category_large"),
  categoryMedium: text("category_medium"),
  categorySmall: text("category_small"),
  productCode: text("product_code").notNull(),
  productName: text("product_name").notNull(),
  supplyPrice: integer("supply_price"),
  
  ordererName: text("orderer_name").notNull(),
  ordererPhone: text("orderer_phone").notNull(),
  ordererZipCode: text("orderer_zip_code"),
  ordererAddress: text("orderer_address"),
  
  recipientName: text("recipient_name").notNull(),
  recipientMobile: text("recipient_mobile").notNull(),
  recipientPhone: text("recipient_phone"),
  recipientZipCode: text("recipient_zip_code"),
  recipientAddress: text("recipient_address").notNull(),
  
  deliveryMessage: text("delivery_message"),
  customOrderNumber: text("custom_order_number").notNull(),
  orderDetailNumber: text("order_detail_number"),
  volumeUnit: text("volume_unit"),
  uploadFormat: text("upload_format").default("default"),
  
  trackingNumber: text("tracking_number"),
  courierCompany: text("courier_company"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPendingOrderSchema = createInsertSchema(pendingOrders).omit({
  id: true,
  sequenceNumber: true,
  orderNumber: true,
  memberId: true,
  memberCompanyName: true,
  status: true,
  categoryLarge: true,
  categoryMedium: true,
  categorySmall: true,
  supplyPrice: true,
  trackingNumber: true,
  courierCompany: true,
  createdAt: true,
  updatedAt: true,
});

export const pendingOrderFormSchema = z.object({
  productCode: z.string().min(1, "상품코드를 입력해주세요"),
  productName: z.string().min(1, "상품명을 입력해주세요"),
  ordererName: z.string().min(1, "주문자명을 입력해주세요"),
  ordererPhone: z.string().min(1, "주문자 전화번호를 입력해주세요"),
  ordererAddress: z.string().optional().or(z.literal("")),
  recipientName: z.string().min(1, "수령자명을 입력해주세요"),
  recipientMobile: z.string().min(1, "수령자 휴대폰번호를 입력해주세요"),
  recipientPhone: z.string().optional().or(z.literal("")),
  recipientAddress: z.string().min(1, "수령자 주소를 입력해주세요"),
  deliveryMessage: z.string().optional().or(z.literal("")),
  customOrderNumber: z.string().min(1, "자체주문번호를 입력해주세요"),
});

export type InsertPendingOrder = z.infer<typeof insertPendingOrderSchema>;
export type PendingOrder = typeof pendingOrders.$inferSelect;

// 양식 관리 테이블
export const formTemplates = pgTable("form_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(), // 양식 이름 (예: "주문등록양식")
  code: text("code").notNull().unique(), // 양식 코드 (예: "order_registration") - 자동 생성됨
  description: text("description"), // 양식 설명
  category: text("category").notNull().default("기타"), // 카테고리 (주문관리, 재고관리, 회원관리 등)
  templateType: text("template_type").notNull().default("download"), // 양식 유형: download(다운로드용), upload(업로드용)
  fileUrl: text("file_url"), // 업로드된 파일 URL
  fileName: text("file_name"), // 원본 파일명
  fileType: text("file_type"), // 파일 타입 (xlsx, xls, csv 등)
  fileSize: integer("file_size"), // 파일 크기 (bytes)
  isActive: text("is_active").default("true"), // 활성 상태
  version: integer("version").default(1), // 버전
  uploadedBy: varchar("uploaded_by").references(() => users.id), // 업로드한 관리자
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertFormTemplateSchema = createInsertSchema(formTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertFormTemplate = z.infer<typeof insertFormTemplateSchema>;
export type FormTemplate = typeof formTemplates.$inferSelect;

// 주소 학습 데이터 테이블 (스마트 주소 검증 시스템)
export const addressLearningData = pgTable('address_learning_data', {
  id: serial('id').primaryKey(),
  
  // 원본 주소 정보
  originalAddress: text('original_address'),
  originalDetailAddress: text('original_detail_address').notNull(),
  buildingType: varchar('building_type', { length: 20 }),
  
  // 수정된 주소
  correctedDetailAddress: text('corrected_detail_address').notNull(),
  
  // 수정 유형 (memo_separation, missing_unit_separator, hyphen_to_unit 등)
  correctionType: varchar('correction_type', { length: 50 }),
  
  // 신뢰도 및 통계
  confidenceScore: decimal('confidence_score', { precision: 3, scale: 2 }).default('0.80').notNull(),
  occurrenceCount: integer('occurrence_count').default(1).notNull(),
  successCount: integer('success_count').default(0).notNull(),
  userConfirmed: boolean('user_confirmed').default(false).notNull(),
  
  // AI 패턴 분석 결과
  errorPattern: varchar('error_pattern', { length: 100 }),
  problemDescription: text('problem_description'),
  patternRegex: varchar('pattern_regex', { length: 500 }),
  solutionDescription: text('solution_description'),
  similarPatterns: text('similar_patterns'),
  extractedMemo: text('extracted_memo'),
  analyzedAt: timestamp('analyzed_at'),
  aiModel: varchar('ai_model', { length: 50 }),
  
  // 타임스탬프
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  lastUsedAt: timestamp('last_used_at'),
}, (table) => ({
  originalDetailIdx: index('idx_original_detail').on(table.originalDetailAddress),
  buildingTypeIdx: index('idx_building_type').on(table.buildingType),
  patternIdx: index('idx_pattern_regex').on(table.patternRegex),
}));

export type AddressLearningData = typeof addressLearningData.$inferSelect;
export type NewAddressLearningData = typeof addressLearningData.$inferInsert;

// 주문 업로드 히스토리 (중복 파일 감지용)
export const orderUploadHistory = pgTable("order_upload_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  memberId: varchar("member_id").notNull().references(() => members.id),
  fileName: text("file_name").notNull(),
  contentHash: varchar("content_hash", { length: 64 }).notNull(), // SHA-256 해시
  rowCount: integer("row_count").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
}, (table) => ({
  memberIdIdx: index("idx_upload_member_id").on(table.memberId),
  contentHashIdx: index("idx_upload_content_hash").on(table.contentHash),
}));

export type OrderUploadHistory = typeof orderUploadHistory.$inferSelect;
export type NewOrderUploadHistory = typeof orderUploadHistory.$inferInsert;
