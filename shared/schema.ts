import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const userTiers = ["준회원", "start회원", "driving회원", "top회원"] as const;
export type UserTier = typeof userTiers[number];

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
