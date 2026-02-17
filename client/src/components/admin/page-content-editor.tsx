import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  Trash2,
  GripVertical,
  Type,
  Image as ImageIcon,
  Layout,
  Heading,
  MousePointer,
  Minus,
  Grid3X3,
  Star,
  Megaphone,
  ChevronUp,
  ChevronDown,
  Pencil,
  Play,
  BarChart3,
  Sparkles,
  LayoutGrid,
  Zap,
} from "lucide-react";
import type { PageContent, PageSection, PageSectionType } from "@shared/schema";
import { pageSectionTypes } from "@shared/schema";

interface PageContentEditorProps {
  content: PageContent | null;
  onChange: (content: PageContent) => void;
  onImageUpload?: (file: File) => Promise<string>;
}

const sectionTypeLabels: Record<PageSectionType, { label: string; icon: React.ReactNode }> = {
  hero: { label: "히어로 섹션", icon: <Layout className="w-4 h-4" /> },
  hero_advanced: { label: "고급 히어로 (통계)", icon: <Sparkles className="w-4 h-4" /> },
  heading: { label: "제목", icon: <Heading className="w-4 h-4" /> },
  text: { label: "텍스트", icon: <Type className="w-4 h-4" /> },
  image: { label: "이미지", icon: <ImageIcon className="w-4 h-4" /> },
  image_text: { label: "이미지+텍스트", icon: <LayoutGrid className="w-4 h-4" /> },
  text_image: { label: "텍스트+이미지", icon: <LayoutGrid className="w-4 h-4" /> },
  button: { label: "버튼", icon: <MousePointer className="w-4 h-4" /> },
  divider: { label: "구분선", icon: <Minus className="w-4 h-4" /> },
  cards: { label: "카드 그리드", icon: <Grid3X3 className="w-4 h-4" /> },
  features: { label: "기능 소개", icon: <Star className="w-4 h-4" /> },
  video_gallery: { label: "비디오 갤러리", icon: <Play className="w-4 h-4" /> },
  stats_cards: { label: "통계 카드", icon: <BarChart3 className="w-4 h-4" /> },
  icon_cards: { label: "아이콘 카드", icon: <Zap className="w-4 h-4" /> },
  cta: { label: "CTA (행동유도)", icon: <Megaphone className="w-4 h-4" /> },
  cta_advanced: { label: "고급 CTA (혜택)", icon: <Sparkles className="w-4 h-4" /> },
  hero_slider: { label: "히어로 슬라이더", icon: <Layout className="w-4 h-4" /> },
  announcement_marquee: { label: "공지 마퀴", icon: <Megaphone className="w-4 h-4" /> },
  content_two_blocks: { label: "2단 콘텐츠 블록", icon: <LayoutGrid className="w-4 h-4" /> },
};

