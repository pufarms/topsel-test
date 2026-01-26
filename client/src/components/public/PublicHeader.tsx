import { Link, useLocation } from "wouter";
import { usePublicSiteSettings, usePublicHeaderMenus } from "@/hooks/use-site-settings";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Menu, LogOut } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import type { HeaderMenu } from "@shared/schema";

interface PublicHeaderProps {
  transparent?: boolean;
}

export function PublicHeader({ transparent = false }: PublicHeaderProps) {
  const { data: settings } = usePublicSiteSettings();
  const { data: menus } = usePublicHeaderMenus();
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    if (!transparent) {
      setIsScrolled(true);
      return;
    }
    
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 60);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    
    return () => window.removeEventListener("scroll", handleScroll);
  }, [transparent]);

  const siteName = settings?.site_name || "탑셀러";
  const logoUrl = settings?.header_logo_url;
  const logoAlt = settings?.header_logo_alt || siteName;

  const filteredMenus = menus?.filter((menu: HeaderMenu) => {
    if (menu.isVisible !== "true") return false;
    
    if (user) {
      return menu.showWhenLoggedIn === "true";
    } else {
      return menu.showWhenLoggedOut === "true";
    }
  }) || [];

  const handleLogout = async () => {
    try {
      await logout();
      toast({ title: "로그아웃 완료", description: "성공적으로 로그아웃되었습니다." });
      navigate("/");
    } catch (error) {
      toast({ title: "로그아웃 실패", variant: "destructive" });
    }
  };

  const showTransparent = transparent && !isScrolled;

  const renderMenuItem = (menu: HeaderMenu, isMobile: boolean = false) => {
    if (menu.systemKey === "logout") {
      return (
        <Button
          key={menu.id}
          variant="ghost"
          className={isMobile 
            ? "justify-start w-full" 
            : `transition-colors duration-300 ${showTransparent ? "text-white" : "text-foreground"}`
          }
          onClick={() => {
            handleLogout();
            if (isMobile) setMobileMenuOpen(false);
          }}
          data-testid={isMobile ? `mobile-menu-${menu.id}` : `link-menu-${menu.id}`}
        >
          <LogOut className="h-4 w-4 mr-2" />
          {menu.name}
        </Button>
      );
    }

    if (menu.openInNewTab === "true") {
      return (
        <a
          key={menu.id}
          href={menu.path}
          target="_blank"
          rel="noopener noreferrer"
          className={isMobile 
            ? "text-sm font-medium px-4 py-2 rounded-md block text-foreground"
            : `text-sm font-medium transition-colors duration-300 ${showTransparent ? "text-white" : "text-foreground"}`
          }
          onClick={() => isMobile && setMobileMenuOpen(false)}
          data-testid={isMobile ? `mobile-menu-${menu.id}` : `link-menu-${menu.id}`}
        >
          {menu.name}
        </a>
      );
    }

    return (
      <Link
        key={menu.id}
        href={menu.path}
        className={isMobile 
          ? "text-sm font-medium px-4 py-2 rounded-md block text-foreground"
          : `text-sm font-medium transition-colors duration-300 ${showTransparent ? "text-white" : "text-foreground"}`
        }
        onClick={() => isMobile && setMobileMenuOpen(false)}
        data-testid={isMobile ? `mobile-menu-${menu.id}` : `link-menu-${menu.id}`}
      >
        {menu.name}
      </Link>
    );
  };

  return (
    <header 
      className="fixed top-0 left-0 right-0 z-50 w-full"
      style={{
        backgroundColor: showTransparent ? 'transparent' : 'hsl(var(--background))',
        boxShadow: showTransparent ? 'none' : '0 1px 3px rgba(0,0,0,0.1)',
        transition: 'background-color 0.3s ease, box-shadow 0.3s ease'
      }}
    >
      <div className="container flex h-16 items-center justify-between gap-4 px-4 md:px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2" data-testid="link-home">
            {logoUrl ? (
              <img 
                src={logoUrl} 
                alt={logoAlt} 
                className="h-8 w-auto"
                style={{
                  filter: showTransparent ? 'brightness(0) invert(1)' : 'none',
                  transition: 'filter 0.3s ease'
                }}
              />
            ) : (
              <span 
                className="text-lg font-bold"
                style={{
                  color: showTransparent ? 'white' : 'hsl(var(--foreground))',
                  transition: 'color 0.3s ease'
                }}
              >
                {siteName}
              </span>
            )}
          </Link>
        </div>

        <nav className="hidden md:flex items-center gap-4">
          {filteredMenus.map((menu) => renderMenuItem(menu, false))}
        </nav>

        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild className="md:hidden">
            <Button 
              variant="ghost" 
              size="icon" 
              className={`transition-colors duration-300 ${showTransparent ? "text-white" : "text-foreground"}`}
              data-testid="button-mobile-menu"
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">메뉴</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[250px]">
            <nav className="flex flex-col gap-2 mt-8">
              {filteredMenus.map((menu) => renderMenuItem(menu, true))}
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
