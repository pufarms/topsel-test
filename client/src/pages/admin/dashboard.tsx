import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSSE } from "@/hooks/use-sse";
import { useAuth } from "@/lib/auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, 
  Users, 
  UserPlus, 
  UserCheck,
  Star,
  Zap,
  Crown,
  TrendingUp,
  Calendar,
  Clock,
  Package,
  Truck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  MessageSquare,
  HelpCircle,
  FileText,
  Gift,
  Percent,
  Trash2,
  Megaphone
} from "lucide-react";
import type { User, Order, Member } from "@shared/schema";
import { DateRangeFilter, useDateRange } from "@/components/common/DateRangeFilter";

function SectionBadge({ number, color }: { number: number; color: string }) {
  return (
    <span className={`flex items-center justify-center w-6 h-6 rounded-full ${color} text-white text-xs font-bold shrink-0`}>
      {number}
    </span>
  );
}

export default function AdminDashboard() {
  useSSE();
  const { user } = useAuth();
  const { toast } = useToast();
  const { dateRange, setDateRange } = useDateRange("today");
  const [resetStep, setResetStep] = useState<0 | 1 | 2>(0);
  const [confirmText, setConfirmText] = useState("");

  const isSuperOwner = user?.username === "kgong5026";

  const resetMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/reset-test-data", {});
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "테스트 데이터 초기화 완료",
        description: data.message,
      });
      setResetStep(0);
      setConfirmText("");
      queryClient.invalidateQueries();
    },
    onError: (error: any) => {
      toast({
        title: "초기화 실패",
        description: error.message || "초기화 중 오류가 발생했습니다",
        variant: "destructive",
      });
    },
  });

  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
  });

  const { data: members = [], isLoading: membersLoading } = useQuery<Member[]>({
    queryKey: ["/api/admin/members"],
  });

  const { data: orders = [], isLoading: ordersLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/pending-orders", dateRange.startDate, dateRange.endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateRange.startDate) params.set("startDate", dateRange.startDate);
      if (dateRange.endDate) params.set("endDate", dateRange.endDate);
      const res = await fetch(`/api/admin/pending-orders?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: salesStats } = useQuery<{
    todaySales: number;
    yesterdaySales: number;
    lastMonthSales: number;
    thisMonthSales: number;
    trendPercent: number | null;
    confirmed: { today: number; yesterday: number; lastMonth: number; thisMonth: number };
    projected: { today: number; yesterday: number; lastMonth: number; thisMonth: number };
    projectedStatusCounts: {
      today: { pending: number; preparing: number; readyToShip: number };
      yesterday: { pending: number; preparing: number; readyToShip: number };
      lastMonth: { pending: number; preparing: number; readyToShip: number };
      thisMonth: { pending: number; preparing: number; readyToShip: number };
    };
  }>({
    queryKey: ["/api/admin/sales-stats"],
  });

  const { data: orderStats } = useQuery<{
    total: number;
    pending: number;
    adjustment: number;
    preparing: number;
    readyToShip: number;
    memberCancelled: number;
    shipping: number;
  }>({
    queryKey: ["/api/order-stats", dateRange.startDate, dateRange.endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateRange.startDate) params.set("startDate", dateRange.startDate);
      if (dateRange.endDate) params.set("endDate", dateRange.endDate);
      const res = await fetch(`/api/order-stats?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const today = new Date();
  const formattedDate = today.toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  const formattedDateShort = today.toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).replace(/\. /g, "-").replace(".", "");

  if (usersLoading || ordersLoading || membersLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const activeMembers = members.filter(m => m.status === "활성").length;
  const pendingMembers = members.filter(m => m.grade === "PENDING").length;
  
  const tierCounts = {
    ASSOCIATE: members.filter(m => m.grade === "ASSOCIATE" && m.status === "활성").length,
    START: members.filter(m => m.grade === "START" && m.status === "활성").length,
    DRIVING: members.filter(m => m.grade === "DRIVING" && m.status === "활성").length,
    TOP: members.filter(m => m.grade === "TOP" && m.status === "활성").length,
  };

  const sampleEvents = [
    { company: "농협", period: "01.15 - 01.31", item: "제주 감귤", code: "EVT001", coupon: "10%", status: "ended" as const },
    { company: "이마트", period: "01.20 - 02.05", item: "청송 사과", code: "EVT002", coupon: "15%", status: "ending" as const },
    { company: "롯데마트", period: "02.01 - 02.14", item: "성주 참외", code: "EVT003", coupon: "20%", status: "active" as const },
  ];

  const activeEventsCount = sampleEvents.filter(e => e.status === "active" || e.status === "ending").length;

  const sampleNotices = [
    { type: "긴급", title: "2월 설 연휴 배송 일정 안내", date: "02-10", typeColor: "bg-red-500" },
    { type: "안내", title: "신규 회원 가입 이벤트 진행", date: "02-05", typeColor: "bg-blue-500" },
    { type: "안내", title: "2월 행사 상품 업데이트 안내", date: "02-01", typeColor: "bg-blue-500" },
    { type: "점검", title: "시스템 정기 점검 안내 (2/15)", date: "01-28", typeColor: "bg-amber-500" },
    { type: "안내", title: "1월 정산 완료 안내", date: "01-15", typeColor: "bg-blue-500" },
  ];

  const buildStatusMessage = (counts: { pending: number; preparing: number; readyToShip: number } | undefined, timeLabel: string): string | undefined => {
    if (!counts) return undefined;
    const parts: string[] = [];
    if (counts.preparing > 0) parts.push(`상품준비중 ${counts.preparing}건`);
    if (counts.readyToShip > 0) parts.push(`배송준비중 ${counts.readyToShip}건`);
    if (counts.pending > 0) parts.push(`대기 ${counts.pending}건`);
    if (parts.length === 0) return undefined;
    return `${timeLabel} ${parts.join(', ')}이 남아있습니다`;
  };

  const orderCardDefs = [
    { label: "전체주문", value: orderStats?.total || 0, icon: <Package className="h-3.5 w-3.5" />, bg: "bg-yellow-50", border: "border-yellow-200", text: "text-blue-700", iconColor: "text-blue-500" },
    { label: "주문대기", value: orderStats?.pending || 0, icon: <Clock className="h-3.5 w-3.5" />, bg: "bg-yellow-50", border: "border-yellow-200", text: "text-red-600", iconColor: "text-red-500" },
    { label: "주문조정", value: orderStats?.adjustment || 0, icon: <AlertCircle className="h-3.5 w-3.5" />, bg: "bg-yellow-50", border: "border-yellow-200", text: "text-blue-700", iconColor: "text-blue-500" },
    { label: "상품준비중", value: orderStats?.preparing || 0, icon: <Package className="h-3.5 w-3.5" />, bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-700", iconColor: "text-purple-500" },
    { label: "배송준비중", value: orderStats?.readyToShip || 0, icon: <Truck className="h-3.5 w-3.5" />, bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", iconColor: "text-blue-500", sub: "운송장미등록건 · 직접배송건전용" },
    { label: "취합/취소", value: orderStats?.memberCancelled || 0, icon: <XCircle className="h-3.5 w-3.5" />, bg: "bg-red-50", border: "border-red-200", text: "text-red-600", iconColor: "text-red-500" },
    { label: "배송중", value: orderStats?.shipping || 0, icon: <CheckCircle2 className="h-3.5 w-3.5" />, bg: "bg-green-50", border: "border-green-200", text: "text-green-700", iconColor: "text-green-500" },
  ];

  const memberCardDefs = [
    { label: "총회원수", value: activeMembers, unit: "명", color: "text-blue-600", bg: "bg-blue-100", border: "border-blue-300", icon: <Users className="h-4 w-4" /> },
    { label: "승인대기", value: pendingMembers, unit: "명", color: "text-amber-600", bg: "bg-amber-100", border: "border-amber-300", icon: <UserPlus className="h-4 w-4" /> },
    { label: "준회원", value: tierCounts.ASSOCIATE, unit: "명", color: "text-gray-600", bg: "bg-gray-100", border: "border-gray-300", icon: <UserCheck className="h-4 w-4" /> },
    { label: "Start회원", value: tierCounts.START, unit: "명", color: "text-yellow-600", bg: "bg-yellow-100", border: "border-yellow-300", icon: <Star className="h-4 w-4" /> },
    { label: "Driving회원", value: tierCounts.DRIVING, unit: "명", color: "text-purple-600", bg: "bg-purple-100", border: "border-purple-300", icon: <Zap className="h-4 w-4" /> },
    { label: "Top회원", value: tierCounts.TOP, unit: "명", color: "text-emerald-600", bg: "bg-emerald-100", border: "border-emerald-300", icon: <Crown className="h-4 w-4" /> },
  ];

  const inquiryCardDefs = [
    { label: "일반 문의", value: 0, icon: <HelpCircle className="h-4 w-4" />, border: "border-blue-300", text: "text-blue-600" },
    { label: "상품 CS/미수", value: 0, icon: <AlertCircle className="h-4 w-4" />, border: "border-red-300", text: "text-red-600" },
    { label: "정산/계산서", value: 0, icon: <FileText className="h-4 w-4" />, border: "border-yellow-300", text: "text-yellow-600" },
    { label: "회원정보(등급)", value: 0, icon: <Users className="h-4 w-4" />, border: "border-orange-300", text: "text-orange-600" },
    { label: "행사특가/변경", value: 0, icon: <Gift className="h-4 w-4" />, border: "border-green-300", text: "text-green-600" },
    { label: "기타", value: 0, icon: <MessageSquare className="h-4 w-4" />, border: "border-gray-300", text: "text-gray-600" },
  ];

  return (
    <div className="p-5 space-y-8">
      {/* 페이지 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h1 className="text-xl md:text-2xl font-bold text-indigo-900 dark:text-indigo-300" data-testid="text-dashboard-title">관리자 대시보드</h1>
        <div className="flex items-center gap-3 flex-wrap">
          {isSuperOwner && (
            <Button
              variant="outline"
              size="sm"
              className="text-muted-foreground"
              onClick={() => setResetStep(1)}
              data-testid="button-open-reset-dialog"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              데이터 초기화
            </Button>
          )}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>{formattedDate}</span>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════ */}
      {/* 1행: 주문/배송 현황 — 전체 너비 (크림색)                   */}
      {/* ════════════════════════════════════════════════════════ */}
        <div className="bg-amber-50 dark:bg-amber-950/30 rounded-xl px-5 pt-5 pb-12 border-2 border-amber-300 dark:border-amber-700 shadow-lg" data-testid="section-order-status">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <SectionBadge number={1} color="bg-amber-500" />
              <h2 className="text-gray-900 dark:text-gray-100 font-bold text-sm">주문/배송 현황</h2>
            </div>
            <div className="flex flex-col items-end gap-1">
              <DateRangeFilter onChange={setDateRange} defaultPreset="today" />
              <span className="text-xs text-gray-500 dark:text-gray-400">
                <Calendar className="h-3 w-3 inline mr-1" />
                {formattedDateShort} (오늘)
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            {orderCardDefs.map((item, i) => (
              <div key={i} className={`flex-1 ${item.bg} dark:bg-opacity-20 rounded-lg overflow-hidden shadow-sm border ${item.border} dark:border-opacity-40 p-3.5 cursor-pointer transition-all hover:shadow-md`} data-testid={`card-order-${item.label}`}>
                <div className="flex items-center gap-1 mb-1.5">
                  <span className={`${item.iconColor}`}>{item.icon}</span>
                  <span className="text-xs text-gray-600 dark:text-gray-300 font-medium">{item.label}</span>
                </div>
                <div className={`text-xl font-bold ${item.text}`}>
                  {item.value}<span className="text-sm font-normal ml-0.5">건</span>
                </div>
                {item.sub && <div className="text-xs text-gray-400 mt-1 truncate">{item.sub}</div>}
              </div>
            ))}
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════ */}
        {/* 2행: 회원 현황 + 문의 현황 — 가로 2열                      */}
        {/* ════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* 회원 현황 — 다크 네이비 */}
          <div className="bg-slate-600 dark:bg-slate-700 rounded-xl px-5 py-5" data-testid="section-member-status">
            <div className="flex items-center gap-2 mb-4">
              <SectionBadge number={2} color="bg-blue-500" />
              <h2 className="text-white font-bold text-sm">회원 현황</h2>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {memberCardDefs.map((item, i) => (
                <div key={i} className={`${item.bg} border ${item.border} rounded-lg p-3.5 cursor-pointer transition-all hover:shadow-md`} data-testid={`card-member-${item.label}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-gray-600 font-medium">{item.label}</span>
                    <span className="text-muted-foreground">{item.icon}</span>
                  </div>
                  <div className={`text-xl font-bold ${item.color}`}>
                    {item.value}<span className="text-xs font-normal ml-0.5 text-gray-500">{item.unit}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 문의 현황 — 연보라 */}
          <div className="bg-violet-50 dark:bg-violet-950/30 rounded-xl px-5 py-5 border-2 border-violet-300 dark:border-violet-700 shadow-lg" data-testid="section-inquiry-status">
            <div className="flex items-center gap-2 mb-3">
              <SectionBadge number={3} color="bg-violet-500" />
              <h2 className="text-gray-900 dark:text-gray-100 font-bold text-sm">문의 현황</h2>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {inquiryCardDefs.map((item, i) => (
                <div key={i} className={`bg-white dark:bg-gray-800 rounded-lg border-2 ${item.border} dark:border-opacity-40 p-3.5 text-center cursor-pointer transition-all hover:shadow-md`} data-testid={`card-inquiry-${item.label}`}>
                  <div className="flex justify-center mb-1 text-muted-foreground">{item.icon}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1 truncate">{item.label}</div>
                  <div className={`text-lg font-bold ${item.text}`}>{item.value}<span className="text-xs ml-0.5">개</span></div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════ */}
        {/* 3행: 매출 현황 — 전체 너비 (흰색 + 초록 하단보더)           */}
        {/* ════════════════════════════════════════════════════════ */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border-b-4 border-emerald-400 px-5 py-5 shadow-lg" data-testid="section-sales-status">
          <div className="flex items-center gap-2 mb-3">
            <SectionBadge number={4} color="bg-emerald-500" />
            <h2 className="text-gray-900 dark:text-gray-100 font-bold text-sm">매출 현황</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* 확정매출 */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500 text-white">확정매출</span>
                <span className="text-xs text-gray-400">배송중 전환 완료</span>
                <div className="h-px flex-1 bg-emerald-100 dark:bg-emerald-800"></div>
              </div>
              <div className="flex gap-2">
                {["금일", "전일", "전월", "이번달"].map((label, i) => {
                  const values = [
                    salesStats?.confirmed?.today || 0,
                    salesStats?.confirmed?.yesterday || 0,
                    salesStats?.confirmed?.lastMonth || 0,
                    salesStats?.confirmed?.thisMonth || 0,
                  ];
                  const icons = [<TrendingUp key="i0" className="h-3 w-3" />, <Clock key="i1" className="h-3 w-3" />, <Calendar key="i2" className="h-3 w-3" />, <TrendingUp key="i3" className="h-3 w-3" />];
                  return (
                    <div key={i} className={`flex-1 rounded-lg p-3.5 ${i === 0 ? "bg-emerald-500 text-white" : "bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-700"}`} data-testid={`card-confirmed-sales-${label}`}>
                      <div className={`text-xs font-medium mb-1 flex items-center gap-1 ${i === 0 ? "text-emerald-100" : "text-emerald-600 dark:text-emerald-400"}`}>
                        {label} {icons[i]}
                      </div>
                      <div className={`text-lg font-bold ${i === 0 ? "text-white" : "text-emerald-800 dark:text-emerald-300"}`}>
                        {values[i].toLocaleString("ko-KR")}<span className="text-xs font-normal ml-0.5">원</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 예상매출 */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-gray-400 text-white">예상매출</span>
                <span className="text-xs text-gray-400">대기~배송준비중, 정산 전</span>
                <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700"></div>
              </div>
              <div className="flex gap-2">
                {["금일", "전일", "전월", "이번달"].map((label, i) => {
                  const values = [
                    salesStats?.projected?.today || 0,
                    salesStats?.projected?.yesterday || 0,
                    salesStats?.projected?.lastMonth || 0,
                    salesStats?.projected?.thisMonth || 0,
                  ];
                  const icons = [<TrendingUp key="i0" className="h-3 w-3" />, <Clock key="i1" className="h-3 w-3" />, <Calendar key="i2" className="h-3 w-3" />, <TrendingUp key="i3" className="h-3 w-3" />];
                  const statusMsgs = [
                    buildStatusMessage(salesStats?.projectedStatusCounts?.today, '오늘'),
                    buildStatusMessage(salesStats?.projectedStatusCounts?.yesterday, '어제'),
                    buildStatusMessage(salesStats?.projectedStatusCounts?.lastMonth, '전월'),
                    buildStatusMessage(salesStats?.projectedStatusCounts?.thisMonth, '이번달'),
                  ];
                  return (
                    <div key={i} className="flex-1 rounded-lg p-3.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700" data-testid={`card-projected-sales-${label}`}>
                      <div className="text-xs font-medium mb-1 text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        {label} {icons[i]}
                      </div>
                      <div className="text-lg font-bold text-gray-700 dark:text-gray-200">
                        {values[i].toLocaleString("ko-KR")}<span className="text-xs font-normal ml-0.5">원</span>
                      </div>
                      {statusMsgs[i] && values[i] > 0 && (
                        <div className="mt-1 flex items-start gap-1">
                          <AlertCircle className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" />
                          <span className="text-[10px] text-amber-600 dark:text-amber-400 leading-tight">{statusMsgs[i]}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════ */}
        {/* 4행: 행사진행 현황 + 공지사항 — 가로 2열                    */}
        {/* ════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* 행사진행 현황 — 연핑크 */}
          <div className="bg-rose-50 dark:bg-rose-950/30 rounded-xl px-5 py-5 border border-rose-200 dark:border-rose-800" data-testid="section-event-status">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <SectionBadge number={5} color="bg-rose-500" />
                <h2 className="text-gray-900 dark:text-gray-100 font-bold text-sm">행사진행 현황</h2>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500 text-white" data-testid="badge-active-events">{activeEventsCount}개 진행중</span>
            </div>
            <div className="bg-white dark:bg-gray-900 rounded-lg overflow-hidden border border-rose-200 dark:border-rose-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 text-xs">
                    <th className="px-3 py-2 text-left font-semibold">업체</th>
                    <th className="px-3 py-2 text-left font-semibold">기간</th>
                    <th className="px-3 py-2 text-left font-semibold">행사품목</th>
                    <th className="px-3 py-2 text-left font-semibold">쿠폰</th>
                  </tr>
                </thead>
                <tbody>
                  {sampleEvents.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center text-muted-foreground py-8">
                        진행 중인 행사가 없습니다
                      </td>
                    </tr>
                  ) : (
                    sampleEvents.map((row, i) => (
                      <tr key={i} className={`border-t border-rose-100 dark:border-rose-900 ${
                        row.status === "active" ? "bg-green-50 dark:bg-green-950/20" :
                        row.status === "ending" ? "bg-amber-50 dark:bg-amber-950/20" :
                        "bg-gray-50 dark:bg-gray-800 text-gray-400"
                      }`} data-testid={`row-event-${i}`}>
                        <td className="px-3 py-2 font-semibold">{row.company}</td>
                        <td className="px-3 py-2 text-xs">{row.period}</td>
                        <td className="px-3 py-2">{row.item}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${
                            row.status === "active" ? "bg-green-500 text-white" :
                            row.status === "ending" ? "bg-amber-400 text-white" :
                            "bg-gray-300 text-white"
                          }`}>
                            {row.coupon}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 공지사항 (신규) — 연파랑 */}
          <div className="bg-sky-50 dark:bg-sky-950/30 rounded-xl px-5 py-5 border border-sky-200 dark:border-sky-800" data-testid="section-notices">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <SectionBadge number={6} color="bg-sky-500" />
                <h2 className="text-gray-900 dark:text-gray-100 font-bold text-sm">공지사항</h2>
              </div>
              <Button
                size="sm"
                className="bg-sky-500 hover:bg-sky-600 text-white text-xs"
                data-testid="button-new-notice"
              >
                <Megaphone className="h-3.5 w-3.5 mr-1" />
                새 공지
              </Button>
            </div>
            <div className="bg-white dark:bg-gray-900 rounded-lg overflow-hidden border border-sky-200 dark:border-sky-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 text-xs">
                    <th className="px-3 py-2 text-left font-semibold w-16">구분</th>
                    <th className="px-3 py-2 text-left font-semibold">제목</th>
                    <th className="px-3 py-2 text-left font-semibold w-24">등록일</th>
                  </tr>
                </thead>
                <tbody>
                  {sampleNotices.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="text-center text-muted-foreground py-8">
                        등록된 공지가 없습니다
                      </td>
                    </tr>
                  ) : (
                    sampleNotices.map((item, i) => (
                      <tr key={i} className="border-t border-sky-100 dark:border-sky-900 hover:bg-sky-50 dark:hover:bg-sky-950/20 transition-colors cursor-pointer" data-testid={`row-notice-${i}`}>
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-bold text-white ${item.typeColor}`}>
                            {item.type}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300 font-medium">{item.title}</td>
                        <td className="px-3 py-2.5 text-xs text-gray-400">{item.date}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      {/* 초기화 다이얼로그 1단계 */}
      <Dialog open={resetStep === 1} onOpenChange={(open) => { if (!open) { setResetStep(0); setConfirmText(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">1단계: 초기화 확인</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md bg-destructive/10 p-4 text-sm space-y-2">
              <p className="font-semibold text-destructive">다음 데이터가 모두 삭제됩니다:</p>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                <li>모든 주문 데이터</li>
                <li>모든 정산 이력</li>
                <li>모든 예치금/포인터 변동 이력</li>
                <li>모든 업로드 이력 (중복 파일 감지 포함)</li>
                <li>모든 회원 잔액 (예치금 + 포인터) → 0원 리셋</li>
              </ul>
              <p className="text-xs text-muted-foreground mt-2">* 회원 정보, 상품, 카테고리, 사이트 설정은 유지됩니다.</p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setResetStep(0); setConfirmText(""); }} data-testid="button-reset-cancel-1">
                취소
              </Button>
              <Button variant="destructive" onClick={() => setResetStep(2)} data-testid="button-reset-next">
                다음 단계로
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 초기화 다이얼로그 2단계 */}
      <Dialog open={resetStep === 2} onOpenChange={(open) => { if (!open) { setResetStep(0); setConfirmText(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">2단계: 최종 확인</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              되돌릴 수 없습니다. 아래 입력란에 <span className="font-bold text-destructive">초기화</span>를 입력해주세요.
            </p>
            <Input
              placeholder="초기화"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              data-testid="input-reset-confirm"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setResetStep(0); setConfirmText(""); }} data-testid="button-reset-cancel-2">
                취소
              </Button>
              <Button
                variant="destructive"
                disabled={confirmText !== "초기화" || resetMutation.isPending}
                onClick={() => resetMutation.mutate()}
                data-testid="button-reset-execute"
              >
                {resetMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    처리중...
                  </>
                ) : (
                  "초기화 실행"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
