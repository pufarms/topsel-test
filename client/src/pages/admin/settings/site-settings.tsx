import { useState, useEffect } from "react";
import { useAdminSiteSettings, useUpdateSiteSettings, useSeedSiteSettings, settingsToMap, useAdminHeaderMenus, useCreateHeaderMenu, useUpdateHeaderMenu, useDeleteHeaderMenu, useUpdateHeaderMenuOrder, useSeedHeaderMenus } from "@/hooks/use-site-settings";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, RefreshCw, Settings, Globe, Layout, Menu, Plus, Trash2, Edit, ArrowUp, ArrowDown, Eye, EyeOff, Search } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import type { HeaderMenu } from "@shared/schema";

export default function SiteSettingsPage() {
  const { toast } = useToast();
  const { data: settings, isLoading, refetch } = useAdminSiteSettings();
  const updateMutation = useUpdateSiteSettings();
  const seedMutation = useSeedSiteSettings();
  
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (settings) {
      setFormData(settingsToMap(settings));
      setIsDirty(false);
    }
  }, [settings]);

  const handleInputChange = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  const handleSwitchChange = (key: string, checked: boolean) => {
    setFormData((prev) => ({ ...prev, [key]: checked ? "true" : "false" }));
    setIsDirty(true);
  };

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync(formData);
      toast({
        title: "저장 완료",
        description: "사이트 설정이 저장되었습니다.",
      });
      setIsDirty(false);
    } catch (error) {
      toast({
        title: "저장 실패",
        description: "설정 저장 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleSeed = async () => {
    try {
      await seedMutation.mutateAsync();
      await refetch();
      toast({
        title: "초기화 완료",
        description: "기본 설정이 생성되었습니다.",
      });
    } catch (error) {
      toast({
        title: "초기화 실패",
        description: "기본 설정 생성 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  const hasSettings = settings && settings.length > 0;

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <PageHeader
        title="사이트 설정"
        description="사이트 기본 정보, 헤더, 푸터 설정을 관리합니다."
      />

      {!hasSettings && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Settings className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">설정이 없습니다</h3>
            <p className="text-sm text-muted-foreground mb-4 text-center">
              기본 설정을 생성하시겠습니까?
            </p>
            <Button onClick={handleSeed} disabled={seedMutation.isPending}>
              {seedMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              기본 설정 생성
            </Button>
          </CardContent>
        </Card>
      )}

      {hasSettings && (
        <>
          <div className="flex justify-end gap-2">
            <Button 
              variant="outline" 
              onClick={() => refetch()}
              data-testid="button-refresh"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              새로고침
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={!isDirty || updateMutation.isPending}
              data-testid="button-save"
            >
              {updateMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              저장
            </Button>
          </div>

          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-3 max-w-md">
              <TabsTrigger value="general" data-testid="tab-general">
                <Globe className="w-4 h-4 mr-2" />
                일반
              </TabsTrigger>
              <TabsTrigger value="header" data-testid="tab-header">
                <Layout className="w-4 h-4 mr-2" />
                헤더
              </TabsTrigger>
              <TabsTrigger value="footer" data-testid="tab-footer">
                <Layout className="w-4 h-4 mr-2 rotate-180" />
                푸터
              </TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>일반 설정</CardTitle>
                  <CardDescription>사이트 기본 정보를 설정합니다.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="site_name">사이트 이름</Label>
                      <Input
                        id="site_name"
                        value={formData.site_name || ""}
                        onChange={(e) => handleInputChange("site_name", e.target.value)}
                        placeholder="탑셀러"
                        data-testid="input-site-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="site_description">사이트 설명</Label>
                      <Input
                        id="site_description"
                        value={formData.site_description || ""}
                        onChange={(e) => handleInputChange("site_description", e.target.value)}
                        placeholder="B2B 과일 도매 플랫폼"
                        data-testid="input-site-description"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="header" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>헤더 설정</CardTitle>
                  <CardDescription>사이트 헤더 영역을 설정합니다.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="header_logo_url">로고 이미지 URL</Label>
                      <Input
                        id="header_logo_url"
                        value={formData.header_logo_url || ""}
                        onChange={(e) => handleInputChange("header_logo_url", e.target.value)}
                        placeholder="/logo.png"
                        data-testid="input-logo-url"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="header_logo_alt">로고 대체 텍스트</Label>
                      <Input
                        id="header_logo_alt"
                        value={formData.header_logo_alt || ""}
                        onChange={(e) => handleInputChange("header_logo_alt", e.target.value)}
                        placeholder="탑셀러"
                        data-testid="input-logo-alt"
                      />
                    </div>
                  </div>

                </CardContent>
              </Card>

              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>메뉴 관리</CardTitle>
                  <CardDescription>헤더에 표시할 메뉴와 순서를 관리합니다.</CardDescription>
                </CardHeader>
                <CardContent>
                  <MenuManagement />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="footer" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>푸터 설정</CardTitle>
                  <CardDescription>사이트 하단 영역을 설정합니다.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="footer_company_name">회사명</Label>
                      <Input
                        id="footer_company_name"
                        value={formData.footer_company_name || ""}
                        onChange={(e) => handleInputChange("footer_company_name", e.target.value)}
                        placeholder="현 농업회사법인 주식회사"
                        data-testid="input-company-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="footer_ceo_name">대표자명</Label>
                      <Input
                        id="footer_ceo_name"
                        value={formData.footer_ceo_name || ""}
                        onChange={(e) => handleInputChange("footer_ceo_name", e.target.value)}
                        placeholder="홍길동"
                        data-testid="input-ceo-name"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="footer_biz_number">사업자등록번호</Label>
                      <Input
                        id="footer_biz_number"
                        value={formData.footer_biz_number || ""}
                        onChange={(e) => handleInputChange("footer_biz_number", e.target.value)}
                        placeholder="123-45-67890"
                        data-testid="input-biz-number"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="footer_phone">대표 전화번호</Label>
                      <Input
                        id="footer_phone"
                        value={formData.footer_phone || ""}
                        onChange={(e) => handleInputChange("footer_phone", e.target.value)}
                        placeholder="02-1234-5678"
                        data-testid="input-phone"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="footer_email">대표 이메일</Label>
                      <Input
                        id="footer_email"
                        value={formData.footer_email || ""}
                        onChange={(e) => handleInputChange("footer_email", e.target.value)}
                        placeholder="contact@example.com"
                        data-testid="input-email"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="footer_address">회사 주소</Label>
                      <Input
                        id="footer_address"
                        value={formData.footer_address || ""}
                        onChange={(e) => handleInputChange("footer_address", e.target.value)}
                        placeholder="서울시 강남구..."
                        data-testid="input-address"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="footer_copyright">저작권 문구</Label>
                    <Input
                      id="footer_copyright"
                      value={formData.footer_copyright || ""}
                      onChange={(e) => handleInputChange("footer_copyright", e.target.value)}
                      placeholder="Copyright © 2025 TopSeller. All rights reserved."
                      data-testid="input-copyright"
                    />
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-sm font-medium">링크 표시 설정</h4>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="flex items-center justify-between p-3 rounded-md border">
                        <Label htmlFor="footer_show_terms" className="cursor-pointer">
                          이용약관 링크
                        </Label>
                        <Switch
                          id="footer_show_terms"
                          checked={formData.footer_show_terms === "true"}
                          onCheckedChange={(checked) => handleSwitchChange("footer_show_terms", checked)}
                          data-testid="switch-show-terms"
                        />
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-md border">
                        <Label htmlFor="footer_show_privacy" className="cursor-pointer">
                          개인정보처리방침 링크
                        </Label>
                        <Switch
                          id="footer_show_privacy"
                          checked={formData.footer_show_privacy === "true"}
                          onCheckedChange={(checked) => handleSwitchChange("footer_show_privacy", checked)}
                          data-testid="switch-show-privacy"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

interface SitePage {
  id: string;
  name: string;
  path: string;
  description: string;
  type: "public" | "member" | "admin";
}

const SITE_PAGES: SitePage[] = [
  { id: "home", name: "홈페이지", path: "/", description: "메인 랜딩 페이지", type: "public" },
  { id: "login", name: "로그인", path: "/login", description: "회원 로그인 페이지", type: "public" },
  { id: "register", name: "회원가입", path: "/register", description: "신규 회원 가입 페이지", type: "public" },
  { id: "public-preview", name: "공개 레이아웃 미리보기", path: "/public-preview", description: "헤더/푸터 설정 미리보기", type: "public" },
  { id: "dashboard", name: "회원 대시보드", path: "/dashboard", description: "회원 전용 대시보드", type: "member" },
  { id: "cart", name: "장바구니", path: "/cart", description: "상품 장바구니 페이지", type: "member" },
  { id: "mypage", name: "마이페이지", path: "/mypage", description: "회원 정보 및 주문 내역", type: "member" },
  { id: "terms", name: "이용약관", path: "/terms", description: "서비스 이용약관", type: "public" },
  { id: "privacy", name: "개인정보처리방침", path: "/privacy", description: "개인정보 처리방침", type: "public" },
];

function MenuManagement() {
  const { toast } = useToast();
  const { data: menus, isLoading, refetch } = useAdminHeaderMenus();
  const createMutation = useCreateHeaderMenu();
  const updateMutation = useUpdateHeaderMenu();
  const deleteMutation = useDeleteHeaderMenu();
  const orderMutation = useUpdateHeaderMenuOrder();
  const seedMutation = useSeedHeaderMenus();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMenu, setEditingMenu] = useState<HeaderMenu | null>(null);
  const [formData, setFormData] = useState({ name: "", path: "", isVisible: "true", openInNewTab: "false", showWhenLoggedIn: "true", showWhenLoggedOut: "true" });
  const [pageSearch, setPageSearch] = useState("");
  const [showPageSelector, setShowPageSelector] = useState(false);
  
  const hasSystemMenus = menus?.some(m => m.menuType === "system");
  
  const handleSeedMenus = async () => {
    try {
      await seedMutation.mutateAsync();
      toast({ title: "완료", description: "시스템 메뉴가 생성되었습니다." });
    } catch (error) {
      toast({ title: "실패", description: "시스템 메뉴 생성에 실패했습니다.", variant: "destructive" });
    }
  };

  const filteredPages = SITE_PAGES.filter(page => 
    page.name.toLowerCase().includes(pageSearch.toLowerCase()) ||
    page.path.toLowerCase().includes(pageSearch.toLowerCase()) ||
    page.description.toLowerCase().includes(pageSearch.toLowerCase())
  );

  const resetForm = () => {
    setFormData({ name: "", path: "", isVisible: "true", openInNewTab: "false", showWhenLoggedIn: "true", showWhenLoggedOut: "true" });
    setEditingMenu(null);
    setPageSearch("");
    setShowPageSelector(false);
  };

  const handleOpenDialog = (menu?: HeaderMenu) => {
    if (menu) {
      setEditingMenu(menu);
      setFormData({
        name: menu.name,
        path: menu.path,
        isVisible: menu.isVisible || "true",
        openInNewTab: menu.openInNewTab || "false",
        showWhenLoggedIn: menu.showWhenLoggedIn || "true",
        showWhenLoggedOut: menu.showWhenLoggedOut || "true",
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSelectPage = (page: SitePage) => {
    setFormData(prev => ({
      ...prev,
      name: prev.name || page.name,
      path: page.path,
    }));
    setShowPageSelector(false);
    setPageSearch("");
  };

  const handleSaveMenu = async () => {
    if (!formData.name || !formData.path) {
      toast({ title: "입력 오류", description: "메뉴명과 연결페이지는 필수입니다.", variant: "destructive" });
      return;
    }
    
    try {
      if (editingMenu) {
        await updateMutation.mutateAsync({ id: editingMenu.id, ...formData });
        toast({ title: "수정 완료", description: "메뉴가 수정되었습니다." });
      } else {
        const maxOrder = menus?.reduce((max, m) => Math.max(max, m.sortOrder || 0), 0) || 0;
        await createMutation.mutateAsync({ ...formData, sortOrder: maxOrder + 1 });
        toast({ title: "추가 완료", description: "메뉴가 추가되었습니다." });
      }
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      toast({ title: "저장 실패", description: "메뉴 저장 중 오류가 발생했습니다.", variant: "destructive" });
    }
  };

  const handleDeleteMenu = async (id: string) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    
    try {
      await deleteMutation.mutateAsync(id);
      toast({ title: "삭제 완료", description: "메뉴가 삭제되었습니다." });
    } catch (error) {
      toast({ title: "삭제 실패", description: "메뉴 삭제 중 오류가 발생했습니다.", variant: "destructive" });
    }
  };

  const handleMoveUp = async (index: number) => {
    if (!menus || index === 0) return;
    
    const newMenus = [...menus];
    [newMenus[index], newMenus[index - 1]] = [newMenus[index - 1], newMenus[index]];
    
    const orderUpdates = newMenus.map((m, i) => ({ id: m.id, sortOrder: i }));
    
    try {
      await orderMutation.mutateAsync(orderUpdates);
      await refetch();
    } catch (error) {
      toast({ title: "순서 변경 실패", variant: "destructive" });
    }
  };

  const handleMoveDown = async (index: number) => {
    if (!menus || index === menus.length - 1) return;
    
    const newMenus = [...menus];
    [newMenus[index], newMenus[index + 1]] = [newMenus[index + 1], newMenus[index]];
    
    const orderUpdates = newMenus.map((m, i) => ({ id: m.id, sortOrder: i }));
    
    try {
      await orderMutation.mutateAsync(orderUpdates);
      await refetch();
    } catch (error) {
      toast({ title: "순서 변경 실패", variant: "destructive" });
    }
  };

  const handleToggleVisibility = async (menu: HeaderMenu) => {
    try {
      await updateMutation.mutateAsync({
        id: menu.id,
        isVisible: menu.isVisible === "true" ? "false" : "true",
      });
    } catch (error) {
      toast({ title: "변경 실패", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-sm text-muted-foreground">
          헤더에 표시할 메뉴를 추가하고 순서를 조정하세요.
        </p>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()} data-testid="button-add-menu">
              <Plus className="w-4 h-4 mr-2" />
              메뉴 추가
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingMenu ? "메뉴 수정" : "메뉴 추가"}</DialogTitle>
              <DialogDescription>
                헤더에 표시할 메뉴 정보를 입력하세요.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="menu-name">메뉴명</Label>
                <Input
                  id="menu-name"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="예: 상품소개"
                  data-testid="input-menu-name"
                />
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="menu-path">연결페이지 (URL)</Label>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-auto p-1 text-xs text-primary"
                    onClick={() => setShowPageSelector(!showPageSelector)}
                    data-testid="button-toggle-page-selector"
                  >
                    {showPageSelector ? "직접 입력" : "페이지 선택"}
                  </Button>
                </div>
                
                {showPageSelector ? (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="페이지 검색..."
                        value={pageSearch}
                        onChange={(e) => setPageSearch(e.target.value)}
                        className="pl-9"
                        data-testid="input-page-search"
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto border rounded-md divide-y">
                      {filteredPages.length === 0 ? (
                        <div className="p-3 text-center text-sm text-muted-foreground">
                          검색 결과가 없습니다.
                        </div>
                      ) : (
                        filteredPages.map((page) => (
                          <button
                            key={page.id}
                            type="button"
                            className="w-full p-3 text-left hover:bg-muted transition-colors"
                            onClick={() => handleSelectPage(page)}
                            data-testid={`button-select-page-${page.id}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <div className="font-medium text-sm">{page.name}</div>
                                <div className="text-xs text-muted-foreground">{page.path}</div>
                              </div>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                page.type === "public" ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" :
                                page.type === "member" ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" :
                                "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
                              }`}>
                                {page.type === "public" ? "공개" : page.type === "member" ? "회원" : "관리자"}
                              </span>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                ) : (
                  <Input
                    id="menu-path"
                    value={formData.path}
                    onChange={(e) => setFormData((prev) => ({ ...prev, path: e.target.value }))}
                    placeholder="예: /products 또는 https://외부사이트.com"
                    data-testid="input-menu-path"
                  />
                )}
                {formData.path && (
                  <p className="text-xs text-muted-foreground">
                    선택된 경로: <span className="font-mono">{formData.path}</span>
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between p-3 rounded-md border">
                <Label htmlFor="menu-visible" className="cursor-pointer">표시 여부</Label>
                <Switch
                  id="menu-visible"
                  checked={formData.isVisible === "true"}
                  onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, isVisible: checked ? "true" : "false" }))}
                  data-testid="switch-menu-visible"
                />
              </div>
              <div className="flex items-center justify-between p-3 rounded-md border">
                <div>
                  <Label htmlFor="menu-logged-in" className="cursor-pointer">로그인 시 표시</Label>
                  <p className="text-xs text-muted-foreground">로그인한 사용자에게 표시</p>
                </div>
                <Switch
                  id="menu-logged-in"
                  checked={formData.showWhenLoggedIn === "true"}
                  onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, showWhenLoggedIn: checked ? "true" : "false" }))}
                  data-testid="switch-menu-logged-in"
                />
              </div>
              <div className="flex items-center justify-between p-3 rounded-md border">
                <div>
                  <Label htmlFor="menu-logged-out" className="cursor-pointer">비로그인 시 표시</Label>
                  <p className="text-xs text-muted-foreground">로그인하지 않은 사용자에게 표시</p>
                </div>
                <Switch
                  id="menu-logged-out"
                  checked={formData.showWhenLoggedOut === "true"}
                  onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, showWhenLoggedOut: checked ? "true" : "false" }))}
                  data-testid="switch-menu-logged-out"
                />
              </div>
              <div className="flex items-center justify-between p-3 rounded-md border">
                <div>
                  <Label htmlFor="menu-newtab" className="cursor-pointer">새 탭에서 열기</Label>
                  <p className="text-xs text-muted-foreground">외부 링크인 경우 권장</p>
                </div>
                <Switch
                  id="menu-newtab"
                  checked={formData.openInNewTab === "true"}
                  onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, openInNewTab: checked ? "true" : "false" }))}
                  data-testid="switch-menu-newtab"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                취소
              </Button>
              <Button 
                onClick={handleSaveMenu} 
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-save-menu"
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                저장
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {!hasSystemMenus && (
        <div className="p-4 border rounded-md border-dashed bg-muted/30 mb-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="font-medium">시스템 메뉴 생성</p>
              <p className="text-sm text-muted-foreground">로그인, 로그아웃, 회원가입, 장바구니, 마이페이지 메뉴를 자동으로 생성합니다.</p>
            </div>
            <Button
              variant="outline"
              onClick={handleSeedMenus}
              disabled={seedMutation.isPending}
              data-testid="button-seed-menus"
            >
              {seedMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              시스템 메뉴 생성
            </Button>
          </div>
        </div>
      )}
      
      {(!menus || menus.length === 0) ? (
        <div className="text-center py-8 text-muted-foreground border rounded-md border-dashed">
          <Menu className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p>등록된 메뉴가 없습니다.</p>
          <p className="text-sm mt-1">메뉴를 추가하거나 시스템 메뉴를 생성하세요.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {menus.map((menu, index) => (
            <div 
              key={menu.id} 
              className={`flex items-center gap-3 p-3 rounded-md border ${menu.isVisible !== "true" ? "opacity-50 bg-muted/50" : ""}`}
            >
              <div className="flex flex-col gap-1">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6"
                  onClick={() => handleMoveUp(index)}
                  disabled={index === 0 || orderMutation.isPending}
                  data-testid={`button-move-up-${menu.id}`}
                >
                  <ArrowUp className="w-4 h-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6"
                  onClick={() => handleMoveDown(index)}
                  disabled={index === menus.length - 1 || orderMutation.isPending}
                  data-testid={`button-move-down-${menu.id}`}
                >
                  <ArrowDown className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{menu.name}</span>
                  {menu.menuType === "system" && (
                    <Badge variant="secondary" className="text-xs">시스템</Badge>
                  )}
                  {menu.showWhenLoggedIn === "true" && menu.showWhenLoggedOut !== "true" && (
                    <Badge variant="outline" className="text-xs">로그인</Badge>
                  )}
                  {menu.showWhenLoggedOut === "true" && menu.showWhenLoggedIn !== "true" && (
                    <Badge variant="outline" className="text-xs">비로그인</Badge>
                  )}
                </div>
                <div className="text-sm text-muted-foreground truncate">{menu.path}</div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleToggleVisibility(menu)}
                  title={menu.isVisible === "true" ? "숨기기" : "표시하기"}
                  data-testid={`button-toggle-visibility-${menu.id}`}
                >
                  {menu.isVisible === "true" ? (
                    <Eye className="w-4 h-4" />
                  ) : (
                    <EyeOff className="w-4 h-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleOpenDialog(menu)}
                  title="수정"
                  data-testid={`button-edit-${menu.id}`}
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDeleteMenu(menu.id)}
                  disabled={deleteMutation.isPending}
                  title="삭제"
                  data-testid={`button-delete-${menu.id}`}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
