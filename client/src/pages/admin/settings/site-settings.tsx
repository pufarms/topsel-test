import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAdminSiteSettings, useUpdateSiteSettings, useSeedSiteSettings, settingsToMap, useAdminHeaderMenus, useCreateHeaderMenu, useUpdateHeaderMenu, useDeleteHeaderMenu, useUpdateHeaderMenuOrder, useSeedHeaderMenus } from "@/hooks/use-site-settings";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Save, RefreshCw, Settings, Globe, Layout, Menu, Plus, Trash2, Edit, ArrowUp, ArrowDown, Eye, EyeOff, Search, GripVertical, MapPin, Brain, TestTube, CheckCircle, XCircle, AlertTriangle, Upload, FileSpreadsheet } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import type { HeaderMenu } from "@shared/schema";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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
              <TabsTrigger value="footer" data-testid="tab-footer">
                <Layout className="w-4 h-4 mr-2 rotate-180" />
                푸터
              </TabsTrigger>
              <TabsTrigger value="address" data-testid="tab-address">
                <MapPin className="w-4 h-4 mr-2" />
                주소학습
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
                      <div className="flex items-center justify-between p-3 rounded-md border">
                        <Label htmlFor="footer_show_third_party" className="cursor-pointer">
                          개인정보 제3자 제공 동의 링크
                        </Label>
                        <Switch
                          id="footer_show_third_party"
                          checked={formData.footer_show_third_party === "true"}
                          onCheckedChange={(checked) => handleSwitchChange("footer_show_third_party", checked)}
                          data-testid="switch-show-third-party"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="address" className="mt-6">
              <AddressLearningManagement />
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

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || !menus || active.id === over.id) return;
    
    const oldIndex = menus.findIndex((m) => m.id === active.id);
    const newIndex = menus.findIndex((m) => m.id === over.id);
    
    if (oldIndex === -1 || newIndex === -1) return;
    
    const newMenus = arrayMove(menus, oldIndex, newIndex);
    const orderUpdates = newMenus.map((m, i) => ({ id: m.id, sortOrder: i }));
    
    try {
      await orderMutation.mutateAsync(orderUpdates);
      await refetch();
    } catch (error) {
      toast({ title: "순서 변경 실패", variant: "destructive" });
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
          헤더에 표시할 메뉴를 추가하고 순서를 조정하세요. 드래그 또는 화살표로 순서 변경이 가능합니다.
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
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={menus.map((m) => m.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {menus.map((menu, index) => (
                <SortableMenuItem
                  key={menu.id}
                  menu={menu}
                  index={index}
                  totalMenus={menus.length}
                  onMoveUp={handleMoveUp}
                  onMoveDown={handleMoveDown}
                  onToggleVisibility={handleToggleVisibility}
                  onEdit={handleOpenDialog}
                  onDelete={handleDeleteMenu}
                  isOrderPending={orderMutation.isPending}
                  isDeletePending={deleteMutation.isPending}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

interface SortableMenuItemProps {
  menu: HeaderMenu;
  index: number;
  totalMenus: number;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onToggleVisibility: (menu: HeaderMenu) => void;
  onEdit: (menu: HeaderMenu) => void;
  onDelete: (id: string) => void;
  isOrderPending: boolean;
  isDeletePending: boolean;
}

function SortableMenuItem({
  menu,
  index,
  totalMenus,
  onMoveUp,
  onMoveDown,
  onToggleVisibility,
  onEdit,
  onDelete,
  isOrderPending,
  isDeletePending,
}: SortableMenuItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: menu.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 rounded-md border bg-background ${
        menu.isVisible !== "true" ? "opacity-50 bg-muted/50" : ""
      } ${isDragging ? "shadow-lg ring-2 ring-primary" : ""}`}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded"
        title="드래그하여 순서 변경"
      >
        <GripVertical className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="flex flex-col gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => onMoveUp(index)}
          disabled={index === 0 || isOrderPending}
          data-testid={`button-move-up-${menu.id}`}
        >
          <ArrowUp className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => onMoveDown(index)}
          disabled={index === totalMenus - 1 || isOrderPending}
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
          onClick={() => onToggleVisibility(menu)}
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
          onClick={() => onEdit(menu)}
          title="수정"
          data-testid={`button-edit-${menu.id}`}
        >
          <Edit className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(menu.id)}
          disabled={isDeletePending}
          title="삭제"
          data-testid={`button-delete-${menu.id}`}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

// ==========================================
// 주소 학습 관리 컴포넌트
// ==========================================

interface AddressLearningItem {
  id: number;
  originalDetailAddress: string;
  correctedDetailAddress: string;
  buildingType?: string;
  correctionType?: string;
  confidenceScore: string;
  occurrenceCount: number;
  successCount: number;
  userConfirmed: boolean;
  errorPattern?: string;
  problemDescription?: string;
  patternRegex?: string;
  solutionDescription?: string;
  aiModel?: string;
  createdAt: string;
  updatedAt: string;
}

interface AddressLearningStats {
  total: number;
  userConfirmed: number;
  aiAnalyzed: number;
  aiEnabled: boolean;
}

function AddressLearningManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isTestDialogOpen, setIsTestDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AddressLearningItem | null>(null);
  
  const [formData, setFormData] = useState({
    originalDetailAddress: "",
    correctedDetailAddress: "",
    buildingType: "general",
    errorPattern: "",
    problemDescription: "",
    patternRegex: "",
    solutionDescription: "",
    autoAnalyze: true
  });
  
  const [testAddress, setTestAddress] = useState("");
  const [testBuildingType, setTestBuildingType] = useState("general");
  const [testResult, setTestResult] = useState<any>(null);

  // Excel 업로드 관련 상태
  const [isExcelDialogOpen, setIsExcelDialogOpen] = useState(false);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelPreview, setExcelPreview] = useState<{
    columns: { index: number; name: string }[];
    sampleData: any[];
    totalRows: number;
    sheetName: string;
  } | null>(null);
  const [selectedColumn, setSelectedColumn] = useState<number | null>(null);
  const [excelBuildingType, setExcelBuildingType] = useState("apartment");
  const [processResults, setProcessResults] = useState<{
    summary?: { total: number; success: number; skipped: number; error: number };
    results?: any[];
  } | null>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);

  // 학습 데이터 목록 조회
  const { data: learningData, isLoading, refetch } = useQuery<{
    success: boolean;
    data: AddressLearningItem[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }>({
    queryKey: ["/api/address/learning", page, search],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: "10" });
      if (search) params.append("search", search);
      const res = await fetch(`/api/address/learning?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("학습 데이터 조회 실패");
      return res.json();
    }
  });

  // 통계 조회
  const { data: statsData } = useQuery<{ success: boolean; stats: AddressLearningStats }>({
    queryKey: ["/api/address/learning/stats"],
    queryFn: async () => {
      const res = await fetch("/api/address/learning/stats", { credentials: "include" });
      if (!res.ok) throw new Error("통계 조회 실패");
      return res.json();
    }
  });

  // 학습 데이터 생성
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await apiRequest("POST", "/api/address/learning", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "등록 완료", description: "주소 학습 데이터가 등록되었습니다." });
      queryClient.invalidateQueries({ queryKey: ["/api/address/learning"] });
      queryClient.invalidateQueries({ queryKey: ["/api/address/learning/stats"] });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast({ title: "등록 실패", description: "학습 데이터 등록에 실패했습니다.", variant: "destructive" });
    }
  });

  // 학습 데이터 수정
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof formData }) => {
      const res = await apiRequest("PUT", `/api/address/learning/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "수정 완료", description: "주소 학습 데이터가 수정되었습니다." });
      queryClient.invalidateQueries({ queryKey: ["/api/address/learning"] });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast({ title: "수정 실패", description: "학습 데이터 수정에 실패했습니다.", variant: "destructive" });
    }
  });

  // 학습 데이터 삭제
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/address/learning/${id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "삭제 완료", description: "학습 데이터가 삭제되었습니다." });
      queryClient.invalidateQueries({ queryKey: ["/api/address/learning"] });
      queryClient.invalidateQueries({ queryKey: ["/api/address/learning/stats"] });
    },
    onError: () => {
      toast({ title: "삭제 실패", description: "학습 데이터 삭제에 실패했습니다.", variant: "destructive" });
    }
  });

  // AI 분석
  const analyzeMutation = useMutation({
    mutationFn: async ({ originalDetailAddress, buildingType }: { originalDetailAddress: string; buildingType: string }) => {
      const res = await apiRequest("POST", "/api/address/learning/analyze", { originalDetailAddress, buildingType });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "AI 분석 완료", description: "패턴이 분석되어 저장되었습니다." });
      queryClient.invalidateQueries({ queryKey: ["/api/address/learning"] });
      queryClient.invalidateQueries({ queryKey: ["/api/address/learning/stats"] });
      if (data.analysis) {
        setFormData(prev => ({
          ...prev,
          correctedDetailAddress: data.analysis.correctedAddress || prev.correctedDetailAddress,
          errorPattern: data.analysis.errorPattern || prev.errorPattern,
          problemDescription: data.analysis.problemDescription || prev.problemDescription,
          patternRegex: data.analysis.patternRegex || prev.patternRegex,
          solutionDescription: data.analysis.solution || prev.solutionDescription
        }));
      }
    },
    onError: () => {
      toast({ title: "AI 분석 실패", description: "AI 분석에 실패했습니다. API 키를 확인해주세요.", variant: "destructive" });
    }
  });

  // 패턴 테스트
  const testMutation = useMutation({
    mutationFn: async ({ testAddress, buildingType }: { testAddress: string; buildingType: string }) => {
      const res = await apiRequest("POST", "/api/address/learning/test", { testAddress, buildingType });
      return res.json();
    },
    onSuccess: (data: any) => {
      setTestResult(data);
    },
    onError: () => {
      toast({ title: "테스트 실패", description: "패턴 테스트에 실패했습니다.", variant: "destructive" });
    }
  });

  // Excel 미리보기
  const previewMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/address/learning/upload/preview", {
        method: "POST",
        body: formData,
        credentials: "include"
      });
      if (!res.ok) throw new Error("미리보기 실패");
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data.success) {
        setExcelPreview(data);
        setSelectedColumn(null);
        setProcessResults(null);
      } else {
        toast({ title: "미리보기 실패", description: data.message, variant: "destructive" });
      }
    },
    onError: () => {
      toast({ title: "미리보기 실패", description: "엑셀 파일 처리에 실패했습니다.", variant: "destructive" });
    }
  });

  // Excel 처리 (AI 분석)
  const processMutation = useMutation({
    mutationFn: async () => {
      if (!excelFile || selectedColumn === null) throw new Error("파일과 컬럼을 선택해주세요");
      const formData = new FormData();
      formData.append("file", excelFile);
      formData.append("addressColumn", String(selectedColumn));
      formData.append("buildingType", excelBuildingType);
      const res = await fetch("/api/address/learning/upload/process", {
        method: "POST",
        body: formData,
        credentials: "include"
      });
      if (!res.ok) throw new Error("처리 실패");
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data.success) {
        toast({ title: "학습 완료", description: data.message });
        setProcessResults({ summary: data.summary, results: data.results });
        queryClient.invalidateQueries({ queryKey: ["/api/address/learning"] });
        queryClient.invalidateQueries({ queryKey: ["/api/address/learning/stats"] });
      } else {
        toast({ title: "처리 실패", description: data.message, variant: "destructive" });
      }
    },
    onError: (err: any) => {
      toast({ title: "처리 실패", description: err.message || "엑셀 처리에 실패했습니다.", variant: "destructive" });
    }
  });

  const handleExcelFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setExcelFile(file);
      setExcelPreview(null);
      setProcessResults(null);
      previewMutation.mutate(file);
    }
  };

  const resetExcelDialog = () => {
    setExcelFile(null);
    setExcelPreview(null);
    setSelectedColumn(null);
    setProcessResults(null);
    if (excelInputRef.current) excelInputRef.current.value = "";
  };

  const resetForm = () => {
    setFormData({
      originalDetailAddress: "",
      correctedDetailAddress: "",
      buildingType: "general",
      errorPattern: "",
      problemDescription: "",
      patternRegex: "",
      solutionDescription: "",
      autoAnalyze: true
    });
    setEditingItem(null);
  };

  const handleOpenDialog = (item?: AddressLearningItem) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        originalDetailAddress: item.originalDetailAddress,
        correctedDetailAddress: item.correctedDetailAddress,
        buildingType: item.buildingType || "general",
        errorPattern: item.errorPattern || "",
        problemDescription: item.problemDescription || "",
        patternRegex: item.patternRegex || "",
        solutionDescription: item.solutionDescription || "",
        autoAnalyze: false
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (!formData.originalDetailAddress || !formData.correctedDetailAddress) {
      toast({ title: "입력 오류", description: "원본 주소와 교정 주소는 필수입니다.", variant: "destructive" });
      return;
    }
    
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id: number) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    deleteMutation.mutate(id);
  };

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const handleTest = () => {
    if (!testAddress) {
      toast({ title: "입력 오류", description: "테스트할 주소를 입력해주세요.", variant: "destructive" });
      return;
    }
    testMutation.mutate({ testAddress, buildingType: testBuildingType });
  };

  const stats = statsData?.stats;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            AI 주소 학습 관리
          </CardTitle>
          <CardDescription>
            오류 주소 패턴을 등록하고 AI가 학습하도록 관리합니다. 등록된 패턴은 엑셀 주문 업로드 시 자동으로 적용됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4 mb-6">
            <div className="p-4 border rounded-lg">
              <div className="text-2xl font-bold">{stats?.total || 0}</div>
              <div className="text-sm text-muted-foreground">전체 학습 데이터</div>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="text-2xl font-bold">{stats?.userConfirmed || 0}</div>
              <div className="text-sm text-muted-foreground">수동 등록</div>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="text-2xl font-bold">{stats?.aiAnalyzed || 0}</div>
              <div className="text-sm text-muted-foreground">AI 분석</div>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2">
                {stats?.aiEnabled ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-500" />
                )}
                <span className="text-sm">{stats?.aiEnabled ? "AI 활성화" : "AI 비활성화"}</span>
              </div>
              <div className="text-sm text-muted-foreground mt-1">Claude AI 상태</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="원본/교정 주소, 오류 패턴 검색..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                data-testid="input-address-search"
              />
            </div>
            <Button variant="outline" onClick={handleSearch} data-testid="button-search-address">
              <Search className="w-4 h-4 mr-2" />
              검색
            </Button>
            <Button variant="outline" onClick={() => refetch()} data-testid="button-refresh-address">
              <RefreshCw className="w-4 h-4 mr-2" />
              새로고침
            </Button>
            <Button variant="outline" onClick={() => { setTestResult(null); setIsTestDialogOpen(true); }} data-testid="button-test-pattern">
              <TestTube className="w-4 h-4 mr-2" />
              패턴 테스트
            </Button>
            <Button onClick={() => { resetExcelDialog(); setIsExcelDialogOpen(true); }} data-testid="button-excel-upload">
              <Upload className="w-4 h-4 mr-2" />
              엑셀 학습
            </Button>
            <Button variant="outline" onClick={() => handleOpenDialog()} data-testid="button-add-address-learning">
              <Plus className="w-4 h-4 mr-2" />
              수동 등록
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : (
            <>
              <div className="border rounded-lg table-scroll-container">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-background">
                    <TableRow>
                      <TableHead className="w-[200px]">원본 주소</TableHead>
                      <TableHead className="w-[200px]">교정 주소</TableHead>
                      <TableHead>건물유형</TableHead>
                      <TableHead>오류패턴</TableHead>
                      <TableHead>신뢰도</TableHead>
                      <TableHead>횟수</TableHead>
                      <TableHead>상태</TableHead>
                      <TableHead className="text-right">작업</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {learningData?.data?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          등록된 학습 데이터가 없습니다.
                        </TableCell>
                      </TableRow>
                    ) : (
                      learningData?.data?.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono text-sm max-w-[200px] truncate" title={item.originalDetailAddress}>
                            {item.originalDetailAddress}
                          </TableCell>
                          <TableCell className="font-mono text-sm max-w-[200px] truncate" title={item.correctedDetailAddress}>
                            {item.correctedDetailAddress}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {item.buildingType === "apartment" ? "아파트" : 
                               item.buildingType === "villa" ? "빌라" :
                               item.buildingType === "officetel" ? "오피스텔" : "일반"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{item.errorPattern || "-"}</TableCell>
                          <TableCell>
                            <span className={`font-medium ${parseFloat(item.confidenceScore) >= 0.9 ? "text-green-600" : parseFloat(item.confidenceScore) >= 0.7 ? "text-yellow-600" : "text-red-600"}`}>
                              {(parseFloat(item.confidenceScore) * 100).toFixed(0)}%
                            </span>
                          </TableCell>
                          <TableCell>{item.occurrenceCount}</TableCell>
                          <TableCell>
                            {item.userConfirmed ? (
                              <Badge variant="default">수동</Badge>
                            ) : item.aiModel ? (
                              <Badge variant="secondary">AI</Badge>
                            ) : (
                              <Badge variant="outline">자동</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenDialog(item)}
                                title="수정"
                                data-testid={`button-edit-learning-${item.id}`}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(item.id)}
                                disabled={deleteMutation.isPending}
                                title="삭제"
                                data-testid={`button-delete-learning-${item.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {learningData?.pagination && learningData.pagination.totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    data-testid="button-prev-page"
                  >
                    이전
                  </Button>
                  <span className="text-sm text-muted-foreground" data-testid="text-page-info">
                    {page} / {learningData.pagination.totalPages} 페이지
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(learningData.pagination.totalPages, p + 1))}
                    disabled={page === learningData.pagination.totalPages}
                    data-testid="button-next-page"
                  >
                    다음
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? "주소 학습 데이터 수정" : "주소 학습 데이터 등록"}</DialogTitle>
            <DialogDescription>
              오류 주소와 교정된 주소를 등록하면 향후 동일 패턴의 주소를 자동으로 교정합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="originalDetailAddress">원본 상세주소 *</Label>
                <Input
                  id="originalDetailAddress"
                  value={formData.originalDetailAddress}
                  onChange={(e) => setFormData(prev => ({ ...prev, originalDetailAddress: e.target.value }))}
                  placeholder="예: 101-202 (부재시 문앞)"
                  data-testid="input-original-address"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="correctedDetailAddress">교정 상세주소 *</Label>
                <Input
                  id="correctedDetailAddress"
                  value={formData.correctedDetailAddress}
                  onChange={(e) => setFormData(prev => ({ ...prev, correctedDetailAddress: e.target.value }))}
                  placeholder="예: 101동 202호"
                  data-testid="input-corrected-address"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="buildingType">건물 유형</Label>
                <Select
                  value={formData.buildingType}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, buildingType: v }))}
                >
                  <SelectTrigger data-testid="select-building-type">
                    <SelectValue placeholder="건물 유형 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">일반</SelectItem>
                    <SelectItem value="apartment">아파트</SelectItem>
                    <SelectItem value="villa">빌라</SelectItem>
                    <SelectItem value="officetel">오피스텔</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="errorPattern">오류 패턴</Label>
                <Input
                  id="errorPattern"
                  value={formData.errorPattern}
                  onChange={(e) => setFormData(prev => ({ ...prev, errorPattern: e.target.value }))}
                  placeholder="예: hyphen_to_unit"
                  data-testid="input-error-pattern"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="problemDescription">문제 설명</Label>
              <Textarea
                id="problemDescription"
                value={formData.problemDescription}
                onChange={(e) => setFormData(prev => ({ ...prev, problemDescription: e.target.value }))}
                placeholder="이 주소 패턴의 문제점을 설명합니다..."
                rows={2}
                data-testid="textarea-problem-description"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="patternRegex">패턴 정규식 (고급)</Label>
              <Input
                id="patternRegex"
                value={formData.patternRegex}
                onChange={(e) => setFormData(prev => ({ ...prev, patternRegex: e.target.value }))}
                placeholder="예: ^(\d+)\s*-\s*(\d+)$"
                className="font-mono text-sm"
                data-testid="input-pattern-regex"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="solutionDescription">해결 방법</Label>
              <Textarea
                id="solutionDescription"
                value={formData.solutionDescription}
                onChange={(e) => setFormData(prev => ({ ...prev, solutionDescription: e.target.value }))}
                placeholder="이 패턴을 어떻게 교정하는지 설명합니다..."
                rows={2}
                data-testid="textarea-solution-description"
              />
            </div>

            {statsData?.stats?.aiEnabled && (
              <div className="space-y-3 pt-2 border-t">
                {!editingItem && (
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="autoAnalyze"
                      checked={formData.autoAnalyze}
                      onChange={(e) => setFormData(prev => ({ ...prev, autoAnalyze: e.target.checked }))}
                      className="w-4 h-4 rounded border-gray-300"
                      data-testid="checkbox-auto-analyze"
                    />
                    <Label htmlFor="autoAnalyze" className="text-sm font-normal cursor-pointer">
                      등록 시 AI 자동 분석 (Claude AI가 오류 패턴을 분석하고 학습합니다)
                    </Label>
                  </div>
                )}
                {formData.originalDetailAddress && (
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => analyzeMutation.mutate({ 
                        originalDetailAddress: formData.originalDetailAddress, 
                        buildingType: formData.buildingType 
                      })}
                      disabled={analyzeMutation.isPending}
                      data-testid="button-ai-analyze"
                    >
                      {analyzeMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Brain className="w-4 h-4 mr-2" />
                      )}
                      AI 분석
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Claude AI가 주소 패턴을 분석하고 자동으로 필드를 채웁니다.
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} data-testid="button-cancel-learning">
              취소
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-learning"
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              {editingItem ? "수정" : "등록"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isTestDialogOpen} onOpenChange={setIsTestDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TestTube className="w-5 h-5" />
              패턴 테스트
            </DialogTitle>
            <DialogDescription>
              주소를 입력하여 학습된 패턴으로 변환되는지 테스트합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="testAddress">테스트 주소</Label>
              <Input
                id="testAddress"
                value={testAddress}
                onChange={(e) => setTestAddress(e.target.value)}
                placeholder="예: 101-202 부재시 문앞"
                data-testid="input-test-address"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="testBuildingType">건물 유형</Label>
              <Select
                value={testBuildingType}
                onValueChange={setTestBuildingType}
              >
                <SelectTrigger data-testid="select-test-building-type">
                  <SelectValue placeholder="건물 유형 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">일반</SelectItem>
                  <SelectItem value="apartment">아파트</SelectItem>
                  <SelectItem value="villa">빌라</SelectItem>
                  <SelectItem value="officetel">오피스텔</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {testResult && (
              <div className={`p-4 rounded-lg border ${testResult.matched ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800" : "bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800"}`}>
                {testResult.matched ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                      <CheckCircle className="w-5 h-5" />
                      <span className="font-medium">패턴 매칭 성공</span>
                    </div>
                    <div className="text-sm space-y-1">
                      <div><span className="text-muted-foreground">원본:</span> {testResult.original}</div>
                      <div><span className="text-muted-foreground">교정:</span> <span className="font-medium">{testResult.corrected}</span></div>
                      <div><span className="text-muted-foreground">방식:</span> {testResult.method === "pattern_regex" ? "정규식 패턴" : testResult.method === "learned_similarity" ? "유사 패턴 학습" : "룰 기반"}</div>
                      {testResult.confidence && (
                        <div><span className="text-muted-foreground">신뢰도:</span> {(testResult.confidence * 100).toFixed(0)}%</div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
                      <AlertTriangle className="w-5 h-5" />
                      <span className="font-medium">매칭 없음</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{testResult.message}</p>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTestDialogOpen(false)} data-testid="button-close-test">
              닫기
            </Button>
            <Button 
              onClick={handleTest} 
              disabled={testMutation.isPending}
              data-testid="button-run-test"
            >
              {testMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              테스트
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isExcelDialogOpen} onOpenChange={setIsExcelDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              오류 주소 엑셀 학습
            </DialogTitle>
            <DialogDescription>
              오류 주소가 담긴 엑셀 파일을 업로드하고 주소 컬럼을 선택하면 AI가 자동으로 분석하여 학습합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>엑셀 파일 업로드</Label>
              <div className="flex items-center gap-2">
                <Input
                  ref={excelInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleExcelFileChange}
                  className="flex-1"
                  data-testid="input-excel-file"
                />
                {previewMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              </div>
              {excelFile && (
                <p className="text-sm text-muted-foreground">
                  선택된 파일: {excelFile.name}
                </p>
              )}
            </div>

            {excelPreview && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>주소 컬럼 선택</Label>
                    <Select
                      value={selectedColumn !== null ? String(selectedColumn) : ""}
                      onValueChange={(v) => setSelectedColumn(parseInt(v))}
                    >
                      <SelectTrigger data-testid="select-address-column">
                        <SelectValue placeholder="주소가 있는 컬럼을 선택하세요" />
                      </SelectTrigger>
                      <SelectContent>
                        {excelPreview.columns.map((col) => (
                          <SelectItem key={col.index} value={String(col.index)}>
                            {col.name || `컬럼 ${col.index + 1}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>건물 유형</Label>
                    <Select value={excelBuildingType} onValueChange={setExcelBuildingType}>
                      <SelectTrigger data-testid="select-excel-building-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="apartment">아파트</SelectItem>
                        <SelectItem value="villa">빌라/주택</SelectItem>
                        <SelectItem value="officetel">오피스텔</SelectItem>
                        <SelectItem value="general">일반</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>미리보기 (처음 5개 행)</Label>
                    <Badge variant="outline">
                      시트: {excelPreview.sheetName} | 총 {excelPreview.totalRows}행
                    </Badge>
                  </div>
                  <div className="border rounded-lg table-scroll-container">
                    <Table>
                      <TableHeader className="sticky top-0 z-10 bg-background">
                        <TableRow>
                          <TableHead className="w-12">행</TableHead>
                          {excelPreview.columns.map((col) => (
                            <TableHead 
                              key={col.index}
                              className={selectedColumn === col.index ? "bg-primary/10" : ""}
                            >
                              {col.name || `컬럼 ${col.index + 1}`}
                              {selectedColumn === col.index && (
                                <Badge variant="secondary" className="ml-2">주소</Badge>
                              )}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {excelPreview.sampleData.map((row, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-mono text-xs">{row._rowIndex}</TableCell>
                            {excelPreview.columns.map((col) => (
                              <TableCell 
                                key={col.index}
                                className={selectedColumn === col.index ? "bg-primary/10 font-medium" : ""}
                              >
                                {row[col.name] || "-"}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </>
            )}

            {processResults?.summary && (
              <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="font-medium">학습 완료</span>
                </div>
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div className="p-2 bg-background rounded">
                    <div className="text-xl font-bold">{processResults.summary.total}</div>
                    <div className="text-xs text-muted-foreground">전체</div>
                  </div>
                  <div className="p-2 bg-green-50 dark:bg-green-950 rounded">
                    <div className="text-xl font-bold text-green-600">{processResults.summary.success}</div>
                    <div className="text-xs text-muted-foreground">학습 성공</div>
                  </div>
                  <div className="p-2 bg-yellow-50 dark:bg-yellow-950 rounded">
                    <div className="text-xl font-bold text-yellow-600">{processResults.summary.skipped}</div>
                    <div className="text-xs text-muted-foreground">건너뜀</div>
                  </div>
                  <div className="p-2 bg-red-50 dark:bg-red-950 rounded">
                    <div className="text-xl font-bold text-red-600">{processResults.summary.error}</div>
                    <div className="text-xs text-muted-foreground">오류</div>
                  </div>
                </div>

                {processResults.results && processResults.results.length > 0 && (
                  <div className="border rounded table-scroll-container">
                    <Table>
                      <TableHeader className="sticky top-0 z-10 bg-background">
                        <TableRow>
                          <TableHead className="w-12">행</TableHead>
                          <TableHead>주소</TableHead>
                          <TableHead className="w-24">상태</TableHead>
                          <TableHead>결과</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {processResults.results.map((result, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-mono text-xs">{result.rowIndex}</TableCell>
                            <TableCell className="max-w-[200px] truncate">{result.originalAddress}</TableCell>
                            <TableCell>
                              <Badge 
                                variant={
                                  result.status === 'success' ? 'default' :
                                  result.status === 'skipped' ? 'secondary' : 'destructive'
                                }
                              >
                                {result.status === 'success' ? '성공' :
                                 result.status === 'skipped' ? '건너뜀' : '오류'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {result.pattern || result.message}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsExcelDialogOpen(false)} data-testid="button-close-excel">
              닫기
            </Button>
            <Button 
              onClick={() => processMutation.mutate()}
              disabled={processMutation.isPending || selectedColumn === null || !excelFile}
              data-testid="button-process-excel"
            >
              {processMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              AI 학습 시작
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
