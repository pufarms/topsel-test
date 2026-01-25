import { PublicLayout } from "@/components/public";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowLeft, Package, Truck, ShieldCheck, HeadphonesIcon } from "lucide-react";

export default function PublicPreviewPage() {
  return (
    <PublicLayout>
      <div className="container px-4 md:px-6 py-8">
        <div className="mb-6 flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/pages">
              <ArrowLeft className="w-4 h-4 mr-2" />
              페이지관리로 돌아가기
            </Link>
          </Button>
          <span className="text-sm text-muted-foreground">
            (이 페이지는 공개 레이아웃 미리보기입니다)
          </span>
        </div>

        <section className="mb-12">
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold mb-4">
              B2B 과일 도매 플랫폼
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              신선한 과일을 합리적인 가격에 공급받으세요. 
              전국 배송, 품질 보장, 전문 상담을 제공합니다.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6 text-center">서비스 특징</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <Package className="w-8 h-8 text-primary mb-2" />
                <CardTitle className="text-lg">다양한 상품</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  국내외 다양한 과일을 한 곳에서 주문하세요.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <Truck className="w-8 h-8 text-primary mb-2" />
                <CardTitle className="text-lg">전국 배송</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  신속하고 안전한 콜드체인 배송 시스템.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <ShieldCheck className="w-8 h-8 text-primary mb-2" />
                <CardTitle className="text-lg">품질 보장</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  엄격한 품질 관리로 신선함을 보장합니다.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <HeadphonesIcon className="w-8 h-8 text-primary mb-2" />
                <CardTitle className="text-lg">전문 상담</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  전문 상담원이 맞춤 상담을 제공합니다.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="text-center py-12 bg-muted/40 rounded-lg">
          <h2 className="text-2xl font-bold mb-4">지금 시작하세요</h2>
          <p className="text-muted-foreground mb-6">
            회원 가입 후 다양한 혜택을 누리세요.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Button size="lg" data-testid="button-signup-cta">
              회원가입
            </Button>
            <Button size="lg" variant="outline" data-testid="button-inquiry-cta">
              문의하기
            </Button>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}
