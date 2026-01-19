import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  User
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
      { id: "partners", label: "협력업체 관리", path: "/admin/partners" },
      { id: "users", label: "사용자 관리", path: "/admin/users" },
    ]
  },
  { id: "orders", label: "주문관리", icon: <ShoppingCart className="h-5 w-5" />, path: "/admin/orders" },
  { id: "products", label: "상품관리", icon: <Package className="h-5 w-5" />, path: "/admin/products" },
  { id: "settlements", label: "정산관리", icon: <Calculator className="h-5 w-5" />, path: "/admin/settlements" },
  { id: "stats", label: "통계관리", icon: <BarChart3 className="h-5 w-5" />, path: "/admin/stats" },
  { id: "coupons", label: "쿠폰관리", icon: <Ticket className="h-5 w-5" />, path: "/admin/coupons" },
  { id: "pages", label: "페이지관리", icon: <FileText className="h-5 w-5" />, path: "/admin/pages" },
  { 
    id: "settings", 
    label: "설정", 
    icon: <Settings className="h-5 w-5" />,
    children: [
      { id: "site-settings", label: "사이트 설정", path: "/admin/settings/site" },
      { id: "gallery", label: "이미지 갤러리", path: "/admin/settings/gallery" },
    ]
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [openMenus, setOpenMenus] = useState<string[]>(["members", "settings"]);

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const toggleMenu = (id: string) => {
    setOpenMenus(prev => 
      prev.includes(id) 
        ? prev.filter(m => m !== id) 
        : [...prev, id]
    );
  };

  const isActive = (path?: string) => path === location;
  const isChildActive = (children?: { path: string }[]) => 
    children?.some(child => child.path === location);

  return (
    <div className="min-h-screen bg-background">
      <header className="fixed top-0 left-0 right-0 h-14 bg-slate-800 border-b border-slate-700 z-50 flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-slate-700 lg:hidden"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            data-testid="button-toggle-sidebar"
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          <Link href="/admin">
            <span className="text-xl font-bold text-white cursor-pointer">탑셀러 관리자</span>
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-300">{user?.name}님</span>
          <Button
            variant="ghost"
            size="sm"
            className="text-slate-300 hover:text-white hover:bg-slate-700"
            onClick={handleLogout}
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4 mr-2" />
            로그아웃
          </Button>
        </div>
      </header>

      <aside 
        className={`fixed top-14 left-0 bottom-0 w-64 bg-slate-900 border-r border-slate-800 transition-transform z-40 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
      >
        <ScrollArea className="h-full py-4">
          <nav className="px-3 space-y-1">
            {menuItems.map((item) => (
              <div key={item.id}>
                {item.children ? (
                  <Collapsible 
                    open={openMenus.includes(item.id)} 
                    onOpenChange={() => toggleMenu(item.id)}
                    defaultOpen={true}
                  >
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                          isChildActive(item.children)
                            ? "bg-primary text-white"
                            : "text-slate-300 hover:bg-slate-800 hover:text-white"
                        }`}
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
                      {item.children.map((child) => (
                        <Link key={child.id} href={child.path}>
                          <span
                            className={`block px-3 py-2 rounded-md text-sm cursor-pointer transition-colors ${
                              isActive(child.path)
                                ? "bg-primary/20 text-primary"
                                : "text-slate-400 hover:bg-slate-800 hover:text-white"
                            }`}
                            data-testid={`menu-${child.id}`}
                          >
                            {child.label}
                          </span>
                        </Link>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                ) : (
                  <Link href={item.path!}>
                    <span
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium cursor-pointer transition-colors ${
                        isActive(item.path)
                          ? "bg-primary text-white"
                          : "text-slate-300 hover:bg-slate-800 hover:text-white"
                      }`}
                      data-testid={`menu-${item.id}`}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </span>
                  </Link>
                )}
              </div>
            ))}
          </nav>
        </ScrollArea>
      </aside>

      <main className={`pt-14 transition-all ${sidebarOpen ? "lg:pl-64" : ""} lg:pl-64`}>
        <div className="p-6">
          {children}
        </div>
      </main>

      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
