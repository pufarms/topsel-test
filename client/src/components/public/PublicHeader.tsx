import { Link } from "wouter";
import { usePublicSiteSettings, usePublicHeaderMenus } from "@/hooks/use-site-settings";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { User, ShoppingCart, LogIn, UserPlus, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";

export function PublicHeader() {
  const { data: settings } = usePublicSiteSettings();
  const { data: menus } = usePublicHeaderMenus();
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const siteName = settings?.site_name || "탑셀러";
  const logoUrl = settings?.header_logo_url;
  const logoAlt = settings?.header_logo_alt || siteName;
  const showLogin = settings?.header_show_login !== false;
  const showRegister = settings?.header_show_register !== false;
  const showCart = settings?.header_show_cart !== false;

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between gap-4 px-4 md:px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2" data-testid="link-home">
            {logoUrl ? (
              <img src={logoUrl} alt={logoAlt} className="h-8 w-auto" />
            ) : (
              <span className="text-lg font-bold">{siteName}</span>
            )}
          </Link>

          {menus && menus.length > 0 && (
            <nav className="hidden md:flex items-center gap-4">
              {menus.map((menu) => (
                menu.openInNewTab === "true" ? (
                  <a
                    key={menu.id}
                    href={menu.path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                    data-testid={`link-menu-${menu.id}`}
                  >
                    {menu.name}
                  </a>
                ) : (
                  <Link
                    key={menu.id}
                    href={menu.path}
                    className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                    data-testid={`link-menu-${menu.id}`}
                  >
                    {menu.name}
                  </Link>
                )
              ))}
            </nav>
          )}
        </div>

        <nav className="hidden md:flex items-center gap-4">
          {user ? (
            <>
              {showCart && (
                <Button variant="ghost" size="icon" asChild data-testid="button-cart">
                  <Link href="/cart">
                    <ShoppingCart className="h-5 w-5" />
                    <span className="sr-only">장바구니</span>
                  </Link>
                </Button>
              )}
              <Button variant="ghost" size="icon" asChild data-testid="button-profile">
                <Link href="/mypage">
                  <User className="h-5 w-5" />
                  <span className="sr-only">마이페이지</span>
                </Link>
              </Button>
            </>
          ) : (
            <>
              {showLogin && (
                <Button variant="ghost" asChild data-testid="button-login">
                  <Link href="/login">
                    <LogIn className="h-4 w-4 mr-2" />
                    로그인
                  </Link>
                </Button>
              )}
              {showRegister && (
                <Button asChild data-testid="button-register">
                  <Link href="/register">
                    <UserPlus className="h-4 w-4 mr-2" />
                    회원가입
                  </Link>
                </Button>
              )}
            </>
          )}
        </nav>

        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon" data-testid="button-mobile-menu">
              <Menu className="h-5 w-5" />
              <span className="sr-only">메뉴</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[250px]">
            <nav className="flex flex-col gap-4 mt-8">
              {menus && menus.length > 0 && (
                <>
                  {menus.map((menu) => (
                    menu.openInNewTab === "true" ? (
                      <a
                        key={menu.id}
                        href={menu.path}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium px-4 py-2 rounded-md hover:bg-muted"
                        onClick={() => setMobileMenuOpen(false)}
                        data-testid={`mobile-menu-${menu.id}`}
                      >
                        {menu.name}
                      </a>
                    ) : (
                      <Link
                        key={menu.id}
                        href={menu.path}
                        className="text-sm font-medium px-4 py-2 rounded-md hover:bg-muted"
                        onClick={() => setMobileMenuOpen(false)}
                        data-testid={`mobile-menu-${menu.id}`}
                      >
                        {menu.name}
                      </Link>
                    )
                  ))}
                  <div className="border-t my-2" />
                </>
              )}
              {user ? (
                <>
                  {showCart && (
                    <Button 
                      variant="ghost" 
                      className="justify-start" 
                      asChild
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Link href="/cart">
                        <ShoppingCart className="h-4 w-4 mr-2" />
                        장바구니
                      </Link>
                    </Button>
                  )}
                  <Button 
                    variant="ghost" 
                    className="justify-start" 
                    asChild
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Link href="/mypage">
                      <User className="h-4 w-4 mr-2" />
                      마이페이지
                    </Link>
                  </Button>
                </>
              ) : (
                <>
                  {showLogin && (
                    <Button 
                      variant="ghost" 
                      className="justify-start" 
                      asChild
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Link href="/login">
                        <LogIn className="h-4 w-4 mr-2" />
                        로그인
                      </Link>
                    </Button>
                  )}
                  {showRegister && (
                    <Button 
                      className="justify-start" 
                      asChild
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Link href="/register">
                        <UserPlus className="h-4 w-4 mr-2" />
                        회원가입
                      </Link>
                    </Button>
                  )}
                </>
              )}
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
