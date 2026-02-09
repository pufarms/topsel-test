import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  LayoutDashboard, 
  Users, 
  ShoppingCart, 
  Package, 
  Calculator, 
  BarChart3, 
  Ticket, 
  FileText, 
  Settings, 
  ChevronDown, 
  ChevronRight, 
  LogOut, 
  Menu, 
  X,
  Image as ImageIcon,
  UserCog,
  Building2,
  User,
  ChevronLeft,
  Warehouse,
  Shield,
  MessageSquare
} from "lucide-react";

interface MenuItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  path?: string;
  children?: { id: string; label: string; path: string }[];
}

const menuItems: MenuItem[] = [
  { id: "dashboard", label: "대시보드", icon: <LayoutDashboard className="h-5 w-5" />, path: "/admin" },
  { 
    id: "members", 
    label: "회원관리", 
    icon: <Users className="h-5 w-5" />,
    children: [
      { id: "admin-users", label: "관리자 관리", path: "/admin/admins" },
      { id: "vendors", label: "외주(공급)업체 관리", path: "/admin/vendors" },
      { id: "users", label: "회원관리", path: "/admin/users" },
      { id: "term-agreements", label: "약관 동의 기록", path: "/admin/term-agreements" },
    ]
  },
  { 
    id: "orders", 
    label: "주문관리", 
    icon: <ShoppingCart className="h-5 w-5" />,
    children: [
      { id: "orders-pending", label: "주문 대기", path: "/admin/orders/pending" },
      { id: "orders-admin-cancel", label: "주문조정(직권취소)", path: "/admin/orders/admin-cancel" },
      { id: "orders-preparing", label: "상품준비중", path: "/admin/orders/preparing" },
      { id: "orders-print-waybill", label: "운송장 출력", path: "/admin/orders/print-waybill" },
      { id: "orders-ready-to-ship", label: "배송준비중", path: "/admin/orders/ready-to-ship" },
      { id: "orders-cancelled", label: "취소건 관리", path: "/admin/orders/cancelled" },
      { id: "orders-shipping", label: "배송중", path: "/admin/orders/shipping" },
      { id: "orders-completed", label: "배송완료", path: "/admin/orders/completed" },
      { id: "orders-allocations", label: "일일 배분", path: "/admin/orders/allocations" },
    ]
  },
  { 
    id: "products", 
    label: "상품관리", 
    icon: <Package className="h-5 w-5" />,
    children: [
      { id: "categories", label: "카테고리 관리", path: "/admin/products/categories" },
      { id: "product-registration", label: "상품등록 (공급가 계산)", path: "/admin/products/registration" },
      { id: "next-week-products", label: "차주 예상공급가 상품", path: "/admin/products/next-week" },
      { id: "current-products", label: "현재 공급가 상품", path: "/admin/products/current" },
      { id: "suspended-products", label: "공급 중지 상품", path: "/admin/products/suspended" },
    ]
  },
  { 
    id: "inventory", 
    label: "재고관리", 
    icon: <Warehouse className="h-5 w-5" />,
    children: [
      { id: "inventory-material-types", label: "재료타입 관리", path: "/admin/inventory/material-types" },
      { id: "inventory-materials", label: "원재료 관리", path: "/admin/inventory/materials" },
      { id: "inventory-mapping", label: "상품 매핑", path: "/admin/inventory/mapping" },
      { id: "inventory-stock", label: "공급상품 재고 관리", path: "/admin/inventory/stock" },
      { id: "inventory-history", label: "재고 이력", path: "/admin/inventory/history" },
    ]
  },
  { id: "settlements", label: "정산관리", icon: <Calculator className="h-5 w-5" />, path: "/admin/settlements" },
  { id: "stats", label: "통계관리", icon: <BarChart3 className="h-5 w-5" />, path: "/admin/stats" },
  { id: "coupons", label: "쿠폰관리", icon: <Ticket className="h-5 w-5" />, path: "/admin/coupons" },
  { 
    id: "kakao-notifications", 
    label: "카카오 알림 관리", 
    icon: <MessageSquare className="h-5 w-5" />,
    children: [
      { id: "kakao-alimtalk", label: "알림톡(고정)", path: "/admin/kakao-notifications/alimtalk" },
      { id: "kakao-friendtalk", label: "친구톡 관리", path: "/admin/kakao-notifications/brandtalk" },
    ]
  },
  { 
    id: "pages", 
    label: "페이지관리", 
    icon: <FileText className="h-5 w-5" />,
    children: [
      { id: "pages-all", label: "전체 페이지", path: "/admin/pages" },
      { id: "pages-basic", label: "기본페이지", path: "/admin/pages?category=기본페이지" },
      { id: "pages-main-sub", label: "메인/서브페이지", path: "/admin/pages?category=메인/서브페이지" },
      { id: "pages-mypage", label: "회원마이페이지", path: "/admin/pages?category=회원마이페이지" },
      { id: "pages-order", label: "주문관리(관리자)", path: `/admin/pages?category=${encodeURIComponent("주문관리(관리자)")}` },
      { id: "pages-product", label: "상품관리(관리자)", path: `/admin/pages?category=${encodeURIComponent("상품관리(관리자)")}` },
      { id: "pages-inventory", label: "재고관리(관리자)", path: `/admin/pages?category=${encodeURIComponent("재고관리(관리자)")}` },
      { id: "pages-member-mgmt", label: "회원/업체관리(관리자)", path: `/admin/pages?category=${encodeURIComponent("회원/업체관리(관리자)")}` },
      { id: "pages-stats", label: "통계관리페이지", path: "/admin/pages?category=통계관리페이지" },
      { id: "pages-site-mgmt", label: "사이트관리(관리자)", path: `/admin/pages?category=${encodeURIComponent("사이트관리(관리자)")}` },
      { id: "pages-guide", label: "가이드페이지", path: "/admin/pages?category=가이드페이지" },
      { id: "pages-board", label: "게시판관리페이지", path: "/admin/pages?category=게시판관리페이지" },
      { id: "pages-etc", label: "기타페이지", path: "/admin/pages?category=기타페이지" },
    ]
  },
  { 
    id: "settings", 
    label: "설정", 
    icon: <Settings className="h-5 w-5" />,
    children: [
      { id: "site-settings", label: "사이트 설정", path: "/admin/settings/site" },
      { id: "form-templates", label: "양식 관리", path: "/admin/settings/form-templates" },
      { id: "gallery", label: "이미지 갤러리", path: "/admin/settings/gallery" },
    ]
  },
];

