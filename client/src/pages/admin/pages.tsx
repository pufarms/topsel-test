import { useState } from "react";
import { Link } from "wouter";
import { PageHeader } from "@/components/admin/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { 
  Eye, 
  Settings, 
  FileText, 
  Home, 
  ShoppingCart, 
  User, 
  Search,
  ExternalLink,
  Layout,
  Copy,
  Check
} from "lucide-react";

interface PageInfo {
  id: string;
  name: string;
  path: string;
  description: string;
  status: "active" | "draft" | "hidden";
  type: "public" | "member" | "admin";
  icon: React.ReactNode;
}

const pages: PageInfo[] = [
  {
    id: "home",
    name: "홈페이지",
    path: "/",
    description: "메인 랜딩 페이지",
    status: "active",
    type: "public",
    icon: <Home className="w-5 h-5" />,
  },
  {
    id: "login",
    name: "로그인",
    path: "/login",
    description: "회원 로그인 페이지",
    status: "active",
    type: "public",
    icon: <User className="w-5 h-5" />,
  },
  {
    id: "register",
    name: "회원가입",
    path: "/register",
    description: "신규 회원 가입 페이지",
    status: "active",
    type: "public",
    icon: <User className="w-5 h-5" />,
  },
  {
    id: "public-preview",
    name: "공개 레이아웃 미리보기",
    path: "/public-preview",
    description: "헤더/푸터 설정 미리보기 (테스트용)",
    status: "active",
    type: "public",
    icon: <Layout className="w-5 h-5" />,
  },
  {
    id: "dashboard",
    name: "회원 대시보드",
    path: "/dashboard",
    description: "회원 전용 대시보드",
    status: "active",
    type: "member",
    icon: <FileText className="w-5 h-5" />,
  },
  {
    id: "cart",
    name: "장바구니",
    path: "/cart",
    description: "상품 장바구니 페이지",
    status: "draft",
    type: "member",
    icon: <ShoppingCart className="w-5 h-5" />,
  },
  {
    id: "mypage",
    name: "마이페이지",
    path: "/mypage",
    description: "회원 정보 및 주문 내역",
    status: "draft",
    type: "member",
    icon: <User className="w-5 h-5" />,
  },
  {
    id: "terms",
    name: "이용약관",
    path: "/terms",
    description: "서비스 이용약관",
    status: "draft",
    type: "public",
    icon: <FileText className="w-5 h-5" />,
  },
  {
    id: "privacy",
    name: "개인정보처리방침",
    path: "/privacy",
    description: "개인정보 처리방침",
    status: "draft",
    type: "public",
    icon: <FileText className="w-5 h-5" />,
  },
];

export default function PagesManagement() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "public" | "member" | "admin">("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const getFullUrl = (path: string) => {
    return `${window.location.origin}${path}`;
  };

  const copyToClipboard = async (pageId: string, path: string) => {
    const fullUrl = getFullUrl(path);
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopiedId(pageId);
      toast({
        title: "복사 완료",
        description: `${fullUrl}`,
      });
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      toast({
        title: "복사 실패",
        description: "클립보드에 복사할 수 없습니다.",
        variant: "destructive",
      });
    }
  };

  const filteredPages = pages.filter((page) => {
    const matchesSearch = 
      page.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      page.path.toLowerCase().includes(searchTerm.toLowerCase()) ||
      page.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === "all" || page.type === filterType;
    return matchesSearch && matchesType;
  });

  const getStatusBadge = (status: PageInfo["status"]) => {
    switch (status) {
      case "active":
        return <Badge variant="default">활성</Badge>;
      case "draft":
        return <Badge variant="secondary">준비중</Badge>;
      case "hidden":
        return <Badge variant="outline">숨김</Badge>;
    }
  };

  const getTypeBadge = (type: PageInfo["type"]) => {
    switch (type) {
      case "public":
        return <Badge variant="outline">공개</Badge>;
      case "member":
        return <Badge variant="outline">회원전용</Badge>;
      case "admin":
        return <Badge variant="outline">관리자</Badge>;
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <PageHeader
        title="페이지 관리"
        description="사이트 페이지 현황을 확인하고 관리합니다."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">빠른 링크</CardTitle>
          <CardDescription>자주 사용하는 설정 페이지로 바로 이동합니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" asChild>
              <Link href="/admin/settings/site">
                <Settings className="w-4 h-4 mr-2" />
                사이트 설정
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/public-preview">
                <Eye className="w-4 h-4 mr-2" />
                공개 레이아웃 미리보기
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-lg">페이지 목록</CardTitle>
              <CardDescription>총 {filteredPages.length}개의 페이지</CardDescription>
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-[200px]"
                  data-testid="input-search"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4 flex-wrap">
            <Button 
              variant={filterType === "all" ? "default" : "outline"} 
              size="sm"
              onClick={() => setFilterType("all")}
            >
              전체
            </Button>
            <Button 
              variant={filterType === "public" ? "default" : "outline"} 
              size="sm"
              onClick={() => setFilterType("public")}
            >
              공개
            </Button>
            <Button 
              variant={filterType === "member" ? "default" : "outline"} 
              size="sm"
              onClick={() => setFilterType("member")}
            >
              회원전용
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredPages.map((page) => (
              <Card key={page.id} className="hover-elevate">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-md bg-muted">
                      {page.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium truncate">{page.name}</h3>
                      </div>
                      <div className="flex items-center gap-1 mb-2">
                        <p className="text-sm text-muted-foreground truncate flex-1">
                          {page.path}
                        </p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          onClick={() => copyToClipboard(page.id, page.path)}
                          data-testid={`button-copy-url-${page.id}`}
                        >
                          {copiedId === page.id ? (
                            <Check className="w-3 h-3 text-green-500" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">
                        {page.description}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        {getStatusBadge(page.status)}
                        {getTypeBadge(page.type)}
                      </div>
                    </div>
                  </div>
                  {page.status === "active" && (
                    <div className="mt-3 pt-3 border-t">
                      <Button variant="ghost" size="sm" className="w-full" asChild>
                        <Link href={page.path}>
                          <ExternalLink className="w-4 h-4 mr-2" />
                          페이지 열기
                        </Link>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredPages.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>검색 결과가 없습니다.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
