import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage, seedAdminUser } from "./storage";
import session from "express-session";
import { loginSchema, registerSchema, insertOrderSchema, userTiers, imageCategories } from "@shared/schema";
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
  await seedAdminUser();
  
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
      
      const existingUser = await storage.getUserByEmail(data.email);
      if (existingUser) {
        return res.status(400).json({ message: "이미 등록된 이메일입니다" });
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

  app.post("/api/auth/login", async (req, res) => {
    try {
      const data = loginSchema.parse(req.body);
      
      const user = await storage.validatePassword(data.email, data.password);
      if (!user) {
        return res.status(401).json({ message: "이메일 또는 비밀번호가 올바르지 않습니다" });
      }

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

  app.get("/api/admin/users", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user || user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    const users = await storage.getAllUsers();
    const usersWithoutPasswords = users.map(({ password, ...u }) => u);
    return res.json(usersWithoutPasswords);
  });

  app.get("/api/admin/orders", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user || user.role !== "admin") {
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
    if (!currentUser || currentUser.role !== "admin") {
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
    if (!user || user.role !== "admin") {
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
    if (!user || user.role !== "admin") {
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
    if (!user || user.role !== "admin") {
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
    if (!user || user.role !== "admin") {
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
    if (!user || user.role !== "admin") {
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
    if (!user || user.role !== "admin") {
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
    if (!user || user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    const deleted = await storage.deleteSubcategory(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "세부 카테고리를 찾을 수 없습니다" });
    }

    return res.json({ message: "삭제 완료" });
  });

  return httpServer;
}
