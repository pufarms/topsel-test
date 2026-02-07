import { useQuery } from "@tanstack/react-query";
import { useSSE } from "@/hooks/use-sse";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, 
  Users, 
  UserPlus, 
  UserCheck,
  Star,
  Zap,
  Crown,
  TrendingUp,
  TrendingDown,
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
  Percent
} from "lucide-react";
import type { User, Order, Member } from "@shared/schema";
import { DateRangeFilter, useDateRange } from "@/components/common/DateRangeFilter";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  variant?: "default" | "primary" | "success" | "warning" | "danger";
}

function StatCard({ title, value, icon, trend, trendValue, variant = "default" }: StatCardProps) {
  const variantStyles = {
    default: "bg-card border",
    primary: "bg-primary/5 border-primary/20",
    success: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800",
    warning: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800",
    danger: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800",
  };

  const iconStyles = {
    default: "text-muted-foreground",
    primary: "text-primary",
    success: "text-emerald-600 dark:text-emerald-400",
    warning: "text-amber-600 dark:text-amber-400",
    danger: "text-red-600 dark:text-red-400",
  };

  return (
    <div className={`rounded-lg border p-4 ${variantStyles[variant]} transition-all hover:shadow-sm`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-muted-foreground font-medium">{title}</span>
        <div className={`p-2 rounded-lg bg-background/50 ${iconStyles[variant]}`}>
          {icon}
        </div>
      </div>
      <div className="flex items-end justify-between">
        <span className="text-2xl font-bold tracking-tight">{value}</span>
        {trend && trendValue && (
          <div className={`flex items-center gap-1 text-xs font-medium ${
            trend === "up" ? "text-emerald-600" : trend === "down" ? "text-red-600" : "text-muted-foreground"
          }`}>
            {trend === "up" ? <TrendingUp className="h-3 w-3" /> : 
             trend === "down" ? <TrendingDown className="h-3 w-3" /> : null}
            {trendValue}
          </div>
        )}
      </div>
    </div>
  );
}

interface MiniStatProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  color?: "default" | "blue" | "green" | "yellow" | "red" | "purple" | "orange";
}

function MiniStat({ title, value, icon, color = "default" }: MiniStatProps) {
  const colorStyles = {
    default: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300",
    blue: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300",
    green: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300",
    yellow: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",
    red: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300",
    purple: "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300",
    orange: "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300",
  };

  return (
    <div className={`rounded-lg p-3 ${colorStyles[color]} transition-all hover:opacity-90 cursor-pointer`}>
      <div className="flex items-center gap-2 mb-1">
        {icon && <span className="opacity-70">{icon}</span>}
        <span className="text-xs font-medium opacity-80">{title}</span>
      </div>
      <span className="text-lg font-bold">{value}</span>
    </div>
  );
}

