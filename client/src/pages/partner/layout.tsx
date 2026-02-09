import { useLocation, Link } from "wouter";
import { usePartnerAuth } from "@/lib/partner-auth";
import { Button } from "@/components/ui/button";
import { Loader2, LayoutDashboard, MessageSquareReply, ClipboardList, ScanBarcode, Truck, LogOut, Menu, X, Building2 } from "lucide-react";
import { useState } from "react";

const navItems = [
  { title: "대시보드", path: "/partner", icon: LayoutDashboard },
  { title: "예상수량 응답", path: "/partner/allocations", icon: MessageSquareReply },
  { title: "주문 현황", path: "/partner/orders", icon: ClipboardList },
  { title: "운송장 등록", path: "/partner/tracking", icon: ScanBarcode },
  { title: "배송 현황", path: "/partner/delivery", icon: Truck },
];

export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  const { vendor, isLoading, logout } = usePartnerAuth();
  const [location, navigate] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
      </div>
    );
  }

  if (!vendor) {
    navigate("/partner/login");
    return null;
  }

  const handleLogout = async () => {
    await logout();
    navigate("/partner/login");
  };

  const isActive = (path: string) => {
    if (path === "/partner") return location === "/partner";
    return location.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-sky-600 dark:bg-sky-800 text-white sticky top-0 z-50">
        <div className="flex items-center justify-between px-4 h-14 gap-2">
          <div className="flex items-center gap-2">
            <button className="lg:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} data-testid="button-mobile-menu">
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <Building2 className="h-5 w-5" />
            <span className="font-semibold text-sm sm:text-base whitespace-nowrap">탑셀러 협력업체</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm hidden sm:inline opacity-90">{vendor.companyName}</span>
            <Button size="sm" variant="ghost" className="text-white hover:bg-white/20 no-default-hover-elevate" onClick={handleLogout} data-testid="button-logout">
              <LogOut className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">로그아웃</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden lg:flex w-56 border-r flex-col bg-muted/30 py-2 overflow-y-auto">
          {navItems.map((item) => (
            <Link key={item.path} href={item.path}>
              <div
                className={`flex items-center gap-2 px-4 py-2.5 text-sm cursor-pointer transition-colors ${
                  isActive(item.path)
                    ? "bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 font-medium border-r-2 border-sky-600"
                    : "text-muted-foreground hover-elevate"
                }`}
                data-testid={`nav-${item.path.split("/").pop() || "dashboard"}`}
              >
                <item.icon className="h-4 w-4" />
                {item.title}
              </div>
            </Link>
          ))}
        </aside>

        {mobileMenuOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
            <aside className="absolute left-0 top-14 bottom-0 w-56 bg-background border-r overflow-y-auto z-50">
              {navItems.map((item) => (
                <Link key={item.path} href={item.path}>
                  <div
                    className={`flex items-center gap-2 px-4 py-3 text-sm cursor-pointer ${
                      isActive(item.path)
                        ? "bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 font-medium"
                        : "text-muted-foreground"
                    }`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.title}
                  </div>
                </Link>
              ))}
            </aside>
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>

      <nav className="lg:hidden border-t bg-background fixed bottom-0 left-0 right-0 z-40">
        <div className="flex justify-around">
          {navItems.map((item) => (
            <Link key={item.path} href={item.path}>
              <div
                className={`flex flex-col items-center py-2 px-1 text-xs cursor-pointer ${
                  isActive(item.path) ? "text-sky-600 dark:text-sky-400" : "text-muted-foreground"
                }`}
                data-testid={`tab-${item.path.split("/").pop() || "dashboard"}`}
              >
                <item.icon className="h-5 w-5 mb-0.5" />
                <span className="truncate max-w-[60px]">{item.title}</span>
              </div>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
