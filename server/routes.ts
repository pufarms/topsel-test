import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import session from "express-session";
import { loginSchema, registerSchema, insertOrderSchema, insertAdminSchema, updateAdminSchema, userTiers, imageCategories, menuPermissions, partnerFormSchema, shippingCompanies, memberFormSchema, updateMemberSchema, bulkUpdateMemberSchema, memberGrades, categoryFormSchema, productRegistrationFormSchema, type Category, insertPageSchema, pageCategories, pageAccessLevels } from "@shared/schema";
import { z } from "zod";
import MemoryStore from "memorystore";
import multer from "multer";
import { uploadImage, deleteImage } from "./r2";

declare module "express-session" {
  interface SessionData {
    userId: string;
    userType: "user" | "member";
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

    // Check if it's a member session
    if (req.session.userType === "member") {
      const member = await storage.getMember(req.session.userId);
      if (!member) {
        req.session.destroy(() => {});
        return res.status(401).json({ message: "Member not found" });
      }
      const { password, ...memberWithoutPassword } = member;
      return res.json({ ...memberWithoutPassword, role: "member" });
    }

    // Default to user
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
      
      // First try to authenticate as admin user
      const user = await storage.validatePassword(data.username, data.password);
      if (user) {
        await storage.updateLastLogin(user.id);
        req.session.userId = user.id;
        req.session.userType = "user";

        const { password, ...userWithoutPassword } = user;
        return res.json(userWithoutPassword);
      }
      
      // If not found in users, try members table
      const member = await storage.validateMemberPassword(data.username, data.password);
      if (member) {
        // Check if member is approved and active
        if (member.status !== "활성") {
          return res.status(401).json({ message: "계정이 비활성화 상태입니다. 관리자에게 문의하세요." });
        }
        if (member.grade === "PENDING") {
          return res.status(401).json({ message: "승인 대기 중인 계정입니다. 관리자 승인 후 이용 가능합니다." });
        }
        
        await storage.updateMemberLastLogin(member.id);
        req.session.userId = member.id;
        req.session.userType = "member";

        const { password, ...memberWithoutPassword } = member;
        return res.json({ ...memberWithoutPassword, role: "member" });
      }
      
      return res.status(401).json({ message: "아이디 또는 비밀번호가 올바르지 않습니다" });
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

  // Member profile endpoints
  app.get("/api/member/profile", async (req, res) => {
    if (!req.session.userId || req.session.userType !== "member") {
      return res.status(401).json({ message: "회원 로그인이 필요합니다" });
    }

    const member = await storage.getMember(req.session.userId);
    if (!member) {
      return res.status(404).json({ message: "회원 정보를 찾을 수 없습니다" });
    }

    const { password, ...memberWithoutPassword } = member;
    return res.json(memberWithoutPassword);
  });

  app.patch("/api/member/profile", async (req, res) => {
    if (!req.session.userId || req.session.userType !== "member") {
      return res.status(401).json({ message: "회원 로그인이 필요합니다" });
    }

    const member = await storage.getMember(req.session.userId);
    if (!member) {
      return res.status(404).json({ message: "회원 정보를 찾을 수 없습니다" });
    }

    try {
      const allowedFields = z.object({
        representative: z.string().min(1).optional(),
        businessAddress: z.string().optional(),
        phone: z.string().min(1).optional(),
        managerName: z.string().optional(),
        managerPhone: z.string().optional(),
        email: z.string().email().optional().or(z.literal("")),
        password: z.string().min(6).optional().or(z.literal("")),
      });

      const data = allowedFields.parse(req.body);
      const updateData: any = {};

      if (data.representative) updateData.representative = data.representative;
      if (data.businessAddress !== undefined) updateData.businessAddress = data.businessAddress;
      if (data.phone) updateData.phone = data.phone;
      if (data.managerName !== undefined) updateData.managerName = data.managerName;
      if (data.managerPhone !== undefined) updateData.managerPhone = data.managerPhone;
      if (data.email !== undefined) updateData.email = data.email;
      if (data.password && data.password.length >= 6) updateData.password = data.password;

      const updatedMember = await storage.updateMember(req.session.userId, updateData);
      if (!updatedMember) {
        return res.status(500).json({ message: "회원 정보 수정에 실패했습니다" });
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
        await storage.updatePartnerProducts(partner.id, data.productIds);
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
        await storage.updatePartnerProducts(req.params.id, data.productIds);
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

  // 카테고리 엑셀 일괄 등록
  app.post("/api/categories/bulk", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    try {
      const { categories } = req.body as { categories: Array<{ large: string; medium?: string; small?: string }> };
      if (!categories || !Array.isArray(categories)) {
        return res.status(400).json({ message: "카테고리 데이터가 필요합니다" });
      }

      const existingCategories = await storage.getAllCategories();
      const largeMap = new Map<string, string>();
      const mediumMap = new Map<string, string>();
      
      existingCategories.filter((c: Category) => c.level === "large").forEach((c: Category) => largeMap.set(c.name, c.id));
      existingCategories.filter((c: Category) => c.level === "medium").forEach((c: Category) => mediumMap.set(`${c.parentId}:${c.name}`, c.id));

      let created = 0;
      let skipped = 0;

      for (const row of categories) {
        // 대분류 처리
        if (row.large && !largeMap.has(row.large)) {
          const newLarge = await storage.createCategory({ name: row.large, level: "large", parentId: null });
          largeMap.set(row.large, newLarge.id);
          created++;
        }

        // 중분류 처리
        if (row.medium && row.large) {
          const parentId = largeMap.get(row.large);
          if (parentId) {
            const mediumKey = `${parentId}:${row.medium}`;
            if (!mediumMap.has(mediumKey)) {
              const newMedium = await storage.createCategory({ name: row.medium, level: "medium", parentId });
              mediumMap.set(mediumKey, newMedium.id);
              created++;
            }
          }
        }

        // 소분류 처리
        if (row.small && row.medium && row.large) {
          const largeId = largeMap.get(row.large);
          if (largeId) {
            const mediumKey = `${largeId}:${row.medium}`;
            const mediumId = mediumMap.get(mediumKey);
            if (mediumId) {
              // Check if small category already exists
              const exists = existingCategories.some((c: Category) => c.level === "small" && c.parentId === mediumId && c.name === row.small);
              if (!exists) {
                await storage.createCategory({ name: row.small, level: "small", parentId: mediumId });
                created++;
              } else {
                skipped++;
              }
            }
          }
        }
      }

      return res.json({ created, skipped, message: `${created}개 카테고리가 등록되었습니다. ${skipped}개 중복 건너뜀.` });
    } catch (error: any) {
      console.error("Bulk category upload error:", error);
      return res.status(500).json({ message: error.message || "일괄 등록에 실패했습니다" });
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

  // Check if product exists in product_registrations by code
  app.get("/api/product-registrations/check-by-code/:productCode", async (req, res) => {
    const pr = await storage.getProductRegistrationByCode(req.params.productCode);
    return res.json({ exists: !!pr, product: pr || null });
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
  
  // IMPORTANT: Bulk update must be registered BEFORE single update 
  // to prevent Express from matching "bulk" as :id parameter
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

  app.put("/api/product-registrations/:id", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    try {
      const validatedData = productUpdateSchema.parse(req.body);
      
      // Check for duplicate product code if it's being changed
      if (validatedData.productCode) {
        const existing = await storage.getProductRegistrationByCode(validatedData.productCode);
        if (existing && existing.id !== req.params.id) {
          return res.status(400).json({ message: `상품코드 중복: ${validatedData.productCode} - 이미 등록된 상품코드입니다` });
        }
      }
      
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

  // IMPORTANT: Bulk delete must be registered BEFORE single delete 
  // to prevent Express from matching "bulk" as :id parameter
  app.delete("/api/product-registrations/bulk", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ message: "상품 ID 목록이 필요합니다" });
    }
    
    // Delete related product mappings before deleting registrations
    for (const id of ids) {
      const registration = await storage.getProductRegistration(id);
      if (registration) {
        await storage.deleteProductMapping(registration.productCode);
      }
    }
    
    const deleted = await storage.bulkDeleteProductRegistrations(ids);
    return res.json({ deleted, message: "삭제되었습니다" });
  });

  app.delete("/api/product-registrations/:id", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    // Get the product code before deletion to clean up related mappings
    const registration = await storage.getProductRegistration(req.params.id);
    if (registration) {
      // Delete related product mapping if exists
      await storage.deleteProductMapping(registration.productCode);
    }
    
    await storage.deleteProductRegistration(req.params.id);
    return res.json({ message: "삭제되었습니다" });
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

  // Check new products before sending (미리 확인용)
  app.post("/api/product-registrations/check-new-products", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ message: "상품 ID 목록이 필요합니다" });
    }
    
    const newProducts: { productCode: string; productName: string }[] = [];
    const existingProducts: { productCode: string; productName: string }[] = [];
    const invalidProducts: { productCode: string; productName: string }[] = [];
    
    for (const id of ids) {
      const pr = await storage.getProductRegistration(id);
      if (!pr) continue;
      
      // Check if prices are set
      if (!pr.startPrice || !pr.drivingPrice || !pr.topPrice) {
        invalidProducts.push({ productCode: pr.productCode, productName: pr.productName });
        continue;
      }
      
      const existing = await storage.getNextWeekProductByCode(pr.productCode);
      if (existing) {
        existingProducts.push({ productCode: pr.productCode, productName: pr.productName });
      } else {
        newProducts.push({ productCode: pr.productCode, productName: pr.productName });
      }
    }
    
    return res.json({ newProducts, existingProducts, invalidProducts });
  });

  // Check mapping status for products before sending to next week
  app.post("/api/product-registrations/check-mapping", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const { productCodes } = req.body;
    if (!productCodes || !Array.isArray(productCodes)) {
      return res.status(400).json({ message: "상품코드 목록이 필요합니다" });
    }
    
    const unmappedProducts: { productCode: string; productName: string; categoryLarge?: string | null; categoryMedium?: string | null; categorySmall?: string | null }[] = [];
    const mappedProducts: { productCode: string; productName: string }[] = [];
    
    // Get all registrations once for efficiency
    const registrations = await storage.getAllProductRegistrations();
    
    for (const productCode of productCodes) {
      const mapping = await storage.getProductMappingByCode(productCode);
      
      // Find product from product_registrations
      const registration = registrations.find(r => r.productCode === productCode);
      const productName = registration?.productName || productCode;
      
      if (!mapping || mapping.mappingStatus !== "complete") {
        unmappedProducts.push({ 
          productCode, 
          productName,
          categoryLarge: registration?.categoryLarge || null,
          categoryMedium: registration?.categoryMedium || null,
          categorySmall: registration?.categorySmall || null,
        });
      } else {
        mappedProducts.push({ productCode, productName });
      }
    }
    
    return res.json({
      allMapped: unmappedProducts.length === 0,
      unmappedProducts,
      mappedProducts,
      totalChecked: productCodes.length,
    });
  });

  app.post("/api/product-registrations/send-to-next-week", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ message: "상품 ID 목록이 필요합니다" });
    }
    