export default function AdminDashboard() {
  useSSE();
  const { dateRange, setDateRange } = useDateRange("today");

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
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  if (usersLoading || ordersLoading || membersLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const totalRevenue = orders.reduce((sum, order) => sum + (order.supplyPrice || 0), 0);
  
  const pendingMembers = members.filter(m => m.status === "pending").length;
  const approvedMembers = members.filter(m => m.status === "approved").length;
  
  const tierCounts = {
    준회원: members.filter(m => m.grade === "준회원" && m.status === "approved").length,
    Start: members.filter(m => m.grade === "Start" && m.status === "approved").length,
    Driving: members.filter(m => m.grade === "Driving" && m.status === "approved").length,
    Top: members.filter(m => m.grade === "Top" && m.status === "approved").length,
  };

  const sampleEvents = [
    { company: "농협", period: "01.15 - 01.31", item: "제주 감귤", code: "EVT001", coupon: "10%" },
    { company: "이마트", period: "01.20 - 02.05", item: "청송 사과", code: "EVT002", coupon: "15%" },
    { company: "롯데마트", period: "02.01 - 02.14", item: "성주 참외", code: "EVT003", coupon: "20%" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h1 className="text-xl md:text-2xl font-bold">대시보드</h1>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>{formattedDate}</span>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">회원 현황</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard
              title="총회원수"
              value={`${approvedMembers}명`}
              icon={<Users className="h-4 w-4" />}
              variant="primary"
            />
            <StatCard
              title="신규회원(승인대기)"
              value={`${pendingMembers}명`}
              icon={<UserPlus className="h-4 w-4" />}
              variant={pendingMembers > 0 ? "warning" : "default"}
            />
            <StatCard
              title="준회원"
              value={`${tierCounts.준회원}명`}
              icon={<UserCheck className="h-4 w-4" />}
            />
            <StatCard
              title="Start회원"
              value={`${tierCounts.Start}명`}
              icon={<Star className="h-4 w-4" />}
            />
            <StatCard
              title="Driving회원"
              value={`${tierCounts.Driving}명`}
              icon={<Zap className="h-4 w-4" />}
            />
            <StatCard
              title="Top회원"
              value={`${tierCounts.Top}명`}
              icon={<Crown className="h-4 w-4" />}
              variant="success"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-600" />
            <CardTitle className="text-base">매출 현황</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              title="금일 총매출"
              value={`${totalRevenue.toLocaleString("ko-KR")}원`}
              icon={<TrendingUp className="h-4 w-4" />}
              variant="success"
              trend="up"
              trendValue="+12.5%"
            />
            <StatCard
              title="전일 총매출"
              value="0원"
              icon={<Clock className="h-4 w-4" />}
            />
            <StatCard
              title="전월 총매출"
              value="0원"
              icon={<Calendar className="h-4 w-4" />}
            />
            <StatCard
              title="이번달 총매출"
              value={`${totalRevenue.toLocaleString("ko-KR")}원`}
              icon={<TrendingUp className="h-4 w-4" />}
              variant="primary"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-base">주문/배송 현황</CardTitle>
            </div>
            <DateRangeFilter onChange={setDateRange} defaultPreset="today" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            <MiniStat
              title="전체주문"
              value={`${orderStats?.total || 0}건`}
              icon={<Package className="h-3.5 w-3.5" />}
              color="blue"
            />
            <MiniStat
              title="주문대기"
              value={`${orderStats?.pending || 0}건`}
              icon={<Clock className="h-3.5 w-3.5" />}
              color="yellow"
            />
            <MiniStat
              title="주문조정"
              value={`${orderStats?.adjustment || 0}건`}
              icon={<AlertCircle className="h-3.5 w-3.5" />}
              color="orange"
            />
            <MiniStat
              title="상품준비중"
              value={`${orderStats?.preparing || 0}건`}
              icon={<Package className="h-3.5 w-3.5" />}
              color="purple"
            />
            <div className="rounded-lg p-3 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 transition-all hover:opacity-90 cursor-pointer">
              <div className="flex items-center gap-2 mb-1">
                <span className="opacity-70"><Truck className="h-3.5 w-3.5" /></span>
                <span className="text-xs font-medium opacity-80">배송준비중</span>
              </div>
              <span className="text-lg font-bold">{orderStats?.readyToShip || 0}건</span>
              <div className="mt-1 text-[10px] opacity-70 leading-tight">
                운송장파일다운 · 회원취소건등록
              </div>
            </div>
            <MiniStat
              title="회원취소"
              value={`${orderStats?.memberCancelled || 0}건`}
              icon={<XCircle className="h-3.5 w-3.5" />}
              color="red"
            />
            <MiniStat
              title="배송중"
              value={`${orderStats?.shipping || 0}건`}
              icon={<Truck className="h-3.5 w-3.5" />}
              color="green"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-purple-600" />
            <CardTitle className="text-base">문의 현황</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <MiniStat
              title="일반 문의"
              value="0개"
              icon={<HelpCircle className="h-3.5 w-3.5" />}
              color="default"
            />
            <MiniStat
              title="상품 CS/이슈"
              value="0개"
              icon={<AlertCircle className="h-3.5 w-3.5" />}
              color="red"
            />
            <MiniStat
              title="정산/계산서/예치금/후불"
              value="0개"
              icon={<FileText className="h-3.5 w-3.5" />}
              color="blue"
            />
            <MiniStat
              title="회원정보(등급) 관련"
              value="0개"
              icon={<Users className="h-3.5 w-3.5" />}
              color="purple"
            />
            <MiniStat
              title="행사특가문의/접수"
              value="0개"
              icon={<Gift className="h-3.5 w-3.5" />}
              color="orange"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-orange-600" />
              <CardTitle className="text-base">행사진행 현황</CardTitle>
            </div>
            <Badge variant="secondary" className="text-xs">
              {sampleEvents.length}개 진행중
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border table-scroll-container">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">업체</TableHead>
                  <TableHead className="font-semibold">기간</TableHead>
                  <TableHead className="font-semibold">행사품목</TableHead>
                  <TableHead className="font-semibold">상품코드</TableHead>
                  <TableHead className="font-semibold">쿠폰</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sampleEvents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      진행 중인 행사가 없습니다
                    </TableCell>
                  </TableRow>
                ) : (
                  sampleEvents.map((event, index) => (
                    <TableRow key={index} className="hover:bg-muted/30">
                      <TableCell className="font-medium">{event.company}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          {event.period}
                        </div>
                      </TableCell>
                      <TableCell>{event.item}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs">
                          {event.code}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 hover:bg-orange-200">
                          <Percent className="h-3 w-3 mr-1" />
                          {event.coupon}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
