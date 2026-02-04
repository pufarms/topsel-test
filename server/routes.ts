import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import session from "express-session";
import cookieParser from "cookie-parser";
import { loginSchema, registerSchema, insertOrderSchema, insertAdminSchema, updateAdminSchema, userTiers, imageCategories, menuPermissions, partnerFormSchema, shippingCompanies, memberFormSchema, updateMemberSchema, bulkUpdateMemberSchema, memberGrades, categoryFormSchema, productRegistrationFormSchema, type Category, insertPageSchema, pageCategories, pageAccessLevels, termAgreements, pages, deletedMembers, deletedMemberOrders, orders, alimtalkTemplates, alimtalkHistory, pendingOrders, pendingOrderFormSchema, pendingOrderStatuses, formTemplates } from "@shared/schema";
import addressValidationRouter, { validateSingleAddress, type AddressStatus } from "./address-validation";
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
import { eq, desc, asc, sql, and, inArray } from "drizzle-orm";
import { generateToken, JWT_COOKIE_OPTIONS } from "./jwt-utils";

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

// SSE 이벤트 관리자
interface SSEClient {
  id: string;
  res: any;
  userId: string;
  userType: "user" | "member";
}

class SSEManager {
  private clients: Map<string, SSEClient> = new Map();

  addClient(client: SSEClient) {
    this.clients.set(client.id, client);
    console.log(`SSE client connected: ${client.userId} (${client.userType}), total: ${this.clients.size}`);
  }

  removeClient(id: string) {
    this.clients.delete(id);
    console.log(`SSE client disconnected, total: ${this.clients.size}`);
  }

  // 특정 회원에게 이벤트 전송
  sendToMember(memberId: string, event: string, data: any) {
    this.clients.forEach(client => {
      if (client.userType === "member" && client.userId === memberId) {
        client.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      }
    });
  }

  // 모든 관리자에게 이벤트 전송
  sendToAdmins(event: string, data: any) {
    this.clients.forEach(client => {
      if (client.userType === "user") {
        client.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      }
    });
  }

  // 모든 클라이언트에게 이벤트 전송
  broadcast(event: string, data: any) {
    this.clients.forEach(client => {
      client.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    });
  }
}