    const invalidProducts: { productCode: string; productName: string }[] = [];
    const validProducts: any[] = [];
    
    // Validate all products first
    for (const id of ids) {
      const pr = await storage.getProductRegistration(id);
      if (!pr) continue;
      
      if (!pr.startPrice || !pr.drivingPrice || !pr.topPrice) {
        invalidProducts.push({ productCode: pr.productCode, productName: pr.productName });
      } else {
        validProducts.push(pr);
      }
    }
    
    if (invalidProducts.length > 0) {
      return res.status(400).json({ 
        success: false,
        error: "MISSING_PRICE",
        message: `상품코드 [${invalidProducts[0].productCode}]의 공급가가 없습니다. 마진율을 입력해주세요.`,
        data: { invalidProducts }
      });
    }
    
    // Send to next_week_products
    let created = 0;
    let updated = 0;
    
    for (const pr of validProducts) {
      const existing = await storage.getNextWeekProductByCode(pr.productCode);
      
      const productData = {
        productCode: pr.productCode,
        productName: pr.productName,
        categoryLarge: pr.categoryLarge,
        categoryMedium: pr.categoryMedium,
        categorySmall: pr.categorySmall,
        weight: pr.weight,
        startPrice: pr.startPrice!,
        drivingPrice: pr.drivingPrice!,
        topPrice: pr.topPrice!,
        supplyStatus: "supply" as const,
      };
      
      if (existing) {
        await storage.updateNextWeekProduct(existing.id, productData);
        updated++;
      } else {
        await storage.createNextWeekProduct(productData);
        created++;
      }
    }
    
