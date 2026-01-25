import { useState } from "react";
import { Link } from "wouter";
import { PageHeader } from "@/components/admin/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageContentEditor } from "@/components/admin/page-content-editor";
import { DynamicPageRenderer } from "@/components/dynamic-page-renderer";
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
  Check,
  Plus,
  Pencil,
  Trash2,
  LogIn,
  LogOut,
  UserPlus,
  Shield,
  Users,
  LayoutDashboard,
  XCircle,
  Download,
  Truck,
  CheckCircle,
  BarChart,
  DollarSign,
  BookOpen,
  ClipboardList,
  Package,
  Wallet,
  Gift,
  MessageSquare,
  MessageCircle,
  ChevronDown,
  ChevronRight,
  Loader2,
  RefreshCw,
  Monitor
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  pageCategories, 
  pageAccessLevels, 
  pageAccessLevelLabels,
  type Page, 
  type PageCategory, 
  type PageAccessLevel,
  type PageContent
} from "@shared/schema";

const iconMap: Record<string, React.ReactNode> = {
  Home: <Home className="w-4 h-4" />,
  LogIn: <LogIn className="w-4 h-4" />,
  LogOut: <LogOut className="w-4 h-4" />,
  UserPlus: <UserPlus className="w-4 h-4" />,
  FileText: <FileText className="w-4 h-4" />,
  Shield: <Shield className="w-4 h-4" />,
  Users: <Users className="w-4 h-4" />,
  Layout: <Layout className="w-4 h-4" />,
  LayoutDashboard: <LayoutDashboard className="w-4 h-4" />,
  User: <User className="w-4 h-4" />,
  ShoppingCart: <ShoppingCart className="w-4 h-4" />,
  XCircle: <XCircle className="w-4 h-4" />,
  Download: <Download className="w-4 h-4" />,
  Truck: <Truck className="w-4 h-4" />,
  CheckCircle: <CheckCircle className="w-4 h-4" />,
  BarChart: <BarChart className="w-4 h-4" />,
  DollarSign: <DollarSign className="w-4 h-4" />,
  BookOpen: <BookOpen className="w-4 h-4" />,
  ClipboardList: <ClipboardList className="w-4 h-4" />,
  Package: <Package className="w-4 h-4" />,
  Wallet: <Wallet className="w-4 h-4" />,
  Gift: <Gift className="w-4 h-4" />,
  MessageSquare: <MessageSquare className="w-4 h-4" />,
  MessageCircle: <MessageCircle className="w-4 h-4" />,
  Eye: <Eye className="w-4 h-4" />,
  Settings: <Settings className="w-4 h-4" />,
};

const getIcon = (iconName: string | null) => {
  if (!iconName) return <FileText className="w-4 h-4" />;
  return iconMap[iconName] || <FileText className="w-4 h-4" />;
};

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  active: { label: "활성", variant: "default" },
  draft: { label: "준비중", variant: "secondary" },
  hidden: { label: "숨김", variant: "outline" },
};

