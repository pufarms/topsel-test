import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Upload, Trash2, Copy, ImageIcon, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { imageCategories, type Image } from "@shared/schema";

export default function AdminGallery() {
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [uploadCategory, setUploadCategory] = useState<string>("기타");
  const [isDragging, setIsDragging] = useState(false);
  const [deleteImageId, setDeleteImageId] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<Image | null>(null);

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

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", uploadCategory);
      
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
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">이미지 갤러리</h1>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>이미지 업로드</CardTitle>
            <CardDescription>드래그 앤 드롭 또는 파일 선택</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">카테고리</label>
              <Select value={uploadCategory} onValueChange={setUploadCategory}>
                <SelectTrigger data-testid="select-upload-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {imageCategories.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging 
                  ? "border-primary bg-primary/10" 
                  : "border-muted-foreground/25 hover:border-primary/50"
              }`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              data-testid="dropzone"
            >
              {uploadMutation.isPending ? (
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              ) : (
                <>
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground mb-2">
                    이미지를 드래그하거나
                  </p>
                  <label>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleFileSelect}
                      data-testid="input-file"
                    />
                    <Button variant="outline" size="sm" asChild>
                      <span className="cursor-pointer">파일 선택</span>
                    </Button>
                  </label>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <CardTitle>이미지 목록</CardTitle>
                <CardDescription>업로드된 이미지를 관리합니다</CardDescription>
              </div>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-32" data-testid="select-filter-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  {imageCategories.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : images.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ImageIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>업로드된 이미지가 없습니다</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {images.map((image) => (
                  <div
                    key={image.id}
                    className="group relative aspect-square rounded-lg overflow-hidden border bg-muted cursor-pointer"
                    onClick={() => setSelectedImage(image)}
                    data-testid={`image-${image.id}`}
                  >
                    <img
                      src={image.publicUrl}
                      alt={image.filename}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <Button
                        size="icon"
                        variant="secondary"
                        onClick={(e) => { e.stopPropagation(); copyUrl(image.publicUrl); }}
                        data-testid={`button-copy-${image.id}`}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="destructive"
                        onClick={(e) => { e.stopPropagation(); setDeleteImageId(image.id); }}
                        data-testid={`button-delete-${image.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <Badge className="absolute bottom-2 left-2 text-xs" variant="secondary">
                      {image.category}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>이미지 정보</DialogTitle>
          </DialogHeader>
          {selectedImage && (
            <div className="space-y-4">
              <img
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
                  <p className="font-medium">{selectedImage.category}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">파일 크기:</span>
                  <p className="font-medium">{formatFileSize(selectedImage.fileSize)}</p>
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
    </div>
  );
}