    return res.json({ 
      success: true,
      message: `${validProducts.length}개 상품이 차주 예상공급가로 전송되었습니다.`,
      data: { total: validProducts.length, updated, created }
    });
  });

  // ========================================
  // 차주 예상공급가 상품 API (Next Week Products)
  // ========================================
  
  app.get("/api/next-week-products", async (req, res) => {
    const products = await storage.getAllNextWeekProducts();
    return res.json(products);
  });

  app.post("/api/next-week-products/check-new", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ message: "상품 ID 목록이 필요합니다" });
    }
    
    const newProducts: { productCode: string; productName: string }[] = [];
    const existingProducts: { productCode: string; productName: string }[] = [];
    
    for (const id of ids) {
      const product = await storage.getNextWeekProduct(id);
      if (product) {
        const existing = await storage.getCurrentProductByCode(product.productCode);
        if (existing) {
          existingProducts.push({ productCode: product.productCode, productName: product.productName });
        } else {
          newProducts.push({ productCode: product.productCode, productName: product.productName });
        }
      }
    }
    
    return res.json({ newProducts, existingProducts });
  });

  app.post("/api/next-week-products/apply-current", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ message: "상품 ID 목록이 필요합니다" });
    }
    
    let created = 0;
    let updated = 0;
    
    for (const id of ids) {
      const product = await storage.getNextWeekProduct(id);
      if (product) {
        const existing = await storage.getCurrentProductByCode(product.productCode);
        const productData = {
          productCode: product.productCode,
          productName: product.productName,
          categoryLarge: product.categoryLarge,
          categoryMedium: product.categoryMedium,
          categorySmall: product.categorySmall,
          weight: product.weight,
          startPrice: product.startPrice,
          drivingPrice: product.drivingPrice,
          topPrice: product.topPrice,
          supplyStatus: "supply" as const,
          appliedAt: new Date(),
        };
        
        if (existing) {
          await storage.updateCurrentProduct(existing.id, productData);
          updated++;
        } else {
          await storage.createCurrentProduct(productData);
          created++;
        }
      }
    }
    
    return res.json({ 
      success: true,
      message: `${ids.length}개 상품이 현재 공급가로 적용되었습니다.`,
      data: { total: ids.length, updated, created }
    });
  });

  app.post("/api/next-week-products/apply-current-all", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }
    
    const allProducts = await storage.getAllNextWeekProducts();
    let created = 0;
    let updated = 0;
    
    for (const product of allProducts) {
      const existing = await storage.getCurrentProductByCode(product.productCode);
      const productData = {
        productCode: product.productCode,
        productName: product.productName,
        categoryLarge: product.categoryLarge,
        categoryMedium: product.categoryMedium,
        categorySmall: product.categorySmall,
        weight: product.weight,
        startPrice: product.startPrice,
        drivingPrice: product.drivingPrice,
        topPrice: product.topPrice,
        supplyStatus: "supply" as const,
        appliedAt: new Date(),
      };
      
      if (existing) {
        await storage.updateCurrentProduct(existing.id, productData);
        updated++;
      } else {
        await storage.createCurrentProduct(productData);
        created++;
      }
    }
    
    return res.json({ 
      success: true,
      message: `${allProducts.length}개 상품이 현재 공급가로 적용되었습니다.`,
      data: { total: allProducts.length, updated, created }
    });
  });

  // 차주 예상공급가 상품 일괄 삭제
  app.delete("/api/next-week-products/bulk", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "삭제할 상품 ID 목록이 필요합니다" });
    }
    
    const deleted = await storage.bulkDeleteNextWeekProducts(ids);
    return res.json({ 
      success: true,
      message: `${deleted}개 상품이 삭제되었습니다.`,
      data: { deleted }
    });
  });

  // ========================================
  // 현재 공급가 상품 API (Current Products)
  // ========================================
  
  app.get("/api/current-products", async (req, res) => {
    const status = req.query.status as string;
    if (status) {
      const products = await storage.getCurrentProductsByStatus(status);
      return res.json(products);
    }
    const products = await storage.getAllCurrentProducts();
    return res.json(products);
  });

  app.post("/api/current-products/suspend", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }
    const { ids, reason } = req.body;
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ message: "상품 ID 목록이 필요합니다" });
    }
    const updated = await storage.suspendCurrentProducts(ids, reason || "");
    return res.json({ 
      success: true,
      message: `${updated}개 상품이 공급 중지되었습니다.`,
      updated 
    });
  });

  // 현재 공급가 상품 일괄 삭제
  app.delete("/api/current-products/bulk", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "삭제할 상품 ID 목록이 필요합니다" });
    }
    
    const deleted = await storage.bulkDeleteCurrentProducts(ids);
    return res.json({ 
      success: true,
      message: `${deleted}개 상품이 삭제되었습니다.`,
      data: { deleted }
    });
  });

  // ========================================
  // 공급 중지 상품 API (Suspended Products)
  // ========================================
  
  app.get("/api/suspended-products", async (req, res) => {
    const products = await storage.getCurrentProductsByStatus("suspended");
    return res.json(products);
  });

  app.post("/api/suspended-products/resume", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ message: "상품 ID 목록이 필요합니다" });
    }
    const updated = await storage.resumeCurrentProducts(ids);
    return res.json({ 
      success: true,
      message: `${updated}개 상품의 공급이 재개되었습니다.`,
      updated 
    });
  });

  app.delete("/api/suspended-products/bulk", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ message: "상품 ID 목록이 필요합니다" });
    }
    const deleted = await storage.bulkDeleteCurrentProducts(ids);
    return res.json({ 
      success: true,
      message: `${deleted}개 상품이 삭제되었습니다.`,
      deleted 
    });
  });

  app.delete("/api/suspended-products/:id", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }
    const deleted = await storage.deleteCurrentProduct(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "상품을 찾을 수 없습니다" });
    }
    return res.json({ 
      success: true,
      message: "상품이 삭제되었습니다."
    });
  });

  // ========================================
  // 재료 대분류 API (Material Categories Large)
  // ========================================

  app.get("/api/material-categories/large", async (req, res) => {
    const categories = await storage.getAllMaterialCategoriesLarge();
    return res.json(categories);
  });

  app.post("/api/material-categories/large", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }
    const { name, sortOrder } = req.body;
    if (!name) {
      return res.status(400).json({ message: "대분류명을 입력해주세요" });
    }
    const existing = await storage.getMaterialCategoryLargeByName(name);
    if (existing) {
      return res.status(400).json({ message: "이미 존재하는 대분류명입니다" });
    }
    const category = await storage.createMaterialCategoryLarge({ name, sortOrder: sortOrder || 0 });
    return res.json(category);
  });

  app.put("/api/material-categories/large/:id", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }
    const { name, sortOrder } = req.body;
    const updated = await storage.updateMaterialCategoryLarge(req.params.id, { name, sortOrder });
    if (!updated) {
      return res.status(404).json({ message: "대분류를 찾을 수 없습니다" });
    }
    return res.json(updated);
  });

  app.delete("/api/material-categories/large/:id", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }
    const mediumCategories = await storage.getMaterialCategoriesMediumByLarge(req.params.id);
    if (mediumCategories.length > 0) {
      return res.status(400).json({ message: "하위 중분류가 존재합니다. 먼저 중분류를 삭제해주세요." });
    }
    const deleted = await storage.deleteMaterialCategoryLarge(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "대분류를 찾을 수 없습니다" });
    }
    return res.json({ success: true, message: "대분류가 삭제되었습니다." });
  });

  // ========================================
  // 재료 중분류 API (Material Categories Medium)
  // ========================================

  app.get("/api/material-categories/medium", async (req, res) => {
    const { largeCategoryId } = req.query;
    if (largeCategoryId && typeof largeCategoryId === "string") {
      const categories = await storage.getMaterialCategoriesMediumByLarge(largeCategoryId);
      return res.json(categories);
    }
    const categories = await storage.getAllMaterialCategoriesMedium();
    return res.json(categories);
  });

  app.post("/api/material-categories/medium", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }
    const { largeCategoryId, name, sortOrder } = req.body;
    if (!largeCategoryId || !name) {
      return res.status(400).json({ message: "대분류와 중분류명을 입력해주세요" });
    }
    const existing = await storage.getMaterialCategoryMediumByName(largeCategoryId, name);
    if (existing) {
      return res.status(400).json({ message: "동일한 대분류에 이미 존재하는 중분류명입니다" });
    }
    const category = await storage.createMaterialCategoryMedium({ largeCategoryId, name, sortOrder: sortOrder || 0 });
    return res.json(category);
  });

  app.put("/api/material-categories/medium/:id", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }
    const { name, sortOrder } = req.body;
    const updated = await storage.updateMaterialCategoryMedium(req.params.id, { name, sortOrder });
    if (!updated) {
      return res.status(404).json({ message: "중분류를 찾을 수 없습니다" });
    }
    return res.json(updated);
  });

  app.delete("/api/material-categories/medium/:id", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }
    const materials = await storage.getMaterialsByCategory(undefined, req.params.id);
    if (materials.length > 0) {
      return res.status(400).json({ message: "해당 중분류에 재료가 존재합니다. 먼저 재료를 삭제해주세요." });
    }
    const deleted = await storage.deleteMaterialCategoryMedium(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "중분류를 찾을 수 없습니다" });
    }
    return res.json({ success: true, message: "중분류가 삭제되었습니다." });
  });

  // ========================================
  // 재료 소분류 API (Material Small Categories)
  // ========================================

  app.get("/api/material-categories/small", async (req, res) => {
    const { mediumCategoryId } = req.query;
    if (mediumCategoryId && typeof mediumCategoryId === "string") {
      const categories = await storage.getMaterialCategoriesSmallByMedium(mediumCategoryId);
      return res.json(categories);
    }
    const categories = await storage.getAllMaterialCategoriesSmall();
    return res.json(categories);
  });

  app.post("/api/material-categories/small", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }
    const { mediumCategoryId, name, sortOrder } = req.body;
    if (!mediumCategoryId || !name) {
      return res.status(400).json({ message: "중분류와 소분류명을 입력해주세요" });
    }
    const existing = await storage.getMaterialCategorySmallByName(mediumCategoryId, name);
    if (existing) {
      return res.status(400).json({ message: "동일한 중분류에 이미 존재하는 소분류명입니다" });
    }
    const category = await storage.createMaterialCategorySmall({ mediumCategoryId, name, sortOrder: sortOrder || 0 });
    return res.json(category);
  });

  app.put("/api/material-categories/small/:id", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }
    const { name, sortOrder } = req.body;
    const updated = await storage.updateMaterialCategorySmall(req.params.id, { name, sortOrder });
    if (!updated) {
      return res.status(404).json({ message: "소분류를 찾을 수 없습니다" });
    }
    return res.json(updated);
  });

  app.delete("/api/material-categories/small/:id", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }
    const materials = await storage.getMaterialsBySmallCategory(req.params.id);
    if (materials.length > 0) {
      return res.status(400).json({ message: "해당 소분류에 재료가 존재합니다. 먼저 재료를 삭제해주세요." });
    }
    const deleted = await storage.deleteMaterialCategorySmall(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "소분류를 찾을 수 없습니다" });
    }
    return res.json({ success: true, message: "소분류가 삭제되었습니다." });
  });

  // ========================================
  // 재료 API (Materials)
  // ========================================

  app.get("/api/materials", async (req, res) => {
    const { largeCategoryId, mediumCategoryId } = req.query;
    const materials = await storage.getMaterialsByCategory(
      largeCategoryId as string | undefined,
      mediumCategoryId as string | undefined
    );
    return res.json(materials);
  });

  app.get("/api/materials/next-code/:type", async (req, res) => {
    const code = await storage.getNextMaterialCode(req.params.type);
    return res.json({ code });
  });

  app.post("/api/materials", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }
    const { materialType, largeCategoryId, mediumCategoryId, smallCategoryId, materialCode, materialName, currentStock } = req.body;
    if (!materialType || !largeCategoryId || !mediumCategoryId || !materialName) {
      return res.status(400).json({ message: "필수 필드를 입력해주세요" });
    }
    let code = materialCode;
    if (!code) {
      code = await storage.getNextMaterialCode(materialType);
    }
    const existingCode = await storage.getMaterialByCode(code);
    if (existingCode) {
      return res.status(400).json({ message: `이미 존재하는 재료코드입니다: ${code}` });
    }
    const material = await storage.createMaterial({
      materialType,
      largeCategoryId,
      mediumCategoryId,
      smallCategoryId: smallCategoryId || null,
      materialCode: code,
      materialName,
      currentStock: currentStock || 0,
    });
    return res.json(material);
  });

  app.put("/api/materials/:id", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }
    const { materialType, largeCategoryId, mediumCategoryId, smallCategoryId, materialName } = req.body;
    const updated = await storage.updateMaterial(req.params.id, {
      materialType,
      largeCategoryId,
      mediumCategoryId,
      smallCategoryId: smallCategoryId || null,
      materialName,
    });
    if (!updated) {
      return res.status(404).json({ message: "재료를 찾을 수 없습니다" });
    }
    return res.json(updated);
  });

  app.patch("/api/materials/:id/stock", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }
    const { adjustment, reason } = req.body;
    if (typeof adjustment !== "number") {
      return res.status(400).json({ message: "재고 조정량이 필요합니다" });
    }
    const material = await storage.getMaterial(req.params.id);
    if (!material) {
      return res.status(404).json({ message: "재료를 찾을 수 없습니다" });
    }
    const beforeStock = material.currentStock;
    const newStock = beforeStock + adjustment;
    const updated = await storage.updateMaterial(req.params.id, { currentStock: newStock });
    
    await storage.createStockHistory({
      stockType: "material",
      actionType: adjustment > 0 ? "in" : adjustment < 0 ? "out" : "adjust",
      itemCode: material.materialCode,
      itemName: material.materialName,
      quantity: adjustment,
      beforeStock,
      afterStock: newStock,
      reason: reason || (adjustment > 0 ? "입고" : adjustment < 0 ? "출고" : "조정"),
      adminId: user.id,
      source: "manual",
    });
    
    return res.json(updated);
  });

  app.delete("/api/materials/bulk", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "삭제할 재료 ID 목록이 필요합니다" });
    }
    const deleted = await storage.bulkDeleteMaterials(ids);
    return res.json({ success: true, message: `${deleted}개 재료가 삭제되었습니다.`, deleted });
  });

  app.delete("/api/materials/:id", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }
    const deleted = await storage.deleteMaterial(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "재료를 찾을 수 없습니다" });
    }
    return res.json({ success: true, message: "재료가 삭제되었습니다." });
  });

  // 재료 양식 다운로드 (엑셀 형식)
  app.get("/api/materials/template", async (req, res) => {
    try {
      const XLSX = await import("xlsx");
      
      const headers = ["재료타입", "대분류", "중분류", "소분류", "재료코드", "재료명", "초기재고"];
      const sampleData = [
        ["원재료", "사과", "부사", "고급", "R001", "부사 정품 4다이(원물)", 0],
        ["원재료", "사과", "부사", "", "R002", "부사 상2번(원물)", 0],
        ["반재료", "사과", "부사", "일반", "S001", "부사 상2번(선별)", 0],
        ["부재료", "부재료", "박스", "", "B001", "3kg 선물박스", 0],
      ];
      
      const wsData = [headers, ...sampleData];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      
      ws["!cols"] = [
        { wch: 10 },
        { wch: 12 },
        { wch: 12 },
        { wch: 10 },
        { wch: 10 },
        { wch: 30 },
        { wch: 10 },
      ];
      
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "재료등록");
      
      const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=material_template.xlsx");
      return res.send(buffer);
    } catch (error) {
      return res.status(500).json({ message: "템플릿 생성 중 오류가 발생했습니다" });
    }
  });

  // 재료 엑셀 일괄 등록
  const materialExcelUpload = multer({ storage: multer.memoryStorage() });
  app.post("/api/materials/upload", materialExcelUpload.single("file"), async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
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
      let created = 0;

      const materialTypeMap: Record<string, string> = {
        "원재료": "raw",
        "반재료": "semi",
        "부재료": "sub",
      };

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length < 6) continue;
        
        const [재료타입, 대분류, 중분류, 소분류, 재료코드, 재료명, 초기재고] = row;
        
        if (!재료타입 || !대분류 || !중분류 || !재료명) {
          errors.push({ row: i + 1, error: "필수값 누락 (재료타입, 대분류, 중분류, 재료명)" });
          continue;
        }

        const materialType = materialTypeMap[String(재료타입)];
        if (!materialType) {
          errors.push({ row: i + 1, error: `재료타입이 올바르지 않습니다: ${재료타입} (원재료/반재료/부재료 중 선택)` });
          continue;
        }

        if (재료코드) {
          const existing = await storage.getMaterialByCode(String(재료코드));
          if (existing) {
            errors.push({ row: i + 1, error: `재료코드 중복: ${재료코드}` });
            continue;
          }
        }

        // 대분류 확인 - 미리 설정된 카테고리만 허용
        const largeCategory = await storage.getMaterialCategoryLargeByName(String(대분류));
        if (!largeCategory) {
          errors.push({ row: i + 1, error: `대분류 카테고리 없음: "${대분류}" (미리 등록된 카테고리만 사용 가능)` });
          continue;
        }

        // 중분류 확인 - 해당 대분류 하위에 있어야 함
        const mediumCategory = await storage.getMaterialCategoryMediumByName(largeCategory.id, String(중분류));
        if (!mediumCategory) {
          // 다른 대분류 아래에 같은 이름의 중분류가 있는지 확인
          const allMediumCategories = await storage.getAllMaterialCategoriesMedium();
          const existsElsewhere = allMediumCategories.find(m => m.name === String(중분류));
          if (existsElsewhere) {
            errors.push({ row: i + 1, error: `카테고리 불일치: 중분류 "${중분류}"가 대분류 "${대분류}" 하위에 없습니다` });
          } else {
            errors.push({ row: i + 1, error: `중분류 카테고리 없음: "${중분류}" (미리 등록된 카테고리만 사용 가능)` });
          }
          continue;
        }

        // 소분류 확인 (선택사항) - 입력된 경우 해당 중분류 하위에 있어야 함
        let smallCategoryId: string | null = null;
        if (소분류 && String(소분류).trim()) {
          const smallCategory = await storage.getMaterialCategorySmallByName(mediumCategory.id, String(소분류));
          if (!smallCategory) {
            // 다른 중분류 아래에 같은 이름의 소분류가 있는지 확인
            const allSmallCategories = await storage.getAllMaterialCategoriesSmall();
            const existsElsewhere = allSmallCategories.find(s => s.name === String(소분류));
            if (existsElsewhere) {
              errors.push({ row: i + 1, error: `카테고리 불일치: 소분류 "${소분류}"가 중분류 "${중분류}" 하위에 없습니다` });
            } else {
              errors.push({ row: i + 1, error: `소분류 카테고리 없음: "${소분류}" (미리 등록된 카테고리만 사용 가능)` });
            }
            continue;
          }
          smallCategoryId = smallCategory.id;
        }

        const code = 재료코드 ? String(재료코드) : await storage.getNextMaterialCode(materialType);
        
        await storage.createMaterial({
          materialType,
          largeCategoryId: largeCategory.id,
          mediumCategoryId: mediumCategory.id,
          smallCategoryId,
          materialCode: code,
          materialName: String(재료명),
          currentStock: parseFloat(String(초기재고 || 0)) || 0,
        });
        created++;
      }

      return res.json({
        success: true,
        message: `${created}개 재료가 등록되었습니다.`,
        created,
        errors,
      });
    } catch (error) {
      return res.status(400).json({ message: "엑셀 파일 처리 중 오류가 발생했습니다" });
    }
  });

  // =====================================================
  // Product Mapping API (상품 매핑)
  // =====================================================

  // 상품 매핑 목록 조회
  app.get("/api/product-mappings", async (req, res) => {
    const mappings = await storage.getAllProductMappings();
    const result = await Promise.all(mappings.map(async (m) => {
      const materialMappings = await storage.getProductMaterialMappings(m.productCode);
      return { ...m, materials: materialMappings };
    }));
    return res.json(result);
  });

  // 상품등록에서 가져올 수 있는 상품 목록 (이미 매핑된 상품 제외)
  app.get("/api/product-mappings/available-products", async (req, res) => {
    const productRegistrations = await storage.getAllProductRegistrations("active");
    const existingMappings = await storage.getAllProductMappings();
    const existingCodes = new Set(existingMappings.map(m => m.productCode));
    
    const availableProducts = productRegistrations.filter(p => !existingCodes.has(p.productCode));
    return res.json(availableProducts.map(p => ({
      productCode: p.productCode,
      productName: p.productName,
      categoryLarge: p.categoryLarge,
      categoryMedium: p.categoryMedium,
      categorySmall: p.categorySmall,
    })));
  });

  // 상품 매핑 엑셀 양식 다운로드
  app.get("/api/product-mappings/template", async (req, res) => {
    const XLSX = await import("xlsx");
    // 2행 헤더 구조 (샘플 양식과 동일)
    const headerRow1 = ["대분류", "중분류", "소분류", "판매상품코드", "판매상품명", "원재료 구성내역", null, null, null, null, null, null, null, "사용유무"];
    const headerRow2 = [null, null, null, null, null, "원재료품목코드1", "수량", "원재료품목코드2", "수량", "원재료품목코드3", "수량", "원재료품목코드4", "수량", null];
    const sampleData = [
      ["과일", "사과", "부사", "S00001", "판매상품1", "APB001", 1, "APS001", 2, null, null, null, null, "Y"],
      ["과일", "사과", "부사", "S00002", "판매상품2", "APB002", 3, null, null, null, null, null, null, "Y"],
      ["과일", "사과", "부사", "S00003", "판매상품3", null, null, null, null, null, null, null, null, "N"],
    ];
    const ws = XLSX.utils.aoa_to_sheet([headerRow1, headerRow2, ...sampleData]);
    // 셀 병합 설정 (원재료 구성내역 헤더)
    ws["!merges"] = [
      { s: { r: 0, c: 5 }, e: { r: 0, c: 12 } }, // 원재료 구성내역 병합
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "상품매핑");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=product_mapping_template.xlsx");
    return res.send(buffer);
  });

  // 상품 매핑 상세 조회
  app.get("/api/product-mappings/:productCode", async (req, res) => {
    const { productCode } = req.params;
    const mapping = await storage.getProductMappingByCode(productCode);
    if (!mapping) {
      return res.status(404).json({ message: "상품 매핑을 찾을 수 없습니다" });
    }
    const materials = await storage.getProductMaterialMappings(productCode);
    return res.json({ ...mapping, materials });
  });

  // 상품 추가 (단일)
  app.post("/api/product-mappings", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }
    const { productCode, productName, categoryLarge, categoryMedium, categorySmall, usageStatus } = req.body;
    if (!productCode || !productName) {
      return res.status(400).json({ message: "상품코드와 상품명은 필수입니다" });
    }
    
    // 상품등록(공급가계산) 연계 체크 - 등록되지 않은 상품은 매핑 불가
    const registration = await storage.getProductRegistrationByCode(productCode);
    if (!registration) {
      return res.status(400).json({ message: "상품등록(공급가계산)에 등록되지 않은 상품입니다. 상품등록 후 매핑이 가능합니다." });
    }
    
    const existing = await storage.getProductMappingByCode(productCode);
    if (existing) {
      return res.status(400).json({ message: "이미 존재하는 상품코드입니다" });
    }
    const mapping = await storage.createProductMapping({
      productCode,
      productName,
      categoryLarge: categoryLarge || null,
      categoryMedium: categoryMedium || null,
      categorySmall: categorySmall || null,
      usageStatus: usageStatus || "Y",
      mappingStatus: "incomplete",
    });
    
    // Sync mappingStatus to product_registrations (source data)
    await storage.updateProductRegistration(registration.id, { mappingStatus: "incomplete" });
    
    return res.json(mapping);
  });

  // 상품 일괄 추가 (복수)
  app.post("/api/product-mappings/bulk", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }
    const { products } = req.body;
    if (!products || !Array.isArray(products)) {
      return res.status(400).json({ message: "products 배열이 필요합니다" });
    }
    const created: any[] = [];
    const errors: string[] = [];
    for (const p of products) {
      if (!p.productCode || !p.productName) {
        errors.push(`상품코드 또는 상품명 누락`);
        continue;
      }
      
      // 상품등록(공급가계산) 연계 체크 - 등록되지 않은 상품은 매핑 불가
      const registration = await storage.getProductRegistrationByCode(p.productCode);
      if (!registration) {
        errors.push(`상품등록에 없는 상품코드: ${p.productCode}`);
        continue;
      }
      
      const existing = await storage.getProductMappingByCode(p.productCode);
      if (existing) {
        errors.push(`이미 존재하는 상품코드: ${p.productCode}`);
        continue;
      }
      const mapping = await storage.createProductMapping({
        productCode: p.productCode,
        categoryLarge: p.categoryLarge || null,
        categoryMedium: p.categoryMedium || null,
        categorySmall: p.categorySmall || null,
        productName: p.productName,
        mappingStatus: "incomplete",
      });
      
      // Sync mappingStatus to product_registrations
      await storage.updateProductRegistration(registration.id, { mappingStatus: "incomplete" });
      
      created.push(mapping);
    }
    return res.json({ success: true, created: created.length, errors });
  });

  // 상품 매핑 수정 (카테고리, 사용유무, 메모 등)
  app.put("/api/product-mappings/:productCode", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }
    const { productCode } = req.params;
    const { productName, categoryLarge, categoryMedium, categorySmall, usageStatus } = req.body;
    
    const existing = await storage.getProductMappingByCode(productCode);
    if (!existing) {
      return res.status(404).json({ message: "상품 매핑을 찾을 수 없습니다" });
    }
    
    const updated = await storage.updateProductMappingByCode(productCode, {
      productName: productName || existing.productName,
      categoryLarge: categoryLarge !== undefined ? categoryLarge : existing.categoryLarge,
      categoryMedium: categoryMedium !== undefined ? categoryMedium : existing.categoryMedium,
      categorySmall: categorySmall !== undefined ? categorySmall : existing.categorySmall,
      usageStatus: usageStatus !== undefined ? usageStatus : existing.usageStatus,
    });
    
    return res.json(updated);
  });

  // 상품 매핑 삭제
  app.delete("/api/product-mappings/:productCode", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }
    const { productCode } = req.params;
    
    // Check if product is in nextWeekProducts or currentProducts (protected)
    const nextWeekProducts = await storage.getAllNextWeekProducts();
    const currentProducts = await storage.getAllCurrentProducts();
    const inNextWeek = nextWeekProducts.some(p => p.productCode === productCode);
    const inCurrent = currentProducts.some(p => p.productCode === productCode);
    
    if (inNextWeek && inCurrent) {
      return res.status(400).json({ message: "차주예상공급가 및 현재공급가 상품입니다. 변경이나 삭제가 불가합니다." });
    } else if (inNextWeek) {
      return res.status(400).json({ message: "차주예상공급가 상품입니다. 변경이나 삭제가 불가합니다." });
    } else if (inCurrent) {
      return res.status(400).json({ message: "현재공급가 상품입니다. 변경이나 삭제가 불가합니다." });
    }
    
    const deleted = await storage.deleteProductMapping(productCode);
    if (!deleted) {
      return res.status(404).json({ message: "상품 매핑을 찾을 수 없습니다" });
    }
    
    // Sync mappingStatus to product_registrations (source data)
    const productReg = await storage.getProductRegistrationByCode(productCode);
    if (productReg) {
      await storage.updateProductRegistration(productReg.id, { mappingStatus: "incomplete" });
    }
    
    return res.json({ success: true, message: "매핑 정보가 삭제되었습니다" });
  });

  // 재료 매핑 조회
  app.get("/api/product-mappings/:productCode/materials", async (req, res) => {
    const { productCode } = req.params;
    const materials = await storage.getProductMaterialMappings(productCode);
    return res.json(materials);
  });

  // 재료 매핑 저장 (전체 교체)
  app.put("/api/product-mappings/:productCode/materials", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }
    const { productCode } = req.params;
    const { materials } = req.body;
    
    const mapping = await storage.getProductMappingByCode(productCode);
    if (!mapping) {
      return res.status(404).json({ message: "상품 매핑을 찾을 수 없습니다" });
    }
    
    if (!materials || !Array.isArray(materials)) {
      return res.status(400).json({ message: "materials 배열이 필요합니다" });
    }
    
    // Check if trying to unmap (empty materials) a protected product
    if (materials.length === 0) {
      const nextWeekProducts = await storage.getAllNextWeekProducts();
      const currentProducts = await storage.getAllCurrentProducts();
      const inNextWeek = nextWeekProducts.some(p => p.productCode === productCode);
      const inCurrent = currentProducts.some(p => p.productCode === productCode);
      
      if (inNextWeek && inCurrent) {
        return res.status(400).json({ message: "차주예상공급가 및 현재공급가 상품입니다. 변경이나 삭제가 불가합니다." });
      } else if (inNextWeek) {
        return res.status(400).json({ message: "차주예상공급가 상품입니다. 변경이나 삭제가 불가합니다." });
      } else if (inCurrent) {
        return res.status(400).json({ message: "현재공급가 상품입니다. 변경이나 삭제가 불가합니다." });
      }
    }
    
    const validMaterials = [];
    for (const m of materials) {
      if (!m.materialCode || !m.materialName || m.quantity === undefined) {
        return res.status(400).json({ message: "재료코드, 재료명, 수량은 필수입니다" });
      }
      validMaterials.push({
        materialCode: m.materialCode,
        materialName: m.materialName,
        materialType: m.materialType || "raw",
        quantity: parseFloat(m.quantity),
      });
    }
    
    const result = await storage.replaceProductMaterialMappings(productCode, validMaterials);
    
    // Update mappingStatus in product_mappings table
    const newMappingStatus = validMaterials.length > 0 ? "complete" : "incomplete";
    await storage.updateProductMappingByCode(productCode, { mappingStatus: newMappingStatus });
    
    // Also update mappingStatus in product_registrations table (source data)
    const productReg = await storage.getProductRegistrationByCode(productCode);
    if (productReg) {
      await storage.updateProductRegistration(productReg.id, { mappingStatus: newMappingStatus });
    }
    
    return res.json({ success: true, materials: result, mappingStatus: newMappingStatus });
  });

  // 상품 매핑 엑셀 업로드
  const mappingExcelUpload = multer({ storage: multer.memoryStorage() });
  app.post("/api/product-mappings/upload", mappingExcelUpload.single("file"), async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const uploadUser = await storage.getUser(req.session.userId);
    if (!uploadUser || (uploadUser.role !== "SUPER_ADMIN" && uploadUser.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }
    if (!req.file) {
      return res.status(400).json({ message: "파일이 필요합니다" });
    }
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
      
      // 새 양식: 2행 헤더 (row 0, row 1), 데이터는 row 2부터
      if (rows.length < 3) {
        return res.status(400).json({ message: "데이터가 없습니다" });
      }
      
      // 2행 헤더 건너뛰기 (row 0: 메인 헤더, row 1: 서브 헤더)
      const dataRows = rows.slice(2).filter(row => row.some(cell => cell !== undefined && cell !== ""));
      const errors: string[] = [];
      
      interface ProductData {
        productName: string;
        categoryLarge?: string;
        categoryMedium?: string;
        categorySmall?: string;
        usageStatus: string;
        materials: { materialCode: string; materialName: string; quantity: number }[];
      }
      
      const productGroups: { [key: string]: ProductData } = {};
      
      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const rowNum = i + 3; // 실제 엑셀 행 번호 (1-indexed + 2행 헤더)
        
        // 컬럼 구조: 대분류, 중분류, 소분류, 판매상품코드, 판매상품명, 원재료품목코드1, 수량, ...(4쌍), 사용유무
        const 대분류 = row[0];
        const 중분류 = row[1];
        const 소분류 = row[2];
        const 판매상품코드 = row[3];
        const 판매상품명 = row[4];
        const 사용유무 = row[13]; // 마지막 컬럼
        
        if (!판매상품코드 || !판매상품명) {
          errors.push(`행 ${rowNum}: 판매상품코드 또는 판매상품명 누락`);
          continue;
        }
        
        const productCode = String(판매상품코드);
        if (!productGroups[productCode]) {
          productGroups[productCode] = { 
            productName: String(판매상품명), 
            categoryLarge: 대분류 ? String(대분류) : undefined,
            categoryMedium: 중분류 ? String(중분류) : undefined,
            categorySmall: 소분류 ? String(소분류) : undefined,
            usageStatus: 사용유무 === "N" ? "N" : "Y",
            materials: [] 
          };
        }
        
        // 원재료 4쌍 처리 (코드1, 수량1, 코드2, 수량2, 코드3, 수량3, 코드4, 수량4)
        for (let j = 0; j < 4; j++) {
          const codeIdx = 5 + j * 2;
          const qtyIdx = 6 + j * 2;
          const materialCode = row[codeIdx];
          const quantity = row[qtyIdx];
          
          if (materialCode && quantity !== undefined && quantity !== "") {
            const material = await storage.getMaterialByCode(String(materialCode));
            if (!material) {
              errors.push(`행 ${rowNum}: 원재료품목코드 "${materialCode}"가 존재하지 않습니다`);
              continue;
            }
            productGroups[productCode].materials.push({
              materialCode: String(materialCode),
              materialName: material.materialName,
              quantity: parseFloat(String(quantity)) || 0,
            });
          }
        }
      }
      
      let productOnlyCount = 0;
      let productWithMappingCount = 0;
      
      for (const [productCode, data] of Object.entries(productGroups)) {
        // 상품등록(공급가계산) 연계 체크 - 등록되지 않은 상품은 매핑 불가
        const registration = await storage.getProductRegistrationByCode(productCode);
        if (!registration) {
          errors.push(`상품등록에 없는 상품코드: ${productCode}`);
          continue;
        }
        
        const existing = await storage.getProductMappingByCode(productCode);
        const newMappingStatus = data.materials.length > 0 ? "complete" : "incomplete";
        
        if (existing) {
          // 기존 상품 업데이트
          await storage.updateProductMappingByCode(productCode, {
            productName: data.productName,
            categoryLarge: data.categoryLarge || null,
            categoryMedium: data.categoryMedium || null,
            categorySmall: data.categorySmall || null,
            usageStatus: data.usageStatus,
            mappingStatus: newMappingStatus,
          });
          if (data.materials.length > 0) {
            await storage.replaceProductMaterialMappings(productCode, data.materials);
            productWithMappingCount++;
          }
          // Sync mappingStatus to product_registrations
          await storage.updateProductRegistration(registration.id, { mappingStatus: newMappingStatus });
        } else {
          await storage.createProductMapping({
            productCode,
            productName: data.productName,
            categoryLarge: data.categoryLarge || null,
            categoryMedium: data.categoryMedium || null,
            categorySmall: data.categorySmall || null,
            usageStatus: data.usageStatus,
            mappingStatus: newMappingStatus,
          });
          
          if (data.materials.length > 0) {
            await storage.replaceProductMaterialMappings(productCode, data.materials);
            productWithMappingCount++;
          } else {
            productOnlyCount++;
          }
          // Sync mappingStatus to product_registrations
          await storage.updateProductRegistration(registration.id, { mappingStatus: newMappingStatus });
        }
      }
      
      const totalProducts = Object.keys(productGroups).length;
      return res.json({
        success: true,
        message: `${totalProducts}개 상품이 등록되었습니다.`,
        totalProducts,
        productOnlyCount,
        productWithMappingCount,
        errors,
      });
    } catch (error) {
      return res.status(400).json({ message: "엑셀 파일 처리 중 오류가 발생했습니다" });
    }
  });

  // ===== 공급상품 재고 관리 API =====

  // 재고가 있는 상품 목록 조회
  app.get("/api/product-stocks", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }
    const stocks = await storage.getProductStocksWithStock();
    return res.json(stocks);
  });

  // 전체 상품 재고 목록 조회 (입고/조정 시 검색용)
  app.get("/api/product-stocks/all", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }
    const stocks = await storage.getAllProductStocks();
    return res.json(stocks);
  });

  // 상품 매핑과 재고 정보 결합 조회
  app.get("/api/product-stocks/with-mappings", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }
    
    const mappings = await storage.getAllProductMappings();
    const stocks = await storage.getAllProductStocks();
    
    const stockMap = new Map(stocks.map(s => [s.productCode, s.currentStock]));
    
    const result = mappings.map(m => ({
      ...m,
      currentStock: stockMap.get(m.productCode) || 0,
    }));
    
    return res.json(result);
  });

  // 입고 등록
  app.post("/api/product-stocks/stock-in", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }
    
    const { productCode, productName, quantity, note } = req.body;
    
    if (!productCode || typeof quantity !== "number" || quantity <= 0) {
      return res.status(400).json({ message: "상품코드와 수량은 필수입니다" });
    }
    
    const mapping = await storage.getProductMappingByCode(productCode);
    if (!mapping) {
      return res.status(400).json({ message: "상품 매핑에 등록되지 않은 상품입니다" });
    }
    
    const beforeStock = (await storage.getProductStock(productCode))?.currentStock || 0;
    await storage.increaseProductStock(productCode, Math.floor(quantity), productName || mapping.productName);
    const afterStock = beforeStock + Math.floor(quantity);
    
    await storage.createStockHistory({
      stockType: "product",
      actionType: "in",
      itemCode: productCode,
      itemName: productName || mapping.productName,
      quantity: Math.floor(quantity),
      beforeStock,
      afterStock,
      note: note || null,
      adminId: user.id,
      source: "manual",
    });
    
    return res.json({ success: true, message: "입고가 완료되었습니다" });
  });

  // 재고 조정
  app.post("/api/product-stocks/adjust", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }
    
    const { productCode, adjustType, quantity, reason, note } = req.body;
    
    if (!productCode || !adjustType || typeof quantity !== "number" || quantity <= 0) {
      return res.status(400).json({ message: "필수 정보가 누락되었습니다" });
    }
    
    const stock = await storage.getProductStock(productCode);
    const currentStock = stock?.currentStock || 0;
    
    if (adjustType === "decrease" && quantity > currentStock) {
      return res.status(400).json({ message: "현재 재고보다 많은 수량을 감소할 수 없습니다" });
    }
    
    const mapping = await storage.getProductMappingByCode(productCode);
    const beforeStock = currentStock;
    
    if (adjustType === "increase") {
      await storage.increaseProductStock(productCode, Math.floor(quantity), mapping?.productName);
    } else {
      await storage.decreaseProductStock(productCode, Math.floor(quantity));
    }
    
    const afterStock = adjustType === "increase" 
      ? beforeStock + Math.floor(quantity) 
      : beforeStock - Math.floor(quantity);
    
    await storage.createStockHistory({
      stockType: "product",
      actionType: "adjust",
      itemCode: productCode,
      itemName: mapping?.productName || productCode,
      quantity: adjustType === "increase" ? Math.floor(quantity) : -Math.floor(quantity),
      beforeStock,
      afterStock,
      reason: reason || null,
      note: note || null,
      adminId: user.id,
      source: "manual",
    });
    
    return res.json({ success: true, message: "재고 조정이 완료되었습니다" });
  });

  // 공급상품 입고 양식 다운로드
  app.get("/api/product-stocks/template", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    
    const wsData = [
      ["상품코드", "상품명", "입고수량", "비고"],
      ["A001", "부사 3kg 선물세트", 10, ""],
      ["A002", "부사 5kg 가정용", 5, ""],
    ];
    
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    ws["!cols"] = [
      { wch: 15 },
      { wch: 30 },
      { wch: 12 },
      { wch: 30 },
    ];
    
    XLSX.utils.book_append_sheet(wb, ws, "공급상품 입고");
    
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=product_stock_template.xlsx");
    return res.send(buffer);
  });

  // 엑셀 일괄 입고
  app.post("/api/product-stocks/upload", upload.single("file"), async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }
    
    if (!req.file) {
      return res.status(400).json({ message: "파일이 없습니다" });
    }
    
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<any>(worksheet, { header: 1 });
      
      if (rows.length < 2) {
        return res.status(400).json({ message: "데이터가 없습니다" });
      }
      
      const successItems: { productCode: string; productName: string; quantity: number }[] = [];
      const errors: string[] = [];
      
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;
        
        const productCode = String(row[0] || "").trim();
        const productName = String(row[1] || "").trim();
        const quantityRaw = row[2];
        const note = String(row[3] || "").trim();
        
        if (!productCode) {
          errors.push(`행 ${i + 1}: 상품코드 누락`);
          continue;
        }
        
        const quantity = parseInt(String(quantityRaw));
        if (isNaN(quantity) || quantity <= 0) {
          errors.push(`행 ${i + 1}: 입고수량은 양의 정수만 가능합니다`);
          continue;
        }
        
        const mapping = await storage.getProductMappingByCode(productCode);
        if (!mapping) {
          errors.push(`행 ${i + 1}: 상품코드 [${productCode}]가 상품 매핑에 존재하지 않습니다`);
          continue;
        }
        
        successItems.push({
          productCode,
          productName: mapping.productName,
          quantity,
        });
      }
      
      return res.json({
        success: true,
        successItems,
        errors,
      });
    } catch (error) {
      return res.status(400).json({ message: "엑셀 파일 처리 중 오류가 발생했습니다" });
    }
  });

  // 엑셀 업로드 확정
  app.post("/api/product-stocks/upload/confirm", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }
    
    const { items } = req.body as { items: { productCode: string; productName: string; quantity: number }[] };
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "입고할 항목이 없습니다" });
    }
    
    let successCount = 0;
    
    for (const item of items) {
      const beforeStock = (await storage.getProductStock(item.productCode))?.currentStock || 0;
      await storage.increaseProductStock(item.productCode, item.quantity, item.productName);
      const afterStock = beforeStock + item.quantity;
      
      await storage.createStockHistory({
        stockType: "product",
        actionType: "in",
        itemCode: item.productCode,
        itemName: item.productName,
        quantity: item.quantity,
        beforeStock,
        afterStock,
        note: "엑셀 일괄 입고",
        adminId: user.id,
        source: "manual",
      });
      successCount++;
    }
    
    return res.json({
      success: true,
      message: `${successCount}개 상품이 입고되었습니다`,
      count: successCount,
    });
  });

  app.delete("/api/product-stocks/:productCode", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }
    
    const { productCode } = req.params;
    
    const stock = await storage.getProductStock(productCode);
    if (!stock) {
      return res.status(404).json({ message: "재고 정보를 찾을 수 없습니다" });
    }
    
    const beforeStock = stock.currentStock;
    await storage.deleteProductStock(productCode);
    
    await storage.createStockHistory({
      stockType: "product",
      actionType: "out",
      itemCode: productCode,
      itemName: stock.productName,
      quantity: -(beforeStock),
      beforeStock,
      afterStock: 0,
      reason: "삭제",
      note: "재고 삭제",
      adminId: user.id,
      source: "manual",
    });
    
    return res.json({ success: true, message: "재고가 삭제되었습니다" });
  });

  // Stock History API (재고 이력)
  app.get("/api/stock-history", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }
    
    const { stockType, actionType, source, adminId, startDate, endDate, keyword } = req.query;
    
    const params: {
      stockType?: string;
      actionType?: string;
      source?: string;
      adminId?: string;
      startDate?: Date;
      endDate?: Date;
      keyword?: string;
    } = {};
    
    if (stockType && typeof stockType === "string") params.stockType = stockType;
    if (actionType && typeof actionType === "string") params.actionType = actionType;
    if (source && typeof source === "string") params.source = source;
    if (adminId && typeof adminId === "string") params.adminId = adminId;
    if (startDate && typeof startDate === "string") params.startDate = new Date(startDate);
    if (endDate && typeof endDate === "string") params.endDate = new Date(endDate);
    if (keyword && typeof keyword === "string") params.keyword = keyword;
    
    const history = await storage.getFilteredStockHistory(params);
    return res.json(history);
  });

  app.get("/api/stock-history/admins", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }
    
    const admins = await storage.getStockHistoryAdmins();
    return res.json(admins);
  });

  app.get("/api/stock-history/download", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }
    
    const { stockType, actionType, source, adminId, startDate, endDate, keyword } = req.query;
    
    const params: {
      stockType?: string;
      actionType?: string;
      source?: string;
      adminId?: string;
      startDate?: Date;
      endDate?: Date;
      keyword?: string;
    } = {};
    
    if (stockType && typeof stockType === "string") params.stockType = stockType;
    if (actionType && typeof actionType === "string") params.actionType = actionType;
    if (source && typeof source === "string") params.source = source;
    if (adminId && typeof adminId === "string") params.adminId = adminId;
    if (startDate && typeof startDate === "string") params.startDate = new Date(startDate);
    if (endDate && typeof endDate === "string") params.endDate = new Date(endDate);
    if (keyword && typeof keyword === "string") params.keyword = keyword;
    
    const history = await storage.getFilteredStockHistory(params);
    
    const workbook = XLSX.utils.book_new();
    const data = history.map((h) => ({
      "번호": h.id,
      "구분": h.stockType === "product" ? "공급상품" : h.stockType === "material" ? "원재료" : h.stockType,
      "유형": h.actionType === "in" ? "입고" : h.actionType === "out" ? "출고" : h.actionType === "adjust" ? "조정" : h.actionType,
      "코드": h.itemCode,
      "상품/재료명": h.itemName,
      "수량": h.quantity,
      "변경전": h.beforeStock,
      "변경후": h.afterStock,
      "사유": h.reason || "",
      "비고": h.note || "",
      "출처": h.source === "manual" ? "수동" : h.source === "order" ? "주문연동" : h.source,
      "주문ID": h.orderId || "",
      "담당자": h.adminId,
      "일시": h.createdAt ? new Date(h.createdAt).toLocaleString("ko-KR") : "",
    }));
    
    const worksheet = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, "재고이력");
    
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    
    const today = new Date().toISOString().split("T")[0];
    res.setHeader("Content-Disposition", `attachment; filename=stock_history_${today}.xlsx`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    return res.send(buffer);
  });

  // ==================== 사이트 설정 API ====================
  
  // 공개 설정 조회 (헤더/푸터용 - 인증 불필요)
  app.get("/api/site-settings/public", async (req, res) => {
    try {
      const settings = await storage.getPublicSiteSettings();
      
      // key-value 형태로 변환
      const result = settings.reduce((acc, setting) => {
        let value: any = setting.settingValue;
        if (setting.settingType === "boolean") {
          value = setting.settingValue === "true";
        } else if (setting.settingType === "number") {
          value = Number(setting.settingValue);
        } else if (setting.settingType === "json") {
          try {
            value = JSON.parse(setting.settingValue || "{}");
          } catch {
            value = {};
          }
        }
        acc[setting.settingKey] = value;
        return acc;
      }, {} as Record<string, any>);
      
      res.json(result);
    } catch (error) {
      console.error("Failed to fetch public settings:", error);
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  // 전체 설정 조회 (관리자용)
  app.get("/api/site-settings", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }
    
    try {
      const settings = await storage.getAllSiteSettings();
      res.json(settings);
    } catch (error) {
      console.error("Failed to fetch settings:", error);
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  // 카테고리별 조회 (관리자용)
  app.get("/api/site-settings/category/:category", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }
    
    try {
      const settings = await storage.getSiteSettingsByCategory(req.params.category);
      res.json(settings);
    } catch (error) {
      console.error("Failed to fetch settings by category:", error);
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  // 일괄 수정 (관리자용)
  app.put("/api/site-settings/bulk", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }
    
    try {
      const { settings } = req.body;
      
      if (!settings || typeof settings !== "object") {
        return res.status(400).json({ error: "Invalid settings format" });
      }
      
      await storage.updateSiteSettings(settings);
      
      res.json({ success: true, message: "설정이 저장되었습니다." });
    } catch (error) {
      console.error("Failed to update settings:", error);
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

  // 초기 설정 시드 (관리자용 - 수동 호출)
  app.post("/api/site-settings/seed", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || user.role !== "SUPER_ADMIN") {
      return res.status(403).json({ message: "SUPER_ADMIN 권한이 필요합니다" });
    }
    
    try {
      await storage.seedSiteSettings();
      res.json({ success: true, message: "초기 설정이 생성되었습니다." });
    } catch (error) {
      console.error("Failed to seed settings:", error);
      res.status(500).json({ error: "Failed to seed settings" });
    }
  });

  // ==================== 헤더 메뉴 API ====================
  
  // 공개 메뉴 목록 (인증 불필요)
  app.get("/api/header-menus/public", async (req, res) => {
    try {
      const menus = await storage.getVisibleHeaderMenus();
      res.json(menus);
    } catch (error) {
      console.error("Failed to fetch public menus:", error);
      res.status(500).json({ error: "Failed to fetch menus" });
    }
  });

  // 전체 메뉴 목록 (관리자용)
  app.get("/api/header-menus", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }
    
    try {
      const menus = await storage.getAllHeaderMenus();
      res.json(menus);
    } catch (error) {
      console.error("Failed to fetch menus:", error);
      res.status(500).json({ error: "Failed to fetch menus" });
    }
  });

  // 메뉴 생성 (관리자용)
  app.post("/api/header-menus", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }
    
    try {
      const { name, path, sortOrder, isVisible, openInNewTab } = req.body;
      
      if (!name || !path) {
        return res.status(400).json({ error: "메뉴명과 연결페이지는 필수입니다" });
      }
      
      const menu = await storage.createHeaderMenu({
        name,
        path,
        sortOrder: sortOrder || 0,
        isVisible: isVisible || "true",
        openInNewTab: openInNewTab || "false",
      });
      
      res.json(menu);
    } catch (error) {
      console.error("Failed to create menu:", error);
      res.status(500).json({ error: "Failed to create menu" });
    }
  });

  // 메뉴 수정 (관리자용)
  app.put("/api/header-menus/:id", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }
    
    try {
      const { name, path, sortOrder, isVisible, openInNewTab } = req.body;
      
      const menu = await storage.updateHeaderMenu(req.params.id, {
        name,
        path,
        sortOrder,
        isVisible,
        openInNewTab,
      });
      
      if (!menu) {
        return res.status(404).json({ error: "메뉴를 찾을 수 없습니다" });
      }
      
      res.json(menu);
    } catch (error) {
      console.error("Failed to update menu:", error);
      res.status(500).json({ error: "Failed to update menu" });
    }
  });

  // 메뉴 삭제 (관리자용)
  app.delete("/api/header-menus/:id", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }
    
    try {
      const deleted = await storage.deleteHeaderMenu(req.params.id);
      
      if (!deleted) {
        return res.status(404).json({ error: "메뉴를 찾을 수 없습니다" });
      }
      
      res.json({ success: true, message: "메뉴가 삭제되었습니다" });
    } catch (error) {
      console.error("Failed to delete menu:", error);
      res.status(500).json({ error: "Failed to delete menu" });
    }
  });

  // 메뉴 순서 변경 (관리자용)
  app.put("/api/header-menus/order/update", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }
    
    try {
      const { menus } = req.body;
      
      if (!Array.isArray(menus)) {
        return res.status(400).json({ error: "잘못된 요청 형식입니다" });
      }
      
      await storage.updateHeaderMenuOrder(menus);
      
      res.json({ success: true, message: "순서가 변경되었습니다" });
    } catch (error) {
      console.error("Failed to update menu order:", error);
      res.status(500).json({ error: "Failed to update menu order" });
    }
  });

  // Seed default system menus
  app.post("/api/header-menus/seed", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || user.role !== "SUPER_ADMIN") {
      return res.status(403).json({ message: "SUPER_ADMIN 권한이 필요합니다" });
    }
    
    try {
      const existingMenus = await storage.getAllHeaderMenus();
      const existingSystemKeys = existingMenus
        .filter(m => m.menuType === "system")
        .map(m => m.systemKey);
      
      const systemMenus = [
        { name: "로그인", path: "/login", menuType: "system", systemKey: "login", showWhenLoggedIn: "false", showWhenLoggedOut: "true", sortOrder: 100 },
        { name: "회원가입", path: "/register", menuType: "system", systemKey: "register", showWhenLoggedIn: "false", showWhenLoggedOut: "true", sortOrder: 101 },
        { name: "로그아웃", path: "/logout", menuType: "system", systemKey: "logout", showWhenLoggedIn: "true", showWhenLoggedOut: "false", sortOrder: 102 },
        { name: "장바구니", path: "/cart", menuType: "system", systemKey: "cart", showWhenLoggedIn: "true", showWhenLoggedOut: "false", sortOrder: 103 },
        { name: "마이페이지", path: "/mypage", menuType: "system", systemKey: "mypage", showWhenLoggedIn: "true", showWhenLoggedOut: "false", sortOrder: 104 },
      ];
      
      const menusToCreate = systemMenus.filter(m => !existingSystemKeys.includes(m.systemKey));
      
      for (const menu of menusToCreate) {
        await storage.createHeaderMenu(menu);
      }
      
      res.json({ success: true, message: `${menusToCreate.length}개의 시스템 메뉴가 생성되었습니다` });
    } catch (error) {
      console.error("Failed to seed system menus:", error);
      res.status(500).json({ error: "Failed to seed system menus" });
    }
  });

  // ==================== Pages Management ====================
  // Get all pages (admin only)
  app.get("/api/pages", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }
    
    try {
      const pages = await storage.getAllPages();
      res.json(pages);
    } catch (error) {
      console.error("Failed to get pages:", error);
      res.status(500).json({ error: "Failed to get pages" });
    }
  });

  // Get page by ID (admin only)
  app.get("/api/pages/:id", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }
    
    try {
      const page = await storage.getPage(req.params.id);
      if (!page) {
        return res.status(404).json({ message: "페이지를 찾을 수 없습니다" });
      }
      res.json(page);
    } catch (error) {
      console.error("Failed to get page:", error);
      res.status(500).json({ error: "Failed to get page" });
    }
  });

  // Create page (admin only)
  app.post("/api/pages", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }
    
    try {
      const validatedData = insertPageSchema.parse(req.body);
      const page = await storage.createPage(validatedData);
      res.json(page);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "유효하지 않은 데이터입니다", errors: error.errors });
      }
      console.error("Failed to create page:", error);
      res.status(500).json({ error: "Failed to create page" });
    }
  });

  // Update page (admin only)
  app.put("/api/pages/:id", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }
    
    try {
      const validatedData = insertPageSchema.partial().parse(req.body);
      const page = await storage.updatePage(req.params.id, validatedData);
      if (!page) {
        return res.status(404).json({ message: "페이지를 찾을 수 없습니다" });
      }
      res.json(page);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "유효하지 않은 데이터입니다", errors: error.errors });
      }
      console.error("Failed to update page:", error);
      res.status(500).json({ error: "Failed to update page" });
    }
  });

  // Delete page (admin only, cannot delete system pages)
  app.delete("/api/pages/:id", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }
    
    try {
      const deleted = await storage.deletePage(req.params.id);
      if (!deleted) {
        return res.status(400).json({ message: "시스템 페이지는 삭제할 수 없습니다" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete page:", error);
      res.status(500).json({ error: "Failed to delete page" });
    }
  });

  // Seed default pages (SUPER_ADMIN only)
  app.post("/api/pages/seed", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || user.role !== "SUPER_ADMIN") {
      return res.status(403).json({ message: "SUPER_ADMIN 권한이 필요합니다" });
    }
    
    try {
      await storage.seedDefaultPages();
      res.json({ success: true, message: "기본 페이지가 생성되었습니다" });
    } catch (error) {
      console.error("Failed to seed default pages:", error);
      res.status(500).json({ error: "Failed to seed default pages" });
    }
  });

  return httpServer;
}
