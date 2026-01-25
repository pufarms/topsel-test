import { useState, useEffect } from "react";
import { useAdminSiteSettings, useUpdateSiteSettings, useSeedSiteSettings, settingsToMap, useAdminHeaderMenus, useCreateHeaderMenu, useUpdateHeaderMenu, useDeleteHeaderMenu, useUpdateHeaderMenuOrder } from "@/hooks/use-site-settings";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, RefreshCw, Settings, Globe, Layout, Menu, Plus, Trash2, Edit, ArrowUp, ArrowDown, Eye, EyeOff } from "lucide-react";
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
            <TabsList className="grid w-full grid-cols-4 max-w-lg">
              <TabsTrigger value="general" data-testid="tab-general">
                <Globe className="w-4 h-4 mr-2" />
                일반
              </TabsTrigger>
              <TabsTrigger value="header" data-testid="tab-header">
                <Layout className="w-4 h-4 mr-2" />
                헤더
              </TabsTrigger>
              <TabsTrigger value="menu" data-testid="tab-menu">
                <Menu className="w-4 h-4 mr-2" />
                메뉴
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

                  <div className="space-y-4">
                    <h4 className="text-sm font-medium">버튼 표시 설정</h4>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="flex items-center justify-between p-3 rounded-md border">
                        <Label htmlFor="header_show_login" className="cursor-pointer">
                          로그인 버튼
                        </Label>
                        <Switch
                          id="header_show_login"
                          checked={formData.header_show_login === "true"}
                          onCheckedChange={(checked) => handleSwitchChange("header_show_login", checked)}
                          data-testid="switch-show-login"
                        />
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-md border">
                        <Label htmlFor="header_show_register" className="cursor-pointer">
                          회원가입 버튼
                        </Label>
                        <Switch
                          id="header_show_register"
                          checked={formData.header_show_register === "true"}
                          onCheckedChange={(checked) => handleSwitchChange("header_show_register", checked)}
                          data-testid="switch-show-register"
                        />
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-md border">
                        <Label htmlFor="header_show_cart" className="cursor-pointer">
                          장바구니 버튼
                        </Label>
                        <Switch
                          id="header_show_cart"
                          checked={formData.header_show_cart === "true"}
                          onCheckedChange={(checked) => handleSwitchChange("header_show_cart", checked)}
                          data-testid="switch-show-cart"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="menu" className="mt-6">
              <MenuManagement />
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

function MenuManagement() {
  const { toast } = useToast();
  const { data: menus, isLoading, refetch } = useAdminHeaderMenus();
  const createMutation = useCreateHeaderMenu();
  const updateMutation = useUpdateHeaderMenu();
  const deleteMutation = useDeleteHeaderMenu();
  const orderMutation = useUpdateHeaderMenuOrder();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMenu, setEditingMenu] = useState<HeaderMenu | null>(null);
  const [formData, setFormData] = useState({ name: "", path: "", isVisible: "true", openInNewTab: "false" });

  const resetForm = () => {
    setFormData({ name: "", path: "", isVisible: "true", openInNewTab: "false" });
    setEditingMenu(null);
  };

  const handleOpenDialog = (menu?: HeaderMenu) => {
    if (menu) {
      setEditingMenu(menu);
      setFormData({
        name: menu.name,
        path: menu.path,
        isVisible: menu.isVisible || "true",
        openInNewTab: menu.openInNewTab || "false",
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
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
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <CardTitle>메뉴 관리</CardTitle>
            <CardDescription>헤더에 표시할 메뉴를 관리합니다.</CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()} data-testid="button-add-menu">
                <Plus className="w-4 h-4 mr-2" />
                메뉴 추가
              </Button>
            </DialogTrigger>
            <DialogContent>
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
                  <Label htmlFor="menu-path">연결페이지 (URL)</Label>
                  <Input
                    id="menu-path"
                    value={formData.path}
                    onChange={(e) => setFormData((prev) => ({ ...prev, path: e.target.value }))}
                    placeholder="예: /products"
                    data-testid="input-menu-path"
                  />
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
                  <Label htmlFor="menu-newtab" className="cursor-pointer">새 탭에서 열기</Label>
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
      </CardHeader>
      <CardContent>
        {(!menus || menus.length === 0) ? (
          <div className="text-center py-12 text-muted-foreground">
            <Menu className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>등록된 메뉴가 없습니다.</p>
            <p className="text-sm mt-2">메뉴를 추가하여 헤더에 표시하세요.</p>
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
                  <div className="font-medium">{menu.name}</div>
                  <div className="text-sm text-muted-foreground truncate">{menu.path}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleToggleVisibility(menu)}
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
                    data-testid={`button-edit-${menu.id}`}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteMenu(menu.id)}
                    disabled={deleteMutation.isPending}
                    data-testid={`button-delete-${menu.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