const sseManager = new SSEManager();

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
    
    // 매핑 상태 검증: 매핑된 재료가 실제로 존재하는지 확인
    const validatedProds = await Promise.all(prods.map(async (p) => {
      // 매핑완료 상태인 경우에만 검증
      if (p.mappingStatus === "complete") {
        const materialMappings = await storage.getProductMaterialMappings(p.productCode);
        
        if (materialMappings.length === 0) {
          // 매핑된 재료가 없으면 미완료
          return { ...p, mappingStatus: "incomplete" };
        }
        
        // 각 재료가 실제로 존재하는지 확인
        for (const mm of materialMappings) {
          const material = await storage.getMaterialByCode(mm.materialCode);
          if (!material) {
            // 삭제된 재료가 있으면 미완료로 변경
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
          reason: !mapping ? "매핑 없음" : "매핑 미완료",
        });
      } else {
        // 매핑이 완료되어 있어도 실제 재료가 존재하는지 확인
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
          // 각 재료가 실제로 존재하는지 확인
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
      
      // 재료 매핑 검증
      const materialMappings = await storage.getProductMaterialMappings(pr.productCode);
      if (materialMappings.length === 0) {
        unmappedProducts.push({ productCode: pr.productCode, productName: pr.productName, reason: "매핑된 재료 없음" });
        continue;
      }
      
      // 매핑된 재료가 실제로 존재하는지 확인
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
        message: `상품코드 [${unmappedProducts[0].productCode}]의 재료 매핑이 완료되지 않았습니다. (${unmappedProducts[0].reason})`,
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
    
    // 재료 매핑 검증
    for (const id of ids) {
      const product = await storage.getNextWeekProduct(id);
      if (!product) continue;
      
      const materialMappings = await storage.getProductMaterialMappings(product.productCode);
      if (materialMappings.length === 0) {
        unmappedProducts.push({ productCode: product.productCode, productName: product.productName, reason: "매핑된 재료 없음" });
        continue;
      }
      
      // 매핑된 재료가 실제로 존재하는지 확인
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
    
    // 재료 매핑 검증
    for (const product of allProducts) {
      const materialMappings = await storage.getProductMaterialMappings(product.productCode);
      if (materialMappings.length === 0) {
        unmappedProducts.push({ productCode: product.productCode, productName: product.productName, reason: "매핑된 재료 없음" });
        continue;
      }
      
      // 매핑된 재료가 실제로 존재하는지 확인
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
      
      validProducts.push(product);
    }
    
    if (unmappedProducts.length > 0) {
      return res.status(400).json({ 
        success: false,
        error: "UNMAPPED_MATERIALS",
        message: `재료 매핑이 완료되지 않은 상품이 ${unmappedProducts.length}개 있습니다.`,
        data: { unmappedProducts }
      });
    }
    
    let created = 0;
    let updated = 0;
    
    // 10원 단위 올림 함수 (이미 예상공급가에서 올림되었지만 안전하게 한번 더 적용)
    const roundUpToTen = (value: number) => Math.ceil(value / 10) * 10;
    
    for (const product of validProducts) {
      const existing = await storage.getCurrentProductByCode(product.productCode);
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
      
      // Check access level (for public pages, return content)
      // Non-active pages require authentication
      if (page.status !== "active") {
        if (!req.session.userId) {
          return res.status(404).json({ message: "페이지를 찾을 수 없습니다" });
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
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

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
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `ORD-${dateStr}-${randomStr}`;
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
      
      // Check admin role if user type is "user" (not member)
      if (req.session.userType === "user") {
        const user = await storage.getUser(req.session.userId);
        if (user && (user.role === "SUPER_ADMIN" || user.role === "ADMIN")) {
          isAdmin = true;
        }
      }

      if (!isAdmin && !isMember) {
        return res.status(403).json({ message: "접근 권한이 없습니다" });
      }

      const baseCondition = isAdmin ? sql`1=1` : eq(pendingOrders.memberId, req.session.userId);

      // Total count (전체주문)
      const totalResult = await db.select({ count: sql<number>`count(*)::int` })
        .from(pendingOrders)
        .where(baseCondition);
      
      // Pending (주문대기) count
      const pendingResult = await db.select({ count: sql<number>`count(*)::int` })
        .from(pendingOrders)
        .where(isAdmin 
          ? eq(pendingOrders.status, "대기")
          : and(eq(pendingOrders.memberId, req.session.userId), eq(pendingOrders.status, "대기")));
      
      // Adjustment (주문조정) count
      const adjustmentResult = await db.select({ count: sql<number>`count(*)::int` })
        .from(pendingOrders)
        .where(isAdmin 
          ? eq(pendingOrders.status, "주문조정")
          : and(eq(pendingOrders.memberId, req.session.userId), eq(pendingOrders.status, "주문조정")));
      
      // Preparing (상품준비중) count
      const preparingResult = await db.select({ count: sql<number>`count(*)::int` })
        .from(pendingOrders)
        .where(isAdmin 
          ? eq(pendingOrders.status, "상품준비중")
          : and(eq(pendingOrders.memberId, req.session.userId), eq(pendingOrders.status, "상품준비중")));
      
      // Ready to ship (배송준비중) count
      const readyToShipResult = await db.select({ count: sql<number>`count(*)::int` })
        .from(pendingOrders)
        .where(isAdmin 
          ? eq(pendingOrders.status, "배송준비중")
          : and(eq(pendingOrders.memberId, req.session.userId), eq(pendingOrders.status, "배송준비중")));
      
      // Member cancelled (회원취소) count
      const memberCancelledResult = await db.select({ count: sql<number>`count(*)::int` })
        .from(pendingOrders)
        .where(isAdmin 
          ? eq(pendingOrders.status, "회원취소")
          : and(eq(pendingOrders.memberId, req.session.userId), eq(pendingOrders.status, "회원취소")));
      
      // Shipping (배송중) count
      const shippingResult = await db.select({ count: sql<number>`count(*)::int` })
        .from(pendingOrders)
        .where(isAdmin 
          ? eq(pendingOrders.status, "배송중")
          : and(eq(pendingOrders.memberId, req.session.userId), eq(pendingOrders.status, "배송중")));

      res.json({
        total: totalResult[0]?.count || 0,               // 전체주문
        pending: pendingResult[0]?.count || 0,           // 주문대기
        adjustment: adjustmentResult[0]?.count || 0,     // 주문조정
        preparing: preparingResult[0]?.count || 0,       // 상품준비중
        readyToShip: readyToShipResult[0]?.count || 0,   // 배송준비중
        memberCancelled: memberCancelledResult[0]?.count || 0, // 회원취소
        shipping: shippingResult[0]?.count || 0,         // 배송중
        isAdmin
      });
    } catch (error: any) {
      console.error("Order stats error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get pending orders for member
  app.get('/api/member/pending-orders', async (req, res) => {
    if (!req.session.userId || req.session.userType !== "member") {
      return res.status(401).json({ message: "회원 로그인이 필요합니다" });
    }

    try {
      const orders = await db.select()
        .from(pendingOrders)
        .where(eq(pendingOrders.memberId, req.session.userId))
        .orderBy(asc(pendingOrders.sequenceNumber));

      res.json(orders);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Generate sequence number: memberId + YYMMDD + 4-digit sequential number
  // Uses MAX to find highest existing sequence and increments, avoiding race conditions
  async function generateSequenceNumber(memberId: string): Promise<string> {
    const now = new Date();
    const year = String(now.getFullYear()).slice(-2); // Last 2 digits of year
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
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

  // Create pending order (member)
  app.post('/api/member/pending-orders', async (req, res) => {
    if (!req.session.userId || req.session.userType !== "member") {
      return res.status(401).json({ message: "회원 로그인이 필요합니다" });
    }

    try {
      const data = pendingOrderFormSchema.parse(req.body);

      // Get member info
      const member = await storage.getMember(req.session.userId);
      if (!member) {
        return res.status(404).json({ message: "회원 정보를 찾을 수 없습니다" });
      }

      // Look up product info by productCode - 현재공급상품에서 확인
      const productInfo = await storage.getProductRegistrationByCode(data.productCode);
      
      // 상품코드 유효성 체크: 현재공급상품에 없는 상품은 주문 불가
      if (!productInfo) {
        return res.status(400).json({ 
          message: `"${data.productName}" (${data.productCode})은(는) 현재 공급되지 않는 상품, 또는 상품코드오류입니다. 상품코드를 확인해주세요.` 
        });
      }
      
      // Generate sequence number with retry logic for concurrent requests
      let newOrder;
      let retries = 3;
      
      while (retries > 0) {
        try {
          // Generate sequence number (아이디+년도2자리+월일+순번4자리)
          const sequenceNumber = await generateSequenceNumber(member.username);
          
          const orderData = {
            sequenceNumber,
            orderNumber: generateOrderNumber(),
            memberId: req.session.userId,
            memberCompanyName: member.companyName,
            status: "대기",
            categoryLarge: productInfo?.categoryLarge || null,
            categoryMedium: productInfo?.categoryMedium || null,
            categorySmall: productInfo?.categorySmall || null,
            productCode: data.productCode,
            productName: data.productName,
            supplyPrice: productInfo?.topPrice || null,
            ordererName: data.ordererName,
            ordererPhone: data.ordererPhone,
            ordererAddress: data.ordererAddress || null,
            recipientName: data.recipientName,
            recipientMobile: data.recipientMobile,
            recipientPhone: data.recipientPhone || null,
            recipientAddress: data.recipientAddress,
            deliveryMessage: data.deliveryMessage || null,
            customOrderNumber: data.customOrderNumber,
            trackingNumber: null,
            courierCompany: null,
          };

          [newOrder] = await db.insert(pendingOrders).values(orderData).returning();
          break; // Success, exit retry loop
        } catch (insertError: any) {
          // Check for unique constraint violation (PostgreSQL error code 23505)
          if (insertError.code === '23505' && insertError.constraint?.includes('sequence_number')) {
            retries--;
            if (retries === 0) {
              throw new Error("순번 생성 중 오류가 발생했습니다. 다시 시도해주세요.");
            }
            // Small delay before retry
            await new Promise(resolve => setTimeout(resolve, 50));
          } else {
            throw insertError;
          }
        }
      }
      
      // SSE: 관리자에게 새 주문 알림
      sseManager.sendToAdmins("order-created", { 
        type: "pending-order",
        orderId: newOrder?.id,
        memberCompanyName: member.companyName 
      });
      
      // SSE: 해당 회원에게도 주문 등록 확인 알림
      sseManager.sendToMember(member.id, "order-created", {
        type: "pending-order",
        orderId: newOrder?.id
      });

      res.status(201).json(newOrder);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ error: error.message });
    }
  });

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

      // 정상건과 오류건을 분리
      const validRows: Array<{
        rowNum: number;
        productCode: string;
        productName: string;
        customOrderNumber: string;
        ordererName: string;
        ordererPhone: string;
        ordererAddress: string;
        recipientName: string;
        recipientMobile: string;
        recipientPhone: string;
        recipientAddress: string;
        deliveryMessage: string;
        currentProduct: any;
        validatedAddress?: string;
        addressWarning?: string;
      }> = [];
      
      const errorRows: Array<{
        rowNum: number;
        originalData: Record<string, any>;
        errorReason: string;
      }> = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2; // Excel rows start at 1, and header is row 1
        const missingFields: string[] = [];

        // Map Excel columns to order data (주문등록양식 columns)
        const productCode = String(row['상품코드'] || row['productCode'] || '').trim();
        const productName = String(row['상품명'] || row['productName'] || '').trim();
        const customOrderNumber = String(row['자체주문번호'] || row['customOrderNumber'] || '').trim();
        const ordererName = String(row['주문자명'] || row['ordererName'] || '').trim();
        const ordererPhone = String(row['주문자전화번호'] || row['주문자 전화번호'] || row['ordererPhone'] || '').trim();
        const ordererAddress = String(row['주문자주소'] || row['주문자 주소'] || row['ordererAddress'] || '').trim();
        const recipientName = String(row['수령자명'] || row['recipientName'] || '').trim();
        const recipientMobile = String(row['수령자휴대폰번호'] || row['수령자 휴대폰번호'] || row['recipientMobile'] || '').trim();
        const recipientPhone = String(row['수령자전화번호'] || row['수령자 전화번호'] || row['recipientPhone'] || '').trim();
        const recipientAddress = String(row['수령자주소'] || row['수령자 주소'] || row['recipientAddress'] || '').trim();
        const deliveryMessage = String(row['배송메시지'] || row['deliveryMessage'] || '').trim();

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

        // 주소 검증 (JUSO_API_KEY가 설정된 경우에만)
        let addressValidationResult: { status: AddressStatus; standardAddress?: string; fullAddress?: string; warningMessage?: string; errorMessage?: string } | null = null;
        if (process.env.JUSO_API_KEY && recipientAddress) {
          try {
            addressValidationResult = await validateSingleAddress(recipientAddress);
            
            // 주소 검증 실패 시 오류 처리
            if (addressValidationResult.status === 'invalid') {
              errorRows.push({
                rowNum,
                originalData: row,
                errorReason: `주소 오류: ${addressValidationResult.errorMessage || '건물을 찾을 수 없습니다'}`
              });
              continue;
            }
          } catch (addrError: any) {
            console.error(`주소 검증 오류 (${rowNum}번 줄):`, addrError.message);
            // 주소 검증 API 오류는 경고만 하고 진행 (검증 비활성화 상태와 동일하게 처리)
          }
        }

        // Store valid row for insertion (주소 검증 결과 포함)
        validRows.push({
          rowNum,
          productCode,
          productName,
          customOrderNumber,
          ordererName,
          ordererPhone,
          ordererAddress,
          recipientName,
          recipientMobile,
          recipientPhone,
          recipientAddress,
          deliveryMessage,
          currentProduct,
          validatedAddress: addressValidationResult?.fullAddress || addressValidationResult?.standardAddress,
          addressWarning: addressValidationResult?.warningMessage,
        });
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
        return res.json({
          status: 'validation_failed',
          message: "검증 오류가 있습니다. 정상건만 등록하거나 취소하세요.",
          total: rows.length,
          validCount: validRows.length,
          errorCount: errorRows.length,
          errors: errorRows.map(e => `${e.rowNum}번 줄: ${e.errorReason}`),
          errorExcelData: generateErrorExcelData(errorRows),
        });
      }

      // 정상건만 등록 진행 (오류 없거나 confirmPartial=true)
      let successCount = 0;
      for (const parsedRow of validRows) {
        // Generate sequence number
        const sequenceNumber = await generateSequenceNumber(member.username);

        // 회원 등급에 따른 공급가 결정 (start/driving/top)
        const memberTier = member.membershipTier || 'top';
        let supplyPrice = parsedRow.currentProduct.topPrice;
        if (memberTier === 'start') {
          supplyPrice = parsedRow.currentProduct.startPrice;
        } else if (memberTier === 'driving') {
          supplyPrice = parsedRow.currentProduct.drivingPrice;
        }

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
          ordererPhone: parsedRow.ordererPhone,
          ordererAddress: parsedRow.ordererAddress || null,
          recipientName: parsedRow.recipientName,
          recipientMobile: parsedRow.recipientMobile,
          recipientPhone: parsedRow.recipientPhone || null,
          recipientAddress: parsedRow.validatedAddress || parsedRow.recipientAddress,
          deliveryMessage: parsedRow.addressWarning 
            ? `${parsedRow.deliveryMessage || ''} [주소확인필요: ${parsedRow.addressWarning}]`.trim()
            : (parsedRow.deliveryMessage || null),
          customOrderNumber: parsedRow.customOrderNumber,
          trackingNumber: null,
          courierCompany: null,
        });

        successCount++;
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
        return res.json({
          status: 'partial_success',
          total: rows.length,
          success: successCount,
          failed: errorRows.length,
          errors: errorRows.map(e => `${e.rowNum}번 줄: ${e.errorReason}`),
          errorExcelData: generateErrorExcelData(errorRows),
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
      const { status, memberId } = req.query;
      
      let query = db.select().from(pendingOrders);
      
      if (status && typeof status === 'string') {
        query = query.where(eq(pendingOrders.status, status)) as any;
      }
      
      if (memberId && typeof memberId === 'string') {
        query = query.where(eq(pendingOrders.memberId, memberId)) as any;
      }
      
      const orders = await query.orderBy(asc(pendingOrders.sequenceNumber));
      res.json(orders);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
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
      const updateData: any = { updatedAt: new Date() };
      
      if (trackingNumber !== undefined) updateData.trackingNumber = trackingNumber;
      if (courierCompany !== undefined) updateData.courierCompany = courierCompany;
      if (status !== undefined && pendingOrderStatuses.includes(status)) {
        updateData.status = status;
      }

      const [updated] = await db.update(pendingOrders)
        .set(updateData)
        .where(eq(pendingOrders.id, id))
        .returning();

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
      const deleted = await db.delete(pendingOrders)
        .where(inArray(pendingOrders.id, ids))
        .returning();

      // SSE: 해당 회원들에게 주문 삭제 알림
      const memberIds = [...new Set(deleted.map(d => d.memberId).filter(Boolean))];
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
      const deleted = await db.delete(pendingOrders).returning();

      // SSE: 해당 회원들에게 주문 삭제 알림
      const memberIds = [...new Set(deleted.map(d => d.memberId).filter(Boolean))];
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
      const [deleted] = await db.delete(pendingOrders)
        .where(eq(pendingOrders.id, id))
        .returning();

      if (!deleted) {
        return res.status(404).json({ message: "주문을 찾을 수 없습니다" });
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
      // 1. 주문대기 상태의 주문들을 상품코드별로 그룹화
      const pendingOrdersList = await db.select()
        .from(pendingOrders)
        .where(eq(pendingOrders.status, "주문대기"));
      
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
      const result = Object.values(materialGroups).map(group => ({
        materialCode: group.materialCode,
        materialName: group.materialName,
        materialType: group.materialType,
        totalRequired: group.totalRequired,
        currentStock: group.currentStock,
        remainingStock: group.remainingStock,
        isDeficit: group.remainingStock < 0,
        products: group.products.map(p => ({
          productCode: p.productCode,
          productName: p.productName,
          orderCount: p.orderCount,
          materialQuantity: p.materialQuantity,
          requiredMaterial: p.requiredMaterial,
          orderIds: p.orders.map(o => o.id)
        }))
      }));

      res.json(result);
    } catch (error: any) {
      console.error("Order adjustment stock error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // 주문조정 실행 API - 공평 배분 알고리즘 적용
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
      
      // 전체 필요량 계산
      let totalRequired = 0;
      for (const p of products) {
        totalRequired += p.orderCount * p.materialQuantity;
      }

      if (totalRequired <= availableStock) {
        return res.json({ 
          message: "재고가 충분합니다. 조정이 필요하지 않습니다.",
          adjusted: false 
        });
      }

      // 공평 배분 알고리즘
      // 1. 충족 비율 계산
      const fulfillmentRatio = availableStock / totalRequired;
      
      // 2. 각 상품별 조정 수량 계산 (내림 처리)
      const adjustedProducts: {
        productCode: string;
        originalCount: number;
        adjustedCount: number;
        cancelCount: number;
        orderIds: string[];
      }[] = [];

      let totalAdjustedMaterial = 0;
      
      for (const p of products) {
        const adjustedCount = Math.floor(p.orderCount * fulfillmentRatio);
        const cancelCount = p.orderCount - adjustedCount;
        
        adjustedProducts.push({
          productCode: p.productCode,
          originalCount: p.orderCount,
          adjustedCount: adjustedCount,
          cancelCount: cancelCount,
          orderIds: p.orderIds
        });
        
        totalAdjustedMaterial += adjustedCount * p.materialQuantity;
      }

      // 3. 재고 초과 방지 검증
      if (totalAdjustedMaterial > availableStock) {
        // 추가 조정 필요 - 가장 많이 사용하는 상품부터 1개씩 감소
        adjustedProducts.sort((a, b) => {
          const aMatQty = products.find(p => p.productCode === a.productCode)?.materialQuantity || 0;
          const bMatQty = products.find(p => p.productCode === b.productCode)?.materialQuantity || 0;
          return bMatQty - aMatQty;
        });
        
        while (totalAdjustedMaterial > availableStock) {
          for (const ap of adjustedProducts) {
            if (ap.adjustedCount > 0 && totalAdjustedMaterial > availableStock) {
              const matQty = products.find(p => p.productCode === ap.productCode)?.materialQuantity || 1;
              ap.adjustedCount--;
              ap.cancelCount++;
              totalAdjustedMaterial -= matQty;
            }
          }
        }
      }

      // 4. 주문 상태 업데이트 (취소할 주문들)
      const cancelledOrderIds: string[] = [];
      
      for (const ap of adjustedProducts) {
        if (ap.cancelCount > 0) {
          // cancelCount 개수만큼 주문을 '주문조정' 상태로 변경
          const orderIdsToCancel = ap.orderIds.slice(0, ap.cancelCount);
          
          for (const orderId of orderIdsToCancel) {
            await db.update(pendingOrders)
              .set({ 
                status: "주문조정",
                updatedAt: new Date()
              })
              .where(eq(pendingOrders.id, orderId));
            cancelledOrderIds.push(orderId);
          }
        }
      }

      // SSE 알림
      sseManager.sendToAdmins("order-adjusted", {
        type: "order-adjustment",
        materialCode,
        cancelledCount: cancelledOrderIds.length
      });

      res.json({
        adjusted: true,
        message: `${cancelledOrderIds.length}건의 주문이 조정되었습니다.`,
        adjustedProducts,
        cancelledOrderIds,
        summary: {
          availableStock,
          totalRequired,
          fulfillmentRatio: Math.round(fulfillmentRatio * 100) / 100,
          usedStock: totalAdjustedMaterial
        }
      });
    } catch (error: any) {
      console.error("Order adjustment execute error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  return httpServer;
}