type SidebarMode = "full" | "collapsed" | "hidden";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>("full");
  const [openMenus, setOpenMenus] = useState<string[]>([]);
  const [searchParams, setSearchParams] = useState(window.location.search);

  // URL 변경 감지 및 searchParams 업데이트 (브라우저 뒤로/앞으로 버튼용)
  useEffect(() => {
    const handlePopState = () => {
      setSearchParams(window.location.search);
    };
    
    // popstate 이벤트 리스너 (브라우저 네비게이션용)
    window.addEventListener('popstate', handlePopState);
    
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // 현재 위치에 따라 부모 메뉴 자동 열기
  useEffect(() => {
    const currentFullPath = location + searchParams;
    const openParents: string[] = [];
    
    menuItems.forEach(item => {
      if (item.children) {
        const isChildActive = item.children.some(child => {
          if (child.path.includes('?')) {
            return child.path === currentFullPath;
          }
          return child.path === location && !searchParams;
        });
        if (isChildActive && !openMenus.includes(item.id)) {
          openParents.push(item.id);
        }
      }
    });
    
    if (openParents.length > 0) {
      setOpenMenus(openParents); // 해당 부모 메뉴만 열기
    }
  }, [location, searchParams]);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 768) {
        setSidebarMode("hidden");
        setMobileOpen(false);
      } else if (width < 1024) {
        setSidebarMode("collapsed");
        setMobileOpen(false);
      } else {
        setSidebarMode("full");
        setMobileOpen(false);
      }
    };
    
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const toggleMenu = (id: string) => {
    setOpenMenus(prev => 
      prev.includes(id) 
        ? [] // 열린 메뉴를 클릭하면 닫기
        : [id] // 다른 메뉴를 클릭하면 해당 메뉴만 열기 (나머지는 자동 닫힘)
    );
  };

  const toggleSidebar = () => {
    if (sidebarMode === "hidden") {
      setMobileOpen(!mobileOpen);
    } else {
      setSidebarMode(sidebarMode === "full" ? "collapsed" : "full");
    }
  };

  const isActive = (path?: string) => {
    if (!path) return false;
    const currentFullPath = location + searchParams;
    
    // 쿼리 파라미터가 있는 경로는 전체 URL과 비교
    if (path.includes('?')) {
      return path === currentFullPath;
    }
    
    // 쿼리 파라미터가 없는 경로는 현재 URL에도 쿼리 파라미터가 없을 때만 비교
    // 현재 URL에 쿼리 파라미터가 있으면 false 반환
    if (searchParams) {
      return false;
    }
    
    return path === location;
  };
  const isChildActive = (children?: { path: string }[]) => 
    children?.some(child => isActive(child.path));
  
  const isCollapsed = sidebarMode === "collapsed";
  const sidebarWidth = isCollapsed ? "w-16" : "w-64";

  const renderMenuItem = (item: MenuItem) => {
    if (isCollapsed) {
      if (item.children) {
        return (
          <Tooltip key={item.id}>
            <TooltipTrigger asChild>
              <div
                className="flex items-center justify-center p-2.5 rounded-md cursor-pointer transition-colors text-slate-300 hover:bg-slate-800 hover:text-white"
                data-testid={`menu-${item.id}`}
              >
                {item.icon}
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="flex flex-col gap-1">
              <span className="font-medium">{item.label}</span>
              {item.children.map((child) => (
                <Link key={child.id} href={child.path}>
                  <span
                    className={`block text-sm cursor-pointer ${
                      isActive(child.path) ? "text-primary" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {child.label}
                  </span>
                </Link>
              ))}
            </TooltipContent>
          </Tooltip>
        );
      }
      return (
        <Tooltip key={item.id}>
          <TooltipTrigger asChild>
            <Link href={item.path!}>
              <div
                className={`flex items-center justify-center p-2.5 rounded-md cursor-pointer transition-colors ${
                  isActive(item.path)
                    ? "bg-slate-700/70 text-sky-400 ring-1 ring-sky-400/50"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
                data-testid={`menu-${item.id}`}
              >
                {item.icon}
              </div>
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right">{item.label}</TooltipContent>
        </Tooltip>
      );
    }

    if (item.children) {
      return (
        <Collapsible 
          key={item.id}
          open={openMenus.includes(item.id)} 
          onOpenChange={() => toggleMenu(item.id)}
        >
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-md text-sm font-medium transition-colors text-slate-300 hover:bg-slate-800 hover:text-white"
              data-testid={`menu-${item.id}`}
            >
              <div className="flex items-center gap-3">
                {item.icon}
                <span>{item.label}</span>
              </div>
              {openMenus.includes(item.id) ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent forceMount className={`pl-8 mt-1 space-y-1 ${openMenus.includes(item.id) ? "" : "hidden"}`}>
            {item.children.map((child) => {
              const handleClick = (e: React.MouseEvent) => {
                e.preventDefault();
                setMobileOpen(false);
                
                // 쿼리 파라미터 추출
                const queryIndex = child.path.indexOf('?');
                const newSearchParams = queryIndex !== -1 ? child.path.substring(queryIndex) : '';
                const basePath = child.path.split('?')[0];
                
                // 1. searchParams 상태 업데이트 (사이드바 하이라이트용)
                setSearchParams(newSearchParams);
                
                // 2. URL 업데이트 (History API)
                window.history.pushState({}, '', child.path);
                
                // 3. 커스텀 이벤트 발생 (페이지 콘텐츠 업데이트용 - pages.tsx가 수신)
                window.dispatchEvent(new CustomEvent('admin-navigate', { 
                  detail: { path: child.path, search: newSearchParams } 
                }));
                
                // 4. wouter 라우터 동기화 (location 변경 없이 현재 경로와 다를 때만)
                if (location !== basePath) {
                  navigate(basePath);
                }
              };
              return (
                <a 
                  key={child.id} 
                  href={child.path} 
                  onClick={handleClick}
                  className={`block px-3 py-2 rounded-md text-sm cursor-pointer transition-colors ${
                    isActive(child.path)
                      ? "bg-slate-700/70 text-sky-400 font-medium border-l-2 border-sky-400 ml-[-2px] pl-[13px]"
                      : "text-slate-400 hover:bg-slate-800 hover:text-white"
                  }`}
                  data-testid={`menu-${child.id}`}
                >
                  {child.label}
                </a>
              );
            })}
          </CollapsibleContent>
        </Collapsible>
      );
    }

    return (
      <Link key={item.id} href={item.path!} onClick={() => setMobileOpen(false)}>
        <span
          className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium cursor-pointer transition-colors ${
            isActive(item.path)
              ? "bg-slate-700/70 text-sky-400 border-l-2 border-sky-400 ml-[-2px] pl-[13px]"
              : "text-slate-300 hover:bg-slate-800 hover:text-white"
          }`}
          data-testid={`menu-${item.id}`}
        >
          {item.icon}
          <span>{item.label}</span>
        </span>
      </Link>
    );
  };

  const mainPadding = sidebarMode === "full" ? "lg:pl-64" : sidebarMode === "collapsed" ? "md:pl-16" : "";

  return (
    <div className="min-h-screen bg-background">
      <header className="fixed top-0 left-0 right-0 h-14 bg-slate-800 border-b border-slate-700 z-50 flex items-center justify-between px-3 md:px-4">
        <div className="flex items-center gap-2 md:gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-slate-700"
            onClick={toggleSidebar}
            data-testid="button-toggle-sidebar"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          <Link href="/admin">
            <span className="text-lg md:text-xl font-bold text-white cursor-pointer">탑셀러 관리자</span>
          </Link>
        </div>
        <div className="flex items-center gap-2 md:gap-4">
          <span className="text-xs md:text-sm text-slate-300 hidden sm:block">{user?.name}님</span>
          <Button
            variant="ghost"
            size="sm"
            className="text-slate-300 hover:text-white hover:bg-slate-700"
            onClick={handleLogout}
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline">로그아웃</span>
          </Button>
        </div>
      </header>

      {/* Desktop/Tablet Sidebar */}
      {sidebarMode !== "hidden" && (
        <aside 
          className={`fixed top-14 left-0 bottom-0 ${sidebarWidth} bg-slate-900 border-r border-slate-800 transition-all z-40 hidden md:block`}
        >
          <ScrollArea className="h-full py-4">
            <nav className={`${isCollapsed ? "px-2" : "px-3"} space-y-1`}>
              {menuItems.map(renderMenuItem)}
            </nav>
          </ScrollArea>
          {!isCollapsed && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute -right-3 top-6 h-6 w-6 rounded-full bg-slate-700 text-white hover:bg-slate-600 hidden lg:flex"
              onClick={() => setSidebarMode("collapsed")}
              data-testid="button-collapse-sidebar"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          {isCollapsed && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute -right-3 top-6 h-6 w-6 rounded-full bg-slate-700 text-white hover:bg-slate-600"
              onClick={() => setSidebarMode("full")}
              data-testid="button-expand-sidebar"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </aside>
      )}

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && sidebarMode === "hidden" && (
        <>
          <div 
            className="fixed inset-0 bg-black/50 z-30 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed top-14 left-0 bottom-0 w-64 bg-slate-900 border-r border-slate-800 z-40 md:hidden">
            <ScrollArea className="h-full py-4">
              <nav className="px-3 space-y-1">
                {menuItems.map(renderMenuItem)}
              </nav>
            </ScrollArea>
          </aside>
        </>
      )}

      <main className={`pt-14 transition-all ${mainPadding} overflow-x-hidden`}>
        <div className="p-3 md:p-6 min-w-0">
          {children}
        </div>
      </main>
    </div>
  );
}
