import { useRef, useState } from "react";
import { Upload, Image as ImageIcon, X, CheckCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ImageUploaderProps {
  onImageSelect: (file: File | null) => void;
  onMultiImageSelect?: (files: File[]) => void;
  selectedFile: File | null;
  selectedFiles?: File[];
  previewUrl: string;
  previewUrls?: string[];
  multiMode?: boolean;
}

export default function ImageUploader({ onImageSelect, onMultiImageSelect, selectedFile, selectedFiles = [], previewUrl, previewUrls = [], multiMode = false }: ImageUploaderProps) {
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
    if (multiMode && e.dataTransfer.files) {
      const newFiles = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"));
      const combined = [...selectedFiles, ...newFiles].slice(0, 8);
      onMultiImageSelect?.(combined);
    } else if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (multiMode && e.target.files) {
      const newFiles = Array.from(e.target.files).filter(f => f.type.startsWith("image/"));
      const combined = [...selectedFiles, ...newFiles].slice(0, 8);
      onMultiImageSelect?.(combined);
    } else if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFile = (file: File) => {
    if (file.type.startsWith("image/")) {
      onImageSelect(file);
    }
  };

  const removeFile = (index: number) => {
    const updated = selectedFiles.filter((_, i) => i !== index);
    onMultiImageSelect?.(updated);
  };

  if (multiMode && selectedFiles.length > 0) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-4 gap-2">
          {selectedFiles.map((file, idx) => (
            <div key={idx} className="relative group rounded-lg overflow-hidden border border-green-200 bg-green-50/50">
              <div className="aspect-square">
                <img src={previewUrls[idx] || ""} alt={`preview-${idx}`} className="w-full h-full object-cover" />
              </div>
              <div className="absolute top-1 right-1">
                <button
                  onClick={() => removeFile(idx)}
                  className="p-1 rounded-full bg-black/50 text-white hover:bg-red-500 transition-colors"
                  data-testid={`btn-remove-image-${idx}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-1.5 py-0.5 text-center">
                {idx + 1}
              </div>
            </div>
          ))}
          {selectedFiles.length < 8 && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/20 hover:border-primary/50 flex flex-col items-center justify-center gap-1 transition-colors"
              data-testid="btn-add-more-images"
            >
              <Plus className="h-5 w-5 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">추가</span>
            </button>
          )}
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-green-700 flex items-center gap-1">
            <CheckCircle className="h-3.5 w-3.5" />
            {selectedFiles.length}장 선택됨 (최대 8장)
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onMultiImageSelect?.([])}
            className="text-xs text-muted-foreground"
            data-testid="btn-clear-all-images"
          >
            전체 삭제
          </Button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/*"
          multiple
          onChange={handleChange}
          data-testid="input-image-files"
        />
      </div>
    );
  }

  if (!multiMode && selectedFile && previewUrl) {
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
          <p className="text-sm font-medium">
            {multiMode ? "제품 이미지를 업로드하세요 (1~8장)" : "제품 이미지를 업로드하세요"}
          </p>
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
          multiple={multiMode}
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
