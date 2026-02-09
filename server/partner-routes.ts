import { Router, Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db } from "./db";
import { vendors, allocationDetails, orderAllocations, pendingOrders } from "@shared/schema";
import { eq, and, desc, asc, gte, lte, or, sql, inArray, isNull, isNotNull } from "drizzle-orm";

const JWT_SECRET = process.env.JWT_SECRET;
const PARTNER_COOKIE = "partner_token";
const isProduction = process.env.NODE_ENV === "production";

const PARTNER_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? ("strict" as const) : ("lax" as const),
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/",
};

interface PartnerPayload {
  vendorId: number;
  loginId: string;
  companyName: string;
  userType: "vendor";
  iat?: number;
  exp?: number;
}

declare global {
  namespace Express {
    interface Request {
      partner?: PartnerPayload;
    }
  }
}

function generatePartnerToken(payload: Omit<PartnerPayload, "iat" | "exp">): string | null {
  if (!JWT_SECRET) return null;
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

function verifyPartnerToken(token: string): PartnerPayload | null {
  if (!JWT_SECRET) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as PartnerPayload;
    if (decoded.userType !== "vendor") return null;
    return decoded;
  } catch {
    return null;
  }
}

function partnerAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[PARTNER_COOKIE];
  if (!token) return res.status(401).json({ message: "인증이 필요합니다" });
  const payload = verifyPartnerToken(token);
  if (!payload) return res.status(401).json({ message: "유효하지 않은 인증입니다" });
  req.partner = payload;
  next();
}

const router = Router();

router.post("/login", async (req: Request, res: Response) => {
  try {
    const { loginId, loginPassword } = req.body;
    if (!loginId || !loginPassword) {
      return res.status(400).json({ message: "아이디와 비밀번호를 입력해 주세요" });
    }

    const [vendor] = await db.select().from(vendors).where(eq(vendors.loginId, loginId)).limit(1);
    if (!vendor || !vendor.loginPassword) {
      return res.status(401).json({ message: "아이디 또는 비밀번호가 올바르지 않습니다" });
    }

    if (!vendor.isActive) {
      return res.status(403).json({ message: "비활성 계정입니다. 관리자에게 문의해 주세요." });
    }

    const bcrypt = await import("bcryptjs");
    const valid = await bcrypt.compare(loginPassword, vendor.loginPassword);
    if (!valid) {
      return res.status(401).json({ message: "아이디 또는 비밀번호가 올바르지 않습니다" });
    }

    const token = generatePartnerToken({
      vendorId: vendor.id,
      loginId: vendor.loginId!,
      companyName: vendor.companyName,
      userType: "vendor",
    });

    if (!token) {
      return res.status(500).json({ message: "인증 토큰 생성에 실패했습니다" });
    }

    res.cookie(PARTNER_COOKIE, token, PARTNER_COOKIE_OPTIONS);
    const { loginPassword: _, ...vendorData } = vendor;
    res.json({ vendor: vendorData });
  } catch (error: any) {
    console.error("Partner login error:", error);
    res.status(500).json({ message: "로그인 처리 중 오류가 발생했습니다" });
  }
});

router.post("/logout", (_req: Request, res: Response) => {
  res.clearCookie(PARTNER_COOKIE, { path: "/" });
  res.json({ message: "로그아웃 되었습니다" });
});

router.get("/me", partnerAuth, async (req: Request, res: Response) => {
  try {
    const [vendor] = await db.select().from(vendors).where(eq(vendors.id, req.partner!.vendorId)).limit(1);
    if (!vendor) return res.status(404).json({ message: "업체 정보를 찾을 수 없습니다" });
    const { loginPassword: _, ...vendorData } = vendor;
    res.json(vendorData);
  } catch (error: any) {
    res.status(500).json({ message: "업체 정보 조회 실패" });
  }
});

