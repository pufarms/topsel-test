import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
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
import { DynamicPageRenderer, availableIcons } from "@/components/dynamic-page-renderer";
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
  Monitor,
  Code,
  Star,
  Heart,
  Zap,
  Award,
  TrendingUp
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
  imageCategories,
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
  const [location] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  
  // URL에서 카테고리 파라미터 읽기
  const urlParams = new URLSearchParams(window.location.search);
  const urlCategory = urlParams.get('category');
  
  const [categoryFilter, setCategoryFilter] = useState<string>(urlCategory || "all");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    urlCategory ? new Set([urlCategory]) : new Set(pageCategories)
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // URL 변경 시 카테고리 필터 업데이트
  useEffect(() => {
    const updateCategoryFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const category = params.get('category');
      if (category) {
        setCategoryFilter(category);
        setExpandedCategories(new Set([category]));
      } else {
        setCategoryFilter("all");
        setExpandedCategories(new Set(pageCategories));
      }
    };
    
    // 초기 로드 시 URL 확인
    updateCategoryFromUrl();
    
    // popstate 이벤트 리스너 등록 (브라우저 뒤로/앞으로 및 History API)
    window.addEventListener('popstate', updateCategoryFromUrl);
    return () => window.removeEventListener('popstate', updateCategoryFromUrl);
  }, []);
  const [editDialog, setEditDialog] = useState<{ open: boolean; page: Page | null }>({ open: false, page: null });
  const [addDialog, setAddDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; page: Page | null }>({ open: false, page: null });
  const [previewDialog, setPreviewDialog] = useState<{ open: boolean; page: Page | null }>({ open: false, page: null });
  const [editTab, setEditTab] = useState<string>("settings");
  
  // Auto-fit preview refs and scale
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const previewContentRef = useRef<HTMLDivElement>(null);
  const [autoFitScale, setAutoFitScale] = useState<number>(0.3);
  
  // Resizable dialog state
  const [dialogSize, setDialogSize] = useState({ width: 80, height: 80 }); // vw, vh percentages
  const [isResizing, setIsResizing] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  
  // Handle dialog resize
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = dialogSize.width;
    const startHeight = dialogSize.height;
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      
      // Calculate new size based on viewport
      const vwDelta = (deltaX / window.innerWidth) * 100;
      const vhDelta = (deltaY / window.innerHeight) * 100;
      
      const newWidth = Math.max(50, Math.min(98, startWidth + vwDelta * 2));
      const newHeight = Math.max(50, Math.min(98, startHeight + vhDelta * 2));
      
      setDialogSize({ width: newWidth, height: newHeight });
    };
    
    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };
  
  // Inline field editing state
  const [inlineEditDialog, setInlineEditDialog] = useState<{
    open: boolean;
    sectionId: string;
    fieldPath: string;
    currentValue: string;
    fieldType: 'text' | 'image' | 'icon' | 'button';
  }>({ open: false, sectionId: '', fieldPath: '', currentValue: '', fieldType: 'text' });
  const [inlineEditValue, setInlineEditValue] = useState<string>('');
  const [buttonEditData, setButtonEditData] = useState<{ text: string; link: string; openInNewTab: boolean }>({ text: '', link: '', openInNewTab: false });
  const [imageGalleryCategory, setImageGalleryCategory] = useState<string>('all');

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

  // Calculate auto-fit scale when dialog size changes or tab switches to preview
  useEffect(() => {
    if (editTab !== 'preview' || !editDialog.open) return;
    
    const calculateScale = () => {
      const container = previewContainerRef.current;
      const content = previewContentRef.current;
      if (!container || !content) return;
      
      const containerWidth = container.clientWidth - 32; // padding
      const containerHeight = container.clientHeight - 32;
      const contentWidth = 1400; // fixed page width
      const contentHeight = content.scrollHeight || 3000; // estimate page height
      
      // Calculate scale to fit both width and height
      const scaleX = containerWidth / contentWidth;
      const scaleY = containerHeight / contentHeight;
      const newScale = Math.min(scaleX, scaleY, 1); // never scale up beyond 100%
      
      setAutoFitScale(Math.max(0.1, newScale));
    };
    
    // Delay calculation to allow content to render
    const timer = setTimeout(calculateScale, 100);
    
    // Recalculate on resize
    const resizeObserver = new ResizeObserver(calculateScale);
    if (previewContainerRef.current) {
      resizeObserver.observe(previewContainerRef.current);
    }
    
    return () => {
      clearTimeout(timer);
      resizeObserver.disconnect();
    };
  }, [editTab, editDialog.open, dialogSize, contentData]);

  // Fetch pages
  const { data: pages = [], isLoading, refetch } = useQuery<Page[]>({
    queryKey: ["/api/pages"],
  });

  // Fetch icons from gallery
  const { data: galleryIcons = [] } = useQuery<{ id: string; publicUrl: string; filename: string }[]>({
    queryKey: ["/api/admin/images", "아이콘"],
    queryFn: async () => {
      const res = await fetch("/api/admin/images?category=아이콘");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: inlineEditDialog.fieldType === 'icon',
  });

  // Fetch images from gallery for image picker
  const { data: galleryImages = [] } = useQuery<{ id: string; publicUrl: string; filename: string; category: string }[]>({
    queryKey: ["/api/admin/images", imageGalleryCategory],
    queryFn: async () => {
      const url = imageGalleryCategory === 'all' 
        ? "/api/admin/images" 
        : `/api/admin/images?category=${encodeURIComponent(imageGalleryCategory)}`;
      const res = await fetch(url);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: inlineEditDialog.fieldType === 'image',
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
  
  // Handle inline field editing from preview tab
  const handleFieldEdit = (sectionId: string, fieldPath: string, currentValue: string, fieldType: 'text' | 'image' | 'icon' | 'button') => {
    if (fieldType === 'button') {
      // Parse button data: "text|link|openInNewTab"
      const parts = currentValue.split('|');
      setButtonEditData({
        text: parts[0] || '',
        link: parts[1] || '',
        openInNewTab: parts[2] === 'true'
      });
    } else {
      const editValue = fieldType === 'text' 
        ? currentValue.replace(/<br\s*\/?>/gi, '\n')
        : currentValue;
      setInlineEditValue(editValue);
    }
    setInlineEditDialog({
      open: true,
      sectionId,
      fieldPath,
      currentValue,
      fieldType,
    });
  };
  
  // Handle position change from toolbar
  const handlePositionChange = (sectionId: string, contentAlign: 'left' | 'center' | 'right', contentVerticalAlign: 'top' | 'center' | 'bottom') => {
    if (!contentData || !contentData.sections || !editDialog.page) return;
    
    const updatedSections = contentData.sections.map((section: any, index: number) => {
      const sectionIdentifier = section.id || `section-${index}`;
      if (sectionIdentifier === sectionId) {
        return {
          ...section,
          data: {
            ...section.data,
            contentAlign,
            contentVerticalAlign,
          },
        };
      }
      return section;
    });
    
    const updatedContent = { ...contentData, sections: updatedSections };
    setContentData(updatedContent);
    
    // Auto-save position changes
    updateContentMutation.mutate({ 
      id: editDialog.page.id, 
      content: updatedContent,
      path: editDialog.page.path
    });
  };
  
  // Helper function to set a nested value using a path like "items.0.title"
  const setNestedValue = (obj: any, path: string, value: any): any => {
    const keys = path.split('.');
    if (keys.length === 1) {
      return { ...obj, [keys[0]]: value };
    }
    
    const [first, ...rest] = keys;
    const restPath = rest.join('.');
    
    // Check if next key is a number (array index)
    if (!isNaN(Number(rest[0]))) {
      // Handle array
      const arr = Array.isArray(obj[first]) ? [...obj[first]] : [];
      const index = Number(rest[0]);
      if (rest.length === 1) {
        arr[index] = value;
      } else {
        arr[index] = setNestedValue(arr[index] || {}, rest.slice(1).join('.'), value);
      }
      return { ...obj, [first]: arr };
    }
    
    return {
      ...obj,
      [first]: setNestedValue(obj[first] || {}, restPath, value),
    };
  };

  // Apply inline edit to content data and save directly to database
  const applyInlineEdit = () => {
    if (!contentData || !contentData.sections || !editDialog.page) return;
    
    const saveValue = inlineEditDialog.fieldType === 'text'
      ? inlineEditValue.replace(/\n/g, '<br>')
      : inlineEditValue;
    
    const updatedSections = contentData.sections.map((section: any, index: number) => {
      // Match by section.id if it exists, otherwise match by generated index-based ID
      const sectionIdentifier = section.id || `section-${index}`;
      if (sectionIdentifier === inlineEditDialog.sectionId) {
        const fieldPath = inlineEditDialog.fieldPath;
        
        // Special handling for button updates
        if (inlineEditDialog.fieldType === 'button') {
          const isSecondary = fieldPath === 'secondaryButton';
          const textKey = isSecondary ? 'secondaryButtonText' : 'buttonText';
          const linkKey = isSecondary ? 'secondaryButtonLink' : 'buttonLink';
          const newTabKey = isSecondary ? 'secondaryButtonNewTab' : 'buttonNewTab';
          
          return {
            ...section,
            data: {
              ...section.data,
              [textKey]: buttonEditData.text,
              [linkKey]: buttonEditData.link,
              [newTabKey]: buttonEditData.openInNewTab
            }
          };
        }
        
        // Special handling for YouTube video ID updates - also update thumbnail
        const videoIdMatch = fieldPath.match(/^videos\.(\d+)\.id$/);
        if (videoIdMatch && section.data?.videos) {
          const videoIndex = parseInt(videoIdMatch[1]);
          const updatedVideos = [...section.data.videos];
          if (updatedVideos[videoIndex]) {
            updatedVideos[videoIndex] = {
              ...updatedVideos[videoIndex],
              id: saveValue,
              thumbnail: `https://img.youtube.com/vi/${saveValue}/maxresdefault.jpg`
            };
          }
          return {
            ...section,
            data: {
              ...section.data,
              videos: updatedVideos
            }
          };
        }
        
        // Handle nested paths like "items.0.title" or "items.0.description"
        if (fieldPath.includes('.')) {
          if (section.data) {
            return {
              ...section,
              data: setNestedValue(section.data, fieldPath, saveValue),
            };
          } else {
            return setNestedValue(section, fieldPath, saveValue);
          }
        }
        
        // Handle flat paths
        if (section.data) {
          return {
            ...section,
            data: {
              ...section.data,
              [fieldPath]: saveValue,
            },
          };
        } else {
          return {
            ...section,
            [fieldPath]: saveValue,
          };
        }
      }
      return section;
    });
    
    const updatedContent = { ...contentData, sections: updatedSections };
    setContentData(updatedContent);
    setInlineEditDialog({ open: false, sectionId: '', fieldPath: '', currentValue: '', fieldType: 'text' });
    
    // Save directly to database
    updateContentMutation.mutate({ 
      id: editDialog.page.id, 
      content: updatedContent, 
      path: editDialog.page.path 
    });
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
                                <a href={page.path} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="w-4 h-4" />
                                </a>
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
        <DialogContent 
          ref={dialogRef}
          className="overflow-hidden flex flex-col relative p-6"
          style={{
            width: `${dialogSize.width}vw`,
            height: `${dialogSize.height}vh`,
            maxWidth: 'none',
            maxHeight: 'none',
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        >
          {/* Resize handles */}
          <div 
            className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize z-50 group"
            onMouseDown={handleResizeStart}
          >
            <div className="absolute bottom-1 right-1 w-3 h-3 border-r-2 border-b-2 border-muted-foreground/50 group-hover:border-primary transition-colors" />
          </div>
          <div 
            className="absolute top-1/2 right-0 -translate-y-1/2 w-2 h-16 cursor-e-resize z-50 hover:bg-primary/20 rounded transition-colors"
            onMouseDown={handleResizeStart}
          />
          <div 
            className="absolute bottom-0 left-1/2 -translate-x-1/2 h-2 w-16 cursor-s-resize z-50 hover:bg-primary/20 rounded transition-colors"
            onMouseDown={handleResizeStart}
          />
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
              <TabsTrigger value="code" data-testid="tab-code">
                <Code className="w-4 h-4 mr-2" />
                코드
              </TabsTrigger>
              <TabsTrigger value="preview" data-testid="tab-preview">
                <Monitor className="w-4 h-4 mr-2" />
                뷰편집
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
            
            <TabsContent value="code" className="flex-1 overflow-auto mt-4">
              <div className="space-y-4">
                <div className="bg-muted px-4 py-2 rounded-t-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Code className="w-4 h-4" />
                    <span className="text-sm font-medium">페이지 콘텐츠 코드 (JSON)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        try {
                          const formatted = JSON.stringify(contentData, null, 2);
                          setContentData(JSON.parse(formatted));
                          toast({ title: "코드 포맷 완료", description: "JSON 코드가 정렬되었습니다." });
                        } catch (e) {
                          toast({ title: "포맷 오류", description: "올바른 JSON 형식이 아닙니다.", variant: "destructive" });
                        }
                      }}
                      data-testid="button-format-code"
                    >
                      정렬
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify(contentData, null, 2));
                        toast({ title: "복사됨", description: "코드가 클립보드에 복사되었습니다." });
                      }}
                      data-testid="button-copy-code"
                    >
                      복사
                    </Button>
                  </div>
                </div>
                <Textarea
                  className="font-mono text-sm h-[350px] resize-none"
                  value={JSON.stringify(contentData, null, 2)}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value);
                      setContentData(parsed);
                    } catch (err) {
                      // Allow partial editing - will validate on save
                    }
                  }}
                  placeholder='{"meta": {...}, "sections": [...]}'
                  data-testid="textarea-code-editor"
                />
                <p className="text-sm text-muted-foreground">
                  페이지 콘텐츠를 JSON 형식으로 직접 수정할 수 있습니다. 변경 후 "콘텐츠 저장" 버튼을 클릭하세요.
                </p>
              </div>
            </TabsContent>
            
            <TabsContent value="preview" className="flex-1 flex flex-col mt-4 min-h-0">
              <div className="border rounded-lg overflow-hidden bg-background flex-1 flex flex-col min-h-0">
                <div className="bg-muted px-4 py-2 border-b flex items-center justify-between flex-wrap gap-2 shrink-0">
                  <div className="flex items-center gap-2">
                    <Monitor className="w-4 h-4" />
                    <span className="text-sm font-medium">뷰 편집</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    요소를 클릭하면 편집창이 열립니다 (전체 페이지가 자동으로 맞춰집니다)
                  </p>
                </div>
                <div 
                  ref={previewContainerRef}
                  className="flex-1 overflow-hidden bg-gray-100 dark:bg-gray-900 flex items-start justify-center p-4"
                >
                  <div 
                    style={{ 
                      transform: `scale(${autoFitScale})`,
                      transformOrigin: 'top center',
                      width: '1400px',
                      flexShrink: 0,
                    }}
                  >
                    <div 
                      ref={previewContentRef}
                      className="bg-background shadow-lg"
                    >
                      <DynamicPageRenderer 
                        content={contentData} 
                        isEditing={true}
                        onFieldEdit={handleFieldEdit}
                        onPositionChange={handlePositionChange}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
          
          <DialogFooter className="mt-4 pt-4 border-t flex-wrap gap-2">
            <Button variant="outline" onClick={() => { setEditDialog({ open: false, page: null }); resetForm(); }}>
              취소
            </Button>
            <Button 
              variant="secondary"
              onClick={() => {
                if (editDialog.page && contentData) {
                  updateContentMutation.mutate({ 
                    id: editDialog.page.id, 
                    content: contentData,
                    path: editDialog.page.path
                  });
                }
              }}
              disabled={updateContentMutation.isPending || !contentData}
              data-testid="button-save-content"
            >
              {updateContentMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              콘텐츠 저장
            </Button>
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
      
      {/* Inline Field Edit Dialog */}
      <Dialog open={inlineEditDialog.open} onOpenChange={(open) => {
        if (!open) setInlineEditDialog({ open: false, sectionId: '', fieldPath: '', currentValue: '', fieldType: 'text' });
      }}>
        <DialogContent className="max-w-4xl w-[90vw] max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>
              {inlineEditDialog.fieldType === 'image' ? '이미지 변경' : 
               inlineEditDialog.fieldType === 'icon' ? '아이콘 변경' : 
               inlineEditDialog.fieldType === 'button' ? '버튼 편집' :
               (inlineEditDialog.fieldPath.includes('videos') && inlineEditDialog.fieldPath.includes('.id')) ? '유튜브 비디오 편집' : '텍스트 편집'}
            </DialogTitle>
            <DialogDescription>
              {inlineEditDialog.fieldType === 'image' 
                ? '이미지 갤러리에서 이미지를 선택하세요' 
                : inlineEditDialog.fieldType === 'icon'
                ? '아이콘 갤러리에서 아이콘을 선택하세요'
                : inlineEditDialog.fieldType === 'button'
                ? '버튼의 텍스트, 링크, 열기 방식을 설정하세요'
                : (inlineEditDialog.fieldPath.includes('videos') && inlineEditDialog.fieldPath.includes('.id'))
                ? 'YouTube URL 또는 비디오 ID를 입력하세요'
                : '텍스트를 수정하세요'}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {inlineEditDialog.fieldType === 'image' ? (
              <div className="space-y-4">
                {inlineEditValue && (
                  <div className="border rounded-lg p-2 bg-muted/50">
                    <img 
                      src={inlineEditValue} 
                      alt="현재 이미지" 
                      className="max-w-full h-auto max-h-[150px] mx-auto rounded"
                    />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Label className="whitespace-nowrap">카테고리:</Label>
                  <Select value={imageGalleryCategory} onValueChange={setImageGalleryCategory}>
                    <SelectTrigger className="w-32" data-testid="select-image-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">전체</SelectItem>
                      {imageCategories.map((cat) => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-sm text-muted-foreground ml-auto">
                    {galleryImages.length}개 이미지
                  </span>
                </div>
                {galleryImages.length > 0 ? (
                  <ScrollArea className="h-[250px] border rounded-lg p-2">
                    <div className="grid grid-cols-3 gap-2">
                      {galleryImages.map((img) => (
                        <div
                          key={img.id}
                          className={`cursor-pointer border-2 rounded-lg p-1 hover:border-primary transition-colors ${
                            inlineEditValue === img.publicUrl ? 'border-primary bg-primary/10' : 'border-transparent'
                          }`}
                          onClick={() => setInlineEditValue(img.publicUrl)}
                          data-testid={`image-select-${img.id}`}
                        >
                          <img 
                            src={img.publicUrl} 
                            alt={img.filename} 
                            className="w-full h-20 object-cover rounded"
                          />
                          <p className="text-xs text-center mt-1 truncate">{img.filename}</p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="text-center py-8 text-muted-foreground border rounded-lg">
                    <p>등록된 이미지가 없습니다.</p>
                    <p className="text-sm mt-2">이미지 갤러리에서 이미지를 업로드하세요.</p>
                  </div>
                )}
              </div>
            ) : inlineEditDialog.fieldType === 'icon' ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  현재 선택: {inlineEditValue && (
                    <img src={inlineEditValue} alt="선택된 아이콘" className="inline-block w-6 h-6 ml-2" />
                  )}
                </p>
                {galleryIcons.length > 0 ? (
                  <ScrollArea className="h-[200px]">
                    <div className="grid grid-cols-5 gap-2 p-1">
                      {galleryIcons.map((icon) => (
                        <div
                          key={icon.id}
                          className={`cursor-pointer border-2 rounded-lg p-2 hover:border-primary transition-colors ${
                            inlineEditValue === icon.publicUrl ? 'border-primary bg-primary/10' : 'border-transparent'
                          }`}
                          onClick={() => setInlineEditValue(icon.publicUrl)}
                          data-testid={`icon-select-${icon.id}`}
                        >
                          <img 
                            src={icon.publicUrl} 
                            alt={icon.filename} 
                            className="w-10 h-10 object-contain mx-auto"
                          />
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>등록된 아이콘이 없습니다.</p>
                    <p className="text-sm mt-2">이미지 갤러리에서 "아이콘" 카테고리에 이미지를 업로드하세요.</p>
                  </div>
                )}
              </div>
            ) : inlineEditDialog.fieldType === 'button' ? (
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">버튼 텍스트</Label>
                  <Input
                    value={buttonEditData.text}
                    onChange={(e) => setButtonEditData(prev => ({ ...prev, text: e.target.value }))}
                    className="mt-1"
                    placeholder="버튼에 표시될 텍스트"
                    data-testid="input-button-text"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">링크 주소</Label>
                  <Input
                    value={buttonEditData.link}
                    onChange={(e) => setButtonEditData(prev => ({ ...prev, link: e.target.value }))}
                    className="mt-1"
                    placeholder="예: /register 또는 https://example.com"
                    data-testid="input-button-link"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    내부 페이지는 /로 시작 (예: /register), 외부 링크는 https://로 시작
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="openInNewTab"
                    checked={buttonEditData.openInNewTab}
                    onChange={(e) => setButtonEditData(prev => ({ ...prev, openInNewTab: e.target.checked }))}
                    className="w-4 h-4"
                    data-testid="checkbox-button-newtab"
                  />
                  <Label htmlFor="openInNewTab" className="text-sm cursor-pointer">새 창에서 열기</Label>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm font-medium mb-2">미리보기</p>
                  <Button size="sm" className="pointer-events-none">
                    {buttonEditData.text || '버튼 텍스트'}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2">
                    링크: {buttonEditData.link || '(없음)'} {buttonEditData.openInNewTab ? '(새 창)' : '(현재 창)'}
                  </p>
                </div>
              </div>
            ) : inlineEditDialog.fieldPath.includes('videos') && inlineEditDialog.fieldPath.includes('.id') ? (
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm font-medium mb-2">현재 비디오 ID</p>
                  <p className="font-mono text-sm bg-background p-2 rounded">{inlineEditValue || '없음'}</p>
                  {inlineEditValue && (
                    <div className="mt-2">
                      <img 
                        src={`https://img.youtube.com/vi/${inlineEditValue}/mqdefault.jpg`}
                        alt="현재 비디오 썸네일"
                        className="w-full max-w-xs rounded"
                      />
                    </div>
                  )}
                </div>
                <div>
                  <Label className="text-sm font-medium">YouTube URL 또는 비디오 ID 입력</Label>
                  <Input
                    value={inlineEditValue}
                    onChange={(e) => {
                      let value = e.target.value.trim();
                      // Extract video ID from various YouTube URL formats
                      const patterns = [
                        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
                        /^([a-zA-Z0-9_-]{11})$/
                      ];
                      for (const pattern of patterns) {
                        const match = value.match(pattern);
                        if (match) {
                          value = match[1];
                          break;
                        }
                      }
                      setInlineEditValue(value);
                    }}
                    className="mt-1"
                    placeholder="예: https://www.youtube.com/watch?v=dQw4w9WgXcQ 또는 dQw4w9WgXcQ"
                    data-testid="input-youtube-url"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    YouTube URL을 붙여넣으면 자동으로 비디오 ID가 추출됩니다
                  </p>
                </div>
              </div>
            ) : (
              <Textarea
                value={inlineEditValue}
                onChange={(e) => setInlineEditValue(e.target.value)}
                className="min-h-[150px]"
                placeholder="텍스트 입력..."
                data-testid="textarea-inline-text"
              />
            )}
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setInlineEditDialog({ open: false, sectionId: '', fieldPath: '', currentValue: '', fieldType: 'text' })}
            >
              취소
            </Button>
            <Button 
              onClick={applyInlineEdit} 
              disabled={updateContentMutation.isPending}
              data-testid="button-apply-inline-edit"
            >
              {updateContentMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              콘텐츠 저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
