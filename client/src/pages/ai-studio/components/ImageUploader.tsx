import { useRef, useState } from "react";
import { Upload, Image as ImageIcon, X, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ImageUploaderProps {
  onImageSelect: (file: File | null) => void;
  selectedFile: File | null;
  previewUrl: string;
}

export default function ImageUploader({ onImageSelect, selectedFile, previewUrl }: ImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    if (file.type.startsWith("image/")) {
      onImageSelect(file);
    }
  };

  if (selectedFile && previewUrl) {
    return (
      <div className="relative rounded-lg overflow-hidden border border-green-200 bg-green-50/50">
        <div className="flex items-center gap-3 p-3">
          <div className="w-20 h-20 rounded-md overflow-hidden flex-shrink-0 bg-white border">
            <img src={previewUrl} alt="preview" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-green-700 text-sm font-medium">
              <CheckCircle className="h-4 w-4" />
              이미지 선택됨
            </div>
            <p className="text-xs text-muted-foreground truncate mt-0.5">{selectedFile.name}</p>
            <p className="text-xs text-muted-foreground">
              {(selectedFile.size / 1024 / 1024).toFixed(1)}MB
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="flex-shrink-0"
            onClick={() => {
              onImageSelect(null);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
            data-testid="btn-remove-image"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`w-full p-8 rounded-lg border-2 border-dashed transition-all duration-300 cursor-pointer ${
        dragActive
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/20 hover:border-primary/50"
      }`}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
      data-testid="image-upload-dropzone"
    >
      <div className="flex flex-col items-center justify-center text-center space-y-3">
        <div className={`p-3 rounded-full ${dragActive ? "bg-primary/10" : "bg-muted"}`}>
          <ImageIcon className={`w-8 h-8 ${dragActive ? "text-primary" : "text-muted-foreground"}`} />
        </div>

        <div className="space-y-1">
          <p className="text-sm font-medium">제품 이미지를 업로드하세요</p>
          <p className="text-xs text-muted-foreground">
            여기로 이미지를 끌어다 놓거나 클릭하세요
          </p>
          <p className="text-xs text-muted-foreground">
            JPG, PNG, WEBP (최대 10MB)
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/*"
          onChange={handleChange}
          data-testid="input-image-file"
        />

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            fileInputRef.current?.click();
          }}
          data-testid="btn-select-image"
        >
          <Upload className="w-4 h-4 mr-2" />
          이미지 선택하기
        </Button>
      </div>
    </div>
  );
}