router.get("/dashboard", partnerAuth, async (req: Request, res: Response) => {
  try {
    const vendorId = req.partner!.vendorId;

    const pendingAllocations = await db.select({ count: sql<number>`count(*)::int` })
      .from(allocationDetails)
      .where(and(
        eq(allocationDetails.vendorId, vendorId),
        inArray(allocationDetails.status, ["notified", "pending"])
      ));

    const unprocessedOrders = await db.select({ count: sql<number>`count(*)::int` })
      .from(pendingOrders)
      .where(and(
        eq(pendingOrders.vendorId, vendorId),
        inArray(pendingOrders.status, ["대기", "상품준비중"]),
        isNull(pendingOrders.trackingNumber)
      ));

    const unregisteredTracking = await db.select({ count: sql<number>`count(*)::int` })
      .from(pendingOrders)
      .where(and(
        eq(pendingOrders.vendorId, vendorId),
        isNotNull(pendingOrders.vendorId),
        isNull(pendingOrders.trackingNumber),
        or(
          eq(pendingOrders.status, "상품준비중"),
          eq(pendingOrders.status, "배송준비중")
        )
      ));

    const inShipping = await db.select({ count: sql<number>`count(*)::int` })
      .from(pendingOrders)
      .where(and(
        eq(pendingOrders.vendorId, vendorId),
        eq(pendingOrders.status, "배송중")
      ));

    res.json({
      pendingAllocations: pendingAllocations[0]?.count || 0,
      unprocessedOrders: unprocessedOrders[0]?.count || 0,
      unregisteredTracking: unregisteredTracking[0]?.count || 0,
      inShipping: inShipping[0]?.count || 0,
    });
  } catch (error: any) {
    res.status(500).json({ message: "대시보드 데이터 조회 실패" });
  }
});

router.get("/allocations", partnerAuth, async (req: Request, res: Response) => {
  try {
    const vendorId = req.partner!.vendorId;
    const filter = req.query.filter as string || "all";

    let statusFilter;
    if (filter === "pending") {
      statusFilter = inArray(allocationDetails.status, ["notified", "pending"]);
    } else if (filter === "responded") {
      statusFilter = inArray(allocationDetails.status, ["responded", "confirmed", "rejected"]);
    }

    const conditions = [eq(allocationDetails.vendorId, vendorId)];
    if (statusFilter) conditions.push(statusFilter);

    const details = await db.select({
      detail: allocationDetails,
      allocation: {
        id: orderAllocations.id,
        allocationDate: orderAllocations.allocationDate,
        productCode: orderAllocations.productCode,
        productName: orderAllocations.productName,
        status: orderAllocations.status,
      },
    })
    .from(allocationDetails)
    .innerJoin(orderAllocations, eq(allocationDetails.allocationId, orderAllocations.id))
    .where(and(...conditions))
    .orderBy(desc(allocationDetails.createdAt));

    const result = details.map(d => ({
      id: d.detail.id,
      allocationId: d.detail.allocationId,
      allocationDate: d.allocation.allocationDate,
      productCode: d.allocation.productCode,
      productName: d.allocation.productName,
      requestedQuantity: d.detail.requestedQuantity,
      confirmedQuantity: d.detail.confirmedQuantity,
      status: d.detail.status,
      notifiedAt: d.detail.notifiedAt,
      respondedAt: d.detail.respondedAt,
      confirmedAt: d.detail.confirmedAt,
      memo: d.detail.memo,
      allocationStatus: d.allocation.status,
    }));

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ message: "배분 목록 조회 실패" });
  }
});

router.put("/allocations/:id/respond", partnerAuth, async (req: Request, res: Response) => {
  try {
    const vendorId = req.partner!.vendorId;
    const detailId = parseInt(req.params.id);
    const { availableQuantity, memo } = req.body;

    if (availableQuantity === undefined || availableQuantity === null) {
      return res.status(400).json({ message: "가능수량을 입력해 주세요" });
    }

    const [detail] = await db.select().from(allocationDetails).where(eq(allocationDetails.id, detailId)).limit(1);
    if (!detail) return res.status(404).json({ message: "배분 상세를 찾을 수 없습니다" });
    if (detail.vendorId !== vendorId) return res.status(403).json({ message: "권한이 없습니다" });
    if (detail.status !== "notified" && detail.status !== "pending") {
      return res.status(400).json({ message: "이미 응답한 배분입니다" });
    }

    await db.update(allocationDetails)
      .set({
        confirmedQuantity: availableQuantity,
        status: "responded",
        respondedAt: new Date(),
        memo: memo || detail.memo,
        updatedAt: new Date(),
      })
      .where(eq(allocationDetails.id, detailId));

    const [allocation] = await db.select().from(orderAllocations).where(eq(orderAllocations.id, detail.allocationId)).limit(1);
    if (allocation) {
      const allDetails = await db.select().from(allocationDetails).where(eq(allocationDetails.allocationId, allocation.id));
      const allResponded = allDetails.every(d => d.id === detailId || ["responded", "confirmed", "rejected"].includes(d.status || ""));
      if (allResponded && allocation.status === "waiting") {
        // Don't auto-advance, admin confirms manually
      }
    }

    res.json({ message: "응답이 등록되었습니다" });
  } catch (error: any) {
    res.status(500).json({ message: "응답 등록 실패" });
  }
});

