import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getQueryFn, queryClient } from "@/lib/queryClient";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
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
  Star,
  Menu,
  X
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { PublicHeader } from "@/components/public/PublicHeader";
import { MemberPageBanner } from "@/components/member/MemberPageBanner";
import { MemberOrderFilter } from "@/components/member/MemberOrderFilter";
import { type Order, type Member, type PendingOrder, type Category } from "@shared/schema";
import { cn } from "@/lib/utils";
import MemberOrderAdjust from "@/pages/member/order-adjust";
import MemberOrderInvoice from "@/pages/member/order-invoice";
import MemberOrderCancel from "@/pages/member/order-cancel";
import MemberOrderList from "@/pages/member/order-list";

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
        data-testid={`sidebar-${tab}`}
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
              data-testid={`sidebar-${child.tab}`}
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
  const [mobileOpen, setMobileOpen] = useState(false);
  
  const urlParams = new URLSearchParams(window.location.search);
  const isPreviewMode = urlParams.get("preview") === "true";
  const isAdmin = user?.role === "SUPER_ADMIN" || user?.role === "ADMIN";
  const isMember = user && !isAdmin;
  
  // 메뉴 토글 함수 (아코디언 동작)
  const toggleMenu = (menuId: string) => {
    setOpenMenu(prev => prev === menuId ? null : menuId);
  };

  const { data: orders = [], isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
    enabled: !!user,
  });

  const { data: memberData, isLoading: memberLoading, error: memberError } = useQuery<Member | null>({
    queryKey: ["/api/member/profile"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!user,
    retry: false,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });
  
  const { data: pendingOrders = [], isLoading: pendingOrdersLoading, refetch: refetchPendingOrders } = useQuery<PendingOrder[]>({
    queryKey: ["/api/member/pending-orders"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!user && (isMember || isPreviewMode),
    staleTime: 1000 * 60 * 2,
    refetchOnWindowFocus: false,
  });

  // Order stats - member sees only their own order counts
  const { data: orderStats } = useQuery<{
    total: number;
    pending: number;
    processing: number;
    completed: number;
    cancelled: number;
    today: number;
  }>({
    queryKey: ["/api/order-stats"],
    enabled: !!user && (isMember || isPreviewMode),
  });

  const { toast } = useToast();
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ total: number; success: number; failed: number; errors?: string[] } | null>(null);

  // Excel upload mutation for bulk order registration
  const uploadExcelMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/member/pending-orders/excel-upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        // Return error data with validation errors for display
        return { ...data, isError: true };
      }
      return data;
    },
    onSuccess: (data) => {
      if (data.isError) {
        // Validation errors - file rejected
        setUploadProgress({ 
          total: data.total || 0, 
          success: data.success || 0, 
          failed: data.failed || 0, 
          errors: data.errors || [] 
        });
        toast({ 
          title: "업로드 반려", 
          description: data.message || "필수 항목이 누락되었습니다", 
          variant: "destructive" 
        });
      } else {
        setUploadProgress({ total: data.total, success: data.success, failed: data.failed, errors: [] });
        toast({ title: "주문 등록 완료", description: `${data.success}건의 주문이 등록되었습니다.` });
        queryClient.invalidateQueries({ queryKey: ["/api/member/pending-orders"] });
      }
    },
    onError: (error: any) => {
      toast({ title: "엑셀 업로드 실패", description: error.message, variant: "destructive" });
    },
  });

  const handleExcelUpload = () => {
    if (excelFile) {
      setUploadProgress(null);
      uploadExcelMutation.mutate(excelFile);
    }
  };

  const handleCloseUploadDialog = () => {
    setOrderDialogOpen(false);
    setExcelFile(null);
    setUploadProgress(null);
  };
  
  // 카테고리 데이터 쿼리 (상품관리/카테고리관리 연동)
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  // 주문등록 양식 템플릿 조회
  const { data: orderTemplate } = useQuery<{ fileUrl: string; fileName: string }>({
    queryKey: ["/api/form-templates/code", "order_registration"],
    queryFn: async () => {
      const res = await fetch("/api/form-templates/code/order_registration");
      if (!res.ok) throw new Error("양식을 찾을 수 없습니다");
      return res.json();
    },
    enabled: isMember || isPreviewMode,
    staleTime: 1000 * 60 * 30,
    retry: false,
  });

  // 양식 다운로드 핸들러
  const handleDownloadTemplate = () => {
    if (orderTemplate?.fileUrl) {
      const link = document.createElement('a');
      link.href = orderTemplate.fileUrl;
      link.download = orderTemplate.fileName || '주문등록_양식파일.xlsx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      toast({
        title: "양식 다운로드 실패",
        description: "등록된 주문등록 양식이 없습니다. 관리자에게 문의하세요.",
        variant: "destructive",
      });
    }
  };

  // 카테고리 필터 상태
  const [categoryLargeFilter, setCategoryLargeFilter] = useState<string>("all");
  const [categoryMediumFilter, setCategoryMediumFilter] = useState<string>("all");
  const [categorySmallFilter, setCategorySmallFilter] = useState<string>("all");

  // 카테고리 레벨별 분류
  const largeCategories = categories.filter(c => c.level === "large");
  const mediumCategories = categories.filter(c => c.level === "medium");
  const smallCategories = categories.filter(c => c.level === "small");

  // 선택된 대분류에 따른 중분류 필터링
  const filteredMediumCategories = categoryLargeFilter === "all" 
    ? mediumCategories 
    : mediumCategories.filter(c => c.parentId === categoryLargeFilter);

  // 선택된 중분류에 따른 소분류 필터링
  const filteredSmallCategories = categoryMediumFilter === "all"
    ? smallCategories
    : smallCategories.filter(c => c.parentId === categoryMediumFilter);

  // 검색 필터 상태
  const [searchFilter, setSearchFilter] = useState<string>("선택 없음");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  
  // 테이블 페이지 크기 상태 (10, 30, 100, "all")
  const [tablePageSize, setTablePageSize] = useState<number | "all">(30);


  // 검색어에 따른 필터링
  useEffect(() => {
    if (searchFilter === "선택 없음" || !searchTerm.trim()) {
      setSearchResults([]);
      return;
    }

    const term = searchTerm.toLowerCase();
    let results: string[] = [];

    if (searchFilter === "주문자명") {
      results = Array.from(new Set(pendingOrders
        .filter(order => order.ordererName?.toLowerCase().includes(term))
        .map(order => order.ordererName)
        .filter((name): name is string => !!name)
      ));
    } else if (searchFilter === "수령자명") {
      results = Array.from(new Set(pendingOrders
        .filter(order => order.recipientName?.toLowerCase().includes(term))
        .map(order => order.recipientName)
        .filter((name): name is string => !!name)
      ));
    } else if (searchFilter === "상품명") {
      results = Array.from(new Set(pendingOrders
        .filter(order => order.productName?.toLowerCase().includes(term))
        .map(order => order.productName)
        .filter((name): name is string => !!name)
      ));
    }

    setSearchResults(results.slice(0, 10));
  }, [searchTerm, searchFilter, pendingOrders]);

  // 카테고리 이름으로 ID 찾기 헬퍼 함수
  const getCategoryNameById = (id: string) => categories.find(c => c.id === id)?.name;

  // 필터된 주문 목록 (검색 + 카테고리 필터)
  const filteredPendingOrders = (pendingOrders || []).filter(order => {
    // 검색 필터 적용
    if (searchFilter !== "선택 없음" && searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      if (searchFilter === "주문자명" && !order.ordererName?.toLowerCase().includes(term)) return false;
      if (searchFilter === "수령자명" && !order.recipientName?.toLowerCase().includes(term)) return false;
      if (searchFilter === "상품명" && !order.productName?.toLowerCase().includes(term)) return false;
    }
    
    // 대분류 카테고리 필터
    if (categoryLargeFilter !== "all") {
      const categoryName = getCategoryNameById(categoryLargeFilter);
      if (order.categoryLarge !== categoryName) return false;
    }
    
    // 중분류 카테고리 필터
    if (categoryMediumFilter !== "all") {
      const categoryName = getCategoryNameById(categoryMediumFilter);
      if (order.categoryMedium !== categoryName) return false;
    }
    
    // 소분류 카테고리 필터
    if (categorySmallFilter !== "all") {
      const categoryName = getCategoryNameById(categorySmallFilter);
      if (order.categorySmall !== categoryName) return false;
    }
    
    return true;
  });
  
  // 표시할 주문 목록 (페이지 크기에 따라 자르기)
  const displayedPendingOrders = tablePageSize === "all" 
    ? filteredPendingOrders 
    : filteredPendingOrders.slice(0, tablePageSize);
  

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [authLoading, user, navigate]);

  if (authLoading) {
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

  // 관리자는 관리자 대시보드로 리다이렉트 (preview 모드가 아닌 경우에만)
  if (isAdmin && !isPreviewMode) {
    navigate("/admin");
    return null;
  }

  if (memberLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // preview 모드가 아니고 회원 데이터가 없으면 로그인으로 리다이렉트
  if (!memberData && !memberLoading && user && !isPreviewMode) {
    navigate("/login");
    return null;
  }

  // preview 모드에서 관리자가 회원 데이터 없이 볼 경우 데모 데이터 사용
  const displayMemberData: Member | null = memberData || (isPreviewMode ? {
    id: "preview-demo",
    username: "preview_user",
    password: "",
    grade: "ASSOCIATE",
    memberName: "[미리보기] 홍길동",
    companyName: "[미리보기] 샘플 업체명",
    businessNumber: "123-45-67890",
    businessAddress: "서울시 강남구 테헤란로 123",
    representative: "[미리보기] 홍길동",
    phone: "010-0000-0000",
    ceoBirth: null,
    ceoCi: null,
    mailNo: "06234",
    managerName: null,
    managerPhone: null,
    manager2Name: null,
    manager2Phone: null,
    manager3Name: null,
    manager3Phone: null,
    email: "sample@example.com",
    deposit: 100000,
    point: 5000,
    status: "활성",
    memo: null,
    businessLicenseUrl: null,
    mailFilePath: null,
    profileImageUrl: null,
    signatureData: null,
    approvedAt: new Date(),
    approvedBy: null,
    lastLoginAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Member : null);

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

  // Use real order stats from API (member's own orders only)
  const totalOrders = orderStats?.total || 0;
  const pendingOrdersCount = orderStats?.pending || 0;
  const processingOrdersCount = orderStats?.processing || 0;
  const completedOrdersCount = orderStats?.completed || 0;
  const cancelledOrdersCount = orderStats?.cancelled || 0;
  
  const thisMonthTotal = thisMonthOrders.reduce((sum, order) => sum + order.price * order.quantity, 0);
  const lastMonthTotal = lastMonthOrders.reduce((sum, order) => sum + order.price * order.quantity, 0);

  const formatPrice = (price: number) => {
    return price.toLocaleString("ko-KR") + "원";
  };

  // 본인의 행사진행 이력을 표시 (추후 API 연결 필요)
  const memberEvents: { company: string; period: string; item: string; code: string; coupon: string; status: "진행중" | "종료" }[] = [];

  const sampleNotices = [
    { id: 1, title: "2024년 설 연휴 배송 안내", date: "2024-01-25" },
    { id: 2, title: "신규 상품 입고 안내", date: "2024-01-20" },
    { id: 3, title: "시스템 점검 안내", date: "2024-01-15" },
  ];

  const sidebarContent = (
    <nav className="space-y-1">
      <SidebarItem
        icon={<LayoutDashboard className="h-4 w-4" />}
        label="마이페이지 대시보드"
        tab="dashboard"
        activeTab={activeTab}
        onClick={(tab) => { setActiveTab(tab); setMobileOpen(false); }}
      />
      <SidebarItem
        icon={<User className="h-4 w-4" />}
        label="회원정보"
        tab="member-info"
        activeTab={activeTab}
        onClick={(tab) => { setActiveTab(tab); setMobileOpen(false); }}
      />
      <SidebarItem
        icon={<ShoppingCart className="h-4 w-4" />}
        label="주문관리"
        tab="order-new"
        activeTab={activeTab}
        onClick={(tab) => { setActiveTab(tab); setMobileOpen(false); }}
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
        onClick={(tab) => { setActiveTab(tab); setMobileOpen(false); }}
      />
      <SidebarItem
        icon={<Wallet className="h-4 w-4" />}
        label="예치금충전"
        tab="deposit"
        activeTab={activeTab}
        onClick={(tab) => { setActiveTab(tab); setMobileOpen(false); }}
      />
      <SidebarItem
        icon={<BarChart3 className="h-4 w-4" />}
        label="상품매입통계"
        tab="purchase-stats"
        activeTab={activeTab}
        onClick={(tab) => { setActiveTab(tab); setMobileOpen(false); }}
      />
      <SidebarItem
        icon={<Calculator className="h-4 w-4" />}
        label="정산통계"
        tab="settlement-stats"
        activeTab={activeTab}
        onClick={(tab) => { setActiveTab(tab); setMobileOpen(false); }}
      />
      <SidebarItem
        icon={<MessageSquare className="h-4 w-4" />}
        label="문의 게시판"
        tab="inquiry"
        activeTab={activeTab}
        onClick={(tab) => { setActiveTab(tab); setMobileOpen(false); }}
      />
      <SidebarItem
        icon={<BookOpen className="h-4 w-4" />}
        label="이용가이드"
        tab="guide"
        activeTab={activeTab}
        onClick={(tab) => { setActiveTab(tab); setMobileOpen(false); }}
      />
    </nav>
  );

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <PublicHeader />

      <div className="pt-14 overflow-x-hidden">
        <MemberPageBanner 
          title="마이페이지 대시보드" 
          description="주문, 예치금, 통계를 한눈에 관리하세요. 탑셀러의 모든 서비스를 이곳에서 확인할 수 있습니다."
          memberData={displayMemberData}
          orders={orders}
        />

        {/* Desktop Fixed Sidebar */}
        <aside className="hidden lg:block fixed left-0 top-14 bottom-0 w-64 bg-card border-r z-30 overflow-y-auto">
          <div className="p-4">
            {sidebarContent}
          </div>
        </aside>

        {/* Mobile Sidebar Toggle */}
        <Button
          size="icon"
          variant="default"
          className="lg:hidden fixed bottom-4 right-4 z-50 shadow-lg"
          onClick={() => setMobileOpen(!mobileOpen)}
          data-testid="button-mobile-menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>

        {/* Mobile Sidebar Overlay */}
        {mobileOpen && (
          <>
            <div 
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
              onClick={() => setMobileOpen(false)}
              data-testid="overlay-mobile-sidebar"
            />
            <aside className="fixed left-0 top-14 bottom-0 w-72 bg-card border-r z-50 lg:hidden overflow-y-auto">
              <div className="p-4">
                {sidebarContent}
              </div>
            </aside>
          </>
        )}

        {/* Main Content - offset for fixed sidebar on desktop */}
        <main className="lg:ml-64 min-w-0 p-4 md:p-6">
              {activeTab === "dashboard" && (
              <div className="space-y-6">
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
                      title="전체주문"
                      value={`${totalOrders}건`}
                      icon={<ShoppingCart className="h-3.5 w-3.5" />}
                      color="blue"
                    />
                    <MiniStat
                      title="대기중"
                      value={`${pendingOrdersCount}건`}
                      icon={<Clock className="h-3.5 w-3.5" />}
                      color="yellow"
                    />
                    <MiniStat
                      title="처리중"
                      value={`${processingOrdersCount}건`}
                      icon={<Package className="h-3.5 w-3.5" />}
                      color="purple"
                    />
                    <MiniStat
                      title="완료"
                      value={`${completedOrdersCount}건`}
                      icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                      color="green"
                    />
                    <MiniStat
                      title="취소"
                      value={`${cancelledOrdersCount}건`}
                      icon={<XCircle className="h-3.5 w-3.5" />}
                      color="red"
                    />
                    <MiniStat
                      title="오늘등록"
                      value={`${orderStats?.today || 0}건`}
                      icon={<Calendar className="h-3.5 w-3.5" />}
                      color="orange"
                    />
                    <MiniStat
                      title="배송완료"
                      value="0건"
                      icon={<Truck className="h-3.5 w-3.5" />}
                      color="blue"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button 
                      size="sm" 
                      className="gap-1.5"
                      onClick={() => {
                        setActiveTab("order-new");
                        setOrderDialogOpen(true);
                      }}
                      data-testid="button-new-order-quick"
                    >
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
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Gift className="h-5 w-5 text-orange-600" />
                      <CardTitle className="text-base">행사진행 현황</CardTitle>
                      <Button 
                        variant="outline" 
                        size="sm"
                        data-testid="button-apply-event"
                        onClick={() => {/* 추후 행사신청 페이지 연결 예정 */}}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        행사신청하기
                      </Button>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {memberEvents.length}개 진행중
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
                          <TableHead className="font-semibold">상태</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {memberEvents.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                              등록된 행사 이력이 없습니다
                            </TableCell>
                          </TableRow>
                        ) : (
                          memberEvents.map((event, index) => (
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
                              <TableCell>
                                <Badge 
                                  variant={event.status === "진행중" ? "default" : "secondary"}
                                  className={event.status === "진행중" 
                                    ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" 
                                    : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                                  }
                                >
                                  {event.status}
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
              )}

              {/* 주문등록 탭 콘텐츠 */}
              {activeTab === "order-new" && (
                <div className="space-y-6">
                  {/* 주문 등록 안내 */}
                  <Card className="border-l-4 border-l-emerald-500">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-4">
                            <Star className="h-5 w-5 text-red-500" />
                            <h3 className="text-lg font-bold">주문 등록 안내</h3>
                          </div>
                          <ul className="space-y-2 text-sm text-muted-foreground">
                            <li className="flex items-start gap-2">
                              <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                              <span>
                                <strong>주문 마감:</strong> 1차 마감: 당일 오전 9시(최우선 발송)/ 2차 마감: 당일 오전 10시(재고,주문 상황에 따라 미발송건이 있을 수 있습니다)
                              </span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                              <span>엑셀 파일로만 주문 등록 가능 (개별 수기 접수 불가)/ <strong className="text-blue-600">엑셀 xlsx,xls 형식</strong>(csv형식은 사용 안함)</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                              <span>주문 등록 완료 후 메신저로 알림이 발송됩니다</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                              <span>주문 마감 시간을 꼭 지켜주세요 (지연 시 송장, 포장, 출고 모두 지연)</span>
                            </li>
                          </ul>
                        </div>
                        <Button variant="ghost" className="text-emerald-600 shrink-0">
                          상세 가이드 보기 →
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* 주문 대기 리스트 */}
                  <Card className="overflow-hidden">
                    <CardHeader className="pb-4">
                      <div className="flex items-center gap-2">
                        <Package className="h-5 w-5 text-primary" />
                        <CardTitle className="text-base">주문 대기 리스트</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4 overflow-hidden">
                      {/* 필터 영역 - 공통 필터 컴포넌트 사용 */}
                      <MemberOrderFilter 
                        onFilterChange={(filters) => {
                          setCategoryLargeFilter(filters.categoryLarge);
                          setCategoryMediumFilter(filters.categoryMedium);
                          setCategorySmallFilter(filters.categorySmall);
                          setSearchTerm(filters.searchTerm);
                        }}
                        showSearchField={true}
                        searchOptions={[
                          { value: "ordererName", label: "주문자명" },
                          { value: "recipientName", label: "수령자명" },
                          { value: "productName", label: "상품명" },
                        ]}
                      />

                      {/* 액션 버튼 및 페이지네이션 */}
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" className="h-8" data-testid="button-download-orders">
                            <FileDown className="h-4 w-4 mr-1" />
                            다운로드
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-8" 
                            data-testid="button-download-form"
                            onClick={handleDownloadTemplate}
                          >
                            <FileDown className="h-4 w-4 mr-1" />
                            주문등록양식 다운
                          </Button>
                          <Dialog open={orderDialogOpen} onOpenChange={(open) => {
                              if (open) {
                                setOrderDialogOpen(true);
                              } else {
                                handleCloseUploadDialog();
                              }
                            }}>
                            <DialogTrigger asChild>
                              <Button size="sm" className="h-8 bg-primary" data-testid="button-new-order">
                                <Plus className="h-4 w-4 mr-1" />
                                엑셀 주문 등록
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-lg">
                              <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                  <FileDown className="h-5 w-5" />
                                  엑셀 파일로 주문 등록
                                </DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4 py-4">
                                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                                  <h4 className="font-medium text-amber-800 dark:text-amber-200 mb-2">주문 등록 안내</h4>
                                  <ul className="text-sm text-amber-700 dark:text-amber-300 space-y-1">
                                    <li>• 주문등록양식 파일을 다운로드하여 작성해 주세요</li>
                                    <li>• xlsx, xls 형식만 지원됩니다 (csv 불가)</li>
                                    <li>• 수기 주문은 불가능하며, 엑셀 업로드만 가능합니다</li>
                                  </ul>
                                </div>

                                <div className="space-y-2">
                                  <Label>엑셀 파일 선택</Label>
                                  <Input
                                    type="file"
                                    accept=".xlsx,.xls"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) setExcelFile(file);
                                    }}
                                    data-testid="input-excel-file"
                                  />
                                  {excelFile && (
                                    <p className="text-sm text-muted-foreground">
                                      선택된 파일: {excelFile.name}
                                    </p>
                                  )}
                                </div>

                                {uploadProgress && (
                                  <div className={`rounded-lg p-4 ${uploadProgress.failed > 0 ? 'bg-destructive/10 border border-destructive/30' : 'bg-muted/50'}`}>
                                    <h4 className="font-medium mb-2">
                                      {uploadProgress.failed > 0 ? '업로드 반려' : '업로드 결과'}
                                    </h4>
                                    <div className="flex gap-4 text-sm mb-2">
                                      <span>전체: {uploadProgress.total}건</span>
                                      <span className="text-emerald-600">성공: {uploadProgress.success}건</span>
                                      {uploadProgress.failed > 0 && (
                                        <span className="text-destructive">실패: {uploadProgress.failed}건</span>
                                      )}
                                    </div>
                                    {uploadProgress.errors && uploadProgress.errors.length > 0 && (
                                      <div className="mt-3 border-t border-destructive/20 pt-3">
                                        <h5 className="text-sm font-medium text-destructive mb-2">반려 사유:</h5>
                                        <ul className="text-sm text-destructive space-y-1 max-h-40 overflow-y-auto">
                                          {uploadProgress.errors.map((error, idx) => (
                                            <li key={idx} className="flex items-start gap-1">
                                              <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                                              <span>{error}</span>
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                              <div className="flex justify-between gap-2">
                                <Button 
                                  variant="outline" 
                                  onClick={handleDownloadTemplate}
                                  data-testid="button-download-template"
                                >
                                  <FileDown className="h-4 w-4 mr-1" />
                                  양식 다운로드
                                </Button>
                                <div className="flex gap-2">
                                  <Button variant="outline" onClick={handleCloseUploadDialog} data-testid="button-cancel-order">
                                    취소
                                  </Button>
                                  <Button 
                                    onClick={handleExcelUpload} 
                                    disabled={!excelFile || uploadExcelMutation.isPending} 
                                    data-testid="button-submit-order"
                                  >
                                    {uploadExcelMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                    업로드
                                  </Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <span>표시 개수:</span>
                          <select 
                            className="h-8 px-2 border rounded text-sm"
                            value={tablePageSize === "all" ? "all" : tablePageSize.toString()}
                            onChange={(e) => setTablePageSize(e.target.value === "all" ? "all" : parseInt(e.target.value))}
                            data-testid="select-page-size"
                          >
                            <option value="10">10개씩</option>
                            <option value="30">30개씩</option>
                            <option value="100">100개씩</option>
                            <option value="all">전체</option>
                          </select>
                          <span className="text-muted-foreground ml-2">
                            {displayedPendingOrders.length} / {filteredPendingOrders.length}건
                          </span>
                        </div>
                      </div>

                      {/* 테이블 - 주문대기리스트 형식 (테이블 영역만 가로 스크롤) */}
                      <div className="border rounded-lg overflow-x-auto overflow-y-auto max-h-[600px]">
                        <Table className="w-max">
                          <TableHeader className="sticky top-0 z-10 bg-background">
                            <TableRow className="bg-muted/50">
                              <TableHead className="font-semibold whitespace-nowrap w-12">순번</TableHead>
                              <TableHead className="font-semibold whitespace-nowrap">대분류</TableHead>
                              <TableHead className="font-semibold whitespace-nowrap">중분류</TableHead>
                              <TableHead className="font-semibold whitespace-nowrap">소분류</TableHead>
                              <TableHead className="font-semibold whitespace-nowrap">상품코드</TableHead>
                              <TableHead className="font-semibold whitespace-nowrap">상품명</TableHead>
                              <TableHead className="font-semibold whitespace-nowrap">공급가</TableHead>
                              <TableHead className="font-semibold whitespace-nowrap">주문자명</TableHead>
                              <TableHead className="font-semibold whitespace-nowrap">주문자 전화번호</TableHead>
                              <TableHead className="font-semibold whitespace-nowrap">수령자명</TableHead>
                              <TableHead className="font-semibold whitespace-nowrap">수령자휴대폰번호</TableHead>
                              <TableHead className="font-semibold whitespace-nowrap">수령자 전화번호</TableHead>
                              <TableHead className="font-semibold whitespace-nowrap">수령자 주소</TableHead>
                              <TableHead className="font-semibold whitespace-nowrap">배송메시지</TableHead>
                              <TableHead className="font-semibold whitespace-nowrap">주문번호</TableHead>
                              <TableHead className="font-semibold whitespace-nowrap">자체주문번호</TableHead>
                              <TableHead className="font-semibold whitespace-nowrap">운송장번호</TableHead>
                              <TableHead className="font-semibold whitespace-nowrap">택배사</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {pendingOrdersLoading ? (
                              <TableRow>
                                <TableCell colSpan={18} className="text-center py-12">
                                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                                </TableCell>
                              </TableRow>
                            ) : displayedPendingOrders.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={18} className="text-center text-muted-foreground py-12">
                                  {searchTerm ? "검색 결과가 없습니다" : "등록된 주문이 없습니다"}
                                </TableCell>
                              </TableRow>
                            ) : (
                              displayedPendingOrders.map((order, index) => (
                                <TableRow key={order.id} data-testid={`row-order-${order.id}`}>
                                  <TableCell className="font-medium font-mono text-xs">{order.sequenceNumber}</TableCell>
                                  <TableCell className="text-sm">{order.categoryLarge || "-"}</TableCell>
                                  <TableCell className="text-sm">{order.categoryMedium || "-"}</TableCell>
                                  <TableCell className="text-sm">{order.categorySmall || "-"}</TableCell>
                                  <TableCell className="text-sm font-mono">{order.productCode}</TableCell>
                                  <TableCell className="text-sm">{order.productName}</TableCell>
                                  <TableCell className="text-sm text-right">{order.supplyPrice?.toLocaleString() || "-"}</TableCell>
                                  <TableCell className="text-sm">{order.ordererName}</TableCell>
                                  <TableCell className="text-sm">{order.ordererPhone}</TableCell>
                                  <TableCell className="text-sm">{order.recipientName}</TableCell>
                                  <TableCell className="text-sm">{order.recipientMobile}</TableCell>
                                  <TableCell className="text-sm">{order.recipientPhone || "-"}</TableCell>
                                  <TableCell className="text-sm max-w-[200px] truncate">{order.recipientAddress}</TableCell>
                                  <TableCell className="text-sm max-w-[150px] truncate">{order.deliveryMessage || "-"}</TableCell>
                                  <TableCell className="text-sm font-mono">{order.orderNumber}</TableCell>
                                  <TableCell className="text-sm font-mono">{order.customOrderNumber}</TableCell>
                                  <TableCell className="text-sm">{order.trackingNumber || "-"}</TableCell>
                                  <TableCell className="text-sm">{order.courierCompany || "-"}</TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>

                      {/* 페이지네이션 */}
                      <div className="flex justify-center gap-2">
                        <Button size="sm" variant="outline" disabled>이전</Button>
                        <Button size="sm" variant="outline" disabled>다음</Button>
                      </div>
                    </CardContent>
                  </Card>

                </div>
              )}

              {/* 주문조정건 확인 탭 */}
              {activeTab === "order-adjust" && (
                <MemberOrderAdjust />
              )}

              {/* 송장파일 다운로드 탭 */}
              {activeTab === "order-invoice" && (
                <MemberOrderInvoice />
              )}

              {/* 취소건 등록 탭 */}
              {activeTab === "order-cancel" && (
                <MemberOrderCancel />
              )}

              {/* 주문건 조회 탭 */}
              {activeTab === "order-list" && (
                <MemberOrderList />
              )}
          </main>
        </div>
      </div>
  );
}