function generateId() {
  return `section-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function getDefaultSectionData(type: PageSectionType): PageSection["data"] {
  switch (type) {
    case "hero":
      return {
        title: "환영합니다",
        subtitle: "최고의 서비스를 제공합니다",
        text: "여기에 설명 텍스트를 입력하세요.",
        imageUrl: "",
        buttonText: "자세히 보기",
        buttonLink: "#",
      };
    case "heading":
      return { title: "제목을 입력하세요" };
    case "text":
      return { text: "여기에 텍스트를 입력하세요." };
    case "image":
      return { imageUrl: "", imageAlt: "이미지 설명" };
    case "button":
      return { buttonText: "버튼 텍스트", buttonLink: "#" };
    case "divider":
      return {};
    case "cards":
      return {
        title: "카드 섹션",
        items: [
          { id: generateId(), title: "카드 1", description: "설명 1" },
          { id: generateId(), title: "카드 2", description: "설명 2" },
          { id: generateId(), title: "카드 3", description: "설명 3" },
        ],
      };
    case "features":
      return {
        title: "주요 기능",
        items: [
          { id: generateId(), title: "기능 1", description: "기능 1 설명", icon: "Star" },
          { id: generateId(), title: "기능 2", description: "기능 2 설명", icon: "Heart" },
        ],
      };
    case "cta":
      return {
        title: "지금 시작하세요",
        text: "무료로 가입하고 모든 기능을 이용해 보세요.",
        buttonText: "시작하기",
        buttonLink: "/register",
      };
    case "hero_advanced":
      return {
        title: "메인 타이틀",
        subtitle: "서브 타이틀",
        description: "설명 텍스트",
        buttonText: "시작하기",
        buttonLink: "/register",
        secondaryButtonText: "둘러보기",
        secondaryButtonLink: "/guide",
        promoBadge: "프로모션 배지 텍스트",
        backgroundImage: "",
        stats: [
          { value: "30", suffix: "년", label: "경력", color: "var(--ts-accent-green)" },
          { value: "500", suffix: "+", label: "파트너", color: "var(--ts-accent-green)" },
          { value: "98", suffix: "%", label: "만족도", color: "var(--ts-accent-green)" },
        ],
      };
    case "image_text":
    case "text_image":
      return {
        theme: "light",
        layout: type === "image_text" ? "image-text" : "text-image",
        sectionSubtitle: "SECTION SUBTITLE",
        sectionTitle: "섹션 제목",
        sectionDescription: "섹션 설명 텍스트",
        imageUrl: "",
        imageAlt: "이미지 설명",
        title: "콘텐츠 제목",
        paragraphs: [
          "첫 번째 문단 텍스트입니다.",
          "두 번째 문단 텍스트입니다.",
          "세 번째 문단 텍스트입니다.",
        ],
      };
    case "video_gallery":
      return {
        subtitle: "VIDEO GALLERY",
        title: "비디오 갤러리",
        description: "비디오 설명 텍스트",
        videos: [
          { id: "dQw4w9WgXcQ", thumbnail: "" },
          { id: "dQw4w9WgXcQ", thumbnail: "" },
          { id: "dQw4w9WgXcQ", thumbnail: "" },
        ],
      };
    case "stats_cards":
      return {
        theme: "dark",
        subtitle: "STATS",
        title: "통계 섹션 제목",
        description: "통계 섹션 설명",
        stats: [
          { value: "10K", label: "첫 번째 통계", color: "var(--ts-primary)" },
          { value: "6K", label: "두 번째 통계", color: "var(--ts-accent-orange)" },
          { value: "D+1", label: "세 번째 통계", color: "var(--ts-accent-green)" },
        ],
      };
    case "icon_cards":
      return {
        theme: "dark",
        subtitle: "FEATURES",
        title: "아이콘 카드 섹션",
        description: "섹션 설명 텍스트",
        items: [
          { icon: "Tag", iconBg: "rgba(93,122,242,0.2)", title: "기능 1", description: "설명 1" },
          { icon: "CreditCard", iconBg: "rgba(255,107,0,0.2)", title: "기능 2", description: "설명 2" },
          { icon: "TrendingUp", iconBg: "rgba(16,185,129,0.2)", title: "기능 3", description: "설명 3" },
          { icon: "Wallet", iconBg: "rgba(139,92,246,0.2)", title: "기능 4", description: "설명 4" },
        ],
      };
    case "cta_advanced":
      return {
        title: "CTA 제목",
        description: "CTA 설명 텍스트",
        buttonText: "메인 버튼",
        buttonLink: "/register",
        secondaryButtonText: "보조 버튼",
        secondaryButtonLink: "/contact",
        promoBadge: "프로모션 배지",
        benefits: ["혜택 1", "혜택 2", "혜택 3", "혜택 4"],
      };
    case "hero_slider":
      return {
        slides: [
          { id: generateId(), imageUrl: "", imageAlt: "슬라이드 1" },
          { id: generateId(), imageUrl: "", imageAlt: "슬라이드 2" },
        ],
        autoPlay: true,
        slideDuration: 5000,
        buttonText: "시작하기",
        buttonLink: "/register",
      };
    case "announcement_marquee":
      return {};
    case "content_two_blocks":
      return {
        block1Bg: "#FFFFFF",
        block2Bg: "#F3F4F6",
        block1: { label: "LABEL", title: "블록 1 제목", description: "블록 1 설명", items: ["항목 1", "항목 2"] },
        block2: { label: "LABEL", title: "블록 2 제목", description: "블록 2 설명", items: ["항목 1", "항목 2"] },
      };
    default:
      return {};
  }
}

export function PageContentEditor({ content, onChange, onImageUpload }: PageContentEditorProps) {
  const [addSectionDialog, setAddSectionDialog] = useState(false);
  const [editSectionDialog, setEditSectionDialog] = useState<{ open: boolean; section: PageSection | null }>({
    open: false,
    section: null,
  });
  const [editFormData, setEditFormData] = useState<PageSection["data"]>({});

  const sections = content?.sections || [];

  const addSection = (type: PageSectionType) => {
    const newSection: PageSection = {
      id: generateId(),
      type,
      order: sections.length,
      data: getDefaultSectionData(type),
    };
    
    const newSections = [...sections, newSection];
    onChange({
      ...content,
      sections: newSections,
    });
    setAddSectionDialog(false);
  };

  const removeSection = (id: string) => {
    const newSections = sections.filter((s) => s.id !== id).map((s, i) => ({ ...s, order: i }));
    onChange({
      ...content,
      sections: newSections,
    });
  };

  const moveSection = (id: string, direction: "up" | "down") => {
    const index = sections.findIndex((s) => s.id === id);
    if (index === -1) return;
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === sections.length - 1) return;

    const newSections = [...sections];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    [newSections[index], newSections[targetIndex]] = [newSections[targetIndex], newSections[index]];
    
    onChange({
      ...content,
      sections: newSections.map((s, i) => ({ ...s, order: i })),
    });
  };

  const openEditDialog = (section: PageSection) => {
    setEditFormData({ ...section.data });
    setEditSectionDialog({ open: true, section });
  };

  const saveSection = () => {
    if (!editSectionDialog.section) return;
    
    const newSections = sections.map((s) =>
      s.id === editSectionDialog.section!.id ? { ...s, data: editFormData } : s
    );
    onChange({
      ...content,
      sections: newSections,
    });
    setEditSectionDialog({ open: false, section: null });
  };

  const updateItemInSection = (itemIndex: number, field: string, value: string) => {
    if (!editFormData.items) return;
    const newItems = [...editFormData.items];
    newItems[itemIndex] = { ...newItems[itemIndex], [field]: value };
    setEditFormData({ ...editFormData, items: newItems });
  };

  const addItemToSection = () => {
    const newItems = [
      ...(editFormData.items || []),
      { id: generateId(), title: "새 항목", description: "" },
    ];
    setEditFormData({ ...editFormData, items: newItems });
  };

  const removeItemFromSection = (itemIndex: number) => {
    const newItems = editFormData.items?.filter((_, i) => i !== itemIndex) || [];
    setEditFormData({ ...editFormData, items: newItems });
  };

  // Stats array management
  const updateStatInSection = (statIndex: number, field: string, value: string) => {
    if (!editFormData.stats) return;
    const newStats = [...editFormData.stats];
    newStats[statIndex] = { ...newStats[statIndex], [field]: value };
    setEditFormData({ ...editFormData, stats: newStats });
  };

  const addStatToSection = () => {
    const newStats = [
      ...(editFormData.stats || []),
      { value: "0", suffix: "", label: "새 통계", color: "var(--ts-primary)" },
    ];
    setEditFormData({ ...editFormData, stats: newStats });
  };

  const removeStatFromSection = (statIndex: number) => {
    const newStats = editFormData.stats?.filter((_, i) => i !== statIndex) || [];
    setEditFormData({ ...editFormData, stats: newStats });
  };

  // Paragraphs array management
  const updateParagraph = (index: number, value: string) => {
    const newParagraphs = [...(editFormData.paragraphs || [])];
    newParagraphs[index] = value;
    setEditFormData({ ...editFormData, paragraphs: newParagraphs });
  };

  const addParagraph = () => {
    const newParagraphs = [...(editFormData.paragraphs || []), "새 문단 텍스트"];
    setEditFormData({ ...editFormData, paragraphs: newParagraphs });
  };

  const removeParagraph = (index: number) => {
    const newParagraphs = editFormData.paragraphs?.filter((_, i) => i !== index) || [];
    setEditFormData({ ...editFormData, paragraphs: newParagraphs });
  };

  // Benefits array management
  const updateBenefit = (index: number, value: string) => {
    const newBenefits = [...(editFormData.benefits || [])];
    newBenefits[index] = value;
    setEditFormData({ ...editFormData, benefits: newBenefits });
  };

  const addBenefit = () => {
    const newBenefits = [...(editFormData.benefits || []), "새 혜택"];
    setEditFormData({ ...editFormData, benefits: newBenefits });
  };

  const removeBenefit = (index: number) => {
    const newBenefits = editFormData.benefits?.filter((_, i) => i !== index) || [];
    setEditFormData({ ...editFormData, benefits: newBenefits });
  };

  // Videos array management
  const updateVideo = (index: number, field: string, value: string) => {
    if (!editFormData.videos) return;
    const newVideos = [...editFormData.videos];
    newVideos[index] = { ...newVideos[index], [field]: value };
    setEditFormData({ ...editFormData, videos: newVideos });
  };

  const addVideo = () => {
    const newVideos = [
      ...(editFormData.videos || []),
      { id: "", thumbnail: "" },
    ];
    setEditFormData({ ...editFormData, videos: newVideos });
  };

  const removeVideo = (index: number) => {
    const newVideos = editFormData.videos?.filter((_, i) => i !== index) || [];
    setEditFormData({ ...editFormData, videos: newVideos });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">페이지 콘텐츠</h3>
          <p className="text-sm text-muted-foreground">섹션을 추가하고 편집하세요</p>
        </div>
        <Button onClick={() => setAddSectionDialog(true)} size="sm" data-testid="button-add-section">
          <Plus className="w-4 h-4 mr-2" />
          섹션 추가
        </Button>
      </div>

      {sections.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Layout className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">아직 콘텐츠가 없습니다</p>
            <Button onClick={() => setAddSectionDialog(true)} variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              첫 번째 섹션 추가
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {sections.map((section, index) => {
            // Support both flat (section.title) and nested (section.data.title) structures
            const sectionData = section.data || section;
            const sectionTitle = sectionData.title || sectionData.subtitle || "";
            
            return (
            <Card key={section.id} className="hover-elevate">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="text-muted-foreground">
                  <GripVertical className="w-4 h-4" />
                </div>
                <div className="flex-1 flex items-center gap-2">
                  {sectionTypeLabels[section.type].icon}
                  <span className="font-medium">{sectionTypeLabels[section.type].label}</span>
                  {sectionTitle && (
                    <span className="text-sm text-muted-foreground truncate max-w-[200px]">
                      - {sectionTitle}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => moveSection(section.id, "up")}
                    disabled={index === 0}
                    data-testid={`button-move-up-${section.id}`}
                  >
                    <ChevronUp className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => moveSection(section.id, "down")}
                    disabled={index === sections.length - 1}
                    data-testid={`button-move-down-${section.id}`}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => openEditDialog(section)}
                    data-testid={`button-edit-${section.id}`}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => removeSection(section.id)}
                    className="text-destructive hover:text-destructive"
                    data-testid={`button-delete-${section.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
          })}
        </div>
      )}

      {/* Add Section Dialog */}
      <Dialog open={addSectionDialog} onOpenChange={setAddSectionDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>섹션 추가</DialogTitle>
            <DialogDescription>추가할 섹션 타입을 선택하세요</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            {pageSectionTypes.map((type) => (
              <Button
                key={type}
                variant="outline"
                className="h-auto py-3 flex flex-col gap-1"
                onClick={() => addSection(type)}
                data-testid={`button-add-${type}`}
              >
                {sectionTypeLabels[type].icon}
                <span className="text-xs">{sectionTypeLabels[type].label}</span>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Section Dialog */}
      <Dialog open={editSectionDialog.open} onOpenChange={(open) => setEditSectionDialog({ open, section: open ? editSectionDialog.section : null })}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editSectionDialog.section && sectionTypeLabels[editSectionDialog.section.type].label} 편집
            </DialogTitle>
            <DialogDescription>섹션 내용을 수정하세요</DialogDescription>
          </DialogHeader>
          
          {editSectionDialog.section && (
            <div className="space-y-4">
              {(editSectionDialog.section.type === "hero" || 
                editSectionDialog.section.type === "heading" || 
                editSectionDialog.section.type === "cta" ||
                editSectionDialog.section.type === "cards" ||
                editSectionDialog.section.type === "features") && (
                <div>
                  <Label>제목</Label>
                  <Input
                    value={editFormData.title || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                    placeholder="제목 입력"
                    data-testid="input-section-title"
                  />
                </div>
              )}

              {editSectionDialog.section.type === "hero" && (
                <div>
                  <Label>부제목</Label>
                  <Input
                    value={editFormData.subtitle || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, subtitle: e.target.value })}
                    placeholder="부제목 입력"
                    data-testid="input-section-subtitle"
                  />
                </div>
              )}

              {(editSectionDialog.section.type === "text" || 
                editSectionDialog.section.type === "hero" ||
                editSectionDialog.section.type === "cta") && (
                <div>
                  <Label>텍스트</Label>
                  <Textarea
                    value={editFormData.text || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, text: e.target.value })}
                    placeholder="텍스트 입력"
                    rows={4}
                    data-testid="input-section-text"
                  />
                </div>
              )}

              {(editSectionDialog.section.type === "image" || editSectionDialog.section.type === "hero") && (
                <>
                  <div>
                    <Label>이미지 URL</Label>
                    <Input
                      value={editFormData.imageUrl || ""}
                      onChange={(e) => setEditFormData({ ...editFormData, imageUrl: e.target.value })}
                      placeholder="https://example.com/image.jpg"
                      data-testid="input-section-image-url"
                    />
                  </div>
                  <div>
                    <Label>이미지 설명 (Alt)</Label>
                    <Input
                      value={editFormData.imageAlt || ""}
                      onChange={(e) => setEditFormData({ ...editFormData, imageAlt: e.target.value })}
                      placeholder="이미지 설명"
                      data-testid="input-section-image-alt"
                    />
                  </div>
                </>
              )}

              {(editSectionDialog.section.type === "button" || 
                editSectionDialog.section.type === "hero" ||
                editSectionDialog.section.type === "cta") && (
                <>
                  <div>
                    <Label>버튼 텍스트</Label>
                    <Input
                      value={editFormData.buttonText || ""}
                      onChange={(e) => setEditFormData({ ...editFormData, buttonText: e.target.value })}
                      placeholder="버튼 텍스트"
                      data-testid="input-section-button-text"
                    />
                  </div>
                  <div>
                    <Label>버튼 링크</Label>
                    <Input
                      value={editFormData.buttonLink || ""}
                      onChange={(e) => setEditFormData({ ...editFormData, buttonLink: e.target.value })}
                      placeholder="/page-path 또는 https://..."
                      data-testid="input-section-button-link"
                    />
                  </div>
                </>
              )}

              {(editSectionDialog.section.type === "cards" || editSectionDialog.section.type === "features") && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>항목</Label>
                    <Button size="sm" variant="outline" onClick={addItemToSection}>
                      <Plus className="w-3 h-3 mr-1" />
                      항목 추가
                    </Button>
                  </div>
                  {editFormData.items?.map((item, idx) => (
                    <Card key={item.id || idx} className="p-3">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">항목 {idx + 1}</span>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => removeItemFromSection(idx)}
                            className="h-6 w-6 text-destructive"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                        <Input
                          value={item.title || ""}
                          onChange={(e) => updateItemInSection(idx, "title", e.target.value)}
                          placeholder="제목"
                          className="h-8"
                        />
                        <Textarea
                          value={item.description || ""}
                          onChange={(e) => updateItemInSection(idx, "description", e.target.value)}
                          placeholder="설명"
                          rows={2}
                        />
                        {editSectionDialog.section?.type === "features" && (
                          <Input
                            value={item.icon || ""}
                            onChange={(e) => updateItemInSection(idx, "icon", e.target.value)}
                            placeholder="아이콘 이름 (예: Star, Heart)"
                            className="h-8"
                          />
                        )}
                        {editSectionDialog.section?.type === "cards" && (
                          <Input
                            value={item.imageUrl || ""}
                            onChange={(e) => updateItemInSection(idx, "imageUrl", e.target.value)}
                            placeholder="이미지 URL"
                            className="h-8"
                          />
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {/* Hero Advanced Section */}
              {editSectionDialog.section.type === "hero_advanced" && (
                <>
                  <div>
                    <Label>제목</Label>
                    <Input
                      value={editFormData.title || ""}
                      onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                      placeholder="메인 타이틀 (HTML 지원)"
                    />
                  </div>
                  <div>
                    <Label>부제목</Label>
                    <Input
                      value={editFormData.subtitle || ""}
                      onChange={(e) => setEditFormData({ ...editFormData, subtitle: e.target.value })}
                      placeholder="서브 타이틀"
                    />
                  </div>
                  <div>
                    <Label>설명</Label>
                    <Textarea
                      value={editFormData.description || ""}
                      onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                      placeholder="설명 텍스트"
                      rows={2}
                    />
                  </div>
                  <div>
                    <Label>프로모션 배지</Label>
                    <Input
                      value={editFormData.promoBadge || ""}
                      onChange={(e) => setEditFormData({ ...editFormData, promoBadge: e.target.value })}
                      placeholder="예: 지금 가입하면 10% 할인"
                    />
                  </div>
                  <div>
                    <Label>배경 이미지 URL</Label>
                    <Input
                      value={editFormData.backgroundImage || ""}
                      onChange={(e) => setEditFormData({ ...editFormData, backgroundImage: e.target.value })}
                      placeholder="https://..."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>메인 버튼</Label>
                      <Input
                        value={editFormData.buttonText || ""}
                        onChange={(e) => setEditFormData({ ...editFormData, buttonText: e.target.value })}
                        placeholder="버튼 텍스트"
                        className="mb-1"
                      />
                      <Input
                        value={editFormData.buttonLink || ""}
                        onChange={(e) => setEditFormData({ ...editFormData, buttonLink: e.target.value })}
                        placeholder="링크"
                      />
                    </div>
                    <div>
                      <Label>보조 버튼</Label>
                      <Input
                        value={editFormData.secondaryButtonText || ""}
                        onChange={(e) => setEditFormData({ ...editFormData, secondaryButtonText: e.target.value })}
                        placeholder="버튼 텍스트"
                        className="mb-1"
                      />
                      <Input
                        value={editFormData.secondaryButtonLink || ""}
                        onChange={(e) => setEditFormData({ ...editFormData, secondaryButtonLink: e.target.value })}
                        placeholder="링크"
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>통계 카운터</Label>
                      <Button size="sm" variant="outline" onClick={addStatToSection}>
                        <Plus className="w-3 h-3 mr-1" />
                        통계 추가
                      </Button>
                    </div>
                    {editFormData.stats?.map((stat, idx) => (
                      <Card key={idx} className="p-3">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">통계 {idx + 1}</span>
                            <Button size="icon" variant="ghost" onClick={() => removeStatFromSection(idx)} className="h-6 w-6 text-destructive">
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <Input value={stat.value} onChange={(e) => updateStatInSection(idx, "value", e.target.value)} placeholder="값 (예: 30)" className="h-8" />
                            <Input value={stat.suffix || ""} onChange={(e) => updateStatInSection(idx, "suffix", e.target.value)} placeholder="접미사 (예: 년, +, %)" className="h-8" />
                          </div>
                          <Input value={stat.label} onChange={(e) => updateStatInSection(idx, "label", e.target.value)} placeholder="라벨" className="h-8" />
                        </div>
                      </Card>
                    ))}
                  </div>
                </>
              )}

              {/* Image Text / Text Image Section */}
              {(editSectionDialog.section.type === "image_text" || editSectionDialog.section.type === "text_image") && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>테마</Label>
                      <Select value={editFormData.theme || "light"} onValueChange={(v) => setEditFormData({ ...editFormData, theme: v as "light" | "dark" })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="light">밝은 배경</SelectItem>
                          <SelectItem value="dark">어두운 배경</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>레이아웃</Label>
                      <Select value={editFormData.layout || "image-text"} onValueChange={(v) => setEditFormData({ ...editFormData, layout: v as "image-text" | "text-image" })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="image-text">이미지 → 텍스트</SelectItem>
                          <SelectItem value="text-image">텍스트 → 이미지</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>섹션 서브타이틀</Label>
                    <Input value={editFormData.sectionSubtitle || ""} onChange={(e) => setEditFormData({ ...editFormData, sectionSubtitle: e.target.value })} placeholder="WHY TOPSEL" />
                  </div>
                  <div>
                    <Label>섹션 제목</Label>
                    <Input value={editFormData.sectionTitle || ""} onChange={(e) => setEditFormData({ ...editFormData, sectionTitle: e.target.value })} placeholder="섹션 메인 제목" />
                  </div>
                  <div>
                    <Label>섹션 설명</Label>
                    <Textarea value={editFormData.sectionDescription || ""} onChange={(e) => setEditFormData({ ...editFormData, sectionDescription: e.target.value })} placeholder="섹션 설명" rows={2} />
                  </div>
                  <div>
                    <Label>이미지 URL</Label>
                    <Input value={editFormData.imageUrl || ""} onChange={(e) => setEditFormData({ ...editFormData, imageUrl: e.target.value })} placeholder="https://..." />
                  </div>
                  <div>
                    <Label>콘텐츠 제목</Label>
                    <Input value={editFormData.title || ""} onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })} placeholder="콘텐츠 영역 제목" />
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>문단</Label>
                      <Button size="sm" variant="outline" onClick={addParagraph}>
                        <Plus className="w-3 h-3 mr-1" />
                        문단 추가
                      </Button>
                    </div>
                    {editFormData.paragraphs?.map((p, idx) => (
                      <div key={idx} className="flex gap-2">
                        <Textarea value={p} onChange={(e) => updateParagraph(idx, e.target.value)} rows={2} className="flex-1" />
                        <Button size="icon" variant="ghost" onClick={() => removeParagraph(idx)} className="text-destructive h-8 w-8">
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Video Gallery Section */}
              {editSectionDialog.section.type === "video_gallery" && (
                <>
                  <div>
                    <Label>서브타이틀</Label>
                    <Input value={editFormData.subtitle || ""} onChange={(e) => setEditFormData({ ...editFormData, subtitle: e.target.value })} placeholder="CUSTOMER STORIES" />
                  </div>
                  <div>
                    <Label>제목</Label>
                    <Input value={editFormData.title || ""} onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })} placeholder="비디오 갤러리 제목" />
                  </div>
                  <div>
                    <Label>설명</Label>
                    <Textarea value={editFormData.description || ""} onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })} rows={2} />
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>비디오 (YouTube)</Label>
                      <Button size="sm" variant="outline" onClick={addVideo}>
                        <Plus className="w-3 h-3 mr-1" />
                        비디오 추가
                      </Button>
                    </div>
                    {editFormData.videos?.map((video, idx) => (
                      <Card key={idx} className="p-3">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">비디오 {idx + 1}</span>
                            <Button size="icon" variant="ghost" onClick={() => removeVideo(idx)} className="h-6 w-6 text-destructive">
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                          <Input value={video.id} onChange={(e) => updateVideo(idx, "id", e.target.value)} placeholder="YouTube Video ID" className="h-8" />
                          <Input value={video.thumbnail || ""} onChange={(e) => updateVideo(idx, "thumbnail", e.target.value)} placeholder="썸네일 URL (선택)" className="h-8" />
                        </div>
                      </Card>
                    ))}
                  </div>
                </>
              )}

              {/* Stats Cards Section */}
              {editSectionDialog.section.type === "stats_cards" && (
                <>
                  <div>
                    <Label>테마</Label>
                    <Select value={editFormData.theme || "dark"} onValueChange={(v) => setEditFormData({ ...editFormData, theme: v as "light" | "dark" })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">밝은 배경</SelectItem>
                        <SelectItem value="dark">어두운 배경</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>서브타이틀</Label>
                    <Input value={editFormData.subtitle || ""} onChange={(e) => setEditFormData({ ...editFormData, subtitle: e.target.value })} placeholder="DELIVERY SYSTEM" />
                  </div>
                  <div>
                    <Label>제목</Label>
                    <Input value={editFormData.title || ""} onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })} />
                  </div>
                  <div>
                    <Label>설명</Label>
                    <Textarea value={editFormData.description || ""} onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })} rows={2} />
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>통계 카드</Label>
                      <Button size="sm" variant="outline" onClick={addStatToSection}>
                        <Plus className="w-3 h-3 mr-1" />
                        통계 추가
                      </Button>
                    </div>
                    {editFormData.stats?.map((stat, idx) => (
                      <Card key={idx} className="p-3">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">통계 {idx + 1}</span>
                            <Button size="icon" variant="ghost" onClick={() => removeStatFromSection(idx)} className="h-6 w-6 text-destructive">
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                          <Input value={stat.value} onChange={(e) => updateStatInSection(idx, "value", e.target.value)} placeholder="값 (예: 10K)" className="h-8" />
                          <Input value={stat.label} onChange={(e) => updateStatInSection(idx, "label", e.target.value)} placeholder="라벨" className="h-8" />
                        </div>
                      </Card>
                    ))}
                  </div>
                </>
              )}

              {/* Icon Cards Section */}
              {editSectionDialog.section.type === "icon_cards" && (
                <>
                  <div>
                    <Label>테마</Label>
                    <Select value={editFormData.theme || "dark"} onValueChange={(v) => setEditFormData({ ...editFormData, theme: v as "light" | "dark" })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">밝은 배경</SelectItem>
                        <SelectItem value="dark">어두운 배경</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>서브타이틀</Label>
                    <Input value={editFormData.subtitle || ""} onChange={(e) => setEditFormData({ ...editFormData, subtitle: e.target.value })} placeholder="SPECIAL BENEFITS" />
                  </div>
                  <div>
                    <Label>제목</Label>
                    <Input value={editFormData.title || ""} onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })} />
                  </div>
                  <div>
                    <Label>설명</Label>
                    <Textarea value={editFormData.description || ""} onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })} rows={2} />
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>아이콘 카드</Label>
                      <Button size="sm" variant="outline" onClick={addItemToSection}>
                        <Plus className="w-3 h-3 mr-1" />
                        카드 추가
                      </Button>
                    </div>
                    {editFormData.items?.map((item, idx) => (
                      <Card key={idx} className="p-3">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">카드 {idx + 1}</span>
                            <Button size="icon" variant="ghost" onClick={() => removeItemFromSection(idx)} className="h-6 w-6 text-destructive">
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                          <Input value={item.icon || ""} onChange={(e) => updateItemInSection(idx, "icon", e.target.value)} placeholder="아이콘 (Tag, CreditCard, TrendingUp, Wallet 등)" className="h-8" />
                          <Input value={item.iconBg || ""} onChange={(e) => updateItemInSection(idx, "iconBg", e.target.value)} placeholder="아이콘 배경색 (예: rgba(93,122,242,0.2))" className="h-8" />
                          <Input value={item.title || ""} onChange={(e) => updateItemInSection(idx, "title", e.target.value)} placeholder="제목" className="h-8" />
                          <Input value={item.description || ""} onChange={(e) => updateItemInSection(idx, "description", e.target.value)} placeholder="설명" className="h-8" />
                        </div>
                      </Card>
                    ))}
                  </div>
                </>
              )}

              {/* CTA Advanced Section */}
              {editSectionDialog.section.type === "cta_advanced" && (
                <>
                  <div>
                    <Label>프로모션 배지</Label>
                    <Input value={editFormData.promoBadge || ""} onChange={(e) => setEditFormData({ ...editFormData, promoBadge: e.target.value })} placeholder="프로모션 텍스트" />
                  </div>
                  <div>
                    <Label>제목</Label>
                    <Input value={editFormData.title || ""} onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })} />
                  </div>
                  <div>
                    <Label>설명</Label>
                    <Textarea value={editFormData.description || ""} onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })} rows={2} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>메인 버튼</Label>
                      <Input value={editFormData.buttonText || ""} onChange={(e) => setEditFormData({ ...editFormData, buttonText: e.target.value })} placeholder="버튼 텍스트" className="mb-1" />
                      <Input value={editFormData.buttonLink || ""} onChange={(e) => setEditFormData({ ...editFormData, buttonLink: e.target.value })} placeholder="링크" />
                    </div>
                    <div>
                      <Label>보조 버튼</Label>
                      <Input value={editFormData.secondaryButtonText || ""} onChange={(e) => setEditFormData({ ...editFormData, secondaryButtonText: e.target.value })} placeholder="버튼 텍스트" className="mb-1" />
                      <Input value={editFormData.secondaryButtonLink || ""} onChange={(e) => setEditFormData({ ...editFormData, secondaryButtonLink: e.target.value })} placeholder="링크" />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>혜택 목록</Label>
                      <Button size="sm" variant="outline" onClick={addBenefit}>
                        <Plus className="w-3 h-3 mr-1" />
                        혜택 추가
                      </Button>
                    </div>
                    {editFormData.benefits?.map((benefit, idx) => (
                      <div key={idx} className="flex gap-2">
                        <Input value={benefit} onChange={(e) => updateBenefit(idx, e.target.value)} placeholder="혜택 텍스트" className="flex-1" />
                        <Button size="icon" variant="ghost" onClick={() => removeBenefit(idx)} className="text-destructive h-8 w-8">
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSectionDialog({ open: false, section: null })}>
              취소
            </Button>
            <Button onClick={saveSection} data-testid="button-save-section">
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
