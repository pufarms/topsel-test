import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, FileText, Copy, CheckCircle2, Package, Loader2, Pencil } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import type { SectionData, CopyVariant, ProductInfo } from "../types";
import { COPYWRITER_STYLES } from "../types";
import JSZip from "jszip";

interface PreviewPageProps {
  sections: SectionData[];
  product: ProductInfo;
  onBack: () => void;
  onEditSection?: (sectionIndex: number) => void;
}

function getStyleLabel(styleId: string): string {
  return COPYWRITER_STYLES.find((s) => s.id === styleId)?.name || styleId;
}

function copyToText(copy: CopyVariant): string {
  return [copy.headline, copy.subheadline, copy.body, copy.cta].filter(Boolean).join("\n\n");
}

const getWrappedLines = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
  const lines: string[] = [];
  const paragraphs = text.split("\n");
  paragraphs.forEach((paragraph) => {
    if (!maxWidth || maxWidth <= 0) { lines.push(paragraph); return; }
    const words = paragraph.split(" ");
    let currentLine = "";
    words.forEach((word, index) => {
      const testLine = currentLine + (currentLine ? " " : "") + word;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && index > 0) {
        lines.push(currentLine);
        currentLine = word;
        if (ctx.measureText(word).width > maxWidth) {
          const chars = word.split("");
          let tempLine = "";
          chars.forEach((char) => {
            if (ctx.measureText(tempLine + char).width > maxWidth) { lines.push(tempLine); tempLine = char; } else { tempLine += char; }
          });
          currentLine = tempLine;
        }
      } else if (ctx.measureText(testLine).width > maxWidth && index === 0) {
        const chars = word.split("");
        let tempLine = "";
        chars.forEach((char) => {
          if (ctx.measureText(tempLine + char).width > maxWidth) { lines.push(tempLine); tempLine = char; } else { tempLine += char; }
        });
        currentLine = tempLine;
      } else {
        currentLine = testLine;
      }
    });
    if (currentLine) lines.push(currentLine);
  });
  return lines;
};

function renderSectionToCanvas(section: SectionData, previewWidth: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (!section.imageSrc) { resolve(null); return; }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = section.imageSrc;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(null); return; }
      ctx.drawImage(img, 0, 0);
      const scaleX = img.naturalWidth / (previewWidth || img.naturalWidth);
      const scaleY = img.naturalHeight / ((previewWidth || img.naturalWidth) * (img.naturalHeight / img.naturalWidth));
      (section.textLayers || []).forEach((layer) => {
        ctx.save();
        ctx.font = `${layer.fontWeight} ${layer.fontSize * scaleX}px ${layer.fontFamily.replace(/['"]/g, "")}`;
        ctx.fillStyle = layer.color;
        ctx.textBaseline = "top";
        ctx.textAlign = layer.align || "left";
        ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
        ctx.shadowBlur = 4;
        ctx.shadowOffsetY = 2;
        const lineHeight = layer.fontSize * scaleX * 1.3;
        const boxWidth = (layer.width || 0) * scaleX;
        const lines = getWrappedLines(ctx, layer.text, boxWidth);
        let drawX = layer.x * scaleX;
        if (layer.align === "center") drawX += boxWidth / 2;
        else if (layer.align === "right") drawX += boxWidth;
        lines.forEach((line, i) => { ctx.fillText(line, drawX, layer.y * scaleY + i * lineHeight); });
        ctx.restore();
      });
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.92);
    };
    img.onerror = () => resolve(null);
  });
}

