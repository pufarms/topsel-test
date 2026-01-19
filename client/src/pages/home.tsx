import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Users, ShieldCheck, ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/auth";

export default function Home() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">주문관리</span>
          </div>
          <nav className="flex items-center gap-3">
            {user ? (
              <>
                {(user.role === "SUPER_ADMIN" || user.role === "ADMIN") ? (
                  <Link href="/admin">
                    <Button data-testid="link-admin">관리자 페이지</Button>
                  </Link>
                ) : (
                  <Link href="/dashboard">
                    <Button data-testid="link-dashboard">대시보드</Button>
                  </Link>
                )}
              </>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="outline" data-testid="link-login">로그인</Button>
                </Link>
                <Link href="/register">
                  <Button data-testid="link-register">회원가입</Button>
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">주문관리 시스템</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            간편하게 주문을 등록하고 관리하세요. 셀러와 관리자를 위한 직관적인 주문 관리 솔루션입니다.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <Card className="hover-elevate">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                <Package className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-lg">주문 등록</CardTitle>
              <CardDescription>
                상품 정보와 수령인 정보를 입력하여 간편하게 주문을 등록하세요.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover-elevate">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-lg">주문 관리</CardTitle>
              <CardDescription>
                등록한 주문 목록을 확인하고 관리할 수 있습니다.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover-elevate">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                <ShieldCheck className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-lg">관리자 기능</CardTitle>
              <CardDescription>
                전체 회원과 주문을 관리하고 CSV로 내보낼 수 있습니다.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {!user && (
          <div className="text-center mt-12">
            <Link href="/register">
              <Button size="lg" data-testid="button-get-started">
                지금 시작하기
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