router.get("/orders", partnerAuth, async (req: Request, res: Response) => {
  try {
    const vendorId = req.partner!.vendorId;
    const { startDate, endDate, status, search, page = "1", limit = "50" } = req.query;

    const conditions = [eq(pendingOrders.vendorId, vendorId)];

    if (startDate) {
      const start = new Date(startDate as string);
      start.setHours(0, 0, 0, 0);
      conditions.push(gte(pendingOrders.createdAt, start));
    }
    if (endDate) {
      const end = new Date(endDate as string);
      end.setHours(23, 59, 59, 999);
      conditions.push(lte(pendingOrders.createdAt, end));
    }
    if (status && status !== "all") {
      conditions.push(eq(pendingOrders.status, status as string));
    }
    if (search) {
      const s = `%${search}%`;
      conditions.push(or(
        sql`${pendingOrders.productName} ILIKE ${s}`,
        sql`${pendingOrders.recipientName} ILIKE ${s}`,
        sql`CAST(${pendingOrders.id} AS TEXT) ILIKE ${s}`
      )!);
    }

    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 50;
    const offset = (pageNum - 1) * limitNum;

    const totalResult = await db.select({ count: sql<number>`count(*)::int` })
      .from(pendingOrders)
      .where(and(...conditions));

    const orders = await db.select()
      .from(pendingOrders)
      .where(and(...conditions))
      .orderBy(desc(pendingOrders.createdAt))
      .limit(limitNum)
      .offset(offset);

    const statusCounts = await db.select({
      status: pendingOrders.status,
      count: sql<number>`count(*)::int`,
    })
      .from(pendingOrders)
      .where(eq(pendingOrders.vendorId, vendorId))
      .groupBy(pendingOrders.status);

    res.json({
      orders,
      total: totalResult[0]?.count || 0,
      page: pageNum,
      limit: limitNum,
      statusCounts: statusCounts.reduce((acc, s) => { acc[s.status] = s.count; return acc; }, {} as Record<string, number>),
    });
  } catch (error: any) {
    res.status(500).json({ message: "주문 목록 조회 실패" });
  }
});

