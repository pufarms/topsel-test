import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Upload, Trash2, Copy, ImageIcon, Plus, X, AlertCircle, Settings2, FolderPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { imageCategories, type Image, type ImageSubcategory } from "@shared/schema";

function ImageThumbnail({ 
  src, 
  alt, 
  className,
  onLoad 
}: { 
  src: string; 
  alt: string; 
  className?: string;
  onLoad?: (e: React.SyntheticEvent<HTMLImageElement>) => void;
}) {
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  if (error) {
    return (
      <div className={`flex flex-col items-center justify-center bg-muted text-muted-foreground ${className}`}>
        <AlertCircle className="h-6 w-6 mb-1 opacity-50" />
        <span className="text-xs">로드 실패</span>
      </div>
    );
  }

  return (
    <>
      {loading && (
        <div className={`flex items-center justify-center bg-muted ${className}`}>
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )}
      <img
        src={src}
        alt={alt}
        className={`${className} ${loading ? 'hidden' : ''}`}
        onLoad={(e) => {
          setLoading(false);
          onLoad?.(e);
        }}
        onError={() => { setError(true); setLoading(false); }}
      />
    </>
  );
}

export default function AdminGallery() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>("all");
  const [uploadCategory, setUploadCategory] = useState<string>("기타");
  const [uploadSubcategory, setUploadSubcategory] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const [deleteImageId, setDeleteImageId] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<Image | null>(null);
  const [showSubcategoryManager, setShowSubcategoryManager] = useState(false);
  const [newSubcategoryName, setNewSubcategoryName] = useState("");
  const [newSubcategoryCategory, setNewSubcategoryCategory] = useState<string>("배너");

  const { data: images = [], isLoading } = useQuery<Image[]>({
    queryKey: ["/api/admin/images", selectedCategory === "all" ? "" : selectedCategory],
    queryFn: async () => {
      const url = selectedCategory === "all" 
        ? "/api/admin/images" 
        : `/api/admin/images?category=${encodeURIComponent(selectedCategory)}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch images");
      return res.json();
    },
  });

  const { data: subcategories = [] } = useQuery<ImageSubcategory[]>({
    queryKey: ["/api/admin/subcategories"],
    queryFn: async () => {
      const res = await fetch("/api/admin/subcategories", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch subcategories");
      return res.json();
    },
  });

  const filteredImages = images.filter(img => {
    if (selectedSubcategory !== "all" && img.subcategory !== selectedSubcategory) {
      return false;
    }
    return true;
  });

  const categorySubcategories = subcategories.filter(s => 
    selectedCategory === "all" || s.category === selectedCategory
  );
  
  const uploadCategorySubcategories = subcategories.filter(s => s.category === uploadCategory);

  const getImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.onload = () => {
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
        URL.revokeObjectURL(img.src);
      };
      img.onerror = () => resolve({ width: 0, height: 0 });
      img.src = URL.createObjectURL(file);
    });
  };

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const dims = await getImageDimensions(file);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", uploadCategory);
      if (uploadSubcategory) {
        formData.append("subcategory", uploadSubcategory);
      }
      formData.append("width", dims.width.toString());
      formData.append("height", dims.height.toString());
      
      const res = await fetch("/api/admin/images", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!res.ok) throw new Error("Upload failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/images"] });
      toast({ title: "업로드 완료", description: "이미지가 업로드되었습니다." });
    },
    onError: () => {
      toast({ variant: "destructive", title: "업로드 실패", description: "이미지 업로드에 실패했습니다." });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/images/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/images"] });
      toast({ title: "삭제 완료", description: "이미지가 삭제되었습니다." });
      setDeleteImageId(null);
    },
    onError: () => {
      toast({ variant: "destructive", title: "삭제 실패", description: "이미지 삭제에 실패했습니다." });
    },
  });

  const createSubcategoryMutation = useMutation({
    mutationFn: async (data: { name: string; category: string }) => {
      const res = await apiRequest("POST", "/api/admin/subcategories", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subcategories"] });
      setNewSubcategoryName("");
      toast({ title: "생성 완료", description: "세부 카테고리가 추가되었습니다." });
    },
    onError: () => {
      toast({ variant: "destructive", title: "생성 실패" });
    },
  });

  const deleteSubcategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/subcategories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subcategories"] });
      toast({ title: "삭제 완료" });
    },
  });

  const seedIconsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/images/seed-icons");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/images"] });
      toast({ title: "기본 아이콘 생성 완료", description: data.message });
    },
    onError: () => {
      toast({ variant: "destructive", title: "아이콘 생성 실패" });
    },
  });

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    files.forEach(file => {
      if (file.type.startsWith("image/")) {
        uploadMutation.mutate(file);
      }
    });
  }, [uploadMutation]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      if (file.type.startsWith("image/")) {
        uploadMutation.mutate(file);
      }
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast({ title: "복사 완료", description: "URL이 클립보드에 복사되었습니다." });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-xl md:text-2xl font-bold">이미지 갤러리</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowSubcategoryManager(true)}
          data-testid="button-manage-subcategories"
        >
          <Settings2 className="h-4 w-4 mr-2" />
          <span className="hidden sm:inline">세부 카테고리 관리</span>
          <span className="sm:hidden">관리</span>
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-4 border-b">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium whitespace-nowrap">업로드 카테고리:</span>
              <Select value={uploadCategory} onValueChange={(v) => { setUploadCategory(v); setUploadSubcategory(""); }}>
                <SelectTrigger className="w-28" data-testid="select-upload-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {imageCategories.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {uploadCategorySubcategories.length > 0 && (
                <Select value={uploadSubcategory || "__none__"} onValueChange={(v) => setUploadSubcategory(v === "__none__" ? "" : v)}>
                  <SelectTrigger className="w-32" data-testid="select-upload-subcategory">
                    <SelectValue placeholder="세부 카테고리" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">없음</SelectItem>
                    {uploadCategorySubcategories.map((sub) => (
                      <SelectItem key={sub.id} value={sub.name}>{sub.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileSelect}
              data-testid="input-file"
            />
            <Button 
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadMutation.isPending}
              data-testid="button-upload"
            >
              {uploadMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              이미지 업로드
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-3 mb-4">
            <span className="text-sm font-medium">필터:</span>
            <Select value={selectedCategory} onValueChange={(v) => { setSelectedCategory(v); setSelectedSubcategory("all"); }}>
              <SelectTrigger className="w-28" data-testid="select-filter-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                {imageCategories.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedCategory !== "all" && categorySubcategories.length > 0 && (
              <Select value={selectedSubcategory} onValueChange={setSelectedSubcategory}>
                <SelectTrigger className="w-32" data-testid="select-filter-subcategory">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  {categorySubcategories.map((sub) => (
                    <SelectItem key={sub.id} value={sub.name}>{sub.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div className="flex-1" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => seedIconsMutation.mutate()}
              disabled={seedIconsMutation.isPending}
              data-testid="button-seed-icons"
            >
              {seedIconsMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              기본 아이콘 생성
            </Button>
            <span className="text-sm text-muted-foreground">
              {filteredImages.length}개 이미지
            </span>
          </div>

          <div
            className={`min-h-[300px] rounded-lg transition-colors ${
              isDragging 
                ? "bg-primary/10 border-2 border-dashed border-primary" 
                : ""
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            data-testid="dropzone"
          >
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredImages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <ImageIcon className="h-16 w-16 mb-4 opacity-30" />
                <p className="text-lg mb-2">이미지를 드래그하여 업로드</p>
                <p className="text-sm">또는 위의 '파일 업로드' 버튼 클릭</p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                {filteredImages.map((image) => (
                  <div
                    key={image.id}
                    className="group relative w-[140px] h-[140px] rounded-md overflow-hidden border bg-muted cursor-pointer flex-shrink-0"
                    onClick={() => setSelectedImage(image)}
                    data-testid={`image-${image.id}`}
                  >
                    <ImageThumbnail
                      src={image.publicUrl}
                      alt={image.filename}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity p-2 flex flex-col">
                      <div className="flex-1 overflow-hidden">
                        <p className="text-white text-[10px] truncate mb-1">{image.filename}</p>
                        <p className="text-white/80 text-[10px]">
                          {(image.width && image.height) ? `${image.width} × ${image.height} px` : "크기 정보 없음"}
                        </p>
                        <p className="text-white/60 text-[10px]">{formatFileSize(image.fileSize)}</p>
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={(e) => { e.stopPropagation(); copyUrl(image.publicUrl); }}
                          data-testid={`button-copy-${image.id}`}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={(e) => { e.stopPropagation(); setDeleteImageId(image.id); }}
                          data-testid={`button-delete-${image.id}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                        <div className="flex-1" />
                        <Badge variant="secondary" className="text-[9px]">
                          {image.category}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>이미지 정보</DialogTitle>
          </DialogHeader>
          {selectedImage && (
            <div className="space-y-4">
              <ImageThumbnail
                src={selectedImage.publicUrl}
                alt={selectedImage.filename}
                className="w-full max-h-80 object-contain rounded-lg bg-muted"
              />
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">파일명:</span>
                  <p className="font-medium truncate">{selectedImage.filename}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">카테고리:</span>
                  <p className="font-medium">
                    {selectedImage.category}
                    {selectedImage.subcategory && ` / ${selectedImage.subcategory}`}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">파일 크기:</span>
                  <p className="font-medium">{formatFileSize(selectedImage.fileSize)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">원본 크기:</span>
                  <p className="font-medium">
                    {selectedImage.width && selectedImage.height 
                      ? `${selectedImage.width} × ${selectedImage.height} px` 
                      : "정보 없음"
                    }
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">업로드 날짜:</span>
                  <p className="font-medium">{formatDate(selectedImage.uploadedAt)}</p>
                </div>
              </div>
              <div>
                <span className="text-muted-foreground text-sm">URL:</span>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 text-xs bg-muted p-2 rounded truncate">
                    {selectedImage.publicUrl}
                  </code>
                  <Button size="sm" variant="outline" onClick={() => copyUrl(selectedImage.publicUrl)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteImageId} onOpenChange={() => setDeleteImageId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>이미지 삭제</DialogTitle>
            <DialogDescription>
              이 이미지를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteImageId(null)}>
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteImageId && deleteMutation.mutate(deleteImageId)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "삭제"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSubcategoryManager} onOpenChange={setShowSubcategoryManager}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>세부 카테고리 관리</DialogTitle>
            <DialogDescription>
              메인 카테고리별 세부 카테고리를 추가하거나 삭제합니다.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex gap-2">
              <Select value={newSubcategoryCategory} onValueChange={setNewSubcategoryCategory}>
                <SelectTrigger className="w-28" data-testid="select-new-subcategory-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {imageCategories.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="세부 카테고리 이름"
                value={newSubcategoryName}
                onChange={(e) => setNewSubcategoryName(e.target.value)}
                className="flex-1"
                data-testid="input-new-subcategory-name"
              />
              <Button
                size="icon"
                onClick={() => {
                  if (newSubcategoryName.trim()) {
                    createSubcategoryMutation.mutate({
                      name: newSubcategoryName.trim(),
                      category: newSubcategoryCategory,
                    });
                  }
                }}
                disabled={!newSubcategoryName.trim() || createSubcategoryMutation.isPending}
                data-testid="button-add-subcategory"
              >
                {createSubcategoryMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </Button>
            </div>

            <div className="max-h-[300px] overflow-y-auto space-y-2">
              {imageCategories.map((cat) => {
                const catSubs = subcategories.filter(s => s.category === cat);
                if (catSubs.length === 0) return null;
                return (
                  <div key={cat} className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">{cat}</p>
                    <div className="flex flex-wrap gap-2">
                      {catSubs.map((sub) => (
                        <Badge 
                          key={sub.id} 
                          variant="secondary"
                          className="gap-1"
                        >
                          {sub.name}
                          <span
                            className="ml-1 cursor-pointer opacity-60 hover:opacity-100"
                            onClick={() => deleteSubcategoryMutation.mutate(sub.id)}
                            data-testid={`button-delete-subcategory-${sub.id}`}
                          >
                            <X className="h-3 w-3" />
                          </span>
                        </Badge>
                      ))}
                    </div>
                  </div>
                );
              })}
              {subcategories.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  등록된 세부 카테고리가 없습니다
                </p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
