import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import session from "express-session";
import { loginSchema, registerSchema, insertOrderSchema, insertAdminSchema, updateAdminSchema, userTiers, imageCategories, menuPermissions, partnerFormSchema, shippingCompanies, memberFormSchema, updateMemberSchema, bulkUpdateMemberSchema, memberGrades, categoryFormSchema, productRegistrationFormSchema } from "@shared/schema";
import { z } from "zod";
import MemoryStore from "memorystore";
import multer from "multer";
import { uploadImage, deleteImage } from "./r2";

declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}

const MemoryStoreSession = MemoryStore(session);

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "order-management-secret-key",
      resave: false,
      saveUninitialized: false,
      store: new MemoryStoreSession({
        checkPeriod: 86400000,
      }),
      cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
      },
    })
  );

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user) {
      req.session.destroy(() => {});
      return res.status(401).json({ message: "User not found" });
    }

    const { password, ...userWithoutPassword } = user;
    return res.json(userWithoutPassword);
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const data = registerSchema.parse(req.body);
      
      const existingUser = await storage.getUserByUsername(data.username);
      if (existingUser) {
        return res.status(400).json({ message: "이미 등록된 아이디입니다" });
      }

      const user = await storage.createUser(data);
      req.session.userId = user.id;

      const { password, ...userWithoutPassword } = user;
      return res.json(userWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      throw error;
    }
  });

  app.get("/api/auth/check-username/:username", async (req, res) => {
    const existingUser = await storage.getUserByUsername(req.params.username);
    return res.json({ available: !existingUser });
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const data = loginSchema.parse(req.body);
      
      const user = await storage.validatePassword(data.username, data.password);
      if (!user) {
        return res.status(401).json({ message: "아이디 또는 비밀번호가 올바르지 않습니다" });
      }

      await storage.updateLastLogin(user.id);
      req.session.userId = user.id;

      const { password, ...userWithoutPassword } = user;
      return res.json(userWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      throw error;
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.clearCookie("connect.sid");
      return res.json({ message: "Logged out" });
    });
  });

  app.get("/api/orders", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const orders = await storage.getOrdersByUserId(req.session.userId);
    return res.json(orders);
  });

  app.post("/api/orders", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const data = insertOrderSchema.parse(req.body);
      const order = await storage.createOrder(req.session.userId, data);
      return res.json(order);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      throw error;
    }
  });

  const isAdmin = (role: string) => role === "SUPER_ADMIN" || role === "ADMIN";
  const isSuperAdmin = (role: string) => role === "SUPER_ADMIN";

  app.get("/api/admin/users", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user || !isAdmin(user.role)) {
      return res.status(403).json({ message: "Admin access required" });
    }

    const users = await storage.getAllUsers();
    const usersWithoutPasswords = users.map(({ password, ...u }) => u);
    return res.json(usersWithoutPasswords);
  });

  app.get("/api/admin/admins", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user || !isAdmin(user.role)) {
      return res.status(403).json({ message: "Admin access required" });
    }

    const admins = await storage.getAdminUsers();
    const adminsWithoutPasswords = admins.map(({ password, ...u }) => u);
    return res.json(adminsWithoutPasswords);
  });

  app.post("/api/admin/admins", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const currentUser = await storage.getUser(req.session.userId);
    if (!currentUser || !isSuperAdmin(currentUser.role)) {
      return res.status(403).json({ message: "최고관리자만 관리자를 등록할 수 있습니다" });
    }

    try {
      const data = insertAdminSchema.parse(req.body);
      
      const existingUser = await storage.getUserByUsername(data.username);
      if (existingUser) {
        return res.status(400).json({ message: "이미 등록된 아이디입니다" });
      }

      const newAdmin = await storage.createUser({
        username: data.username,
        password: data.password,
        name: data.name,
        phone: data.phone,
        email: data.email,
        role: data.role,
        permissions: data.role === "SUPER_ADMIN" ? [] : (data.permissions || []),
      });

      const { password, ...adminWithoutPassword } = newAdmin;
      return res.json(adminWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      throw error;
    }
  });

  app.patch("/api/admin/admins/:id", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const currentUser = await storage.getUser(req.session.userId);
    if (!currentUser || !isSuperAdmin(currentUser.role)) {
      return res.status(403).json({ message: "최고관리자만 관리자를 수정할 수 있습니다" });
    }

    const targetUser = await storage.getUser(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ message: "관리자를 찾을 수 없습니다" });
    }

    if (targetUser.role === "SUPER_ADMIN" && targetUser.id !== currentUser.id) {
      return res.status(403).json({ message: "다른 최고관리자는 수정할 수 없습니다" });
    }

    try {
      const data = updateAdminSchema.parse(req.body);
      const updateData: any = {};
      
      if (data.name) updateData.name = data.name;
      if (data.phone !== undefined) updateData.phone = data.phone;
      if (data.email !== undefined) updateData.email = data.email;
      if (data.role && targetUser.role !== "SUPER_ADMIN") updateData.role = data.role;
      if (data.permissions !== undefined) updateData.permissions = data.permissions;
      if (data.password && data.password.length >= 6) updateData.password = data.password;

      const updatedAdmin = await storage.updateUser(req.params.id, updateData);
      if (!updatedAdmin) {
        return res.status(404).json({ message: "관리자를 찾을 수 없습니다" });
      }

      const { password, ...adminWithoutPassword } = updatedAdmin;
      return res.json(adminWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      throw error;
    }
  });

  app.delete("/api/admin/admins/:id", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const currentUser = await storage.getUser(req.session.userId);
    if (!currentUser || !isSuperAdmin(currentUser.role)) {
      return res.status(403).json({ message: "최고관리자만 관리자를 삭제할 수 있습니다" });
    }

    const targetUser = await storage.getUser(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ message: "관리자를 찾을 수 없습니다" });
    }

    if (targetUser.role === "SUPER_ADMIN") {
      return res.status(403).json({ message: "최고관리자는 삭제할 수 없습니다" });
    }

    await storage.deleteUser(req.params.id);
    return res.json({ message: "삭제되었습니다" });
  });

  app.get("/api/admin/permissions", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user || !isAdmin(user.role)) {
      return res.status(403).json({ message: "Admin access required" });
    }

    return res.json(menuPermissions);
  });

  app.get("/api/admin/orders", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user || !isAdmin(user.role)) {
      return res.status(403).json({ message: "Admin access required" });
    }

    const orders = await storage.getAllOrders();
    return res.json(orders);
  });

  app.patch("/api/admin/users/:id/tier", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const currentUser = await storage.getUser(req.session.userId);
    if (!currentUser || !isAdmin(currentUser.role)) {
      return res.status(403).json({ message: "Admin access required" });
    }

    const { tier } = req.body;
    if (!tier || !userTiers.includes(tier)) {
      return res.status(400).json({ message: "유효하지 않은 등급입니다" });
    }

    const updatedUser = await storage.updateUserTier(req.params.id, tier);
    if (!updatedUser) {
      return res.status(404).json({ message: "사용자를 찾을 수 없습니다" });
    }

    const { password, ...userWithoutPassword } = updatedUser;
    return res.json(userWithoutPassword);
  });

  const upload = multer({ storage: multer.memoryStorage() });

  app.get("/api/admin/images", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user || !isAdmin(user.role)) {
      return res.status(403).json({ message: "Admin access required" });
    }

    const category = req.query.category as string;
    const images = category 
      ? await storage.getImagesByCategory(category)
      : await storage.getAllImages();
    return res.json(images);
  });

  app.post("/api/admin/images", upload.single("file"), async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user || !isAdmin(user.role)) {
      return res.status(403).json({ message: "Admin access required" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "파일이 필요합니다" });
    }

    const category = req.body.category || "기타";
    if (!imageCategories.includes(category)) {
      return res.status(400).json({ message: "유효하지 않은 카테고리입니다" });
    }

    const subcategory = req.body.subcategory || null;
    const width = req.body.width ? parseInt(req.body.width) : null;
    const height = req.body.height ? parseInt(req.body.height) : null;

    try {
      const { storagePath, publicUrl } = await uploadImage(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        category
      );

      const image = await storage.createImage({
        filename: req.file.originalname,
        storagePath,
        publicUrl,
        category,
        subcategory,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        width,
        height,
        uploadedBy: req.session.userId,
      });

      return res.json(image);
    } catch (error) {
      console.error("Image upload error:", error);
      return res.status(500).json({ message: "이미지 업로드 실패" });
    }
  });

  app.delete("/api/admin/images/:id", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user || !isAdmin(user.role)) {
      return res.status(403).json({ message: "Admin access required" });
    }

    const image = await storage.getImage(req.params.id);
    if (!image) {
      return res.status(404).json({ message: "이미지를 찾을 수 없습니다" });
    }

    try {
      await deleteImage(image.storagePath);
      await storage.deleteImage(req.params.id);
      return res.json({ message: "삭제 완료" });
    } catch (error) {
      console.error("Image delete error:", error);
      return res.status(500).json({ message: "이미지 삭제 실패" });
    }
  });

  app.get("/api/admin/subcategories", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user || !isAdmin(user.role)) {
      return res.status(403).json({ message: "Admin access required" });
    }

    const category = req.query.category as string;
    const subcategories = category 
      ? await storage.getSubcategoriesByCategory(category)
      : await storage.getAllSubcategories();
    return res.json(subcategories);
  });

  app.post("/api/admin/subcategories", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user || !isAdmin(user.role)) {
      return res.status(403).json({ message: "Admin access required" });
    }

    const { name, category } = req.body;
    if (!name || !category) {
      return res.status(400).json({ message: "이름과 카테고리가 필요합니다" });
    }

    if (!imageCategories.includes(category)) {
      return res.status(400).json({ message: "유효하지 않은 카테고리입니다" });
    }

    try {
      const subcategory = await storage.createSubcategory({ name, category });
      return res.json(subcategory);
    } catch (error) {
      console.error("Subcategory create error:", error);
      return res.status(500).json({ message: "세부 카테고리 생성 실패" });
    }
  });

  app.patch("/api/admin/subcategories/:id", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user || !isAdmin(user.role)) {
      return res.status(403).json({ message: "Admin access required" });
    }

    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ message: "이름이 필요합니다" });
    }

    const subcategory = await storage.updateSubcategory(req.params.id, name);
    if (!subcategory) {
      return res.status(404).json({ message: "세부 카테고리를 찾을 수 없습니다" });
    }

    return res.json(subcategory);
  });

  app.delete("/api/admin/subcategories/:id", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user || !isAdmin(user.role)) {
      return res.status(403).json({ message: "Admin access required" });
    }

    const deleted = await storage.deleteSubcategory(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "세부 카테고리를 찾을 수 없습니다" });
    }

    return res.json({ message: "삭제 완료" });
  });

  // Partner routes
  app.get("/api/admin/partners", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user || !isAdmin(user.role)) {
      return res.status(403).json({ message: "Admin access required" });
    }

    const partners = await storage.getAllPartners();
    const partnersWithProductCount = await Promise.all(
      partners.map(async (partner) => {
        const productCount = await storage.getPartnerProductCount(partner.id);
        const { password, ...partnerWithoutPassword } = partner;
        return { ...partnerWithoutPassword, productCount };
      })
    );
    return res.json(partnersWithProductCount);
  });

  app.get("/api/admin/partners/:id", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user || !isAdmin(user.role)) {
      return res.status(403).json({ message: "Admin access required" });
    }

    const partner = await storage.getPartner(req.params.id);
    if (!partner) {
      return res.status(404).json({ message: "협력업체를 찾을 수 없습니다" });
    }

    const partnerProducts = await storage.getPartnerProducts(partner.id);
    const { password, ...partnerWithoutPassword } = partner;
    return res.json({ ...partnerWithoutPassword, products: partnerProducts });
  });

  app.get("/api/auth/check-partner-username/:username", async (req, res) => {
    const existing = await storage.getPartnerByUsername(req.params.username);
    return res.json({ available: !existing });
  });

  app.post("/api/admin/partners", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user || !isAdmin(user.role)) {
      return res.status(403).json({ message: "Admin access required" });
    }

    try {
      const data = partnerFormSchema.extend({
        password: z.string().min(6, "비밀번호는 6자 이상이어야 합니다"),
        productIds: z.array(z.string()).optional(),
      }).parse(req.body);

      const existing = await storage.getPartnerByUsername(data.username);
      if (existing) {
        return res.status(400).json({ message: "이미 사용 중인 아이디입니다" });
      }

      const partner = await storage.createPartner({
        username: data.username,
        password: data.password,
        companyName: data.companyName,
        businessNumber: data.businessNumber,
        representative: data.representative,
        address: data.address,
        phone1: data.phone1,
        phone2: data.phone2 || undefined,
        shippingCompany: data.shippingCompany || undefined,
        status: data.status,
      });

      if (data.productIds && data.productIds.length > 0) {
        await storage.setPartnerProducts(partner.id, data.productIds);
      }

      const { password, ...partnerWithoutPassword } = partner;
      return res.status(201).json(partnerWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      throw error;
    }
  });

  app.patch("/api/admin/partners/:id", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user || !isAdmin(user.role)) {
      return res.status(403).json({ message: "Admin access required" });
    }

    const targetPartner = await storage.getPartner(req.params.id);
    if (!targetPartner) {
      return res.status(404).json({ message: "협력업체를 찾을 수 없습니다" });
    }

    try {
      const updateSchema = partnerFormSchema.partial().omit({ username: true }).extend({
        password: z.string().min(6, "비밀번호는 6자 이상이어야 합니다").optional().or(z.literal("")),
        productIds: z.array(z.string()).optional(),
      });
      const data = updateSchema.parse(req.body);

      const updateData: any = {};
      if (data.companyName) updateData.companyName = data.companyName;
      if (data.businessNumber) updateData.businessNumber = data.businessNumber;
      if (data.representative) updateData.representative = data.representative;
      if (data.address) updateData.address = data.address;
      if (data.phone1) updateData.phone1 = data.phone1;
      if (data.phone2 !== undefined) updateData.phone2 = data.phone2;
      if (data.shippingCompany !== undefined) updateData.shippingCompany = data.shippingCompany;
      if (data.status) updateData.status = data.status;
      if (data.password && data.password.length >= 6) updateData.password = data.password;

      const updatedPartner = await storage.updatePartner(req.params.id, updateData);

      if (data.productIds !== undefined) {
        await storage.setPartnerProducts(req.params.id, data.productIds);
      }

      if (!updatedPartner) {
        return res.status(404).json({ message: "협력업체를 찾을 수 없습니다" });
      }

      const { password, ...partnerWithoutPassword } = updatedPartner;
      return res.json(partnerWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      throw error;
    }
  });

  app.delete("/api/admin/partners/:id", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user || !isAdmin(user.role)) {
      return res.status(403).json({ message: "Admin access required" });
    }

    const deleted = await storage.deletePartner(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "협력업체를 찾을 수 없습니다" });
    }

    return res.json({ message: "삭제되었습니다" });
  });

  // Product routes
  app.get("/api/admin/products", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user || !isAdmin(user.role)) {
      return res.status(403).json({ message: "Admin access required" });
    }

    const products = await storage.getAllProducts();
    return res.json(products);
  });

  app.get("/api/admin/products/search", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user || !isAdmin(user.role)) {
      return res.status(403).json({ message: "Admin access required" });
    }

    const query = req.query.q as string || "";
    const products = await storage.searchProducts(query);
    return res.json(products);
  });

  app.get("/api/admin/shipping-companies", async (req, res) => {
    return res.json(shippingCompanies);
  });

  // Member routes
  app.get("/api/admin/members", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user || !isAdmin(user.role)) {
      return res.status(403).json({ message: "Admin access required" });
    }

    const allMembers = await storage.getAllMembers();
    const membersWithoutPasswords = allMembers.map(({ password, ...m }) => m);
    return res.json(membersWithoutPasswords);
  });

  app.get("/api/admin/members/stats", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user || !isAdmin(user.role)) {
      return res.status(403).json({ message: "Admin access required" });
    }

    const stats = await storage.getMemberStats();
    return res.json(stats);
  });

  app.get("/api/admin/members/:id", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user || !isAdmin(user.role)) {
      return res.status(403).json({ message: "Admin access required" });
    }

    const member = await storage.getMember(req.params.id);
    if (!member) {
      return res.status(404).json({ message: "회원을 찾을 수 없습니다" });
    }

    const { password, ...memberWithoutPassword } = member;
    const logs = await storage.getMemberLogs(member.id);
    return res.json({ ...memberWithoutPassword, logs });
  });

  app.get("/api/auth/check-member-username/:username", async (req, res) => {
    const existing = await storage.getMemberByUsername(req.params.username);
    return res.json({ available: !existing });
  });

  app.post("/api/admin/members", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user || !isAdmin(user.role)) {
      return res.status(403).json({ message: "Admin access required" });
    }

    try {
      const data = memberFormSchema.extend({
        password: z.string().min(6, "비밀번호는 6자 이상이어야 합니다"),
      }).parse(req.body);

      const existing = await storage.getMemberByUsername(data.username);
      if (existing) {
        return res.status(400).json({ message: "이미 사용 중인 아이디입니다" });
      }

      const member = await storage.createMember({
        username: data.username,
        password: data.password,
        companyName: data.companyName,
        businessNumber: data.businessNumber,
        representative: data.representative,
        phone: data.phone,
        businessAddress: data.businessAddress || undefined,
        managerName: data.managerName || undefined,
        managerPhone: data.managerPhone || undefined,
        email: data.email || undefined,
        grade: data.grade,
        status: data.status,
        memo: data.memo || undefined,
      });

      await storage.createMemberLog({
        memberId: member.id,
        changedBy: user.id,
        changeType: "생성",
        description: "회원 생성",
      });

      const { password, ...memberWithoutPassword } = member;
      return res.status(201).json(memberWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      throw error;
    }
  });

  app.patch("/api/admin/members/:id", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user || !isAdmin(user.role)) {
      return res.status(403).json({ message: "Admin access required" });
    }

    const targetMember = await storage.getMember(req.params.id);
    if (!targetMember) {
      return res.status(404).json({ message: "회원을 찾을 수 없습니다" });
    }

    try {
      const data = updateMemberSchema.parse(req.body);
      const updateData: any = {};
      const changes: string[] = [];
      
      if (data.grade && data.grade !== targetMember.grade) {
        updateData.grade = data.grade;
        changes.push(`등급: ${targetMember.grade} → ${data.grade}`);
      }
      if (data.representative) updateData.representative = data.representative;
      if (data.businessAddress !== undefined) updateData.businessAddress = data.businessAddress;
      if (data.phone) updateData.phone = data.phone;
      if (data.managerName !== undefined) updateData.managerName = data.managerName;
      if (data.managerPhone !== undefined) updateData.managerPhone = data.managerPhone;
      if (data.email !== undefined) updateData.email = data.email;
      if (data.status && data.status !== targetMember.status) {
        updateData.status = data.status;
        changes.push(`상태: ${targetMember.status} → ${data.status}`);
      }
      if (data.memo !== undefined) updateData.memo = data.memo;
      if (data.password && data.password.length >= 6) {
        updateData.password = data.password;
        changes.push("비밀번호 변경");
      }
      if (typeof data.deposit === "number" && data.deposit !== targetMember.deposit) {
        const diff = data.deposit - targetMember.deposit;
        updateData.deposit = data.deposit;
        changes.push(`예치금: ${diff > 0 ? '+' : ''}${diff.toLocaleString()}원`);
      }
      if (typeof data.point === "number" && data.point !== targetMember.point) {
        const diff = data.point - targetMember.point;
        updateData.point = data.point;
        changes.push(`포인트: ${diff > 0 ? '+' : ''}${diff.toLocaleString()}`);
      }

      const updatedMember = await storage.updateMember(req.params.id, updateData);
      
      if (changes.length > 0) {
        await storage.createMemberLog({
          memberId: req.params.id,
          changedBy: user.id,
          changeType: "수정",
          description: changes.join(", "),
        });
      }

      if (!updatedMember) {
        return res.status(404).json({ message: "회원을 찾을 수 없습니다" });
      }

      const { password, ...memberWithoutPassword } = updatedMember;
      return res.json(memberWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      throw error;
    }
  });

  app.post("/api/admin/members/bulk-update", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user || !isAdmin(user.role)) {
      return res.status(403).json({ message: "Admin access required" });
    }

    try {
      const data = bulkUpdateMemberSchema.parse(req.body);
      
      const updatedMembers = await storage.bulkUpdateMembers(data.memberIds, {
        grade: data.grade,
        depositAdjust: data.depositAdjust,
        pointAdjust: data.pointAdjust,
        memoAdd: data.memoAdd,
      });

      const changes: string[] = [];
      if (data.grade) changes.push(`등급: ${data.grade}`);
      if (data.depositAdjust) changes.push(`예치금 조정: ${data.depositAdjust > 0 ? '+' : ''}${data.depositAdjust.toLocaleString()}원`);
      if (data.pointAdjust) changes.push(`포인트 조정: ${data.pointAdjust > 0 ? '+' : ''}${data.pointAdjust.toLocaleString()}`);
      if (data.memoAdd) changes.push(`메모 추가`);

      for (const memberId of data.memberIds) {
        await storage.createMemberLog({
          memberId,
          changedBy: user.id,
          changeType: "일괄수정",
          description: changes.join(", "),
        });
      }

      const membersWithoutPasswords = updatedMembers.map(({ password, ...m }) => m);
      return res.json(membersWithoutPasswords);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      throw error;
    }
  });

  app.post("/api/admin/members/:id/approve", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user || !isAdmin(user.role)) {
      return res.status(403).json({ message: "Admin access required" });
    }

    const member = await storage.getMember(req.params.id);
    if (!member) {
      return res.status(404).json({ message: "회원을 찾을 수 없습니다" });
    }

    if (member.grade !== "PENDING") {
      return res.status(400).json({ message: "보류중인 회원만 승인할 수 있습니다" });
    }

    const updatedMember = await storage.approveMember(req.params.id, user.id);
    
    await storage.createMemberLog({
      memberId: req.params.id,
      changedBy: user.id,
      changeType: "승인",
      previousValue: "PENDING",
      newValue: "ASSOCIATE",
      description: "회원 승인 완료",
    });

    if (!updatedMember) {
      return res.status(500).json({ message: "승인 처리 실패" });
    }

    const { password, ...memberWithoutPassword } = updatedMember;
    return res.json(memberWithoutPassword);
  });

  app.post("/api/admin/members/:id/reset-password", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user || !isAdmin(user.role)) {
      return res.status(403).json({ message: "Admin access required" });
    }

    const member = await storage.getMember(req.params.id);
    if (!member) {
      return res.status(404).json({ message: "회원을 찾을 수 없습니다" });
    }

    const tempPassword = Math.random().toString(36).slice(-8);
    await storage.resetMemberPassword(req.params.id, tempPassword);
    
    await storage.createMemberLog({
      memberId: req.params.id,
      changedBy: user.id,
      changeType: "비밀번호 초기화",
      description: "임시 비밀번호로 초기화",
    });

    // TODO: 이메일 발송 기능 구현 (Resend 또는 SendGrid 연동 필요)
    // 이메일 내용:
    // - 수신자: member.email
    // - 제목: [Topsel] 비밀번호가 초기화되었습니다
    // - 본문: 
    //   안녕하세요, ${member.companyName}님.
    //   귀하의 비밀번호가 초기화되었습니다.
    //   임시 비밀번호: ${tempPassword}
    //   로그인 후 반드시 비밀번호를 변경해 주세요.
    // 
    // 구현 예시:
    // import { Resend } from 'resend';
    // const resend = new Resend(process.env.RESEND_API_KEY);
    // await resend.emails.send({
    //   from: 'noreply@yourdomain.com',
    //   to: member.email,
    //   subject: '[Topsel] 비밀번호가 초기화되었습니다',
    //   html: `<p>임시 비밀번호: ${tempPassword}</p><p>로그인 후 비밀번호를 변경해 주세요.</p>`
    // });

    return res.json({ tempPassword, email: member.email });
  });

  app.delete("/api/admin/members/:id", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user || !isAdmin(user.role)) {
      return res.status(403).json({ message: "Admin access required" });
    }

    const member = await storage.getMember(req.params.id);
    if (!member) {
      return res.status(404).json({ message: "회원을 찾을 수 없습니다" });
    }

    await storage.deleteMember(req.params.id);
    return res.json({ message: "삭제되었습니다" });
  });

  app.get("/api/admin/member-grades", async (req, res) => {
    return res.json(memberGrades);
  });

  // Category API endpoints
  app.get("/api/categories", async (req, res) => {
    const { level, parentId } = req.query;
    
    let cats;
    if (level) {
      cats = await storage.getCategoriesByLevel(level as string);
    } else if (parentId) {
      cats = await storage.getCategoriesByParent(parentId as string);
    } else {
      cats = await storage.getAllCategories();
    }
    
    const allCats = await storage.getAllCategories();
    const enriched = await Promise.all(cats.map(async (cat) => {
      const childCount = allCats.filter(c => c.parentId === cat.id).length;
      const productCount = await storage.getProductCountByCategory(cat.name, cat.level);
      const parent = cat.parentId ? allCats.find(c => c.id === cat.parentId) : null;
      const grandparent = parent?.parentId ? allCats.find(c => c.id === parent.parentId) : null;
      return {
        ...cat,
        childCount,
        productCount,
        parentName: parent?.name || null,
        grandparentName: grandparent?.name || null,
      };
    }));
    
    return res.json(enriched);
  });

  app.get("/api/categories/:id", async (req, res) => {
    const cat = await storage.getCategory(req.params.id);
    if (!cat) {
      return res.status(404).json({ message: "카테고리를 찾을 수 없습니다" });
    }
    return res.json(cat);
  });

  app.post("/api/categories", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    try {
      const data = categoryFormSchema.parse(req.body);
      const cat = await storage.createCategory(data);
      return res.json(cat);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      throw error;
    }
  });

  app.put("/api/categories/:id", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    try {
      const data = categoryFormSchema.partial().parse(req.body);
      const cat = await storage.updateCategory(req.params.id, data);
      if (!cat) {
        return res.status(404).json({ message: "카테고리를 찾을 수 없습니다" });
      }
      return res.json(cat);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      throw error;
    }
  });

  app.delete("/api/categories/:id", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const cat = await storage.getCategory(req.params.id);
    if (!cat) {
      return res.status(404).json({ message: "카테고리를 찾을 수 없습니다" });
    }
    
    const hasChildren = await storage.hasChildCategories(req.params.id);
    if (hasChildren) {
      return res.status(400).json({ message: "하위 분류가 있어 삭제할 수 없습니다" });
    }
    
    const productCount = await storage.getProductCountByCategory(cat.name, cat.level);
    if (productCount > 0) {
      return res.status(400).json({ message: `해당 카테고리에 ${productCount}개 상품이 있어 삭제할 수 없습니다` });
    }
    
    await storage.deleteCategory(req.params.id);
    return res.json({ message: "삭제되었습니다" });
  });

  // Product Registration API endpoints
  app.get("/api/product-registrations", async (req, res) => {
    const status = req.query.status as string || 'active';
    const prods = await storage.getAllProductRegistrations(status);
    return res.json(prods);
  });

  app.get("/api/product-registrations/template", async (req, res) => {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    const data = [
      ["대분류", "중분류", "소분류", "중량(수량)", "상품코드", "상품명"],
      ["과일", "사과", "부사", "5kg", "A001", "부사 5kg 한박스"],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "상품등록양식");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    res.setHeader("Content-Disposition", "attachment; filename=product_template.xlsx");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    return res.send(buffer);
  });

  app.get("/api/product-registrations/:id", async (req, res) => {
    const pr = await storage.getProductRegistration(req.params.id);
    if (!pr) {
      return res.status(404).json({ message: "상품을 찾을 수 없습니다" });
    }
    return res.json(pr);
  });

  app.post("/api/product-registrations", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    try {
      const data = productRegistrationFormSchema.parse(req.body);
      const existing = await storage.getProductRegistrationByCode(data.productCode);
      if (existing) {
        return res.status(400).json({ message: "이미 등록된 상품코드입니다" });
      }
      const pr = await storage.createProductRegistration(data);
      return res.json(pr);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      throw error;
    }
  });

  const excelUpload = multer({ storage: multer.memoryStorage() });
  app.post("/api/product-registrations/upload", excelUpload.single("file"), async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    if (!req.file) {
      return res.status(400).json({ message: "파일이 없습니다" });
    }
    
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
      
      const errors: { row: number; error: string }[] = [];
      const created: any[] = [];
      
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length < 6) continue;
        
        const [categoryLarge, categoryMedium, categorySmall, weight, productCode, productName] = row;
        
        if (!weight || !productCode || !productName) {
          errors.push({ row: i + 1, error: "필수값 누락 (중량, 상품코드, 상품명)" });
          continue;
        }
        
        if (!categoryLarge && !categoryMedium && !categorySmall) {
          errors.push({ row: i + 1, error: "카테고리 1개 이상 필수" });
          continue;
        }
        
        const existing = await storage.getProductRegistrationByCode(String(productCode));
        if (existing) {
          errors.push({ row: i + 1, error: `상품코드 중복: ${productCode}` });
          continue;
        }
        
        const pr = await storage.createProductRegistration({
          categoryLarge: categoryLarge ? String(categoryLarge) : null,
          categoryMedium: categoryMedium ? String(categoryMedium) : null,
          categorySmall: categorySmall ? String(categorySmall) : null,
          weight: String(weight),
          productCode: String(productCode),
          productName: String(productName),
        });
        created.push(pr);
      }
      
      return res.json({ created: created.length, errors });
    } catch (error) {
      return res.status(400).json({ message: "엑셀 파일 처리 중 오류가 발생했습니다" });
    }
  });

  const productUpdateSchema = productRegistrationFormSchema.partial();
  
  app.put("/api/product-registrations/:id", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    try {
      const validatedData = productUpdateSchema.parse(req.body);
      const pr = await storage.updateProductRegistration(req.params.id, validatedData);
      if (!pr) {
        return res.status(404).json({ message: "상품을 찾을 수 없습니다" });
      }
      return res.json(pr);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      throw error;
    }
  });

  app.put("/api/product-registrations/bulk", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const { ids, data } = req.body;
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ message: "상품 ID 목록이 필요합니다" });
    }
    const updated = await storage.bulkUpdateProductRegistrations(ids, data);
    return res.json({ updated: updated.length });
  });

  app.delete("/api/product-registrations/:id", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    await storage.deleteProductRegistration(req.params.id);
    return res.json({ message: "삭제되었습니다" });
  });

  app.delete("/api/product-registrations/bulk", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ message: "상품 ID 목록이 필요합니다" });
    }
    const deleted = await storage.bulkDeleteProductRegistrations(ids);
    return res.json({ deleted });
  });

  app.post("/api/product-registrations/suspend", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const { ids, reason } = req.body;
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ message: "상품 ID 목록이 필요합니다" });
    }
    const updated = await storage.suspendProductRegistrations(ids, reason || "");
    return res.json({ updated });
  });

  app.post("/api/product-registrations/resume", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ message: "상품 ID 목록이 필요합니다" });
    }
    const updated = await storage.resumeProductRegistrations(ids);
    return res.json({ updated });
  });

  app.post("/api/product-registrations/send-to-next-week", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ message: "상품 ID 목록이 필요합니다" });
    }
    
    const errors: { id: string; productCode: string; error: string }[] = [];
    
    for (const id of ids) {
      const pr = await storage.getProductRegistration(id);
      if (!pr) continue;
      
      if (!pr.startPrice || !pr.drivingPrice || !pr.topPrice) {
        errors.push({ id, productCode: pr.productCode, error: "공급가가 없습니다. 마진율을 입력해주세요." });
      }
    }
    
    if (errors.length > 0) {
      return res.status(400).json({ message: `상품코드 [${errors[0].productCode}]의 ${errors[0].error}`, errors });
    }
    
    return res.json({ message: `${ids.length}개 상품이 차주 예상공급가로 전송되었습니다.`, sent: ids.length });
  });

  return httpServer;
}