router.get("/orders/download", partnerAuth, async (req: Request, res: Response) => {
  try {
    const XLSX = await import("xlsx");
    const vendorId = req.partner!.vendorId;
    const { startDate, endDate, status } = req.query;

    const conditions = [eq(pendingOrders.vendorId, vendorId)];
    if (startDate) {
      const start = new Date(startDate as string);
      start.setHours(0, 0, 0, 0);
      conditions.push(gte(pendingOrders.createdAt, start));
    }
    if (endDate) {
      const end = new Date(endDate as string);
      end.setHours(23, 59, 59, 999);
      conditions.push(lte(pendingOrders.createdAt, end));
    }
    if (status && status !== "all") {
      conditions.push(eq(pendingOrders.status, status as string));
    }

    const orders = await db.select()
      .from(pendingOrders)
      .where(and(...conditions))
      .orderBy(desc(pendingOrders.createdAt));

    const data = orders.map(o => ({
      "주문번호": o.id,
      "주문자명": o.ordererName || "",
      "수취인명": o.recipientName || "",
      "수취인 연락처": o.recipientPhone || "",
      "우편번호": o.postalCode || "",
      "기본주소": o.address || "",
      "상세주소": o.addressDetail || "",
      "상품명": o.productName || "",
      "수량": o.quantity || 1,
      "주문일": o.createdAt ? new Date(o.createdAt).toLocaleDateString("ko-KR") : "",
      "메모": o.memo || "",
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "주문목록");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const companyName = req.partner!.companyName || "업체";
    const dateStr = new Date().toISOString().split("T")[0];
    const filename = encodeURIComponent(`탑셀러_주문목록_${companyName}_${dateStr}.xlsx`);

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${filename}`);
    res.send(buf);
  } catch (error: any) {
    console.error("Partner orders download error:", error);
    res.status(500).json({ message: "엑셀 다운로드 실패" });
  }
});

router.put("/orders/:id/tracking", partnerAuth, async (req: Request, res: Response) => {
  try {
    const vendorId = req.partner!.vendorId;
    const orderId = req.params.id;
    const { trackingNumber, courierCompany } = req.body;

    if (!trackingNumber || !courierCompany) {
      return res.status(400).json({ message: "택배사와 운송장 번호를 입력해 주세요" });
    }

    const [order] = await db.select().from(pendingOrders).where(eq(pendingOrders.id, orderId)).limit(1);
    if (!order) return res.status(404).json({ message: "주문을 찾을 수 없습니다" });
    if (order.vendorId !== vendorId) return res.status(403).json({ message: "권한이 없습니다" });

    await db.update(pendingOrders)
      .set({
        trackingNumber,
        courierCompany,
        updatedAt: new Date(),
      })
      .where(eq(pendingOrders.id, orderId));

    res.json({ message: "운송장이 등록되었습니다" });
  } catch (error: any) {
    res.status(500).json({ message: "운송장 등록 실패" });
  }
});

router.post("/orders/tracking/bulk", partnerAuth, async (req: Request, res: Response) => {
  try {
    const XLSX = await import("xlsx");
    const multer = (await import("multer")).default;
    const upload = multer({ storage: multer.memoryStorage() }).single("file");

    await new Promise<void>((resolve, reject) => {
      upload(req, res, (err) => err ? reject(err) : resolve());
    });

    if (!req.file) return res.status(400).json({ message: "파일을 업로드해 주세요" });

    const vendorId = req.partner!.vendorId;
    const wb = XLSX.read(req.file.buffer, { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws);

    const results = { success: 0, failed: 0, failedList: [] as { row: number; orderNumber: string; reason: string }[] };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const orderNumber = String(row["주문번호"] || "").trim();
      const courierCompany = String(row["택배사"] || "").trim();
      const trackingNumber = String(row["운송장번호"] || "").trim();

      if (!orderNumber || !courierCompany || !trackingNumber) {
        results.failed++;
        results.failedList.push({ row: i + 2, orderNumber, reason: "필수 항목 누락" });
        continue;
      }

      const [order] = await db.select().from(pendingOrders).where(eq(pendingOrders.id, orderNumber)).limit(1);
      if (!order) {
        results.failed++;
        results.failedList.push({ row: i + 2, orderNumber, reason: "주문번호 불일치" });
        continue;
      }
      if (order.vendorId !== vendorId) {
        results.failed++;
        results.failedList.push({ row: i + 2, orderNumber, reason: "다른 업체 주문" });
        continue;
      }

      await db.update(pendingOrders)
        .set({ trackingNumber, courierCompany, updatedAt: new Date() })
        .where(eq(pendingOrders.id, orderNumber));
      results.success++;
    }

    res.json(results);
  } catch (error: any) {
    console.error("Bulk tracking upload error:", error);
    res.status(500).json({ message: "일괄 등록 실패" });
  }
});

router.get("/orders/tracking/template", partnerAuth, async (req: Request, res: Response) => {
  try {
    const XLSX = await import("xlsx");
    const vendorId = req.partner!.vendorId;

    const unregistered = await db.select({
      id: pendingOrders.id,
      recipientName: pendingOrders.recipientName,
      productName: pendingOrders.productName,
    })
      .from(pendingOrders)
      .where(and(
        eq(pendingOrders.vendorId, vendorId),
        isNull(pendingOrders.trackingNumber),
        or(
          eq(pendingOrders.status, "상품준비중"),
          eq(pendingOrders.status, "배송준비중"),
          eq(pendingOrders.status, "대기")
        )
      ))
      .orderBy(pendingOrders.createdAt);

    const data = unregistered.map(o => ({
      "주문번호": o.id,
      "수취인명": o.recipientName || "",
      "상품명": o.productName || "",
      "택배사": "",
      "운송장번호": "",
    }));

    if (data.length === 0) {
      data.push({ "주문번호": "", "수취인명": "", "상품명": "", "택배사": "", "운송장번호": "" });
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "운송장등록");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const filename = encodeURIComponent("운송장등록_양식.xlsx");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${filename}`);
    res.send(buf);
  } catch (error: any) {
    res.status(500).json({ message: "템플릿 다운로드 실패" });
  }
});

router.get("/delivery", partnerAuth, async (req: Request, res: Response) => {
  try {
    const vendorId = req.partner!.vendorId;
    const { startDate, endDate, status, search, page = "1", limit = "50" } = req.query;

    const conditions = [
      eq(pendingOrders.vendorId, vendorId),
      isNotNull(pendingOrders.trackingNumber),
    ];

    if (startDate) {
      const start = new Date(startDate as string);
      start.setHours(0, 0, 0, 0);
      conditions.push(gte(pendingOrders.updatedAt, start));
    }
    if (endDate) {
      const end = new Date(endDate as string);
      end.setHours(23, 59, 59, 999);
      conditions.push(lte(pendingOrders.updatedAt, end));
    }
    if (status && status !== "all") {
      conditions.push(eq(pendingOrders.status, status as string));
    }
    if (search) {
      const s = `%${search}%`;
      conditions.push(or(
        sql`${pendingOrders.recipientName} ILIKE ${s}`,
        sql`CAST(${pendingOrders.id} AS TEXT) ILIKE ${s}`
      )!);
    }

    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 50;
    const offset = (pageNum - 1) * limitNum;

    const totalResult = await db.select({ count: sql<number>`count(*)::int` })
      .from(pendingOrders)
      .where(and(...conditions));

    const orders = await db.select()
      .from(pendingOrders)
      .where(and(...conditions))
      .orderBy(desc(pendingOrders.updatedAt))
      .limit(limitNum)
      .offset(offset);

    res.json({
      orders,
      total: totalResult[0]?.count || 0,
      page: pageNum,
      limit: limitNum,
    });
  } catch (error: any) {
    res.status(500).json({ message: "배송 현황 조회 실패" });
  }
});

router.get("/delivery/summary", partnerAuth, async (req: Request, res: Response) => {
  try {
    const vendorId = req.partner!.vendorId;
    const period = (req.query.period as string) || "today";

    const now = new Date();
    let start: Date;
    if (period === "week") {
      start = new Date(now);
      start.setDate(start.getDate() - start.getDay());
      start.setHours(0, 0, 0, 0);
    } else if (period === "month") {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      start = new Date(now);
      start.setHours(0, 0, 0, 0);
    }

    const baseConditions = [
      eq(pendingOrders.vendorId, vendorId),
      isNotNull(pendingOrders.trackingNumber),
      gte(pendingOrders.updatedAt, start),
    ];

    const totalSent = await db.select({ count: sql<number>`count(*)::int` })
      .from(pendingOrders)
      .where(and(...baseConditions));

    const inTransit = await db.select({ count: sql<number>`count(*)::int` })
      .from(pendingOrders)
      .where(and(...baseConditions, eq(pendingOrders.status, "배송중")));

    const delivered = await db.select({ count: sql<number>`count(*)::int` })
      .from(pendingOrders)
      .where(and(...baseConditions, eq(pendingOrders.status, "배송완료")));

    const total = totalSent[0]?.count || 0;
    const deliveredCount = delivered[0]?.count || 0;

    res.json({
      totalSent: total,
      inTransit: inTransit[0]?.count || 0,
      delivered: deliveredCount,
      deliveryRate: total > 0 ? Math.round((deliveredCount / total) * 100) : 0,
    });
  } catch (error: any) {
    res.status(500).json({ message: "배송 통계 조회 실패" });
  }
});

export default router;
