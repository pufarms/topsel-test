import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ImageIcon, Check } from "lucide-react";
import { imageCategories, type Image } from "@shared/schema";

interface ImagePickerProps {
  value?: string;
  onChange: (url: string) => void;
  children?: React.ReactNode;
}

export default function ImagePicker({ value, onChange, children }: ImagePickerProps) {
  const [open, setOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

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
    enabled: open,
  });

  const handleSelect = (url: string) => {
    onChange(url);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" type="button" data-testid="button-image-picker">
            <ImageIcon className="h-4 w-4 mr-2" />
            이미지 선택
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between gap-4">
            <DialogTitle>이미지 선택</DialogTitle>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-32" data-testid="picker-select-category">
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
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : images.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ImageIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>이미지가 없습니다</p>
              <p className="text-sm mt-1">설정 &gt; 이미지 갤러리에서 이미지를 업로드하세요</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 md:grid-cols-4 gap-3 p-1">
              {images.map((image) => (
                <button
                  key={image.id}
                  type="button"
                  className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                    value === image.publicUrl 
                      ? "border-primary ring-2 ring-primary/20" 
                      : "border-transparent hover:border-muted-foreground/50"
                  }`}
                  onClick={() => handleSelect(image.publicUrl)}
                  data-testid={`picker-image-${image.id}`}
                >
                  <img
                    src={image.publicUrl}
                    alt={image.filename}
                    className="w-full h-full object-cover"
                  />
                  {value === image.publicUrl && (
                    <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                      <Check className="h-8 w-8 text-primary" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
