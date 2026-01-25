import { useState, useEffect } from "react";
import { useAdminSiteSettings, useUpdateSiteSettings, useSeedSiteSettings, settingsToMap } from "@/hooks/use-site-settings";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, RefreshCw, Settings, Globe, Layout } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";

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