export default function PreviewPage({ sections, product, onBack, onEditSection }: PreviewPageProps) {
  const { toast } = useToast();
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [downloading, setDownloading] = useState(false);

  const handleCopySection = (idx: number) => {
    const section = sections[idx];
    const copy = section.editedCopy || section.copies[section.selectedCopyIndex];
    if (!copy) return;
    const text = `[${section.name}]\n\n${copyToText(copy)}`;
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
    toast({ title: "복사 완료", description: `${section.name} 카피가 클립보드에 복사되었습니다` });
  };

  const handleCopyAll = () => {
    const allText = sections.map((section) => {
      const copy = section.editedCopy || section.copies[section.selectedCopyIndex];
      return `=== ${section.icon} ${section.name} ===\n\n${copyToText(copy)}`;
    }).join("\n\n\n");
    const header = `상품명: ${product.productName}\n원산지: ${product.origin}\n\n${"=".repeat(40)}\n\n`;
    navigator.clipboard.writeText(header + allText);
    toast({ title: "전체 복사 완료", description: "모든 섹션의 카피가 클립보드에 복사되었습니다" });
  };

  const handleDownloadZip = async () => {
    setDownloading(true);
    try {
      const zip = new JSZip();
      const imgFolder = zip.folder("상세페이지_이미지");
      const sectionsWithImages = sections.filter((s) => s.imageSrc);

      if (sectionsWithImages.length === 0) {
        toast({ title: "다운로드 불가", description: "생성된 이미지가 없습니다", variant: "destructive" });
        setDownloading(false);
        return;
      }

      for (let i = 0; i < sectionsWithImages.length; i++) {
        const section = sectionsWithImages[i];
        const blob = await renderSectionToCanvas(section, 600);
        if (blob && imgFolder) {
          imgFolder.file(`${String(i + 1).padStart(2, "0")}_${section.name}.jpg`, blob);
        }
      }

      const allText = sections.map((section) => {
        const copy = section.editedCopy || section.copies[section.selectedCopyIndex];
        return `=== ${section.name} ===\n\n헤드라인: ${copy.headline}\n서브: ${copy.subheadline}\n본문:\n${copy.body}\nCTA: ${copy.cta}`;
      }).join("\n\n" + "─".repeat(40) + "\n\n");
      zip.file("카피_텍스트.txt", `AI 상세페이지 - ${product.productName}\n생성일: ${new Date().toLocaleDateString("ko-KR")}\n${"═".repeat(40)}\n\n${allText}`);

      const content = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(content);
      link.download = `AI상세페이지_${product.productName}_${new Date().toISOString().slice(0, 10)}.zip`;
      link.click();
      URL.revokeObjectURL(link.href);
      toast({ title: "ZIP 다운로드 완료", description: `${sectionsWithImages.length}개 이미지 + 카피 텍스트가 포함되었습니다` });
    } catch (error: any) {
      toast({ title: "다운로드 실패", description: error?.message || "ZIP 파일 생성 중 오류 발생", variant: "destructive" });
    }
    setDownloading(false);
  };

  const handleDownloadText = () => {
    const allText = sections.map((section) => {
      const copy = section.editedCopy || section.copies[section.selectedCopyIndex];
      return `=== ${section.name} ===\n\n헤드라인: ${copy.headline}\n서브: ${copy.subheadline}\n본문:\n${copy.body}\nCTA: ${copy.cta}`;
    }).join("\n\n" + "─".repeat(40) + "\n\n");
    const header = `AI 상세페이지 카피 - ${product.productName}\n생성일: ${new Date().toLocaleDateString("ko-KR")}\n${"═".repeat(40)}\n\n`;
    const blob = new Blob([header + allText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `AI상세페이지_${product.productName}_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "다운로드 완료", description: "텍스트 파일이 다운로드되었습니다" });
  };

  const sectionsWithImages = sections.filter((s) => s.imageSrc);

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} data-testid="btn-back-to-editor">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-xl font-bold">전체 미리보기</h2>
            <p className="text-sm text-muted-foreground">{product.productName} — {sections.length}개 섹션, {sectionsWithImages.length}개 이미지</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleCopyAll} data-testid="btn-copy-all">
            <Copy className="h-4 w-4 mr-1" />
            전체 복사
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadText} data-testid="btn-download-text">
            <FileText className="h-4 w-4 mr-1" />
            텍스트
          </Button>
          <Button size="sm" onClick={handleDownloadZip} disabled={downloading || sectionsWithImages.length === 0} data-testid="btn-download-zip">
            {downloading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Package className="h-4 w-4 mr-1" />}
            {downloading ? "생성 중..." : "ZIP 다운로드"}
          </Button>
        </div>
      </div>

      <div className="space-y-8">
        {sections.map((section, idx) => {
          const copy = section.editedCopy || section.copies[section.selectedCopyIndex];
          if (!copy) return null;

          return (
            <Card key={section.id} className="overflow-hidden">
              <div className="bg-muted/30 px-4 py-2.5 flex items-center justify-between border-b">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{section.icon}</span>
                  <span className="font-bold text-sm">{section.name}</span>
                  <Badge variant="outline" className="text-xs">{getStyleLabel(copy.style)}</Badge>
                  {section.editedCopy && <Badge variant="secondary" className="text-xs">수정됨</Badge>}
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleCopySection(idx)} data-testid={`btn-copy-section-${idx}`}>
                  {copiedIndex === idx ? (
                    <><CheckCircle2 className="h-3 w-3 mr-1 text-green-500" /> 복사됨</>
                  ) : (
                    <><Copy className="h-3 w-3 mr-1" /> 복사</>
                  )}
                </Button>
              </div>

              <CardContent className="p-0">
                {section.imageSrc ? (
                  <div
                    className="relative group cursor-pointer"
                    onClick={() => onEditSection?.(idx)}
                    data-testid={`preview-section-click-${idx}`}
                  >
                    <img src={section.imageSrc} alt={section.name} className="w-full h-auto" />
                    {(section.textLayers || []).map((layer) => (
                      <div
                        key={layer.id}
                        className="absolute leading-tight pointer-events-none"
                        style={{
                          left: layer.x,
                          top: layer.y,
                          width: layer.width || "auto",
                          fontSize: `${layer.fontSize}px`,
                          color: layer.color,
                          fontFamily: layer.fontFamily,
                          fontWeight: layer.fontWeight,
                          textAlign: layer.align || "left",
                          textShadow: "0px 2px 4px rgba(0,0,0,0.3)",
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {layer.text}
                      </div>
                    ))}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center gap-2 bg-white/90 text-gray-900 px-4 py-2 rounded-full font-medium text-sm shadow-lg">
                        <Pencil className="h-4 w-4" />
                        편집하기
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-6">
                    <h3 className="text-xl font-bold mb-2">{copy.headline}</h3>
                    {copy.subheadline && <p className="text-muted-foreground font-medium mb-3">{copy.subheadline}</p>}
                    <p className="leading-relaxed whitespace-pre-wrap">{copy.body}</p>
                    {copy.cta && (
                      <div className="mt-4 pt-3 border-t">
                        <p className="font-semibold text-primary">{copy.cta}</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="sticky bottom-4 mt-8">
        <Card className="shadow-lg border-primary/20">
          <CardContent className="py-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" />
              <span>{sections.length}개 섹션 완성 · {sectionsWithImages.length}개 이미지</span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onBack} data-testid="btn-back-edit">
                편집으로 돌아가기
              </Button>
              <Button onClick={handleDownloadZip} disabled={downloading || sectionsWithImages.length === 0} data-testid="btn-download-final">
                {downloading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
                {downloading ? "생성 중..." : "ZIP 다운로드"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
