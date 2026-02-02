import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Loader2, 
  LayoutDashboard,
  User,
  ShoppingCart,
  MapPin,
  Wallet,
  BarChart3,
  Calculator,
  MessageSquare,
  BookOpen,
  ChevronRight,
  Plus,
  XCircle,
  FileDown,
  Search,
  Clock,
  Package,
  Truck,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Gift,
  Bell,
  Calendar,
  Percent,
  Building2,
  Star
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { PublicHeader } from "@/components/public/PublicHeader";
import type { Order, Member } from "@shared/schema";
import { cn } from "@/lib/utils";

type SidebarTab = 
  | "dashboard" 
  | "member-info" 
  | "order-new" 
  | "order-adjust" 
  | "order-invoice" 
  | "order-cancel" 
  | "order-list"
  | "address-tool"
  | "deposit"
  | "purchase-stats"
  | "settlement-stats"
  | "inquiry"
  | "guide";

interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  tab: SidebarTab;
  activeTab: SidebarTab;
  onClick: (tab: SidebarTab) => void;
  children?: { label: string; tab: SidebarTab }[];
  isOpen?: boolean;
  onToggle?: () => void;
}

function SidebarItem({ icon, label, tab, activeTab, onClick, children, isOpen, onToggle }: SidebarItemProps) {
  const isActive = activeTab === tab || children?.some(c => c.tab === activeTab);
  const showChildren = children && (isOpen ?? isActive);
  
  const handleClick = () => {
    if (children && children.length > 0) {
      // 하위 메뉴가 있으면 토글만 수행
      onToggle?.();
    } else {
      // 하위 메뉴가 없으면 탭 변경
      onClick(tab);
    }
  };
  
  return (
    <div>
      <button
        onClick={handleClick}
        className={cn(
          "w-full flex items-center gap-3 px-4 py-3 text-left text-sm font-medium rounded-lg transition-colors",
          isActive 
            ? "bg-primary/10 text-primary" 
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        {icon}
        <span>{label}</span>
        {children && children.length > 0 && (
          <ChevronRight className={cn(
            "ml-auto h-4 w-4 transition-transform",
            showChildren && "rotate-90"
          )} />
        )}
      </button>
      {showChildren && (
        <div className="ml-4 mt-1 space-y-1 border-l-2 border-muted pl-4">
          {children.map((child) => (
            <button
              key={child.tab}
              onClick={() => onClick(child.tab)}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 text-left text-sm rounded-md transition-colors",
                activeTab === child.tab
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              {child.label}
            </button>
          ))}
        </div>
      )}
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
    <div className={cn(
      "rounded-lg p-4 text-center transition-all hover:opacity-90",
      colorStyles[color]
    )}>
      <div className="flex items-center justify-center gap-1.5 mb-2">
        {icon && <span className="opacity-70">{icon}</span>}
        <span className="text-xs font-medium opacity-80">{title}</span>
      </div>
      <span className="text-xl font-bold">{value}</span>
    </div>
  );
}

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<SidebarTab>("dashboard");
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  
  // 메뉴 토글 함수 (아코디언 동작)
  const toggleMenu = (menuId: string) => {
    setOpenMenu(prev => prev === menuId ? null : menuId);
  };

  const { data: orders = [], isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
    enabled: !!user,
  });

  const { data: memberData, isLoading: memberLoading } = useQuery<Member>({
    queryKey: ["/api/member/profile"],
    enabled: !!user,
  });

  if (authLoading || memberLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    navigate("/login");
    return null;
  }

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

  const thisMonthOrders = orders.filter(order => {
    const orderDate = new Date(order.createdAt);
    return orderDate.getMonth() === currentMonth && orderDate.getFullYear() === currentYear;
  });

  const lastMonthOrders = orders.filter(order => {
    const orderDate = new Date(order.createdAt);
    return orderDate.getMonth() === lastMonth && orderDate.getFullYear() === lastMonthYear;
  });

  const totalOrders = orders.length;
  const thisMonthTotal = thisMonthOrders.reduce((sum, order) => sum + order.price * order.quantity, 0);
  const lastMonthTotal = lastMonthOrders.reduce((sum, order) => sum + order.price * order.quantity, 0);

  const formatPrice = (price: number) => {
    return price.toLocaleString("ko-KR") + "원";
  };

  const sampleEvents = [
    { company: "농협", period: "01.15 - 01.31", item: "제주 감귤", code: "EVT001", coupon: "10%" },
    { company: "이마트", period: "01.20 - 02.05", item: "청송 사과", code: "EVT002", coupon: "15%" },
  ];

  const sampleNotices = [
    { id: 1, title: "2024년 설 연휴 배송 안내", date: "2024-01-25" },
    { id: 2, title: "신규 상품 입고 안내", date: "2024-01-20" },
    { id: 3, title: "시스템 점검 안내", date: "2024-01-15" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />

      <main className="pt-14">
        <div className="bg-gradient-to-r from-[#1a237e] to-[#283593] text-white py-10">
          <div className="container mx-auto px-6 py-6">
            <h1 className="text-2xl md:text-3xl font-bold mb-2">마이페이지 대시보드</h1>
            <p className="text-blue-200 text-sm md:text-base mb-6">
              주문, 예치금, 통계를 한눈에 관리하세요.<br className="sm:hidden" />
              탑셀러의 모든 서비스를 이곳에서 확인할 수 있습니다.
            </p>

            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 mb-6">
              <Building2 className="h-4 w-4 text-amber-400" />
              <span className="text-sm">
                {memberData?.companyName || user?.name || "회원"}님
              </span>
              <Badge className="bg-amber-500 text-white hover:bg-amber-600 ml-2">
                환영합니다!
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-3 flex items-center gap-3">
                <div className="p-2 bg-amber-500/20 rounded-lg">
                  <Star className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-xs text-blue-200">회원님 등급</p>
                  <p className="font-semibold">{memberData?.grade || "준회원"}</p>
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-3 flex items-center gap-3">
                <div className="p-2 bg-emerald-500/20 rounded-lg">
                  <BarChart3 className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs text-blue-200">지난 달 매입 총액</p>
                  <p className="font-semibold">{formatPrice(lastMonthTotal)}</p>
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-3 flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <BarChart3 className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-blue-200">이번 달 매입 총액</p>
                  <p className="font-semibold">{formatPrice(thisMonthTotal)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 md:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <aside className="lg:w-64 shrink-0">
              <Card className="sticky top-20">
                <CardContent className="p-3">
                  <nav className="space-y-1">
                    <SidebarItem
                      icon={<LayoutDashboard className="h-4 w-4" />}
                      label="마이페이지 대시보드"
                      tab="dashboard"
                      activeTab={activeTab}
                      onClick={setActiveTab}
                    />
                    <SidebarItem
                      icon={<User className="h-4 w-4" />}
                      label="회원정보"
                      tab="member-info"
                      activeTab={activeTab}
                      onClick={setActiveTab}
                    />
                    <SidebarItem
                      icon={<ShoppingCart className="h-4 w-4" />}
                      label="주문관리"
                      tab="order-new"
                      activeTab={activeTab}
                      onClick={setActiveTab}
                      isOpen={openMenu === "order"}
                      onToggle={() => toggleMenu("order")}
                      children={[
                        { label: "신규주문등록", tab: "order-new" },
                        { label: "주문조정건 확인", tab: "order-adjust" },
                        { label: "송장파일 다운로드", tab: "order-invoice" },
                        { label: "취소건 등록", tab: "order-cancel" },
                        { label: "주문건 조회", tab: "order-list" },
                      ]}
                    />
                    <SidebarItem
                      icon={<MapPin className="h-4 w-4" />}
                      label="주소검증,엑셀변환 이용"
                      tab="address-tool"
                      activeTab={activeTab}
                      onClick={setActiveTab}
                    />
                    <SidebarItem
                      icon={<Wallet className="h-4 w-4" />}
                      label="예치금충전"
                      tab="deposit"
                      activeTab={activeTab}
                      onClick={setActiveTab}
                    />
                    <SidebarItem
                      icon={<BarChart3 className="h-4 w-4" />}
                      label="상품매입통계"
                      tab="purchase-stats"
                      activeTab={activeTab}
                      onClick={setActiveTab}
                    />
                    <SidebarItem
                      icon={<Calculator className="h-4 w-4" />}
                      label="정산통계"
                      tab="settlement-stats"
                      activeTab={activeTab}
                      onClick={setActiveTab}
                    />
                    <SidebarItem
                      icon={<MessageSquare className="h-4 w-4" />}
                      label="문의 게시판"
                      tab="inquiry"
                      activeTab={activeTab}
                      onClick={setActiveTab}
                    />
                    <SidebarItem
                      icon={<BookOpen className="h-4 w-4" />}
                      label="이용가이드"
                      tab="guide"
                      activeTab={activeTab}
                      onClick={setActiveTab}
                    />
                  </nav>
                </CardContent>
              </Card>
            </aside>

            <div className="flex-1 space-y-6">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base">주문현황</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                    <MiniStat
                      title="주문접수"
                      value={`${totalOrders}건`}
                      icon={<Clock className="h-3.5 w-3.5" />}
                      color="blue"
                    />
                    <MiniStat
                      title="주문조정"
                      value="0건"
                      icon={<AlertCircle className="h-3.5 w-3.5" />}
                      color="yellow"
                    />
                    <MiniStat
                      title="상품준비중"
                      value="0건"
                      icon={<Package className="h-3.5 w-3.5" />}
                      color="purple"
                    />
                    <MiniStat
                      title="배송준비중"
                      value="0건"
                      icon={<Package className="h-3.5 w-3.5" />}
                      color="orange"
                    />
                    <MiniStat
                      title="회원취소"
                      value="0건"
                      icon={<XCircle className="h-3.5 w-3.5" />}
                      color="red"
                    />
                    <MiniStat
                      title="배송중"
                      value="0건"
                      icon={<Truck className="h-3.5 w-3.5" />}
                      color="blue"
                    />
                    <MiniStat
                      title="배송완료"
                      value="0건"
                      icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                      color="green"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button size="sm" className="gap-1.5">
                      <Plus className="h-4 w-4" />
                      신규주문 등록
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5">
                      <XCircle className="h-4 w-4" />
                      취소 리스트확인
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5">
                      <FileDown className="h-4 w-4" />
                      송장파일 다운
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5">
                      <AlertCircle className="h-4 w-4" />
                      취소건 등록
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5">
                      <Search className="h-4 w-4" />
                      주문건 조회
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Wallet className="h-5 w-5 text-emerald-600" />
                    <CardTitle className="text-base">현재 예치금, 포인터 현황</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid sm:grid-cols-2 gap-4 mb-4">
                    <div className="border rounded-lg p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-100 dark:bg-emerald-900/40 rounded-lg">
                          <CreditCard className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">예치금</p>
                          <p className="text-xl font-bold">0원</p>
                        </div>
                      </div>
                    </div>
                    <div className="border rounded-lg p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-lg">
                          <Gift className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">포인터</p>
                          <p className="text-xl font-bold">0원</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-center">
                    <Button className="bg-emerald-600 hover:bg-emerald-700 gap-2">
                      <Wallet className="h-4 w-4" />
                      예치금 충전하기
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div className="grid md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Bell className="h-5 w-5 text-blue-600" />
                        <CardTitle className="text-base">공지사항</CardTitle>
                      </div>
                      <Button variant="ghost" size="sm" className="text-xs">
                        더보기
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {sampleNotices.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          등록된 공지사항이 없습니다
                        </p>
                      ) : (
                        sampleNotices.map((notice) => (
                          <div 
                            key={notice.id} 
                            className="flex items-center justify-between py-2 border-b last:border-0 hover:bg-muted/50 px-2 rounded cursor-pointer"
                          >
                            <span className="text-sm truncate flex-1">{notice.title}</span>
                            <span className="text-xs text-muted-foreground ml-2">{notice.date}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-5 w-5 text-purple-600" />
                        <CardTitle className="text-base">문의게시판</CardTitle>
                      </div>
                      <Button variant="ghost" size="sm" className="text-xs">
                        더보기
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8 text-muted-foreground">
                      <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">등록된 문의가 없습니다</p>
                      <Button variant="outline" size="sm" className="mt-3">
                        문의하기
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

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
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
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
          </div>
        </div>
      </main>
    </div>
  );
}
