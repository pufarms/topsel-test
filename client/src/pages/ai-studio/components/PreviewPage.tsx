import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, FileText, Copy, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import type { SectionData, CopyVariant, ProductInfo } from "../types";
import { COPYWRITER_STYLES } from "../types";

interface PreviewPageProps {
  sections: SectionData[];
  product: ProductInfo;
  onBack: () => void;
}

function getStyleLabel(styleId: string): string {
  return COPYWRITER_STYLES.find((s) => s.id === styleId)?.name || styleId;
}

function copyToText(copy: CopyVariant): string {
  return [copy.headline, copy.subheadline, copy.body, copy.cta].filter(Boolean).join("\n\n");
}

export default function PreviewPage({ sections, product, onBack }: PreviewPageProps) {
  const { toast } = useToast();
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

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

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} data-testid="btn-back-to-editor">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-xl font-bold">전체 미리보기</h2>
            <p className="text-sm text-muted-foreground">{product.productName} - {sections.length}개 섹션</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleCopyAll} data-testid="btn-copy-all">
            <Copy className="h-4 w-4 mr-2" />
            전체 복사
          </Button>
          <Button onClick={handleDownloadText} data-testid="btn-download-text">
            <Download className="h-4 w-4 mr-2" />
            텍스트 다운로드
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {sections.map((section, idx) => {
          const copy = section.editedCopy || section.copies[section.selectedCopyIndex];
          if (!copy) return null;

          return (
            <Card key={section.id} className="overflow-hidden">
              <div className="bg-muted/30 px-6 py-3 flex items-center justify-between border-b">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{section.icon}</span>
                  <span className="font-bold text-sm">{section.name}</span>
                  <Badge variant="outline" className="text-xs">{getStyleLabel(copy.style)}</Badge>
                  {section.editedCopy && (
                    <Badge variant="secondary" className="text-xs">수정됨</Badge>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopySection(idx)}
                  data-testid={`btn-copy-section-${idx}`}
                >
                  {copiedIndex === idx ? (
                    <><CheckCircle2 className="h-3 w-3 mr-1 text-green-500" /> 복사됨</>
                  ) : (
                    <><Copy className="h-3 w-3 mr-1" /> 복사</>
                  )}
                </Button>
              </div>
              <CardContent className="pt-6">
                <h3 className="text-xl font-bold mb-2">{copy.headline}</h3>
                {copy.subheadline && (
                  <p className="text-muted-foreground font-medium mb-3">{copy.subheadline}</p>
                )}
                <p className="leading-relaxed whitespace-pre-wrap">{copy.body}</p>
                {copy.cta && (
                  <div className="mt-4 pt-3 border-t">
                    <p className="font-semibold text-primary">{copy.cta}</p>
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
              <span>{sections.length}개 섹션 완성</span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onBack} data-testid="btn-back-edit">
                편집으로 돌아가기
              </Button>
              <Button onClick={handleDownloadText} data-testid="btn-download-final">
                <Download className="h-4 w-4 mr-2" />
                최종 다운로드
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
