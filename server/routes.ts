import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import session from "express-session";
import cookieParser from "cookie-parser";
import { loginSchema, registerSchema, insertOrderSchema, insertAdminSchema, updateAdminSchema, userTiers, imageCategories, menuPermissions, partnerFormSchema, shippingCompanies, memberFormSchema, updateMemberSchema, bulkUpdateMemberSchema, memberGrades, categoryFormSchema, productRegistrationFormSchema, type Category, insertPageSchema, pageCategories, pageAccessLevels, termAgreements, pages, deletedMembers, deletedMemberOrders, orders, alimtalkTemplates, alimtalkHistory, pendingOrders, pendingOrderStatuses, formTemplates, materials, productMaterialMappings, orderUploadHistory, siteSettings, members, currentProducts, settlementHistory, depositHistory, pointerHistory, productStocks, orderAllocations, allocationDetails, productVendors, productRegistrations, vendors, vendorPayments, bankdaTransactions, purchases, directSales, suppliers, inquiries, insertInquirySchema, inquiryMessages, insertInquiryMessageSchema, inquiryFields, insertInquiryFieldSchema, inquiryAttachments, insertInquiryAttachmentSchema } from "@shared/schema";
import addressValidationRouter, { validateSingleAddress, type AddressStatus } from "./address-validation";
import { normalizePhoneNumber } from "@shared/phone-utils";
import { solapiService } from "./services/solapi";
import crypto from "crypto";
import { z } from "zod";
import MemoryStore from "memorystore";
import multer from "multer";
import axios from "axios";
import path from "path";
import fs from "fs";
import { uploadImage, deleteImage } from "./r2";
import { db } from "./db";
import { eq, ne, desc, asc, sql, and, or, inArray, like, ilike, isNotNull, gte, lte, lt, gt, count } from "drizzle-orm";
import { generateToken, JWT_COOKIE_OPTIONS } from "./jwt-utils";
import partnerRouter from "./partner-routes";

// PortOne V2 환경변수
const PORTONE_STORE_ID = process.env.PORTONE_STORE_ID || '';
const PORTONE_CHANNEL_KEY = process.env.PORTONE_CHANNEL_KEY || '';
const PORTONE_API_SECRET = process.env.PORTONE_API_SECRET || '';

// 포트원 V2 환경변수 설정 경고
if (!process.env.PORTONE_STORE_ID) {
  console.warn('\x1b[33m⚠️  경고: PORTONE_STORE_ID 환경변수가 설정되지 않았습니다. 포트원 V2 본인인증이 작동하지 않습니다.\x1b[0m');
}
if (!process.env.PORTONE_CHANNEL_KEY) {
  console.warn('\x1b[33m⚠️  경고: PORTONE_CHANNEL_KEY 환경변수가 설정되지 않았습니다. 포트원 V2 본인인증이 작동하지 않습니다.\x1b[0m');
}
if (!process.env.PORTONE_API_SECRET) {
  console.warn('\x1b[33m⚠️  경고: PORTONE_API_SECRET 환경변수가 설정되지 않았습니다. 포트원 V2 본인인증이 작동하지 않습니다.\x1b[0m');
}

declare module "express-session" {
  interface SessionData {
    userId: string;
    userType: "user" | "member";
  }
}

const MemoryStoreSession = MemoryStore(session);

import { sseManager } from "./sse-manager";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.use(cookieParser());
  
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

  // 주소 검증 API 라우터
  app.use("/api/address", addressValidationRouter);

  // 외주업체 파트너 API 라우터
  app.use("/api/partner", partnerRouter);

  // SSE 이벤트 스트림 엔드포인트
  app.get("/api/events", async (req, res) => {
    // 인증 확인
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    // userType 명시적 확인 및 설정
    let userType: "user" | "member" = "member";
    if (req.session.userType === "member") {
      // 회원 확인
      const member = await storage.getMember(req.session.userId);
      if (!member) {
        return res.status(401).json({ message: "회원 정보를 찾을 수 없습니다" });
      }
      userType = "member";
    } else {
      // 관리자 확인
      const user = await storage.getUser(req.session.userId);
      if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
        return res.status(403).json({ message: "권한이 없습니다" });
      }
      userType = "user";
    }

    // SSE 헤더 설정
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // nginx 버퍼링 비활성화

    // 초기 연결 메시지
    res.write(`event: connected\ndata: ${JSON.stringify({ message: "SSE connected", userType })}\n\n`);

    // 클라이언트 등록
    const clientId = `${req.session.userId}-${Date.now()}`;
    sseManager.addClient({
      id: clientId,
      res,
      userId: req.session.userId,
      userType,
    });

    // 30초마다 heartbeat 전송 (연결 유지)
    const heartbeat = setInterval(() => {
      try {
        res.write(`event: heartbeat\ndata: ${JSON.stringify({ time: Date.now() })}\n\n`);
      } catch (e) {
        // 연결이 끊어진 경우 정리
        clearInterval(heartbeat);
        sseManager.removeClient(clientId);
      }
    }, 30000);

    // 연결 종료 시 정리
    const cleanup = () => {
      clearInterval(heartbeat);
      sseManager.removeClient(clientId);
    };

    req.on("close", cleanup);
    res.on("error", cleanup);
  });

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

  // uploads 폴더가 없으면 생성
  const uploadsDir = path.resolve(process.cwd(), "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('\x1b[32m✅ uploads 폴더 생성됨:', uploadsDir, '\x1b[0m');
  } else {
    console.log('\x1b[34mℹ️  uploads 폴더 존재:', uploadsDir, '\x1b[0m');
  }

  // Multer 디스크 스토리지 설정
  const diskStorage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, uploadsDir);
    },
    filename: (_req, file, cb) => {
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 100000);
      const ext = path.extname(file.originalname);
      const baseName = path.basename(file.originalname, ext);
      cb(null, `${timestamp}-${random}-${baseName}${ext}`);
    }
  });

  const registerUpload = multer({ storage: diskStorage });

  // 회원가입 API (POST /register)
  app.post("/register", registerUpload.fields([
    { name: "bizFile", maxCount: 1 },
    { name: "mailFile", maxCount: 1 }
  ]), async (req, res) => {
    console.log('\x1b[36m📝 [회원가입] 요청 수신\x1b[0m');
    console.log('   - Body fields:', Object.keys(req.body));
    console.log('   - Files:', req.files ? Object.keys(req.files as any) : 'none');
    
    try {
      const registerFormSchema = z.object({
        member_name: z.string().min(1, "회원명을 입력해주세요"),
        user_id: z.string().min(4, "아이디는 4자 이상이어야 합니다"),
        password: z.string().min(6, "비밀번호는 6자 이상이어야 합니다"),
        biz_name: z.string().min(1, "상호명을 입력해주세요"),
        biz_no: z.string().min(1, "사업자번호를 입력해주세요"),
        ceo_name: z.string().min(1, "대표자명을 입력해주세요"),
        ceo_phone: z.string().min(1, "대표자 연락처를 입력해주세요"),
        ceo_birth: z.string().optional().or(z.literal("")),
        ceo_ci: z.string().optional().or(z.literal("")),
        mail_no: z.string().min(1, "통신판매번호를 입력해주세요"),
        address: z.string().min(1, "사업장 주소를 입력해주세요"),
        email: z.string().email("유효한 이메일을 입력해주세요"),
        manager1_name: z.string().optional().or(z.literal("")),
        manager1_phone: z.string().optional().or(z.literal("")),
        manager2_name: z.string().optional().or(z.literal("")),
        manager2_phone: z.string().optional().or(z.literal("")),
        manager3_name: z.string().optional().or(z.literal("")),
        manager3_phone: z.string().optional().or(z.literal("")),
        signature_data: z.string().min(1, "서명을 입력해주세요"),
      });

      const data = registerFormSchema.parse(req.body);
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };

      // 필수 파일 검증
      if (!files?.bizFile?.[0]) {
        return res.status(400).json({ success: false, message: "사업자등록증을 업로드해주세요" });
      }
      if (!files?.mailFile?.[0]) {
        return res.status(400).json({ success: false, message: "통신판매업신고증을 업로드해주세요" });
      }

      // user_id 중복 체크
      console.log('   - 아이디 중복 체크:', data.user_id);
      const existingUser = await storage.getUserByUsername(data.user_id);
      if (existingUser) {
        console.log('\x1b[31m   ❌ 중복 아이디 (users 테이블)\x1b[0m');
        return res.status(400).json({ success: false, message: "이미 사용 중인 아이디입니다" });
      }
      const existingMember = await storage.getMemberByUsername(data.user_id);
      if (existingMember) {
        console.log('\x1b[31m   ❌ 중복 아이디 (members 테이블)\x1b[0m');
        return res.status(400).json({ success: false, message: "이미 사용 중인 아이디입니다" });
      }

      // 사업자번호 중복 체크
      console.log('   - 사업자번호 중복 체크:', data.biz_no);
      const existingBusiness = await storage.getMemberByBusinessNumber(data.biz_no);
      if (existingBusiness) {
        console.log('\x1b[31m   ❌ 중복 사업자번호\x1b[0m');
        return res.status(400).json({ success: false, message: "이미 등록된 사업자번호입니다" });
      }

      // 파일 경로 저장
      const bizFilePath = files.bizFile[0].filename;
      const mailFilePath = files.mailFile[0].filename;
      console.log('   - 업로드 파일:', { bizFilePath, mailFilePath });

      // DB INSERT (status='pending')
      console.log('   - DB INSERT 시작 (grade=PENDING)');
      const member = await storage.createMember({
        username: data.user_id,
        password: data.password,
        memberName: data.member_name,
        companyName: data.biz_name,
        businessNumber: data.biz_no,
        representative: data.ceo_name,
        phone: data.ceo_phone,
        ceoBirth: data.ceo_birth || undefined,
        ceoCi: data.ceo_ci || undefined,
        mailNo: data.mail_no,
        businessAddress: data.address,
        email: data.email,
        managerName: data.manager1_name || undefined,
        managerPhone: data.manager1_phone || undefined,
        manager2Name: data.manager2_name || undefined,
        manager2Phone: data.manager2_phone || undefined,
        manager3Name: data.manager3_name || undefined,
        manager3Phone: data.manager3_phone || undefined,
        businessLicenseUrl: `/uploads/${bizFilePath}`,
        mailFilePath: `/uploads/${mailFilePath}`,
        signatureData: data.signature_data,
        grade: "PENDING",
        status: "활성",
      });

      console.log('\x1b[32m   ✅ 회원가입 성공! ID:', member.id, '\x1b[0m');
      return res.status(201).json({
        success: true,
        message: "회원가입 신청이 완료되었습니다. 관리자 승인 대기 중입니다."
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        console.log('\x1b[31m   ❌ 유효성 검사 실패:', error.errors[0].message, '\x1b[0m');
        return res.status(400).json({ success: false, message: error.errors[0].message });
      }
      console.error("\x1b[31m   ❌ Register error:", error, '\x1b[0m');
      return res.status(500).json({ success: false, message: "회원가입 처리 중 오류가 발생했습니다" });
    }
  });

  // 회원(셀러) 회원가입 API with file upload (공개 엔드포인트)
  const memberSignupUpload = multer({ storage: multer.memoryStorage() });
  app.post("/api/auth/member-register", memberSignupUpload.fields([
    { name: "businessLicense", maxCount: 1 },
    { name: "mailFile", maxCount: 1 }
  ]), async (req, res) => {
    try {
      const memberSignupSchema = z.object({
        username: z.string().min(4, "아이디는 4자 이상이어야 합니다"),
        password: z.string().min(6, "비밀번호는 6자 이상이어야 합니다"),
        memberName: z.string().optional().or(z.literal("")),
        companyName: z.string().min(1, "상호명을 입력해주세요"),
        businessNumber: z.string().regex(/^\d{3}-\d{2}-\d{5}$/, "사업자번호 형식: 000-00-00000"),
        businessAddress: z.string().min(1, "사업장 주소를 입력해주세요"),
        representative: z.string().min(1, "대표자명을 입력해주세요"),
        phone: z.string().min(1, "대표연락처를 입력해주세요"),
        ceoBirth: z.string().optional().or(z.literal("")),
        ceoCi: z.string().optional().or(z.literal("")),
        mailNo: z.string().optional().or(z.literal("")),
        managerName: z.string().optional().or(z.literal("")),
        managerPhone: z.string().optional().or(z.literal("")),
        manager2Name: z.string().optional().or(z.literal("")),
        manager2Phone: z.string().optional().or(z.literal("")),
        manager3Name: z.string().optional().or(z.literal("")),
        manager3Phone: z.string().optional().or(z.literal("")),
        email: z.string().email("유효한 이메일을 입력해주세요"),
        signatureData: z.string().optional().or(z.literal("")),
      });

      const data = memberSignupSchema.parse(req.body);

      // 아이디 중복 확인 (users와 members 테이블 모두)
      const existingUser = await storage.getUserByUsername(data.username);
      if (existingUser) {
        return res.status(400).json({ message: "이미 사용 중인 아이디입니다" });
      }
      const existingMember = await storage.getMemberByUsername(data.username);
      if (existingMember) {
        return res.status(400).json({ message: "이미 사용 중인 아이디입니다" });
      }

      // 사업자번호 중복 확인
      const existingBusiness = await storage.getMemberByBusinessNumber(data.businessNumber);
      if (existingBusiness) {
        return res.status(400).json({ message: "이미 등록된 사업자번호입니다" });
      }

      // 파일 업로드 처리
      let businessLicenseUrl: string | undefined;
      let mailFilePath: string | undefined;
      
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      
      if (files?.businessLicense?.[0]) {
        const file = files.businessLicense[0];
        const result = await uploadImage(file.buffer, file.originalname, file.mimetype, "member-documents");
        businessLicenseUrl = result.publicUrl;
      }
      
      if (files?.mailFile?.[0]) {
        const file = files.mailFile[0];
        const result = await uploadImage(file.buffer, file.originalname, file.mimetype, "member-documents");
        mailFilePath = result.publicUrl;
      }

      // 회원 생성 (승인 대기 상태)
      const member = await storage.createMember({
        username: data.username,
        password: data.password,
        memberName: data.memberName || undefined,
        companyName: data.companyName,
        businessNumber: data.businessNumber,
        representative: data.representative,
        phone: data.phone,
        businessAddress: data.businessAddress || undefined,
        ceoBirth: data.ceoBirth || undefined,
        ceoCi: data.ceoCi || undefined,
        mailNo: data.mailNo || undefined,
        managerName: data.managerName || undefined,
        managerPhone: data.managerPhone || undefined,
        manager2Name: data.manager2Name || undefined,
        manager2Phone: data.manager2Phone || undefined,
        manager3Name: data.manager3Name || undefined,
        manager3Phone: data.manager3Phone || undefined,
        email: data.email || undefined,
        grade: "PENDING",
        status: "활성",
        businessLicenseUrl,
        mailFilePath,
        signatureData: data.signatureData || undefined,
      });

      // 약관 동의 기록 저장 (법적 증빙용)
      try {
        const [registerPage] = await db.select().from(pages).where(eq(pages.path, '/register'));
        const pageContent = registerPage?.content as any || {};
        const termsContent = pageContent.terms_content || {};
        
        const serviceTermContent = termsContent.service?.content || "";
        const privacyTermContent = termsContent.privacy?.content || "";
        const thirdPartyTermContent = termsContent.third_party?.content || "";
        const serviceTermVersion = termsContent.service?.version || "1.0";
        const privacyTermVersion = termsContent.privacy?.version || "1.0";
        const thirdPartyTermVersion = termsContent.third_party?.version || "1.0";
        
        const xForwardedFor = req.headers['x-forwarded-for'] as string || "";
        const ipAddress = xForwardedFor.split(',')[0].trim() || req.socket.remoteAddress || "";
        const userAgent = req.headers['user-agent'] || "";
        
        const agreedAt = new Date();
        const agreedAtISO = agreedAt.toISOString();
        
        const agreementRecord = {
          memberId: member.id,
          memberUsername: data.username,
          memberName: data.memberName || null,
          companyName: data.companyName,
          businessNumber: data.businessNumber,
          representative: data.representative,
          serviceTermVersion,
          serviceTermContent,
          serviceTermAgreed: "true",
          privacyTermVersion,
          privacyTermContent,
          privacyTermAgreed: "true",
          thirdPartyTermVersion,
          thirdPartyTermContent,
          thirdPartyTermAgreed: "true",
          signatureData: data.signatureData || null,
          ceoBirth: data.ceoBirth || null,
          ceoCi: data.ceoCi || null,
          ceoPhone: data.phone || null,
          agreedAt: agreedAtISO
        };
        
        const contentHash = crypto.createHash('sha256')
          .update(JSON.stringify(agreementRecord))
          .digest('hex');
        const signatureHash = data.signatureData 
          ? crypto.createHash('sha256').update(data.signatureData).digest('hex') 
          : null;
        
        await db.insert(termAgreements).values({
          ...agreementRecord,
          agreedAt: agreedAt,
          signatureHash,
          ipAddress,
          userAgent,
          contentHash,
        });
        console.log('\x1b[32m   ✅ 약관 동의 기록 저장 완료\x1b[0m');
      } catch (termError) {
        console.error("Term agreement save error (non-critical):", termError);
      }

      const { password, ...memberWithoutPassword } = member;
      return res.status(201).json({
        ...memberWithoutPassword,
        message: "회원가입이 완료되었습니다. 관리자 승인 후 로그인할 수 있습니다."
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Member registration error:", error);
      throw error;
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const data = loginSchema.parse(req.body);
      
      // 환경 감지
      const isProduction = process.env.NODE_ENV === 'production';
      const isDevelopment = process.env.NODE_ENV === 'development';
      
      // JWT 쿠키 설정 (환경별 자동 조정)
      const cookieOptions = {
        httpOnly: true,
        secure: isProduction,
        sameSite: (isProduction ? 'lax' : 'lax') as 'lax' | 'none',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: "/",
        ...(isProduction && { domain: '.topsel.kr' })
      };
      
      // First try to authenticate as admin user
      const user = await storage.validatePassword(data.username, data.password);
      if (user) {
        await storage.updateLastLogin(user.id);
        req.session.userId = user.id;
        req.session.userType = "user";

        // JWT 토큰 발급
        const token = generateToken({
          userId: user.id,
          username: user.username,
          userType: "user",
        });
        if (token) {
          res.cookie("topsel_token", token, cookieOptions);
        }

        const { password, ...userWithoutPassword } = user;
        return res.json({
          ...userWithoutPassword,
          token: token,
          _dev: isDevelopment ? {
            message: '개발 환경: 토큰을 응답에 포함했습니다',
            cookieSet: !!token,
            tokenPreview: token ? token.substring(0, 20) + '...' : null
          } : undefined
        });
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

        // JWT 토큰 발급
        const token = generateToken({
          userId: member.id,
          username: member.username,
          userType: "member",
          grade: member.grade,
          companyName: member.companyName,
        });
        if (token) {
          res.cookie("topsel_token", token, cookieOptions);
        }

        const { password, ...memberWithoutPassword } = member;
        return res.json({
          ...memberWithoutPassword,
          role: "member",
          token: token,
          _dev: isDevelopment ? {
            message: '개발 환경: 토큰을 응답에 포함했습니다',
            cookieSet: !!token,
            tokenPreview: token ? token.substring(0, 20) + '...' : null
          } : undefined
        });
      }
      
      // If not found in users or members, try vendors table (partner login)
      const bcryptModule = await import("bcryptjs");
      const [vendor] = await db.select().from(vendors).where(eq(vendors.loginId, data.username)).limit(1);
      if (vendor && vendor.loginPassword) {
        const validVendor = await bcryptModule.compare(data.password, vendor.loginPassword);
        if (validVendor) {
          if (!vendor.isActive) {
            return res.status(401).json({ message: "비활성 계정입니다. 관리자에게 문의해 주세요." });
          }

          // 파트너 JWT 토큰 발급
          const JWT_SECRET = process.env.JWT_SECRET;
          if (JWT_SECRET) {
            const jwt = await import("jsonwebtoken");
            const partnerToken = jwt.default.sign(
              {
                vendorId: vendor.id,
                loginId: vendor.loginId,
                companyName: vendor.companyName,
                userType: "vendor",
              },
              JWT_SECRET,
              { expiresIn: "7d" }
            );
            res.cookie("partner_token", partnerToken, {
              httpOnly: true,
              secure: isProduction,
              sameSite: isProduction ? "strict" as const : "lax" as const,
              maxAge: 7 * 24 * 60 * 60 * 1000,
              path: "/",
            });
          }

          const { loginPassword: _lp, ...vendorData } = vendor;
          return res.json({
            ...vendorData,
            role: "vendor",
            redirectTo: "/partner",
          });
        }
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
      res.clearCookie("topsel_token", { path: "/" });
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

    try {
      const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
      
      if (startDate || endDate) {
        const dateCondition = buildDateCondition(orders, startDate, endDate);
        const filteredOrders = await db.select().from(orders)
          .where(dateCondition!)
          .orderBy(desc(orders.createdAt));
        return res.json(filteredOrders);
      }
      
      const allOrders = await storage.getAllOrders();
      return res.json(allOrders);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
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

  // Seed default icons to gallery
  app.post("/api/admin/images/seed-icons", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user || user.role !== "SUPER_ADMIN") {
      return res.status(403).json({ message: "Super admin access required" });
    }

    const defaultIcons = [
      { name: "rocket", svg: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"></path><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"></path><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"></path><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"></path></svg>' },
      { name: "crown", svg: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"></path></svg>' },
      { name: "target", svg: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>' },
      { name: "medal", svg: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#eab308" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15"></path><path d="M11 12 5.12 2.2"></path><path d="m13 12 5.88-9.8"></path><path d="M8 7h8"></path><circle cx="12" cy="17" r="5"></circle><path d="M12 18v-2h-.5"></path></svg>' },
      { name: "thumbs-up", svg: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10v12"></path><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z"></path></svg>' },
      { name: "clock", svg: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>' },
      { name: "truck", svg: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 17h4V5H2v12h3"></path><path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5v8h1"></path><circle cx="7.5" cy="17.5" r="2.5"></circle><circle cx="17.5" cy="17.5" r="2.5"></circle></svg>' },
      { name: "headphones", svg: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#ec4899" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"></path></svg>' },
      { name: "globe", svg: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" x2="22" y1="12" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>' },
      { name: "shopping-cart", svg: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#f97316" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="21" r="1"></circle><circle cx="19" cy="21" r="1"></circle><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"></path></svg>' },
      { name: "wallet", svg: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"></path><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"></path><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"></path></svg>' },
      { name: "book-open", svg: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>' },
      { name: "sparkles", svg: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"></path><path d="M5 3v4"></path><path d="M19 17v4"></path><path d="M3 5h4"></path><path d="M17 19h4"></path></svg>' },
      { name: "lock", svg: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>' },
      { name: "phone", svg: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>' },
      { name: "mail", svg: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"></rect><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path></svg>' },
      { name: "calendar", svg: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#ec4899" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"></rect><line x1="16" x2="16" y1="2" y2="6"></line><line x1="8" x2="8" y1="2" y2="6"></line><line x1="3" x2="21" y1="10" y2="10"></line></svg>' },
      { name: "home", svg: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>' },
      { name: "settings", svg: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>' },
      { name: "dollar-sign", svg: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="2" y2="22"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>' },
      { name: "percent", svg: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" x2="5" y1="5" y2="19"></line><circle cx="6.5" cy="6.5" r="2.5"></circle><circle cx="17.5" cy="17.5" r="2.5"></circle></svg>' },
      { name: "message-circle", svg: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"></path></svg>' },
      { name: "bell", svg: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path></svg>' },
      { name: "flag", svg: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" x2="4" y1="22" y2="15"></line></svg>' },
      { name: "map-pin", svg: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path><circle cx="12" cy="10" r="3"></circle></svg>' },
      { name: "lightbulb", svg: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#eab308" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"></path><path d="M9 18h6"></path><path d="M10 22h4"></path></svg>' },
      { name: "battery", svg: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="10" x="2" y="7" rx="2" ry="2"></rect><line x1="22" x2="22" y1="11" y2="13"></line><line x1="6" x2="6" y1="11" y2="13"></line><line x1="10" x2="10" y1="11" y2="13"></line><line x1="14" x2="14" y1="11" y2="13"></line></svg>' },
      { name: "wifi", svg: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13a10 10 0 0 1 14 0"></path><path d="M8.5 16.5a5 5 0 0 1 7 0"></path><path d="M2 8.82a15 15 0 0 1 20 0"></path><line x1="12" x2="12.01" y1="20" y2="20"></line></svg>' },
      { name: "coffee", svg: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#78350f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 8h1a4 4 0 1 1 0 8h-1"></path><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"></path><line x1="6" x2="6" y1="2" y2="4"></line><line x1="10" x2="10" y1="2" y2="4"></line><line x1="14" x2="14" y1="2" y2="4"></line></svg>' },
    ];

    try {
      let created = 0;
      for (const icon of defaultIcons) {
        const svgBuffer = Buffer.from(icon.svg, 'utf-8');
        const { storagePath, publicUrl } = await uploadImage(
          svgBuffer,
          `${icon.name}.svg`,
          'image/svg+xml',
          '아이콘'
        );

        await storage.createImage({
          filename: `${icon.name}.svg`,
          storagePath,
          publicUrl,
          category: '아이콘',
          subcategory: '기본',
          width: 64,
          height: 64,
          fileSize: svgBuffer.length,
          mimeType: 'image/svg+xml',
        });
        created++;
      }
      return res.json({ message: `${created}개의 기본 아이콘이 생성되었습니다` });
    } catch (error) {
      console.error("Icon seed error:", error);
      return res.status(500).json({ message: "아이콘 생성 실패" });
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

  // 약관 동의 기록 조회 API
  app.get("/api/admin/term-agreements", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user || !isAdmin(user.role)) {
      return res.status(403).json({ message: "Admin access required" });
    }

    const agreements = await db.select().from(termAgreements).orderBy(desc(termAgreements.agreedAt));
    return res.json(agreements);
  });

  // 특정 약관 동의 기록 상세 조회 API
  app.get("/api/admin/term-agreements/:id", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user || !isAdmin(user.role)) {
      return res.status(403).json({ message: "Admin access required" });
    }

    const [agreement] = await db.select().from(termAgreements).where(eq(termAgreements.id, req.params.id));
    if (!agreement) {
      return res.status(404).json({ message: "Agreement not found" });
    }
    return res.json(agreement);
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

  // 포트원 V2 설정 API (프론트엔드용)
  app.get("/api/config/portone", async (req, res) => {
    res.json({ 
      storeId: PORTONE_STORE_ID,
      channelKey: PORTONE_CHANNEL_KEY,
      configured: !!(PORTONE_STORE_ID && PORTONE_CHANNEL_KEY && PORTONE_API_SECRET)
    });
  });

  // 카카오채널 설정 API (프론트엔드용 - 회원가입 친구추가)
  app.get("/api/config/kakao-channel", async (req, res) => {
    const channelId = process.env.KAKAO_CHANNEL_PUBLIC_ID || '';
    res.json({ 
      channelId,
      configured: !!channelId
    });
  });

  // 포트원 V2 본인인증 검증 API
  app.post("/api/auth/get-certification", async (req, res) => {
    console.log('\x1b[36m📱 [본인인증 V2] 요청 수신\x1b[0m');
    
    try {
      const { identityVerificationId } = req.body;
      console.log('   - identityVerificationId:', identityVerificationId);
      
      if (!identityVerificationId) {
        console.log('\x1b[31m   ❌ identityVerificationId 누락\x1b[0m');
        return res.status(400).json({ 
          success: false, 
          message: "identityVerificationId가 필요합니다" 
        });
      }

      if (!PORTONE_API_SECRET) {
        console.log('\x1b[31m   ❌ 포트원 V2 API Secret 미설정\x1b[0m');
        return res.status(500).json({ 
          success: false, 
          message: "포트원 API Secret이 설정되지 않았습니다" 
        });
      }

      // 포트원 V2 API 직접 호출 (토큰 발급 불필요)
      console.log('   - 포트원 V2 인증 정보 조회 중...');
      const certResponse = await axios.get(
        `https://api.portone.io/identity-verifications/${encodeURIComponent(identityVerificationId)}`,
        {
          headers: { 
            Authorization: `PortOne ${PORTONE_API_SECRET}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const certData = certResponse.data;
      console.log('   - 인증 응답:', JSON.stringify(certData, null, 2));

      // V2 API 응답 구조 확인
      if (!certData.verifiedCustomer) {
        console.log('\x1b[31m   ❌ 인증 정보 없음 (verifiedCustomer 누락)\x1b[0m');
        return res.status(500).json({ 
          success: false, 
          message: "인증 정보를 찾을 수 없습니다" 
        });
      }

      const verifiedCustomer = certData.verifiedCustomer;
      console.log('\x1b[32m   ✅ 본인인증 V2 성공:', verifiedCustomer.name, '\x1b[0m');

      // 클라이언트 응답
      return res.json({
        success: true,
        name: verifiedCustomer.name || '',
        phone: verifiedCustomer.phoneNumber || '',
        birth: verifiedCustomer.birthDate ? verifiedCustomer.birthDate.replace(/-/g, '') : '',
        ci: verifiedCustomer.ci || ''
      });

    } catch (error: any) {
      console.error("\x1b[31m   ❌ PortOne V2 certification error:", error.response?.data || error.message, '\x1b[0m');
      return res.status(500).json({ 
        success: false, 
        message: "본인인증 처리 중 오류가 발생했습니다",
        error: error.response?.data || error.message
      });
    }
  });

  // Admin: Quick register member
  app.post("/api/admin/members/quick-register", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user || !isAdmin(user.role)) {
      return res.status(403).json({ message: "Admin access required" });
    }

    try {
      const quickRegisterSchema = z.object({
        companyName: z.string().min(1, "상호명을 입력해주세요"),
        username: z.string().min(3, "아이디는 3자 이상이어야 합니다"),
        password: z.string().min(6, "비밀번호는 6자 이상이어야 합니다"),
        businessNumber: z.string().min(1, "사업자번호를 입력해주세요"),
        representative: z.string().min(1, "대표자명을 입력해주세요"),
        phone: z.string().min(1, "연락처를 입력해주세요"),
        email: z.string().optional(),
        grade: z.string().default("PENDING"),
      });

      const data = quickRegisterSchema.parse(req.body);

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
        email: data.email || undefined,
        grade: data.grade,
        status: "활성",
      });

      await storage.createMemberLog({
        memberId: member.id,
        changedBy: user.id,
        changeType: "생성",
        description: "관리자 간편 등록",
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
      
      if (data.memberName !== undefined && data.memberName !== (targetMember.memberName || '')) {
        updateData.memberName = data.memberName;
        changes.push(`회원명: ${targetMember.memberName || '(없음)'} → ${data.memberName || '(없음)'}`);
      }
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
      if (typeof (req.body as any).postOfficeEnabled === 'boolean' && (req.body as any).postOfficeEnabled !== targetMember.postOfficeEnabled) {
        updateData.postOfficeEnabled = (req.body as any).postOfficeEnabled;
        changes.push(`우체국 양식: ${(req.body as any).postOfficeEnabled ? '사용' : '미사용'}`);
      }
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
        postOfficeEnabled: data.postOfficeEnabled,
      });

      const changes: string[] = [];
      if (data.grade) changes.push(`등급: ${data.grade}`);
      if (data.depositAdjust) changes.push(`예치금 조정: ${data.depositAdjust > 0 ? '+' : ''}${data.depositAdjust.toLocaleString()}원`);
      if (data.pointAdjust) changes.push(`포인트 조정: ${data.pointAdjust > 0 ? '+' : ''}${data.pointAdjust.toLocaleString()}`);
      if (data.memoAdd) changes.push(`메모 추가`);
      if (typeof data.postOfficeEnabled === 'boolean') changes.push(`우체국 양식: ${data.postOfficeEnabled ? '사용' : '미사용'}`);

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

    try {
      const retentionDate = new Date();
      retentionDate.setFullYear(retentionDate.getFullYear() + 3);

      const [deletedMember] = await db.insert(deletedMembers).values({
        originalMemberId: member.id,
        username: member.username,
        companyName: member.companyName,
        businessNumber: member.businessNumber || null,
        representative: member.representative || null,
        phone: member.phone || null,
        email: member.email || null,
        address: member.businessAddress || null,
        detailAddress: null,
        grade: member.grade,
        deposit: member.deposit,
        point: member.point,
        status: member.status,
        memo: member.memo || null,
        signatureData: member.signatureData || null,
        deletedBy: req.session.userId,
        retentionUntil: retentionDate,
        originalCreatedAt: member.createdAt,
      }).returning();

      const memberOrders = await db.select().from(orders).where(eq(orders.userId, member.id));
      if (memberOrders.length > 0) {
        for (const order of memberOrders) {
          await db.insert(deletedMemberOrders).values({
            deletedMemberId: deletedMember.id,
            originalOrderId: order.id,
            productName: order.productName,
            quantity: order.quantity,
            price: order.price,
            recipientName: order.recipientName,
            recipientPhone: order.recipientPhone,
            recipientAddress: order.recipientAddress,
            orderCreatedAt: order.createdAt,
          });
        }
      }

      await db.update(termAgreements)
        .set({ memberStatus: "deleted", memberId: null })
        .where(eq(termAgreements.memberId, member.id));

      await storage.deleteMember(req.params.id);
      
      return res.json({ message: "회원이 삭제되었습니다. 탈퇴 회원 정보와 거래 내역은 3년간 보관됩니다." });
    } catch (error) {
      console.error("Member deletion error:", error);
      return res.status(500).json({ message: "회원 삭제 중 오류가 발생했습니다" });
    }
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
    
    const validatedProds = await Promise.all(prods.map(async (p) => {
      if (p.isVendorProduct) {
        const vendorMappings = await storage.getProductVendorsByProductCode(p.productCode);
        return { ...p, mappingStatus: vendorMappings.length > 0 ? "complete" : "incomplete" };
      }
      if (p.mappingStatus === "complete") {
        const materialMappings = await storage.getProductMaterialMappings(p.productCode);
        
        if (materialMappings.length === 0) {
          return { ...p, mappingStatus: "incomplete" };
        }
        
        for (const mm of materialMappings) {
          const material = await storage.getMaterialByCode(mm.materialCode);
          if (!material) {
            return { ...p, mappingStatus: "incomplete" };
          }
        }
      }
      return p;
    }));
    
    return res.json(validatedProds);
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
    
    const unmappedProducts: { productCode: string; productName: string; categoryLarge?: string | null; categoryMedium?: string | null; categorySmall?: string | null; reason?: string }[] = [];
    const mappedProducts: { productCode: string; productName: string }[] = [];
    
    // Get all registrations once for efficiency
    const registrations = await storage.getAllProductRegistrations();
    
    for (const productCode of productCodes) {
      const registration = registrations.find(r => r.productCode === productCode);
      const productName = registration?.productName || productCode;
      
      if (registration?.isVendorProduct) {
        const vendorMappings = await storage.getProductVendorsByProductCode(productCode);
        if (vendorMappings.length === 0) {
          unmappedProducts.push({ 
            productCode, 
            productName,
            categoryLarge: registration?.categoryLarge || null,
            categoryMedium: registration?.categoryMedium || null,
            categorySmall: registration?.categorySmall || null,
            reason: "외주업체 매핑 없음",
          });
        } else {
          mappedProducts.push({ productCode, productName });
        }
      } else {
        const mapping = await storage.getProductMappingByCode(productCode);
        
        if (!mapping || mapping.mappingStatus !== "complete") {
          unmappedProducts.push({ 
            productCode, 
            productName,
            categoryLarge: registration?.categoryLarge || null,
            categoryMedium: registration?.categoryMedium || null,
            categorySmall: registration?.categorySmall || null,
            reason: !mapping ? "매핑 없음" : "매핑 미완료",
          });
        } else {
          const materialMappings = await storage.getProductMaterialMappings(productCode);
          
          if (materialMappings.length === 0) {
            unmappedProducts.push({ 
              productCode, 
              productName,
              categoryLarge: registration?.categoryLarge || null,
              categoryMedium: registration?.categoryMedium || null,
              categorySmall: registration?.categorySmall || null,
              reason: "매핑된 재료 없음",
            });
          } else {
            let hasMissingMaterial = false;
            const missingCodes: string[] = [];
            
            for (const mm of materialMappings) {
              const material = await storage.getMaterialByCode(mm.materialCode);
              if (!material) {
                hasMissingMaterial = true;
                missingCodes.push(mm.materialCode);
              }
            }
            
            if (hasMissingMaterial) {
              unmappedProducts.push({ 
                productCode, 
                productName,
                categoryLarge: registration?.categoryLarge || null,
                categoryMedium: registration?.categoryMedium || null,
                categorySmall: registration?.categorySmall || null,
                reason: `삭제된 재료: ${missingCodes.join(", ")}`,
              });
            } else {
              mappedProducts.push({ productCode, productName });
            }
          }
        }
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
    
    const invalidProducts: { productCode: string; productName: string; reason?: string }[] = [];
    const unmappedProducts: { productCode: string; productName: string; reason?: string }[] = [];
    const validProducts: any[] = [];
    
    // Validate all products first
    for (const id of ids) {
      const pr = await storage.getProductRegistration(id);
      if (!pr) continue;
      
      // 가격 검증
      if (!pr.startPrice || !pr.drivingPrice || !pr.topPrice) {
        invalidProducts.push({ productCode: pr.productCode, productName: pr.productName, reason: "공급가 누락" });
        continue;
      }
      
      // 외주상품 vs 자체상품 검증 분기
      if (pr.isVendorProduct) {
        const vendorMappings = await storage.getProductVendorsByProductCode(pr.productCode);
        if (vendorMappings.length === 0) {
          unmappedProducts.push({ productCode: pr.productCode, productName: pr.productName, reason: "외주업체 매핑 없음" });
          continue;
        }
      } else {
        const materialMappings = await storage.getProductMaterialMappings(pr.productCode);
        if (materialMappings.length === 0) {
          unmappedProducts.push({ productCode: pr.productCode, productName: pr.productName, reason: "매핑된 재료 없음" });
          continue;
        }
        
        let hasMissingMaterial = false;
        const missingCodes: string[] = [];
        for (const mm of materialMappings) {
          const material = await storage.getMaterialByCode(mm.materialCode);
          if (!material) {
            hasMissingMaterial = true;
            missingCodes.push(mm.materialCode);
          }
        }
        
        if (hasMissingMaterial) {
          unmappedProducts.push({ 
            productCode: pr.productCode, 
            productName: pr.productName, 
            reason: `삭제된 재료: ${missingCodes.join(", ")}` 
          });
          continue;
        }
      }
      
      validProducts.push(pr);
    }
    
    if (invalidProducts.length > 0) {
      return res.status(400).json({ 
        success: false,
        error: "MISSING_PRICE",
        message: `상품코드 [${invalidProducts[0].productCode}]의 공급가가 없습니다. 마진율을 입력해주세요.`,
        data: { invalidProducts }
      });
    }
    
    if (unmappedProducts.length > 0) {
      return res.status(400).json({ 
        success: false,
        error: "UNMAPPED_MATERIALS",
        message: `상품코드 [${unmappedProducts[0].productCode}]의 매핑이 완료되지 않았습니다. (${unmappedProducts[0].reason})`,
        data: { unmappedProducts }
      });
    }
    
    // Send to next_week_products
    let created = 0;
    let updated = 0;
    
    // 10원 단위 올림 함수
    const roundUpToTen = (value: number) => Math.ceil(value / 10) * 10;
    
    for (const pr of validProducts) {
      const existing = await storage.getNextWeekProductByCode(pr.productCode);
      
      const productData = {
        productCode: pr.productCode,
        productName: pr.productName,
        categoryLarge: pr.categoryLarge,
        categoryMedium: pr.categoryMedium,
        categorySmall: pr.categorySmall,
        weight: pr.weight,
        startPrice: roundUpToTen(pr.startPrice!),
        drivingPrice: roundUpToTen(pr.drivingPrice!),
        topPrice: roundUpToTen(pr.topPrice!),
        supplyStatus: "supply" as const,
        taxType: pr.taxType || "exempt",
        isVendorProduct: pr.isVendorProduct || false,
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
    
    const unmappedProducts: { productCode: string; productName: string; reason?: string }[] = [];
    const validProducts: any[] = [];
    
    for (const id of ids) {
      const product = await storage.getNextWeekProduct(id);
      if (!product) continue;
      
      const registration = await storage.getProductRegistrationByCode(product.productCode);
      
      if (registration?.isVendorProduct) {
        const vendorMappings = await storage.getProductVendorsByProductCode(product.productCode);
        if (vendorMappings.length === 0) {
          unmappedProducts.push({ productCode: product.productCode, productName: product.productName, reason: "외주업체 매핑 없음" });
          continue;
        }
      } else {
        const materialMappings = await storage.getProductMaterialMappings(product.productCode);
        if (materialMappings.length === 0) {
          unmappedProducts.push({ productCode: product.productCode, productName: product.productName, reason: "매핑된 재료 없음" });
          continue;
        }
        
        let hasMissingMaterial = false;
        const missingCodes: string[] = [];
        for (const mm of materialMappings) {
          const material = await storage.getMaterialByCode(mm.materialCode);
          if (!material) {
            hasMissingMaterial = true;
            missingCodes.push(mm.materialCode);
          }
        }
        
        if (hasMissingMaterial) {
          unmappedProducts.push({ 
            productCode: product.productCode, 
            productName: product.productName, 
            reason: `삭제된 재료: ${missingCodes.join(", ")}` 
          });
          continue;
        }
      }
      
      validProducts.push(product);
    }
    
    if (unmappedProducts.length > 0) {
      return res.status(400).json({ 
        success: false,
        error: "UNMAPPED_MATERIALS",
        message: `상품코드 [${unmappedProducts[0].productCode}]의 재료 매핑이 완료되지 않았습니다. (${unmappedProducts[0].reason})`,
        data: { unmappedProducts }
      });
    }
    
    let created = 0;
    let updated = 0;
    
    // 10원 단위 올림 함수 (이미 예상공급가에서 올림되었지만 안전하게 한번 더 적용)
    const roundUpToTen = (value: number) => Math.ceil(value / 10) * 10;
    
    for (const product of validProducts) {
      const existing = await storage.getCurrentProductByCode(product.productCode);
      const reg = await storage.getProductRegistrationByCode(product.productCode);
      const productData = {
        productCode: product.productCode,
        productName: product.productName,
        categoryLarge: product.categoryLarge,
        categoryMedium: product.categoryMedium,
        categorySmall: product.categorySmall,
        weight: product.weight,
        startPrice: roundUpToTen(product.startPrice),
        drivingPrice: roundUpToTen(product.drivingPrice),
        topPrice: roundUpToTen(product.topPrice),
        supplyStatus: "supply" as const,
        taxType: product.taxType || reg?.taxType || "exempt",
        isVendorProduct: reg?.isVendorProduct || product.isVendorProduct || false,
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
      message: `${validProducts.length}개 상품이 현재 공급가로 적용되었습니다.`,
      data: { total: validProducts.length, updated, created }
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
    const unmappedProducts: { productCode: string; productName: string; reason?: string }[] = [];
    const validProducts: any[] = [];
    
    for (const product of allProducts) {
      const registration = await storage.getProductRegistrationByCode(product.productCode);
      
      if (registration?.isVendorProduct || product.isVendorProduct) {
        const vendorMappings = await storage.getProductVendorsByProductCode(product.productCode);
        if (vendorMappings.length === 0) {
          unmappedProducts.push({ productCode: product.productCode, productName: product.productName, reason: "외주업체 매핑 없음" });
          continue;
        }
      } else {
        const materialMappings = await storage.getProductMaterialMappings(product.productCode);
        if (materialMappings.length === 0) {
          unmappedProducts.push({ productCode: product.productCode, productName: product.productName, reason: "매핑된 재료 없음" });
          continue;
        }
        
        let hasMissingMaterial = false;
        const missingCodes: string[] = [];
        for (const mm of materialMappings) {
          const material = await storage.getMaterialByCode(mm.materialCode);
          if (!material) {
            hasMissingMaterial = true;
            missingCodes.push(mm.materialCode);
          }
        }
        
        if (hasMissingMaterial) {
          unmappedProducts.push({ 
            productCode: product.productCode, 
            productName: product.productName, 
            reason: `삭제된 재료: ${missingCodes.join(", ")}` 
          });
          continue;
        }
      }
      
      validProducts.push(product);
    }
    
    if (unmappedProducts.length > 0) {
      return res.status(400).json({ 
        success: false,
        error: "UNMAPPED_MATERIALS",
        message: `매핑이 완료되지 않은 상품이 ${unmappedProducts.length}개 있습니다.`,
        data: { unmappedProducts }
      });
    }
    
    let created = 0;
    let updated = 0;
    
    const roundUpToTen = (value: number) => Math.ceil(value / 10) * 10;
    
    for (const product of validProducts) {
      const existing = await storage.getCurrentProductByCode(product.productCode);
      const reg = await storage.getProductRegistrationByCode(product.productCode);
      const productData = {
        productCode: product.productCode,
        productName: product.productName,
        categoryLarge: product.categoryLarge,
        categoryMedium: product.categoryMedium,
        categorySmall: product.categorySmall,
        weight: product.weight,
        startPrice: roundUpToTen(product.startPrice),
        drivingPrice: roundUpToTen(product.drivingPrice),
        topPrice: roundUpToTen(product.topPrice),
        supplyStatus: "supply" as const,
        taxType: product.taxType || reg?.taxType || "exempt",
        isVendorProduct: reg?.isVendorProduct || product.isVendorProduct || false,
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
      message: `${validProducts.length}개 상품이 현재 공급가로 적용되었습니다.`,
      data: { total: validProducts.length, updated, created }
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
  // 재료 타입 API (Material Types)
  // ========================================

  app.get("/api/material-types", async (req, res) => {
    const { active } = req.query;
    if (active === "true") {
      const types = await storage.getActiveMaterialTypes();
      return res.json(types);
    }
    const types = await storage.getAllMaterialTypes();
    return res.json(types);
  });

  app.get("/api/material-types/:id", async (req, res) => {
    const type = await storage.getMaterialType(req.params.id);
    if (!type) {
      return res.status(404).json({ message: "재료타입을 찾을 수 없습니다" });
    }
    return res.json(type);
  });

  app.post("/api/material-types", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }
    const { code, name, description, sortOrder, isActive } = req.body;
    if (!code || !name) {
      return res.status(400).json({ message: "코드와 이름은 필수입니다" });
    }
    const existing = await storage.getMaterialTypeByCode(code);
    if (existing) {
      return res.status(400).json({ message: "이미 존재하는 코드입니다" });
    }
    const type = await storage.createMaterialType({ 
      code, 
      name, 
      description: description || null,
      sortOrder: sortOrder || 0,
      isActive: isActive !== false
    });
    return res.json(type);
  });

  app.put("/api/material-types/:id", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }
    const { code, name, description, sortOrder, isActive } = req.body;
    if (code) {
      const existing = await storage.getMaterialTypeByCode(code);
      if (existing && existing.id !== req.params.id) {
        return res.status(400).json({ message: "이미 존재하는 코드입니다" });
      }
    }
    const updated = await storage.updateMaterialType(req.params.id, { 
      code, 
      name, 
      description, 
      sortOrder, 
      isActive 
    });
    if (!updated) {
      return res.status(404).json({ message: "재료타입을 찾을 수 없습니다" });
    }
    return res.json(updated);
  });

  app.delete("/api/material-types/:id", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }
    const deleted = await storage.deleteMaterialType(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "재료타입을 찾을 수 없습니다" });
    }
    return res.json({ success: true, message: "재료타입이 삭제되었습니다." });
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
    const { materialType, largeCategoryId, mediumCategoryId, smallCategoryId, materialName, currentStock } = req.body;
    const updated = await storage.updateMaterial(req.params.id, {
      materialType,
      largeCategoryId,
      mediumCategoryId,
      smallCategoryId: smallCategoryId || null,
      materialName,
      currentStock: currentStock !== undefined ? currentStock : undefined,
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
    
    // 매핑된 재료가 있는지 확인
    const mappedMaterials: { materialCode: string; materialName: string; products: string[] }[] = [];
    for (const id of ids) {
      const material = await storage.getMaterial(id);
      if (material) {
        const mappings = await storage.getMappingsByMaterialCode(material.materialCode);
        if (mappings.length > 0) {
          const productCodes = Array.from(new Set(mappings.map(m => m.productCode)));
          mappedMaterials.push({
            materialCode: material.materialCode,
            materialName: material.materialName,
            products: productCodes,
          });
        }
      }
    }
    
    if (mappedMaterials.length > 0) {
      const details = mappedMaterials.map(m => 
        `"${m.materialName}" (${m.materialCode}) → 상품: ${m.products.join(", ")}`
      ).join("\n");
      return res.status(400).json({ 
        message: `${mappedMaterials.length}개 재료가 상품에 매핑되어 있어 삭제할 수 없습니다.\n\n먼저 상품관리 > 상품등록(공급가계산) 에서 해당 재료의 매핑을 해제하세요.`,
        mappedCount: mappedMaterials.length,
        mappedMaterials,
        details,
      });
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
    
    // 재료 정보 조회
    const material = await storage.getMaterial(req.params.id);
    if (!material) {
      return res.status(404).json({ message: "재료를 찾을 수 없습니다" });
    }
    
    // 해당 재료가 상품에 매핑되어 있는지 확인
    const mappings = await storage.getMappingsByMaterialCode(material.materialCode);
    if (mappings.length > 0) {
      const productCodes = Array.from(new Set(mappings.map(m => m.productCode)));
      return res.status(400).json({ 
        message: `이 재료는 ${productCodes.length}개 상품에 매핑되어 있어 삭제할 수 없습니다.\n\n먼저 상품관리 > 상품등록(공급가계산) 에서 해당 재료의 매핑을 해제하세요.`,
        mappedProducts: productCodes,
      });
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
      
      // DB에서 활성 재료타입 조회
      const activeMaterialTypes = await storage.getActiveMaterialTypes();
      const typeNames = activeMaterialTypes.map(t => t.name);
      const firstType = typeNames[0] || "원재료";
      const secondType = typeNames[1] || "반재료";
      const thirdType = typeNames[2] || "부재료";
      
      const headers = ["재료타입", "대분류", "중분류", "소분류", "재료코드", "재료명", "초기재고"];
      const sampleData = [
        [firstType, "사과", "부사", "고급", "R001", "부사 정품 4다이(원물)", 0],
        [firstType, "사과", "부사", "", "R002", "부사 상2번(원물)", 0],
        [secondType, "사과", "부사", "일반", "S001", "부사 상2번(선별)", 0],
        [thirdType, "박스", "선물용", "", "B001", "3kg 선물박스", 0],
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
      
      // DB에서 재료타입 목록 조회하여 동적으로 매핑
      const activeMaterialTypes = await storage.getActiveMaterialTypes();
      const materialTypeMap: Record<string, string> = {};
      const validTypeNames: string[] = [];
      for (const mt of activeMaterialTypes) {
        materialTypeMap[mt.name] = mt.code;
        validTypeNames.push(mt.name);
      }

      // 1단계: 모든 행 검증 (등록 전 전체 검증)
      interface ValidatedRow {
        materialType: string;
        largeCategoryId: string;
        mediumCategoryId: string;
        smallCategoryId: string | null;
        materialCode: string;
        materialName: string;
        currentStock: number;
      }
      const validatedRows: ValidatedRow[] = [];
      const codeSet = new Set<string>(); // 파일 내 중복 코드 체크용

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length < 6) continue;
        
        const [재료타입, 대분류, 중분류, 소분류, 재료코드, 재료명, 초기재고] = row;
        const rowNum = i + 1; // 엑셀 행 번호 (헤더 포함)
        
        // 필수값 검증
        if (!재료타입 || !대분류 || !중분류 || !재료명) {
          errors.push({ row: rowNum, error: "필수값 누락 (재료타입, 대분류, 중분류, 재료명)" });
          continue;
        }

        // 재료타입 검증
        const materialType = materialTypeMap[String(재료타입)];
        if (!materialType) {
          const validTypesStr = validTypeNames.join("/") || "등록된 재료타입 없음";
          errors.push({ row: rowNum, error: `재료타입이 올바르지 않습니다: "${재료타입}" (${validTypesStr} 중 선택)` });
          continue;
        }

        // 재료코드 중복 검증 (DB 및 파일 내)
        const codeStr = 재료코드 ? String(재료코드).trim() : "";
        if (codeStr) {
          // 파일 내 중복 체크
          if (codeSet.has(codeStr)) {
            errors.push({ row: rowNum, error: `파일 내 재료코드 중복: "${codeStr}"` });
            continue;
          }
          codeSet.add(codeStr);
          
          // DB 중복 체크
          const existing = await storage.getMaterialByCode(codeStr);
          if (existing) {
            errors.push({ row: rowNum, error: `이미 등록된 재료코드: "${codeStr}"` });
            continue;
          }
        }

        // 대분류 검증
        const largeCategory = await storage.getMaterialCategoryLargeByName(String(대분류));
        if (!largeCategory) {
          errors.push({ row: rowNum, error: `대분류 카테고리 없음: "${대분류}" (미리 등록된 카테고리만 사용 가능)` });
          continue;
        }

        // 중분류 검증
        const mediumCategory = await storage.getMaterialCategoryMediumByName(largeCategory.id, String(중분류));
        if (!mediumCategory) {
          const allMediumCategories = await storage.getAllMaterialCategoriesMedium();
          const existsElsewhere = allMediumCategories.find(m => m.name === String(중분류));
          if (existsElsewhere) {
            errors.push({ row: rowNum, error: `카테고리 불일치: 중분류 "${중분류}"가 대분류 "${대분류}" 하위에 없습니다` });
          } else {
            errors.push({ row: rowNum, error: `중분류 카테고리 없음: "${중분류}" (미리 등록된 카테고리만 사용 가능)` });
          }
          continue;
        }

        // 소분류 검증 (선택사항)
        let smallCategoryId: string | null = null;
        if (소분류 && String(소분류).trim()) {
          const smallCategory = await storage.getMaterialCategorySmallByName(mediumCategory.id, String(소분류));
          if (!smallCategory) {
            const allSmallCategories = await storage.getAllMaterialCategoriesSmall();
            const existsElsewhere = allSmallCategories.find(s => s.name === String(소분류));
            if (existsElsewhere) {
              errors.push({ row: rowNum, error: `카테고리 불일치: 소분류 "${소분류}"가 중분류 "${중분류}" 하위에 없습니다` });
            } else {
              errors.push({ row: rowNum, error: `소분류 카테고리 없음: "${소분류}" (미리 등록된 카테고리만 사용 가능)` });
            }
            continue;
          }
          smallCategoryId = smallCategory.id;
        }

        // 재료코드 자동생성 (입력 안 된 경우)
        const finalCode = codeStr || await storage.getNextMaterialCode(materialType);
        
        // 검증 통과한 행 저장
        validatedRows.push({
          materialType,
          largeCategoryId: largeCategory.id,
          mediumCategoryId: mediumCategory.id,
          smallCategoryId,
          materialCode: finalCode,
          materialName: String(재료명),
          currentStock: parseFloat(String(초기재고 || 0)) || 0,
        });
      }

      // 2단계: 오류가 있으면 전체 업로드 거부
      if (errors.length > 0) {
        const errorDetails = errors.map(e => `[${e.row}행] ${e.error}`).join("\n");
        return res.status(400).json({
          success: false,
          message: `업로드 실패: ${errors.length}개 오류 발견\n\n오류를 수정한 후 다시 업로드해 주세요.`,
          errorCount: errors.length,
          totalRows: validatedRows.length + errors.length,
          errors,
          errorDetails,
        });
      }

      // 3단계: 모든 검증 통과 시 일괄 등록
      if (validatedRows.length === 0) {
        return res.status(400).json({
          success: false,
          message: "등록할 데이터가 없습니다. 엑셀 파일을 확인해 주세요.",
        });
      }

      let created = 0;
      for (const row of validatedRows) {
        await storage.createMaterial(row);
        created++;
      }

      return res.json({
        success: true,
        message: `${created}개 재료가 성공적으로 등록되었습니다.`,
        created,
        errors: [],
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
      
      // 매핑된 재료가 실제로 존재하는지 확인하여 실제 매핑 상태 계산
      let actualMappingStatus = m.mappingStatus;
      let missingMaterials: string[] = [];
      
      if (materialMappings.length > 0) {
        // 각 매핑된 재료가 materials 테이블에 존재하는지 확인
        for (const mm of materialMappings) {
          const material = await storage.getMaterialByCode(mm.materialCode);
          if (!material) {
            missingMaterials.push(mm.materialCode);
          }
        }
        
        // 누락된 재료가 있으면 매핑 미완료로 변경
        if (missingMaterials.length > 0) {
          actualMappingStatus = "incomplete";
        } else if (m.mappingStatus === "incomplete" && materialMappings.length > 0) {
          // 모든 재료가 존재하면 완료로 변경
          actualMappingStatus = "complete";
        }
      } else {
        // 매핑된 재료가 없으면 미완료
        actualMappingStatus = "incomplete";
      }
      
      return { 
        ...m, 
        materials: materialMappings, 
        mappingStatus: actualMappingStatus,
        missingMaterials: missingMaterials.length > 0 ? missingMaterials : undefined,
      };
    }));
    return res.json(result);
  });

  // 상품등록에서 가져올 수 있는 상품 목록 (이미 매핑된 상품 제외)
  app.get("/api/product-mappings/available-products", async (req, res) => {
    const allProductRegs = await storage.getAllProductRegistrations("active");
    const existingMappings = await storage.getAllProductMappings();
    const existingCodes = new Set(existingMappings.map(m => m.productCode));
    
    const availableProducts = allProductRegs.filter(p => !existingCodes.has(p.productCode));
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
    
    // 매핑된 재료가 실제로 존재하는지 확인하여 실제 매핑 상태 계산
    let actualMappingStatus = mapping.mappingStatus;
    let missingMaterials: string[] = [];
    
    if (materials.length > 0) {
      for (const mm of materials) {
        const material = await storage.getMaterialByCode(mm.materialCode);
        if (!material) {
          missingMaterials.push(mm.materialCode);
        }
      }
      
      if (missingMaterials.length > 0) {
        actualMappingStatus = "incomplete";
      } else if (mapping.mappingStatus === "incomplete" && materials.length > 0) {
        actualMappingStatus = "complete";
      }
    } else {
      actualMappingStatus = "incomplete";
    }
    
    return res.json({ 
      ...mapping, 
      materials, 
      mappingStatus: actualMappingStatus,
      missingMaterials: missingMaterials.length > 0 ? missingMaterials : undefined,
    });
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
    
    // 매핑 상태 검증: 매핑된 재료가 실제로 존재하는지 확인
    const result = await Promise.all(mappings.map(async (m) => {
      let actualMappingStatus = m.mappingStatus;
      
      if (m.mappingStatus === "complete") {
        const materialMappings = await storage.getProductMaterialMappings(m.productCode);
        
        if (materialMappings.length === 0) {
          actualMappingStatus = "incomplete";
        } else {
          for (const mm of materialMappings) {
            const material = await storage.getMaterialByCode(mm.materialCode);
            if (!material) {
              actualMappingStatus = "incomplete";
              break;
            }
          }
        }
      }
      
      return {
        ...m,
        mappingStatus: actualMappingStatus,
        currentStock: stockMap.get(m.productCode) || 0,
      };
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
    
    const XLSX = await import("xlsx");
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
      "일시": h.createdAt ? new Date(h.createdAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) : "",
    }));
    
    const worksheet = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, "재고이력");
    
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
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

  // Get page by path (public - for dynamic page rendering)
  // IMPORTANT: This route MUST be before /api/pages/:id to avoid being caught by the wildcard
  app.get("/api/pages/by-path", async (req, res) => {
    try {
      const path = req.query.path as string;
      if (!path) {
        return res.status(400).json({ message: "path 파라미터가 필요합니다" });
      }
      const allPages = await storage.getAllPages();
      const page = allPages.find(p => p.path === path);
      if (!page) {
        return res.status(404).json({ message: "페이지를 찾을 수 없습니다" });
      }
      
      // Non-active pages require authentication
      if (page.status !== "active") {
        if (!req.session.userId) {
          return res.status(404).json({ message: "페이지를 찾을 수 없습니다" });
        }
      }
      
      // 접근권한 체크 (pageAccessLevelRank 기반 계층 구조)
      const { getUserAccessRank, canAccessPage } = await import("@shared/schema");
      const requiredLevel = page.accessLevel || "all";
      
      if (requiredLevel !== "all") {
        if (!req.session.userId) {
          return res.status(403).json({ message: "이 페이지에 접근하려면 로그인이 필요합니다" });
        }
        
        let userInfo: { role?: string; grade?: string } = {};
        if (req.session.userType === "member") {
          const member = await storage.getMember(req.session.userId);
          if (member) {
            userInfo = { grade: member.grade };
          }
        } else {
          const user = await storage.getUser(req.session.userId);
          if (user) {
            userInfo = { role: user.role };
          }
        }
        
        const userRank = getUserAccessRank(userInfo);
        if (!canAccessPage(userRank, requiredLevel)) {
          return res.status(403).json({ message: "이 페이지에 접근할 권한이 없습니다", pageAccessLevelRank: userRank });
        }
      }
      
      res.json(page);
    } catch (error) {
      console.error("Failed to get page by path:", error);
      res.status(500).json({ error: "Failed to get page" });
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
      const { adminOnlyCategories } = await import("@shared/schema");
      if (adminOnlyCategories.includes(validatedData.category)) {
        if (validatedData.accessLevel !== "ADMIN" && validatedData.accessLevel !== "SUPER_ADMIN") {
          validatedData.accessLevel = "ADMIN";
        }
      }
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
      const { adminOnlyCategories } = await import("@shared/schema");
      const category = validatedData.category || (await storage.getPage(req.params.id))?.category;
      if (category && adminOnlyCategories.includes(category)) {
        if (validatedData.accessLevel && validatedData.accessLevel !== "ADMIN" && validatedData.accessLevel !== "SUPER_ADMIN") {
          validatedData.accessLevel = "ADMIN";
        }
      }
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

  // Update page content (admin only)
  app.patch("/api/pages/:id/content", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }
    
    try {
      const { content } = req.body;
      const page = await storage.updatePage(req.params.id, { content });
      if (!page) {
        return res.status(404).json({ message: "페이지를 찾을 수 없습니다" });
      }
      res.json(page);
    } catch (error) {
      console.error("Failed to update page content:", error);
      res.status(500).json({ error: "Failed to update page content" });
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

  // ==================== Announcements Management ====================
  // Get latest announcements (public)
  app.get("/api/announcements/latest", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 5;
      const announcements = await storage.getLatestAnnouncements(limit);
      res.json(announcements);
    } catch (error) {
      console.error("Failed to get latest announcements:", error);
      res.status(500).json({ error: "Failed to get announcements" });
    }
  });

  // Get all announcements (admin only)
  app.get("/api/announcements", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }
    
    try {
      const announcements = await storage.getAllAnnouncements();
      res.json(announcements);
    } catch (error) {
      console.error("Failed to get announcements:", error);
      res.status(500).json({ error: "Failed to get announcements" });
    }
  });

  // Get single announcement (public)
  app.get("/api/announcements/:id", async (req, res) => {
    try {
      const announcement = await storage.getAnnouncement(req.params.id);
      if (!announcement) {
        return res.status(404).json({ message: "공지사항을 찾을 수 없습니다" });
      }
      res.json(announcement);
    } catch (error) {
      console.error("Failed to get announcement:", error);
      res.status(500).json({ error: "Failed to get announcement" });
    }
  });

  // Create announcement (admin only)
  app.post("/api/announcements", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }
    
    try {
      const announcement = await storage.createAnnouncement(req.body);
      res.json(announcement);
    } catch (error) {
      console.error("Failed to create announcement:", error);
      res.status(500).json({ error: "Failed to create announcement" });
    }
  });

  // Update announcement (admin only)
  app.patch("/api/announcements/:id", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }
    
    try {
      const announcement = await storage.updateAnnouncement(req.params.id, req.body);
      res.json(announcement);
    } catch (error) {
      console.error("Failed to update announcement:", error);
      res.status(500).json({ error: "Failed to update announcement" });
    }
  });

  // Delete announcement (admin only)
  app.delete("/api/announcements/:id", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }
    
    try {
      await storage.deleteAnnouncement(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete announcement:", error);
      res.status(500).json({ error: "Failed to delete announcement" });
    }
  });

  // ━━━━━ 알림톡 API ━━━━━

  // 알림톡 템플릿 목록 조회
  app.get('/api/admin/alimtalk/templates', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }

    try {
      const templates = await db.select().from(alimtalkTemplates).orderBy(
        desc(alimtalkTemplates.isAuto),
        alimtalkTemplates.templateName
      );

      res.json(templates);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 알림톡 전체 통계
  app.get('/api/admin/alimtalk/statistics', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }

    try {
      const templates = await db.select().from(alimtalkTemplates);
      
      const totalTemplates = templates.length;
      const totalSent = templates.reduce((sum, t) => sum + (t.totalSent || 0), 0);
      const totalCost = templates.reduce((sum, t) => sum + (t.totalCost || 0), 0);

      // 이번 달 통계
      const kstNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
      const startOfMonth = new Date(kstNow.getFullYear(), kstNow.getMonth(), 1);

      const monthlyHistory = await db.select().from(alimtalkHistory).where(
        sql`${alimtalkHistory.sentAt} >= ${startOfMonth}`
      );

      const monthlySent = monthlyHistory.reduce((sum, h) => sum + h.recipientCount, 0);
      const monthlyCost = monthlyHistory.reduce((sum, h) => sum + h.cost, 0);

      res.json({
        totalTemplates,
        totalSent,
        totalCost,
        monthlySent,
        monthlyCost,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 알림톡 템플릿 ON/OFF 토글
  app.patch('/api/admin/alimtalk/templates/:id', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }

    const { id } = req.params;
    const { isActive } = req.body;

    try {
      await db.update(alimtalkTemplates)
        .set({ 
          isActive,
          updatedAt: new Date(),
        })
        .where(eq(alimtalkTemplates.id, parseInt(id)));

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 알림톡 템플릿 모드 변경 (자동/수동)
  app.patch('/api/admin/alimtalk/templates/:id/mode', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }

    const { id } = req.params;
    const { isAuto } = req.body;

    try {
      await db.update(alimtalkTemplates)
        .set({ 
          isAuto,
          updatedAt: new Date(),
        })
        .where(eq(alimtalkTemplates.id, parseInt(id)));

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 알림톡 템플릿 상세 조회 (DB 정보만)
  app.get('/api/admin/alimtalk/templates/:id/detail', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    try {
      const templateId = parseInt(req.params.id);
      const template = await db
        .select()
        .from(alimtalkTemplates)
        .where(eq(alimtalkTemplates.id, templateId))
        .limit(1);

      if (!template || template.length === 0) {
        return res.status(404).json({ error: 'Template not found' });
      }

      return res.json(template[0]);
    } catch (error: any) {
      console.error('Server error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // 알림톡 템플릿 수정
  app.put('/api/admin/alimtalk/templates/:id', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    try {
      const id = parseInt(req.params.id);
      const { templateName, description, templateId } = req.body;

      // 업데이트할 필드 구성
      const updateData: any = {
        templateName,
        description,
        updatedAt: new Date()
      };

      // 솔라피 템플릿 ID가 제공되면 함께 업데이트
      if (templateId) {
        updateData.templateId = templateId;
      }

      const updated = await db
        .update(alimtalkTemplates)
        .set(updateData)
        .where(eq(alimtalkTemplates.id, id))
        .returning();

      if (!updated || updated.length === 0) {
        return res.status(404).json({ error: 'Template not found' });
      }

      return res.json(updated[0]);
    } catch (error: any) {
      console.error('Server error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // 알림톡 템플릿 신규 등록
  app.post('/api/admin/alimtalk/templates', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    try {
      const { templateCode, templateId, templateName, description, isAuto } = req.body;

      // 필수 필드 검증
      if (!templateCode || !templateId || !templateName) {
        return res.status(400).json({ error: '템플릿 코드, 솔라피 ID, 템플릿 이름은 필수입니다' });
      }

      // 중복 코드 확인
      const existing = await db.select()
        .from(alimtalkTemplates)
        .where(eq(alimtalkTemplates.templateCode, templateCode))
        .limit(1);

      if (existing.length > 0) {
        return res.status(400).json({ error: '이미 존재하는 템플릿 코드입니다' });
      }

      const created = await db
        .insert(alimtalkTemplates)
        .values({
          templateCode,
          templateId,
          templateName,
          description: description || '',
          isAuto: isAuto ?? false,
          isActive: true,
          totalSent: 0,
          totalCost: 0,
        })
        .returning();

      return res.status(201).json(created[0]);
    } catch (error: any) {
      console.error('Template create error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // 알림톡 템플릿 삭제
  app.delete('/api/admin/alimtalk/templates/:id', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    try {
      const id = parseInt(req.params.id);

      const deleted = await db
        .delete(alimtalkTemplates)
        .where(eq(alimtalkTemplates.id, id))
        .returning();

      if (!deleted || deleted.length === 0) {
        return res.status(404).json({ error: 'Template not found' });
      }

      return res.json({ success: true, message: '템플릿이 삭제되었습니다' });
    } catch (error: any) {
      console.error('Template delete error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // 알림톡 테스트 발송 (관리자 번호로)
  app.post('/api/admin/alimtalk/test/:code', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    try {
      const { code } = req.params;
      const { testPhone } = req.body;

      // 템플릿 조회
      const [template] = await db.select()
        .from(alimtalkTemplates)
        .where(eq(alimtalkTemplates.templateCode, code))
        .limit(1);

      if (!template) {
        return res.status(404).json({ error: '템플릿을 찾을 수 없습니다' });
      }

      // 테스트 발송 번호 결정 (입력값 > 관리자 번호)
      // 주의: SOLAPI_SENDER(발신번호)는 대표번호(1588-xxxx)일 수 있어 알림톡 수신 불가
      const phoneNumber = testPhone || user.phone;
      
      if (!phoneNumber) {
        return res.status(400).json({ 
          error: '테스트 발송할 전화번호가 없습니다. 관리자 계정에 휴대폰 번호를 등록하거나, 테스트 번호를 직접 입력해주세요.' 
        });
      }

      // solapiService를 통해 발송
      const { solapiService } = await import('./services/solapi');
      const result = await solapiService.sendAlimTalk(
        template.templateId,
        phoneNumber,
        { 테스트: '테스트 발송입니다' }
      );

      return res.json({
        success: result.successCount > 0,
        message: result.successCount > 0 ? '테스트 발송 완료' : '발송 실패',
        phone: phoneNumber,
        ...result
      });
    } catch (error: any) {
      console.error('Test send error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // 알림톡 수신자 목록 조회
  app.get('/api/admin/alimtalk/recipients', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }

    try {
      const allMembers = await storage.getAllMembers();
      
      // 활성 회원만 필터링하고 필요한 정보만 반환
      const recipients = allMembers
        .filter(m => m.status === '활성')
        .map(m => ({
          id: m.id,
          companyName: m.companyName,
          grade: m.grade,
          phone: m.phone,
          managerPhone: m.managerPhone,
          manager2Phone: m.manager2Phone,
          manager3Phone: m.manager3Phone,
        }));
      
      // 중복 제거된 전체 연락처 수 계산
      const allPhones = new Set<string>();
      for (const r of recipients) {
        if (r.phone) allPhones.add(r.phone.replace(/-/g, ''));
        if (r.managerPhone) allPhones.add(r.managerPhone.replace(/-/g, ''));
        if (r.manager2Phone) allPhones.add(r.manager2Phone.replace(/-/g, ''));
        if (r.manager3Phone) allPhones.add(r.manager3Phone.replace(/-/g, ''));
      }
      
      return res.json({
        success: true,
        recipients,
        totalCount: recipients.length,
        phoneStats: {
          withPhone: recipients.filter(r => r.phone).length,
          withManagerPhone: recipients.filter(r => r.managerPhone).length,
          withManager2Phone: recipients.filter(r => r.manager2Phone).length,
          withManager3Phone: recipients.filter(r => r.manager3Phone).length,
          uniquePhoneCount: allPhones.size,
        }
      });
    } catch (error: any) {
      console.error('❌ 알림톡 수신자 목록 조회 오류:', error);
      return res.status(500).json({ error: '수신자 목록 조회 중 오류가 발생했습니다' });
    }
  });

  // 알림톡 수동 발송
  app.post('/api/admin/alimtalk/send/:code', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }

    const { code } = req.params;
    const { targetType, selectedGrades, variables } = req.body;

    try {
      // 템플릿 조회
      const [template] = await db.select()
        .from(alimtalkTemplates)
        .where(eq(alimtalkTemplates.templateCode, code))
        .limit(1);

      if (!template) {
        return res.status(404).json({ error: '템플릿을 찾을 수 없습니다' });
      }

      if (!template.isActive) {
        return res.status(400).json({ error: '비활성화된 템플릿입니다' });
      }

      // 회원 기반 수신자 선택
      const allMembers = await storage.getAllMembers();
      let targetMembers = allMembers.filter(m => m.status === '활성');
      
      // 등급별 선택
      if (targetType === 'grade' && selectedGrades && selectedGrades.length > 0) {
        targetMembers = targetMembers.filter(m => selectedGrades.includes(m.grade));
      }
      
      // 자동 로직: 모든 연락처에 발송 (중복 제거)
      let phoneNumbers: string[] = [];
      
      for (const member of targetMembers) {
        // 모든 연락처 수집 (대표 + 담당자1~3)
        if (member.phone) phoneNumbers.push(member.phone.replace(/-/g, ''));
        if (member.managerPhone) phoneNumbers.push(member.managerPhone.replace(/-/g, ''));
        if (member.manager2Phone) phoneNumbers.push(member.manager2Phone.replace(/-/g, ''));
        if (member.manager3Phone) phoneNumbers.push(member.manager3Phone.replace(/-/g, ''));
      }
      
      // 중복 제거
      phoneNumbers = Array.from(new Set(phoneNumbers));
      
      if (phoneNumbers.length === 0) {
        return res.status(400).json({ error: '발송할 수신자가 없습니다' });
      }
      
      console.log(`📤 알림톡 발송: ${phoneNumbers.length}명에게 발송`);

      // 발송
      const sendParams = phoneNumbers.map((phone: string) => ({
        to: phone,
        templateId: template.templateId,
        variables: variables || {},
      }));

      const result = await solapiService.sendAlimtalkBulk(sendParams);

      // 이력 저장
      const cost = result.successCount * 13; // 알림톡 건당 13원

      await db.insert(alimtalkHistory).values({
        templateId: template.id,
        recipientCount: phoneNumbers.length,
        successCount: result.successCount,
        failCount: result.failCount,
        cost,
        sentBy: req.session.userId,
        responseData: result.data,
      });

      // 템플릿 통계 업데이트
      await db.update(alimtalkTemplates)
        .set({
          totalSent: sql`${alimtalkTemplates.totalSent} + ${result.successCount}`,
          totalCost: sql`${alimtalkTemplates.totalCost} + ${cost}`,
          updatedAt: new Date(),
        })
        .where(eq(alimtalkTemplates.id, template.id));

      res.json({
        success: true,
        sent: phoneNumbers.length,
        successCount: result.successCount,
        failCount: result.failCount,
        cost,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 알림톡 발송 이력
  app.get('/api/admin/alimtalk/history', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }

    const { limit = 50, offset = 0 } = req.query;

    try {
      const history = await db.select({
        id: alimtalkHistory.id,
        templateName: alimtalkTemplates.templateName,
        recipientCount: alimtalkHistory.recipientCount,
        successCount: alimtalkHistory.successCount,
        failCount: alimtalkHistory.failCount,
        cost: alimtalkHistory.cost,
        sentAt: alimtalkHistory.sentAt,
      })
        .from(alimtalkHistory)
        .leftJoin(alimtalkTemplates, eq(alimtalkHistory.templateId, alimtalkTemplates.id))
        .orderBy(desc(alimtalkHistory.sentAt))
        .limit(parseInt(limit as string))
        .offset(parseInt(offset as string));

      res.json(history);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== 주문대기 (Pending Orders) API ====================
  
  // Generate unique order number
  function generateOrderNumber(): string {
    const now = new Date();
    const dateStr = now.toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }).replace(/-/g, '');
    const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `ORD-${dateStr}-${randomStr}`;
  }

  function parseDateRangeKST(startDateStr?: string, endDateStr?: string) {
    const KST_OFFSET = 9 * 60 * 60 * 1000;
    const now = new Date();
    const kstNow = new Date(now.getTime() + now.getTimezoneOffset() * 60000 + KST_OFFSET);
    
    const defaultDate = `${kstNow.getFullYear()}-${String(kstNow.getMonth() + 1).padStart(2, "0")}-${String(kstNow.getDate()).padStart(2, "0")}`;
    
    const startStr = (startDateStr && typeof startDateStr === "string" && startDateStr.trim()) ? startDateStr.trim() : defaultDate;
    const endStr = (endDateStr && typeof endDateStr === "string" && endDateStr.trim()) ? endDateStr.trim() : defaultDate;
    
    const startUTC = new Date(`${startStr}T00:00:00+09:00`);
    const endDate = new Date(`${endStr}T00:00:00+09:00`);
    endDate.setDate(endDate.getDate() + 1);
    
    return { startUTC, endUTC: endDate };
  }

  function getSupplyPriceByGrade(currentProduct: any, memberGrade: string): number {
    const gradeUpper = (memberGrade || '').toUpperCase();
    switch (gradeUpper) {
      case 'START':
        return currentProduct.startPrice;
      case 'DRIVING':
        return currentProduct.drivingPrice;
      case 'TOP':
        return currentProduct.topPrice;
      case 'ASSOCIATE':
      case 'PENDING':
        return currentProduct.startPrice;
      default:
        return currentProduct.startPrice;
    }
  }

  // 회원의 사용 가능 잔액 계산 (예치금 + 포인터 - 진행중 주문 총액)
  async function calculateAvailableBalance(memberId: string, memberGrade: string): Promise<{
    deposit: number;
    point: number;
    totalBalance: number;
    pendingOrdersTotal: number;
    availableBalance: number;
  }> {
    // 회원 잔액 조회
    const memberData = await db.select({
      deposit: members.deposit,
      point: members.point,
    }).from(members).where(eq(members.id, memberId)).limit(1);

    const deposit = memberData[0]?.deposit || 0;
    const point = memberData[0]?.point || 0;
    const totalBalance = deposit + point;

    // 진행중 주문 (대기 ~ 배송준비중) 총액 계산
    const inProgressStatuses = ["대기", "상품준비중", "배송준비중"];
    const inProgressOrders = await db.select({
      productCode: pendingOrders.productCode,
      supplyPrice: pendingOrders.supplyPrice,
      priceConfirmed: pendingOrders.priceConfirmed,
    }).from(pendingOrders).where(
      and(
        eq(pendingOrders.memberId, memberId),
        inArray(pendingOrders.status, inProgressStatuses)
      )
    );

    let pendingOrdersTotal = 0;
    for (const order of inProgressOrders) {
      if (order.priceConfirmed && order.supplyPrice) {
        // 확정된 가격 사용
        pendingOrdersTotal += order.supplyPrice;
      } else if (order.supplyPrice) {
        // 미확정이지만 공급가가 저장된 경우
        pendingOrdersTotal += order.supplyPrice;
      } else {
        // 공급가 미설정 시 현재공급가에서 조회
        const product = await db.select().from(currentProducts)
          .where(eq(currentProducts.productCode, order.productCode)).limit(1);
        if (product[0]) {
          pendingOrdersTotal += getSupplyPriceByGrade(product[0], memberGrade);
        }
      }
    }

    return {
      deposit,
      point,
      totalBalance,
      pendingOrdersTotal,
      availableBalance: totalBalance - pendingOrdersTotal,
    };
  }

  function buildDateCondition(table: any, startDate?: string, endDate?: string) {
    if (!startDate && !endDate) {
      const { startUTC, endUTC } = parseDateRangeKST();
      return and(gte(table.createdAt, startUTC), lt(table.createdAt, endUTC));
    }
    const { startUTC, endUTC } = parseDateRangeKST(startDate, endDate);
    return and(gte(table.createdAt, startUTC), lt(table.createdAt, endUTC));
  }

  // Get order stats for dashboard - role-based filtering
  // Admin: sees aggregated counts from all members
  // Member: sees only their own order counts
  app.get('/api/order-stats', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "로그인이 필요합니다" });
    }

    try {
      const isMember = req.session.userType === "member";
      let isAdmin = false;
      
      if (req.session.userType === "user") {
        const user = await storage.getUser(req.session.userId);
        if (user && (user.role === "SUPER_ADMIN" || user.role === "ADMIN")) {
          isAdmin = true;
        }
      }

      if (!isAdmin && !isMember) {
        return res.status(403).json({ message: "접근 권한이 없습니다" });
      }

      const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
      const dateCondition = buildDateCondition(pendingOrders, startDate, endDate);

      const baseCondition = isAdmin 
        ? dateCondition
        : and(eq(pendingOrders.memberId, req.session.userId), dateCondition);

      const totalResult = await db.select({ count: sql<number>`count(*)::int` })
        .from(pendingOrders)
        .where(baseCondition!);
      
      const pendingResult = await db.select({ count: sql<number>`count(*)::int` })
        .from(pendingOrders)
        .where(isAdmin 
          ? and(eq(pendingOrders.status, "대기"), dateCondition)
          : and(eq(pendingOrders.memberId, req.session.userId), eq(pendingOrders.status, "대기"), dateCondition));
      
      const adjustmentResult = await db.select({ count: sql<number>`count(*)::int` })
        .from(pendingOrders)
        .where(isAdmin 
          ? and(eq(pendingOrders.status, "주문조정"), dateCondition)
          : and(eq(pendingOrders.memberId, req.session.userId), eq(pendingOrders.status, "주문조정"), dateCondition));
      
      const preparingResult = await db.select({ count: sql<number>`count(*)::int` })
        .from(pendingOrders)
        .where(isAdmin 
          ? and(eq(pendingOrders.status, "상품준비중"), dateCondition)
          : and(eq(pendingOrders.memberId, req.session.userId), eq(pendingOrders.status, "상품준비중"), dateCondition));
      
      let readyToShipCount = 0;
      if (isAdmin) {
        const readyToShipResult = await db.select({ count: sql<number>`count(*)::int` })
          .from(pendingOrders)
          .where(and(eq(pendingOrders.status, "배송준비중"), dateCondition));
        readyToShipCount = readyToShipResult[0]?.count || 0;
      } else {
        const waybillSetting = await db.select().from(siteSettings)
          .where(eq(siteSettings.settingKey, "waybill_delivered")).limit(1);
        const waybillDelivered = waybillSetting.length > 0 && waybillSetting[0].settingValue === "true";
        if (waybillDelivered) {
          const readyToShipResult = await db.select({ count: sql<number>`count(*)::int` })
            .from(pendingOrders)
            .where(and(eq(pendingOrders.memberId, req.session.userId), eq(pendingOrders.status, "배송준비중"), dateCondition));
          readyToShipCount = readyToShipResult[0]?.count || 0;
        }
      }
      
      const memberCancelledResult = await db.select({ count: sql<number>`count(*)::int` })
        .from(pendingOrders)
        .where(isAdmin 
          ? and(eq(pendingOrders.status, "회원취소"), dateCondition)
          : and(eq(pendingOrders.memberId, req.session.userId), eq(pendingOrders.status, "회원취소"), dateCondition));
      
      const shippingResult = await db.select({ count: sql<number>`count(*)::int` })
        .from(pendingOrders)
        .where(isAdmin 
          ? and(eq(pendingOrders.status, "배송중"), dateCondition)
          : and(eq(pendingOrders.memberId, req.session.userId), eq(pendingOrders.status, "배송중"), dateCondition));

      res.json({
        total: totalResult[0]?.count || 0,               // 전체주문
        pending: pendingResult[0]?.count || 0,           // 주문대기
        adjustment: adjustmentResult[0]?.count || 0,     // 주문조정
        preparing: preparingResult[0]?.count || 0,       // 상품준비중
        readyToShip: readyToShipCount,   // 배송준비중
        memberCancelled: memberCancelledResult[0]?.count || 0, // 회원취소
        shipping: shippingResult[0]?.count || 0,         // 배송중
        isAdmin
      });
    } catch (error: any) {
      console.error("Order stats error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // KST 기준 날짜 범위 계산 유틸리티 (금일/전일/전월/이번달)
  function getKSTDateRanges() {
    const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
    const DAY_MS = 24 * 60 * 60 * 1000;
    const nowUtc = new Date();

    const kstMs = nowUtc.getTime() + KST_OFFSET_MS;
    const kstYear = new Date(kstMs).getUTCFullYear();
    const kstMonth = new Date(kstMs).getUTCMonth();
    const kstDate = new Date(kstMs).getUTCDate();

    const todayStartUTC = new Date(Date.UTC(kstYear, kstMonth, kstDate) - KST_OFFSET_MS);
    const tomorrowStartUTC = new Date(todayStartUTC.getTime() + DAY_MS);
    const yesterdayStartUTC = new Date(todayStartUTC.getTime() - DAY_MS);

    const thisMonthStartUTC = new Date(Date.UTC(kstYear, kstMonth, 1) - KST_OFFSET_MS);

    const lastMonthStartUTC = new Date(Date.UTC(kstYear, kstMonth - 1, 1) - KST_OFFSET_MS);
    const lastMonthEndUTC = thisMonthStartUTC;

    return {
      today: { start: todayStartUTC, end: tomorrowStartUTC },
      yesterday: { start: yesterdayStartUTC, end: todayStartUTC },
      thisMonth: { start: thisMonthStartUTC, end: nowUtc },
      lastMonth: { start: lastMonthStartUTC, end: lastMonthEndUTC },
    };
  }

  // 관리자 매출 현황 API (금일/전일/전월/이번달 - 확정매출/예상매출 분리)
  app.get('/api/admin/sales-stats', async (req, res) => {
    if (!req.session.userId || req.session.userType !== "user") {
      return res.status(401).json({ message: "관리자 로그인이 필요합니다" });
    }
    
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
        return res.status(403).json({ message: "접근 권한이 없습니다" });
      }

      const ranges = getKSTDateRanges();
      
      const excludeStatuses = ['취소', '회원취소', '주문조정'];
      const projectedStatuses = ['대기', '상품준비중', '배송준비중'];
      
      const calcSales = async (start: Date, end: Date): Promise<{ confirmed: number; projected: number; statusCounts: { pending: number; preparing: number; readyToShip: number } }> => {
        const confirmedResult = await db.select({
          total: sql<string>`COALESCE(SUM(${pendingOrders.supplyPrice}), 0)`
        })
        .from(pendingOrders)
        .where(and(
          gte(pendingOrders.createdAt, start),
          lt(pendingOrders.createdAt, end),
          eq(pendingOrders.priceConfirmed, true),
          eq(pendingOrders.status, '배송중')
        ));
        const confirmed = parseInt(confirmedResult[0]?.total || '0', 10);

        const projectedConfirmedResult = await db.select({
          total: sql<string>`COALESCE(SUM(${pendingOrders.supplyPrice}), 0)`
        })
        .from(pendingOrders)
        .where(and(
          gte(pendingOrders.createdAt, start),
          lt(pendingOrders.createdAt, end),
          eq(pendingOrders.priceConfirmed, true),
          inArray(pendingOrders.status, projectedStatuses)
        ));
        let projectedTotal = parseInt(projectedConfirmedResult[0]?.total || '0', 10);

        const statusCountResult = await db.select({
          status: pendingOrders.status,
          count: sql<string>`COUNT(*)`
        })
        .from(pendingOrders)
        .where(and(
          gte(pendingOrders.createdAt, start),
          lt(pendingOrders.createdAt, end),
          inArray(pendingOrders.status, projectedStatuses)
        ))
        .groupBy(pendingOrders.status);

        const statusCounts = { pending: 0, preparing: 0, readyToShip: 0 };
        for (const row of statusCountResult) {
          if (row.status === '대기') statusCounts.pending = parseInt(row.count || '0', 10);
          else if (row.status === '상품준비중') statusCounts.preparing = parseInt(row.count || '0', 10);
          else if (row.status === '배송준비중') statusCounts.readyToShip = parseInt(row.count || '0', 10);
        }

        const unconfirmedRows = await db.select({
          memberId: pendingOrders.memberId,
          productCode: pendingOrders.productCode,
        })
        .from(pendingOrders)
        .where(and(
          gte(pendingOrders.createdAt, start),
          lt(pendingOrders.createdAt, end),
          eq(pendingOrders.priceConfirmed, false),
          inArray(pendingOrders.status, projectedStatuses)
        ));

        if (unconfirmedRows.length > 0) {
          const mIds = Array.from(new Set(unconfirmedRows.map(r => r.memberId)));
          const pCodes = Array.from(new Set(unconfirmedRows.map(r => r.productCode)));
          const mList = await db.select({ id: members.id, grade: members.grade }).from(members).where(inArray(members.id, mIds));
          const mMap = new Map(mList.map(m => [m.id, m.grade]));
          const pList = await db.select().from(currentProducts).where(inArray(currentProducts.productCode, pCodes));
          const pMap = new Map(pList.map(p => [p.productCode, p]));
          for (const row of unconfirmedRows) {
            const grade = mMap.get(row.memberId) || 'START';
            const product = pMap.get(row.productCode);
            if (product) {
              projectedTotal += getSupplyPriceByGrade(product, grade);
            }
          }
        }

        return { confirmed, projected: projectedTotal, statusCounts };
      };

      const [today, yesterday, lastMonth, thisMonth] = await Promise.all([
        calcSales(ranges.today.start, ranges.today.end),
        calcSales(ranges.yesterday.start, ranges.yesterday.end),
        calcSales(ranges.lastMonth.start, ranges.lastMonth.end),
        calcSales(ranges.thisMonth.start, ranges.thisMonth.end),
      ]);
      
      let trendPercent: number | null = null;
      const yesterdayTotal = yesterday.confirmed + yesterday.projected;
      const todayTotal = today.confirmed + today.projected;
      if (yesterdayTotal > 0) {
        trendPercent = Math.round(((todayTotal - yesterdayTotal) / yesterdayTotal) * 1000) / 10;
      }

      res.json({
        todaySales: today.confirmed + today.projected,
        yesterdaySales: yesterday.confirmed + yesterday.projected,
        lastMonthSales: lastMonth.confirmed + lastMonth.projected,
        thisMonthSales: thisMonth.confirmed + thisMonth.projected,
        trendPercent,
        confirmed: {
          today: today.confirmed,
          yesterday: yesterday.confirmed,
          lastMonth: lastMonth.confirmed,
          thisMonth: thisMonth.confirmed,
        },
        projected: {
          today: today.projected,
          yesterday: yesterday.projected,
          lastMonth: lastMonth.projected,
          thisMonth: thisMonth.projected,
        },
        projectedStatusCounts: {
          today: today.statusCounts,
          yesterday: yesterday.statusCounts,
          lastMonth: lastMonth.statusCounts,
          thisMonth: thisMonth.statusCounts,
        },
      });
    } catch (error: any) {
      console.error("Sales stats error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // 회원 매입 현황 API (지난달/이번달 - 확정매입/예상매입 분리)
  app.get('/api/member/purchase-stats', async (req, res) => {
    if (!req.session.userId || req.session.userType !== "member") {
      return res.status(401).json({ message: "회원 로그인이 필요합니다" });
    }
    
    try {
      const ranges = getKSTDateRanges();
      const memberId = req.session.userId;
      
      const projectedStatuses = ['대기', '상품준비중', '배송준비중'];
      
      const memberData = await db.select({ grade: members.grade }).from(members).where(eq(members.id, memberId));
      const memberGrade = memberData[0]?.grade || 'START';

      const calcPurchase = async (start: Date, end: Date): Promise<{ confirmed: number; projected: number }> => {
        const confirmedResult = await db.select({
          total: sql<string>`COALESCE(SUM(${pendingOrders.supplyPrice}), 0)`
        })
        .from(pendingOrders)
        .where(and(
          eq(pendingOrders.memberId, memberId),
          gte(pendingOrders.createdAt, start),
          lt(pendingOrders.createdAt, end),
          eq(pendingOrders.priceConfirmed, true),
          eq(pendingOrders.status, '배송중')
        ));
        const confirmed = parseInt(confirmedResult[0]?.total || '0', 10);

        const projectedConfirmedResult = await db.select({
          total: sql<string>`COALESCE(SUM(${pendingOrders.supplyPrice}), 0)`
        })
        .from(pendingOrders)
        .where(and(
          eq(pendingOrders.memberId, memberId),
          gte(pendingOrders.createdAt, start),
          lt(pendingOrders.createdAt, end),
          eq(pendingOrders.priceConfirmed, true),
          inArray(pendingOrders.status, projectedStatuses)
        ));
        let projectedTotal = parseInt(projectedConfirmedResult[0]?.total || '0', 10);

        const unconfirmedRows = await db.select({
          productCode: pendingOrders.productCode,
        })
        .from(pendingOrders)
        .where(and(
          eq(pendingOrders.memberId, memberId),
          gte(pendingOrders.createdAt, start),
          lt(pendingOrders.createdAt, end),
          eq(pendingOrders.priceConfirmed, false),
          inArray(pendingOrders.status, projectedStatuses)
        ));

        if (unconfirmedRows.length > 0) {
          const pCodes = Array.from(new Set(unconfirmedRows.map(r => r.productCode)));
          const pList = await db.select().from(currentProducts).where(inArray(currentProducts.productCode, pCodes));
          const pMap = new Map(pList.map(p => [p.productCode, p]));
          for (const row of unconfirmedRows) {
            const product = pMap.get(row.productCode);
            if (product) {
              projectedTotal += getSupplyPriceByGrade(product, memberGrade);
            }
          }
        }

        return { confirmed, projected: projectedTotal };
      };

      const [lastMonth, thisMonth] = await Promise.all([
        calcPurchase(ranges.lastMonth.start, ranges.lastMonth.end),
        calcPurchase(ranges.thisMonth.start, ranges.thisMonth.end),
      ]);

      res.json({
        lastMonthTotal: lastMonth.confirmed + lastMonth.projected,
        thisMonthTotal: thisMonth.confirmed + thisMonth.projected,
        confirmed: {
          lastMonth: lastMonth.confirmed,
          thisMonth: thisMonth.confirmed,
        },
        projected: {
          lastMonth: lastMonth.projected,
          thisMonth: thisMonth.projected,
        },
      });
    } catch (error: any) {
      console.error("Purchase stats error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get pending orders for member
  app.get('/api/member/pending-orders', async (req, res) => {
    if (!req.session.userId || req.session.userType !== "member") {
      return res.status(401).json({ message: "회원 로그인이 필요합니다" });
    }

    try {
      const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
      const dateCondition = buildDateCondition(pendingOrders, startDate, endDate);
      
      const waybillSetting = await db.select().from(siteSettings)
        .where(eq(siteSettings.settingKey, "waybill_delivered")).limit(1);
      const waybillDelivered = waybillSetting.length > 0 && waybillSetting[0].settingValue === "true";

      const condition = waybillDelivered
        ? and(eq(pendingOrders.memberId, req.session.userId), dateCondition)
        : and(
            eq(pendingOrders.memberId, req.session.userId),
            ne(pendingOrders.status, "배송준비중"),
            dateCondition
          );

      const ordersList = await db.select()
        .from(pendingOrders)
        .where(condition!)
        .orderBy(asc(pendingOrders.sequenceNumber));

      const unconfirmedOrders = ordersList.filter(o => !o.priceConfirmed);
      if (unconfirmedOrders.length > 0) {
        const memberData = await db.select({ id: members.id, grade: members.grade })
          .from(members).where(eq(members.id, req.session.userId));
        const memberGrade = memberData[0]?.grade || 'START';

        const unconfirmedCodes = Array.from(new Set(unconfirmedOrders.map(o => o.productCode)));
        const productsList = await db.select().from(currentProducts)
          .where(inArray(currentProducts.productCode, unconfirmedCodes));
        const productMap = new Map(productsList.map(p => [p.productCode, p]));

        for (const order of ordersList) {
          if (!order.priceConfirmed) {
            const product = productMap.get(order.productCode);
            if (product) {
              (order as any).supplyPrice = getSupplyPriceByGrade(product, memberGrade);
            }
          }
        }
      }

      res.json(ordersList);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Generate sequence number: memberId + YYMMDD + 4-digit sequential number
  // Uses MAX to find highest existing sequence and increments, avoiding race conditions
  async function generateSequenceNumber(memberId: string): Promise<string> {
    const now = new Date();
    const kstStr = now.toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
    const [y, m, d] = kstStr.split("-");
    const year = y.slice(-2);
    const month = m;
    const day = d;
    const datePrefix = `${memberId}${year}${month}${day}`;
    
    // Find the maximum sequence number with this prefix using MAX
    const result = await db.select({ 
      maxSeq: sql<string>`MAX(${pendingOrders.sequenceNumber})` 
    })
      .from(pendingOrders)
      .where(
        sql`${pendingOrders.sequenceNumber} LIKE ${datePrefix + '%'}`
      );
    
    let nextNumber = 1;
    if (result[0]?.maxSeq) {
      // Extract the 4-digit suffix and increment
      const currentMax = result[0].maxSeq;
      const suffix = currentMax.slice(-4);
      nextNumber = parseInt(suffix, 10) + 1;
    }
    
    const sequentialPart = String(nextNumber).padStart(4, '0');
    return `${datePrefix}${sequentialPart}`;
  }

  // Member: Excel upload for bulk order registration
  // confirmPartial=true: 오류건 제외하고 정상건만 등록
  const memberOrderExcelUpload = multer({ storage: multer.memoryStorage() });
  app.post('/api/member/pending-orders/excel-upload', memberOrderExcelUpload.single('file'), async (req, res) => {
    if (!req.session.userId || req.session.userType !== "member") {
      return res.status(401).json({ message: "회원 로그인이 필요합니다" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "엑셀 파일을 업로드해주세요" });
    }

    // confirmPartial 파라미터: 오류건 제외하고 정상건만 등록할지 여부
    const confirmPartial = req.body.confirmPartial === 'true' || req.body.confirmPartial === true;
    // confirmDuplicate 파라미터: 중복 파일임을 확인하고 진행할지 여부
    const confirmDuplicate = req.body.confirmDuplicate === 'true' || req.body.confirmDuplicate === true;
    // format 파라미터: 업로드 양식 (default, postoffice)
    const uploadFormat = req.body.format || 'default';
    const isPostOfficeFormat = uploadFormat === 'postoffice';

    if (isPostOfficeFormat) {
      const memberForCheck = await storage.getMember(req.session.userId);
      if (!memberForCheck || !memberForCheck.postOfficeEnabled) {
        return res.status(403).json({ message: "우체국 양식 사용 권한이 없습니다. 관리자에게 문의하세요." });
      }
    }

    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);

      if (rows.length === 0) {
        return res.status(400).json({ message: "데이터가 없습니다" });
      }

      const member = await storage.getMember(req.session.userId);
      if (!member) {
        return res.status(404).json({ message: "회원 정보를 찾을 수 없습니다" });
      }

      // 주문 가능 등급 체크: START, DRIVING, TOP만 주문 가능
      const orderableGrades = ['START', 'DRIVING', 'TOP'];
      if (!orderableGrades.includes(member.grade)) {
        return res.status(403).json({ 
          message: "주문 등록은 스타트 등급 이상 회원만 가능합니다. 등급 승인 후 이용해주세요." 
        });
      }

      // 중복 파일 감지 (실제 데이터 내용 기반 해시)
      // 파일 바이트가 아닌 실제 엑셀 셀 데이터를 기반으로 해시 계산
      // 파일명, 저장시간 등 메타데이터 변경에 영향받지 않음
      const dataForHash = rows.map(row => {
        // 주문 식별에 중요한 필드들만 추출하여 정규화
        return {
          상품코드: String(row['상품코드'] || '').trim(),
          고객주문번호: String(row['고객주문번호'] || '').trim(),
          주문자명: String(row['주문자명'] || '').trim(),
          주문자휴대폰: String(row['주문자휴대폰'] || '').trim(),
          수취인명: String(row['수취인명'] || '').trim(),
          수취인휴대폰: String(row['수취인휴대폰'] || '').trim(),
          수취인주소: String(row['수취인주소'] || '').trim(),
        };
      });
      const contentHash = crypto.createHash('sha256').update(JSON.stringify(dataForHash)).digest('hex');
      let fileName = 'unknown.xlsx';
      try {
        fileName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
      } catch {
        fileName = req.file.originalname || 'unknown.xlsx';
      }
      
      if (!confirmDuplicate) {
        // 중복 확인: 동일한 해시가 이미 존재하는지 검사
        const existingUpload = await db
          .select()
          .from(orderUploadHistory)
          .where(eq(orderUploadHistory.contentHash, contentHash))
          .limit(1);
        
        if (existingUpload.length > 0) {
          const previous = existingUpload[0];
          const previousDate = new Date(previous.uploadedAt).toLocaleString('ko-KR', { 
            timeZone: "Asia/Seoul",
            year: 'numeric', month: '2-digit', day: '2-digit', 
            hour: '2-digit', minute: '2-digit' 
          });
          
          return res.json({
            status: 'duplicate_detected',
            message: '동일한 내용의 파일이 이미 업로드된 기록이 있습니다.',
            previousUpload: {
              fileName: previous.fileName,
              uploadedAt: previousDate,
              rowCount: previous.rowCount
            },
            currentFileName: fileName,
            rowCount: rows.length
          });
        }
      }

      // 정상건과 오류건을 분리
      const validRows: Array<{
        rowNum: number;
        productCode: string;
        productName: string;
        customOrderNumber: string;
        ordererName: string;
        ordererPhone: string;
        ordererZipCode: string;
        ordererAddress: string;
        recipientName: string;
        recipientMobile: string;
        recipientPhone: string;
        recipientZipCode: string;
        recipientAddress: string;
        deliveryMessage: string;
        orderDetailNumber: string;
        volumeUnit: string;
        currentProduct: any;
        validatedAddress?: string;
        addressWarning?: string;
      }> = [];
      
      const errorRows: Array<{
        rowNum: number;
        originalData: Record<string, any>;
        errorReason: string;
      }> = [];

      // 1단계: 기본 검증 (필수 필드, 상품 존재 여부) - 주소검증 제외
      const pendingValidationRows: Array<{
        rowNum: number;
        row: Record<string, any>;
        productCode: string;
        productName: string;
        customOrderNumber: string;
        ordererName: string;
        ordererPhone: string;
        ordererZipCode: string;
        ordererAddress: string;
        recipientName: string;
        recipientMobile: string;
        recipientPhone: string;
        recipientZipCode: string;
        recipientAddress: string;
        deliveryMessage: string;
        orderDetailNumber: string;
        volumeUnit: string;
        currentProduct: any;
      }> = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2; // Excel rows start at 1, and header is row 1
        const missingFields: string[] = [];

        // Map Excel columns to order data (양식에 따라 다른 컬럼 매핑)
        let productCode: string, productName: string, customOrderNumber: string;
        let ordererName: string, ordererPhone: string, ordererAddress: string, ordererZipCode: string;
        let recipientName: string, recipientMobile: string, recipientPhone: string, recipientAddress: string, recipientZipCode: string;
        let deliveryMessage: string, orderDetailNumber: string, volumeUnit: string;

        if (isPostOfficeFormat) {
          // 우체국 양식: 부피단위, 주문자명, 주문자 전화번호, 주문자 우편번호, 주문자 주소, 상품명, 수취인명, 수취인 전화번호, 수취인 우편번호, 수취인 주소, 배송메세지, 주문번호, 주문상세번호, 상품코드, 수량
          volumeUnit = String(row['부피단위'] || '').trim();
          ordererName = String(row['주문자명'] || '').trim();
          ordererPhone = String(row['주문자 전화번호'] || row['주문자전화번호'] || '').trim();
          ordererZipCode = String(row['주문자 우편번호'] || row['주문자우편번호'] || '').trim();
          ordererAddress = String(row['주문자 주소'] || row['주문자주소'] || '').trim();
          productName = String(row['상품명'] || '').trim();
          recipientName = String(row['수취인명'] || '').trim();
          recipientMobile = String(row['수취인 전화번호'] || row['수취인전화번호'] || '').trim();
          recipientZipCode = String(row['수취인 우편번호'] || row['수취인우편번호'] || '').trim();
          recipientAddress = String(row['수취인 주소'] || row['수취인주소'] || '').trim();
          deliveryMessage = String(row['배송메세지'] || row['배송메시지'] || '').trim();
          customOrderNumber = String(row['주문번호'] || '').trim();
          orderDetailNumber = String(row['주문상세번호'] || '').trim();
          productCode = String(row['상품코드'] || '').trim();
          recipientPhone = ''; // 우체국 양식에는 별도의 수령자 전화번호가 없음
        } else {
          // 기본 양식 (주문등록양식 columns)
          productCode = String(row['상품코드'] || row['productCode'] || '').trim();
          productName = String(row['상품명'] || row['productName'] || '').trim();
          customOrderNumber = String(row['자체주문번호'] || row['customOrderNumber'] || '').trim();
          ordererName = String(row['주문자명'] || row['ordererName'] || '').trim();
          ordererPhone = String(row['주문자전화번호'] || row['주문자 전화번호'] || row['ordererPhone'] || '').trim();
          ordererAddress = String(row['주문자주소'] || row['주문자 주소'] || row['ordererAddress'] || '').trim();
          recipientName = String(row['수령자명'] || row['recipientName'] || '').trim();
          recipientMobile = String(row['수령자휴대폰번호'] || row['수령자 휴대폰번호'] || row['recipientMobile'] || '').trim();
          recipientPhone = String(row['수령자전화번호'] || row['수령자 전화번호'] || row['recipientPhone'] || '').trim();
          recipientAddress = String(row['수령자주소'] || row['수령자 주소'] || row['recipientAddress'] || '').trim();
          deliveryMessage = String(row['배송메시지'] || row['deliveryMessage'] || '').trim();
          ordererZipCode = '';
          recipientZipCode = '';
          orderDetailNumber = '';
          volumeUnit = '';
        }

        // Check each required field individually
        if (!productCode) missingFields.push('상품코드');
        if (!productName) missingFields.push('상품명');
        if (!customOrderNumber) missingFields.push('자체주문번호');
        if (!ordererName) missingFields.push('주문자명');
        if (!ordererPhone) missingFields.push('주문자전화번호');
        if (!recipientName) missingFields.push('수령자명');
        if (!recipientMobile) missingFields.push('수령자휴대폰번호');
        if (!recipientAddress) missingFields.push('수령자주소');

        if (missingFields.length > 0) {
          errorRows.push({
            rowNum,
            originalData: row,
            errorReason: `[${missingFields.join(', ')}] 누락`
          });
          continue;
        }

        // Check if product exists in 현재공급가상품 (current_products) - NOT product_registrations
        const currentProduct = await storage.getCurrentProductByCode(productCode);
        if (!currentProduct) {
          errorRows.push({
            rowNum,
            originalData: row,
            errorReason: `"${productName}" (${productCode}) 현재 공급되지 않는 상품입니다. (현재공급가에 없음)`
          });
          continue;
        }
        
        // 상품이 공급중지 상태인지 확인
        if (currentProduct.supplyStatus === 'suspended') {
          errorRows.push({
            rowNum,
            originalData: row,
            errorReason: `"${productName}" (${productCode}) 공급중지된 상품입니다.`
          });
          continue;
        }

        // 기본 검증 통과 - 주소검증 대기열에 추가
        pendingValidationRows.push({
          rowNum,
          row,
          productCode,
          productName,
          customOrderNumber,
          ordererName,
          ordererPhone,
          ordererZipCode,
          ordererAddress,
          recipientName,
          recipientMobile,
          recipientPhone,
          recipientZipCode,
          recipientAddress,
          deliveryMessage,
          orderDetailNumber,
          volumeUnit,
          currentProduct,
        });
      }

      // ⑩-1 잔액 검증: 기본 검증 통과한 정상건의 총 주문금액 기준으로 잔액 체크
      if (pendingValidationRows.length > 0) {
        let totalOrderAmount = 0;
        for (const pvRow of pendingValidationRows) {
          totalOrderAmount += getSupplyPriceByGrade(pvRow.currentProduct, member.grade);
        }

        const balanceInfo = await calculateAvailableBalance(member.id, member.grade);

        if (balanceInfo.availableBalance < totalOrderAmount) {
          const shortage = totalOrderAmount - balanceInfo.availableBalance;
          return res.json({
            status: 'insufficient_balance',
            message: '잔액이 부족하여 주문 등록이 불가합니다.',
            total: rows.length,
            validCount: pendingValidationRows.length,
            errorCount: errorRows.length,
            totalOrderAmount,
            balanceInfo: {
              deposit: balanceInfo.deposit,
              point: balanceInfo.point,
              pendingOrdersTotal: balanceInfo.pendingOrdersTotal,
              availableBalance: balanceInfo.availableBalance,
              shortage,
            },
            errors: errorRows.length > 0 ? errorRows.map(e => `${e.rowNum}번 줄: ${e.errorReason}`) : [],
          });
        }
      }

      // 2단계: 주소 검증 - 병렬 처리 (5건씩 동시 처리)
      const PARALLEL_BATCH_SIZE = 5;
      
      if (process.env.JUSO_API_KEY && pendingValidationRows.length > 0) {
        console.log(`주소검증 시작: ${pendingValidationRows.length}건을 ${PARALLEL_BATCH_SIZE}건씩 병렬 처리`);
        
        for (let batchStart = 0; batchStart < pendingValidationRows.length; batchStart += PARALLEL_BATCH_SIZE) {
          const batch = pendingValidationRows.slice(batchStart, batchStart + PARALLEL_BATCH_SIZE);
          
          // 배치 내 주소검증 병렬 실행
          const validationPromises = batch.map(async (pendingRow) => {
            try {
              const result = await validateSingleAddress(pendingRow.recipientAddress);
              return { pendingRow, result, error: null };
            } catch (error: any) {
              console.error(`주소 검증 오류 (${pendingRow.rowNum}번 줄):`, error.message);
              return { pendingRow, result: null, error };
            }
          });
          
          const batchResults = await Promise.all(validationPromises);
          
          // 배치 결과 처리
          for (const { pendingRow, result, error } of batchResults) {
            if (result && result.status === 'invalid') {
              // 주소 검증 실패
              errorRows.push({
                rowNum: pendingRow.rowNum,
                originalData: pendingRow.row,
                errorReason: `주소 오류: ${result.errorMessage || '건물을 찾을 수 없습니다'}`
              });
            } else {
              // 검증 성공 또는 API 오류 (경고만 하고 진행)
              validRows.push({
                rowNum: pendingRow.rowNum,
                productCode: pendingRow.productCode,
                productName: pendingRow.productName,
                customOrderNumber: pendingRow.customOrderNumber,
                ordererName: pendingRow.ordererName,
                ordererPhone: pendingRow.ordererPhone,
                ordererZipCode: pendingRow.ordererZipCode,
                ordererAddress: pendingRow.ordererAddress,
                recipientName: pendingRow.recipientName,
                recipientMobile: pendingRow.recipientMobile,
                recipientPhone: pendingRow.recipientPhone,
                recipientZipCode: pendingRow.recipientZipCode,
                recipientAddress: pendingRow.recipientAddress,
                deliveryMessage: pendingRow.deliveryMessage,
                orderDetailNumber: pendingRow.orderDetailNumber,
                volumeUnit: pendingRow.volumeUnit,
                currentProduct: pendingRow.currentProduct,
                validatedAddress: result?.fullAddress || result?.standardAddress,
                addressWarning: result?.warningMessage,
              });
            }
          }
        }
        
        console.log(`주소검증 완료: 정상 ${validRows.length}건, 오류 ${errorRows.length}건`);
      } else {
        // 주소검증 비활성화 상태 - 모든 기본검증 통과 행을 그대로 추가
        for (const pendingRow of pendingValidationRows) {
          validRows.push({
            rowNum: pendingRow.rowNum,
            productCode: pendingRow.productCode,
            productName: pendingRow.productName,
            customOrderNumber: pendingRow.customOrderNumber,
            ordererName: pendingRow.ordererName,
            ordererPhone: pendingRow.ordererPhone,
            ordererZipCode: pendingRow.ordererZipCode,
            ordererAddress: pendingRow.ordererAddress,
            recipientName: pendingRow.recipientName,
            recipientMobile: pendingRow.recipientMobile,
            recipientPhone: pendingRow.recipientPhone,
            recipientZipCode: pendingRow.recipientZipCode,
            recipientAddress: pendingRow.recipientAddress,
            deliveryMessage: pendingRow.deliveryMessage,
            orderDetailNumber: pendingRow.orderDetailNumber,
            volumeUnit: pendingRow.volumeUnit,
            currentProduct: pendingRow.currentProduct,
          });
        }
      }

      // 오류건 엑셀 데이터 생성 함수 (주문등록 양식과 동일한 컬럼 순서 + 오류사유)
      // 양식 순서: 주문자명, 주문자 전화번호, 주문자 주소, 수령자명, 수령자휴대폰번호, 수령자 전화번호, 수령자 주소, 배송메시지, 상품코드, 상품명, 자체주문번호
      const generateErrorExcelData = (errRows: typeof errorRows) => {
        return errRows.map(err => ({
          '주문자명': err.originalData['주문자명'] || err.originalData['ordererName'] || '',
          '주문자 전화번호': err.originalData['주문자전화번호'] || err.originalData['주문자 전화번호'] || err.originalData['ordererPhone'] || '',
          '주문자 주소': err.originalData['주문자주소'] || err.originalData['주문자 주소'] || err.originalData['ordererAddress'] || '',
          '수령자명': err.originalData['수령자명'] || err.originalData['recipientName'] || '',
          '수령자휴대폰번호': err.originalData['수령자휴대폰번호'] || err.originalData['수령자 휴대폰번호'] || err.originalData['recipientMobile'] || '',
          '수령자 전화번호': err.originalData['수령자전화번호'] || err.originalData['수령자 전화번호'] || err.originalData['recipientPhone'] || '',
          '수령자 주소': err.originalData['수령자주소'] || err.originalData['수령자 주소'] || err.originalData['recipientAddress'] || '',
          '배송메시지': err.originalData['배송메시지'] || err.originalData['deliveryMessage'] || '',
          '상품코드': err.originalData['상품코드'] || err.originalData['productCode'] || '',
          '상품명': err.originalData['상품명'] || err.originalData['productName'] || '',
          '자체주문번호': err.originalData['자체주문번호'] || err.originalData['customOrderNumber'] || '',
          '오류사유': err.errorReason  // 마지막 컬럼: 수정 후 이 컬럼만 삭제하면 바로 재업로드 가능
        }));
      };

      // 오류가 있고 confirmPartial이 아니면 검증 결과만 반환 (등록하지 않음)
      if (errorRows.length > 0 && !confirmPartial) {
        let validOrderAmount = 0;
        for (const vRow of validRows) {
          validOrderAmount += getSupplyPriceByGrade(vRow.currentProduct, member.grade);
        }
        const balanceForValidation = await calculateAvailableBalance(member.id, member.grade);

        return res.json({
          status: 'validation_failed',
          message: "검증 오류가 있습니다. 정상건만 등록하거나 취소하세요.",
          total: rows.length,
          validCount: validRows.length,
          errorCount: errorRows.length,
          errors: errorRows.map(e => `${e.rowNum}번 줄: ${e.errorReason}`),
          errorExcelData: generateErrorExcelData(errorRows),
          totalOrderAmount: validOrderAmount,
          balanceInfo: {
            deposit: balanceForValidation.deposit,
            point: balanceForValidation.point,
            pendingOrdersTotal: balanceForValidation.pendingOrdersTotal,
            availableBalance: balanceForValidation.availableBalance,
          },
          balanceSufficient: balanceForValidation.availableBalance >= validOrderAmount,
        });
      }

      // 정상건만 등록 진행 (오류 없거나 confirmPartial=true)
      let successCount = 0;
      for (const parsedRow of validRows) {
        // Generate sequence number
        const sequenceNumber = await generateSequenceNumber(member.username);

        const supplyPrice = getSupplyPriceByGrade(parsedRow.currentProduct, member.grade);

        await db.insert(pendingOrders).values({
          sequenceNumber,
          orderNumber: generateOrderNumber(),
          memberId: req.session.userId,
          memberCompanyName: member.companyName,
          status: "대기",
          categoryLarge: parsedRow.currentProduct.categoryLarge || null,
          categoryMedium: parsedRow.currentProduct.categoryMedium || null,
          categorySmall: parsedRow.currentProduct.categorySmall || null,
          productCode: parsedRow.productCode,
          productName: parsedRow.productName,
          supplyPrice: supplyPrice,
          ordererName: parsedRow.ordererName,
          ordererPhone: normalizePhoneNumber(parsedRow.ordererPhone),
          ordererZipCode: parsedRow.ordererZipCode || null,
          ordererAddress: parsedRow.ordererAddress || null,
          recipientName: parsedRow.recipientName,
          recipientMobile: normalizePhoneNumber(parsedRow.recipientMobile),
          recipientPhone: normalizePhoneNumber(parsedRow.recipientPhone) || null,
          recipientZipCode: parsedRow.recipientZipCode || null,
          recipientAddress: parsedRow.validatedAddress || parsedRow.recipientAddress,
          deliveryMessage: parsedRow.addressWarning 
            ? `${parsedRow.deliveryMessage || ''} [주소확인필요: ${parsedRow.addressWarning}]`.trim()
            : (parsedRow.deliveryMessage || null),
          customOrderNumber: parsedRow.customOrderNumber,
          orderDetailNumber: parsedRow.orderDetailNumber || null,
          volumeUnit: parsedRow.volumeUnit || null,
          uploadFormat: isPostOfficeFormat ? "postoffice" : "default",
          taxType: parsedRow.currentProduct.taxType || "exempt",
          trackingNumber: null,
          courierCompany: null,
        });

        successCount++;
      }

      // 업로드 히스토리 저장 (중복 감지용)
      if (successCount > 0) {
        await db.insert(orderUploadHistory).values({
          memberId: member.id,
          fileName,
          contentHash,
          rowCount: rows.length,
        });
      }

      // SSE: 관리자에게 일괄 주문 등록 알림
      if (successCount > 0) {
        sseManager.sendToAdmins("orders-created", { 
          type: "pending-order-bulk",
          count: successCount,
          memberCompanyName: member.companyName 
        });
        
        // SSE: 해당 회원에게도 일괄 주문 등록 확인 알림
        sseManager.sendToMember(member.id, "orders-created", {
          type: "pending-order-bulk",
          count: successCount
        });
      }

      // 오류건이 있었다면 오류 엑셀 데이터도 함께 반환
      if (errorRows.length > 0 && confirmPartial) {
        let registeredOrderAmount = 0;
        for (const vRow of validRows) {
          registeredOrderAmount += getSupplyPriceByGrade(vRow.currentProduct, member.grade);
        }
        const balanceAfterOrder = await calculateAvailableBalance(member.id, member.grade);

        return res.json({
          status: 'partial_success',
          total: rows.length,
          success: successCount,
          failed: errorRows.length,
          errors: errorRows.map(e => `${e.rowNum}번 줄: ${e.errorReason}`),
          errorExcelData: generateErrorExcelData(errorRows),
          settlementInfo: {
            orderAmount: registeredOrderAmount,
            remainingBalance: balanceAfterOrder.availableBalance,
          },
        });
      }

      res.json({
        status: 'success',
        total: rows.length,
        success: successCount,
        failed: 0,
        errors: [],
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "엑셀 처리 중 오류가 발생했습니다" });
    }
  });

  // Search product by code (for auto-fill categories)
  app.get('/api/member/products/search', async (req, res) => {
    if (!req.session.userId || req.session.userType !== "member") {
      return res.status(401).json({ message: "회원 로그인이 필요합니다" });
    }

    const { code } = req.query;
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ message: "상품코드를 입력해주세요" });
    }

    try {
      const product = await storage.getProductRegistrationByCode(code);
      if (!product) {
        return res.status(404).json({ message: "상품을 찾을 수 없습니다" });
      }

      res.json({
        productCode: product.productCode,
        productName: product.productName,
        categoryLarge: product.categoryLarge,
        categoryMedium: product.categoryMedium,
        categorySmall: product.categorySmall,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 회원용 상품리스트 API: 현재공급가 조회 (ASSOCIATE 이상)
  app.get('/api/member/product-list/current', async (req, res) => {
    if (!req.session.userId || req.session.userType !== "member") {
      return res.status(401).json({ message: "회원 로그인이 필요합니다" });
    }

    try {
      const member = await storage.getMember(req.session.userId);
      if (!member) {
        return res.status(404).json({ message: "회원 정보를 찾을 수 없습니다" });
      }

      // PENDING 등급은 접근 불가, ASSOCIATE 이상만 가능
      if (member.grade === 'PENDING') {
        return res.status(403).json({ message: "승인대기 회원은 상품리스트를 조회할 수 없습니다." });
      }

      const products = await storage.getAllCurrentProducts();
      const grade = member.grade;

      // 회원 등급에 맞는 공급가만 반환
      const result = products
        .filter(p => p.supplyStatus === 'supply')
        .map(p => ({
          productCode: p.productCode,
          productName: p.productName,
          categoryLarge: p.categoryLarge,
          categoryMedium: p.categoryMedium,
          categorySmall: p.categorySmall,
          weight: p.weight,
          supplyPrice: getSupplyPriceByGrade(p, grade),
          supplyStatus: p.supplyStatus,
        }));

      res.json(result);
    } catch (error: any) {
      console.error("회원 현재공급가 조회 오류:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // 회원용 상품리스트 API: 차주예상공급가 조회 (ASSOCIATE 이상)
  app.get('/api/member/product-list/next-week', async (req, res) => {
    if (!req.session.userId || req.session.userType !== "member") {
      return res.status(401).json({ message: "회원 로그인이 필요합니다" });
    }

    try {
      const member = await storage.getMember(req.session.userId);
      if (!member) {
        return res.status(404).json({ message: "회원 정보를 찾을 수 없습니다" });
      }

      if (member.grade === 'PENDING') {
        return res.status(403).json({ message: "승인대기 회원은 상품리스트를 조회할 수 없습니다." });
      }

      const products = await storage.getAllNextWeekProducts();
      const grade = member.grade;

      const result = products.map(p => ({
        productCode: p.productCode,
        productName: p.productName,
        categoryLarge: p.categoryLarge,
        categoryMedium: p.categoryMedium,
        categorySmall: p.categorySmall,
        weight: p.weight,
        supplyPrice: getSupplyPriceByGrade(p, grade),
      }));

      res.json(result);
    } catch (error: any) {
      console.error("회원 차주예상공급가 조회 오류:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Get all pending orders
  app.get('/api/admin/pending-orders', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }

    try {
      const { status, memberId, startDate, endDate } = req.query as Record<string, string | undefined>;
      const dateCondition = buildDateCondition(pendingOrders, startDate, endDate);
      
      const conditions: any[] = [dateCondition];
      
      if (status && typeof status === 'string') {
        conditions.push(eq(pendingOrders.status, status));
      }
      
      if (memberId && typeof memberId === 'string') {
        conditions.push(eq(pendingOrders.memberId, memberId));
      }
      
      const orders = await db.select().from(pendingOrders)
        .where(and(...conditions))
        .orderBy(asc(pendingOrders.sequenceNumber));

      const unconfirmedOrders = orders.filter(o => !o.priceConfirmed);
      if (unconfirmedOrders.length > 0) {
        const unconfirmedMemberIds = Array.from(new Set(unconfirmedOrders.map(o => o.memberId)));
        const unconfirmedProductCodes = Array.from(new Set(unconfirmedOrders.map(o => o.productCode)));

        const membersList = await db.select({ id: members.id, grade: members.grade })
          .from(members).where(inArray(members.id, unconfirmedMemberIds));
        const memberGradeMap = new Map(membersList.map(m => [m.id, m.grade]));

        const productsList = await db.select().from(currentProducts)
          .where(inArray(currentProducts.productCode, unconfirmedProductCodes));
        const productMap = new Map(productsList.map(p => [p.productCode, p]));

        for (const order of orders) {
          if (!order.priceConfirmed) {
            const grade = memberGradeMap.get(order.memberId) || 'START';
            const product = productMap.get(order.productCode);
            if (product) {
              (order as any).supplyPrice = getSupplyPriceByGrade(product, grade);
            }
          }
        }
      }

      res.json(orders);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Download preparing orders as Excel (with format selection)
  app.post('/api/admin/orders/download-preparing', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }

    try {
      const { orderIds } = req.body;
      const format = req.query.format as string || "default";

      if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
        return res.status(400).json({ message: "다운로드할 주문을 선택해주세요" });
      }

      // Fetch orders - only allow 상품준비중 status for this endpoint
      const orders = await db
        .select()
        .from(pendingOrders)
        .where(and(
          inArray(pendingOrders.id, orderIds),
          eq(pendingOrders.status, "상품준비중")
        ));

      if (orders.length === 0) {
        return res.status(404).json({ message: "상품준비중 상태의 주문을 찾을 수 없습니다" });
      }

      const XLSX = await import("xlsx");
      let wsData: any[][];

      if (format === "postoffice") {
        // 우체국 양식: 부피단위, 주문자명, 주문자 전화번호, 주문자 우편번호, 주문자 주소, 상품명, 수취인명, 수취인 전화번호, 수취인 우편번호, 수취인 주소, 배송메세지, 주문번호, 주문상세번호, 상품코드, 수량
        wsData = [
          ["부피단위", "주문자명", "주문자 전화번호", "주문자 우편번호", "주문자 주소", "상품명", "수취인명", "수취인 전화번호", "수취인 우편번호", "수취인 주소", "배송메세지", "주문번호", "주문상세번호", "상품코드", "수량"]
        ];
        
        for (const order of orders) {
          wsData.push([
            order.volumeUnit || "",
            order.ordererName || "",
            order.ordererPhone || "",
            order.ordererZipCode || "",
            order.ordererAddress || "",
            order.productName || "",
            order.recipientName || "",
            order.recipientMobile || "",
            order.recipientZipCode || "",
            order.recipientAddress || "",
            order.deliveryMessage || "",
            order.customOrderNumber || "",
            order.orderDetailNumber || "",
            order.productCode || "",
            1
          ]);
        }
      } else if (format === "lotte") {
        // 롯데 양식: 주문자명, 주문자 전화번호, 주문자 주소, 수령자명, 수령자휴대폰번호, 수령자 전화번호, 수령자 주소, 배송메시지, 상품코드, 상품명, 수량, 주문번호, 운송장번호, 택배사
        wsData = [
          ["주문자명", "주문자 전화번호", "주문자 주소", "수령자명", "수령자휴대폰번호", "수령자 전화번호", "수령자 주소", "배송메시지", "상품코드", "상품명", "수량", "주문번호", "운송장번호", "택배사"]
        ];
        
        for (const order of orders) {
          wsData.push([
            order.ordererName || "",
            order.ordererPhone || "",
            order.ordererAddress || "",
            order.recipientName || "",
            order.recipientMobile || "",
            order.recipientPhone || "",
            order.recipientAddress || "",
            order.deliveryMessage || "",
            order.productCode || "",
            order.productName || "",
            1,
            order.customOrderNumber || "",
            order.trackingNumber || "",
            order.courierCompany || ""
          ]);
        }
      } else {
        // 기본 양식
        wsData = [
          ["순번", "상호명", "주문번호", "주문자명", "수령자명", "수령자 전화번호", "수령자 주소", "상품코드", "상품명", "수량", "단가", "배송메시지", "운송장번호", "택배사", "상태"]
        ];
        
        for (const order of orders) {
          wsData.push([
            order.sequenceNumber || "",
            order.memberCompanyName || "",
            order.customOrderNumber || "",
            order.ordererName || "",
            order.recipientName || "",
            order.recipientMobile || "",
            order.recipientAddress || "",
            order.productCode || "",
            order.productName || "",
            1,
            order.supplyPrice || 0,
            order.deliveryMessage || "",
            order.trackingNumber || "",
            order.courierCompany || "",
            order.status || ""
          ]);
        }
      }

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      
      // 전화번호 컬럼을 텍스트 형식으로 설정 (앞자리 0 보존)
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      for (let R = range.s.r + 1; R <= range.e.r; ++R) {
        if (format === "postoffice") {
          // 우체국 양식: C(주문자 전화번호), H(수취인 전화번호), D(주문자 우편번호), I(수취인 우편번호)
          const phoneAndZipColumns = [2, 3, 7, 8]; // C=2, D=3, H=7, I=8
          for (const C of phoneAndZipColumns) {
            const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
            if (ws[cellRef]) {
              ws[cellRef].t = 's';
              ws[cellRef].z = '@';
            }
          }
        } else if (format === "lotte") {
          // 롯데 양식: B(주문자 전화번호), E(수령자휴대폰번호), F(수령자 전화번호)
          const phoneColumns = [1, 4, 5]; // B=1, E=4, F=5
          for (const C of phoneColumns) {
            const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
            if (ws[cellRef]) {
              ws[cellRef].t = 's'; // 텍스트 타입으로 설정
              ws[cellRef].z = '@'; // 텍스트 형식
            }
          }
        } else {
          // 기본 양식: F(수령자 전화번호)
          const phoneColumns = [5]; // F=5
          for (const C of phoneColumns) {
            const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
            if (ws[cellRef]) {
              ws[cellRef].t = 's'; // 텍스트 타입으로 설정
              ws[cellRef].z = '@'; // 텍스트 형식
            }
          }
        }
      }
      
      XLSX.utils.book_append_sheet(wb, ws, "상품준비중");
      
      // 우체국 양식은 .xls, 나머지는 .xlsx
      const bookType = format === "postoffice" ? "biff8" : "xlsx";
      const buffer = XLSX.write(wb, { type: "buffer", bookType: bookType as any });

      const formatName = format === "postoffice" ? "postoffice" : format === "lotte" ? "lotte" : "default";
      const koreanFormatName = format === "postoffice" ? "우체국" : format === "lotte" ? "롯데" : "기본";
      const fileExt = format === "postoffice" ? "xls" : "xlsx";
      const dateStr = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
      const asciiFilename = `preparing_orders_${formatName}_${dateStr}.${fileExt}`;
      const koreanFilename = `상품준비중_${koreanFormatName}_${dateStr}.${fileExt}`;
      
      const contentType = format === "postoffice" 
        ? "application/vnd.ms-excel" 
        : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(koreanFilename)}`);
      res.send(buffer);
    } catch (error: any) {
      console.error("Download error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Download waybill upload template (운송장 업로드 양식 다운로드)
  app.get('/api/admin/orders/waybill-template', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }

    try {
      const format = req.query.format as string;
      const XLSX = await import("xlsx");
      let wsData: any[][];
      let fileName: string;

      if (format === "lotte") {
        // 롯데택배 업로드 양식: 주문번호 = 인덱스9 (10번째 열), 운송장번호 = 인덱스6 (7번째 열)
        wsData = [
          ["보내는분이름", "보내는분전화번호", "보내는분주소", "보내는분상세주소", "받는분이름", "받는분전화번호", "운송장번호", "받는분핸드폰", "받는분주소", "주문번호", "배송메세지"]
        ];
        wsData.push(["홍길동", "02-1234-5678", "서울시 강남구 테헤란로 1", "101호", "김철수", "02-9876-5432", "1234567890", "010-1234-5678", "부산시 해운대구 해운대로 100", "ORD-001", "문 앞에 놔주세요"]);
        fileName = "운송장_롯데택배_양식.xlsx";
      } else if (format === "postoffice") {
        // 우체국택배 업로드 양식: 주문번호 = 인덱스20 (21번째 열), 등기번호 = 인덱스1 (2번째 열)
        const headers = new Array(22).fill("");
        headers[0] = "접수일자";
        headers[1] = "등기번호";
        headers[2] = "보내는분";
        headers[3] = "보내는분전화";
        headers[4] = "받는분";
        headers[5] = "받는분전화";
        headers[6] = "받는분주소";
        headers[20] = "주문번호";
        headers[21] = "비고";
        wsData = [headers];
        const sampleRow = new Array(22).fill("");
        sampleRow[0] = "2025-01-01";
        sampleRow[1] = "1234567890123";
        sampleRow[2] = "홍길동";
        sampleRow[3] = "02-1234-5678";
        sampleRow[4] = "김철수";
        sampleRow[5] = "010-1234-5678";
        sampleRow[6] = "서울시 강남구 테헤란로 1";
        sampleRow[20] = "ORD-001";
        wsData.push(sampleRow);
        fileName = "운송장_우체국택배_양식.xlsx";
      } else {
        return res.status(400).json({ message: "format 파라미터가 필요합니다 (lotte 또는 postoffice)" });
      }

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, "양식");
      const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
      res.send(buf);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "양식 다운로드 중 오류가 발생했습니다" });
    }
  });

  // Admin: Upload waybill file (운송장 파일 업로드)
  const waybillUpload = multer({ storage: multer.memoryStorage() });
  app.post('/api/admin/orders/upload-waybill', waybillUpload.single('file'), async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }

    try {
      const file = req.file;
      const courier = req.body.courier as "lotte" | "postoffice" | "default";

      if (!file) {
        return res.status(400).json({ message: "파일을 업로드해주세요" });
      }

      if (!courier || !["lotte", "postoffice", "default"].includes(courier)) {
        return res.status(400).json({ message: "택배사를 선택해주세요" });
      }

      const XLSX = await import("xlsx");
      const workbook = XLSX.read(file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      if (rows.length < 2) {
        return res.status(400).json({ message: "파일에 데이터가 없습니다" });
      }

      let orderNumberIndex: number;
      let trackingNumberIndex: number;
      let courierCompanyName: string;
      let courierColumnIndex: number | null = null;

      if (courier === "default") {
        const headerRow = rows[0].map((h: any) => String(h || "").trim());
        orderNumberIndex = headerRow.findIndex((h: string) => h === "주문번호");
        trackingNumberIndex = headerRow.findIndex((h: string) => h === "운송장번호");
        courierColumnIndex = headerRow.findIndex((h: string) => h === "택배사");
        courierCompanyName = "";

        if (orderNumberIndex === -1 || trackingNumberIndex === -1) {
          return res.status(400).json({ message: "기본 양식에서 '주문번호' 또는 '운송장번호' 컬럼을 찾을 수 없습니다" });
        }
      } else if (courier === "lotte") {
        orderNumberIndex = 9;
        trackingNumberIndex = 6;
        courierCompanyName = "롯데택배";
      } else {
        orderNumberIndex = 20;
        trackingNumberIndex = 1;
        courierCompanyName = "우체국";
      }

      // 파일에서 주문번호-운송장번호 쌍 추출 (헤더 제외)
      const waybillPairs: Array<{ orderNumber: string; trackingNumber: string; rowIndex: number; rowCourier?: string }> = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const orderNumber = String(row[orderNumberIndex] || "").trim();
        const trackingNumber = String(row[trackingNumberIndex] || "").trim();
        const rowCourier = courierColumnIndex !== null && courierColumnIndex >= 0
          ? String(row[courierColumnIndex] || "").trim()
          : "";
        
        if (orderNumber) {
          waybillPairs.push({ orderNumber, trackingNumber, rowIndex: i, rowCourier });
        }
      }

      if (waybillPairs.length === 0) {
        return res.status(400).json({ message: "파일에서 주문번호를 찾을 수 없습니다" });
      }

      // 상품준비중 상태의 주문 조회 (sequenceNumber 기준 정렬)
      const preparingOrders = await db
        .select()
        .from(pendingOrders)
        .where(eq(pendingOrders.status, "상품준비중"))
        .orderBy(asc(pendingOrders.sequenceNumber));

      // 주문번호별 그룹화 (순서 유지)
      const ordersByOrderNumber: Map<string, typeof preparingOrders> = new Map();
      for (const order of preparingOrders) {
        const orderNumber = order.customOrderNumber || order.orderNumber || "";
        if (!ordersByOrderNumber.has(orderNumber)) {
          ordersByOrderNumber.set(orderNumber, []);
        }
        ordersByOrderNumber.get(orderNumber)!.push(order);
      }

      // 파일의 주문번호별 운송장 그룹화 (순서 유지)
      const waybillsByOrderNumber: Map<string, typeof waybillPairs> = new Map();
      for (const pair of waybillPairs) {
        if (!waybillsByOrderNumber.has(pair.orderNumber)) {
          waybillsByOrderNumber.set(pair.orderNumber, []);
        }
        waybillsByOrderNumber.get(pair.orderNumber)!.push(pair);
      }

      // 결과 집계
      const details: Array<{ orderNumber: string; trackingNumber: string; status: "success" | "failed" | "skipped"; reason?: string }> = [];
      let successCount = 0;
      let failedCount = 0;
      let skippedCount = 0;

      // 매핑 및 업데이트 처리
      for (const [orderNumber, waybills] of Array.from(waybillsByOrderNumber.entries())) {
        const dbOrders = ordersByOrderNumber.get(orderNumber) || [];
        
        for (let i = 0; i < waybills.length; i++) {
          const waybill = waybills[i];
          
          if (!waybill.trackingNumber) {
            details.push({
              orderNumber: waybill.orderNumber,
              trackingNumber: "",
              status: "skipped",
              reason: "운송장번호 없음"
            });
            skippedCount++;
            continue;
          }

          if (i >= dbOrders.length) {
            details.push({
              orderNumber: waybill.orderNumber,
              trackingNumber: waybill.trackingNumber,
              status: "failed",
              reason: "테이블에서 주문 찾을 수 없음"
            });
            failedCount++;
            continue;
          }

          // 순서대로 매핑
          const targetOrder = dbOrders[i];
          
          try {
            const effectiveCourier = courier === "default" 
              ? (waybill.rowCourier || "기타택배")
              : courierCompanyName;
            await db.update(pendingOrders)
              .set({
                trackingNumber: waybill.trackingNumber,
                courierCompany: effectiveCourier,
                updatedAt: new Date()
              })
              .where(eq(pendingOrders.id, targetOrder.id));

            details.push({
              orderNumber: waybill.orderNumber,
              trackingNumber: waybill.trackingNumber,
              status: "success"
            });
            successCount++;
          } catch (err) {
            details.push({
              orderNumber: waybill.orderNumber,
              trackingNumber: waybill.trackingNumber,
              status: "failed",
              reason: "DB 업데이트 실패"
            });
            failedCount++;
          }
        }
      }

      // SSE 이벤트 발송
      sseManager.broadcast("pending-orders-updated", { type: "pending-orders-updated" });

      res.json({
        success: successCount,
        failed: failedCount,
        skipped: skippedCount,
        details
      });

    } catch (error: any) {
      console.error("Waybill upload error:", error);
      res.status(500).json({ message: error.message || "운송장 파일 처리 중 오류가 발생했습니다" });
    }
  });

  // Admin: Reset waybill (운송장 초기화)
  app.post('/api/admin/orders/reset-waybill', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }

    try {
      const { mode, orderIds, filters } = req.body;

      if (mode === "selected") {
        if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
          return res.status(400).json({ message: "초기화할 주문을 선택해주세요" });
        }

        const result = await db.update(pendingOrders)
          .set({
            trackingNumber: null,
            courierCompany: null,
            updatedAt: new Date()
          })
          .where(
            and(
              inArray(pendingOrders.id, orderIds),
              eq(pendingOrders.status, "상품준비중")
            )
          )
          .returning({ id: pendingOrders.id });

        sseManager.broadcast("pending-orders-updated", { type: "pending-orders-updated" });

        res.json({
          success: true,
          resetCount: result.length,
          message: `${result.length}건의 운송장이 초기화되었습니다.`
        });

      } else if (mode === "filtered") {
        const conditions: any[] = [eq(pendingOrders.status, "상품준비중")];

        if (filters?.memberId) {
          conditions.push(eq(pendingOrders.memberId, filters.memberId));
        }
        if (filters?.categoryLarge) {
          conditions.push(eq(pendingOrders.categoryLarge, filters.categoryLarge));
        }
        if (filters?.categoryMedium) {
          conditions.push(eq(pendingOrders.categoryMedium, filters.categoryMedium));
        }
        if (filters?.categorySmall) {
          conditions.push(eq(pendingOrders.categorySmall, filters.categorySmall));
        }
        if (filters?.search) {
          const searchTerm = `%${filters.search}%`;
          conditions.push(
            or(
              like(pendingOrders.productName, searchTerm),
              like(pendingOrders.recipientName, searchTerm),
              like(pendingOrders.customOrderNumber, searchTerm)
            )
          );
        }

        conditions.push(isNotNull(pendingOrders.trackingNumber));

        if (filters?.fulfillmentType && filters.fulfillmentType !== "all") {
          conditions.push(eq(pendingOrders.fulfillmentType, filters.fulfillmentType));
        }
        if (filters?.vendorId && filters.vendorId !== "all") {
          conditions.push(eq(pendingOrders.vendorId, Number(filters.vendorId)));
        }

        const result = await db.update(pendingOrders)
          .set({
            trackingNumber: null,
            courierCompany: null,
            updatedAt: new Date()
          })
          .where(and(...conditions))
          .returning({ id: pendingOrders.id });

        sseManager.broadcast("pending-orders-updated", { type: "pending-orders-updated" });

        res.json({
          success: true,
          resetCount: result.length,
          message: `${result.length}건의 운송장이 초기화되었습니다.`
        });

      } else {
        return res.status(400).json({ message: "올바른 초기화 모드를 선택해주세요 (selected 또는 filtered)" });
      }
    } catch (error: any) {
      console.error("Waybill reset error:", error);
      res.status(500).json({ message: error.message || "운송장 초기화 중 오류가 발생했습니다" });
    }
  });

  // Admin: Transfer orders from 상품준비중 to 배송준비중 (only with tracking number)
  app.post('/api/admin/orders/to-ready-to-ship', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }

    try {
      const { mode, orderIds, filters } = req.body;

      if (mode === "all") {
        // Transfer ALL orders with tracking numbers in 상품준비중
        const result = await db.update(pendingOrders)
          .set({
            status: "배송준비중",
            updatedAt: new Date()
          })
          .where(
            and(
              eq(pendingOrders.status, "상품준비중"),
              isNotNull(pendingOrders.trackingNumber)
            )
          )
          .returning({ id: pendingOrders.id });

        sseManager.broadcast("pending-orders-updated", { type: "pending-orders-updated" });

        res.json({
          success: true,
          transferredCount: result.length,
          message: `${result.length}건의 주문이 배송준비중으로 전송되었습니다.`
        });

      } else if (mode === "filtered") {
        // Transfer filtered orders with tracking numbers
        const conditions: any[] = [
          eq(pendingOrders.status, "상품준비중"),
          isNotNull(pendingOrders.trackingNumber)
        ];

        if (filters?.memberId) {
          conditions.push(eq(pendingOrders.memberId, filters.memberId));
        }
        if (filters?.categoryLarge) {
          conditions.push(eq(pendingOrders.categoryLarge, filters.categoryLarge));
        }
        if (filters?.categoryMedium) {
          conditions.push(eq(pendingOrders.categoryMedium, filters.categoryMedium));
        }
        if (filters?.categorySmall) {
          conditions.push(eq(pendingOrders.categorySmall, filters.categorySmall));
        }
        if (filters?.search && filters.search.trim()) {
          const searchTerm = `%${filters.search}%`;
          if (filters.searchFilter) {
            switch (filters.searchFilter) {
              case "주문자명":
                conditions.push(ilike(pendingOrders.ordererName, searchTerm));
                break;
              case "수령자명":
                conditions.push(ilike(pendingOrders.recipientName, searchTerm));
                break;
              case "상품명":
                conditions.push(ilike(pendingOrders.productName, searchTerm));
                break;
              case "상품코드":
                conditions.push(ilike(pendingOrders.productCode, searchTerm));
                break;
              default:
                conditions.push(
                  or(
                    ilike(pendingOrders.productName, searchTerm),
                    ilike(pendingOrders.recipientName, searchTerm),
                    ilike(pendingOrders.ordererName, searchTerm),
                    ilike(pendingOrders.productCode, searchTerm)
                  )
                );
            }
          } else {
            conditions.push(
              or(
                ilike(pendingOrders.productName, searchTerm),
                ilike(pendingOrders.recipientName, searchTerm),
                ilike(pendingOrders.ordererName, searchTerm),
                ilike(pendingOrders.productCode, searchTerm)
              )
            );
          }
        }
        if (filters?.uploadFormat) {
          conditions.push(eq(pendingOrders.uploadFormat, filters.uploadFormat));
        }
        if (filters?.fulfillmentType && filters.fulfillmentType !== "all") {
          conditions.push(eq(pendingOrders.fulfillmentType, filters.fulfillmentType));
        }
        if (filters?.vendorId && filters.vendorId !== "all") {
          conditions.push(eq(pendingOrders.vendorId, Number(filters.vendorId)));
        }

        const result = await db.update(pendingOrders)
          .set({
            status: "배송준비중",
            updatedAt: new Date()
          })
          .where(and(...conditions))
          .returning({ id: pendingOrders.id });

        sseManager.broadcast("pending-orders-updated", { type: "pending-orders-updated" });

        res.json({
          success: true,
          transferredCount: result.length,
          message: `${result.length}건의 주문이 배송준비중으로 전송되었습니다.`
        });

      } else if (mode === "selected") {
        if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
          return res.status(400).json({ message: "전송할 주문을 선택해주세요" });
        }

        // Only transfer selected orders that have tracking numbers (partial transfer allowed)
        const ordersToCheck = await db.select()
          .from(pendingOrders)
          .where(
            and(
              inArray(pendingOrders.id, orderIds),
              eq(pendingOrders.status, "상품준비중")
            )
          );

        const withTracking = ordersToCheck.filter(o => o.trackingNumber);
        const withoutTracking = ordersToCheck.filter(o => !o.trackingNumber);

        if (withTracking.length === 0) {
          return res.status(400).json({
            message: "선택한 주문 중 운송장번호가 등록된 주문이 없습니다. 운송장번호가 등록된 주문만 전송 가능합니다."
          });
        }

        const result = await db.update(pendingOrders)
          .set({
            status: "배송준비중",
            updatedAt: new Date()
          })
          .where(
            and(
              inArray(pendingOrders.id, withTracking.map(o => o.id)),
              eq(pendingOrders.status, "상품준비중"),
              isNotNull(pendingOrders.trackingNumber)
            )
          )
          .returning({ id: pendingOrders.id });

        sseManager.broadcast("pending-orders-updated", { type: "pending-orders-updated" });

        const skippedMsg = withoutTracking.length > 0 
          ? ` (운송장 미등록 ${withoutTracking.length}건 제외)` 
          : "";

        res.json({
          success: true,
          transferredCount: result.length,
          skippedCount: withoutTracking.length,
          message: `${result.length}건의 주문이 배송준비중으로 전송되었습니다.${skippedMsg}`
        });

      } else {
        return res.status(400).json({ message: "올바른 전송 모드를 선택해주세요 (all, filtered, selected)" });
      }
    } catch (error: any) {
      console.error("Transfer to ready-to-ship error:", error);
      res.status(500).json({ message: error.message || "배송준비중 전송 중 오류가 발생했습니다" });
    }
  });

  // Admin: Get ready-to-ship status (waybill delivered, cancel deadline)
  app.get('/api/admin/ready-to-ship-status', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }

    try {
      const waybillSetting = await db.select().from(siteSettings)
        .where(eq(siteSettings.settingKey, "waybill_delivered")).limit(1);
      const cancelSetting = await db.select().from(siteSettings)
        .where(eq(siteSettings.settingKey, "cancel_deadline_closed")).limit(1);

      res.json({
        waybillDelivered: waybillSetting.length > 0 && waybillSetting[0].settingValue === "true",
        cancelDeadlineClosed: cancelSetting.length > 0 && cancelSetting[0].settingValue === "true",
      });
    } catch (error: any) {
      console.error("Get ready-to-ship status error:", error);
      res.status(500).json({ message: error.message || "상태 조회 중 오류가 발생했습니다" });
    }
  });

  // Admin: Deliver waybill to members
  app.post('/api/admin/ready-to-ship/deliver-waybill', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }

    try {
      const existing = await db.select().from(siteSettings)
        .where(eq(siteSettings.settingKey, "waybill_delivered")).limit(1);

      if (existing.length > 0) {
        await db.update(siteSettings)
          .set({ settingValue: "true", updatedAt: new Date() })
          .where(eq(siteSettings.settingKey, "waybill_delivered"));
      } else {
        await db.insert(siteSettings).values({
          settingKey: "waybill_delivered",
          settingValue: "true",
          settingType: "boolean",
          category: "order",
          description: "운송장 전달 상태",
        });
      }

      sseManager.broadcast("pending-orders-updated", { type: "pending-orders-updated" });

      res.json({
        success: true,
        message: "운송장이 회원들에게 전달되었습니다. 회원들이 운송장 파일을 다운로드할 수 있습니다.",
      });
    } catch (error: any) {
      console.error("Deliver waybill error:", error);
      res.status(500).json({ message: error.message || "운송장 전달 중 오류가 발생했습니다" });
    }
  });

  // Admin: Close cancel deadline
  app.post('/api/admin/ready-to-ship/close-cancel-deadline', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }

    try {
      const existing = await db.select().from(siteSettings)
        .where(eq(siteSettings.settingKey, "cancel_deadline_closed")).limit(1);

      if (existing.length > 0) {
        await db.update(siteSettings)
          .set({ settingValue: "true", updatedAt: new Date() })
          .where(eq(siteSettings.settingKey, "cancel_deadline_closed"));
      } else {
        await db.insert(siteSettings).values({
          settingKey: "cancel_deadline_closed",
          settingValue: "true",
          settingType: "boolean",
          category: "order",
          description: "회원취소 마감 상태",
        });
      }

      sseManager.broadcast("pending-orders-updated", { type: "pending-orders-updated" });

      res.json({
        success: true,
        message: "회원취소가 마감되었습니다. 더 이상 회원이 취소를 접수할 수 없습니다.",
      });
    } catch (error: any) {
      console.error("Close cancel deadline error:", error);
      res.status(500).json({ message: error.message || "회원취소 마감 중 오류가 발생했습니다" });
    }
  });

  // Member: Get cancel deadline status
  app.get('/api/member/cancel-deadline-status', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const cancelSetting = await db.select().from(siteSettings)
        .where(eq(siteSettings.settingKey, "cancel_deadline_closed")).limit(1);

      res.json({
        cancelDeadlineClosed: cancelSetting.length > 0 && cancelSetting[0].settingValue === "true",
      });
    } catch (error: any) {
      console.error("Get cancel deadline status error:", error);
      res.status(500).json({ message: error.message || "상태 조회 중 오류가 발생했습니다" });
    }
  });

  // Member: Cancel orders (즉시 회원취소 처리 + 재고 복구)
  app.post('/api/member/cancel-orders', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const cancelSetting = await db.select().from(siteSettings)
        .where(eq(siteSettings.settingKey, "cancel_deadline_closed")).limit(1);
      if (cancelSetting.length > 0 && cancelSetting[0].settingValue === "true") {
        return res.status(400).json({ message: "취소마감 상태입니다. 더 이상 취소 등록이 불가합니다." });
      }

      const { orderNumbers } = req.body;
      if (!orderNumbers || !Array.isArray(orderNumbers) || orderNumbers.length === 0) {
        return res.status(400).json({ message: "취소할 주문번호가 없습니다." });
      }

      const memberId = req.session.userId;
      const member = await storage.getMember(memberId);
      if (!member) {
        return res.status(403).json({ message: "회원 정보를 찾을 수 없습니다." });
      }

      const orderableGrades = ['START', 'DRIVING', 'TOP'];
      if (!orderableGrades.includes(member.grade)) {
        return res.status(403).json({ 
          message: "취소건 등록은 스타트 등급 이상 회원만 가능합니다." 
        });
      }

      let cancelledCount = 0;
      const errors: string[] = [];

      for (const orderNum of orderNumbers) {
        const orderNumStr = String(orderNum).trim();
        if (!orderNumStr) continue;

        const [order] = await db.select().from(pendingOrders)
          .where(and(
            eq(pendingOrders.memberId, memberId),
            or(
              eq(pendingOrders.customOrderNumber, orderNumStr),
              eq(pendingOrders.orderNumber, orderNumStr)
            )
          )).limit(1);

        if (!order) {
          errors.push(`주문번호 ${orderNumStr}: 주문을 찾을 수 없습니다.`);
          continue;
        }

        if (order.status !== "배송준비중") {
          errors.push(`주문번호 ${orderNumStr}: 배송준비중 상태가 아닙니다 (현재: ${order.status}).`);
          continue;
        }

        // 재고 복구 (배송준비중 → 회원취소)
        const productCode = order.productCode || "";
        if (productCode) {
          const mappings = await storage.getProductMaterialMappings(productCode);
          for (const mapping of mappings) {
            await db.update(materials)
              .set({
                currentStock: sql`${materials.currentStock} + ${mapping.quantity}`,
                updatedAt: new Date()
              })
              .where(eq(materials.materialCode, mapping.materialCode));
            console.log(`[회원취소 재고 복구] 원재료 ${mapping.materialCode}에 ${mapping.quantity} 복구`);
          }
        }

        // 상태를 회원취소로 변경
        await db.update(pendingOrders)
          .set({
            status: "회원취소",
            updatedAt: new Date()
          })
          .where(eq(pendingOrders.id, order.id));

        cancelledCount++;
      }

      sseManager.broadcast("pending-orders-updated", { type: "pending-orders-updated" });
      sseManager.broadcast("order-status-changed", { type: "order-status-changed" });

      const message = cancelledCount > 0
        ? `${cancelledCount}건의 주문이 즉시 취소 처리되었습니다.`
        : "취소 처리된 주문이 없습니다.";

      res.json({
        success: true,
        cancelledCount,
        errors,
        message: errors.length > 0 ? `${message} (오류: ${errors.length}건)` : message,
      });
    } catch (error: any) {
      console.error("Member cancel orders error:", error);
      res.status(500).json({ message: error.message || "취소 처리 중 오류가 발생했습니다" });
    }
  });

  // Admin: Transfer orders from 배송준비중 to 배송중 (exclude cancelled)
  app.post('/api/admin/orders/to-shipping', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }

    try {
      const { mode, orderIds, filters } = req.body;

      let targetConditions: any[];

      if (mode === "all") {
        targetConditions = [eq(pendingOrders.status, "배송준비중")];
      } else if (mode === "filtered") {
        targetConditions = [eq(pendingOrders.status, "배송준비중")];
        if (filters?.memberId) {
          targetConditions.push(eq(pendingOrders.memberId, filters.memberId));
        }
        if (filters?.categoryLarge) {
          targetConditions.push(eq(pendingOrders.categoryLarge, filters.categoryLarge));
        }
        if (filters?.categoryMedium) {
          targetConditions.push(eq(pendingOrders.categoryMedium, filters.categoryMedium));
        }
        if (filters?.categorySmall) {
          targetConditions.push(eq(pendingOrders.categorySmall, filters.categorySmall));
        }
        if (filters?.search && filters.search.trim()) {
          const searchTerm = `%${filters.search}%`;
          if (filters.searchFilter) {
            switch (filters.searchFilter) {
              case "주문자명":
                targetConditions.push(ilike(pendingOrders.ordererName, searchTerm));
                break;
              case "수령자명":
                targetConditions.push(ilike(pendingOrders.recipientName, searchTerm));
                break;
              case "상품명":
                targetConditions.push(ilike(pendingOrders.productName, searchTerm));
                break;
              case "상품코드":
                targetConditions.push(ilike(pendingOrders.productCode, searchTerm));
                break;
              default:
                targetConditions.push(
                  or(
                    ilike(pendingOrders.productName, searchTerm),
                    ilike(pendingOrders.recipientName, searchTerm),
                    ilike(pendingOrders.ordererName, searchTerm),
                    ilike(pendingOrders.productCode, searchTerm)
                  )
                );
            }
          } else {
            targetConditions.push(
              or(
                ilike(pendingOrders.productName, searchTerm),
                ilike(pendingOrders.recipientName, searchTerm),
                ilike(pendingOrders.ordererName, searchTerm),
                ilike(pendingOrders.productCode, searchTerm)
              )
            );
          }
        }
      } else if (mode === "selected") {
        if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
          return res.status(400).json({ message: "전송할 주문을 선택해주세요" });
        }
        targetConditions = [
          inArray(pendingOrders.id, orderIds),
          eq(pendingOrders.status, "배송준비중")
        ];
      } else {
        return res.status(400).json({ message: "올바른 전송 모드를 선택해주세요 (all, filtered, selected)" });
      }

      const targetOrders = await db.select({
        id: pendingOrders.id,
        memberId: pendingOrders.memberId,
        productCode: pendingOrders.productCode,
        fulfillmentType: pendingOrders.fulfillmentType,
      }).from(pendingOrders).where(and(...targetConditions));

      if (targetOrders.length === 0) {
        return res.json({ success: true, transferredCount: 0, message: "전송 대상 주문이 없습니다." });
      }

      const memberIds = Array.from(new Set(targetOrders.map(o => o.memberId)));
      const productCodes = Array.from(new Set(targetOrders.map(o => o.productCode)));

      const membersList = await db.select({ id: members.id, grade: members.grade, deposit: members.deposit, point: members.point, companyName: members.companyName })
        .from(members)
        .where(inArray(members.id, memberIds));
      const memberMap = new Map(membersList.map(m => [m.id, m]));

      const productsList = await db.select()
        .from(currentProducts)
        .where(inArray(currentProducts.productCode, productCodes));
      const productPriceMap = new Map(productsList.map(p => [p.productCode, p]));

      // 회원별로 주문 그룹핑
      const ordersByMember = new Map<string, typeof targetOrders>();
      for (const order of targetOrders) {
        const existing = ordersByMember.get(order.memberId) || [];
        existing.push(order);
        ordersByMember.set(order.memberId, existing);
      }

      let transferredCount = 0;
      const failedOrders: { memberId: string; companyName: string; shortage: number; count: number }[] = [];

      // 회원별로 순차 정산 처리 (트랜잭션으로 데이터 일관성 보장)
      for (const [memberId, memberOrders] of ordersByMember) {
        const memberInfo = memberMap.get(memberId);
        if (!memberInfo) continue;

        try {
          const result = await db.transaction(async (tx) => {
            const [lockedMember] = await tx.select({ deposit: members.deposit, point: members.point })
              .from(members).where(eq(members.id, memberId)).for('update');
            if (!lockedMember) return { transferred: 0, failed: true, shortage: 0, remainingCount: memberOrders.length };

            let currentDeposit = lockedMember.deposit;
            let currentPoint = lockedMember.point;
            let memberTransferred = 0;

            for (const order of memberOrders) {
              const product = productPriceMap.get(order.productCode);
              const confirmedPrice = product ? getSupplyPriceByGrade(product, memberInfo.grade) : 0;

              const totalAvailable = currentDeposit + currentPoint;
              if (totalAvailable < confirmedPrice) {
                return {
                  transferred: memberTransferred,
                  failed: true,
                  shortage: confirmedPrice - totalAvailable,
                  remainingCount: memberOrders.length - memberTransferred,
                };
              }

              let pointerDeduct = 0;
              let depositDeduct = 0;

              if (currentPoint >= confirmedPrice) {
                pointerDeduct = confirmedPrice;
              } else {
                pointerDeduct = currentPoint;
                depositDeduct = confirmedPrice - currentPoint;
              }

              currentPoint -= pointerDeduct;
              currentDeposit -= depositDeduct;

              await tx.update(pendingOrders)
                .set({
                  status: "배송중",
                  supplyPrice: confirmedPrice ?? undefined,
                  priceConfirmed: true,
                  updatedAt: new Date(),
                })
                .where(eq(pendingOrders.id, order.id));

              await tx.insert(settlementHistory).values({
                memberId,
                orderId: order.id,
                settlementType: "auto",
                pointerAmount: pointerDeduct,
                depositAmount: depositDeduct,
                totalAmount: confirmedPrice,
                pointerBalance: currentPoint,
                depositBalance: currentDeposit,
                description: `배송중 전환 자동 정산 (주문 ${order.id})`,
              });

              if (pointerDeduct > 0) {
                await tx.insert(pointerHistory).values({
                  memberId,
                  type: "deduct",
                  amount: pointerDeduct,
                  balanceAfter: currentPoint,
                  description: `주문 정산 (배송중 전환)`,
                  relatedOrderId: order.id,
                });
              }

              if (depositDeduct > 0) {
                await tx.insert(depositHistory).values({
                  memberId,
                  type: "deduct",
                  amount: depositDeduct,
                  balanceAfter: currentDeposit,
                  description: `주문 정산 (배송중 전환)`,
                  relatedOrderId: order.id,
                });
              }

              // 자체발송 주문인 경우 product_stocks 재고 차감
              if (order.fulfillmentType !== "vendor" && order.productCode) {
                const stockResult = await tx.update(productStocks)
                  .set({
                    currentStock: sql`GREATEST(0, ${productStocks.currentStock} - 1)`,
                    updatedAt: new Date(),
                  })
                  .where(eq(productStocks.productCode, order.productCode))
                  .returning();
                if (stockResult.length === 0) {
                  console.warn(`[재고차감] product_stocks에 해당 상품 없음: ${order.productCode}`);
                } else {
                  console.log(`[배송중 전환 재고 차감] 상품코드: ${order.productCode}, 자체발송`);
                }
              }

              memberTransferred++;
            }

            if (memberTransferred > 0) {
              await tx.update(members)
                .set({
                  deposit: currentDeposit,
                  point: currentPoint,
                  updatedAt: new Date(),
                })
                .where(eq(members.id, memberId));
            }

            return { transferred: memberTransferred, failed: false, shortage: 0, remainingCount: 0 };
          });

          transferredCount += result.transferred;

          if (result.failed) {
            failedOrders.push({
              memberId,
              companyName: memberInfo.companyName,
              shortage: result.shortage,
              count: result.remainingCount,
            });
          }
        } catch (txError: any) {
          console.error(`회원 ${memberId} 정산 트랜잭션 실패:`, txError);
          failedOrders.push({
            memberId,
            companyName: memberInfo.companyName,
            shortage: 0,
            count: memberOrders.length,
          });
        }
      }

      const remainingReady = await db.select({ count: sql<string>`COUNT(*)` })
        .from(pendingOrders)
        .where(eq(pendingOrders.status, "배송준비중"));
      const remainingCount = parseInt(remainingReady[0]?.count || '0');

      if (remainingCount === 0) {
        const waybillExists = await db.select().from(siteSettings)
          .where(eq(siteSettings.settingKey, "waybill_delivered")).limit(1);
        if (waybillExists.length > 0) {
          await db.update(siteSettings)
            .set({ settingValue: "false", updatedAt: new Date() })
            .where(eq(siteSettings.settingKey, "waybill_delivered"));
        }
        const cancelExists = await db.select().from(siteSettings)
          .where(eq(siteSettings.settingKey, "cancel_deadline_closed")).limit(1);
        if (cancelExists.length > 0) {
          await db.update(siteSettings)
            .set({ settingValue: "false", updatedAt: new Date() })
            .where(eq(siteSettings.settingKey, "cancel_deadline_closed"));
        }
      }

      sseManager.broadcast("pending-orders-updated", { type: "pending-orders-updated" });
      sseManager.broadcast("order-status-changed", { type: "order-status-changed" });

      if (failedOrders.length > 0) {
        const failedSummary = failedOrders.map(f => `${f.companyName}: ${f.count}건 (부족금액 ${f.shortage.toLocaleString()}원)`).join(', ');
        res.json({
          success: true,
          transferredCount,
          failedOrders,
          message: `${transferredCount}건 배송중 전환 완료. 잔액 부족으로 ${failedOrders.reduce((s, f) => s + f.count, 0)}건 미처리: ${failedSummary}`
        });
      } else {
        res.json({
          success: true,
          transferredCount,
          message: `${transferredCount}건의 주문이 배송중으로 전송되었습니다.`
        });
      }
    } catch (error: any) {
      console.error("Transfer to shipping error:", error);
      res.status(500).json({ message: error.message || "배송중 전송 중 오류가 발생했습니다" });
    }
  });

  // Admin: Update pending order (tracking number, courier, status)
  app.patch('/api/admin/pending-orders/:id', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }

    const { id } = req.params;
    const { trackingNumber, courierCompany, status } = req.body;

    try {
      // 상태 변경 시 재고 복구를 위해 현재 주문 조회
      const [currentOrder] = await db.select()
        .from(pendingOrders)
        .where(eq(pendingOrders.id, id));
      
      if (!currentOrder) {
        return res.status(404).json({ message: "주문을 찾을 수 없습니다" });
      }

      const updateData: any = { updatedAt: new Date() };
      
      if (trackingNumber !== undefined) updateData.trackingNumber = trackingNumber;
      if (courierCompany !== undefined) updateData.courierCompany = courierCompany;
      if (status !== undefined && pendingOrderStatuses.includes(status)) {
        updateData.status = status;
      }

      // 재고 복구/차감은 자체발송(fulfillmentType != 'vendor') 주문만 처리
      const isVendorOrder = currentOrder.fulfillmentType === "vendor";
      const stockDeductedStatuses = ["상품준비중", "배송준비중", "배송중"];
      const stockNotDeductedStatuses = ["대기", "취소", "주문조정", "회원취소"];
      const currentStatus = currentOrder.status || "";
      
      if (!isVendorOrder && status !== undefined && 
          status !== currentStatus &&
          stockDeductedStatuses.includes(currentStatus) &&
          stockNotDeductedStatuses.includes(status)) {
        const productCode = currentOrder.productCode || "";
        console.log(`[재고 복구 시도] 상태: ${currentOrder.status} → ${status}, 상품코드: ${productCode}`);
        if (productCode) {
          const mappings = await storage.getProductMaterialMappings(productCode);
          console.log(`[재고 복구] 상품코드 ${productCode}의 원재료 매핑 수: ${mappings.length}`);
          if (mappings.length === 0) {
            console.log(`[재고 복구 경고] 상품코드 ${productCode}에 대한 원재료 매핑이 없습니다!`);
          }
          for (const mapping of mappings) {
            await db.update(materials)
              .set({ 
                currentStock: sql`${materials.currentStock} + ${mapping.quantity}`,
                updatedAt: new Date()
              })
              .where(eq(materials.materialCode, mapping.materialCode));
            console.log(`[재고 복구] 원재료 ${mapping.materialCode}에 ${mapping.quantity} 복구`);
          }
          console.log(`상태 변경(${currentOrder.status} → ${status}) - 재고 복구 완료: ${productCode}`);
        }
      }
      
      if (!isVendorOrder && status !== undefined && 
          status !== currentStatus &&
          stockNotDeductedStatuses.includes(currentStatus) &&
          status === "상품준비중") {
        const productCode = currentOrder.productCode || "";
        console.log(`[재고 차감 시도] 상태: ${currentOrder.status} → ${status}, 상품코드: ${productCode}`);
        if (productCode) {
          const mappings = await storage.getProductMaterialMappings(productCode);
          console.log(`[재고 차감] 상품코드 ${productCode}의 원재료 매핑 수: ${mappings.length}`);
          if (mappings.length === 0) {
            console.log(`[재고 차감 경고] 상품코드 ${productCode}에 대한 원재료 매핑이 없습니다!`);
          }
          for (const mapping of mappings) {
            await db.update(materials)
              .set({ 
                currentStock: sql`GREATEST(0, ${materials.currentStock} - ${mapping.quantity})`,
                updatedAt: new Date()
              })
              .where(eq(materials.materialCode, mapping.materialCode));
            console.log(`[재고 차감] 원재료 ${mapping.materialCode}에서 ${mapping.quantity} 차감`);
          }
          console.log(`상태 변경(${currentOrder.status} → ${status}) - 재고 차감 완료: ${productCode}`);
        }
      }

      // 배송중 전환 시 자체발송 주문 - 트랜잭션으로 주문 상태 변경 + product_stocks 재고 차감 묶기
      const needsShippingStockDeduct = !isVendorOrder && status !== undefined &&
          status !== currentStatus && status === "배송중" && !!(currentOrder.productCode);

      let updated;
      if (needsShippingStockDeduct) {
        const result = await db.transaction(async (tx) => {
          const [orderResult] = await tx.update(pendingOrders)
            .set(updateData)
            .where(eq(pendingOrders.id, id))
            .returning();
          if (orderResult) {
            const stockResult = await tx.update(productStocks)
              .set({
                currentStock: sql`GREATEST(0, ${productStocks.currentStock} - 1)`,
                updatedAt: new Date(),
              })
              .where(eq(productStocks.productCode, currentOrder.productCode!))
              .returning();
            if (stockResult.length === 0) {
              console.warn(`[재고차감] product_stocks에 해당 상품 없음: ${currentOrder.productCode}`);
            } else {
              console.log(`[배송중 전환 재고 차감] 상품코드: ${currentOrder.productCode}, 자체발송 (개별)`);
            }
          }
          return orderResult;
        });
        updated = result;
      } else {
        const [result] = await db.update(pendingOrders)
          .set(updateData)
          .where(eq(pendingOrders.id, id))
          .returning();
        updated = result;
      }

      if (!updated) {
        return res.status(404).json({ message: "주문을 찾을 수 없습니다" });
      }

      // SSE: 해당 회원에게 주문 상태 변경 알림
      if (updated.memberId) {
        sseManager.sendToMember(updated.memberId, "order-updated", { 
          type: "pending-order",
          orderId: updated.id,
          status: updated.status,
          trackingNumber: updated.trackingNumber,
          courierCompany: updated.courierCompany
        });
      }
      
      // SSE: 관리자들에게도 주문 상태 변경 알림
      sseManager.sendToAdmins("order-updated", {
        type: "pending-order",
        orderId: updated.id,
        status: updated.status
      });

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Delete selected pending orders (bulk)
  app.delete('/api/admin/pending-orders', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }

    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "삭제할 주문을 선택해주세요" });
    }

    try {
      // 먼저 삭제 전 주문 정보 조회 (재고 복구를 위해)
      const ordersToDelete = await db.select()
        .from(pendingOrders)
        .where(inArray(pendingOrders.id, ids));

      // 상품준비중, 배송준비중, 배송중 상태의 주문만 재고 복구 대상
      const ordersForStockRestore = ordersToDelete.filter(
        o => o.status === "상품준비중" || o.status === "배송준비중" || o.status === "배송중"
      );

      // 재고 복구 로직 실행
      if (ordersForStockRestore.length > 0) {
        const productOrderCounts: Record<string, number> = {};
        for (const order of ordersForStockRestore) {
          const productCode = order.productCode || "";
          if (productCode) {
            productOrderCounts[productCode] = (productOrderCounts[productCode] || 0) + 1;
          }
        }

        const materialRestorations: Record<string, number> = {};
        for (const [productCode, orderCount] of Object.entries(productOrderCounts)) {
          const mappings = await storage.getProductMaterialMappings(productCode);
          for (const mapping of mappings) {
            const restoreAmount = mapping.quantity * orderCount;
            materialRestorations[mapping.materialCode] = 
              (materialRestorations[mapping.materialCode] || 0) + restoreAmount;
          }
        }

        // 원자적 SQL 연산으로 재고 복구 (race condition 방지)
        for (const [materialCode, restoreAmount] of Object.entries(materialRestorations)) {
          await db.update(materials)
            .set({ 
              currentStock: sql`${materials.currentStock} + ${restoreAmount}`,
              updatedAt: new Date()
            })
            .where(eq(materials.materialCode, materialCode));
        }
        console.log(`재고 복구 완료 (원자적 연산): ${Object.keys(materialRestorations).length}개 원재료, ${ordersForStockRestore.length}건 주문`);
      }

      const deleted = await db.delete(pendingOrders)
        .where(inArray(pendingOrders.id, ids))
        .returning();

      // 삭제된 주문의 상품코드별로 배분 데이터 정리
      const deletedProductCodes = [...new Set(deleted.map(d => d.productCode).filter(Boolean))];
      if (deletedProductCodes.length > 0) {
        await db.transaction(async (tx) => {
          for (const productCode of deletedProductCodes) {
            const relatedAllocations = await tx.select().from(orderAllocations)
              .where(eq(orderAllocations.productCode, productCode!));
            
            for (const allocation of relatedAllocations) {
              const remainingOrders = await tx.select().from(pendingOrders)
                .where(eq(pendingOrders.productCode, productCode!));
              
              if (remainingOrders.length === 0) {
                await tx.delete(allocationDetails).where(eq(allocationDetails.allocationId, allocation.id));
                await tx.delete(orderAllocations).where(eq(orderAllocations.id, allocation.id));
                console.log(`선택 삭제 - 배분 데이터 정리: ${productCode} 배분 삭제`);
              } else {
                const totalQty = remainingOrders.reduce((sum, o) => sum + (o.quantity || 1), 0);
                await tx.update(orderAllocations)
                  .set({ 
                    totalQuantity: totalQty,
                    updatedAt: new Date(),
                  })
                  .where(eq(orderAllocations.id, allocation.id));
              }
            }
          }
        });
      }

      // SSE: 해당 회원들에게 주문 삭제 알림
      const memberIds = Array.from(new Set(deleted.map(d => d.memberId).filter(Boolean)));
      memberIds.forEach(memberId => {
        if (memberId) {
          sseManager.sendToMember(memberId, "orders-deleted", { 
            type: "pending-order",
            count: deleted.filter(d => d.memberId === memberId).length
          });
        }
      });
      
      // SSE: 관리자들에게도 주문 삭제 알림
      sseManager.sendToAdmins("orders-deleted", {
        type: "pending-order",
        count: deleted.length
      });

      // SSE: 삭제된 주문의 상품코드와 관련된 파트너(외주업체)에게도 알림
      if (deletedProductCodes.length > 0) {
        const relatedVendorDetails = await db.select({ vendorId: allocationDetails.vendorId })
          .from(allocationDetails)
          .innerJoin(orderAllocations, eq(allocationDetails.allocationId, orderAllocations.id))
          .where(sql`${orderAllocations.productCode} IN (${sql.join(deletedProductCodes.map(c => sql`${c}`), sql`, `)})`)
          .groupBy(allocationDetails.vendorId);
        
        for (const detail of relatedVendorDetails) {
          sseManager.sendToPartner(detail.vendorId, "allocation-updated", {
            type: "orders-deleted",
            productCodes: deletedProductCodes,
          });
        }
      }

      res.json({ message: `${deleted.length}건의 주문이 삭제되었습니다`, deletedCount: deleted.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Delete all pending orders
  app.delete('/api/admin/pending-orders/all', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }

    try {
      // 먼저 삭제 전 모든 주문 조회 (재고 복구를 위해)
      const allOrdersToDelete = await db.select().from(pendingOrders);
      
      // 상품준비중, 배송준비중, 배송중 상태의 주문만 재고 복구 대상
      const ordersForStockRestore = allOrdersToDelete.filter(
        o => o.status === "상품준비중" || o.status === "배송준비중" || o.status === "배송중"
      );

      // 재고 복구 로직 실행
      if (ordersForStockRestore.length > 0) {
        const productOrderCounts: Record<string, number> = {};
        for (const order of ordersForStockRestore) {
          const productCode = order.productCode || "";
          if (productCode) {
            productOrderCounts[productCode] = (productOrderCounts[productCode] || 0) + 1;
          }
        }

        const materialRestorations: Record<string, number> = {};
        for (const [productCode, orderCount] of Object.entries(productOrderCounts)) {
          const mappings = await storage.getProductMaterialMappings(productCode);
          for (const mapping of mappings) {
            const restoreAmount = mapping.quantity * orderCount;
            materialRestorations[mapping.materialCode] = 
              (materialRestorations[mapping.materialCode] || 0) + restoreAmount;
          }
        }

        // 원자적 SQL 연산으로 재고 복구 (race condition 방지)
        for (const [materialCode, restoreAmount] of Object.entries(materialRestorations)) {
          await db.update(materials)
            .set({ 
              currentStock: sql`${materials.currentStock} + ${restoreAmount}`,
              updatedAt: new Date()
            })
            .where(eq(materials.materialCode, materialCode));
        }
        console.log(`전체 삭제 - 재고 복구 완료 (원자적 연산): ${Object.keys(materialRestorations).length}개 원재료, ${ordersForStockRestore.length}건 주문`);
      }

      const deleted = await db.delete(pendingOrders).returning();

      // 배분 데이터 삭제 전 관련 파트너 벤더 ID 조회
      const affectedVendors = await db.select({ vendorId: allocationDetails.vendorId })
        .from(allocationDetails)
        .groupBy(allocationDetails.vendorId);

      // 전체 주문 삭제이므로 모든 배분 데이터도 함께 전역 삭제 (allocation_details → order_allocations 순서)
      await db.transaction(async (tx) => {
        const existingAllocations = await tx.select().from(orderAllocations);
        if (existingAllocations.length > 0) {
          await tx.delete(allocationDetails);
          await tx.delete(orderAllocations);
          console.log(`전체 삭제 - 배분 데이터 전역 정리 완료: ${existingAllocations.length}개 배분, 관련 상세 모두 삭제`);
        }
      });

      // SSE: 해당 회원들에게 주문 삭제 알림
      const memberIds = Array.from(new Set(deleted.map(d => d.memberId).filter(Boolean)));
      memberIds.forEach(memberId => {
        if (memberId) {
          sseManager.sendToMember(memberId, "orders-deleted", { 
            type: "pending-order",
            count: deleted.filter(d => d.memberId === memberId).length
          });
        }
      });
      
      // SSE: 관리자들에게도 주문 삭제 알림
      sseManager.sendToAdmins("orders-deleted", {
        type: "pending-order",
        count: deleted.length
      });

      // SSE: 관련 파트너(외주업체)에게도 배분 삭제 알림
      for (const vendor of affectedVendors) {
        sseManager.sendToPartner(vendor.vendorId, "allocation-updated", {
          type: "orders-deleted-all",
        });
      }

      res.json({ message: `${deleted.length}건의 주문이 삭제되었습니다`, deletedCount: deleted.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Delete single pending order
  app.delete('/api/admin/pending-orders/:id', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }

    const { id } = req.params;

    try {
      // 먼저 삭제 전 주문 조회 (재고 복구를 위해)
      const [orderToDelete] = await db.select()
        .from(pendingOrders)
        .where(eq(pendingOrders.id, id));
      
      if (!orderToDelete) {
        return res.status(404).json({ message: "주문을 찾을 수 없습니다" });
      }

      // 상품준비중, 배송준비중, 배송중 상태인 경우 재고 복구
      if (orderToDelete.status === "상품준비중" || orderToDelete.status === "배송준비중" || orderToDelete.status === "배송중") {
        const productCode = orderToDelete.productCode || "";
        if (productCode) {
          const mappings = await storage.getProductMaterialMappings(productCode);
          for (const mapping of mappings) {
            // 원자적 SQL 연산 사용 (race condition 방지)
            await db.update(materials)
              .set({ 
                currentStock: sql`${materials.currentStock} + ${mapping.quantity}`,
                updatedAt: new Date()
              })
              .where(eq(materials.materialCode, mapping.materialCode));
          }
          console.log(`단일 주문 삭제 - 재고 복구 완료 (원자적 연산): ${productCode}`);
        }
      }

      // 주문 삭제와 배분 정리를 트랜잭션으로 처리
      const deleted = await db.transaction(async (tx) => {
        const [deletedOrder] = await tx.delete(pendingOrders)
          .where(eq(pendingOrders.id, id))
          .returning();

        // 삭제된 주문의 상품코드에 해당하는 배분이 있으면 수량 재계산
        // allocation_details는 vendor별 수량이므로 개별 주문 참조 없음 - totalQuantity만 재계산
        if (deletedOrder && deletedOrder.productCode) {
          const relatedAllocations = await tx.select().from(orderAllocations)
            .where(eq(orderAllocations.productCode, deletedOrder.productCode));
          
          for (const allocation of relatedAllocations) {
            const remainingOrders = await tx.select().from(pendingOrders)
              .where(eq(pendingOrders.productCode, deletedOrder.productCode));
            
            if (remainingOrders.length === 0) {
              await tx.delete(allocationDetails).where(eq(allocationDetails.allocationId, allocation.id));
              await tx.delete(orderAllocations).where(eq(orderAllocations.id, allocation.id));
              console.log(`개별 삭제 - 배분 데이터 정리: ${deletedOrder.productCode} 배분 삭제`);
            } else {
              const totalQty = remainingOrders.reduce((sum, o) => sum + (o.quantity || 1), 0);
              await tx.update(orderAllocations)
                .set({ 
                  totalQuantity: totalQty,
                  updatedAt: new Date(),
                })
                .where(eq(orderAllocations.id, allocation.id));
            }
          }
        }
        return deletedOrder;
      });

      // SSE: 삭제된 주문의 상품코드 관련 파트너에게 알림
      if (deleted && deleted.productCode) {
        const relatedVendorDetails = await db.select({ vendorId: allocationDetails.vendorId })
          .from(allocationDetails)
          .innerJoin(orderAllocations, eq(allocationDetails.allocationId, orderAllocations.id))
          .where(eq(orderAllocations.productCode, deleted.productCode))
          .groupBy(allocationDetails.vendorId);
        
        for (const detail of relatedVendorDetails) {
          sseManager.sendToPartner(detail.vendorId, "allocation-updated", {
            type: "order-deleted",
            productCode: deleted.productCode,
          });
        }
      }

      res.json({ message: "주문이 삭제되었습니다" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== 양식 관리 API ====================
  
  const templateUpload = multer({ storage: multer.memoryStorage() });
  
  // 양식 목록 조회 (관리자용)
  app.get("/api/admin/form-templates", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }

    try {
      const templates = await db.select().from(formTemplates).orderBy(formTemplates.category, formTemplates.name);
      res.json(templates);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 양식 단건 조회 (관리자용)
  app.get("/api/admin/form-templates/:id", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }

    try {
      const [template] = await db.select().from(formTemplates).where(eq(formTemplates.id, req.params.id));
      if (!template) {
        return res.status(404).json({ message: "양식을 찾을 수 없습니다" });
      }
      res.json(template);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 양식 코드로 조회 (공개 - 다운로드용)
  app.get("/api/form-templates/code/:code", async (req, res) => {
    try {
      const [template] = await db.select().from(formTemplates).where(eq(formTemplates.code, req.params.code));
      if (!template || template.isActive !== "true") {
        return res.status(404).json({ message: "양식을 찾을 수 없습니다" });
      }
      res.json(template);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 양식 생성 (관리자용)
  app.post("/api/admin/form-templates", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }

    try {
      const { name, code, description, category } = req.body;
      
      if (!name || !code) {
        return res.status(400).json({ error: "양식 이름과 코드는 필수입니다" });
      }

      // 코드 중복 체크
      const [existing] = await db.select().from(formTemplates).where(eq(formTemplates.code, code));
      if (existing) {
        return res.status(400).json({ error: "이미 사용 중인 양식 코드입니다" });
      }

      const [template] = await db.insert(formTemplates).values({
        name,
        code,
        description: description || null,
        category: category || "기타",
        uploadedBy: req.session.userId,
      }).returning();

      res.status(201).json(template);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 양식 수정 (관리자용)
  app.put("/api/admin/form-templates/:id", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }

    try {
      const { name, description, category, isActive } = req.body;
      
      const [template] = await db.update(formTemplates)
        .set({
          name,
          description,
          category,
          isActive,
          updatedAt: new Date(),
        })
        .where(eq(formTemplates.id, req.params.id))
        .returning();

      if (!template) {
        return res.status(404).json({ message: "양식을 찾을 수 없습니다" });
      }

      res.json(template);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 양식 파일 업로드 (관리자용)
  app.post("/api/admin/form-templates/:id/upload", templateUpload.single("file"), async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }

    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "파일이 필요합니다" });
    }

    try {
      // 기존 양식 확인
      const [existing] = await db.select().from(formTemplates).where(eq(formTemplates.id, req.params.id));
      if (!existing) {
        return res.status(404).json({ message: "양식을 찾을 수 없습니다" });
      }

      // R2에 파일 업로드
      const { storagePath, publicUrl } = await uploadImage(
        file.buffer,
        file.originalname,
        file.mimetype,
        "form-templates"
      );

      // 파일 확장자 추출
      const fileType = file.originalname.split('.').pop()?.toLowerCase() || 'unknown';

      // 양식 정보 업데이트
      const [template] = await db.update(formTemplates)
        .set({
          fileUrl: publicUrl,
          fileName: file.originalname,
          fileType: fileType,
          fileSize: file.size,
          version: (existing.version || 1) + 1,
          uploadedBy: req.session.userId,
          updatedAt: new Date(),
        })
        .where(eq(formTemplates.id, req.params.id))
        .returning();

      res.json(template);
    } catch (error: any) {
      console.error("Template upload error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // 양식 삭제 (관리자용)
  app.delete("/api/admin/form-templates/:id", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }

    try {
      const [deleted] = await db.delete(formTemplates)
        .where(eq(formTemplates.id, req.params.id))
        .returning();

      if (!deleted) {
        return res.status(404).json({ message: "양식을 찾을 수 없습니다" });
      }

      res.json({ message: "양식이 삭제되었습니다" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 초기 양식 시드 (관리자용)
  app.post("/api/admin/form-templates/seed", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || user.role !== "SUPER_ADMIN") {
      return res.status(403).json({ message: "SUPER_ADMIN 권한이 필요합니다" });
    }

    try {
      // 기본 양식 목록 생성
      const defaultTemplates = [
        { name: "주문등록 양식", code: "order_registration", description: "회원 엑셀 주문 등록용 양식", category: "주문관리" },
        { name: "상품등록 양식", code: "product_registration", description: "상품 일괄 등록용 양식", category: "상품관리" },
        { name: "재고등록 양식", code: "stock_registration", description: "재고 일괄 등록용 양식", category: "재고관리" },
        { name: "회원등록 양식", code: "member_registration", description: "회원 일괄 등록용 양식", category: "회원관리" },
        { name: "상품매핑 양식", code: "product_mapping", description: "상품-자재 매핑 등록용 양식", category: "재고관리" },
      ];

      const created = [];
      for (const template of defaultTemplates) {
        const [existing] = await db.select().from(formTemplates).where(eq(formTemplates.code, template.code));
        if (!existing) {
          const [newTemplate] = await db.insert(formTemplates).values({
            ...template,
            uploadedBy: req.session.userId,
          }).returning();
          created.push(newTemplate);
        }
      }

      res.json({ message: `${created.length}개의 양식이 생성되었습니다`, templates: created });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 주문조정 재고표 API - 원재료 기반 주문 데이터 조회
  app.get('/api/admin/order-adjustment-stock', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }

    try {
      // 1. 대기 상태의 주문들을 상품코드별로 그룹화 (주문조정 완료건은 제외)
      const pendingOrdersList = await db.select()
        .from(pendingOrders)
        .where(eq(pendingOrders.status, "대기"));
      
      // 상품코드별 주문 합계 계산
      const productOrderSummary: Record<string, {
        productCode: string;
        productName: string;
        orderCount: number;
        orders: typeof pendingOrdersList;
      }> = {};
      
      for (const order of pendingOrdersList) {
        const code = order.productCode || "";
        if (!code) continue;
        
        if (!productOrderSummary[code]) {
          productOrderSummary[code] = {
            productCode: code,
            productName: order.productName || "",
            orderCount: 0,
            orders: []
          };
        }
        productOrderSummary[code].orderCount++;
        productOrderSummary[code].orders.push(order);
      }

      // 2. 모든 상품-재료 매핑 조회
      const allMappings = await storage.getAllProductMappings();
      const productMaterialMap: Record<string, {
        productCode: string;
        productName: string;
        materials: { materialCode: string; materialName: string; materialType: string; quantity: number }[];
      }> = {};
      
      for (const mapping of allMappings) {
        const materials = await storage.getProductMaterialMappings(mapping.productCode);
        productMaterialMap[mapping.productCode] = {
          productCode: mapping.productCode,
          productName: mapping.productName,
          materials: materials.map(m => ({
            materialCode: m.materialCode,
            materialName: m.materialName,
            materialType: m.materialType,
            quantity: m.quantity
          }))
        };
      }

      // 3. 모든 원재료 재고 조회
      const allMaterials = await storage.getMaterialsByCategory();
      const materialStockMap: Record<string, { materialName: string; materialType: string; currentStock: number }> = {};
      for (const m of allMaterials) {
        materialStockMap[m.materialCode] = {
          materialName: m.materialName,
          materialType: m.materialType,
          currentStock: m.currentStock
        };
      }

      // 4. 원재료 기준으로 상품 그룹화 및 계산
      // 원재료별로 그룹화: { [materialKey]: { products: [...], totalRequired, stock, remaining } }
      const materialGroups: Record<string, {
        materialCode: string;
        materialName: string;
        materialType: string;
        products: {
          productCode: string;
          productName: string;
          orderCount: number;
          materialQuantity: number; // 상품 1개당 필요 원재료 수량
          requiredMaterial: number; // 주문수량 × 필요수량
          orders: typeof pendingOrdersList;
        }[];
        totalRequired: number; // 해당 원재료 합계
        currentStock: number; // 원재료 재고
        remainingStock: number; // 재고합산(잔여재고)
      }> = {};

      // 주문이 있는 상품들에 대해서만 처리
      for (const [productCode, summary] of Object.entries(productOrderSummary)) {
        const mapping = productMaterialMap[productCode];
        if (!mapping || mapping.materials.length === 0) continue;

        // 원물(raw) 또는 반재료(semi)만 사용 - 부재료(auxiliary)는 제외
        // 상품은 원물 단독 또는 반재료+부재료로 구성됨
        const primaryMaterial = mapping.materials.find(m => 
          m.materialType === 'raw' || m.materialType === 'semi'
        );
        if (!primaryMaterial) continue;

        const materialKey = `${primaryMaterial.materialCode}_${primaryMaterial.materialName}`;
        
        if (!materialGroups[materialKey]) {
          const stockInfo = materialStockMap[primaryMaterial.materialCode];
          materialGroups[materialKey] = {
            materialCode: primaryMaterial.materialCode,
            materialName: primaryMaterial.materialName,
            materialType: primaryMaterial.materialType,
            products: [],
            totalRequired: 0,
            currentStock: stockInfo?.currentStock || 0,
            remainingStock: 0
          };
        }

        const requiredMaterial = summary.orderCount * primaryMaterial.quantity;
        materialGroups[materialKey].products.push({
          productCode: summary.productCode,
          productName: summary.productName,
          orderCount: summary.orderCount,
          materialQuantity: primaryMaterial.quantity,
          requiredMaterial: requiredMaterial,
          orders: summary.orders
        });
        materialGroups[materialKey].totalRequired += requiredMaterial;
      }

      // 잔여재고 계산
      for (const group of Object.values(materialGroups)) {
        group.remainingStock = group.currentStock - group.totalRequired;
      }

      // 5. 결과를 배열로 변환하여 반환
      // 주문을 순번(sequenceNumber) 내림차순으로 정렬하여 저장
      const result = Object.values(materialGroups).map(group => ({
        materialCode: group.materialCode,
        materialName: group.materialName,
        materialType: group.materialType,
        totalRequired: group.totalRequired,
        currentStock: group.currentStock,
        remainingStock: group.remainingStock,
        isDeficit: group.remainingStock < 0,
        stockSource: "material" as "material" | "allocation",
        allocationId: null as number | null,
        allocationDetails: null as any,
        products: group.products.map(p => {
          // 순번 내림차순 정렬 (높은 순번이 먼저 취소됨)
          const sortedOrders = [...p.orders].sort((a, b) => {
            const seqA = typeof a.sequenceNumber === 'string' ? parseInt(a.sequenceNumber.replace(/\D/g, ''), 10) || 0 : (a.sequenceNumber || 0);
            const seqB = typeof b.sequenceNumber === 'string' ? parseInt(b.sequenceNumber.replace(/\D/g, ''), 10) || 0 : (b.sequenceNumber || 0);
            return seqB - seqA; // 내림차순
          });
          return {
            productCode: p.productCode,
            productName: p.productName,
            orderCount: p.orderCount,
            materialQuantity: p.materialQuantity,
            requiredMaterial: p.requiredMaterial,
            orderIds: sortedOrders.map(o => o.id)
          };
        })
      }));

      // 6. 외주상품 배분 데이터 통합 - confirmed 또는 assigned 상태의 배분
      const confirmedAllocations = await db.select()
        .from(orderAllocations)
        .where(
          or(
            eq(orderAllocations.status, "confirmed"),
            eq(orderAllocations.status, "assigned")
          )
        );

      for (const allocation of confirmedAllocations) {
        if (!allocation.productCode) continue;

        // 해당 상품의 대기 주문 조회
        const allocationOrders = await db.select()
          .from(pendingOrders)
          .where(and(
            eq(pendingOrders.productCode, allocation.productCode),
            eq(pendingOrders.status, "대기")
          ));

        if (allocationOrders.length === 0) continue;

        // 배분 확정 수량 = 가용재고 개념
        const allocatedQty = allocation.allocatedQuantity || 0;
        const totalOrders = allocationOrders.length;
        const deficit = totalOrders - allocatedQty;

        // 배분 상세 조회 (확정된 것만)
        const confirmedDetailsForAlloc = await db.select()
          .from(allocationDetails)
          .where(and(
            eq(allocationDetails.allocationId, allocation.id),
            eq(allocationDetails.status, "confirmed")
          ));

        // 순번 내림차순 정렬
        const sortedAllocOrders = [...allocationOrders].sort((a, b) => {
          const seqA = typeof a.sequenceNumber === 'string' ? parseInt(a.sequenceNumber.replace(/\D/g, ''), 10) || 0 : (a.sequenceNumber || 0);
          const seqB = typeof b.sequenceNumber === 'string' ? parseInt(b.sequenceNumber.replace(/\D/g, ''), 10) || 0 : (b.sequenceNumber || 0);
          return seqB - seqA;
        });

        result.push({
          materialCode: `alloc_${allocation.id}`,
          materialName: allocation.productName || allocation.productCode,
          materialType: "allocation",
          totalRequired: totalOrders,
          currentStock: allocatedQty,
          remainingStock: allocatedQty - totalOrders,
          isDeficit: deficit > 0,
          stockSource: "allocation" as const,
          allocationId: allocation.id,
          allocationDetails: confirmedDetailsForAlloc.map(d => ({
            detailId: d.id,
            vendorId: d.vendorId,
            vendorName: d.vendorName,
            allocatedQuantity: d.allocatedQuantity,
            vendorPrice: d.vendorPrice,
          })),
          products: [{
            productCode: allocation.productCode,
            productName: allocation.productName || "",
            orderCount: totalOrders,
            materialQuantity: 1,
            requiredMaterial: totalOrders,
            orderIds: sortedAllocOrders.map(o => o.id)
          }]
        });
      }

      res.json(result);
    } catch (error: any) {
      console.error("Order adjustment stock error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // 주문조정 실행 API - 공평 배분 알고리즘 적용 (비율 기반 + 끝번호 우선 취소)
  app.post('/api/admin/order-adjustment-execute', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }

    try {
      const { materialCode, products } = req.body;
      
      if (!materialCode || !products || !Array.isArray(products)) {
        return res.status(400).json({ message: "잘못된 요청입니다" });
      }

      // 원재료 재고 조회
      const material = await storage.getMaterialByCode(materialCode);
      if (!material) {
        return res.status(404).json({ message: "원재료를 찾을 수 없습니다" });
      }

      const availableStock = material.currentStock;
      
      // 선택된 상품 코드 목록
      const selectedProductCodes = products.map((p: any) => p.productCode);
      
      // 상품-재료 매핑 조회
      const allMaterialMappings = await db.select()
        .from(productMaterialMappings)
        .where(eq(productMaterialMappings.materialCode, materialCode));
      
      // 선택된 상품들의 대기 주문 조회 (순번 포함)
      const targetOrders = await db.select()
        .from(pendingOrders)
        .where(
          and(
            eq(pendingOrders.status, "대기"),
            inArray(pendingOrders.productCode, selectedProductCodes)
          )
        )
        .orderBy(pendingOrders.sequenceNumber);
      
      if (targetOrders.length === 0) {
        return res.json({ 
          message: "조정 대상 주문이 없습니다.",
          adjusted: false 
        });
      }

      // 각 주문에 원재료 소모량 정보 추가
      interface OrderWithMaterial {
        id: string;
        memberId: string | null;
        productCode: string | null;
        productName: string | null;
        sequenceNum: number;
        materialQuantity: number;
        keepOrder: boolean;
      }
      
      const ordersWithMaterial: OrderWithMaterial[] = targetOrders.map(order => {
        const mapping = allMaterialMappings.find(pm => pm.productCode === order.productCode);
        return {
          id: order.id,
          memberId: order.memberId,
          productCode: order.productCode,
          productName: order.productName,
          sequenceNum: parseInt(order.sequenceNumber, 10) || 0,
          materialQuantity: mapping?.quantity || 1,
          keepOrder: true
        };
      });

      // 1. 총 필요 원재료량 계산
      const totalRequired = ordersWithMaterial.reduce((sum, o) => sum + o.materialQuantity, 0);
      
      // 재고가 충분한 경우
      if (totalRequired <= availableStock) {
        return res.json({ 
          message: "선택된 상품의 재고가 충분합니다. 조정이 필요하지 않습니다.",
          adjusted: false 
        });
      }

      // 2. 충족 비율 계산 (가용 재고 / 총 필요량)
      const ratio = availableStock / totalRequired;
      console.log(`공평 배분 - 비율: ${ratio.toFixed(4)} (재고: ${availableStock} / 필요: ${totalRequired})`);

      // 3. 회원+상품별로 그룹화하여 비율 적용
      interface MemberProductGroup {
        memberId: string;
        productCode: string;
        materialQuantity: number;
        orders: OrderWithMaterial[];
        originalCount: number;
        keepCount: number;
        cancelCount: number;
      }
      
      const groupMap = new Map<string, MemberProductGroup>();
      
      for (const order of ordersWithMaterial) {
        const key = `${order.memberId || 'unknown'}_${order.productCode || 'unknown'}`;
        
        if (!groupMap.has(key)) {
          groupMap.set(key, {
            memberId: order.memberId || 'unknown',
            productCode: order.productCode || 'unknown',
            materialQuantity: order.materialQuantity,
            orders: [],
            originalCount: 0,
            keepCount: 0,
            cancelCount: 0
          });
        }
        
        const group = groupMap.get(key)!;
        group.orders.push(order);
        group.originalCount++;
      }

      // 4. 각 그룹별로 유지 건수 계산 (내림 적용)
      const groupList = Array.from(groupMap.values());
      for (const group of groupList) {
        group.keepCount = Math.floor(group.originalCount * ratio);
        group.cancelCount = group.originalCount - group.keepCount;
        
        // 주문을 순번 오름차순으로 정렬 (낮은 번호 = 빠른 주문 = 유지 우선)
        group.orders.sort((a: OrderWithMaterial, b: OrderWithMaterial) => a.sequenceNum - b.sequenceNum);
        
        // 유지할 주문과 취소할 주문 결정
        group.orders.forEach((order: OrderWithMaterial, idx: number) => {
          order.keepOrder = idx < group.keepCount;
        });
      }

      // 5. 조정 후 총 소모량 검증
      let totalConsumed = 0;
      for (const group of groupList) {
        totalConsumed += group.keepCount * group.materialQuantity;
      }
      
      console.log(`공평 배분 - 1차 조정 후 소모량: ${totalConsumed} (재고: ${availableStock})`);

      // 6. 재고 초과 시, 순번 끝번호부터 추가 취소
      if (totalConsumed > availableStock) {
        // 모든 "유지" 주문을 순번 내림차순으로 정렬 (큰 번호 = 늦은 주문)
        const allKeptOrders: OrderWithMaterial[] = [];
        for (const group of groupList) {
          for (const order of group.orders) {
            if (order.keepOrder) {
              allKeptOrders.push(order);
            }
          }
        }
        
        allKeptOrders.sort((a: OrderWithMaterial, b: OrderWithMaterial) => b.sequenceNum - a.sequenceNum);
        
        // 끝번호부터 추가 취소
        for (const order of allKeptOrders) {
          if (totalConsumed <= availableStock) break;
          
          order.keepOrder = false;
          totalConsumed -= order.materialQuantity;
          
          // 해당 그룹의 카운트도 업데이트
          const key = `${order.memberId || 'unknown'}_${order.productCode || 'unknown'}`;
          const group = groupMap.get(key);
          if (group) {
            group.keepCount--;
            group.cancelCount++;
          }
        }
        
        console.log(`공평 배분 - 미세조정 후 소모량: ${totalConsumed} (재고: ${availableStock})`);
      }

      // 7. 취소 대상 주문들을 '주문조정' 상태로 변경 (끝번호부터)
      const cancelledOrderIds: string[] = [];
      
      // 취소할 주문들 수집 (순번 내림차순 - 끝번호부터)
      const ordersToCancel: OrderWithMaterial[] = [];
      for (const order of ordersWithMaterial) {
        if (!order.keepOrder) {
          ordersToCancel.push(order);
        }
      }
      ordersToCancel.sort((a: OrderWithMaterial, b: OrderWithMaterial) => b.sequenceNum - a.sequenceNum);
      
      // 상태 업데이트
      for (const order of ordersToCancel) {
        await db.update(pendingOrders)
          .set({ 
            status: "주문조정",
            updatedAt: new Date()
          })
          .where(eq(pendingOrders.id, order.id));
        cancelledOrderIds.push(order.id);
      }

      // SSE 알림
      sseManager.sendToAdmins("order-adjusted", {
        type: "order-adjustment",
        materialCode,
        cancelledCount: cancelledOrderIds.length
      });

      // 조정 결과 요약 (그룹별)
      const adjustedGroups = groupList.map(g => ({
        memberId: g.memberId,
        productCode: g.productCode,
        originalCount: g.originalCount,
        keepCount: g.keepCount,
        cancelCount: g.cancelCount,
        materialQuantity: g.materialQuantity
      }));

      res.json({
        adjusted: true,
        message: `${cancelledOrderIds.length}건의 주문이 공평 배분 방식으로 조정되었습니다.`,
        cancelledOrderIds,
        adjustedGroups,
        summary: {
          availableStock,
          totalRequired,
          ratio: ratio.toFixed(4),
          totalConsumedAfter: totalConsumed,
          totalCancelled: cancelledOrderIds.length
        }
      });
    } catch (error: any) {
      console.error("Order adjustment execute error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // 외주상품 주문조정 실행 API - 배분 확정 수량 기반 공정 배분 + vendorId 배정
  app.post('/api/admin/order-adjustment-allocation-execute', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }

    try {
      const { allocationId, productCode } = req.body;
      
      if (!allocationId || !productCode) {
        return res.status(400).json({ message: "잘못된 요청입니다 (allocationId, productCode 필요)" });
      }

      // 배분 정보 조회
      const allocation = await storage.getOrderAllocationById(allocationId);
      if (!allocation) {
        return res.status(404).json({ message: "배분 정보를 찾을 수 없습니다" });
      }

      if (allocation.status !== "confirmed" && allocation.status !== "assigned") {
        return res.status(400).json({ message: "배분이 확정되지 않았습니다" });
      }

      // 배분 상세 (확정된 것만)
      const confirmedDetails = await db.select()
        .from(allocationDetails)
        .where(and(
          eq(allocationDetails.allocationId, allocationId),
          eq(allocationDetails.status, "confirmed")
        ))
        .orderBy(allocationDetails.id);

      const availableStock = confirmedDetails.reduce((sum, d) => sum + (d.allocatedQuantity || 0), 0);

      // 해당 상품의 대기 주문 조회
      const targetOrders = await db.select()
        .from(pendingOrders)
        .where(and(
          eq(pendingOrders.status, "대기"),
          eq(pendingOrders.productCode, productCode)
        ))
        .orderBy(pendingOrders.sequenceNumber);

      if (targetOrders.length === 0) {
        return res.json({ 
          message: "조정 대상 주문이 없습니다.",
          adjusted: false 
        });
      }

      const totalRequired = targetOrders.length;

      if (totalRequired <= availableStock) {
        return res.json({ 
          message: "확정 수량이 충분합니다. 조정이 필요하지 않습니다.",
          adjusted: false 
        });
      }

      // 공정 배분 알고리즘 적용 (비율 기반 + 끝번호 우선 취소)
      const ratio = availableStock / totalRequired;
      console.log(`외주상품 공평 배분 - 비율: ${ratio.toFixed(4)} (확정수량: ${availableStock} / 주문: ${totalRequired})`);

      interface OrderItem {
        id: string;
        memberId: string | null;
        productCode: string | null;
        productName: string | null;
        sequenceNum: number;
        keepOrder: boolean;
      }

      const ordersForDistribution: OrderItem[] = targetOrders.map(order => ({
        id: order.id,
        memberId: order.memberId,
        productCode: order.productCode,
        productName: order.productName,
        sequenceNum: parseInt(order.sequenceNumber, 10) || 0,
        keepOrder: true,
      }));

      // 회원+상품별 그룹화
      interface MemberGroup {
        memberId: string;
        productCode: string;
        orders: OrderItem[];
        originalCount: number;
        keepCount: number;
        cancelCount: number;
      }

      const groupMap = new Map<string, MemberGroup>();
      for (const order of ordersForDistribution) {
        const key = `${order.memberId || 'unknown'}_${order.productCode || 'unknown'}`;
        if (!groupMap.has(key)) {
          groupMap.set(key, {
            memberId: order.memberId || 'unknown',
            productCode: order.productCode || 'unknown',
            orders: [],
            originalCount: 0,
            keepCount: 0,
            cancelCount: 0,
          });
        }
        const group = groupMap.get(key)!;
        group.orders.push(order);
        group.originalCount++;
      }

      // 비율 적용 (내림)
      const groupList = Array.from(groupMap.values());
      for (const group of groupList) {
        group.keepCount = Math.floor(group.originalCount * ratio);
        group.cancelCount = group.originalCount - group.keepCount;
        group.orders.sort((a, b) => a.sequenceNum - b.sequenceNum);
        group.orders.forEach((order, idx) => {
          order.keepOrder = idx < group.keepCount;
        });
      }

      // 소모량 검증
      let totalKept = groupList.reduce((sum, g) => sum + g.keepCount, 0);

      // 재고 초과 시 끝번호부터 추가 취소
      if (totalKept > availableStock) {
        const allKeptOrders: OrderItem[] = [];
        for (const group of groupList) {
          for (const order of group.orders) {
            if (order.keepOrder) allKeptOrders.push(order);
          }
        }
        allKeptOrders.sort((a, b) => b.sequenceNum - a.sequenceNum);

        for (const order of allKeptOrders) {
          if (totalKept <= availableStock) break;
          order.keepOrder = false;
          totalKept--;
          const key = `${order.memberId || 'unknown'}_${order.productCode || 'unknown'}`;
          const group = groupMap.get(key);
          if (group) {
            group.keepCount--;
            group.cancelCount++;
          }
        }
      }

      // 유지 건이 부족할 경우 추가 유지 (재고에 여유가 있으면)
      if (totalKept < availableStock) {
        const allCancelledOrders: OrderItem[] = [];
        for (const group of groupList) {
          for (const order of group.orders) {
            if (!order.keepOrder) allCancelledOrders.push(order);
          }
        }
        allCancelledOrders.sort((a, b) => a.sequenceNum - b.sequenceNum);

        for (const order of allCancelledOrders) {
          if (totalKept >= availableStock) break;
          order.keepOrder = true;
          totalKept++;
          const key = `${order.memberId || 'unknown'}_${order.productCode || 'unknown'}`;
          const group = groupMap.get(key);
          if (group) {
            group.keepCount++;
            group.cancelCount--;
          }
        }
      }

      console.log(`외주상품 공평 배분 - 최종 유지: ${totalKept}, 취소: ${totalRequired - totalKept}`);

      // DB 업데이트 - 취소 대상만 주문조정으로 변경, 유지 주문은 대기 유지
      const cancelledOrderIds: string[] = [];

      // 배분 상세에서 첫 번째 벤더 ID 추출 (이 배분에 참여한 벤더)
      const primaryVendorId = confirmedDetails.length > 0 ? confirmedDetails[0].vendorId : null;

      const ordersToCancel = ordersForDistribution.filter(o => !o.keepOrder);
      ordersToCancel.sort((a, b) => b.sequenceNum - a.sequenceNum);

      for (const order of ordersToCancel) {
        await db.update(pendingOrders)
          .set({ 
            status: "주문조정",
            fulfillmentType: "vendor",
            updatedAt: new Date()
          })
          .where(eq(pendingOrders.id, order.id));
        cancelledOrderIds.push(order.id);
      }

      // 유지 주문도 외주 상품이므로 fulfillmentType과 vendorId를 설정
      const ordersToKeep = ordersForDistribution.filter(o => o.keepOrder);
      for (const order of ordersToKeep) {
        await db.update(pendingOrders)
          .set({ 
            fulfillmentType: "vendor",
            vendorId: primaryVendorId,
            updatedAt: new Date()
          })
          .where(eq(pendingOrders.id, order.id));
      }

      // 배분 확정 수량을 실제 유지 수량으로 갱신
      await db.update(orderAllocations)
        .set({ 
          allocatedQuantity: totalKept,
          updatedAt: new Date() 
        })
        .where(eq(orderAllocations.id, allocationId));

      // SSE 알림
      sseManager.sendToAdmins("order-adjusted", {
        type: "allocation-adjustment",
        allocationId,
        cancelledCount: cancelledOrderIds.length,
      });
      sseManager.broadcast("pending-orders-updated", { type: "pending-orders-updated" });

      // 주문조정된 회원에게 알림
      const adjustedMemberIds = Array.from(new Set(
        ordersForDistribution.filter(o => !o.keepOrder).map(o => o.memberId).filter(Boolean)
      ));
      adjustedMemberIds.forEach(memberId => {
        if (memberId) {
          sseManager.sendToMember(memberId, "order-updated", {
            type: "order-adjusted",
            reason: "외주상품 공정배분",
          });
        }
      });

      res.json({
        adjusted: true,
        message: `${cancelledOrderIds.length}건의 주문이 공평 배분 방식으로 조정되었습니다.`,
        cancelledOrderIds,
        adjustedGroups: groupList.map(g => ({
          memberId: g.memberId,
          productCode: g.productCode,
          originalCount: g.originalCount,
          keepCount: g.keepCount,
          cancelCount: g.cancelCount,
        })),
        summary: {
          availableStock,
          totalRequired,
          ratio: ratio.toFixed(4),
          totalKept,
          totalCancelled: cancelledOrderIds.length,
        }
      });
    } catch (error: any) {
      console.error("외주상품 주문조정 실행 오류:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // 대체발송 실행 API - 대체 원재료 재고 차감
  app.post('/api/admin/alternate-shipment-execute', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }

    try {
      const { materialCode, alternateMaterialCode, alternateQuantity } = req.body;
      
      if (!materialCode || !alternateMaterialCode || !alternateQuantity || alternateQuantity <= 0) {
        return res.status(400).json({ message: "잘못된 요청입니다" });
      }

      // 원재료 조회
      const originalMaterial = await storage.getMaterialByCode(materialCode);
      if (!originalMaterial) {
        return res.status(404).json({ message: "원재료를 찾을 수 없습니다" });
      }

      // 대체 원재료 조회
      const alternateMaterial = await storage.getMaterialByCode(alternateMaterialCode);
      if (!alternateMaterial) {
        return res.status(404).json({ message: "대체 원재료를 찾을 수 없습니다" });
      }

      // 대체 원재료 재고 확인
      if (alternateMaterial.currentStock < alternateQuantity) {
        return res.status(400).json({ 
          message: `대체 원재료 재고가 부족합니다. 현재 재고: ${alternateMaterial.currentStock}` 
        });
      }

      // 대체 원재료 재고 차감
      const newStock = alternateMaterial.currentStock - alternateQuantity;
      await db.update(materials)
        .set({ 
          currentStock: newStock,
          updatedAt: new Date()
        })
        .where(eq(materials.materialCode, alternateMaterialCode));

      // 원래 원재료에 대체 수량 추가 (가상 재고 증가)
      const newOriginalStock = originalMaterial.currentStock + alternateQuantity;
      await db.update(materials)
        .set({ 
          currentStock: newOriginalStock,
          updatedAt: new Date()
        })
        .where(eq(materials.materialCode, materialCode));

      // SSE 알림
      sseManager.sendToAdmins("alternate-shipment", {
        type: "alternate-shipment",
        originalMaterialCode: materialCode,
        alternateMaterialCode,
        quantity: alternateQuantity
      });

      res.json({
        success: true,
        message: `${alternateMaterial.materialName}에서 ${alternateQuantity}만큼 대체발송 처리되었습니다.`,
        originalMaterial: {
          code: materialCode,
          name: originalMaterial.materialName,
          previousStock: originalMaterial.currentStock,
          newStock: newOriginalStock
        },
        alternateMaterial: {
          code: alternateMaterialCode,
          name: alternateMaterial.materialName,
          previousStock: alternateMaterial.currentStock,
          newStock: newStock
        }
      });
    } catch (error: any) {
      console.error("Alternate shipment execute error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // 주문복구 API - 주문조정된 주문을 다시 대기 상태로 복구
  app.post('/api/admin/orders-restore', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }

    try {
      const { orderIds } = req.body;
      
      if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
        return res.status(400).json({ message: "복구할 주문을 선택해주세요" });
      }

      // 주문조정 상태인 주문만 복구 가능
      const ordersToRestore = await db.select()
        .from(pendingOrders)
        .where(and(
          inArray(pendingOrders.id, orderIds),
          eq(pendingOrders.status, "주문조정")
        ));

      if (ordersToRestore.length === 0) {
        return res.status(400).json({ message: "복구할 수 있는 주문이 없습니다" });
      }

      // 주문 상태를 '대기'로 변경
      await db.update(pendingOrders)
        .set({ 
          status: "대기",
          updatedAt: new Date()
        })
        .where(inArray(pendingOrders.id, ordersToRestore.map(o => o.id)));

      // SSE 알림 - 모든 관리자에게 주문 복구 알림
      sseManager.sendToAdmins("order-restored", {
        type: "order-restored",
        restoredCount: ordersToRestore.length,
        orderIds: ordersToRestore.map(o => o.id)
      });

      res.json({
        success: true,
        message: `${ordersToRestore.length}건의 주문이 주문대기로 복구되었습니다.`,
        restoredCount: ordersToRestore.length,
        restoredOrderIds: ordersToRestore.map(o => o.id)
      });
    } catch (error: any) {
      console.error("Order restore error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // 상품준비중으로 전송 API
  app.post('/api/admin/orders-to-preparation', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }

    try {
      const { excludeMaterialCodes = [] } = req.body;

      // 대기 상태의 주문 조회
      const allPendingOrders = await db.select()
        .from(pendingOrders)
        .where(eq(pendingOrders.status, "대기"));

      if (allPendingOrders.length === 0) {
        return res.json({
          success: true,
          message: "전송할 주문이 없습니다.",
          transferredCount: 0
        });
      }

      // 제외할 원재료 코드에 해당하는 상품코드 조회
      let excludeProductCodes: string[] = [];
      
      if (excludeMaterialCodes.length > 0) {
        // 상품-원재료 매핑에서 해당 원재료를 사용하는 상품코드 조회
        const mappings = await db.select()
          .from(productMaterialMappings)
          .where(inArray(productMaterialMappings.materialCode, excludeMaterialCodes));
        
        excludeProductCodes = mappings.map(m => m.productCode);
      }

      // 제외할 상품코드를 가진 주문 제외
      const ordersToTransfer = excludeProductCodes.length > 0
        ? allPendingOrders.filter(o => !excludeProductCodes.includes(o.productCode || ''))
        : allPendingOrders;

      const excludedOrders = allPendingOrders.length - ordersToTransfer.length;

      if (ordersToTransfer.length === 0) {
        return res.json({
          success: true,
          message: "전송할 주문이 없습니다. (모든 주문이 부족 상품에 해당)",
          transferredCount: 0,
          excludedCount: excludedOrders
        });
      }

      // 외주 상품 코드 조회 (product_vendors에 등록된 상품) + vendorId 매핑
      const uniqueProductCodes = Array.from(new Set(ordersToTransfer.map(o => o.productCode).filter(Boolean))) as string[];
      const productVendorMap: Record<string, number> = {};
      let vendorProductCodes: string[] = [];
      if (uniqueProductCodes.length > 0) {
        const vendorProducts = await db.select({ 
            productCode: productVendors.productCode,
            vendorId: productVendors.vendorId 
          })
          .from(productVendors)
          .where(and(
            inArray(productVendors.productCode, uniqueProductCodes),
            eq(productVendors.isActive, true)
          ));
        vendorProductCodes = vendorProducts.map(vp => vp.productCode);
        for (const vp of vendorProducts) {
          productVendorMap[vp.productCode] = vp.vendorId;
        }
      }

      // 자체 주문과 외주 주문 분리
      const selfOrderIds = ordersToTransfer.filter(o => !vendorProductCodes.includes(o.productCode || '')).map(o => o.id);
      const vendorOrders = ordersToTransfer.filter(o => vendorProductCodes.includes(o.productCode || ''));

      // 자체 주문 상태 업데이트
      if (selfOrderIds.length > 0) {
        await db.update(pendingOrders)
          .set({ 
            status: "상품준비중",
            fulfillmentType: "self",
            updatedAt: new Date()
          })
          .where(inArray(pendingOrders.id, selfOrderIds));
      }

      // 외주 주문 상태 업데이트 (fulfillmentType = vendor, vendorId 할당)
      // 벤더별로 그룹핑하여 vendorId를 각각 설정
      const vendorGroups: Record<number, string[]> = {};
      for (const order of vendorOrders) {
        const vId = productVendorMap[order.productCode || ''];
        if (vId) {
          if (!vendorGroups[vId]) vendorGroups[vId] = [];
          vendorGroups[vId].push(order.id);
        }
      }

      for (const [vId, orderIdGroup] of Object.entries(vendorGroups)) {
        await db.update(pendingOrders)
          .set({ 
            status: "상품준비중",
            fulfillmentType: "vendor",
            vendorId: Number(vId),
            updatedAt: new Date()
          })
          .where(inArray(pendingOrders.id, orderIdGroup));
      }

      const orderIds = ordersToTransfer.map(o => o.id);

      // 원재료 재고 차감 로직
      // 1. 상품코드별 주문 수량 계산
      const productOrderCounts: Record<string, number> = {};
      for (const order of ordersToTransfer) {
        const productCode = order.productCode || "";
        if (productCode) {
          productOrderCounts[productCode] = (productOrderCounts[productCode] || 0) + 1;
        }
      }

      // 2. 각 상품의 원재료 매핑 조회 및 재고 차감
      const materialDeductions: Record<string, number> = {};
      
      for (const [productCode, orderCount] of Object.entries(productOrderCounts)) {
        // 상품-원재료 매핑 조회
        const mappings = await storage.getProductMaterialMappings(productCode);
        
        for (const mapping of mappings) {
          const deductionAmount = mapping.quantity * orderCount;
          materialDeductions[mapping.materialCode] = 
            (materialDeductions[mapping.materialCode] || 0) + deductionAmount;
        }
      }

      // 3. 원재료 재고 차감 실행 - 원자적 SQL 연산 사용 (race condition 방지)
      for (const [materialCode, deductionAmount] of Object.entries(materialDeductions)) {
        await db.update(materials)
          .set({ 
            currentStock: sql`GREATEST(0, ${materials.currentStock} - ${deductionAmount})`,
            updatedAt: new Date()
          })
          .where(eq(materials.materialCode, materialCode));
      }

      console.log(`재고 차감 완료: ${Object.keys(materialDeductions).length}개 원재료, 총 ${ordersToTransfer.length}건 주문`);

      // SSE 알림
      sseManager.sendToAdmins("orders-to-preparation", {
        type: "orders-to-preparation",
        count: ordersToTransfer.length
      });

      // 회원들에게도 알림
      const memberIds = Array.from(new Set(ordersToTransfer.map(o => o.memberId).filter(Boolean)));
      for (const memberId of memberIds) {
        if (memberId) {
          sseManager.sendToMember(memberId, "order-status-changed", {
            type: "order-status-changed",
            newStatus: "상품준비중"
          });
        }
      }

      res.json({
        success: true,
        message: excludedOrders > 0 
          ? `${ordersToTransfer.length}건의 주문이 상품준비중으로 전송되었습니다. (${excludedOrders}건 제외)`
          : `${ordersToTransfer.length}건의 주문이 상품준비중으로 전송되었습니다.`,
        transferredCount: ordersToTransfer.length,
        excludedCount: excludedOrders
      });
    } catch (error: any) {
      console.error("Orders to preparation error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ===================== 정산 관리 API =====================

  // 관리자: 회원 잔액 조회 (예치금/포인터/사용가능잔액)
  app.get('/api/admin/members/:memberId/balance', async (req, res) => {
    try {
      if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
      const user = await storage.getUser(req.session.userId);
      if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
        return res.status(403).json({ message: "권한이 없습니다" });
      }

      const { memberId } = req.params;
      const member = await db.select().from(members).where(eq(members.id, memberId)).limit(1);
      if (member.length === 0) return res.status(404).json({ message: "회원을 찾을 수 없습니다" });

      const balanceInfo = await calculateAvailableBalance(memberId, member[0].grade);
      res.json({
        memberId,
        companyName: member[0].companyName,
        grade: member[0].grade,
        ...balanceInfo,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // 관리자: 예치금 충전
  app.post('/api/admin/members/:memberId/deposit/charge', async (req, res) => {
    try {
      if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
      const user = await storage.getUser(req.session.userId);
      if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
        return res.status(403).json({ message: "권한이 없습니다" });
      }

      const { memberId } = req.params;
      const { amount, description } = req.body;
      if (!amount || amount <= 0) return res.status(400).json({ message: "충전 금액을 올바르게 입력해주세요" });

      const result = await db.transaction(async (tx) => {
        const [lockedMember] = await tx.select().from(members).where(eq(members.id, memberId)).for('update');
        if (!lockedMember) return { error: true, message: "회원을 찾을 수 없습니다" } as const;

        const newDeposit = lockedMember.deposit + amount;
        await tx.update(members).set({ deposit: newDeposit, updatedAt: new Date() }).where(eq(members.id, memberId));
        await tx.insert(depositHistory).values({
          memberId,
          type: "charge",
          amount,
          balanceAfter: newDeposit,
          description: description || `관리자 예치금 충전`,
          adminId: req.session.userId,
        });
        return { error: false, newDeposit } as const;
      });

      if (result.error) {
        return res.status(404).json({ message: result.message });
      }
      res.json({ success: true, message: `${result.newDeposit.toLocaleString()}원 충전 완료`, newDeposit: result.newDeposit });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // 관리자: 예치금 환급
  app.post('/api/admin/members/:memberId/deposit/refund', async (req, res) => {
    try {
      if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
      const user = await storage.getUser(req.session.userId);
      if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
        return res.status(403).json({ message: "권한이 없습니다" });
      }

      const { memberId } = req.params;
      const { amount, description } = req.body;
      if (!amount || amount <= 0) return res.status(400).json({ message: "환급 금액을 올바르게 입력해주세요" });

      const result = await db.transaction(async (tx) => {
        const [lockedMember] = await tx.select().from(members).where(eq(members.id, memberId)).for('update');
        if (!lockedMember) return { error: true, status: 404, message: "회원을 찾을 수 없습니다" } as const;

        if (lockedMember.deposit < amount) {
          return { error: true, status: 400, message: `환급 가능 금액이 부족합니다. 현재 예치금: ${lockedMember.deposit.toLocaleString()}원` } as const;
        }

        const newDeposit = lockedMember.deposit - amount;
        await tx.update(members).set({ deposit: newDeposit, updatedAt: new Date() }).where(eq(members.id, memberId));
        await tx.insert(depositHistory).values({
          memberId,
          type: "refund",
          amount,
          balanceAfter: newDeposit,
          description: description || `관리자 예치금 환급`,
          adminId: req.session.userId,
        });
        return { error: false, newDeposit } as const;
      });

      if (result.error) {
        return res.status(result.status).json({ message: result.message });
      }
      res.json({ success: true, message: `${amount.toLocaleString()}원 환급 완료`, newDeposit: result.newDeposit });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // 관리자: 포인터 지급
  app.post('/api/admin/members/:memberId/pointer/grant', async (req, res) => {
    try {
      if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
      const user = await storage.getUser(req.session.userId);
      if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
        return res.status(403).json({ message: "권한이 없습니다" });
      }

      const { memberId } = req.params;
      const { amount, description } = req.body;
      if (!amount || amount <= 0) return res.status(400).json({ message: "지급 금액을 올바르게 입력해주세요" });

      const result = await db.transaction(async (tx) => {
        const [lockedMember] = await tx.select().from(members).where(eq(members.id, memberId)).for('update');
        if (!lockedMember) return { error: true, message: "회원을 찾을 수 없습니다" } as const;

        const newPoint = lockedMember.point + amount;
        await tx.update(members).set({ point: newPoint, updatedAt: new Date() }).where(eq(members.id, memberId));
        await tx.insert(pointerHistory).values({
          memberId,
          type: "grant",
          amount,
          balanceAfter: newPoint,
          description: description || `관리자 포인터 지급`,
          adminId: req.session.userId,
        });
        return { error: false, newPoint } as const;
      });

      if (result.error) {
        return res.status(404).json({ message: result.message });
      }
      res.json({ success: true, message: `${result.newPoint.toLocaleString()}P 지급 완료`, newPoint: result.newPoint });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // 관리자: 정산 이력 조회
  app.get('/api/admin/settlements', async (req, res) => {
    try {
      if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
      const user = await storage.getUser(req.session.userId);
      if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
        return res.status(403).json({ message: "권한이 없습니다" });
      }

      const { memberId, startDate, endDate, type, paymentMethod, page = '1', limit = '30' } = req.query as any;
      const conditions: any[] = [];

      if (memberId) conditions.push(eq(settlementHistory.memberId, memberId));
      if (type) conditions.push(eq(settlementHistory.settlementType, type));
      if (paymentMethod === 'deposit') conditions.push(gt(settlementHistory.depositAmount, 0));
      if (paymentMethod === 'pointer') conditions.push(gt(settlementHistory.pointerAmount, 0));
      if (startDate && endDate) {
        const { startUTC, endUTC } = parseDateRangeKST(startDate, endDate);
        conditions.push(gte(settlementHistory.createdAt, startUTC));
        conditions.push(lte(settlementHistory.createdAt, endUTC));
      }

      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const offset = (pageNum - 1) * limitNum;
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const dateExpr = sql<string>`TO_CHAR(${settlementHistory.createdAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD')`;

      const [records, countResult] = await Promise.all([
        db.select({
          settlementDate: dateExpr.as('settlementDate'),
          memberId: settlementHistory.memberId,
          memberCompanyName: members.companyName,
          totalPointerAmount: sql<number>`COALESCE(SUM(${settlementHistory.pointerAmount}), 0)`.as('totalPointerAmount'),
          totalDepositAmount: sql<number>`COALESCE(SUM(${settlementHistory.depositAmount}), 0)`.as('totalDepositAmount'),
          totalAmount: sql<number>`COALESCE(SUM(${settlementHistory.totalAmount}), 0)`.as('totalAmount'),
          orderCount: sql<number>`COUNT(*)`.as('orderCount'),
        })
          .from(settlementHistory)
          .leftJoin(members, eq(settlementHistory.memberId, members.id))
          .where(whereClause)
          .groupBy(dateExpr, settlementHistory.memberId, members.companyName)
          .orderBy(desc(dateExpr))
          .limit(limitNum)
          .offset(offset),
        db.select({
          count: sql<number>`COUNT(*)`,
        }).from(
          db.select({
            d: dateExpr.as('d'),
            m: settlementHistory.memberId,
          })
            .from(settlementHistory)
            .where(whereClause)
            .groupBy(dateExpr, settlementHistory.memberId)
            .as('grouped')
        ),
      ]);

      res.json({
        records,
        total: Number(countResult[0]?.count || 0),
        page: pageNum,
        limit: limitNum,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // 관리자: 예치금 이력 조회
  app.get('/api/admin/deposit-history', async (req, res) => {
    try {
      if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
      const user = await storage.getUser(req.session.userId);
      if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
        return res.status(403).json({ message: "권한이 없습니다" });
      }

      const { memberId, startDate, endDate, type, page = '1', limit = '30' } = req.query as any;
      const conditions: any[] = [];

      if (memberId) conditions.push(eq(depositHistory.memberId, memberId));
      if (type) conditions.push(eq(depositHistory.type, type));
      if (startDate && endDate) {
        const { startUTC, endUTC } = parseDateRangeKST(startDate, endDate);
        conditions.push(gte(depositHistory.createdAt, startUTC));
        conditions.push(lte(depositHistory.createdAt, endUTC));
      }

      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const offset = (pageNum - 1) * limitNum;
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const depDateExpr = sql<string>`TO_CHAR(${depositHistory.createdAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD')`;

      const [records, countResult] = await Promise.all([
        db.select({
          historyDate: depDateExpr.as('historyDate'),
          memberId: depositHistory.memberId,
          memberCompanyName: members.companyName,
          type: depositHistory.type,
          totalAmount: sql<number>`COALESCE(SUM(${depositHistory.amount}), 0)`.as('totalAmount'),
          txCount: sql<number>`COUNT(*)`.as('txCount'),
        })
          .from(depositHistory)
          .leftJoin(members, eq(depositHistory.memberId, members.id))
          .where(whereClause)
          .groupBy(depDateExpr, depositHistory.memberId, members.companyName, depositHistory.type)
          .orderBy(desc(depDateExpr))
          .limit(limitNum)
          .offset(offset),
        db.select({
          count: sql<number>`COUNT(*)`,
        }).from(
          db.select({
            d: depDateExpr.as('d'),
            m: depositHistory.memberId,
            t: depositHistory.type,
          })
            .from(depositHistory)
            .where(whereClause)
            .groupBy(depDateExpr, depositHistory.memberId, depositHistory.type)
            .as('grouped')
        ),
      ]);

      res.json({
        records,
        total: Number(countResult[0]?.count || 0),
        page: pageNum,
        limit: limitNum,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // 관리자: 포인터 이력 조회
  app.get('/api/admin/pointer-history', async (req, res) => {
    try {
      if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
      const user = await storage.getUser(req.session.userId);
      if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
        return res.status(403).json({ message: "권한이 없습니다" });
      }

      const { memberId, startDate, endDate, type, page = '1', limit = '30' } = req.query as any;
      const conditions: any[] = [];

      if (memberId) conditions.push(eq(pointerHistory.memberId, memberId));
      if (type) conditions.push(eq(pointerHistory.type, type));
      if (startDate && endDate) {
        const { startUTC, endUTC } = parseDateRangeKST(startDate, endDate);
        conditions.push(gte(pointerHistory.createdAt, startUTC));
        conditions.push(lte(pointerHistory.createdAt, endUTC));
      }

      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const offset = (pageNum - 1) * limitNum;
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const ptrDateExpr = sql<string>`TO_CHAR(${pointerHistory.createdAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD')`;

      const [records, countResult] = await Promise.all([
        db.select({
          historyDate: ptrDateExpr.as('historyDate'),
          memberId: pointerHistory.memberId,
          memberCompanyName: members.companyName,
          type: pointerHistory.type,
          totalAmount: sql<number>`COALESCE(SUM(${pointerHistory.amount}), 0)`.as('totalAmount'),
          txCount: sql<number>`COUNT(*)`.as('txCount'),
        })
          .from(pointerHistory)
          .leftJoin(members, eq(pointerHistory.memberId, members.id))
          .where(whereClause)
          .groupBy(ptrDateExpr, pointerHistory.memberId, members.companyName, pointerHistory.type)
          .orderBy(desc(ptrDateExpr))
          .limit(limitNum)
          .offset(offset),
        db.select({
          count: sql<number>`COUNT(*)`,
        }).from(
          db.select({
            d: ptrDateExpr.as('d'),
            m: pointerHistory.memberId,
            t: pointerHistory.type,
          })
            .from(pointerHistory)
            .where(whereClause)
            .groupBy(ptrDateExpr, pointerHistory.memberId, pointerHistory.type)
            .as('grouped')
        ),
      ]);

      res.json({
        records,
        total: Number(countResult[0]?.count || 0),
        page: pageNum,
        limit: limitNum,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // 관리자: 회원 목록 잔액 포함 조회
  app.get('/api/admin/members-balance', async (req, res) => {
    try {
      if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
      const user = await storage.getUser(req.session.userId);
      if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
        return res.status(403).json({ message: "권한이 없습니다" });
      }

      const memberList = await db.select({
        id: members.id,
        companyName: members.companyName,
        grade: members.grade,
        deposit: members.deposit,
        point: members.point,
        username: members.username,
      })
        .from(members)
        .where(inArray(members.grade, ['START', 'DRIVING', 'TOP']))
        .orderBy(members.companyName);

      res.json(memberList);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ===================== 회원 정산 API =====================

  // 회원: 내 잔액 조회
  app.get('/api/member/my-balance', async (req, res) => {
    try {
      if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
      const member = await db.select().from(members).where(eq(members.id, req.session.userId)).limit(1);
      if (member.length === 0) return res.status(404).json({ message: "회원 정보를 찾을 수 없습니다" });

      const balanceInfo = await calculateAvailableBalance(req.session.userId, member[0].grade);
      res.json({
        deposit: balanceInfo.deposit,
        point: balanceInfo.point,
        pendingOrdersTotal: balanceInfo.pendingOrdersTotal,
        availableBalance: balanceInfo.availableBalance,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // 회원: 정산 현황 (협력업체 정산과 동일한 구조 - 주문행 + 입금행 시간순 머지)
  app.get('/api/member/my-settlement-view', async (req, res) => {
    try {
      if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
      const memberId = req.session.userId;
      const { startDate, endDate } = req.query as any;

      let startUTC: Date | undefined;
      let endUTC: Date | undefined;

      const depositConditions: any[] = [
        eq(depositHistory.memberId, memberId),
        inArray(depositHistory.type, ['charge', 'refund']),
      ];

      const pointerConditions: any[] = [
        eq(pointerHistory.memberId, memberId),
        eq(pointerHistory.type, 'grant'),
      ];

      const settlementConditions: any[] = [
        eq(settlementHistory.memberId, memberId),
      ];

      if (startDate && endDate) {
        const parsed = parseDateRangeKST(startDate, endDate);
        startUTC = parsed.startUTC;
        endUTC = parsed.endUTC;
        depositConditions.push(gte(depositHistory.createdAt, startUTC));
        depositConditions.push(lte(depositHistory.createdAt, endUTC));
        pointerConditions.push(gte(pointerHistory.createdAt, startUTC));
        pointerConditions.push(lte(pointerHistory.createdAt, endUTC));
        settlementConditions.push(gte(settlementHistory.createdAt, startUTC));
        settlementConditions.push(lte(settlementHistory.createdAt, endUTC));
      }

      const memberResult = await db.select({ deposit: members.deposit, point: members.point })
        .from(members).where(eq(members.id, memberId)).limit(1);
      const currentDeposit = memberResult[0]?.deposit ?? 0;
      const currentPointer = memberResult[0]?.point ?? 0;

      const [orderSettlementRows, depositRows, pointerRows, depositNetSinceStart, pointerNetSinceStart] = await Promise.all([
        db.select({
          settlementDate: sql<string>`TO_CHAR(${settlementHistory.createdAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI:SS')`,
          productName: pendingOrders.productName,
          productCode: pendingOrders.productCode,
          supplyPrice: pendingOrders.supplyPrice,
          quantity: sql<number>`COUNT(*)::int`,
          totalPointerAmount: sql<number>`COALESCE(SUM(${settlementHistory.pointerAmount}), 0)::int`,
          totalDepositAmount: sql<number>`COALESCE(SUM(${settlementHistory.depositAmount}), 0)::int`,
          totalAmount: sql<number>`COALESCE(SUM(${settlementHistory.totalAmount}), 0)::int`,
        })
          .from(settlementHistory)
          .innerJoin(pendingOrders, eq(settlementHistory.orderId, pendingOrders.id))
          .where(and(...settlementConditions))
          .groupBy(
            sql`TO_CHAR(${settlementHistory.createdAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI:SS')`,
            pendingOrders.productName,
            pendingOrders.productCode,
            pendingOrders.supplyPrice,
          ),
        db.select({
          id: depositHistory.id,
          date: sql<string>`TO_CHAR(${depositHistory.createdAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI:SS')`,
          type: depositHistory.type,
          amount: depositHistory.amount,
          description: depositHistory.description,
        })
          .from(depositHistory)
          .where(and(...depositConditions)),
        db.select({
          id: pointerHistory.id,
          date: sql<string>`TO_CHAR(${pointerHistory.createdAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI:SS')`,
          type: pointerHistory.type,
          amount: pointerHistory.amount,
          description: pointerHistory.description,
        })
          .from(pointerHistory)
          .where(and(...pointerConditions)),
        startUTC
          ? db.select({
              netChange: sql<number>`COALESCE(SUM(CASE WHEN ${depositHistory.type} = 'charge' THEN ${depositHistory.amount} WHEN ${depositHistory.type} = 'refund' THEN -${depositHistory.amount} WHEN ${depositHistory.type} = 'deduct' THEN -${depositHistory.amount} ELSE 0 END), 0)::int`,
            }).from(depositHistory).where(and(
              eq(depositHistory.memberId, memberId),
              gte(depositHistory.createdAt, startUTC),
            ))
          : db.select({
              netChange: sql<number>`COALESCE(SUM(CASE WHEN ${depositHistory.type} = 'charge' THEN ${depositHistory.amount} WHEN ${depositHistory.type} = 'refund' THEN -${depositHistory.amount} WHEN ${depositHistory.type} = 'deduct' THEN -${depositHistory.amount} ELSE 0 END), 0)::int`,
            }).from(depositHistory).where(eq(depositHistory.memberId, memberId)),
        startUTC
          ? db.select({
              netChange: sql<number>`COALESCE(SUM(CASE WHEN ${pointerHistory.type} = 'grant' THEN ${pointerHistory.amount} WHEN ${pointerHistory.type} = 'deduct' THEN -${pointerHistory.amount} ELSE 0 END), 0)::int`,
            }).from(pointerHistory).where(and(
              eq(pointerHistory.memberId, memberId),
              gte(pointerHistory.createdAt, startUTC),
            ))
          : db.select({
              netChange: sql<number>`COALESCE(SUM(CASE WHEN ${pointerHistory.type} = 'grant' THEN ${pointerHistory.amount} WHEN ${pointerHistory.type} = 'deduct' THEN -${pointerHistory.amount} ELSE 0 END), 0)::int`,
            }).from(pointerHistory).where(eq(pointerHistory.memberId, memberId)),
      ]);

      const depositNetChange = (depositNetSinceStart as any)?.[0]?.netChange ?? 0;
      const pointerNetChange = (pointerNetSinceStart as any)?.[0]?.netChange ?? 0;
      const startingBalance = (currentDeposit - depositNetChange) + (currentPointer - pointerNetChange);

      type SettlementRow = {
        type: "order" | "deposit" | "pointer";
        date: string;
        productName: string;
        productCode: string;
        quantity: number;
        unitPrice: number;
        subtotal: number;
        depositAmount: number;
        pointerAmount: number;
        description?: string;
        balance: number;
      };

      const items: SettlementRow[] = [];

      for (const row of orderSettlementRows) {
        const price = row.supplyPrice || 0;
        items.push({
          type: "order",
          date: row.settlementDate,
          productName: row.productName || "",
          productCode: row.productCode || "",
          quantity: row.quantity,
          unitPrice: price,
          subtotal: row.totalAmount,
          depositAmount: -row.totalDepositAmount,
          pointerAmount: -row.totalPointerAmount,
          balance: 0,
        });
      }

      for (const row of depositRows) {
        const signedAmount = row.type === 'refund' ? -row.amount : row.amount;
        items.push({
          type: "deposit",
          date: row.date,
          productName: "",
          productCode: "",
          quantity: 0,
          unitPrice: 0,
          subtotal: 0,
          depositAmount: signedAmount,
          pointerAmount: 0,
          description: row.description || (row.type === 'charge' ? '예치금 충전' : '예치금 환급'),
          balance: 0,
        });
      }

      for (const row of pointerRows) {
        items.push({
          type: "pointer",
          date: row.date,
          productName: "",
          productCode: "",
          quantity: 0,
          unitPrice: 0,
          subtotal: 0,
          depositAmount: 0,
          pointerAmount: row.amount,
          description: row.description || '포인터 지급',
          balance: 0,
        });
      }

      items.sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        if (a.type === "deposit" || a.type === "pointer") return -1;
        if (b.type === "deposit" || b.type === "pointer") return 1;
        return (a.productName || "").localeCompare(b.productName || "");
      });

      let runningBalance = startingBalance;
      for (const item of items) {
        runningBalance += item.depositAmount + item.pointerAmount;
        item.balance = runningBalance;
      }

      const totalOrderAmount = items.filter(i => i.type === "order").reduce((s, i) => s + i.subtotal, 0);
      const totalDeposit = items.reduce((s, i) => s + i.depositAmount, 0);
      const totalPointer = items.reduce((s, i) => s + i.pointerAmount, 0);

      res.json({
        items,
        startingBalance,
        endingBalance: runningBalance,
        totalOrderAmount,
        totalDeposit,
        totalPointer,
        totalBalance: runningBalance,
      });
    } catch (error: any) {
      console.error("Member settlement view error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // 관리자: 업체별 통합 정산 내역 조회 (정산+예치금+포인터 통합)
  app.get('/api/admin/member-settlement-view', async (req, res) => {
    try {
      if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
      const adminUser = await storage.getUser(req.session.userId);
      if (!adminUser || (adminUser.role !== 'ADMIN' && adminUser.role !== 'SUPER_ADMIN')) {
        return res.status(403).json({ message: "관리자 권한이 필요합니다" });
      }

      const { memberId, startDate, endDate } = req.query as any;
      if (!memberId) {
        return res.status(400).json({ message: "회원을 선택해주세요" });
      }

      const memberInfo = await db.select({ companyName: members.companyName, deposit: members.deposit, point: members.point })
        .from(members).where(eq(members.id, memberId)).limit(1);
      if (!memberInfo.length) return res.status(404).json({ message: "회원을 찾을 수 없습니다" });

      const currentDeposit = memberInfo[0].deposit ?? 0;
      const currentPointer = memberInfo[0].point ?? 0;
      const companyName = memberInfo[0].companyName || "";

      let startUTC: Date | undefined;
      let endUTC: Date | undefined;

      const depositConditions: any[] = [
        eq(depositHistory.memberId, memberId),
        inArray(depositHistory.type, ['charge', 'refund']),
      ];
      const pointerConditions: any[] = [
        eq(pointerHistory.memberId, memberId),
        eq(pointerHistory.type, 'grant'),
      ];
      const settlementConditions: any[] = [
        eq(settlementHistory.memberId, memberId),
      ];

      if (startDate && endDate) {
        const parsed = parseDateRangeKST(startDate, endDate);
        startUTC = parsed.startUTC;
        endUTC = parsed.endUTC;
        depositConditions.push(gte(depositHistory.createdAt, startUTC));
        depositConditions.push(lte(depositHistory.createdAt, endUTC));
        pointerConditions.push(gte(pointerHistory.createdAt, startUTC));
        pointerConditions.push(lte(pointerHistory.createdAt, endUTC));
        settlementConditions.push(gte(settlementHistory.createdAt, startUTC));
        settlementConditions.push(lte(settlementHistory.createdAt, endUTC));
      }

      const [orderSettlementRows, depositRows, pointerRows, depositAllNet, pointerAllNet, depositNetAfterEnd, pointerNetAfterEnd] = await Promise.all([
        db.select({
          settlementDate: sql<string>`TO_CHAR(${settlementHistory.createdAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI:SS')`,
          productName: pendingOrders.productName,
          productCode: pendingOrders.productCode,
          supplyPrice: pendingOrders.supplyPrice,
          quantity: sql<number>`COUNT(*)::int`,
          totalPointerAmount: sql<number>`COALESCE(SUM(${settlementHistory.pointerAmount}), 0)::int`,
          totalDepositAmount: sql<number>`COALESCE(SUM(${settlementHistory.depositAmount}), 0)::int`,
          totalAmount: sql<number>`COALESCE(SUM(${settlementHistory.totalAmount}), 0)::int`,
        })
          .from(settlementHistory)
          .innerJoin(pendingOrders, eq(settlementHistory.orderId, pendingOrders.id))
          .where(and(...settlementConditions))
          .groupBy(
            sql`TO_CHAR(${settlementHistory.createdAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI:SS')`,
            pendingOrders.productName,
            pendingOrders.productCode,
            pendingOrders.supplyPrice,
          ),
        db.select({
          id: depositHistory.id,
          date: sql<string>`TO_CHAR(${depositHistory.createdAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI:SS')`,
          type: depositHistory.type,
          amount: depositHistory.amount,
          description: depositHistory.description,
        })
          .from(depositHistory)
          .where(and(...depositConditions)),
        db.select({
          id: pointerHistory.id,
          date: sql<string>`TO_CHAR(${pointerHistory.createdAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI:SS')`,
          type: pointerHistory.type,
          amount: pointerHistory.amount,
          description: pointerHistory.description,
        })
          .from(pointerHistory)
          .where(and(...pointerConditions)),
        startUTC
          ? db.select({
              netChange: sql<number>`COALESCE(SUM(CASE WHEN ${depositHistory.type} = 'charge' THEN ${depositHistory.amount} WHEN ${depositHistory.type} = 'refund' THEN -${depositHistory.amount} WHEN ${depositHistory.type} = 'deduct' THEN -${depositHistory.amount} ELSE 0 END), 0)::int`,
            }).from(depositHistory).where(and(
              eq(depositHistory.memberId, memberId),
              gte(depositHistory.createdAt, startUTC),
            ))
          : db.select({
              netChange: sql<number>`COALESCE(SUM(CASE WHEN ${depositHistory.type} = 'charge' THEN ${depositHistory.amount} WHEN ${depositHistory.type} = 'refund' THEN -${depositHistory.amount} WHEN ${depositHistory.type} = 'deduct' THEN -${depositHistory.amount} ELSE 0 END), 0)::int`,
            }).from(depositHistory).where(eq(depositHistory.memberId, memberId)),
        startUTC
          ? db.select({
              netChange: sql<number>`COALESCE(SUM(CASE WHEN ${pointerHistory.type} = 'grant' THEN ${pointerHistory.amount} WHEN ${pointerHistory.type} = 'deduct' THEN -${pointerHistory.amount} ELSE 0 END), 0)::int`,
            }).from(pointerHistory).where(and(
              eq(pointerHistory.memberId, memberId),
              gte(pointerHistory.createdAt, startUTC),
            ))
          : db.select({
              netChange: sql<number>`COALESCE(SUM(CASE WHEN ${pointerHistory.type} = 'grant' THEN ${pointerHistory.amount} WHEN ${pointerHistory.type} = 'deduct' THEN -${pointerHistory.amount} ELSE 0 END), 0)::int`,
            }).from(pointerHistory).where(eq(pointerHistory.memberId, memberId)),
        endUTC
          ? db.select({
              netDeposit: sql<number>`COALESCE(SUM(CASE WHEN ${depositHistory.type} = 'charge' THEN ${depositHistory.amount} WHEN ${depositHistory.type} = 'refund' THEN -${depositHistory.amount} WHEN ${depositHistory.type} = 'deduct' THEN -${depositHistory.amount} ELSE 0 END), 0)::int`,
            }).from(depositHistory).where(and(
              eq(depositHistory.memberId, memberId),
              gt(depositHistory.createdAt, endUTC),
            ))
          : Promise.resolve([{ netDeposit: 0 }] as any),
        endUTC
          ? db.select({
              netPointer: sql<number>`COALESCE(SUM(CASE WHEN ${pointerHistory.type} = 'grant' THEN ${pointerHistory.amount} WHEN ${pointerHistory.type} = 'deduct' THEN -${pointerHistory.amount} ELSE 0 END), 0)::int`,
            }).from(pointerHistory).where(and(
              eq(pointerHistory.memberId, memberId),
              gt(pointerHistory.createdAt, endUTC),
            ))
          : Promise.resolve([{ netPointer: 0 }] as any),
      ]);

      const depositNetChange = (depositAllNet as any)?.[0]?.netChange ?? 0;
      const pointerNetChange = (pointerAllNet as any)?.[0]?.netChange ?? 0;
      const startingDepositBalance = currentDeposit - depositNetChange;
      const startingPointerBalance = currentPointer - pointerNetChange;
      const startingBalance = startingDepositBalance + startingPointerBalance;

      const depositNetAfter = (depositNetAfterEnd as any)?.[0]?.netDeposit ?? 0;
      const pointerNetAfter = (pointerNetAfterEnd as any)?.[0]?.netPointer ?? 0;
      const endingDepositBalance = currentDeposit - depositNetAfter;
      const endingPointerBalance = currentPointer - pointerNetAfter;

      type AdminSettlementRow = {
        type: "order" | "deposit" | "pointer";
        date: string;
        companyName: string;
        productName: string;
        productCode: string;
        quantity: number;
        unitPrice: number;
        subtotal: number;
        pointerChange: number;
        depositChange: number;
        description?: string;
        balance: number;
      };

      const items: AdminSettlementRow[] = [];

      for (const row of orderSettlementRows) {
        const price = row.supplyPrice || 0;
        items.push({
          type: "order",
          date: row.settlementDate,
          companyName,
          productName: row.productName || "",
          productCode: row.productCode || "",
          quantity: row.quantity,
          unitPrice: price,
          subtotal: row.totalAmount,
          pointerChange: -row.totalPointerAmount,
          depositChange: -row.totalDepositAmount,
          balance: 0,
        });
      }

      for (const row of depositRows) {
        const signedAmount = row.type === 'refund' ? -row.amount : row.amount;
        items.push({
          type: "deposit",
          date: row.date,
          companyName,
          productName: row.type === 'charge' ? '입금/예치금 충전' : '환급/예치금 환급',
          productCode: "",
          quantity: 1,
          unitPrice: 0,
          subtotal: 0,
          pointerChange: 0,
          depositChange: signedAmount,
          description: row.description || undefined,
          balance: 0,
        });
      }

      for (const row of pointerRows) {
        items.push({
          type: "pointer",
          date: row.date,
          companyName,
          productName: '포인터 충전',
          productCode: "",
          quantity: 1,
          unitPrice: 0,
          subtotal: 0,
          pointerChange: row.amount,
          depositChange: 0,
          description: row.description || undefined,
          balance: 0,
        });
      }

      items.sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        if (a.type === "deposit" || a.type === "pointer") return -1;
        if (b.type === "deposit" || b.type === "pointer") return 1;
        return (a.productName || "").localeCompare(b.productName || "");
      });

      let runningBalance = startingBalance;
      for (const item of items) {
        runningBalance += item.depositChange + item.pointerChange;
        item.balance = runningBalance;
      }

      const totalOrderAmount = items.filter(i => i.type === "order").reduce((s, i) => s + i.subtotal, 0);
      const totalDepositChange = items.reduce((s, i) => s + i.depositChange, 0);
      const totalPointerChange = items.reduce((s, i) => s + i.pointerChange, 0);

      res.json({
        items,
        companyName,
        startingBalance,
        endingBalance: endingDepositBalance + endingPointerBalance,
        startingDepositBalance,
        startingPointerBalance,
        endingDepositBalance,
        endingPointerBalance,
        totalOrderAmount,
        totalDepositChange,
        totalPointerChange,
      });
    } catch (error: any) {
      console.error("Admin member settlement view error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // 회원: 내 정산 이력 조회
  app.get('/api/member/my-settlements', async (req, res) => {
    try {
      if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
      const { startDate, endDate, page = '1', limit = '30' } = req.query as any;
      const conditions: any[] = [eq(settlementHistory.memberId, req.session.userId)];

      if (startDate && endDate) {
        const { startUTC, endUTC } = parseDateRangeKST(startDate, endDate);
        conditions.push(gte(settlementHistory.createdAt, startUTC));
        conditions.push(lte(settlementHistory.createdAt, endUTC));
      }

      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const offset = (pageNum - 1) * limitNum;

      const [records, countResult] = await Promise.all([
        db.select()
          .from(settlementHistory)
          .where(and(...conditions))
          .orderBy(desc(settlementHistory.createdAt))
          .limit(limitNum)
          .offset(offset),
        db.select({ count: sql<number>`count(*)` })
          .from(settlementHistory)
          .where(and(...conditions)),
      ]);

      res.json({
        records,
        total: Number(countResult[0]?.count || 0),
        page: pageNum,
        limit: limitNum,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // 회원: 내 예치금 이력 조회
  app.get('/api/member/my-deposit-history', async (req, res) => {
    try {
      if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
      const { startDate, endDate, page = '1', limit = '30' } = req.query as any;
      const conditions: any[] = [eq(depositHistory.memberId, req.session.userId)];

      if (startDate && endDate) {
        const { startUTC, endUTC } = parseDateRangeKST(startDate, endDate);
        conditions.push(gte(depositHistory.createdAt, startUTC));
        conditions.push(lte(depositHistory.createdAt, endUTC));
      }

      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const offset = (pageNum - 1) * limitNum;

      const [records, countResult] = await Promise.all([
        db.select()
          .from(depositHistory)
          .where(and(...conditions))
          .orderBy(desc(depositHistory.createdAt))
          .limit(limitNum)
          .offset(offset),
        db.select({ count: sql<number>`count(*)` })
          .from(depositHistory)
          .where(and(...conditions)),
      ]);

      res.json({
        records,
        total: Number(countResult[0]?.count || 0),
        page: pageNum,
        limit: limitNum,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // 회원: 내 포인터 이력 조회
  app.get('/api/member/my-pointer-history', async (req, res) => {
    try {
      if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
      const { startDate, endDate, page = '1', limit = '30' } = req.query as any;
      const conditions: any[] = [eq(pointerHistory.memberId, req.session.userId)];

      if (startDate && endDate) {
        const { startUTC, endUTC } = parseDateRangeKST(startDate, endDate);
        conditions.push(gte(pointerHistory.createdAt, startUTC));
        conditions.push(lte(pointerHistory.createdAt, endUTC));
      }

      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const offset = (pageNum - 1) * limitNum;

      const [records, countResult] = await Promise.all([
        db.select()
          .from(pointerHistory)
          .where(and(...conditions))
          .orderBy(desc(pointerHistory.createdAt))
          .limit(limitNum)
          .offset(offset),
        db.select({ count: sql<number>`count(*)` })
          .from(pointerHistory)
          .where(and(...conditions)),
      ]);

      res.json({
        records,
        total: Number(countResult[0]?.count || 0),
        page: pageNum,
        limit: limitNum,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ===================== 테스트 데이터 초기화 API (최고관리자 전용) =====================

  app.post('/api/admin/reset-test-data', async (req, res) => {
    try {
      if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
      const user = await storage.getUser(req.session.userId);
      if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN')) {
        return res.status(403).json({ message: "관리자 권한이 필요합니다" });
      }
      if (user.username !== 'kgong5026') {
        return res.status(403).json({ message: "이 기능은 최고관리자만 사용할 수 있습니다" });
      }

      const result = await db.transaction(async (tx) => {
        const [ordersResult] = await tx.select({ count: sql<number>`count(*)` }).from(pendingOrders);
        const [settlementsResult] = await tx.select({ count: sql<number>`count(*)` }).from(settlementHistory);
        const [depositsResult] = await tx.select({ count: sql<number>`count(*)` }).from(depositHistory);
        const [pointersResult] = await tx.select({ count: sql<number>`count(*)` }).from(pointerHistory);
        const [uploadsResult] = await tx.select({ count: sql<number>`count(*)` }).from(orderUploadHistory);

        await tx.delete(pendingOrders);
        await tx.delete(settlementHistory);
        await tx.delete(depositHistory);
        await tx.delete(pointerHistory);
        await tx.delete(orderUploadHistory);

        await tx.update(members).set({
          deposit: 0,
          point: 0,
          updatedAt: new Date(),
        });

        return {
          orders: Number(ordersResult?.count || 0),
          settlements: Number(settlementsResult?.count || 0),
          deposits: Number(depositsResult?.count || 0),
          pointers: Number(pointersResult?.count || 0),
          uploads: Number(uploadsResult?.count || 0),
        };
      });

      sseManager.broadcast("pending-orders-updated", { type: "pending-orders-updated" });
      sseManager.broadcast("order-status-changed", { type: "order-status-changed" });

      res.json({
        success: true,
        deleted: result,
        message: `초기화 완료: 주문 ${result.orders}건, 정산 ${result.settlements}건, 예치금이력 ${result.deposits}건, 포인터이력 ${result.pointers}건, 업로드이력 ${result.uploads}건 삭제. 회원 잔액 리셋 완료.`,
      });
    } catch (error: any) {
      console.error("테스트 데이터 초기화 실패:", error);
      res.status(500).json({ success: false, message: "초기화 실패 - 롤백 완료" });
    }
  });

  // ==============================
  // Vendor (외주 협력업체) API
  // ==============================

  app.get('/api/admin/vendors', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) return res.status(403).json({ message: "Not authorized" });

    try {
      const allVendors = await storage.getAllVendors();
      const { isActive, search } = req.query;
      let filtered = allVendors;

      if (isActive === 'true') filtered = filtered.filter(v => v.isActive === true);
      else if (isActive === 'false') filtered = filtered.filter(v => v.isActive === false);

      if (search && typeof search === 'string') {
        const s = search.toLowerCase();
        filtered = filtered.filter(v =>
          v.companyName.toLowerCase().includes(s) ||
          (v.contactName && v.contactName.toLowerCase().includes(s))
        );
      }

      const result = filtered.map(({ loginPassword, ...rest }) => rest);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "업체 목록 조회 실패" });
    }
  });

  app.get('/api/admin/vendors/:id', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) return res.status(403).json({ message: "Not authorized" });

    try {
      const vendor = await storage.getVendor(parseInt(req.params.id));
      if (!vendor) return res.status(404).json({ message: "업체를 찾을 수 없습니다" });
      const { loginPassword, ...rest } = vendor;
      res.json(rest);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "업체 조회 실패" });
    }
  });

  app.post('/api/admin/vendors', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) return res.status(403).json({ message: "Not authorized" });

    try {
      const { companyName, contactName, contactPhone, contactEmail, loginId, loginPassword, settlementCycle, bankName, bankAccount, bankHolder, memo, businessType } = req.body;
      if (!companyName) return res.status(400).json({ message: "업체명은 필수입니다" });
      if (!loginId) return res.status(400).json({ message: "로그인ID는 필수입니다" });
      if (!loginPassword) return res.status(400).json({ message: "비밀번호는 필수입니다" });

      const existing = await storage.getVendorByLoginId(loginId);
      if (existing) return res.status(400).json({ message: "이미 사용중인 로그인ID입니다" });

      const bcrypt = await import("bcryptjs");
      const hashedPassword = await bcrypt.hash(loginPassword, 10);

      const vendor = await storage.createVendor({
        companyName, contactName, contactPhone, contactEmail,
        loginId, loginPassword: hashedPassword,
        settlementCycle: settlementCycle || "monthly",
        bankName, bankAccount, bankHolder, memo,
        businessType: businessType || "supply",
      });

      const { loginPassword: _, ...rest } = vendor;
      res.status(201).json(rest);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "업체 등록 실패" });
    }
  });

  app.put('/api/admin/vendors/:id', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) return res.status(403).json({ message: "Not authorized" });

    try {
      const id = parseInt(req.params.id);
      const { companyName, contactName, contactPhone, contactEmail, loginId, loginPassword, settlementCycle, bankName, bankAccount, bankHolder, memo, businessType } = req.body;

      const updateData: any = { companyName, contactName, contactPhone, contactEmail, loginId, settlementCycle, bankName, bankAccount, bankHolder, memo, businessType };

      if (loginPassword) {
        const bcrypt = await import("bcryptjs");
        updateData.loginPassword = await bcrypt.hash(loginPassword, 10);
      }

      Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

      const vendor = await storage.updateVendor(id, updateData);
      if (!vendor) return res.status(404).json({ message: "업체를 찾을 수 없습니다" });

      const { loginPassword: _, ...rest } = vendor;
      res.json(rest);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "업체 수정 실패" });
    }
  });

  app.put('/api/admin/vendors/:id/toggle-active', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) return res.status(403).json({ message: "Not authorized" });

    try {
      const vendor = await storage.toggleVendorActive(parseInt(req.params.id));
      if (!vendor) return res.status(404).json({ message: "업체를 찾을 수 없습니다" });
      const { loginPassword: _, ...rest } = vendor;
      res.json(rest);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "활성 상태 변경 실패" });
    }
  });

  // ==============================
  // Vendor Payment API (업체 결재 관리)
  // ==============================

  app.get('/api/admin/vendor-payments', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) return res.status(403).json({ message: "Not authorized" });

    try {
      const { vendorId, startDate, endDate } = req.query;
      const conditions: any[] = [];
      if (vendorId) conditions.push(eq(vendorPayments.vendorId, parseInt(vendorId as string)));
      if (startDate) conditions.push(gte(vendorPayments.paymentDate, startDate as string));
      if (endDate) conditions.push(lte(vendorPayments.paymentDate, endDate as string));

      const payments = await db.select({
        id: vendorPayments.id,
        vendorId: vendorPayments.vendorId,
        supplierId: vendorPayments.supplierId,
        vendorName: vendors.companyName,
        supplierName: suppliers.name,
        amount: vendorPayments.amount,
        paymentDate: vendorPayments.paymentDate,
        memo: vendorPayments.memo,
        createdBy: vendorPayments.createdBy,
        createdAt: vendorPayments.createdAt,
      })
        .from(vendorPayments)
        .leftJoin(vendors, eq(vendorPayments.vendorId, vendors.id))
        .leftJoin(suppliers, eq(vendorPayments.supplierId, suppliers.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(vendorPayments.createdAt));

      res.json(payments);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "결재 내역 조회 실패" });
    }
  });

  app.post('/api/admin/vendor-payments', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) return res.status(403).json({ message: "Not authorized" });

    try {
      const { vendorId, supplierId, amount, paymentDate, paymentMethod, memo } = req.body;
      if ((!vendorId && !supplierId) || amount === undefined || amount === null || !paymentDate) {
        return res.status(400).json({ message: "업체, 금액, 결재일은 필수입니다" });
      }
      const parsedAmount = parseInt(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ message: "결재 금액은 0보다 큰 숫자여야 합니다" });
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) {
        return res.status(400).json({ message: "결재일 형식이 올바르지 않습니다 (YYYY-MM-DD)" });
      }
      const validMethods = ["transfer", "product_offset", "card"];
      const method = validMethods.includes(paymentMethod) ? paymentMethod : "transfer";

      if (vendorId && !supplierId) {
        const parsedVendorId = parseInt(vendorId);
        const vendor = await storage.getVendor(parsedVendorId);
        if (!vendor) {
          return res.status(404).json({ message: "업체를 찾을 수 없습니다" });
        }
      }

      const [payment] = await db.insert(vendorPayments).values({
        vendorId: vendorId ? parseInt(vendorId) : null,
        supplierId: supplierId ? parseInt(supplierId) : null,
        amount: parsedAmount,
        paymentDate,
        paymentMethod: method,
        memo: memo || null,
        createdBy: req.session.userId,
      }).returning();

      res.json(payment);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "결재 등록 실패" });
    }
  });

  app.delete('/api/admin/vendor-payments/:id', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) return res.status(403).json({ message: "Not authorized" });

    try {
      const [deleted] = await db.delete(vendorPayments)
        .where(eq(vendorPayments.id, parseInt(req.params.id)))
        .returning();
      if (!deleted) return res.status(404).json({ message: "결재 내역을 찾을 수 없습니다" });
      res.json({ message: "삭제되었습니다" });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "결재 삭제 실패" });
    }
  });

  // ==============================
  // Product-Vendor Mapping API (상품-외주업체 매핑)
  // ==============================

  app.get('/api/admin/product-vendors-all', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) return res.status(403).json({ message: "Not authorized" });

    try {
      const allMappings = await db.select({
        productCode: productVendors.productCode,
        vendorId: productVendors.vendorId,
        vendorName: vendors.companyName,
      })
        .from(productVendors)
        .innerJoin(vendors, eq(productVendors.vendorId, vendors.id))
        .where(eq(productVendors.isActive, true));
      res.json(allMappings);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "전체 상품-업체 매핑 조회 실패" });
    }
  });

  app.get('/api/admin/product-vendors/:productCode', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) return res.status(403).json({ message: "Not authorized" });

    try {
      const mappings = await storage.getProductVendorsByProductCode(req.params.productCode);
      const result = [];
      for (const m of mappings) {
        const vendor = await storage.getVendor(m.vendorId);
        result.push({ ...m, vendorName: vendor?.companyName || "알 수 없음" });
      }
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "상품-업체 매핑 조회 실패" });
    }
  });

  app.post('/api/admin/product-vendors', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) return res.status(403).json({ message: "Not authorized" });

    try {
      const { productCode, vendorId, vendorPrice, memo } = req.body;
      if (!productCode || !vendorId || vendorPrice === undefined) {
        return res.status(400).json({ message: "상품코드, 업체ID, 매입가는 필수입니다" });
      }

      const existing = await storage.getProductVendorsByProductCode(productCode);
      const duplicate = existing.find(e => e.vendorId === vendorId);
      if (duplicate) return res.status(400).json({ message: "이미 매핑된 업체입니다" });

      const pv = await storage.createProductVendor({ productCode, vendorId, vendorPrice, memo });

      const reg = await storage.getProductRegistrationByCode(productCode);
      if (reg && !reg.isVendorProduct) {
        await storage.updateProductRegistration(reg.id, { isVendorProduct: true });
      }

      const vendor = await storage.getVendor(vendorId);
      res.status(201).json({ ...pv, vendorName: vendor?.companyName || "알 수 없음" });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "상품-업체 매핑 추가 실패" });
    }
  });

  app.put('/api/admin/product-vendors/:id', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) return res.status(403).json({ message: "Not authorized" });

    try {
      const { vendorPrice, memo } = req.body;
      const pv = await storage.updateProductVendor(parseInt(req.params.id), { vendorPrice, memo });
      if (!pv) return res.status(404).json({ message: "매핑을 찾을 수 없습니다" });
      const vendor = await storage.getVendor(pv.vendorId);
      res.json({ ...pv, vendorName: vendor?.companyName || "알 수 없음" });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "매핑 수정 실패" });
    }
  });

  app.delete('/api/admin/product-vendors/:id', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) return res.status(403).json({ message: "Not authorized" });

    try {
      const pvId = parseInt(req.params.id);
      const allMappings = await db.select().from(productVendors).where(eq(productVendors.id, pvId));
      const targetMapping = allMappings[0];

      const result = await storage.deleteProductVendor(pvId);
      if (!result) return res.status(404).json({ message: "매핑을 찾을 수 없습니다" });

      if (targetMapping) {
        const remaining = await storage.getProductVendorsByProductCode(targetMapping.productCode);
        if (remaining.length === 0) {
          const reg = await storage.getProductRegistrationByCode(targetMapping.productCode);
          if (reg && reg.isVendorProduct) {
            await storage.updateProductRegistration(reg.id, { isVendorProduct: false });
          }
        }
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "매핑 삭제 실패" });
    }
  });

  // ============================================
  // Phase 2: 배분 시스템 API
  // ============================================

  // Phase 2-2: 외주상품 자동 분류 + 수량 집계
  app.post('/api/admin/allocations/generate', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) return res.status(403).json({ message: "Not authorized" });

    try {
      const { date } = req.body;
      if (!date) return res.status(400).json({ message: "날짜를 지정해 주세요" });

      const vendorProductCodes = await db.select({ productCode: productVendors.productCode })
        .from(productVendors)
        .where(eq(productVendors.isActive, true));
      const vpCodes = [...new Set(vendorProductCodes.map(v => v.productCode))];

      const regVendorProducts = await db.select({ productCode: productRegistrations.productCode })
        .from(productRegistrations)
        .where(eq(productRegistrations.isVendorProduct, true));
      const regCodes = regVendorProducts.map(r => r.productCode);

      const allVendorCodes = [...new Set([...vpCodes, ...regCodes])];
      if (allVendorCodes.length === 0) {
        return res.json({ date, totalProducts: 0, allocations: [] });
      }

      const targetDate = new Date(date);
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      const vendorOrders = await db.select()
        .from(pendingOrders)
        .where(and(
          inArray(pendingOrders.productCode, allVendorCodes),
          or(eq(pendingOrders.status, "대기"), eq(pendingOrders.status, "상품준비중")),
          gte(pendingOrders.createdAt, startOfDay),
          lte(pendingOrders.createdAt, endOfDay)
        ));

      const productGroups: Record<string, { productName: string; count: number }> = {};
      for (const order of vendorOrders) {
        if (!productGroups[order.productCode]) {
          productGroups[order.productCode] = { productName: order.productName, count: 0 };
        }
        productGroups[order.productCode].count++;
      }

      const allocations = [];
      for (const [productCode, info] of Object.entries(productGroups)) {
        const existing = await db.select().from(orderAllocations)
          .where(and(
            eq(orderAllocations.allocationDate, date),
            eq(orderAllocations.productCode, productCode)
          ));

        let allocation;
        if (existing.length > 0) {
          allocation = await storage.updateOrderAllocation(existing[0].id, {
            totalQuantity: info.count,
            unallocatedQuantity: info.count - (existing[0].allocatedQuantity || 0),
            productName: info.productName,
          });
        } else {
          allocation = await storage.createOrderAllocation({
            allocationDate: date,
            productCode,
            productName: info.productName,
            totalQuantity: info.count,
            allocatedQuantity: 0,
            unallocatedQuantity: info.count,
            status: "pending",
          });
        }

        const availableVendors = await db.select({
          vendorId: productVendors.vendorId,
          vendorPrice: productVendors.vendorPrice,
        }).from(productVendors)
          .where(and(
            eq(productVendors.productCode, productCode),
            eq(productVendors.isActive, true)
          ));

        const vendorInfos = [
          { vendorId: 0, companyName: "자체(탑셀러)", vendorPrice: 0 },
        ];
        for (const pv of availableVendors) {
          const vendor = await storage.getVendor(pv.vendorId);
          if (vendor && vendor.isActive) {
            vendorInfos.push({
              vendorId: pv.vendorId,
              companyName: vendor.companyName,
              vendorPrice: pv.vendorPrice,
            });
          }
        }

        allocations.push({
          ...allocation,
          availableVendors: vendorInfos,
        });
      }

      res.json({ date, totalProducts: allocations.length, allocations });
    } catch (error: any) {
      console.error("배분 집계 실패:", error);
      res.status(500).json({ message: error.message || "배분 집계 실패" });
    }
  });

  // Phase 2-2: 날짜별 배분 현황 조회
  app.get('/api/admin/allocations', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) return res.status(403).json({ message: "Not authorized" });

    try {
      const date = req.query.date as string;
      if (!date) return res.status(400).json({ message: "날짜를 지정해 주세요" });

      const allocationsList = await storage.getOrderAllocationsByDate(date);

      const result = [];
      let totalProducts = 0, confirmedCount = 0, pendingCount = 0;

      for (const alloc of allocationsList) {
        totalProducts++;
        if (alloc.status === "confirmed") confirmedCount++;
        else pendingCount++;

        const details = await storage.getAllocationDetailsByAllocationId(alloc.id);

        const availableVendors = await db.select({
          vendorId: productVendors.vendorId,
          vendorPrice: productVendors.vendorPrice,
        }).from(productVendors)
          .where(and(
            eq(productVendors.productCode, alloc.productCode),
            eq(productVendors.isActive, true)
          ));

        const vendorInfos = [
          { vendorId: 0, companyName: "자체(탑셀러)", vendorPrice: 0 },
        ];
        for (const pv of availableVendors) {
          const vendor = await storage.getVendor(pv.vendorId);
          if (vendor && vendor.isActive) {
            vendorInfos.push({
              vendorId: pv.vendorId,
              companyName: vendor.companyName,
              vendorPrice: pv.vendorPrice,
            });
          }
        }

        result.push({
          ...alloc,
          details,
          availableVendors: vendorInfos,
        });
      }

      res.json({
        date,
        totalProducts,
        confirmedCount,
        pendingCount,
        allocations: result,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "배분 현황 조회 실패" });
    }
  });

  // Phase 2-2: 특정 배분 마스터 상세 조회
  app.get('/api/admin/allocations/:id', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) return res.status(403).json({ message: "Not authorized" });

    try {
      const id = parseInt(req.params.id);
      const allocation = await storage.getOrderAllocationById(id);
      if (!allocation) return res.status(404).json({ message: "배분 정보를 찾을 수 없습니다" });

      const details = await storage.getAllocationDetailsByAllocationId(id);

      const relatedOrders = await db.select()
        .from(pendingOrders)
        .where(and(
          eq(pendingOrders.productCode, allocation.productCode),
          or(eq(pendingOrders.status, "대기"), eq(pendingOrders.status, "상품준비중"))
        ))
        .orderBy(pendingOrders.createdAt);

      res.json({ ...allocation, details, relatedOrders });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "배분 상세 조회 실패" });
    }
  });

  // Phase 2-3: 업체 알림 발송
  app.post('/api/admin/allocations/:allocationId/notify', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) return res.status(403).json({ message: "Not authorized" });

    try {
      const allocationId = parseInt(req.params.allocationId);
      const allocation = await storage.getOrderAllocationById(allocationId);
      if (!allocation) return res.status(404).json({ message: "배분 정보를 찾을 수 없습니다" });

      const { vendors: vendorRequests } = req.body;
      if (!vendorRequests || !Array.isArray(vendorRequests) || vendorRequests.length === 0) {
        return res.status(400).json({ message: "업체 목록을 지정해 주세요" });
      }

      const existingDetails = await storage.getAllocationDetailsByAllocationId(allocationId);
      const notifiedVendors = [];
      const deadline = new Date(Date.now() + 2 * 60 * 60 * 1000);

      for (const vr of vendorRequests) {
        if (vr.vendorId === 0) {
          const existingDetail = existingDetails.find(d => d.vendorId === null && (d.vendorName === "자체(탑셀러)" || d.vendorName === "자체발송"));
          let detail;
          if (existingDetail) {
            detail = await storage.updateAllocationDetail(existingDetail.id, {
              requestedQuantity: vr.requestedQuantity,
              confirmedQuantity: vr.requestedQuantity,
              vendorPrice: 0,
              status: "responded",
              notifiedAt: new Date(),
              respondedAt: new Date(),
            });
          } else {
            detail = await storage.createAllocationDetail({
              allocationId,
              vendorId: null,
              vendorName: "자체(탑셀러)",
              requestedQuantity: vr.requestedQuantity,
              confirmedQuantity: vr.requestedQuantity,
              vendorPrice: 0,
              status: "responded",
              notifiedAt: new Date(),
              respondedAt: new Date(),
            });
          }

          notifiedVendors.push({
            vendorId: 0,
            companyName: "자체(탑셀러)",
            requestedQuantity: vr.requestedQuantity,
            notified: true,
            kakaoSent: false,
            detailId: detail!.id,
            selfAllocation: true,
          });
          continue;
        }

        const vendor = await storage.getVendor(vr.vendorId);
        if (!vendor) continue;

        const pvList = await db.select().from(productVendors)
          .where(and(
            eq(productVendors.productCode, allocation.productCode),
            eq(productVendors.vendorId, vr.vendorId),
            eq(productVendors.isActive, true)
          ));
        const vPrice = pvList.length > 0 ? pvList[0].vendorPrice : null;

        const existingDetail = existingDetails.find(d => d.vendorId === vr.vendorId);
        let detail;
        if (existingDetail) {
          detail = await storage.updateAllocationDetail(existingDetail.id, {
            requestedQuantity: vr.requestedQuantity,
            vendorPrice: vPrice,
            status: "notified",
            notifiedAt: new Date(),
          });
        } else {
          detail = await storage.createAllocationDetail({
            allocationId,
            vendorId: vr.vendorId,
            vendorName: vendor.companyName,
            requestedQuantity: vr.requestedQuantity,
            vendorPrice: vPrice,
            status: "notified",
            notifiedAt: new Date(),
          });
        }

        let kakaoSent = false;
        if (vendor.contactPhone) {
          try {
            const message = `[탑셀러] 배분 요청\n상품: ${allocation.productName}\n요청수량: ${vr.requestedQuantity}박스\n매입가: ${vPrice ? vPrice.toLocaleString() + '원' : '미정'}\n마감시간: ${deadline.toLocaleString('ko-KR')}\n대시보드에서 가능수량을 입력해 주세요.`;
            await solapiService.sendSMS(vendor.contactPhone, message);
            kakaoSent = true;
          } catch (err) {
            console.error(`[배분 알림] 솔라피 발송 실패 (${vendor.companyName}):`, err);
          }
        }

        notifiedVendors.push({
          vendorId: vr.vendorId,
          companyName: vendor.companyName,
          requestedQuantity: vr.requestedQuantity,
          notified: true,
          kakaoSent,
          detailId: detail!.id,
        });
      }

      await storage.updateOrderAllocation(allocationId, { status: "waiting" });

      notifiedVendors.forEach((v: any) => {
        if (v.vendorId) {
          sseManager.sendToPartner(v.vendorId, "allocation-updated", {
            type: "allocation-notified",
            allocationId,
          });
        }
      });
      sseManager.sendToAdmins("allocation-updated", { type: "allocation-notified", allocationId });

      res.json({
        allocationId,
        notifiedVendors,
        deadline: deadline.toISOString(),
      });
    } catch (error: any) {
      console.error("업체 알림 발송 실패:", error);
      res.status(500).json({ message: error.message || "알림 발송 실패" });
    }
  });

  // Phase 2-3: 알림/회신 현황 조회
  app.get('/api/admin/allocations/:allocationId/details', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) return res.status(403).json({ message: "Not authorized" });

    try {
      const allocationId = parseInt(req.params.allocationId);
      const allocation = await storage.getOrderAllocationById(allocationId);
      if (!allocation) return res.status(404).json({ message: "배분 정보를 찾을 수 없습니다" });

      const details = await storage.getAllocationDetailsByAllocationId(allocationId);

      const enrichedDetails = details.map(d => ({
        ...d,
        deadlineExceeded: d.notifiedAt ? (Date.now() - new Date(d.notifiedAt).getTime()) > 2 * 60 * 60 * 1000 : false,
      }));

      res.json({ allocation, details: enrichedDetails });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "알림/회신 현황 조회 실패" });
    }
  });

  // Phase 2-4: 가능수량 접수 (관리자 대신 입력)
  app.put('/api/admin/allocation-details/:detailId/respond', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) return res.status(403).json({ message: "Not authorized" });

    try {
      const detailId = parseInt(req.params.detailId);
      const { confirmedQuantity, memo } = req.body;
      if (confirmedQuantity === undefined || confirmedQuantity === null) {
        return res.status(400).json({ message: "확인수량을 입력해 주세요" });
      }

      const updated = await storage.updateAllocationDetail(detailId, {
        confirmedQuantity,
        status: "responded",
        respondedAt: new Date(),
        memo: memo || undefined,
      });
      if (!updated) return res.status(404).json({ message: "배분 상세를 찾을 수 없습니다" });

      const allocation = await storage.getOrderAllocationById(updated.allocationId);
      const sufficient = confirmedQuantity >= (updated.requestedQuantity || 0);

      res.json({ ...updated, sufficient, allocation });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "가능수량 접수 실패" });
    }
  });

  // Phase 2-4: 추가 업체 알림
  app.post('/api/admin/allocations/:allocationId/notify-additional', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) return res.status(403).json({ message: "Not authorized" });

    try {
      const allocationId = parseInt(req.params.allocationId);
      const allocation = await storage.getOrderAllocationById(allocationId);
      if (!allocation) return res.status(404).json({ message: "배분 정보를 찾을 수 없습니다" });

      const { vendors: vendorRequests } = req.body;
      if (!vendorRequests || !Array.isArray(vendorRequests) || vendorRequests.length === 0) {
        return res.status(400).json({ message: "업체 목록을 지정해 주세요" });
      }

      const existingDetails = await storage.getAllocationDetailsByAllocationId(allocationId);
      const notifiedVendors = [];
      const deadline = new Date(Date.now() + 2 * 60 * 60 * 1000);

      for (const vr of vendorRequests) {
        if (vr.vendorId === 0) {
          const existingDetail = existingDetails.find(d => d.vendorId === null && (d.vendorName === "자체(탑셀러)" || d.vendorName === "자체발송"));
          let detail;
          if (existingDetail) {
            detail = await storage.updateAllocationDetail(existingDetail.id, {
              requestedQuantity: vr.requestedQuantity,
              confirmedQuantity: vr.requestedQuantity,
              vendorPrice: 0,
              status: "responded",
              notifiedAt: new Date(),
              respondedAt: new Date(),
            });
          } else {
            detail = await storage.createAllocationDetail({
              allocationId,
              vendorId: null,
              vendorName: "자체(탑셀러)",
              requestedQuantity: vr.requestedQuantity,
              confirmedQuantity: vr.requestedQuantity,
              vendorPrice: 0,
              status: "responded",
              notifiedAt: new Date(),
              respondedAt: new Date(),
            });
          }

          notifiedVendors.push({
            vendorId: 0,
            companyName: "자체(탑셀러)",
            requestedQuantity: vr.requestedQuantity,
            notified: true,
            kakaoSent: false,
            detailId: detail!.id,
            selfAllocation: true,
          });
          continue;
        }

        const vendor = await storage.getVendor(vr.vendorId);
        if (!vendor) continue;

        const pvList = await db.select().from(productVendors)
          .where(and(
            eq(productVendors.productCode, allocation.productCode),
            eq(productVendors.vendorId, vr.vendorId),
            eq(productVendors.isActive, true)
          ));
        const vPrice = pvList.length > 0 ? pvList[0].vendorPrice : null;

        const existingDetail = existingDetails.find(d => d.vendorId === vr.vendorId);
        let detail;
        if (existingDetail) {
          detail = await storage.updateAllocationDetail(existingDetail.id, {
            requestedQuantity: vr.requestedQuantity,
            vendorPrice: vPrice,
            status: "notified",
            notifiedAt: new Date(),
          });
        } else {
          detail = await storage.createAllocationDetail({
            allocationId,
            vendorId: vr.vendorId,
            vendorName: vendor.companyName,
            requestedQuantity: vr.requestedQuantity,
            vendorPrice: vPrice,
            status: "notified",
            notifiedAt: new Date(),
          });
        }

        let kakaoSent = false;
        if (vendor.contactPhone) {
          try {
            const message = `[탑셀러] 추가 배분 요청\n상품: ${allocation.productName}\n요청수량: ${vr.requestedQuantity}박스\n매입가: ${vPrice ? vPrice.toLocaleString() + '원' : '미정'}\n마감시간: ${deadline.toLocaleString('ko-KR')}\n대시보드에서 가능수량을 입력해 주세요.`;
            await solapiService.sendSMS(vendor.contactPhone, message);
            kakaoSent = true;
          } catch (err) {
            console.error(`[추가 배분 알림] 솔라피 발송 실패 (${vendor.companyName}):`, err);
          }
        }

        notifiedVendors.push({
          vendorId: vr.vendorId,
          companyName: vendor.companyName,
          requestedQuantity: vr.requestedQuantity,
          notified: true,
          kakaoSent,
          detailId: detail!.id,
        });
      }

      res.json({ allocationId, notifiedVendors, deadline: deadline.toISOString() });
    } catch (error: any) {
      console.error("추가 알림 발송 실패:", error);
      res.status(500).json({ message: error.message || "추가 알림 발송 실패" });
    }
  });

  // Phase 2-4: 배분 확정
  app.post('/api/admin/allocations/:allocationId/confirm', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) return res.status(403).json({ message: "Not authorized" });

    try {
      const allocationId = parseInt(req.params.allocationId);
      const allocation = await storage.getOrderAllocationById(allocationId);
      if (!allocation) return res.status(404).json({ message: "배분 정보를 찾을 수 없습니다" });

      const { details: detailUpdates, selfQuantity } = req.body;
      if (!detailUpdates || !Array.isArray(detailUpdates)) {
        return res.status(400).json({ message: "배분 상세 정보를 지정해 주세요" });
      }

      let totalAllocated = 0;
      for (const du of detailUpdates) {
        totalAllocated += (du.allocatedQuantity || 0);
      }
      if (selfQuantity && selfQuantity > 0) {
        totalAllocated += selfQuantity;
      }

      if (totalAllocated > allocation.totalQuantity) {
        return res.status(400).json({
          message: `배분 총량(${totalAllocated})이 필요수량(${allocation.totalQuantity})을 초과합니다`,
        });
      }

      const confirmedDetails = [];

      for (const du of detailUpdates) {
        const qty = du.allocatedQuantity || 0;
        const status = qty > 0 ? "confirmed" : "rejected";
        const updated = await storage.updateAllocationDetail(du.detailId, {
          allocatedQuantity: qty,
          status,
          confirmedAt: qty > 0 ? new Date() : undefined,
        });
        if (updated) confirmedDetails.push(updated);
      }

      if (selfQuantity && selfQuantity > 0) {
        const existingDetails = await storage.getAllocationDetailsByAllocationId(allocationId);
        const existingSelfDetail = existingDetails.find(d => d.vendorId === null && (d.vendorName === "자체(탑셀러)" || d.vendorName === "자체발송"));
        let selfDetail;
        if (existingSelfDetail) {
          selfDetail = await storage.updateAllocationDetail(existingSelfDetail.id, {
            requestedQuantity: selfQuantity,
            confirmedQuantity: selfQuantity,
            allocatedQuantity: selfQuantity,
            status: "confirmed",
            confirmedAt: new Date(),
          });
        } else {
          selfDetail = await storage.createAllocationDetail({
            allocationId,
            vendorId: null,
            vendorName: "자체(탑셀러)",
            requestedQuantity: selfQuantity,
            confirmedQuantity: selfQuantity,
            allocatedQuantity: selfQuantity,
            status: "confirmed",
            confirmedAt: new Date(),
          });
        }
        if (selfDetail) confirmedDetails.push(selfDetail);
      }

      const unallocated = allocation.totalQuantity - totalAllocated;
      const newStatus = "confirmed";

      await storage.updateOrderAllocation(allocationId, {
        allocatedQuantity: totalAllocated,
        unallocatedQuantity: unallocated,
        status: newStatus,
      });

      // 배분 확정: 수량만 확정, 주문 상태는 변경하지 않음
      // 미배분 주문은 "대기" 상태를 유지하고, 주문조정(직권취소) 등록 단계에서 공정 배분 처리
      console.log(`배분 확정 - 확정수량: ${totalAllocated}, 미배분: ${unallocated} (주문 상태 변경 없음, 공정배분 대기)`);

      const updatedAllocation = await storage.getOrderAllocationById(allocationId);

      sseManager.sendToAdmins("allocation-updated", { type: "allocation-confirmed", allocationId });
      confirmedDetails.forEach(d => {
        if (d.vendorId) {
          sseManager.sendToPartner(d.vendorId, "allocation-updated", { type: "allocation-confirmed", allocationId });
        }
      });

      res.json({
        allocationId,
        productCode: allocation.productCode,
        totalQuantity: allocation.totalQuantity,
        allocatedQuantity: totalAllocated,
        unallocatedQuantity: unallocated,
        details: confirmedDetails.map(d => ({
          detailId: d.id,
          vendorId: d.vendorId,
          vendorName: d.vendorName,
          allocatedQuantity: d.allocatedQuantity,
          vendorPrice: d.vendorPrice,
          status: d.status,
        })),
        status: newStatus,
      });
    } catch (error: any) {
      console.error("배분 확정 실패:", error);
      res.status(500).json({ message: error.message || "배분 확정 실패" });
    }
  });

  // Phase 2-5: 배분 확정 → 주문 배정
  app.post('/api/admin/allocations/:allocationId/assign-orders', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) return res.status(403).json({ message: "Not authorized" });

    try {
      const allocationId = parseInt(req.params.allocationId);
      const allocation = await storage.getOrderAllocationById(allocationId);
      if (!allocation) return res.status(404).json({ message: "배분 정보를 찾을 수 없습니다" });

      if (allocation.status === "assigned") {
        return res.status(400).json({ message: "이미 주문 배정이 완료된 배분입니다. 중복 실행할 수 없습니다." });
      }

      if (allocation.status !== "confirmed") {
        return res.status(400).json({ message: "배분이 확정되지 않았습니다. 먼저 배분을 확정해 주세요." });
      }

      // 배정(assign)은 이제 주문 상태를 변경하지 않음
      // 실제 vendorId 배정과 상태 전환은 주문조정(직권취소) 등록의 공정 배분 실행에서 처리
      // 여기서는 allocation 상태만 assigned로 변경
      await db.update(orderAllocations)
        .set({
          status: "assigned",
          updatedAt: new Date(),
        })
        .where(eq(orderAllocations.id, allocationId));

      sseManager.sendToAdmins("allocation-updated", { type: "allocation-assigned", allocationId });
      sseManager.broadcast("pending-orders-updated", { type: "pending-orders-updated" });

      console.log(`배정 완료 - allocationId: ${allocationId}, 확정수량: ${allocation.allocatedQuantity}, 공정배분 대기`);

      res.json({
        allocationId,
        message: "배분 상태가 '배정완료'로 변경되었습니다. 주문조정(직권취소) 등록에서 공정 배분을 진행해 주세요.",
        allocatedQuantity: allocation.allocatedQuantity,
        unallocatedQuantity: allocation.unallocatedQuantity,
      });
    } catch (error: any) {
      console.error("주문 배정 실패:", error);
      res.status(500).json({ message: error.message || "주문 배정 실패" });
    }
  });

  // ========================================
  // 뱅크다 입금 자동충전 API
  // ========================================

  let lastBankdaSyncTime: number = 0;
  let bankdaSyncLock: boolean = false;
  const BANKDA_AUTO_SYNC_INTERVAL_MS = 30 * 60 * 1000;

  async function syncBankdaTransactions(isAutoSync: boolean = false) {
    if (process.env.BANKDA_ENABLED !== 'true' || !process.env.BANKDA_ACCESS_TOKEN) {
      return { success: false, error: '뱅크다 API가 설정되지 않았습니다. 환경변수(BANKDA_ENABLED, BANKDA_ACCESS_TOKEN)를 확인해주세요.', processed: 0, matched: 0, unmatched: 0, duplicateNames: 0, skipped: 0 };
    }

    if (bankdaSyncLock) {
      return { success: false, error: '동기화가 이미 진행 중입니다. 잠시 후 다시 시도해주세요.', processed: 0, matched: 0, unmatched: 0, duplicateNames: 0, skipped: 0 };
    }

    bankdaSyncLock = true;
    let bankEntries: any[] = [];

    try {
      const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
      const dateTo = kstNow.toISOString().slice(0, 10).replace(/-/g, '');
      const oneWeekAgo = new Date(kstNow.getTime() - 7 * 24 * 60 * 60 * 1000);
      const dateFrom = oneWeekAgo.toISOString().slice(0, 10).replace(/-/g, '');

      const params = new URLSearchParams({
        datefrom: dateFrom,
        dateto: dateTo,
        datatype: 'json',
        charset: 'utf8',
      });
      if (process.env.BANKDA_ACCOUNT_NUM) {
        params.set('accountnum', process.env.BANKDA_ACCOUNT_NUM);
      }

      const apiUrl = process.env.BANKDA_API_URL || 'https://a.bankda.com/dtsvc/bank_tr.php';
      console.log(`[뱅크다] ${isAutoSync ? '자동' : '수동'} 동기화 API 호출: ${apiUrl}, 조회기간: ${dateFrom}~${dateTo}`);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.BANKDA_ACCESS_TOKEN}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const rawText = await response.text();
      console.log(`[뱅크다] API 원본 응답 (처음 500자): ${rawText.slice(0, 500)}`);
      let data: any;
      try {
        data = JSON.parse(rawText);
      } catch (parseErr) {
        console.error('[뱅크다] JSON 파싱 실패, 원본 응답:', rawText.slice(0, 1000));
        bankdaSyncLock = false;
        return { success: false, error: 'API 응답 파싱 실패', processed: 0, matched: 0, unmatched: 0, duplicateNames: 0, skipped: 0 };
      }
      console.log(`[뱅크다] 응답 구조 키: ${JSON.stringify(Object.keys(data || {}))}`);
      if (data?.response) {
        console.log(`[뱅크다] response 키: ${JSON.stringify(Object.keys(data.response))}`);
      }
      const bankData = data?.response?.bank || data?.bank || data?.data?.bank || data?.result?.bank || [];
      console.log(`[뱅크다] API 응답 수신, 거래건수: ${Array.isArray(bankData) ? bankData.length : 'N/A (not array)'}`);
      bankEntries = Array.isArray(bankData) ? bankData : [];
      lastBankdaSyncTime = Date.now();
    } catch (err: any) {
      console.error('[뱅크다] API 호출 실패:', err.message);
      bankdaSyncLock = false;
      return { success: false, error: `뱅크다 API 호출 실패: ${err.message}`, processed: 0, matched: 0, unmatched: 0, duplicateNames: 0, skipped: 0 };
    }

    const depositEntries = bankEntries.filter((e: any) => parseInt(e.bkinput) > 0);

    let processed = 0, matched = 0, unmatched = 0, duplicateNames = 0, skipped = 0;

    for (const entry of depositEntries) {
      try {
        const existing = await db.select({ id: bankdaTransactions.id })
          .from(bankdaTransactions)
          .where(eq(bankdaTransactions.bkcode, entry.bkcode));

        if (existing.length > 0) {
          skipped++;
          continue;
        }

        const depositorName = (entry.bkjukyo || '').replace(/\s/g, '');
        const matchingMembers = await db.select({ id: members.id, memberName: members.memberName, deposit: members.deposit })
          .from(members)
          .where(sql`REPLACE(${members.memberName}, ' ', '') = ${depositorName}`);

        let matchStatus = 'pending';
        let matchedMemberId: string | null = null;

        if (matchingMembers.length === 1) {
          matchStatus = 'matched';
          matchedMemberId = matchingMembers[0].id;

          const inputAmount = parseInt(entry.bkinput);
          try {
            await db.transaction(async (tx) => {
              const [lockedMember] = await tx.select().from(members).where(eq(members.id, matchedMemberId!)).for('update');
              if (!lockedMember) throw new Error('회원 없음');

              const newDeposit = lockedMember.deposit + inputAmount;
              await tx.update(members).set({ deposit: newDeposit, updatedAt: new Date() }).where(eq(members.id, matchedMemberId!));
              const [dh] = await tx.insert(depositHistory).values({
                memberId: matchedMemberId!,
                type: 'charge',
                amount: inputAmount,
                balanceAfter: newDeposit,
                description: `뱅크다 자동입금 (${entry.bketc ? entry.bketc.split(/\s+/)[0] + ' ' : ''}${entry.bkjukyo})`,
              }).returning();

              await tx.insert(bankdaTransactions).values({
                bkcode: entry.bkcode,
                accountnum: entry.accountnum || null,
                bkname: entry.bkname || null,
                bkdate: entry.bkdate || null,
                bktime: entry.bktime || null,
                bkjukyo: entry.bkjukyo || null,
                bkcontent: entry.bkcontent || null,
                bketc: entry.bketc || null,
                bkinput: inputAmount,
                bkoutput: parseInt(entry.bkoutput) || 0,
                bkjango: parseInt(entry.bkjango) || 0,
                matchStatus: 'matched',
                matchedMemberId,
                matchedAt: new Date(),
                depositCharged: true,
                depositHistoryId: dh.id,
              });
            });
            matched++;
          } catch (chargeErr: any) {
            await db.insert(bankdaTransactions).values({
              bkcode: entry.bkcode,
              accountnum: entry.accountnum || null,
              bkname: entry.bkname || null,
              bkdate: entry.bkdate || null,
              bktime: entry.bktime || null,
              bkjukyo: entry.bkjukyo || null,
              bkcontent: entry.bkcontent || null,
              bketc: entry.bketc || null,
              bkinput: parseInt(entry.bkinput),
              bkoutput: parseInt(entry.bkoutput) || 0,
              bkjango: parseInt(entry.bkjango) || 0,
              matchStatus: 'matched',
              matchedMemberId,
              matchedAt: new Date(),
              depositCharged: false,
              chargeError: chargeErr.message,
            }).onConflictDoNothing();
            matched++;
          }
          processed++;
          continue;
        } else if (matchingMembers.length === 0) {
          matchStatus = 'unmatched';
          unmatched++;
        } else {
          matchStatus = 'duplicate_name';
          duplicateNames++;
        }

        await db.insert(bankdaTransactions).values({
          bkcode: entry.bkcode,
          accountnum: entry.accountnum || null,
          bkname: entry.bkname || null,
          bkdate: entry.bkdate || null,
          bktime: entry.bktime || null,
          bkjukyo: entry.bkjukyo || null,
          bkcontent: entry.bkcontent || null,
          bketc: entry.bketc || null,
          bkinput: parseInt(entry.bkinput),
          bkoutput: parseInt(entry.bkoutput) || 0,
          bkjango: parseInt(entry.bkjango) || 0,
          matchStatus,
          matchedMemberId,
          matchedAt: matchedMemberId ? new Date() : null,
        }).onConflictDoNothing();
        processed++;
      } catch (err: any) {
        console.error(`뱅크다 거래 처리 오류 (bkcode: ${entry.bkcode}):`, err.message);
      }
    }

    bankdaSyncLock = false;
    return { success: true, processed, matched, unmatched, duplicateNames, skipped, total: depositEntries.length };
  }

  // 뱅크다 자동 동기화 스케줄러 (30분 간격)
  if (process.env.BANKDA_ENABLED === 'true' && process.env.BANKDA_ACCESS_TOKEN) {
    console.log('[뱅크다] 자동 동기화 스케줄러 시작 (30분 간격)');
    setTimeout(async () => {
      console.log('[뱅크다] 서버 시작 후 첫 자동 동기화 실행');
      try {
        const result = await syncBankdaTransactions(true);
        console.log(`[뱅크다] 첫 자동 동기화 결과: 처리=${result.processed}, 매칭=${result.matched}, 미매칭=${result.unmatched}, 중복건너뜀=${result.skipped}`);
      } catch (err: any) {
        console.error('[뱅크다] 첫 자동 동기화 실패:', err.message);
      }
    }, 10000);

    setInterval(async () => {
      console.log('[뱅크다] 자동 동기화 실행 중...');
      try {
        const result = await syncBankdaTransactions(true);
        console.log(`[뱅크다] 자동 동기화 결과: 처리=${result.processed}, 매칭=${result.matched}, 미매칭=${result.unmatched}, 중복건너뜀=${result.skipped}`);
      } catch (err: any) {
        console.error('[뱅크다] 자동 동기화 실패:', err.message);
      }
    }, BANKDA_AUTO_SYNC_INTERVAL_MS);
  }

  // 관리자: 뱅크다 입금 내역 조회
  app.get('/api/admin/bankda/transactions', async (req, res) => {
    if (!req.session.userId || req.session.userType !== "user") {
      return res.status(401).json({ message: "관리자 로그인이 필요합니다" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
      return res.status(403).json({ message: "접근 권한이 없습니다" });
    }

    try {
      const { status, startDate, endDate } = req.query;
      const conditions: any[] = [];

      if (status && status !== 'all') {
        conditions.push(eq(bankdaTransactions.matchStatus, status as string));
      }
      if (startDate) {
        conditions.push(gte(bankdaTransactions.bkdate, (startDate as string).replace(/-/g, '')));
      }
      if (endDate) {
        conditions.push(lte(bankdaTransactions.bkdate, (endDate as string).replace(/-/g, '')));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const txns = await db.select().from(bankdaTransactions)
        .where(whereClause)
        .orderBy(desc(bankdaTransactions.createdAt));

      const memberIds = txns.filter(t => t.matchedMemberId).map(t => t.matchedMemberId!);
      let memberMap = new Map<string, { memberName: string | null; companyName: string }>();
      if (memberIds.length > 0) {
        const memberList = await db.select({ id: members.id, memberName: members.memberName, companyName: members.companyName })
          .from(members)
          .where(inArray(members.id, memberIds));
        memberMap = new Map(memberList.map(m => [m.id, { memberName: m.memberName, companyName: m.companyName }]));
      }

      const result = txns.map(t => ({
        ...t,
        matchedMember: t.matchedMemberId ? memberMap.get(t.matchedMemberId) || null : null,
      }));

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // 관리자: 뱅크다 요약
  app.get('/api/admin/bankda/summary', async (req, res) => {
    if (!req.session.userId || req.session.userType !== "user") {
      return res.status(401).json({ message: "관리자 로그인이 필요합니다" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
      return res.status(403).json({ message: "접근 권한이 없습니다" });
    }

    try {
      const now = new Date();
      const kstDate = new Date(now.getTime() + 9 * 60 * 60 * 1000);
      const todayStr = kstDate.toISOString().slice(0, 10).replace(/-/g, '');

      const todayTxns = await db.select({
        count: sql<string>`COUNT(*)`,
        totalAmount: sql<string>`COALESCE(SUM(${bankdaTransactions.bkinput}), 0)`
      }).from(bankdaTransactions).where(eq(bankdaTransactions.bkdate, todayStr));

      const matchedCount = await db.select({ count: sql<string>`COUNT(*)` })
        .from(bankdaTransactions)
        .where(and(eq(bankdaTransactions.bkdate, todayStr), eq(bankdaTransactions.matchStatus, 'matched')));

      const unmatchedCount = await db.select({ count: sql<string>`COUNT(*)` })
        .from(bankdaTransactions)
        .where(and(
          eq(bankdaTransactions.bkdate, todayStr),
          inArray(bankdaTransactions.matchStatus, ['unmatched', 'duplicate_name', 'pending'])
        ));

      const lastSync = await db.select({ createdAt: bankdaTransactions.createdAt })
        .from(bankdaTransactions)
        .orderBy(desc(bankdaTransactions.createdAt))
        .limit(1);

      res.json({
        todayCount: parseInt(todayTxns[0]?.count || '0'),
        todayAmount: parseInt(todayTxns[0]?.totalAmount || '0'),
        matchedCount: parseInt(matchedCount[0]?.count || '0'),
        unmatchedCount: parseInt(unmatchedCount[0]?.count || '0'),
        lastSyncAt: lastSync[0]?.createdAt || null,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // 관리자: 수동 동기화
  app.post('/api/admin/bankda/sync', async (req, res) => {
    if (!req.session.userId || req.session.userType !== "user") {
      return res.status(401).json({ message: "관리자 로그인이 필요합니다" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
      return res.status(403).json({ message: "접근 권한이 없습니다" });
    }

    try {
      const result = await syncBankdaTransactions();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // 관리자: 수동 매칭
  app.post('/api/admin/bankda/transactions/:id/manual-match', async (req, res) => {
    if (!req.session.userId || req.session.userType !== "user") {
      return res.status(401).json({ message: "관리자 로그인이 필요합니다" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
      return res.status(403).json({ message: "접근 권한이 없습니다" });
    }

    try {
      const txnId = parseInt(req.params.id);
      const { memberId } = req.body;
      if (!memberId) return res.status(400).json({ message: "회원 ID가 필요합니다" });

      const [txn] = await db.select().from(bankdaTransactions).where(eq(bankdaTransactions.id, txnId));
      if (!txn) return res.status(404).json({ message: "거래를 찾을 수 없습니다" });
      if (txn.depositCharged) return res.status(400).json({ message: "이미 충전된 거래입니다" });

      const inputAmount = txn.bkinput || 0;

      await db.transaction(async (tx) => {
        const [lockedMember] = await tx.select().from(members).where(eq(members.id, memberId)).for('update');
        if (!lockedMember) throw new Error('회원을 찾을 수 없습니다');

        const newDeposit = lockedMember.deposit + inputAmount;
        await tx.update(members).set({ deposit: newDeposit, updatedAt: new Date() }).where(eq(members.id, memberId));
        const [dh] = await tx.insert(depositHistory).values({
          memberId,
          type: 'charge',
          amount: inputAmount,
          balanceAfter: newDeposit,
          description: `뱅크다 수동매칭 입금 (${txn.bketc ? txn.bketc.split(/\s+/)[0] + ' ' : ''}${txn.bkjukyo})`,
          adminId: req.session.userId,
        }).returning();

        await tx.update(bankdaTransactions).set({
          matchStatus: 'manual',
          matchedMemberId: memberId,
          matchedAt: new Date(),
          depositCharged: true,
          depositHistoryId: dh.id,
          updatedAt: new Date(),
        }).where(eq(bankdaTransactions.id, txnId));
      });

      res.json({ success: true, message: `${inputAmount.toLocaleString()}원 수동 매칭 충전 완료` });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // 관리자: 무시 처리
  app.post('/api/admin/bankda/transactions/:id/ignore', async (req, res) => {
    if (!req.session.userId || req.session.userType !== "user") {
      return res.status(401).json({ message: "관리자 로그인이 필요합니다" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
      return res.status(403).json({ message: "접근 권한이 없습니다" });
    }

    try {
      const txnId = parseInt(req.params.id);
      const { memo } = req.body;

      const [txn] = await db.select().from(bankdaTransactions).where(eq(bankdaTransactions.id, txnId));
      if (!txn) return res.status(404).json({ message: "거래를 찾을 수 없습니다" });
      if (txn.depositCharged) return res.status(400).json({ message: "이미 충전된 거래는 무시할 수 없습니다" });

      await db.update(bankdaTransactions).set({
        matchStatus: 'ignored',
        adminMemo: memo || '관리자 무시 처리',
        updatedAt: new Date(),
      }).where(eq(bankdaTransactions.id, txnId));

      res.json({ success: true, message: "무시 처리 완료" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // 관리자: 회원 검색 (뱅크다 수동매칭용)
  app.get('/api/admin/bankda/search-members', async (req, res) => {
    if (!req.session.userId || req.session.userType !== "user") {
      return res.status(401).json({ message: "관리자 로그인이 필요합니다" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
      return res.status(403).json({ message: "접근 권한이 없습니다" });
    }

    try {
      const { q } = req.query;
      if (!q) return res.json([]);

      const searchTerm = `%${q}%`;
      const result = await db.select({
        id: members.id,
        memberName: members.memberName,
        companyName: members.companyName,
        phone: members.phone,
        deposit: members.deposit,
        grade: members.grade,
      })
      .from(members)
      .where(or(
        sql`${members.memberName} ILIKE ${searchTerm}`,
        sql`${members.companyName} ILIKE ${searchTerm}`,
        sql`${members.phone} ILIKE ${searchTerm}`,
      ))
      .limit(20);

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ===== Statistics API Endpoints =====

  app.get('/api/admin/statistics/overview', async (req, res) => {
    try {
      if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
      const user = await storage.getUser(req.session.userId);
      if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
        return res.status(403).json({ message: "권한이 없습니다" });
      }

      const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
      const { startUTC, endUTC } = parseDateRangeKST(startDate, endDate);

      const baseConditions = [
        eq(pendingOrders.status, '배송중'),
        eq(pendingOrders.priceConfirmed, true),
        gte(pendingOrders.updatedAt, startUTC),
        lte(pendingOrders.updatedAt, endUTC),
      ];

      const [summaryResult] = await db.select({
        totalRevenue: sql<number>`COALESCE(SUM(COALESCE(${pendingOrders.supplyPrice}, 0)), 0)`,
        totalOrders: sql<number>`COUNT(*)`,
      }).from(pendingOrders).where(and(...baseConditions));

      const startDateStr = startDate || '1970-01-01';
      const endDateStr = endDate || '2099-12-31';

      const [dsSummary] = await db.select({
        dsRevenue: sql<number>`COALESCE(SUM(${directSales.amount}), 0)`,
        dsCount: sql<number>`COUNT(*)`,
      }).from(directSales).where(and(
        gte(directSales.saleDate, startDateStr),
        lte(directSales.saleDate, endDateStr),
      ));

      const totalRevenue = Number(summaryResult.totalRevenue) + Number(dsSummary.dsRevenue);
      const totalOrders = Number(summaryResult.totalOrders) + Number(dsSummary.dsCount);
      const avgOrderAmount = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

      const [activeMemberResult] = await db.select({
        count: sql<number>`COUNT(DISTINCT ${pendingOrders.memberId})`,
      }).from(pendingOrders).where(and(...baseConditions));
      const [dsClientCount] = await db.select({
        count: sql<number>`COUNT(DISTINCT ${directSales.clientName})`,
      }).from(directSales).where(and(
        gte(directSales.saleDate, startDateStr),
        lte(directSales.saleDate, endDateStr),
      ));
      const activeMemberCount = Number(activeMemberResult.count) + Number(dsClientCount.count);

      const duration = endUTC.getTime() - startUTC.getTime();
      const prevStart = new Date(startUTC.getTime() - duration);
      const prevEnd = startUTC;

      const prevConditions = [
        eq(pendingOrders.status, '배송중'),
        eq(pendingOrders.priceConfirmed, true),
        gte(pendingOrders.updatedAt, prevStart),
        lte(pendingOrders.updatedAt, prevEnd),
      ];

      const [prevResult] = await db.select({
        prevRevenue: sql<number>`COALESCE(SUM(COALESCE(${pendingOrders.supplyPrice}, 0)), 0)`,
        prevOrders: sql<number>`COUNT(*)`,
      }).from(pendingOrders).where(and(...prevConditions));

      const prevDays = Math.ceil(duration / (1000 * 60 * 60 * 24));
      const prevStartDateStr = prevStart.toISOString().slice(0, 10);
      const prevEndDateStr = prevEnd.toISOString().slice(0, 10);
      const [dsPrevSummary] = await db.select({
        dsRevenue: sql<number>`COALESCE(SUM(${directSales.amount}), 0)`,
        dsCount: sql<number>`COUNT(*)`,
      }).from(directSales).where(and(
        gte(directSales.saleDate, prevStartDateStr),
        lt(directSales.saleDate, prevEndDateStr),
      ));

      const prevRevenue = Number(prevResult.prevRevenue) + Number(dsPrevSummary.dsRevenue);
      const prevOrders = Number(prevResult.prevOrders) + Number(dsPrevSummary.dsCount);
      const revenueGrowth = prevRevenue > 0 ? Math.round(((totalRevenue - prevRevenue) / prevRevenue) * 10000) / 100 : 0;
      const ordersGrowth = prevOrders > 0 ? Math.round(((totalOrders - prevOrders) / prevOrders) * 10000) / 100 : 0;

      const daysDiff = Math.ceil(duration / (1000 * 60 * 60 * 24));
      let dateBucket: ReturnType<typeof sql>;
      if (daysDiff <= 31) {
        dateBucket = sql`TO_CHAR(${pendingOrders.updatedAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD')`;
      } else if (daysDiff <= 90) {
        dateBucket = sql`TO_CHAR(DATE_TRUNC('week', ${pendingOrders.updatedAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul'), 'YYYY-MM-DD')`;
      } else {
        dateBucket = sql`TO_CHAR(DATE_TRUNC('month', ${pendingOrders.updatedAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul'), 'YYYY-MM-DD')`;
      }

      const trend = await db.select({
        date: dateBucket.as('date'),
        revenue: sql<number>`COALESCE(SUM(COALESCE(${pendingOrders.supplyPrice}, 0)), 0)`.as('revenue'),
        orders: sql<number>`COUNT(*)`.as('orders'),
      }).from(pendingOrders)
        .where(and(...baseConditions))
        .groupBy(dateBucket)
        .orderBy(dateBucket);

      let dsTrendBucket: string;
      if (daysDiff <= 31) dsTrendBucket = 'YYYY-MM-DD';
      else if (daysDiff <= 90) dsTrendBucket = 'week';
      else dsTrendBucket = 'month';

      let dsTrendQuery;
      if (dsTrendBucket === 'YYYY-MM-DD') {
        dsTrendQuery = await db.select({
          date: directSales.saleDate,
          revenue: sql<number>`COALESCE(SUM(${directSales.amount}), 0)`,
          orders: sql<number>`COUNT(*)`,
        }).from(directSales).where(and(
          gte(directSales.saleDate, startDateStr),
          lte(directSales.saleDate, endDateStr),
        )).groupBy(directSales.saleDate);
      } else {
        const truncFn = dsTrendBucket === 'week' ? 'week' : 'month';
        dsTrendQuery = await db.select({
          date: sql<string>`TO_CHAR(DATE_TRUNC('${sql.raw(truncFn)}', ${directSales.saleDate}::date), 'YYYY-MM-DD')`.as('date'),
          revenue: sql<number>`COALESCE(SUM(${directSales.amount}), 0)`,
          orders: sql<number>`COUNT(*)`,
        }).from(directSales).where(and(
          gte(directSales.saleDate, startDateStr),
          lte(directSales.saleDate, endDateStr),
        )).groupBy(sql`DATE_TRUNC('${sql.raw(truncFn)}', ${directSales.saleDate}::date)`);
      }

      const trendMap = new Map<string, { revenue: number; orders: number }>();
      for (const t of trend) {
        const d = String(t.date);
        trendMap.set(d, { revenue: Number(t.revenue), orders: Number(t.orders) });
      }
      for (const t of dsTrendQuery) {
        const d = String(t.date);
        const existing = trendMap.get(d) || { revenue: 0, orders: 0 };
        trendMap.set(d, { revenue: existing.revenue + Number(t.revenue), orders: existing.orders + Number(t.orders) });
      }
      const mergedTrend = Array.from(trendMap.entries())
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const topMembers = await db.select({
        memberId: pendingOrders.memberId,
        companyName: pendingOrders.memberCompanyName,
        revenue: sql<number>`COALESCE(SUM(COALESCE(${pendingOrders.supplyPrice}, 0)), 0)`.as('revenue'),
      }).from(pendingOrders)
        .where(and(...baseConditions))
        .groupBy(pendingOrders.memberId, pendingOrders.memberCompanyName)
        .orderBy(desc(sql`COALESCE(SUM(COALESCE(${pendingOrders.supplyPrice}, 0)), 0)`))
        .limit(10);

      const dsTopClients = await db.select({
        clientName: directSales.clientName,
        revenue: sql<number>`COALESCE(SUM(${directSales.amount}), 0)`,
      }).from(directSales).where(and(
        gte(directSales.saleDate, startDateStr),
        lte(directSales.saleDate, endDateStr),
      )).groupBy(directSales.clientName)
        .orderBy(desc(sql`COALESCE(SUM(${directSales.amount}), 0)`))
        .limit(10);

      const allClients: { memberId: string; companyName: string | null; revenue: number; source: string }[] = [
        ...topMembers.map(m => ({ memberId: m.memberId, companyName: m.companyName, revenue: Number(m.revenue), source: 'member' })),
        ...dsTopClients.map(c => ({ memberId: `ds_${c.clientName}`, companyName: c.clientName, revenue: Number(c.revenue), source: 'direct' })),
      ];
      allClients.sort((a, b) => b.revenue - a.revenue);
      const mergedTopMembers = allClients.slice(0, 5);

      const topProducts = await db.select({
        productName: pendingOrders.productName,
        productCode: pendingOrders.productCode,
        revenue: sql<number>`COALESCE(SUM(COALESCE(${pendingOrders.supplyPrice}, 0)), 0)`.as('revenue'),
        quantity: sql<number>`COUNT(*)`.as('quantity'),
      }).from(pendingOrders)
        .where(and(...baseConditions))
        .groupBy(pendingOrders.productCode, pendingOrders.productName)
        .orderBy(desc(sql`COALESCE(SUM(COALESCE(${pendingOrders.supplyPrice}, 0)), 0)`))
        .limit(20);

      const dsTopProducts = await db.select({
        productCode: directSales.productCode,
        productName: sql<string>`COALESCE(${directSales.productName}, ${directSales.description})`.as('product_name_resolved'),
        revenue: sql<number>`COALESCE(SUM(${directSales.amount}), 0)`,
        quantity: sql<number>`COALESCE(SUM(${directSales.quantity}), COUNT(*))`,
      }).from(directSales).where(and(
        gte(directSales.saleDate, startDateStr),
        lte(directSales.saleDate, endDateStr),
      )).groupBy(directSales.productCode, sql`COALESCE(${directSales.productName}, ${directSales.description})`)
        .orderBy(desc(sql`COALESCE(SUM(${directSales.amount}), 0)`))
        .limit(20);

      const productMap = new Map<string, { productName: string | null; productCode: string | null; revenue: number; quantity: number }>();
      for (const p of topProducts) {
        const key = `member_${p.productCode || ''}_${p.productName || ''}`;
        productMap.set(key, { productName: p.productName, productCode: p.productCode, revenue: Number(p.revenue), quantity: Number(p.quantity) });
      }
      let dsOverIdx = 0;
      for (const p of dsTopProducts) {
        dsOverIdx++;
        if (p.productCode) {
          let found = false;
          for (const [k, v] of productMap) {
            if (v.productCode === p.productCode) {
              v.revenue += Number(p.revenue);
              v.quantity += Number(p.quantity);
              found = true;
              break;
            }
          }
          if (found) continue;
        }
        const key = `direct_${p.productCode || ''}_${p.productName || ''}_${dsOverIdx}`;
        productMap.set(key, { productName: p.productName || p.productCode || '기타(직접매출)', productCode: p.productCode, revenue: Number(p.revenue), quantity: Number(p.quantity) });
      }
      const mergedTopProducts = Array.from(productMap.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      res.json({
        summary: {
          totalRevenue,
          totalOrders,
          avgOrderAmount,
          activeMemberCount,
          prevRevenue,
          prevOrders,
          revenueGrowth,
          ordersGrowth,
        },
        trend: mergedTrend,
        topMembers: mergedTopMembers.map(m => ({ memberId: m.memberId, companyName: m.companyName, revenue: m.revenue, source: m.source })),
        topProducts: mergedTopProducts.map(p => ({ productName: p.productName, productCode: p.productCode, revenue: p.revenue, quantity: p.quantity })),
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/admin/statistics/by-member', async (req, res) => {
    try {
      if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
      const user = await storage.getUser(req.session.userId);
      if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
        return res.status(403).json({ message: "권한이 없습니다" });
      }

      const { startDate, endDate, search } = req.query as { startDate?: string; endDate?: string; search?: string };
      const { startUTC, endUTC } = parseDateRangeKST(startDate, endDate);

      const conditions: any[] = [
        eq(pendingOrders.status, '배송중'),
        eq(pendingOrders.priceConfirmed, true),
        gte(pendingOrders.updatedAt, startUTC),
        lte(pendingOrders.updatedAt, endUTC),
      ];

      if (search && search.trim()) {
        conditions.push(ilike(pendingOrders.memberCompanyName, `%${search.trim()}%`));
      }

      const memberStats = await db.select({
        memberId: pendingOrders.memberId,
        companyName: pendingOrders.memberCompanyName,
        orderCount: sql<number>`COUNT(*)`.as('order_count'),
        revenue: sql<number>`COALESCE(SUM(COALESCE(${pendingOrders.supplyPrice}, 0)), 0)`.as('revenue'),
        firstOrderDate: sql<string>`TO_CHAR(MIN(${pendingOrders.updatedAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul'), 'YYYY-MM-DD')`.as('first_order_date'),
        lastOrderDate: sql<string>`TO_CHAR(MAX(${pendingOrders.updatedAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul'), 'YYYY-MM-DD')`.as('last_order_date'),
      }).from(pendingOrders)
        .where(and(...conditions))
        .groupBy(pendingOrders.memberId, pendingOrders.memberCompanyName)
        .orderBy(desc(sql`COALESCE(SUM(COALESCE(${pendingOrders.supplyPrice}, 0)), 0)`));

      const memberIds = memberStats.map(m => m.memberId);
      let memberNameMap: Record<string, string> = {};
      if (memberIds.length > 0) {
        const memberRows = await db.select({
          id: members.id,
          memberName: members.memberName,
        }).from(members).where(inArray(members.id, memberIds));
        for (const m of memberRows) {
          memberNameMap[m.id] = m.memberName || '';
        }
      }

      const { startUTC: byMemberStartUTC, endUTC: byMemberEndUTC } = parseDateRangeKST(startDate, endDate);
      const byMemberStartStr = startDate || '1970-01-01';
      const byMemberEndStr = endDate || '2099-12-31';

      const dsClientConditions: any[] = [
        gte(directSales.saleDate, byMemberStartStr),
        lte(directSales.saleDate, byMemberEndStr),
      ];
      if (search && search.trim()) {
        dsClientConditions.push(ilike(directSales.clientName, `%${search.trim()}%`));
      }

      const dsClientStats = await db.select({
        clientName: directSales.clientName,
        orderCount: sql<number>`COUNT(*)`.as('order_count'),
        revenue: sql<number>`COALESCE(SUM(${directSales.amount}), 0)`.as('revenue'),
        firstOrderDate: sql<string>`MIN(${directSales.saleDate})`.as('first_order_date'),
        lastOrderDate: sql<string>`MAX(${directSales.saleDate})`.as('last_order_date'),
      }).from(directSales)
        .where(and(...dsClientConditions))
        .groupBy(directSales.clientName)
        .orderBy(desc(sql`COALESCE(SUM(${directSales.amount}), 0)`));

      const allMembers: any[] = [
        ...memberStats.map(m => ({
          memberId: m.memberId,
          companyName: m.companyName,
          memberName: memberNameMap[m.memberId] || '',
          orderCount: Number(m.orderCount),
          revenue: Number(m.revenue),
          avgOrderAmount: Number(m.orderCount) > 0 ? Math.round(Number(m.revenue) / Number(m.orderCount)) : 0,
          firstOrderDate: m.firstOrderDate || '',
          lastOrderDate: m.lastOrderDate || '',
          source: 'member',
        })),
        ...dsClientStats.map(c => ({
          memberId: `direct_${c.clientName}`,
          companyName: c.clientName,
          memberName: c.clientName,
          orderCount: Number(c.orderCount),
          revenue: Number(c.revenue),
          avgOrderAmount: Number(c.orderCount) > 0 ? Math.round(Number(c.revenue) / Number(c.orderCount)) : 0,
          firstOrderDate: c.firstOrderDate || '',
          lastOrderDate: c.lastOrderDate || '',
          source: 'direct',
        })),
      ];
      allMembers.sort((a, b) => b.revenue - a.revenue);

      const totalRevenue = allMembers.reduce((sum, m) => sum + m.revenue, 0);

      res.json({
        members: allMembers,
        totalRevenue,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/admin/statistics/by-member/export', async (req, res) => {
    try {
      if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
      const user = await storage.getUser(req.session.userId);
      if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
        return res.status(403).json({ message: "권한이 없습니다" });
      }
      const { startDate, endDate, search } = req.query as { startDate?: string; endDate?: string; search?: string };
      const { startUTC, endUTC } = parseDateRangeKST(startDate, endDate);
      const conditions: any[] = [
        eq(pendingOrders.status, '배송중'),
        eq(pendingOrders.priceConfirmed, true),
        gte(pendingOrders.updatedAt, startUTC),
        lte(pendingOrders.updatedAt, endUTC),
      ];
      if (search && search.trim()) {
        conditions.push(
          or(
            sql`${pendingOrders.memberCompanyName} ILIKE ${'%' + search.trim() + '%'}`,
            sql`${pendingOrders.memberId} ILIKE ${'%' + search.trim() + '%'}`
          )!
        );
      }
      const rows = await db.select({
        memberId: pendingOrders.memberId,
        memberCompanyName: pendingOrders.memberCompanyName,
        revenue: sql<number>`COALESCE(SUM(COALESCE(${pendingOrders.supplyPrice}, 0)), 0)`,
        orderCount: sql<number>`COUNT(*)`,
        firstOrderDate: sql<string>`MIN((${pendingOrders.updatedAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul')::date)::text`,
        lastOrderDate: sql<string>`MAX((${pendingOrders.updatedAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul')::date)::text`,
      }).from(pendingOrders)
        .where(and(...conditions))
        .groupBy(pendingOrders.memberId, pendingOrders.memberCompanyName)
        .orderBy(sql`COALESCE(SUM(COALESCE(${pendingOrders.supplyPrice}, 0)), 0) DESC`);

      const totalRevenue = rows.reduce((s, r) => s + Number(r.revenue || 0), 0);
      const XLSX = await import('xlsx');
      const wsData = [
        [`조회기간: ${startDate || '전체'} ~ ${endDate || '전체'}`],
        ['순위', '회원ID', '업체명', '거래시작일', '거래종료일', '주문건수', '매출액', '평균주문금액', '매출비중(%)'],
        ...rows.map((r, i) => {
          const rev = Number(r.revenue || 0);
          const cnt = Number(r.orderCount || 0);
          const avg = cnt > 0 ? Math.round(rev / cnt) : 0;
          const share = totalRevenue > 0 ? Number(((rev / totalRevenue) * 100).toFixed(1)) : 0;
          return [i + 1, r.memberId, r.memberCompanyName || '', r.firstOrderDate || '', r.lastOrderDate || '', cnt, rev, avg, share];
        }),
      ];
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, '회원별매출');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      const koreanFileName = `회원별매출_${startDate || '전체'}_${endDate || '전체'}.xlsx`;
      const encodedFileName = encodeURIComponent(koreanFileName);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${encodedFileName}"; filename*=UTF-8''${encodedFileName}`);
      res.send(buf);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/admin/statistics/by-member/:memberId', async (req, res) => {
    try {
      if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
      const user = await storage.getUser(req.session.userId);
      if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
        return res.status(403).json({ message: "권한이 없습니다" });
      }

      const { memberId } = req.params;
      const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
      const { startUTC, endUTC } = parseDateRangeKST(startDate, endDate);

      const baseConditions = [
        eq(pendingOrders.status, '배송중'),
        eq(pendingOrders.priceConfirmed, true),
        eq(pendingOrders.memberId, memberId),
        gte(pendingOrders.updatedAt, startUTC),
        lte(pendingOrders.updatedAt, endUTC),
      ];

      const [memberInfo] = await db.select({
        memberId: pendingOrders.memberId,
        companyName: pendingOrders.memberCompanyName,
      }).from(pendingOrders)
        .where(eq(pendingOrders.memberId, memberId))
        .limit(1);

      const dateBucket = sql`TO_CHAR(${pendingOrders.updatedAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD')`;

      const trend = await db.select({
        date: dateBucket.as('date'),
        revenue: sql<number>`COALESCE(SUM(COALESCE(${pendingOrders.supplyPrice}, 0)), 0)`.as('revenue'),
        orders: sql<number>`COUNT(*)`.as('orders'),
      }).from(pendingOrders)
        .where(and(...baseConditions))
        .groupBy(dateBucket)
        .orderBy(dateBucket);

      const products = await db.select({
        productName: pendingOrders.productName,
        productCode: pendingOrders.productCode,
        revenue: sql<number>`COALESCE(SUM(COALESCE(${pendingOrders.supplyPrice}, 0)), 0)`.as('revenue'),
        quantity: sql<number>`COUNT(*)`.as('quantity'),
      }).from(pendingOrders)
        .where(and(...baseConditions))
        .groupBy(pendingOrders.productCode, pendingOrders.productName)
        .orderBy(desc(sql`COALESCE(SUM(COALESCE(${pendingOrders.supplyPrice}, 0)), 0)`));

      res.json({
        member: memberInfo ? { memberId: memberInfo.memberId, companyName: memberInfo.companyName } : { memberId, companyName: '' },
        trend: trend.map(t => ({ date: t.date, revenue: Number(t.revenue), orders: Number(t.orders) })),
        products: products.map(p => ({ productName: p.productName, productCode: p.productCode, revenue: Number(p.revenue), quantity: Number(p.quantity) })),
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/admin/statistics/by-product', async (req, res) => {
    try {
      if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
      const user = await storage.getUser(req.session.userId);
      if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
        return res.status(403).json({ message: "권한이 없습니다" });
      }

      const { startDate, endDate, categoryLarge, categoryMedium, categorySmall, search, vendorFilter } = req.query as {
        startDate?: string; endDate?: string; categoryLarge?: string; categoryMedium?: string; categorySmall?: string; search?: string; vendorFilter?: string;
      };
      const { startUTC, endUTC } = parseDateRangeKST(startDate, endDate);

      const conditions: any[] = [
        eq(pendingOrders.status, '배송중'),
        eq(pendingOrders.priceConfirmed, true),
        gte(pendingOrders.updatedAt, startUTC),
        lte(pendingOrders.updatedAt, endUTC),
      ];

      if (categoryLarge && categoryLarge.trim()) conditions.push(eq(pendingOrders.categoryLarge, categoryLarge.trim()));
      if (categoryMedium && categoryMedium.trim()) conditions.push(eq(pendingOrders.categoryMedium, categoryMedium.trim()));
      if (categorySmall && categorySmall.trim()) conditions.push(eq(pendingOrders.categorySmall, categorySmall.trim()));
      if (search && search.trim()) {
        conditions.push(or(
          ilike(pendingOrders.productName, `%${search.trim()}%`),
          ilike(pendingOrders.productCode, `%${search.trim()}%`),
        ));
      }
      if (vendorFilter === 'self') {
        conditions.push(or(eq(pendingOrders.fulfillmentType, 'self'), sql`${pendingOrders.vendorId} IS NULL`));
      } else if (vendorFilter && vendorFilter !== '' && vendorFilter !== 'all') {
        conditions.push(eq(pendingOrders.vendorId, parseInt(vendorFilter)));
      }

      const products = await db.select({
        productCode: pendingOrders.productCode,
        productName: pendingOrders.productName,
        categoryLarge: pendingOrders.categoryLarge,
        categoryMedium: pendingOrders.categoryMedium,
        categorySmall: pendingOrders.categorySmall,
        quantity: sql<number>`COUNT(*)`.as('quantity'),
        revenue: sql<number>`COALESCE(SUM(COALESCE(${pendingOrders.supplyPrice}, 0)), 0)`.as('revenue'),
        vendorName: sql<string>`MAX(${vendors.companyName})`.as('vendor_name'),
        fulfillmentType: pendingOrders.fulfillmentType,
      }).from(pendingOrders)
        .leftJoin(vendors, eq(pendingOrders.vendorId, vendors.id))
        .where(and(...conditions))
        .groupBy(pendingOrders.productCode, pendingOrders.productName, pendingOrders.categoryLarge, pendingOrders.categoryMedium, pendingOrders.categorySmall, pendingOrders.fulfillmentType)
        .orderBy(desc(sql`COALESCE(SUM(COALESCE(${pendingOrders.supplyPrice}, 0)), 0)`));

      const byProdStartStr = startDate || '1970-01-01';
      const byProdEndStr = endDate || '2099-12-31';

      const dsProductConditions: any[] = [
        gte(directSales.saleDate, byProdStartStr),
        lte(directSales.saleDate, byProdEndStr),
      ];
      if (categoryLarge && categoryLarge.trim()) dsProductConditions.push(eq(directSales.categoryL, categoryLarge.trim()));
      if (categoryMedium && categoryMedium.trim()) dsProductConditions.push(eq(directSales.categoryM, categoryMedium.trim()));
      if (categorySmall && categorySmall.trim()) dsProductConditions.push(eq(directSales.categoryS, categorySmall.trim()));
      if (search && search.trim()) {
        dsProductConditions.push(or(
          ilike(directSales.productName, `%${search.trim()}%`),
          ilike(directSales.productCode, `%${search.trim()}%`),
          ilike(directSales.description, `%${search.trim()}%`),
        ));
      }
      if (vendorFilter === 'self' || !vendorFilter || vendorFilter === 'all' || vendorFilter === '') {
      } else {
        dsProductConditions.push(sql`1=0`);
      }

      const dsProducts = await db.select({
        productCode: directSales.productCode,
        productName: sql<string>`COALESCE(${directSales.productName}, ${directSales.description})`.as('product_name_resolved'),
        categoryL: directSales.categoryL,
        categoryM: directSales.categoryM,
        categoryS: directSales.categoryS,
        quantity: sql<number>`COALESCE(SUM(${directSales.quantity}), COUNT(*))`.as('quantity'),
        revenue: sql<number>`COALESCE(SUM(${directSales.amount}), 0)`.as('revenue'),
      }).from(directSales)
        .where(and(...dsProductConditions))
        .groupBy(directSales.productCode, sql`COALESCE(${directSales.productName}, ${directSales.description})`, directSales.categoryL, directSales.categoryM, directSales.categoryS);

      const productMap = new Map<string, { productCode: string | null; productName: string | null; categoryLarge: string; categoryMedium: string; categorySmall: string; quantity: number; revenue: number; vendorName: string; source: string }>();
      for (const p of products) {
        const key = `member_${p.productCode}_${p.fulfillmentType || 'self'}`;
        productMap.set(key, {
          productCode: p.productCode,
          productName: p.productName,
          categoryLarge: p.categoryLarge || '',
          categoryMedium: p.categoryMedium || '',
          categorySmall: p.categorySmall || '',
          quantity: Number(p.quantity),
          revenue: Number(p.revenue),
          vendorName: (p.fulfillmentType === 'vendor' && p.vendorName) ? p.vendorName : '탑셀러',
          source: 'member',
        });
      }
      let dsIdx = 0;
      for (const p of dsProducts) {
        dsIdx++;
        if (p.productCode) {
          const memberKey = `member_${p.productCode}_self`;
          const existing = productMap.get(memberKey);
          if (existing) {
            existing.revenue += Number(p.revenue);
            existing.quantity += Number(p.quantity);
            continue;
          }
        }
        const uniqueKey = `direct_${p.productCode || ''}_${p.productName || ''}_${dsIdx}`;
        productMap.set(uniqueKey, {
          productCode: p.productCode,
          productName: p.productName || p.productCode || '기타(직접매출)',
          categoryLarge: p.categoryL || '',
          categoryMedium: p.categoryM || '',
          categorySmall: p.categoryS || '',
          quantity: Number(p.quantity),
          revenue: Number(p.revenue),
          vendorName: '직접매출',
          source: 'direct',
        });
      }

      const allProducts = Array.from(productMap.values()).sort((a, b) => b.revenue - a.revenue);
      const totalRevenue = allProducts.reduce((sum, p) => sum + p.revenue, 0);

      const baseCatConditions: any[] = [
        eq(pendingOrders.status, '배송중'),
        eq(pendingOrders.priceConfirmed, true),
        gte(pendingOrders.updatedAt, startUTC),
        lte(pendingOrders.updatedAt, endUTC),
      ];

      const largeCategories = await db.selectDistinct({ value: pendingOrders.categoryLarge })
        .from(pendingOrders)
        .where(and(...baseCatConditions, isNotNull(pendingOrders.categoryLarge)));
      const dsLargeCategories = await db.selectDistinct({ value: directSales.categoryL })
        .from(directSales)
        .where(and(gte(directSales.saleDate, byProdStartStr), lte(directSales.saleDate, byProdEndStr), isNotNull(directSales.categoryL)));
      const allLarge = [...new Set([...largeCategories.map(c => c.value), ...dsLargeCategories.map(c => c.value)].filter(Boolean))] as string[];

      const mediumConditions = [...baseCatConditions, isNotNull(pendingOrders.categoryMedium)];
      if (categoryLarge && categoryLarge.trim()) mediumConditions.push(eq(pendingOrders.categoryLarge, categoryLarge.trim()));
      const mediumCategories = await db.selectDistinct({ value: pendingOrders.categoryMedium })
        .from(pendingOrders)
        .where(and(...mediumConditions));
      const dsMedConditions: any[] = [gte(directSales.saleDate, byProdStartStr), lte(directSales.saleDate, byProdEndStr), isNotNull(directSales.categoryM)];
      if (categoryLarge && categoryLarge.trim()) dsMedConditions.push(eq(directSales.categoryL, categoryLarge.trim()));
      const dsMediumCategories = await db.selectDistinct({ value: directSales.categoryM })
        .from(directSales)
        .where(and(...dsMedConditions));
      const allMedium = [...new Set([...mediumCategories.map(c => c.value), ...dsMediumCategories.map(c => c.value)].filter(Boolean))] as string[];

      const smallConditions = [...baseCatConditions, isNotNull(pendingOrders.categorySmall)];
      if (categoryLarge && categoryLarge.trim()) smallConditions.push(eq(pendingOrders.categoryLarge, categoryLarge.trim()));
      if (categoryMedium && categoryMedium.trim()) smallConditions.push(eq(pendingOrders.categoryMedium, categoryMedium.trim()));
      const smallCategories = await db.selectDistinct({ value: pendingOrders.categorySmall })
        .from(pendingOrders)
        .where(and(...smallConditions));
      const dsSmConditions: any[] = [gte(directSales.saleDate, byProdStartStr), lte(directSales.saleDate, byProdEndStr), isNotNull(directSales.categoryS)];
      if (categoryLarge && categoryLarge.trim()) dsSmConditions.push(eq(directSales.categoryL, categoryLarge.trim()));
      if (categoryMedium && categoryMedium.trim()) dsSmConditions.push(eq(directSales.categoryM, categoryMedium.trim()));
      const dsSmallCategories = await db.selectDistinct({ value: directSales.categoryS })
        .from(directSales)
        .where(and(...dsSmConditions));
      const allSmall = [...new Set([...smallCategories.map(c => c.value), ...dsSmallCategories.map(c => c.value)].filter(Boolean))] as string[];

      res.json({
        products: allProducts,
        totalRevenue,
        categories: {
          large: allLarge,
          medium: allMedium,
          small: allSmall,
        },
        vendorList: await db.select({ id: vendors.id, companyName: vendors.companyName }).from(vendors).where(eq(vendors.isActive, true)).orderBy(vendors.companyName),
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/admin/statistics/by-product/export', async (req, res) => {
    try {
      if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
      const user = await storage.getUser(req.session.userId);
      if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
        return res.status(403).json({ message: "권한이 없습니다" });
      }
      const { startDate, endDate, search, categoryLarge, categoryMedium, categorySmall, vendorFilter } = req.query as {
        startDate?: string; endDate?: string; search?: string;
        categoryLarge?: string; categoryMedium?: string; categorySmall?: string; vendorFilter?: string;
      };
      const { startUTC, endUTC } = parseDateRangeKST(startDate, endDate);
      const conditions: any[] = [
        eq(pendingOrders.status, '배송중'),
        eq(pendingOrders.priceConfirmed, true),
        gte(pendingOrders.updatedAt, startUTC),
        lte(pendingOrders.updatedAt, endUTC),
      ];
      if (categoryLarge && categoryLarge.trim()) conditions.push(eq(pendingOrders.categoryLarge, categoryLarge.trim()));
      if (categoryMedium && categoryMedium.trim()) conditions.push(eq(pendingOrders.categoryMedium, categoryMedium.trim()));
      if (categorySmall && categorySmall.trim()) conditions.push(eq(pendingOrders.categorySmall, categorySmall.trim()));
      if (search && search.trim()) {
        conditions.push(sql`${pendingOrders.productName} ILIKE ${'%' + search.trim() + '%'}`);
      }
      if (vendorFilter === 'self') {
        conditions.push(or(sql`${pendingOrders.fulfillmentType} = 'self'`, sql`${pendingOrders.fulfillmentType} IS NULL`)!);
      } else if (vendorFilter && vendorFilter.trim()) {
        conditions.push(eq(pendingOrders.vendorId, parseInt(vendorFilter)));
      }
      const rows = await db.select({
        productCode: pendingOrders.productCode,
        productName: pendingOrders.productName,
        categoryLarge: pendingOrders.categoryLarge,
        categoryMedium: pendingOrders.categoryMedium,
        categorySmall: pendingOrders.categorySmall,
        revenue: sql<number>`COALESCE(SUM(COALESCE(${pendingOrders.supplyPrice}, 0)), 0)`,
        quantity: sql<number>`COUNT(*)`,
        vendorId: pendingOrders.vendorId,
        fulfillmentType: pendingOrders.fulfillmentType,
      }).from(pendingOrders)
        .where(and(...conditions))
        .groupBy(pendingOrders.productCode, pendingOrders.productName, pendingOrders.categoryLarge, pendingOrders.categoryMedium, pendingOrders.categorySmall, pendingOrders.vendorId, pendingOrders.fulfillmentType)
        .orderBy(sql`COALESCE(SUM(COALESCE(${pendingOrders.supplyPrice}, 0)), 0) DESC`);
      const allVendors = await db.select({ id: vendors.id, companyName: vendors.companyName }).from(vendors);
      const vendorMap = new Map(allVendors.map(v => [v.id, v.companyName]));
      const totalRevenue = rows.reduce((s, r) => s + Number(r.revenue || 0), 0);
      const XLSX = await import('xlsx');
      const wsData = [
        [`조회기간: ${startDate || '전체'} ~ ${endDate || '전체'}`],
        ['순위', '상품코드', '상품명', '대분류', '중분류', '소분류', '공급처', '판매수량', '매출액', '매출비중(%)'],
        ...rows.map((r, i) => {
          const rev = Number(r.revenue || 0);
          const share = totalRevenue > 0 ? Number(((rev / totalRevenue) * 100).toFixed(1)) : 0;
          const vName = (!r.fulfillmentType || r.fulfillmentType === 'self') ? '탑셀러' : (r.vendorId ? (vendorMap.get(r.vendorId) || '외부') : '탑셀러');
          return [i + 1, r.productCode || '', r.productName || '', r.categoryLarge || '', r.categoryMedium || '', r.categorySmall || '', vName, Number(r.quantity || 0), rev, share];
        }),
      ];
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, '상품별매출');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      const koreanFileName = `상품별매출_${startDate || '전체'}_${endDate || '전체'}.xlsx`;
      const encodedFileName = encodeURIComponent(koreanFileName);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${encodedFileName}"; filename*=UTF-8''${encodedFileName}`);
      res.send(buf);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/admin/statistics/by-product/:productCode', async (req, res) => {
    try {
      if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
      const user = await storage.getUser(req.session.userId);
      if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
        return res.status(403).json({ message: "권한이 없습니다" });
      }

      const { productCode } = req.params;
      const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
      const { startUTC, endUTC } = parseDateRangeKST(startDate, endDate);

      const baseConditions = [
        eq(pendingOrders.status, '배송중'),
        eq(pendingOrders.priceConfirmed, true),
        eq(pendingOrders.productCode, productCode),
        gte(pendingOrders.updatedAt, startUTC),
        lte(pendingOrders.updatedAt, endUTC),
      ];

      const [productInfo] = await db.select({
        productCode: pendingOrders.productCode,
        productName: pendingOrders.productName,
      }).from(pendingOrders)
        .where(eq(pendingOrders.productCode, productCode))
        .limit(1);

      const dateBucket = sql`TO_CHAR(${pendingOrders.updatedAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD')`;

      const trend = await db.select({
        date: dateBucket.as('date'),
        revenue: sql<number>`COALESCE(SUM(COALESCE(${pendingOrders.supplyPrice}, 0)), 0)`.as('revenue'),
        orders: sql<number>`COUNT(*)`.as('orders'),
      }).from(pendingOrders)
        .where(and(...baseConditions))
        .groupBy(dateBucket)
        .orderBy(dateBucket);

      const memberStats = await db.select({
        memberId: pendingOrders.memberId,
        companyName: pendingOrders.memberCompanyName,
        revenue: sql<number>`COALESCE(SUM(COALESCE(${pendingOrders.supplyPrice}, 0)), 0)`.as('revenue'),
        quantity: sql<number>`COUNT(*)`.as('quantity'),
      }).from(pendingOrders)
        .where(and(...baseConditions))
        .groupBy(pendingOrders.memberId, pendingOrders.memberCompanyName)
        .orderBy(desc(sql`COALESCE(SUM(COALESCE(${pendingOrders.supplyPrice}, 0)), 0)`));

      res.json({
        product: productInfo ? { productCode: productInfo.productCode, productName: productInfo.productName } : { productCode, productName: '' },
        trend: trend.map(t => ({ date: t.date, revenue: Number(t.revenue), orders: Number(t.orders) })),
        members: memberStats.map(m => ({ memberId: m.memberId, companyName: m.companyName, revenue: Number(m.revenue), quantity: Number(m.quantity) })),
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/admin/statistics/orders/export', async (req, res) => {
    try {
      if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
      const user = await storage.getUser(req.session.userId);
      if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
        return res.status(403).json({ message: "권한이 없습니다" });
      }

      const { startDate, endDate, memberId, productCode, date: specificDate } = req.query as {
        startDate?: string; endDate?: string; memberId?: string; productCode?: string; date?: string;
      };
      const { startUTC, endUTC } = parseDateRangeKST(startDate, endDate);

      const conditions: any[] = [
        eq(pendingOrders.status, '배송중'),
        eq(pendingOrders.priceConfirmed, true),
        gte(pendingOrders.updatedAt, startUTC),
        lte(pendingOrders.updatedAt, endUTC),
      ];

      if (memberId && memberId.trim()) conditions.push(eq(pendingOrders.memberId, memberId.trim()));
      if (productCode && productCode.trim()) conditions.push(eq(pendingOrders.productCode, productCode.trim()));
      if (specificDate && specificDate.trim()) {
        const { startUTC: dayStart, endUTC: dayEnd } = parseDateRangeKST(specificDate.trim(), specificDate.trim());
        conditions.push(gte(pendingOrders.updatedAt, dayStart));
        conditions.push(lte(pendingOrders.updatedAt, dayEnd));
      }

      const allOrders = await db.select({
        id: pendingOrders.id,
        orderNumber: pendingOrders.orderNumber,
        memberId: pendingOrders.memberId,
        memberCompanyName: pendingOrders.memberCompanyName,
        productName: pendingOrders.productName,
        productCode: pendingOrders.productCode,
        supplyPrice: pendingOrders.supplyPrice,
        status: pendingOrders.status,
        trackingNumber: pendingOrders.trackingNumber,
        courierCompany: pendingOrders.courierCompany,
        updatedAt: pendingOrders.updatedAt,
        createdAt: pendingOrders.createdAt,
      }).from(pendingOrders)
        .where(and(...conditions))
        .orderBy(asc(pendingOrders.updatedAt));

      try {
        const XLSX = await import('xlsx');
        const wsData = [
          ['ID', '주문번호', '회원ID', '업체명', '상품명', '상품코드', '공급가', '상태', '운송장번호', '택배사', '수정일', '등록일'],
          ...allOrders.map(o => [
            o.id, o.orderNumber, o.memberId, o.memberCompanyName, o.productName, o.productCode,
            o.supplyPrice || 0, o.status, o.trackingNumber || '', o.courierCompany || '',
            o.updatedAt ? new Date(o.updatedAt).toISOString() : '', o.createdAt ? new Date(o.createdAt).toISOString() : '',
          ]),
        ];
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, '매출데이터');
        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=statistics_orders.xlsx');
        res.send(buf);
      } catch {
        const csvRows = [
          'ID,주문번호,회원ID,업체명,상품명,상품코드,공급가,상태,운송장번호,택배사,수정일,등록일',
          ...allOrders.map(o =>
            [o.id, o.orderNumber, o.memberId, o.memberCompanyName, o.productName, o.productCode,
              o.supplyPrice || 0, o.status, o.trackingNumber || '', o.courierCompany || '',
              o.updatedAt ? new Date(o.updatedAt).toISOString() : '', o.createdAt ? new Date(o.createdAt).toISOString() : '']
              .map(v => `"${String(v).replace(/"/g, '""')}"`)
              .join(',')
          ),
        ];
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename=statistics_orders.csv');
        res.send('\uFEFF' + csvRows.join('\n'));
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/admin/statistics/orders/:orderId', async (req, res) => {
    try {
      if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
      const user = await storage.getUser(req.session.userId);
      if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
        return res.status(403).json({ message: "권한이 없습니다" });
      }

      const { orderId } = req.params;
      const [order] = await db.select().from(pendingOrders).where(eq(pendingOrders.id, orderId));
      if (!order) {
        return res.status(404).json({ message: "주문을 찾을 수 없습니다" });
      }

      const settlements = await db.select().from(settlementHistory).where(eq(settlementHistory.orderId, orderId)).limit(1);
      const settlement = settlements.length > 0 ? settlements[0] : null;

      res.json({ order, settlement });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/admin/statistics/orders', async (req, res) => {
    try {
      if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
      const user = await storage.getUser(req.session.userId);
      if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
        return res.status(403).json({ message: "권한이 없습니다" });
      }

      const { startDate, endDate, memberId, productCode, date: specificDate, page: pageStr, limit: limitStr } = req.query as {
        startDate?: string; endDate?: string; memberId?: string; productCode?: string; date?: string; page?: string; limit?: string;
      };
      const { startUTC, endUTC } = parseDateRangeKST(startDate, endDate);

      const conditions: any[] = [
        eq(pendingOrders.status, '배송중'),
        eq(pendingOrders.priceConfirmed, true),
        gte(pendingOrders.updatedAt, startUTC),
        lte(pendingOrders.updatedAt, endUTC),
      ];

      if (memberId && memberId.trim()) conditions.push(eq(pendingOrders.memberId, memberId.trim()));
      if (productCode && productCode.trim()) conditions.push(eq(pendingOrders.productCode, productCode.trim()));
      if (specificDate && specificDate.trim()) {
        const { startUTC: dayStart, endUTC: dayEnd } = parseDateRangeKST(specificDate.trim(), specificDate.trim());
        conditions.push(gte(pendingOrders.updatedAt, dayStart));
        conditions.push(lte(pendingOrders.updatedAt, dayEnd));
      }

      const page = Math.max(1, parseInt(pageStr || '1') || 1);
      const limit = Math.max(1, Math.min(100, parseInt(limitStr || '20') || 20));
      const offset = (page - 1) * limit;

      const whereClause = and(...conditions);

      const [orderRows, countResult] = await Promise.all([
        db.select({
          id: pendingOrders.id,
          orderNumber: pendingOrders.orderNumber,
          memberId: pendingOrders.memberId,
          memberCompanyName: pendingOrders.memberCompanyName,
          productName: pendingOrders.productName,
          productCode: pendingOrders.productCode,
          supplyPrice: pendingOrders.supplyPrice,
          status: pendingOrders.status,
          trackingNumber: pendingOrders.trackingNumber,
          courierCompany: pendingOrders.courierCompany,
          updatedAt: pendingOrders.updatedAt,
          createdAt: pendingOrders.createdAt,
        }).from(pendingOrders)
          .where(whereClause)
          .orderBy(asc(pendingOrders.updatedAt))
          .limit(limit)
          .offset(offset),
        db.select({ count: sql<number>`count(*)` }).from(pendingOrders).where(whereClause),
      ]);

      res.json({
        orders: orderRows,
        total: Number(countResult[0].count),
        page,
        limit,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ===== Member Statistics API Endpoints =====

  app.get('/api/member/statistics/overview', async (req, res) => {
    try {
      if (!req.session.userId || req.session.userType !== "member") {
        return res.status(401).json({ message: "회원 로그인이 필요합니다" });
      }
      const memberId = req.session.userId;
      const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
      const { startUTC, endUTC } = parseDateRangeKST(startDate, endDate);

      const baseConditions = [
        eq(pendingOrders.status, '배송중'),
        eq(pendingOrders.priceConfirmed, true),
        eq(pendingOrders.memberId, memberId),
        gte(pendingOrders.updatedAt, startUTC),
        lte(pendingOrders.updatedAt, endUTC),
      ];

      const [summaryResult] = await db.select({
        totalRevenue: sql<number>`COALESCE(SUM(COALESCE(${pendingOrders.supplyPrice}, 0)), 0)`,
        totalOrders: sql<number>`COUNT(*)`,
        productCount: sql<number>`COUNT(DISTINCT ${pendingOrders.productCode})`,
      }).from(pendingOrders).where(and(...baseConditions));

      const totalRevenue = Number(summaryResult.totalRevenue);
      const totalOrders = Number(summaryResult.totalOrders);
      const avgOrderAmount = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
      const productCount = Number(summaryResult.productCount);

      const duration = endUTC.getTime() - startUTC.getTime();
      const prevStart = new Date(startUTC.getTime() - duration);
      const prevEnd = startUTC;

      const prevConditions = [
        eq(pendingOrders.status, '배송중'),
        eq(pendingOrders.priceConfirmed, true),
        eq(pendingOrders.memberId, memberId),
        gte(pendingOrders.updatedAt, prevStart),
        lte(pendingOrders.updatedAt, prevEnd),
      ];

      const [prevResult] = await db.select({
        prevRevenue: sql<number>`COALESCE(SUM(COALESCE(${pendingOrders.supplyPrice}, 0)), 0)`,
        prevOrders: sql<number>`COUNT(*)`,
      }).from(pendingOrders).where(and(...prevConditions));

      const prevRevenue = Number(prevResult.prevRevenue);
      const prevOrders = Number(prevResult.prevOrders);
      const revenueGrowth = prevRevenue > 0 ? Math.round(((totalRevenue - prevRevenue) / prevRevenue) * 10000) / 100 : 0;
      const ordersGrowth = prevOrders > 0 ? Math.round(((totalOrders - prevOrders) / prevOrders) * 10000) / 100 : 0;

      const daysDiff = Math.ceil(duration / (1000 * 60 * 60 * 24));
      let dateBucket: ReturnType<typeof sql>;
      if (daysDiff <= 31) {
        dateBucket = sql`TO_CHAR(${pendingOrders.updatedAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD')`;
      } else if (daysDiff <= 90) {
        dateBucket = sql`TO_CHAR(DATE_TRUNC('week', ${pendingOrders.updatedAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul'), 'YYYY-MM-DD')`;
      } else {
        dateBucket = sql`TO_CHAR(DATE_TRUNC('month', ${pendingOrders.updatedAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul'), 'YYYY-MM-DD')`;
      }

      const trend = await db.select({
        date: dateBucket.as('date'),
        revenue: sql<number>`COALESCE(SUM(COALESCE(${pendingOrders.supplyPrice}, 0)), 0)`.as('revenue'),
        orders: sql<number>`COUNT(*)`.as('orders'),
      }).from(pendingOrders)
        .where(and(...baseConditions))
        .groupBy(dateBucket)
        .orderBy(dateBucket);

      const topProducts = await db.select({
        productName: pendingOrders.productName,
        productCode: pendingOrders.productCode,
        revenue: sql<number>`COALESCE(SUM(COALESCE(${pendingOrders.supplyPrice}, 0)), 0)`.as('revenue'),
        quantity: sql<number>`COUNT(*)`.as('quantity'),
      }).from(pendingOrders)
        .where(and(...baseConditions))
        .groupBy(pendingOrders.productCode, pendingOrders.productName)
        .orderBy(desc(sql`COALESCE(SUM(COALESCE(${pendingOrders.supplyPrice}, 0)), 0)`))
        .limit(10);

      res.json({
        summary: {
          totalRevenue,
          totalOrders,
          avgOrderAmount,
          productCount,
          prevRevenue,
          prevOrders,
          revenueGrowth,
          ordersGrowth,
        },
        trend: trend.map(t => ({ date: t.date, revenue: Number(t.revenue), orders: Number(t.orders) })),
        topProducts: topProducts.map(p => ({ productName: p.productName, productCode: p.productCode, revenue: Number(p.revenue), quantity: Number(p.quantity) })),
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/member/statistics/by-product', async (req, res) => {
    try {
      if (!req.session.userId || req.session.userType !== "member") {
        return res.status(401).json({ message: "회원 로그인이 필요합니다" });
      }
      const memberId = req.session.userId;
      const { startDate, endDate, categoryLarge, categoryMedium, categorySmall, search } = req.query as {
        startDate?: string; endDate?: string; categoryLarge?: string; categoryMedium?: string; categorySmall?: string; search?: string;
      };
      const { startUTC, endUTC } = parseDateRangeKST(startDate, endDate);

      const conditions: any[] = [
        eq(pendingOrders.status, '배송중'),
        eq(pendingOrders.priceConfirmed, true),
        eq(pendingOrders.memberId, memberId),
        gte(pendingOrders.updatedAt, startUTC),
        lte(pendingOrders.updatedAt, endUTC),
      ];

      if (categoryLarge && categoryLarge.trim()) conditions.push(eq(pendingOrders.categoryLarge, categoryLarge.trim()));
      if (categoryMedium && categoryMedium.trim()) conditions.push(eq(pendingOrders.categoryMedium, categoryMedium.trim()));
      if (categorySmall && categorySmall.trim()) conditions.push(eq(pendingOrders.categorySmall, categorySmall.trim()));
      if (search && search.trim()) {
        conditions.push(or(
          ilike(pendingOrders.productName, `%${search.trim()}%`),
          ilike(pendingOrders.productCode, `%${search.trim()}%`),
        ));
      }

      const products = await db.select({
        productCode: pendingOrders.productCode,
        productName: pendingOrders.productName,
        categoryLarge: pendingOrders.categoryLarge,
        categoryMedium: pendingOrders.categoryMedium,
        categorySmall: pendingOrders.categorySmall,
        quantity: sql<number>`COUNT(*)`.as('quantity'),
        revenue: sql<number>`COALESCE(SUM(COALESCE(${pendingOrders.supplyPrice}, 0)), 0)`.as('revenue'),
      }).from(pendingOrders)
        .where(and(...conditions))
        .groupBy(pendingOrders.productCode, pendingOrders.productName, pendingOrders.categoryLarge, pendingOrders.categoryMedium, pendingOrders.categorySmall)
        .orderBy(desc(sql`COALESCE(SUM(COALESCE(${pendingOrders.supplyPrice}, 0)), 0)`));

      const totalRevenue = products.reduce((sum, p) => sum + Number(p.revenue), 0);

      const baseCatConditions: any[] = [
        eq(pendingOrders.status, '배송중'),
        eq(pendingOrders.priceConfirmed, true),
        eq(pendingOrders.memberId, memberId),
        gte(pendingOrders.updatedAt, startUTC),
        lte(pendingOrders.updatedAt, endUTC),
      ];

      const largeCategories = await db.selectDistinct({ value: pendingOrders.categoryLarge })
        .from(pendingOrders)
        .where(and(...baseCatConditions, isNotNull(pendingOrders.categoryLarge)));

      const mediumConditions = [...baseCatConditions, isNotNull(pendingOrders.categoryMedium)];
      if (categoryLarge && categoryLarge.trim()) mediumConditions.push(eq(pendingOrders.categoryLarge, categoryLarge.trim()));
      const mediumCategories = await db.selectDistinct({ value: pendingOrders.categoryMedium })
        .from(pendingOrders)
        .where(and(...mediumConditions));

      const smallConditions = [...baseCatConditions, isNotNull(pendingOrders.categorySmall)];
      if (categoryLarge && categoryLarge.trim()) smallConditions.push(eq(pendingOrders.categoryLarge, categoryLarge.trim()));
      if (categoryMedium && categoryMedium.trim()) smallConditions.push(eq(pendingOrders.categoryMedium, categoryMedium.trim()));
      const smallCategories = await db.selectDistinct({ value: pendingOrders.categorySmall })
        .from(pendingOrders)
        .where(and(...smallConditions));

      res.json({
        products: products.map(p => ({
          productCode: p.productCode,
          productName: p.productName,
          categoryLarge: p.categoryLarge || '',
          categoryMedium: p.categoryMedium || '',
          categorySmall: p.categorySmall || '',
          quantity: Number(p.quantity),
          revenue: Number(p.revenue),
        })),
        totalRevenue,
        categories: {
          large: largeCategories.map(c => c.value).filter(Boolean) as string[],
          medium: mediumCategories.map(c => c.value).filter(Boolean) as string[],
          small: smallCategories.map(c => c.value).filter(Boolean) as string[],
        },
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/member/statistics/by-product/export', async (req, res) => {
    try {
      if (!req.session.userId || req.session.userType !== "member") {
        return res.status(401).json({ message: "회원 로그인이 필요합니다" });
      }
      const memberId = req.session.userId;
      const { startDate, endDate, search, categoryLarge, categoryMedium, categorySmall } = req.query as {
        startDate?: string; endDate?: string; search?: string;
        categoryLarge?: string; categoryMedium?: string; categorySmall?: string;
      };
      const { startUTC, endUTC } = parseDateRangeKST(startDate, endDate);
      const conditions: any[] = [
        eq(pendingOrders.status, '배송중'),
        eq(pendingOrders.priceConfirmed, true),
        eq(pendingOrders.memberId, memberId),
        gte(pendingOrders.updatedAt, startUTC),
        lte(pendingOrders.updatedAt, endUTC),
      ];
      if (categoryLarge && categoryLarge.trim()) conditions.push(eq(pendingOrders.categoryLarge, categoryLarge.trim()));
      if (categoryMedium && categoryMedium.trim()) conditions.push(eq(pendingOrders.categoryMedium, categoryMedium.trim()));
      if (categorySmall && categorySmall.trim()) conditions.push(eq(pendingOrders.categorySmall, categorySmall.trim()));
      if (search && search.trim()) {
        conditions.push(sql`${pendingOrders.productName} ILIKE ${'%' + search.trim() + '%'}`);
      }
      const rows = await db.select({
        productCode: pendingOrders.productCode,
        productName: pendingOrders.productName,
        categoryLarge: pendingOrders.categoryLarge,
        categoryMedium: pendingOrders.categoryMedium,
        categorySmall: pendingOrders.categorySmall,
        revenue: sql<number>`COALESCE(SUM(COALESCE(${pendingOrders.supplyPrice}, 0)), 0)`,
        quantity: sql<number>`COUNT(*)`,
      }).from(pendingOrders)
        .where(and(...conditions))
        .groupBy(pendingOrders.productCode, pendingOrders.productName, pendingOrders.categoryLarge, pendingOrders.categoryMedium, pendingOrders.categorySmall)
        .orderBy(sql`COALESCE(SUM(COALESCE(${pendingOrders.supplyPrice}, 0)), 0) DESC`);
      const totalRevenue = rows.reduce((s, r) => s + Number(r.revenue || 0), 0);
      const XLSX = await import('xlsx');
      const wsData = [
        [`조회기간: ${startDate || '전체'} ~ ${endDate || '전체'}`],
        ['순위', '상품코드', '상품명', '대분류', '중분류', '소분류', '구매수량', '매입금액', '매입비중(%)'],
        ...rows.map((r, i) => {
          const rev = Number(r.revenue || 0);
          const share = totalRevenue > 0 ? Number(((rev / totalRevenue) * 100).toFixed(1)) : 0;
          return [i + 1, r.productCode || '', r.productName || '', r.categoryLarge || '', r.categoryMedium || '', r.categorySmall || '', Number(r.quantity || 0), rev, share];
        }),
      ];
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, '상품별매입');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      const koreanFileName = `상품별매입_${startDate || '전체'}_${endDate || '전체'}.xlsx`;
      const encodedFileName = encodeURIComponent(koreanFileName);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${encodedFileName}"; filename*=UTF-8''${encodedFileName}`);
      res.send(buf);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/member/statistics/by-product/:productCode', async (req, res) => {
    try {
      if (!req.session.userId || req.session.userType !== "member") {
        return res.status(401).json({ message: "회원 로그인이 필요합니다" });
      }
      const memberId = req.session.userId;
      const { productCode } = req.params;
      const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
      const { startUTC, endUTC } = parseDateRangeKST(startDate, endDate);

      const baseConditions = [
        eq(pendingOrders.status, '배송중'),
        eq(pendingOrders.priceConfirmed, true),
        eq(pendingOrders.memberId, memberId),
        eq(pendingOrders.productCode, productCode),
        gte(pendingOrders.updatedAt, startUTC),
        lte(pendingOrders.updatedAt, endUTC),
      ];

      const dateBucket = sql`TO_CHAR(${pendingOrders.updatedAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD')`;

      const trend = await db.select({
        date: dateBucket.as('date'),
        revenue: sql<number>`COALESCE(SUM(COALESCE(${pendingOrders.supplyPrice}, 0)), 0)`.as('revenue'),
        orders: sql<number>`COUNT(*)`.as('orders'),
      }).from(pendingOrders)
        .where(and(...baseConditions))
        .groupBy(dateBucket)
        .orderBy(dateBucket);

      res.json({
        trend: trend.map(t => ({ date: t.date, revenue: Number(t.revenue), orders: Number(t.orders) })),
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/member/statistics/orders', async (req, res) => {
    try {
      if (!req.session.userId || req.session.userType !== "member") {
        return res.status(401).json({ message: "회원 로그인이 필요합니다" });
      }
      const memberId = req.session.userId;
      const { startDate, endDate, productCode, page: pageStr, limit: limitStr } = req.query as {
        startDate?: string; endDate?: string; productCode?: string; page?: string; limit?: string;
      };
      const { startUTC, endUTC } = parseDateRangeKST(startDate, endDate);

      const conditions: any[] = [
        eq(pendingOrders.status, '배송중'),
        eq(pendingOrders.priceConfirmed, true),
        eq(pendingOrders.memberId, memberId),
        gte(pendingOrders.updatedAt, startUTC),
        lte(pendingOrders.updatedAt, endUTC),
      ];

      if (productCode && productCode.trim()) conditions.push(eq(pendingOrders.productCode, productCode.trim()));

      const page = Math.max(1, parseInt(pageStr || '1') || 1);
      const limit = Math.max(1, Math.min(100, parseInt(limitStr || '20') || 20));
      const offset = (page - 1) * limit;

      const whereClause = and(...conditions);

      const [orderRows, countResult] = await Promise.all([
        db.select({
          id: pendingOrders.id,
          orderNumber: pendingOrders.orderNumber,
          productName: pendingOrders.productName,
          productCode: pendingOrders.productCode,
          supplyPrice: pendingOrders.supplyPrice,
          recipientName: pendingOrders.recipientName,
          recipientAddress: pendingOrders.recipientAddress,
          trackingNumber: pendingOrders.trackingNumber,
          courierCompany: pendingOrders.courierCompany,
          updatedAt: pendingOrders.updatedAt,
          createdAt: pendingOrders.createdAt,
        }).from(pendingOrders)
          .where(whereClause)
          .orderBy(desc(pendingOrders.updatedAt))
          .limit(limit)
          .offset(offset),
        db.select({ count: sql<number>`count(*)` }).from(pendingOrders).where(whereClause),
      ]);

      res.json({
        orders: orderRows,
        total: Number(countResult[0].count),
        page,
        limit,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ========================================
  // 회계장부 API - Accounting System
  // ========================================

  const requireAccountingAdmin = async (req: any, res: any): Promise<boolean> => {
    if (!req.session.userId) { res.status(401).json({ message: "Not authenticated" }); return false; }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) { res.status(403).json({ message: "권한이 없습니다" }); return false; }
    return true;
  };

  // ========================================
  // 공급업체 통합 관리 APIs (외주업체 + 직접 공급업체)
  // ========================================

  // POST /api/admin/accounting/suppliers - 직접 공급업체 등록
  app.post('/api/admin/accounting/suppliers', async (req, res) => {
    try {
      if (!(await requireAccountingAdmin(req, res))) return;
      const { name, representative, businessNumber, phone, email, address, supplyType, supplyItems, paymentMethod, bankName, accountNumber, accountHolder, memo, linkedVendorId } = req.body;

      if (!name || !name.trim()) return res.status(400).json({ message: "업체명은 필수입니다" });
      if (!supplyType || !Array.isArray(supplyType) || supplyType.length === 0) return res.status(400).json({ message: "공급 유형을 1개 이상 선택해주세요" });

      if (linkedVendorId) {
        const existing = await db.select({ id: suppliers.id }).from(suppliers).where(and(eq(suppliers.linkedVendorId, linkedVendorId), eq(suppliers.isActive, true)));
        if (existing.length > 0) return res.status(400).json({ message: "이미 다른 공급업체에 연결된 외주업체입니다" });
      }

      const [created] = await db.insert(suppliers).values({
        name: name.trim(),
        representative: representative || null,
        businessNumber: businessNumber || null,
        phone: phone || null,
        email: email || null,
        address: address || null,
        supplyType: supplyType,
        supplyItems: supplyItems || null,
        paymentMethod: paymentMethod || null,
        bankName: bankName || null,
        accountNumber: accountNumber || null,
        accountHolder: accountHolder || null,
        memo: memo || null,
        linkedVendorId: linkedVendorId || null,
      }).returning();

      res.json(created);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // PUT /api/admin/accounting/suppliers/:id - 직접 공급업체 수정
  app.put('/api/admin/accounting/suppliers/:id', async (req, res) => {
    try {
      if (!(await requireAccountingAdmin(req, res))) return;
      const supplierId = parseInt(req.params.id);
      const { name, representative, businessNumber, phone, email, address, supplyType, supplyItems, paymentMethod, bankName, accountNumber, accountHolder, memo, linkedVendorId } = req.body;

      if (!name || !name.trim()) return res.status(400).json({ message: "업체명은 필수입니다" });
      if (!supplyType || !Array.isArray(supplyType) || supplyType.length === 0) return res.status(400).json({ message: "공급 유형을 1개 이상 선택해주세요" });

      if (linkedVendorId) {
        const existing = await db.select({ id: suppliers.id }).from(suppliers).where(and(eq(suppliers.linkedVendorId, linkedVendorId), eq(suppliers.isActive, true), sql`${suppliers.id} != ${supplierId}`));
        if (existing.length > 0) return res.status(400).json({ message: "이미 다른 공급업체에 연결된 외주업체입니다" });
      }

      await db.update(suppliers).set({
        name: name.trim(),
        representative: representative || null,
        businessNumber: businessNumber || null,
        phone: phone || null,
        email: email || null,
        address: address || null,
        supplyType: supplyType,
        supplyItems: supplyItems || null,
        paymentMethod: paymentMethod || null,
        bankName: bankName || null,
        accountNumber: accountNumber || null,
        accountHolder: accountHolder || null,
        memo: memo || null,
        linkedVendorId: linkedVendorId || null,
        updatedAt: new Date(),
      }).where(eq(suppliers.id, supplierId));

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // DELETE /api/admin/accounting/suppliers/:id - 직접 공급업체 삭제/비활성화
  app.delete('/api/admin/accounting/suppliers/:id', async (req, res) => {
    try {
      if (!(await requireAccountingAdmin(req, res))) return;
      const supplierId = parseInt(req.params.id);

      const [hasPurchases] = await db.select({ count: sql<number>`COUNT(*)` }).from(purchases).where(eq(purchases.supplierId, supplierId));
      const [hasPayments] = await db.select({ count: sql<number>`COUNT(*)` }).from(vendorPayments).where(eq(vendorPayments.supplierId, supplierId));

      if (Number(hasPurchases.count) > 0 || Number(hasPayments.count) > 0) {
        await db.update(suppliers).set({ isActive: false, updatedAt: new Date() }).where(eq(suppliers.id, supplierId));
        res.json({ success: true, action: "deactivated" });
      } else {
        await db.delete(suppliers).where(eq(suppliers.id, supplierId));
        res.json({ success: true, action: "deleted" });
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // PUT /api/admin/accounting/vendors/:id/settings - 외주업체 회계 설정
  app.put('/api/admin/accounting/vendors/:id/settings', async (req, res) => {
    try {
      if (!(await requireAccountingAdmin(req, res))) return;
      const vendorId = parseInt(req.params.id);
      const { supplyType, businessNumber, address } = req.body;

      await db.update(vendors).set({
        supplyType: supplyType || [],
        businessNumber: businessNumber || null,
        address: address || null,
        updatedAt: new Date(),
      }).where(eq(vendors.id, vendorId));

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // GET /api/admin/accounting/vendors - 통합 공급업체 목록 (외주+직접+겸업)
  app.get('/api/admin/accounting/vendors', async (req, res) => {
    try {
      if (!(await requireAccountingAdmin(req, res))) return;

      const supplierList = await db.select().from(suppliers).where(eq(suppliers.isActive, true));
      const linkedVendorIds = new Set(supplierList.filter(s => s.linkedVendorId).map(s => s.linkedVendorId!));

      const vendorList = await db.select().from(vendors).where(eq(vendors.isActive, true)).orderBy(asc(vendors.companyName));

      const result: any[] = [];

      for (const s of supplierList) {
        let source = s.linkedVendorId ? "both" : "supplier";
        let totalPurchases = 0;
        let totalPayments = 0;

        const [supplierPurchaseSum] = await db.select({ total: sql<number>`COALESCE(SUM(total_amount), 0)` }).from(purchases).where(eq(purchases.supplierId, s.id));
        const [supplierPaymentSum] = await db.select({ total: sql<number>`COALESCE(SUM(amount), 0)` }).from(vendorPayments).where(eq(vendorPayments.supplierId, s.id));
        totalPurchases += Number(supplierPurchaseSum.total);
        totalPayments += Number(supplierPaymentSum.total);

        if (s.linkedVendorId) {
          const [vendorPurchaseSum] = await db.select({ total: sql<number>`COALESCE(SUM(total_amount), 0)` }).from(purchases).where(eq(purchases.vendorId, s.linkedVendorId));
          const [vendorPaymentSum] = await db.select({ total: sql<number>`COALESCE(SUM(amount), 0)` }).from(vendorPayments).where(eq(vendorPayments.vendorId, s.linkedVendorId));
          totalPurchases += Number(vendorPurchaseSum.total);
          totalPayments += Number(vendorPaymentSum.total);
        }

        result.push({
          id: `supplier-${s.id}`,
          source,
          vendorId: s.linkedVendorId || null,
          supplierId: s.id,
          name: s.name,
          representative: s.representative,
          phone: s.phone,
          email: s.email,
          businessNumber: s.businessNumber,
          address: s.address,
          supplyType: s.supplyType || [],
          supplyItems: s.supplyItems,
          paymentMethod: s.paymentMethod,
          bankName: s.bankName,
          accountNumber: s.accountNumber,
          accountHolder: s.accountHolder,
          memo: s.memo,
          linkedVendorId: s.linkedVendorId,
          isEditable: true,
          totalPurchases,
          totalPayments,
          outstandingBalance: totalPurchases - totalPayments,
        });
      }

      for (const v of vendorList) {
        if (linkedVendorIds.has(v.id)) continue;

        const [purchaseSum] = await db.select({ total: sql<number>`COALESCE(SUM(total_amount), 0)` }).from(purchases).where(eq(purchases.vendorId, v.id));
        const [paymentSum] = await db.select({ total: sql<number>`COALESCE(SUM(amount), 0)` }).from(vendorPayments).where(eq(vendorPayments.vendorId, v.id));
        const totalPurchases = Number(purchaseSum.total);
        const totalPayments = Number(paymentSum.total);

        result.push({
          id: `vendor-${v.id}`,
          source: "vendor",
          vendorId: v.id,
          supplierId: null,
          name: v.companyName,
          representative: v.contactName,
          phone: v.contactPhone,
          email: v.contactEmail,
          businessNumber: v.businessNumber,
          address: v.address,
          supplyType: v.supplyType || [],
          supplyItems: null,
          paymentMethod: null,
          bankName: v.bankName,
          accountNumber: v.bankAccount,
          accountHolder: v.bankHolder,
          memo: v.memo,
          linkedVendorId: null,
          isEditable: false,
          totalPurchases,
          totalPayments,
          outstandingBalance: totalPurchases - totalPayments,
        });
      }

      result.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
      const totalOutstanding = result.reduce((s, v) => s + (v.outstandingBalance || 0), 0);

      res.json({ vendors: result, totalOutstanding });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // GET /api/admin/accounting/vendors/dropdown - 매입 등록용 드롭다운
  app.get('/api/admin/accounting/vendors/dropdown', async (req, res) => {
    try {
      if (!(await requireAccountingAdmin(req, res))) return;

      const supplierList = await db.select().from(suppliers).where(eq(suppliers.isActive, true));
      const linkedVendorIds = new Set(supplierList.filter(s => s.linkedVendorId).map(s => s.linkedVendorId!));
      const vendorList = await db.select().from(vendors).where(eq(vendors.isActive, true)).orderBy(asc(vendors.companyName));

      const items: any[] = [];

      for (const v of vendorList) {
        if (linkedVendorIds.has(v.id)) continue;
        items.push({
          value: `vendor-${v.id}`,
          label: `${v.companyName} (외주)`,
          vendorId: v.id,
          supplierId: null,
          supplyType: v.supplyType || [],
        });
      }

      for (const s of supplierList) {
        const label = s.linkedVendorId ? `${s.name} (외주+공급)` : s.name;
        items.push({
          value: `supplier-${s.id}`,
          label,
          vendorId: s.linkedVendorId || null,
          supplierId: s.id,
          supplyType: s.supplyType || [],
        });
      }

      items.sort((a, b) => a.label.localeCompare(b.label, 'ko'));
      res.json({ items });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // GET /api/admin/accounting/sales-vendors/dropdown - 매출 등록용 드롭다운 (businessType이 sales 또는 both인 업체)
  app.get('/api/admin/accounting/sales-vendors/dropdown', async (req, res) => {
    try {
      if (!(await requireAccountingAdmin(req, res))) return;

      const vendorList = await db.select().from(vendors).where(
        eq(vendors.isActive, true)
      ).orderBy(asc(vendors.companyName));

      const items = vendorList.map(v => ({
        value: `vendor-${v.id}`,
        label: v.companyName,
        vendorId: v.id,
        businessType: v.businessType,
      }));

      res.json({ items });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // GET /api/admin/accounting/vendors/options - 업체 select 옵션용 (legacy, keep for compatibility)
  app.get('/api/admin/accounting/vendors/options', async (req, res) => {
    try {
      if (!(await requireAccountingAdmin(req, res))) return;
      const vendorList = await db.select({
        id: vendors.id,
        companyName: vendors.companyName,
        supplyType: vendors.supplyType,
      }).from(vendors).where(eq(vendors.isActive, true)).orderBy(asc(vendors.companyName));
      res.json(vendorList);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // GET /api/admin/accounting/unlinked-vendors - 연결 가능한 외주업체 목록
  app.get('/api/admin/accounting/unlinked-vendors', async (req, res) => {
    try {
      if (!(await requireAccountingAdmin(req, res))) return;
      const linkedIds = await db.select({ linkedVendorId: suppliers.linkedVendorId }).from(suppliers).where(and(eq(suppliers.isActive, true), sql`${suppliers.linkedVendorId} IS NOT NULL`));
      const linkedSet = new Set(linkedIds.map(l => l.linkedVendorId!));

      const vendorList = await db.select({ id: vendors.id, companyName: vendors.companyName }).from(vendors).where(eq(vendors.isActive, true)).orderBy(asc(vendors.companyName));

      const excludeId = req.query.excludeSupplierId ? parseInt(String(req.query.excludeSupplierId)) : null;
      if (excludeId) {
        const [current] = await db.select({ linkedVendorId: suppliers.linkedVendorId }).from(suppliers).where(eq(suppliers.id, excludeId));
        if (current?.linkedVendorId) linkedSet.delete(current.linkedVendorId);
      }

      res.json(vendorList.filter(v => !linkedSet.has(v.id)));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // GET /api/admin/purchases - 매입 목록 조회
  app.get('/api/admin/purchases', async (req, res) => {
    try {
      if (!(await requireAccountingAdmin(req, res))) return;
      const { startDate, endDate } = req.query;

      const conditions: any[] = [];
      if (startDate) conditions.push(gte(purchases.purchaseDate, String(startDate)));
      if (endDate) conditions.push(lte(purchases.purchaseDate, String(endDate)));

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const purchaseList = await db.select({
        id: purchases.id,
        purchaseDate: purchases.purchaseDate,
        vendorId: purchases.vendorId,
        supplierId: purchases.supplierId,
        materialType: purchases.materialType,
        productName: purchases.productName,
        quantity: purchases.quantity,
        unit: purchases.unit,
        unitPrice: purchases.unitPrice,
        totalAmount: purchases.totalAmount,
        memo: purchases.memo,
        createdAt: purchases.createdAt,
      }).from(purchases)
        .where(whereClause)
        .orderBy(asc(purchases.purchaseDate), asc(purchases.createdAt));

      const vendorMap = new Map<number, string>();
      const vendorList = await db.select({ id: vendors.id, companyName: vendors.companyName }).from(vendors);
      vendorList.forEach(v => vendorMap.set(v.id, v.companyName));

      const supplierMap = new Map<number, string>();
      const supplierList = await db.select({ id: suppliers.id, name: suppliers.name }).from(suppliers);
      supplierList.forEach(s => supplierMap.set(s.id, s.name));

      const enriched = purchaseList.map(p => ({
        ...p,
        vendorName: p.vendorId ? vendorMap.get(p.vendorId) || "알 수 없음" : p.supplierId ? supplierMap.get(p.supplierId) || "알 수 없음" : "알 수 없음",
        source: "direct" as const,
        rowType: "purchase" as const,
        paymentMethod: null as string | null,
        createdAt: p.createdAt?.toISOString() || null,
      }));

      const paymentConditions: any[] = [];
      if (startDate) paymentConditions.push(gte(vendorPayments.paymentDate, String(startDate)));
      if (endDate) paymentConditions.push(lte(vendorPayments.paymentDate, String(endDate)));
      const paymentWhereClause = paymentConditions.length > 0 ? and(...paymentConditions) : undefined;

      const paymentList = await db.select({
        id: vendorPayments.id,
        paymentDate: vendorPayments.paymentDate,
        vendorId: vendorPayments.vendorId,
        supplierId: vendorPayments.supplierId,
        amount: vendorPayments.amount,
        paymentMethod: vendorPayments.paymentMethod,
        memo: vendorPayments.memo,
        createdAt: vendorPayments.createdAt,
      }).from(vendorPayments)
        .where(paymentWhereClause)
        .orderBy(asc(vendorPayments.paymentDate), asc(vendorPayments.createdAt));

      const paymentRows = paymentList.map(p => ({
        id: p.id,
        purchaseDate: p.paymentDate,
        vendorId: p.vendorId,
        supplierId: p.supplierId,
        materialType: "",
        productName: p.memo || "결제",
        quantity: "0",
        unit: "",
        unitPrice: 0,
        totalAmount: p.amount,
        memo: p.memo,
        vendorName: p.vendorId ? vendorMap.get(p.vendorId) || "알 수 없음" : p.supplierId ? supplierMap.get(p.supplierId) || "알 수 없음" : "알 수 없음",
        source: "direct" as const,
        rowType: "payment" as const,
        paymentMethod: p.paymentMethod || "transfer",
        createdAt: p.createdAt?.toISOString() || null,
      }));

      const totalAmount = enriched.reduce((s, p) => s + p.totalAmount, 0);
      const directCount = enriched.length;
      const directAmount = totalAmount;
      const totalPaymentAmount = paymentRows.reduce((s, p) => s + p.totalAmount, 0);

      const byTypeMap = new Map<string, number>();
      enriched.forEach(p => {
        byTypeMap.set(p.materialType, (byTypeMap.get(p.materialType) || 0) + p.totalAmount);
      });
      const byType = Array.from(byTypeMap.entries()).map(([type, amount]) => ({
        type,
        amount,
        percentage: totalAmount > 0 ? Math.round(amount / totalAmount * 100) : 0,
      }));

      res.json({
        purchases: enriched,
        payments: paymentRows,
        summary: {
          totalAmount,
          directAmount,
          siteAmount: 0,
          directCount,
          siteCount: 0,
          byType,
          totalPaymentAmount,
        },
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // POST /api/admin/purchases - 매입 등록
  app.post('/api/admin/purchases', async (req, res) => {
    try {
      if (!(await requireAccountingAdmin(req, res))) return;
      const { purchaseDate, vendorId, supplierId, memo, items } = req.body;
      if (!purchaseDate || (!vendorId && !supplierId) || !items?.length) {
        return res.status(400).json({ message: "필수 항목이 누락되었습니다" });
      }

      const validMaterialTypes = ["raw", "semi", "subsidiary", "etc"];
      const insertRows = items.map((item: any) => {
        const qty = parseFloat(item.quantity);
        const price = parseInt(item.unitPrice);
        const total = parseInt(item.totalAmount);
        if (!item.productName || isNaN(qty) || qty <= 0 || isNaN(price) || price < 0 || isNaN(total)) {
          throw new Error("품목 데이터가 올바르지 않습니다");
        }
        if (!item.materialCode) {
          throw new Error("원재료 목록에서 품목을 선택해주세요");
        }
        return {
          purchaseDate,
          vendorId: vendorId ? parseInt(vendorId) : null,
          supplierId: supplierId ? parseInt(supplierId) : null,
          materialType: validMaterialTypes.includes(item.materialType) ? item.materialType : "etc",
          materialCode: item.materialCode ? String(item.materialCode).trim() : null,
          productName: String(item.productName).trim(),
          quantity: String(qty),
          unit: item.unit || "개",
          unitPrice: price,
          totalAmount: total,
          memo: memo || null,
        };
      });

      await db.insert(purchases).values(insertRows);
      res.json({ success: true, count: insertRows.length });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // POST /api/admin/purchases/batch-delete - 매입 일괄 삭제
  app.post('/api/admin/purchases/batch-delete', async (req, res) => {
    try {
      if (!(await requireAccountingAdmin(req, res))) return;
      const { ids } = req.body;
      if (!ids?.length) return res.status(400).json({ message: "삭제할 항목을 선택해주세요" });

      await db.delete(purchases).where(inArray(purchases.id, ids));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // GET /api/admin/purchases/cumulative-total - 현재시점 전체 누적합계 (날짜 필터 없음, 업체 필터만)
  app.get('/api/admin/purchases/cumulative-total', async (req, res) => {
    try {
      if (!(await requireAccountingAdmin(req, res))) return;
      const { vendorName } = req.query;

      const vendorMap = new Map<number, string>();
      const vendorList = await db.select({ id: vendors.id, companyName: vendors.companyName }).from(vendors);
      vendorList.forEach(v => vendorMap.set(v.id, v.companyName));
      const supplierList2 = await db.select({ id: suppliers.id, name: suppliers.name }).from(suppliers);
      const supplierMap = new Map<number, string>();
      supplierList2.forEach(s => supplierMap.set(s.id, s.name));

      const getVendorName = (vId: number | null, sId: number | null) => {
        if (vId) return vendorMap.get(vId);
        if (sId) return supplierMap.get(sId);
        return undefined;
      };

      const purchaseList = await db.select({
        vendorId: purchases.vendorId,
        supplierId: purchases.supplierId,
        totalAmount: purchases.totalAmount,
      }).from(purchases);

      let totalPurchase = 0;
      for (const p of purchaseList) {
        const name = getVendorName(p.vendorId, p.supplierId);
        if (vendorName && name !== String(vendorName)) continue;
        totalPurchase += Number(p.totalAmount) || 0;
      }

      const paymentList = await db.select({
        vendorId: vendorPayments.vendorId,
        supplierId: vendorPayments.supplierId,
        amount: vendorPayments.amount,
      }).from(vendorPayments);

      let totalPayment = 0;
      for (const p of paymentList) {
        const name = getVendorName(p.vendorId, p.supplierId);
        if (vendorName && name !== String(vendorName)) continue;
        totalPayment += Number(p.amount) || 0;
      }

      res.json({
        cumulativeTotal: totalPurchase,
        cumulativePayment: totalPayment,
        outstandingBalance: totalPurchase - totalPayment,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // GET /api/admin/accounting/vendor-balances - 업체별 외상 현황 (통합 - 매입 정산)
  app.get('/api/admin/accounting/vendor-balances', async (req, res) => {
    try {
      if (!(await requireAccountingAdmin(req, res))) return;

      const supplierList = await db.select().from(suppliers).where(eq(suppliers.isActive, true));
      const linkedVendorIds = new Set(supplierList.filter(s => s.linkedVendorId).map(s => s.linkedVendorId!));
      const vendorList = await db.select({ id: vendors.id, companyName: vendors.companyName })
        .from(vendors).where(eq(vendors.isActive, true)).orderBy(asc(vendors.companyName));

      const result: any[] = [];

      for (const s of supplierList) {
        let totalPurchases = 0;
        let totalPayments = 0;

        const [sp] = await db.select({ total: sql<number>`COALESCE(SUM(total_amount), 0)` }).from(purchases).where(eq(purchases.supplierId, s.id));
        const [sv] = await db.select({ total: sql<number>`COALESCE(SUM(amount), 0)` }).from(vendorPayments).where(eq(vendorPayments.supplierId, s.id));
        totalPurchases += Number(sp.total);
        totalPayments += Number(sv.total);

        if (s.linkedVendorId) {
          const [vp] = await db.select({ total: sql<number>`COALESCE(SUM(total_amount), 0)` }).from(purchases).where(eq(purchases.vendorId, s.linkedVendorId));
          const [vv] = await db.select({ total: sql<number>`COALESCE(SUM(amount), 0)` }).from(vendorPayments).where(eq(vendorPayments.vendorId, s.linkedVendorId));
          totalPurchases += Number(vp.total);
          totalPayments += Number(vv.total);
        }

        if (totalPurchases > 0 || totalPayments > 0) {
          result.push({
            id: `supplier-${s.id}`,
            source: s.linkedVendorId ? "both" : "supplier",
            vendorId: s.linkedVendorId || null,
            supplierId: s.id,
            companyName: s.name,
            totalPurchases,
            totalPayments,
            outstandingBalance: totalPurchases - totalPayments,
          });
        }
      }

      for (const v of vendorList) {
        if (linkedVendorIds.has(v.id)) continue;
        const [purchaseSum] = await db.select({ total: sql<number>`COALESCE(SUM(total_amount), 0)` }).from(purchases).where(eq(purchases.vendorId, v.id));
        const [paymentSum] = await db.select({ total: sql<number>`COALESCE(SUM(amount), 0)` }).from(vendorPayments).where(eq(vendorPayments.vendorId, v.id));
        const totalPurchases = Number(purchaseSum.total);
        const totalPayments = Number(paymentSum.total);

        if (totalPurchases > 0 || totalPayments > 0) {
          result.push({
            id: `vendor-${v.id}`,
            source: "vendor",
            vendorId: v.id,
            supplierId: null,
            companyName: v.companyName,
            totalPurchases,
            totalPayments,
            outstandingBalance: totalPurchases - totalPayments,
          });
        }
      }

      result.sort((a, b) => a.companyName.localeCompare(b.companyName, 'ko'));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // GET /api/admin/accounting/vendors/:compositeId/transactions - 업체별 거래 내역 (시간순, 통합)
  app.get('/api/admin/accounting/vendors/:compositeId/transactions', async (req, res) => {
    try {
      if (!(await requireAccountingAdmin(req, res))) return;
      const compositeId = req.params.compositeId;
      const { startDate, endDate } = req.query;

      let vendorIdVal: number | null = null;
      let supplierIdVal: number | null = null;

      if (compositeId.startsWith('vendor-')) {
        vendorIdVal = parseInt(compositeId.replace('vendor-', ''));
      } else if (compositeId.startsWith('supplier-')) {
        supplierIdVal = parseInt(compositeId.replace('supplier-', ''));
        const [supplier] = await db.select({ linkedVendorId: suppliers.linkedVendorId }).from(suppliers).where(eq(suppliers.id, supplierIdVal));
        if (supplier?.linkedVendorId) vendorIdVal = supplier.linkedVendorId;
      } else {
        vendorIdVal = parseInt(compositeId);
      }

      const allRecords: any[] = [];

      if (vendorIdVal) {
        const purchaseConditions: any[] = [eq(purchases.vendorId, vendorIdVal)];
        if (startDate) purchaseConditions.push(gte(purchases.purchaseDate, String(startDate)));
        if (endDate) purchaseConditions.push(lte(purchases.purchaseDate, String(endDate)));

        const paymentConditions: any[] = [eq(vendorPayments.vendorId, vendorIdVal)];
        if (startDate) paymentConditions.push(gte(vendorPayments.paymentDate, String(startDate)));
        if (endDate) paymentConditions.push(lte(vendorPayments.paymentDate, String(endDate)));

        const [purchaseRows, paymentRows] = await Promise.all([
          db.select({ id: purchases.id, date: purchases.purchaseDate, description: purchases.productName, amount: purchases.totalAmount }).from(purchases).where(and(...purchaseConditions)),
          db.select({ id: vendorPayments.id, date: vendorPayments.paymentDate, memo: vendorPayments.memo, amount: vendorPayments.amount }).from(vendorPayments).where(and(...paymentConditions)),
        ]);
        allRecords.push(...purchaseRows.map(p => ({ id: `vp-${p.id}`, date: p.date, type: "purchase", description: p.description, amount: p.amount })));
        allRecords.push(...paymentRows.map(p => ({ id: `vpm-${p.id}`, date: p.date, type: "payment", description: p.memo || "입금", amount: p.amount })));
      }

      if (supplierIdVal) {
        const purchaseConditions: any[] = [eq(purchases.supplierId, supplierIdVal)];
        if (startDate) purchaseConditions.push(gte(purchases.purchaseDate, String(startDate)));
        if (endDate) purchaseConditions.push(lte(purchases.purchaseDate, String(endDate)));

        const paymentConditions: any[] = [eq(vendorPayments.supplierId, supplierIdVal)];
        if (startDate) paymentConditions.push(gte(vendorPayments.paymentDate, String(startDate)));
        if (endDate) paymentConditions.push(lte(vendorPayments.paymentDate, String(endDate)));

        const [purchaseRows, paymentRows] = await Promise.all([
          db.select({ id: purchases.id, date: purchases.purchaseDate, description: purchases.productName, amount: purchases.totalAmount }).from(purchases).where(and(...purchaseConditions)),
          db.select({ id: vendorPayments.id, date: vendorPayments.paymentDate, memo: vendorPayments.memo, amount: vendorPayments.amount }).from(vendorPayments).where(and(...paymentConditions)),
        ]);
        allRecords.push(...purchaseRows.map(p => ({ id: `sp-${p.id}`, date: p.date, type: "purchase", description: p.description, amount: p.amount })));
        allRecords.push(...paymentRows.map(p => ({ id: `spm-${p.id}`, date: p.date, type: "payment", description: p.memo || "입금", amount: p.amount })));
      }

      allRecords.sort((a, b) => a.date.localeCompare(b.date) || (a.type === "purchase" ? -1 : 1));

      let runningBalance = 0;
      allRecords.forEach(r => {
        if (r.type === "purchase") runningBalance += r.amount;
        else runningBalance -= r.amount;
        r.runningBalance = runningBalance;
      });

      res.json(allRecords);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ========================================
  // 매출 현황 (Sales Overview) APIs
  // ========================================

  // 1-1. 통합 매출 현황
  app.get('/api/admin/accounting/sales', async (req, res) => {
    try {
      if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
      const user = await storage.getUser(req.session.userId);
      if (!user || !isAdmin(user.role)) return res.status(403).json({ message: "권한 없음" });

      const { startDate, endDate } = req.query as any;
      const parsed = parseDateRangeKST(startDate, endDate);

      const [siteResult, directResult] = await Promise.all([
        db.select({
          total: sql<number>`COALESCE(SUM(${settlementHistory.totalAmount}), 0)::int`,
          count: sql<number>`COUNT(DISTINCT ${settlementHistory.orderId})::int`,
        }).from(settlementHistory)
          .innerJoin(pendingOrders, eq(settlementHistory.orderId, pendingOrders.id))
          .where(and(
            eq(pendingOrders.status, '배송중'),
            gte(settlementHistory.createdAt, parsed.startUTC),
            lt(settlementHistory.createdAt, parsed.endUTC),
          )),
        db.select({
          total: sql<number>`COALESCE(SUM(${directSales.amount}), 0)::int`,
          count: sql<number>`COUNT(*)::int`,
        }).from(directSales)
          .where(and(
            gte(directSales.saleDate, startDate || '1970-01-01'),
            lte(directSales.saleDate, endDate || '2099-12-31'),
          )),
      ]);

      const siteSales = { total: siteResult[0]?.total ?? 0, count: siteResult[0]?.count ?? 0 };
      const directSalesData = { total: directResult[0]?.total ?? 0, count: directResult[0]?.count ?? 0 };

      res.json({
        siteSales,
        directSales: directSalesData,
        totalSales: siteSales.total + directSalesData.total,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // 1-2. 일별 매출 집계
  app.get('/api/admin/accounting/sales/daily', async (req, res) => {
    try {
      if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
      const user = await storage.getUser(req.session.userId);
      if (!user || !isAdmin(user.role)) return res.status(403).json({ message: "권한 없음" });

      const { startDate, endDate } = req.query as any;
      const parsed = parseDateRangeKST(startDate, endDate);

      const [siteDaily, directDaily] = await Promise.all([
        db.select({
          date: sql<string>`TO_CHAR(${settlementHistory.createdAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD')`,
          total: sql<number>`COALESCE(SUM(${settlementHistory.totalAmount}), 0)::int`,
        }).from(settlementHistory)
          .innerJoin(pendingOrders, eq(settlementHistory.orderId, pendingOrders.id))
          .where(and(
            eq(pendingOrders.status, '배송중'),
            gte(settlementHistory.createdAt, parsed.startUTC),
            lt(settlementHistory.createdAt, parsed.endUTC),
          ))
          .groupBy(sql`TO_CHAR(${settlementHistory.createdAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD')`),
        db.select({
          date: sql<string>`TO_CHAR(${directSales.saleDate}, 'YYYY-MM-DD')`,
          total: sql<number>`COALESCE(SUM(${directSales.amount}), 0)::int`,
        }).from(directSales)
          .where(and(
            gte(directSales.saleDate, startDate || '1970-01-01'),
            lte(directSales.saleDate, endDate || '2099-12-31'),
          ))
          .groupBy(sql`TO_CHAR(${directSales.saleDate}, 'YYYY-MM-DD')`),
      ]);

      const dateMap: Record<string, { siteSales: number; directSales: number }> = {};
      for (const r of siteDaily) {
        if (!dateMap[r.date]) dateMap[r.date] = { siteSales: 0, directSales: 0 };
        dateMap[r.date].siteSales = r.total;
      }
      for (const r of directDaily) {
        if (!dateMap[r.date]) dateMap[r.date] = { siteSales: 0, directSales: 0 };
        dateMap[r.date].directSales = r.total;
      }

      const dates = Object.keys(dateMap).sort();
      const daily = dates.map((date, idx) => {
        const d = dateMap[date];
        const total = d.siteSales + d.directSales;
        const prevTotal = idx > 0 ? (dateMap[dates[idx - 1]].siteSales + dateMap[dates[idx - 1]].directSales) : 0;
        const changeRate = idx > 0 && prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 1000) / 10 : 0;
        return { date, siteSales: d.siteSales, directSales: d.directSales, total, changeRate };
      });

      res.json({ daily });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // 1-3. 회원별 월간 계산서(면세) 발행액
  app.get('/api/admin/accounting/sales/monthly-by-member', async (req, res) => {
    try {
      if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
      const user = await storage.getUser(req.session.userId);
      if (!user || !isAdmin(user.role)) return res.status(403).json({ message: "권한 없음" });

      const year = parseInt(req.query.year as string) || new Date().getFullYear();
      const month = parseInt(req.query.month as string) || (new Date().getMonth() + 1);

      const startKST = `${year}-${String(month).padStart(2, '0')}-01T00:00:00+09:00`;
      const nextMonth = month === 12 ? 1 : month + 1;
      const nextYear = month === 12 ? year + 1 : year;
      const endKST = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01T00:00:00+09:00`;
      const monthStartUTC = new Date(startKST);
      const monthEndUTC = new Date(endKST);

      const memberRows = await db.select({
        memberId: settlementHistory.memberId,
        memberName: members.username,
        companyName: members.companyName,
        businessNumber: members.businessNumber,
        representative: members.representative,
        taxType: pendingOrders.taxType,
        orderCount: sql<number>`COUNT(DISTINCT ${settlementHistory.orderId})::int`,
        totalOrderAmount: sql<number>`COALESCE(SUM(${settlementHistory.totalAmount}), 0)::int`,
        pointerUsed: sql<number>`COALESCE(SUM(${settlementHistory.pointerAmount}), 0)::int`,
        depositUsed: sql<number>`COALESCE(SUM(${settlementHistory.depositAmount}), 0)::int`,
      })
        .from(settlementHistory)
        .innerJoin(members, eq(settlementHistory.memberId, members.id))
        .innerJoin(pendingOrders, eq(settlementHistory.orderId, pendingOrders.id))
        .where(and(
          gte(settlementHistory.createdAt, monthStartUTC),
          lt(settlementHistory.createdAt, monthEndUTC),
        ))
        .groupBy(
          settlementHistory.memberId,
          members.username,
          members.companyName,
          members.businessNumber,
          members.representative,
          pendingOrders.taxType,
        )
        .orderBy(sql`COALESCE(SUM(${settlementHistory.depositAmount}), 0) DESC`);

      const monthStartDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay2 = new Date(nextYear, nextMonth - 1, 0).getDate();
      const monthEndDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay2).padStart(2, '0')}`;

      const directSaleRows = await db.select({
        memberId: directSales.memberId,
        taxType: directSales.taxType,
        totalAmount: sql<number>`COALESCE(SUM(${directSales.amount}), 0)::int`,
        saleCount: sql<number>`COUNT(*)::int`,
      })
        .from(directSales)
        .where(and(
          isNotNull(directSales.memberId),
          gte(directSales.saleDate, monthStartDate),
          lte(directSales.saleDate, monthEndDate),
        ))
        .groupBy(directSales.memberId, directSales.taxType);

      const memberMap: Record<string, any> = {};
      for (const r of memberRows) {
        if (!memberMap[r.memberId]) {
          memberMap[r.memberId] = {
            memberId: r.memberId,
            memberName: r.memberName,
            businessName: r.companyName || r.memberName,
            businessNumber: r.businessNumber || '',
            representative: r.representative || '',
            orderCount: 0,
            totalOrderAmount: 0,
            pointerUsed: 0,
            exemptAmount: 0,
            taxableAmount: 0,
            taxableSupply: 0,
            taxableVat: 0,
          };
        }
        const m = memberMap[r.memberId];
        m.orderCount += r.orderCount;
        m.totalOrderAmount += r.totalOrderAmount;
        m.pointerUsed += r.pointerUsed;

        if (r.taxType === 'taxable') {
          m.taxableAmount += r.depositUsed;
          m.taxableSupply += Math.round(r.depositUsed / 1.1);
          m.taxableVat += r.depositUsed - Math.round(r.depositUsed / 1.1);
        } else {
          m.exemptAmount += r.depositUsed;
        }
      }

      for (const ds of directSaleRows) {
        if (!ds.memberId) continue;
        if (!memberMap[ds.memberId]) {
          const memberInfo = await db.select({
            id: members.id,
            name: members.username,
            companyName: members.companyName,
            businessNumber: members.businessNumber,
            representative: members.representative,
          }).from(members).where(eq(members.id, ds.memberId)).limit(1);
          const mi = memberInfo[0];
          if (!mi) continue;
          memberMap[ds.memberId] = {
            memberId: ds.memberId,
            memberName: mi.name,
            businessName: mi.companyName || mi.name,
            businessNumber: mi.businessNumber || '',
            representative: mi.representative || '',
            orderCount: 0,
            totalOrderAmount: 0,
            pointerUsed: 0,
            exemptAmount: 0,
            taxableAmount: 0,
            taxableSupply: 0,
            taxableVat: 0,
          };
        }
        const m = memberMap[ds.memberId];
        m.orderCount += ds.saleCount;
        m.totalOrderAmount += ds.totalAmount;

        if (ds.taxType === 'taxable') {
          m.taxableAmount += ds.totalAmount;
          m.taxableSupply += Math.round(ds.totalAmount / 1.1);
          m.taxableVat += ds.totalAmount - Math.round(ds.totalAmount / 1.1);
        } else {
          m.exemptAmount += ds.totalAmount;
        }
      }

      const memberData = Object.values(memberMap).sort((a: any, b: any) => 
        (b.exemptAmount + b.taxableAmount) - (a.exemptAmount + a.taxableAmount)
      );

      const totals = {
        totalOrderAmount: memberData.reduce((s: number, m: any) => s + m.totalOrderAmount, 0),
        pointerUsed: memberData.reduce((s: number, m: any) => s + m.pointerUsed, 0),
        exemptAmount: memberData.reduce((s: number, m: any) => s + m.exemptAmount, 0),
        taxableAmount: memberData.reduce((s: number, m: any) => s + m.taxableAmount, 0),
        taxableSupply: memberData.reduce((s: number, m: any) => s + m.taxableSupply, 0),
        taxableVat: memberData.reduce((s: number, m: any) => s + m.taxableVat, 0),
      };

      const KST_OFFSET = 9 * 60 * 60 * 1000;
      const now = new Date();
      const kstNow = new Date(now.getTime() + now.getTimezoneOffset() * 60000 + KST_OFFSET);
      const currentYear = kstNow.getFullYear();
      const currentMonth = kstNow.getMonth() + 1;
      const currentDay = kstNow.getDate();

      let closingStatus = "closed";
      if (year === currentYear && month === currentMonth) {
        closingStatus = "open";
      } else if (
        (year === currentYear && month === currentMonth - 1) ||
        (year === currentYear - 1 && month === 12 && currentMonth === 1)
      ) {
        closingStatus = currentDay <= 10 ? "warning" : "overdue";
      }

      const deadlineMonth = month === 12 ? 1 : month + 1;
      const deadlineYear = month === 12 ? year + 1 : year;
      const deadline = `${deadlineYear}-${String(deadlineMonth).padStart(2, '0')}-10`;

      res.json({
        year, month, closingStatus, deadline,
        members: memberData,
        totals,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // 1-4. 특정 회원 월간 주문 상세
  app.get('/api/admin/accounting/sales/member/:memberId/monthly-detail', async (req, res) => {
    try {
      if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
      const user = await storage.getUser(req.session.userId);
      if (!user || !isAdmin(user.role)) return res.status(403).json({ message: "권한 없음" });

      const { memberId } = req.params;
      const year = parseInt(req.query.year as string) || new Date().getFullYear();
      const month = parseInt(req.query.month as string) || (new Date().getMonth() + 1);

      const startKST = `${year}-${String(month).padStart(2, '0')}-01T00:00:00+09:00`;
      const nextMonth = month === 12 ? 1 : month + 1;
      const nextYear = month === 12 ? year + 1 : year;
      const endKST = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01T00:00:00+09:00`;
      const monthStartUTC = new Date(startKST);
      const monthEndUTC = new Date(endKST);

      const memberInfo = await db.select({
        id: members.id,
        name: members.username,
        companyName: members.companyName,
        businessNumber: members.businessNumber,
        representative: members.representative,
        phone: members.phone,
      }).from(members).where(eq(members.id, memberId)).limit(1);

      if (!memberInfo.length) return res.status(404).json({ message: "회원을 찾을 수 없습니다" });

      const orderRows = await db.select({
        orderId: pendingOrders.id,
        orderDate: sql<string>`TO_CHAR(${settlementHistory.createdAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD')`,
        productName: pendingOrders.productName,
        productCode: pendingOrders.productCode,
        supplyPrice: pendingOrders.supplyPrice,
        taxType: pendingOrders.taxType,
        pointerUsed: settlementHistory.pointerAmount,
        depositUsed: settlementHistory.depositAmount,
        totalAmount: settlementHistory.totalAmount,
      })
        .from(settlementHistory)
        .innerJoin(pendingOrders, eq(settlementHistory.orderId, pendingOrders.id))
        .where(and(
          eq(settlementHistory.memberId, memberId),
          gte(settlementHistory.createdAt, monthStartUTC),
          lt(settlementHistory.createdAt, monthEndUTC),
        ))
        .orderBy(sql`${settlementHistory.createdAt} ASC`);

      const monthStartDate2 = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay3 = new Date(nextYear, nextMonth - 1, 0).getDate();
      const monthEndDate2 = `${year}-${String(month).padStart(2, '0')}-${String(lastDay3).padStart(2, '0')}`;

      const directSaleRows2 = await db.select()
        .from(directSales)
        .where(and(
          eq(directSales.memberId, memberId),
          gte(directSales.saleDate, monthStartDate2),
          lte(directSales.saleDate, monthEndDate2),
        ))
        .orderBy(sql`${directSales.saleDate} ASC`);

      const allItems = [
        ...orderRows.map(r => ({
          orderId: r.orderId,
          orderDate: r.orderDate,
          productName: r.productName,
          productCode: r.productCode,
          unitPrice: r.supplyPrice || 0,
          quantity: 1,
          amount: r.totalAmount || 0,
          pointerUsed: r.pointerUsed || 0,
          depositUsed: r.depositUsed || 0,
          taxType: r.taxType || 'exempt',
          isDirectSale: false,
        })),
        ...directSaleRows2.map(ds => ({
          orderId: `DS-${ds.id}`,
          orderDate: ds.saleDate,
          productName: ds.productName || ds.description,
          productCode: ds.productCode || '',
          unitPrice: ds.unitPrice || ds.amount,
          quantity: ds.quantity || 1,
          amount: ds.amount,
          pointerUsed: 0,
          depositUsed: ds.amount,
          taxType: ds.taxType || 'exempt',
          isDirectSale: true,
        })),
      ].sort((a, b) => a.orderDate.localeCompare(b.orderDate));

      const totalOrderAmount = allItems.reduce((s, r) => s + (r.amount || 0), 0);
      const pointerUsed = allItems.reduce((s, r) => s + (r.pointerUsed || 0), 0);
      const exemptDeposit = allItems.filter(r => (r.taxType || 'exempt') !== 'taxable').reduce((s, r) => s + (r.depositUsed || 0), 0);
      const taxableDeposit = allItems.filter(r => r.taxType === 'taxable').reduce((s, r) => s + (r.depositUsed || 0), 0);
      const taxableSupply = Math.round(taxableDeposit / 1.1);
      const taxableVat = taxableDeposit - taxableSupply;

      const mi = memberInfo[0];
      res.json({
        member: {
          id: mi.id,
          name: mi.name,
          companyName: mi.companyName || mi.name,
          businessNumber: mi.businessNumber || '',
          representative: mi.representative || '',
          phone: mi.phone || '',
        },
        orders: allItems,
        summary: { totalOrderAmount, pointerUsed, exemptAmount: exemptDeposit, taxableAmount: taxableDeposit, taxableSupply, taxableVat },
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // 1-5. 계산서(면세)용 엑셀 다운로드
  app.get('/api/admin/accounting/sales/tax-invoice-export', async (req, res) => {
    try {
      if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
      const user = await storage.getUser(req.session.userId);
      if (!user || !isAdmin(user.role)) return res.status(403).json({ message: "권한 없음" });

      const year = parseInt(req.query.year as string) || new Date().getFullYear();
      const month = parseInt(req.query.month as string) || (new Date().getMonth() + 1);

      const startKST = `${year}-${String(month).padStart(2, '0')}-01T00:00:00+09:00`;
      const nextMonth = month === 12 ? 1 : month + 1;
      const nextYear = month === 12 ? year + 1 : year;
      const endKST = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01T00:00:00+09:00`;
      const monthStartUTC = new Date(startKST);
      const monthEndUTC = new Date(endKST);

      const memberRows = await db.select({
        companyName: members.companyName,
        businessNumber: members.businessNumber,
        representative: members.representative,
        taxType: pendingOrders.taxType,
        orderCount: sql<number>`COUNT(DISTINCT ${settlementHistory.orderId})::int`,
        totalOrderAmount: sql<number>`COALESCE(SUM(${settlementHistory.totalAmount}), 0)::int`,
        pointerUsed: sql<number>`COALESCE(SUM(${settlementHistory.pointerAmount}), 0)::int`,
        depositUsed: sql<number>`COALESCE(SUM(${settlementHistory.depositAmount}), 0)::int`,
      })
        .from(settlementHistory)
        .innerJoin(members, eq(settlementHistory.memberId, members.id))
        .innerJoin(pendingOrders, eq(settlementHistory.orderId, pendingOrders.id))
        .where(and(
          gte(settlementHistory.createdAt, monthStartUTC),
          lt(settlementHistory.createdAt, monthEndUTC),
        ))
        .groupBy(members.companyName, members.businessNumber, members.representative, pendingOrders.taxType)
        .orderBy(sql`COALESCE(SUM(${settlementHistory.depositAmount}), 0) DESC`);

      const monthStartDate3 = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay4 = new Date(nextYear, nextMonth - 1, 0).getDate();
      const monthEndDate3 = `${year}-${String(month).padStart(2, '0')}-${String(lastDay4).padStart(2, '0')}`;

      const directSaleExportRows = await db.select({
        memberId: directSales.memberId,
        taxType: directSales.taxType,
        totalAmount: sql<number>`COALESCE(SUM(${directSales.amount}), 0)::int`,
        saleCount: sql<number>`COUNT(*)::int`,
      })
        .from(directSales)
        .where(and(
          isNotNull(directSales.memberId),
          gte(directSales.saleDate, monthStartDate3),
          lte(directSales.saleDate, monthEndDate3),
        ))
        .groupBy(directSales.memberId, directSales.taxType);

      const excelMap: Record<string, any> = {};
      for (const r of memberRows) {
        const key = r.companyName || '';
        if (!excelMap[key]) {
          excelMap[key] = {
            companyName: r.companyName || '',
            businessNumber: r.businessNumber || '',
            representative: r.representative || '',
            orderCount: 0,
            totalOrderAmount: 0,
            pointerUsed: 0,
            exemptAmount: 0,
            taxableAmount: 0,
            taxableSupply: 0,
            taxableVat: 0,
          };
        }
        const m = excelMap[key];
        m.orderCount += r.orderCount;
        m.totalOrderAmount += r.totalOrderAmount;
        m.pointerUsed += r.pointerUsed;
        if (r.taxType === 'taxable') {
          m.taxableAmount += r.depositUsed;
          m.taxableSupply += Math.round(r.depositUsed / 1.1);
          m.taxableVat += r.depositUsed - Math.round(r.depositUsed / 1.1);
        } else {
          m.exemptAmount += r.depositUsed;
        }
      }

      for (const ds of directSaleExportRows) {
        if (!ds.memberId) continue;
        const memberInfo = await db.select({
          companyName: members.companyName,
          businessNumber: members.businessNumber,
          representative: members.representative,
        }).from(members).where(eq(members.id, ds.memberId)).limit(1);
        const mi = memberInfo[0];
        if (!mi) continue;
        const key = mi.companyName || '';
        if (!excelMap[key]) {
          excelMap[key] = {
            companyName: mi.companyName || '',
            businessNumber: mi.businessNumber || '',
            representative: mi.representative || '',
            orderCount: 0,
            totalOrderAmount: 0,
            pointerUsed: 0,
            exemptAmount: 0,
            taxableAmount: 0,
            taxableSupply: 0,
            taxableVat: 0,
          };
        }
        const m = excelMap[key];
        m.orderCount += ds.saleCount;
        m.totalOrderAmount += ds.totalAmount;
        if (ds.taxType === 'taxable') {
          m.taxableAmount += ds.totalAmount;
          m.taxableSupply += Math.round(ds.totalAmount / 1.1);
          m.taxableVat += ds.totalAmount - Math.round(ds.totalAmount / 1.1);
        } else {
          m.exemptAmount += ds.totalAmount;
        }
      }

      const XLSX = await import('xlsx');
      const data = Object.values(excelMap).map((r: any) => ({
        '공급받는자(상호)': r.companyName,
        '사업자번호': r.businessNumber,
        '대표자': r.representative,
        '주문건수': r.orderCount,
        '총주문액': r.totalOrderAmount,
        '포인터사용': r.pointerUsed,
        '면세금액(계산서)': r.exemptAmount,
        '과세금액(세금계산서)': r.taxableAmount,
        '과세공급가액': r.taxableSupply,
        '부가세': r.taxableVat,
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '계산서');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      const filename = encodeURIComponent(`계산서_${year}년${month}월.xlsx`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${filename}`);
      res.send(buf);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // 1-6. 직접 매출 CRUD
  app.get('/api/admin/direct-sales', async (req, res) => {
    try {
      if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
      const user = await storage.getUser(req.session.userId);
      if (!user || !isAdmin(user.role)) return res.status(403).json({ message: "권한 없음" });

      const { startDate, endDate } = req.query as any;
      const conditions: any[] = [];
      if (startDate) conditions.push(gte(directSales.saleDate, startDate));
      if (endDate) conditions.push(lte(directSales.saleDate, endDate));

      const rows = await db.select().from(directSales)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(sql`${directSales.saleDate} DESC, ${directSales.createdAt} DESC`);

      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/admin/direct-sales/check-stock', async (req, res) => {
    try {
      if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
      const user = await storage.getUser(req.session.userId);
      if (!user || !isAdmin(user.role)) return res.status(403).json({ message: "권한 없음" });

      const { items } = req.body;
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: "품목 정보가 필요합니다" });
      }

      const stockResults: { itemCode: string; itemName: string; itemType: string; requestedQty: number; currentStock: number; sufficient: boolean }[] = [];

      for (const item of items) {
        const { materialCode, productName, materialType, quantity } = item;
        if (!materialCode || !quantity) continue;
        const qty = parseFloat(quantity) || 0;
        if (qty <= 0) continue;

        if (materialType === "product") {
          const stock = await storage.getProductStock(materialCode);
          const currentStock = stock?.currentStock || 0;
          stockResults.push({
            itemCode: materialCode,
            itemName: productName || materialCode,
            itemType: "product",
            requestedQty: qty,
            currentStock,
            sufficient: currentStock >= qty,
          });
        } else {
          const material = await storage.getMaterialByCode(materialCode);
          const currentStock = material?.currentStock || 0;
          stockResults.push({
            itemCode: materialCode,
            itemName: productName || materialCode,
            itemType: materialType || "raw",
            requestedQty: qty,
            currentStock,
            sufficient: currentStock >= qty,
          });
        }
      }

      const insufficientItems = stockResults.filter(r => !r.sufficient);
      res.json({
        allSufficient: insufficientItems.length === 0,
        results: stockResults,
        insufficientItems,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/admin/direct-sales', async (req, res) => {
    try {
      if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
      const user = await storage.getUser(req.session.userId);
      if (!user || !isAdmin(user.role)) return res.status(403).json({ message: "권한 없음" });

      const { saleDate, clientName, description, amount, memo, stockItems, productCode, productName, quantity, unitPrice, categoryL, categoryM, categoryS, taxType, memberId, clientType, vendorId } = req.body;
      if (!saleDate || !clientName || !description || !amount || amount < 1) {
        return res.status(400).json({ message: "필수 항목을 입력해주세요 (매출일, 거래처명, 내용, 금액)" });
      }

      const [row] = await db.insert(directSales).values({
        saleDate, clientName, description, amount: parseInt(amount), memo: memo || null,
        productCode: productCode || null,
        productName: productName || null,
        quantity: quantity ? parseInt(quantity) : null,
        unitPrice: unitPrice ? parseInt(unitPrice) : null,
        categoryL: categoryL || null,
        categoryM: categoryM || null,
        categoryS: categoryS || null,
        taxType: taxType || "exempt",
        memberId: memberId || null,
        clientType: clientType || "vendor",
        vendorId: vendorId ? parseInt(vendorId) : null,
      }).returning();

      if (stockItems && Array.isArray(stockItems)) {
        for (const si of stockItems) {
          const { materialCode, materialType, quantity, productName } = si;
          if (!materialCode || !quantity) continue;
          const qty = parseFloat(quantity) || 0;
          if (qty <= 0) continue;

          if (materialType === "product") {
            const stock = await storage.getProductStock(materialCode);
            const beforeStock = stock?.currentStock || 0;
            const afterStock = beforeStock - qty;
            if (stock) {
              await storage.updateProductStock(materialCode, afterStock);
            } else {
              await storage.createProductStock({
                productCode: materialCode,
                productName: productName || materialCode,
                currentStock: -qty,
              });
            }
            await storage.createStockHistory({
              stockType: "product",
              actionType: "out",
              itemCode: materialCode,
              itemName: productName || materialCode,
              quantity: Math.round(-qty),
              beforeStock: Math.round(beforeStock),
              afterStock: Math.round(afterStock),
              reason: "매출 등록",
              note: `직접매출 - ${clientName}`,
              adminId: req.session.userId!,
              source: "manual",
            });
          } else {
            const material = await storage.getMaterialByCode(materialCode);
            if (material) {
              const beforeStock = material.currentStock;
              const afterStock = beforeStock - qty;
              await storage.updateMaterial(material.id, { currentStock: afterStock } as any);
              await storage.createStockHistory({
                stockType: materialType || "raw",
                actionType: "out",
                itemCode: materialCode,
                itemName: productName || materialCode,
                quantity: Math.round(-qty),
                beforeStock: Math.round(beforeStock),
                afterStock: Math.round(afterStock),
                reason: "매출 등록",
                note: `직접매출 - ${clientName}`,
                adminId: req.session.userId!,
                source: "manual",
              });
            }
          }
        }
      }

      res.json(row);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put('/api/admin/direct-sales/:id', async (req, res) => {
    try {
      if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
      const user = await storage.getUser(req.session.userId);
      if (!user || !isAdmin(user.role)) return res.status(403).json({ message: "권한 없음" });

      const id = parseInt(req.params.id);
      const { saleDate, clientName, description, amount, memo, productCode, productName, quantity, unitPrice, categoryL, categoryM, categoryS, taxType, memberId, clientType, vendorId } = req.body;
      if (!saleDate || !clientName || !description || !amount || amount < 1) {
        return res.status(400).json({ message: "필수 항목을 입력해주세요" });
      }

      const [row] = await db.update(directSales)
        .set({
          saleDate, clientName, description, amount: parseInt(amount), memo: memo || null,
          productCode: productCode || null,
          productName: productName || null,
          quantity: quantity ? parseInt(quantity) : null,
          unitPrice: unitPrice ? parseInt(unitPrice) : null,
          categoryL: categoryL || null,
          categoryM: categoryM || null,
          categoryS: categoryS || null,
          taxType: taxType || "exempt",
          memberId: memberId || null,
          clientType: clientType || "vendor",
          vendorId: vendorId ? parseInt(vendorId) : null,
          updatedAt: new Date(),
        })
        .where(eq(directSales.id, id))
        .returning();

      if (!row) return res.status(404).json({ message: "해당 매출을 찾을 수 없습니다" });
      res.json(row);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete('/api/admin/direct-sales/:id', async (req, res) => {
    try {
      if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
      const user = await storage.getUser(req.session.userId);
      if (!user || !isAdmin(user.role)) return res.status(403).json({ message: "권한 없음" });

      const id = parseInt(req.params.id);
      const [row] = await db.delete(directSales).where(eq(directSales.id, id)).returning();
      if (!row) return res.status(404).json({ message: "해당 매출을 찾을 수 없습니다" });
      res.json({ message: "삭제 완료" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ═══════════════════════════════════════════════════════
  // 문의 게시판 API (Thread-based)
  // ═══════════════════════════════════════════════════════

  const inquiryUploadsDir = path.resolve(process.cwd(), "uploads/inquiries");
  if (!fs.existsSync(inquiryUploadsDir)) {
    fs.mkdirSync(inquiryUploadsDir, { recursive: true });
  }
  const inquiryUpload = multer({ dest: 'uploads/inquiries/', limits: { fileSize: 10 * 1024 * 1024 } });

  // ── Admin APIs ──

  app.get("/api/admin/inquiries/counts", async (req, res) => {
    try {
      if (!req.session.userId) return res.status(401).json({ message: "로그인 필요" });
      const user = await storage.getUser(req.session.userId);
      if (!user || !isAdmin(user.role)) return res.status(403).json({ message: "권한 없음" });

      const allInquiries = await db.select().from(inquiries);
      const total = allInquiries.length;
      const byStatus: Record<string, number> = {};
      const byCategory: Record<string, number> = {};
      let unreadCount = 0;
      for (const inq of allInquiries) {
        byStatus[inq.status] = (byStatus[inq.status] || 0) + 1;
        byCategory[inq.category] = (byCategory[inq.category] || 0) + 1;
        if (inq.unreadByAdmin) unreadCount++;
      }
      res.json({ total, byStatus, byCategory, unreadCount });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/inquiries", async (req, res) => {
    try {
      if (!req.session.userId) return res.status(401).json({ message: "로그인 필요" });
      const user = await storage.getUser(req.session.userId);
      if (!user || !isAdmin(user.role)) return res.status(403).json({ message: "권한 없음" });

      const status = req.query.status as string | undefined;
      const category = req.query.category as string | undefined;
      const search = req.query.search as string | undefined;

      const conditions: any[] = [];
      if (status && status !== "전체") conditions.push(eq(inquiries.status, status));
      if (category && category !== "전체") conditions.push(eq(inquiries.category, category));
      if (search && search.trim()) {
        const term = `%${search.trim()}%`;
        conditions.push(or(
          ilike(inquiries.title, term),
          ilike(inquiries.content, term),
          ilike(inquiries.memberName, term)
        ));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      const rows = await db.select().from(inquiries)
        .where(whereClause)
        .orderBy(
          sql`CASE WHEN ${inquiries.priority} = 'urgent' THEN 0 ELSE 1 END`,
          desc(inquiries.lastMessageAt)
        );

      const inquiryIds = rows.map(r => r.id);
      let messageCounts: Record<number, number> = {};
      if (inquiryIds.length > 0) {
        const counts = await db.select({
          inquiryId: inquiryMessages.inquiryId,
          cnt: count()
        }).from(inquiryMessages)
          .where(inArray(inquiryMessages.inquiryId, inquiryIds))
          .groupBy(inquiryMessages.inquiryId);
        for (const c of counts) {
          messageCounts[c.inquiryId] = Number(c.cnt);
        }
      }

      const result = rows.map(r => ({
        ...r,
        messageCount: messageCounts[r.id] || 0,
      }));

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/inquiries/:id", async (req, res) => {
    try {
      if (!req.session.userId) return res.status(401).json({ message: "로그인 필요" });
      const user = await storage.getUser(req.session.userId);
      if (!user || !isAdmin(user.role)) return res.status(403).json({ message: "권한 없음" });

      const id = parseInt(req.params.id);
      const [inquiry] = await db.select().from(inquiries).where(eq(inquiries.id, id));
      if (!inquiry) return res.status(404).json({ message: "문의를 찾을 수 없습니다" });

      const messages = await db.select().from(inquiryMessages)
        .where(eq(inquiryMessages.inquiryId, id))
        .orderBy(asc(inquiryMessages.createdAt));
      const fields = await db.select().from(inquiryFields)
        .where(eq(inquiryFields.inquiryId, id));
      const attachments = await db.select().from(inquiryAttachments)
        .where(eq(inquiryAttachments.inquiryId, id));

      res.json({ ...inquiry, messages, fields, attachments });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/inquiries/:id/messages", async (req, res) => {
    try {
      if (!req.session.userId) return res.status(401).json({ message: "로그인 필요" });
      const user = await storage.getUser(req.session.userId);
      if (!user || !isAdmin(user.role)) return res.status(403).json({ message: "권한 없음" });

      const id = parseInt(req.params.id);
      const { content } = req.body;
      if (!content || !content.trim()) return res.status(400).json({ message: "내용을 입력해주세요" });

      const [inquiry] = await db.select().from(inquiries).where(eq(inquiries.id, id));
      if (!inquiry) return res.status(404).json({ message: "문의를 찾을 수 없습니다" });

      const [message] = await db.insert(inquiryMessages).values({
        inquiryId: id,
        senderType: "admin",
        senderId: user.id,
        senderName: user.name || user.username,
        content: content.trim(),
      }).returning();

      await db.update(inquiries).set({
        status: "답변완료",
        unreadByMember: true,
        unreadByAdmin: false,
        lastMessageAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(inquiries.id, id));

      res.json(message);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/admin/inquiries/:id/status", async (req, res) => {
    try {
      if (!req.session.userId) return res.status(401).json({ message: "로그인 필요" });
      const user = await storage.getUser(req.session.userId);
      if (!user || !isAdmin(user.role)) return res.status(403).json({ message: "권한 없음" });

      const id = parseInt(req.params.id);
      const { status } = req.body;
      if (!status) return res.status(400).json({ message: "상태를 입력해주세요" });

      const updateData: any = { status, updatedAt: new Date() };
      if (status === "종결") {
        updateData.closedAt = new Date();
        updateData.closedBy = user.name || user.username;
      }

      const [row] = await db.update(inquiries).set(updateData).where(eq(inquiries.id, id)).returning();
      if (!row) return res.status(404).json({ message: "문의를 찾을 수 없습니다" });
      res.json(row);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/admin/inquiries/:id/star", async (req, res) => {
    try {
      if (!req.session.userId) return res.status(401).json({ message: "로그인 필요" });
      const user = await storage.getUser(req.session.userId);
      if (!user || !isAdmin(user.role)) return res.status(403).json({ message: "권한 없음" });

      const id = parseInt(req.params.id);
      const { isStarred } = req.body;

      const [row] = await db.update(inquiries).set({ isStarred: !!isStarred }).where(eq(inquiries.id, id)).returning();
      if (!row) return res.status(404).json({ message: "문의를 찾을 수 없습니다" });
      res.json(row);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/admin/inquiries/:id/read", async (req, res) => {
    try {
      if (!req.session.userId) return res.status(401).json({ message: "로그인 필요" });
      const user = await storage.getUser(req.session.userId);
      if (!user || !isAdmin(user.role)) return res.status(403).json({ message: "권한 없음" });

      const id = parseInt(req.params.id);
      const [row] = await db.update(inquiries).set({ unreadByAdmin: false }).where(eq(inquiries.id, id)).returning();
      if (!row) return res.status(404).json({ message: "문의를 찾을 수 없습니다" });
      res.json(row);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/admin/inquiries/:id", async (req, res) => {
    try {
      if (!req.session.userId) return res.status(401).json({ message: "로그인 필요" });
      const user = await storage.getUser(req.session.userId);
      if (!user || !isAdmin(user.role)) return res.status(403).json({ message: "권한 없음" });

      const id = parseInt(req.params.id);
      await db.delete(inquiryAttachments).where(eq(inquiryAttachments.inquiryId, id));
      await db.delete(inquiryFields).where(eq(inquiryFields.inquiryId, id));
      await db.delete(inquiryMessages).where(eq(inquiryMessages.inquiryId, id));
      const [row] = await db.delete(inquiries).where(eq(inquiries.id, id)).returning();
      if (!row) return res.status(404).json({ message: "문의를 찾을 수 없습니다" });
      res.json({ message: "삭제 완료" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/inquiries/:id/attachments", inquiryUpload.single('file'), async (req, res) => {
    try {
      if (!req.session.userId) return res.status(401).json({ message: "로그인 필요" });
      const user = await storage.getUser(req.session.userId);
      if (!user || !isAdmin(user.role)) return res.status(403).json({ message: "권한 없음" });

      const id = parseInt(req.params.id);
      const [inquiry] = await db.select().from(inquiries).where(eq(inquiries.id, id));
      if (!inquiry) return res.status(404).json({ message: "문의를 찾을 수 없습니다" });

      if (!req.file) return res.status(400).json({ message: "파일을 선택해주세요" });

      const file = req.file;
      const fileUrl = `/uploads/inquiries/${file.filename}`;
      const [attachment] = await db.insert(inquiryAttachments).values({
        inquiryId: id,
        fileName: file.originalname,
        fileUrl,
        fileSize: file.size,
        fileType: file.mimetype,
      }).returning();

      res.json(attachment);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ── Member APIs ──

  app.get("/api/member/inquiries/counts", async (req, res) => {
    try {
      if (!req.session.userId || req.session.userType !== "member") return res.status(401).json({ message: "로그인 필요" });
      const member = await storage.getMember(req.session.userId);
      if (!member) return res.status(401).json({ message: "회원 정보를 찾을 수 없습니다" });

      const myInquiries = await db.select().from(inquiries).where(eq(inquiries.memberId, member.id));
      const total = myInquiries.length;
      const byStatus: Record<string, number> = {};
      let newReplies = 0;
      for (const inq of myInquiries) {
        byStatus[inq.status] = (byStatus[inq.status] || 0) + 1;
        if (inq.unreadByMember) newReplies++;
      }
      res.json({ total, byStatus, newReplies });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/member/inquiries", async (req, res) => {
    try {
      if (!req.session.userId || req.session.userType !== "member") return res.status(401).json({ message: "로그인 필요" });
      const member = await storage.getMember(req.session.userId);
      if (!member) return res.status(401).json({ message: "회원 정보를 찾을 수 없습니다" });

      const rows = await db.select().from(inquiries)
        .where(eq(inquiries.memberId, member.id))
        .orderBy(desc(inquiries.lastMessageAt));

      const inquiryIds = rows.map(r => r.id);
      let messageCounts: Record<number, number> = {};
      if (inquiryIds.length > 0) {
        const counts = await db.select({
          inquiryId: inquiryMessages.inquiryId,
          cnt: count()
        }).from(inquiryMessages)
          .where(inArray(inquiryMessages.inquiryId, inquiryIds))
          .groupBy(inquiryMessages.inquiryId);
        for (const c of counts) {
          messageCounts[c.inquiryId] = Number(c.cnt);
        }
      }

      const result = rows.map(r => ({
        ...r,
        messageCount: messageCounts[r.id] || 0,
      }));

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/member/inquiries", async (req, res) => {
    try {
      if (!req.session.userId || req.session.userType !== "member") return res.status(401).json({ message: "로그인 필요" });
      const member = await storage.getMember(req.session.userId);
      if (!member) return res.status(401).json({ message: "회원 정보를 찾을 수 없습니다" });

      const { category, title, content, priority, fields } = req.body;

      if (!category) return res.status(400).json({ message: "카테고리를 선택해주세요" });
      if (!title || !title.trim()) return res.status(400).json({ message: "제목을 입력해주세요" });

      const requiredFieldsMap: Record<string, string[]> = {
        "일반문의": [],
        "상품CS/미수": ["담당자/연락처", "상품발송일", "상품명/코드", "수령자", "운송장번호"],
        "정산/계산서": ["사업자명/ID", "요청금액/내용"],
        "회원정보(등급)": ["회원아이디", "담당자이름/연락처", "문의접수일"],
        "행사특가/변경": ["행사상품명/코드", "사이트명/행사명", "판매예상수량", "행사/출고예정일"],
        "기타": [],
      };

      const needsContent = category !== "행사특가/변경";
      if (needsContent && (!content || !content.trim())) {
        return res.status(400).json({ message: "내용을 입력해주세요" });
      }

      const requiredFields = requiredFieldsMap[category] || [];
      if (requiredFields.length > 0) {
        const fieldMap: Record<string, string> = {};
        if (Array.isArray(fields)) {
          for (const f of fields) {
            if (f.field_name && f.field_value) fieldMap[f.field_name] = f.field_value;
          }
        }
        for (const rf of requiredFields) {
          if (!fieldMap[rf] || !fieldMap[rf].trim()) {
            return res.status(400).json({ message: `필수 항목 '${rf}'을(를) 입력해주세요` });
          }
        }
      }

      const [inquiry] = await db.insert(inquiries).values({
        memberId: member.id,
        memberName: member.companyName || member.memberName || member.username,
        category: category,
        title: title.trim(),
        content: (content || "").trim(),
        priority: priority || "normal",
      }).returning();

      await db.insert(inquiryMessages).values({
        inquiryId: inquiry.id,
        senderType: "member",
        senderId: member.id,
        senderName: member.companyName || member.memberName || member.username,
        content: (content || title).trim(),
      });

      if (Array.isArray(fields) && fields.length > 0) {
        const fieldValues = fields
          .filter((f: any) => f.field_name && f.field_value)
          .map((f: any) => ({
            inquiryId: inquiry.id,
            fieldName: f.field_name,
            fieldValue: f.field_value,
          }));
        if (fieldValues.length > 0) {
          await db.insert(inquiryFields).values(fieldValues);
        }
      }

      res.status(201).json(inquiry);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/member/inquiries/:id", async (req, res) => {
    try {
      if (!req.session.userId || req.session.userType !== "member") return res.status(401).json({ message: "로그인 필요" });
      const member = await storage.getMember(req.session.userId);
      if (!member) return res.status(401).json({ message: "회원 정보를 찾을 수 없습니다" });

      const id = parseInt(req.params.id);
      const [inquiry] = await db.select().from(inquiries)
        .where(and(eq(inquiries.id, id), eq(inquiries.memberId, member.id)));
      if (!inquiry) return res.status(404).json({ message: "문의를 찾을 수 없습니다" });

      const messages = await db.select().from(inquiryMessages)
        .where(eq(inquiryMessages.inquiryId, id))
        .orderBy(asc(inquiryMessages.createdAt));
      const fields = await db.select().from(inquiryFields)
        .where(eq(inquiryFields.inquiryId, id));
      const attachments = await db.select().from(inquiryAttachments)
        .where(eq(inquiryAttachments.inquiryId, id));

      res.json({ ...inquiry, messages, fields, attachments });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/member/inquiries/:id/messages", async (req, res) => {
    try {
      if (!req.session.userId || req.session.userType !== "member") return res.status(401).json({ message: "로그인 필요" });
      const member = await storage.getMember(req.session.userId);
      if (!member) return res.status(401).json({ message: "회원 정보를 찾을 수 없습니다" });

      const id = parseInt(req.params.id);
      const { content } = req.body;
      if (!content || !content.trim()) return res.status(400).json({ message: "내용을 입력해주세요" });

      const [inquiry] = await db.select().from(inquiries)
        .where(and(eq(inquiries.id, id), eq(inquiries.memberId, member.id)));
      if (!inquiry) return res.status(404).json({ message: "문의를 찾을 수 없습니다" });
      if (inquiry.status === "종결") return res.status(400).json({ message: "종결된 문의에는 메시지를 보낼 수 없습니다" });

      const [message] = await db.insert(inquiryMessages).values({
        inquiryId: id,
        senderType: "member",
        senderId: member.id,
        senderName: member.companyName || member.memberName || member.username,
        content: content.trim(),
      }).returning();

      const updateData: any = {
        unreadByAdmin: true,
        unreadByMember: false,
        lastMessageAt: new Date(),
        updatedAt: new Date(),
      };
      if (inquiry.status === "답변완료") {
        updateData.status = "추가문의";
      }
      await db.update(inquiries).set(updateData).where(eq(inquiries.id, id));

      res.json(message);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/member/inquiries/:id/read", async (req, res) => {
    try {
      if (!req.session.userId || req.session.userType !== "member") return res.status(401).json({ message: "로그인 필요" });
      const member = await storage.getMember(req.session.userId);
      if (!member) return res.status(401).json({ message: "회원 정보를 찾을 수 없습니다" });

      const id = parseInt(req.params.id);
      const [row] = await db.update(inquiries)
        .set({ unreadByMember: false })
        .where(and(eq(inquiries.id, id), eq(inquiries.memberId, member.id)))
        .returning();
      if (!row) return res.status(404).json({ message: "문의를 찾을 수 없습니다" });
      res.json(row);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/member/inquiries/:id/attachments", inquiryUpload.single('file'), async (req, res) => {
    try {
      if (!req.session.userId || req.session.userType !== "member") return res.status(401).json({ message: "로그인 필요" });
      const member = await storage.getMember(req.session.userId);
      if (!member) return res.status(401).json({ message: "회원 정보를 찾을 수 없습니다" });

      const id = parseInt(req.params.id);
      const [inquiry] = await db.select().from(inquiries)
        .where(and(eq(inquiries.id, id), eq(inquiries.memberId, member.id)));
      if (!inquiry) return res.status(404).json({ message: "문의를 찾을 수 없습니다" });

      if (!req.file) return res.status(400).json({ message: "파일을 선택해주세요" });

      const file = req.file;
      const fileUrl = `/uploads/inquiries/${file.filename}`;
      const [attachment] = await db.insert(inquiryAttachments).values({
        inquiryId: id,
        fileName: file.originalname,
        fileUrl,
        fileSize: file.size,
        fileType: file.mimetype,
      }).returning();

      res.json(attachment);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  return httpServer;
}