export default function PagesManagement() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(pageCategories));
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editDialog, setEditDialog] = useState<{ open: boolean; page: Page | null }>({ open: false, page: null });
  const [addDialog, setAddDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; page: Page | null }>({ open: false, page: null });
  const [previewDialog, setPreviewDialog] = useState<{ open: boolean; page: Page | null }>({ open: false, page: null });
  const [editTab, setEditTab] = useState<string>("settings");

  // Form state for add/edit
  const [formData, setFormData] = useState({
    name: "",
    path: "",
    description: "",
    category: "기타페이지" as PageCategory,
    accessLevel: "all" as PageAccessLevel,
    status: "draft",
    icon: "",
  });
  
  // Content state for editing
  const [contentData, setContentData] = useState<PageContent | null>(null);

  // Fetch pages
  const { data: pages = [], isLoading, refetch } = useQuery<Page[]>({
    queryKey: ["/api/pages"],
  });

  // Seed pages mutation
  const seedMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/pages/seed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pages"] });
      toast({ title: "기본 페이지가 생성되었습니다" });
    },
    onError: () => {
      toast({ title: "오류", description: "페이지 생성에 실패했습니다", variant: "destructive" });
    },
  });

  // Create page mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await apiRequest("POST", "/api/pages", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pages"] });
      toast({ title: "페이지가 추가되었습니다" });
      setAddDialog(false);
      resetForm();
    },
    onError: () => {
      toast({ title: "오류", description: "페이지 추가에 실패했습니다", variant: "destructive" });
    },
  });

  // Update page mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> }) => {
      const res = await apiRequest("PUT", `/api/pages/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pages"] });
      toast({ title: "페이지가 수정되었습니다" });
      setEditDialog({ open: false, page: null });
      resetForm();
    },
    onError: () => {
      toast({ title: "오류", description: "페이지 수정에 실패했습니다", variant: "destructive" });
    },
  });

  // Update content mutation
  const updateContentMutation = useMutation({
    mutationFn: async ({ id, content, path }: { id: string; content: PageContent; path: string }) => {
      const res = await apiRequest("PATCH", `/api/pages/${id}/content`, { content });
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/pages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pages/by-path", variables.path] });
      toast({ title: "콘텐츠가 저장되었습니다" });
    },
    onError: () => {
      toast({ title: "오류", description: "콘텐츠 저장에 실패했습니다", variant: "destructive" });
    },
  });

  // Delete page mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/pages/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pages"] });
      toast({ title: "페이지가 삭제되었습니다" });
      setDeleteDialog({ open: false, page: null });
    },
    onError: () => {
      toast({ title: "오류", description: "시스템 페이지는 삭제할 수 없습니다", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      path: "",
      description: "",
      category: "기타페이지",
      accessLevel: "all",
      status: "draft",
      icon: "",
    });
    setContentData(null);
    setEditTab("settings");
  };

  const openEditDialog = (page: Page) => {
    setFormData({
      name: page.name,
      path: page.path,
      description: page.description || "",
      category: page.category as PageCategory,
      accessLevel: page.accessLevel as PageAccessLevel,
      status: page.status,
      icon: page.icon || "",
    });
    setContentData(page.content || { sections: [] });
    setEditTab("settings");
    setEditDialog({ open: true, page });
  };

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

  const toggleCategory = (category: string) => {
    const newSet = new Set(expandedCategories);
    if (newSet.has(category)) {
      newSet.delete(category);
    } else {
      newSet.add(category);
    }
    setExpandedCategories(newSet);
  };

  // Filter by category and search term
  const filteredPages = pages.filter((page) => {
    const matchesCategory = categoryFilter === "all" || page.category === categoryFilter;
    const matchesSearch = 
      page.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      page.path.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (page.description || "").toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Group pages by category
  const groupedPages = pageCategories.reduce((acc, category) => {
    const categoryPages = filteredPages.filter((page) => page.category === category);
    acc[category] = categoryPages;
    return acc;
  }, {} as Record<PageCategory, Page[]>);
  
  // Categories to display (only selected or all)
  const categoriesToShow = categoryFilter === "all" 
    ? pageCategories 
    : pageCategories.filter(cat => cat === categoryFilter);

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 lg:p-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <PageHeader
        title="페이지 관리"
        description="사이트 페이지를 카테고리별로 관리합니다."
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
              <CardDescription>
                {categoryFilter === "all" 
                  ? `총 ${filteredPages.length}개의 페이지 (8개 카테고리)` 
                  : `${categoryFilter}: ${filteredPages.length}개의 페이지`}
              </CardDescription>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[160px]" data-testid="select-category-filter">
                  <SelectValue placeholder="카테고리 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 카테고리</SelectItem>
                  {pageCategories.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-[180px]"
                  data-testid="input-search"
                />
              </div>
              {pages.length === 0 && (
                <Button 
                  variant="outline" 
                  onClick={() => seedMutation.mutate()}
                  disabled={seedMutation.isPending}
                  data-testid="button-seed-pages"
                >
                  {seedMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                  기본 페이지 생성
                </Button>
              )}
              <Button onClick={() => setAddDialog(true)} data-testid="button-add-page">
                <Plus className="w-4 h-4 mr-2" />
                페이지 추가
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {categoriesToShow.map((category) => {
            const categoryPages = groupedPages[category] || [];
            const isExpanded = expandedCategories.has(category);
            
            return (
              <div key={category} className="border rounded-lg overflow-hidden">
                <button
                  className="w-full flex items-center justify-between p-4 bg-muted/50 hover-elevate text-left"
                  onClick={() => toggleCategory(category)}
                  data-testid={`button-category-${category}`}
                >
                  <div className="flex items-center gap-2">
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    <span className="font-medium">{category}</span>
                    <Badge variant="secondary" className="ml-2">{categoryPages.length}</Badge>
                  </div>
                </button>
                
                {isExpanded && (
                  <div className="divide-y">
                    {categoryPages.length === 0 ? (
                      <div className="p-4 text-sm text-muted-foreground text-center">
                        이 카테고리에 페이지가 없습니다
                      </div>
                    ) : (
                      categoryPages.map((page) => (
                        <div 
                          key={page.id} 
                          className="flex items-center justify-between p-4 hover:bg-muted/30 gap-4"
                          data-testid={`page-row-${page.id}`}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="p-2 rounded-md bg-muted shrink-0">
                              {getIcon(page.icon)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium truncate">{page.name}</span>
                                <Badge variant={statusLabels[page.status]?.variant || "secondary"}>
                                  {statusLabels[page.status]?.label || page.status}
                                </Badge>
                                <Badge variant="outline">
                                  {pageAccessLevelLabels[page.accessLevel as PageAccessLevel] || page.accessLevel}
                                </Badge>
                                {page.isSystem === "true" && (
                                  <Badge variant="outline" className="text-xs">시스템</Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-sm text-muted-foreground truncate">{page.path}</span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5 shrink-0"
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
                              {page.description && (
                                <p className="text-xs text-muted-foreground mt-1 truncate">{page.description}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {page.status === "active" && (
                              <Button variant="ghost" size="icon" asChild>
                                <Link href={page.path}>
                                  <ExternalLink className="w-4 h-4" />
                                </Link>
                              </Button>
                            )}
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => openEditDialog(page)}
                              data-testid={`button-edit-${page.id}`}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            {page.isSystem !== "true" && (
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => setDeleteDialog({ open: true, page })}
                                data-testid={`button-delete-${page.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Add Page Dialog */}
      <Dialog open={addDialog} onOpenChange={setAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>페이지 추가</DialogTitle>
            <DialogDescription>새 페이지를 추가합니다.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>페이지 이름</Label>
              <Input 
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="페이지 이름"
                data-testid="input-page-name"
              />
            </div>
            <div>
              <Label>경로 (URL)</Label>
              <Input 
                value={formData.path}
                onChange={(e) => setFormData({ ...formData, path: e.target.value })}
                placeholder="/example-page"
                data-testid="input-page-path"
              />
            </div>
            <div>
              <Label>설명</Label>
              <Textarea 
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="페이지 설명"
                data-testid="input-page-description"
              />
            </div>
            <div>
              <Label>카테고리</Label>
              <Select 
                value={formData.category} 
                onValueChange={(v) => setFormData({ ...formData, category: v as PageCategory })}
              >
                <SelectTrigger data-testid="select-page-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pageCategories.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>접근권한</Label>
              <Select 
                value={formData.accessLevel} 
                onValueChange={(v) => setFormData({ ...formData, accessLevel: v as PageAccessLevel })}
              >
                <SelectTrigger data-testid="select-page-access">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pageAccessLevels.map((level) => (
                    <SelectItem key={level} value={level}>{pageAccessLevelLabels[level]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>상태</Label>
              <Select 
                value={formData.status} 
                onValueChange={(v) => setFormData({ ...formData, status: v })}
              >
                <SelectTrigger data-testid="select-page-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">활성</SelectItem>
                  <SelectItem value="draft">준비중</SelectItem>
                  <SelectItem value="hidden">숨김</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddDialog(false); resetForm(); }}>
              취소
            </Button>
            <Button 
              onClick={() => createMutation.mutate(formData)}
              disabled={createMutation.isPending || !formData.name || !formData.path}
              data-testid="button-save-new-page"
            >
              {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              추가
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Page Dialog with Tabs */}
      <Dialog open={editDialog.open} onOpenChange={(open) => { setEditDialog({ open, page: open ? editDialog.page : null }); if (!open) resetForm(); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5" />
              페이지 수정: {editDialog.page?.name}
            </DialogTitle>
            <DialogDescription>페이지 설정과 콘텐츠를 수정합니다.</DialogDescription>
          </DialogHeader>
          
          <Tabs value={editTab} onValueChange={setEditTab} className="flex-1 flex flex-col min-h-0">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="settings" data-testid="tab-settings">
                <Settings className="w-4 h-4 mr-2" />
                설정
              </TabsTrigger>
              <TabsTrigger value="content" data-testid="tab-content">
                <Layout className="w-4 h-4 mr-2" />
                콘텐츠
              </TabsTrigger>
              <TabsTrigger value="preview" data-testid="tab-preview">
                <Monitor className="w-4 h-4 mr-2" />
                미리보기
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="settings" className="flex-1 overflow-auto mt-4">
              <div className="space-y-4 pr-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>페이지 이름</Label>
                    <Input 
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="페이지 이름"
                      data-testid="input-edit-page-name"
                    />
                  </div>
                  <div>
                    <Label>경로 (URL)</Label>
                    <Input 
                      value={formData.path}
                      onChange={(e) => setFormData({ ...formData, path: e.target.value })}
                      placeholder="/example-page"
                      data-testid="input-edit-page-path"
                    />
                  </div>
                </div>
                <div>
                  <Label>설명</Label>
                  <Textarea 
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="페이지 설명"
                    data-testid="input-edit-page-description"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>카테고리</Label>
                    <Select 
                      value={formData.category} 
                      onValueChange={(v) => setFormData({ ...formData, category: v as PageCategory })}
                    >
                      <SelectTrigger data-testid="select-edit-page-category">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {pageCategories.map((cat) => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>접근권한</Label>
                    <Select 
                      value={formData.accessLevel} 
                      onValueChange={(v) => setFormData({ ...formData, accessLevel: v as PageAccessLevel })}
                    >
                      <SelectTrigger data-testid="select-edit-page-access">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {pageAccessLevels.map((level) => (
                          <SelectItem key={level} value={level}>{pageAccessLevelLabels[level]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>상태</Label>
                    <Select 
                      value={formData.status} 
                      onValueChange={(v) => setFormData({ ...formData, status: v })}
                    >
                      <SelectTrigger data-testid="select-edit-page-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">활성</SelectItem>
                        <SelectItem value="draft">준비중</SelectItem>
                        <SelectItem value="hidden">숨김</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="content" className="flex-1 overflow-auto mt-4">
              <ScrollArea className="h-[400px] pr-4">
                <PageContentEditor 
                  content={contentData}
                  onChange={(newContent) => setContentData(newContent)}
                />
              </ScrollArea>
            </TabsContent>
            
            <TabsContent value="preview" className="flex-1 overflow-auto mt-4">
              <div className="border rounded-lg overflow-hidden bg-background">
                <div className="bg-muted px-4 py-2 border-b flex items-center gap-2">
                  <Monitor className="w-4 h-4" />
                  <span className="text-sm font-medium">페이지 미리보기</span>
                </div>
                <ScrollArea className="h-[400px]">
                  <DynamicPageRenderer content={contentData} />
                </ScrollArea>
              </div>
            </TabsContent>
          </Tabs>
          
          <DialogFooter className="mt-4 pt-4 border-t">
            <Button variant="outline" onClick={() => { setEditDialog({ open: false, page: null }); resetForm(); }}>
              취소
            </Button>
            {editTab === "content" && (
              <Button 
                variant="secondary"
                onClick={() => {
                  if (editDialog.page && contentData) {
                    updateContentMutation.mutate({ id: editDialog.page.id, content: contentData, path: editDialog.page.path });
                  }
                }}
                disabled={updateContentMutation.isPending}
                data-testid="button-save-content"
              >
                {updateContentMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                콘텐츠 저장
              </Button>
            )}
            <Button 
              onClick={() => editDialog.page && updateMutation.mutate({ id: editDialog.page.id, data: formData })}
              disabled={updateMutation.isPending || !formData.name || !formData.path}
              data-testid="button-save-edit-page"
            >
              {updateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              설정 저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, page: open ? deleteDialog.page : null })}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>페이지 삭제</DialogTitle>
            <DialogDescription>
              "{deleteDialog.page?.name}" 페이지를 삭제하시겠습니까?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog({ open: false, page: null })}>
              취소
            </Button>
            <Button 
              variant="destructive"
              onClick={() => deleteDialog.page && deleteMutation.mutate(deleteDialog.page.id)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
