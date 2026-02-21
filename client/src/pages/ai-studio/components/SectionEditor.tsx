import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Type, Move, Trash2, AlignLeft, AlignCenter, AlignRight, Bold,
  Download, Plus, Eye, ChevronLeft, ChevronRight, PenTool,
  CheckCircle2, Edit3, RotateCcw, ImageOff,
} from "lucide-react";
import type { SectionData, CopyVariant, TextLayer } from "../types";
import { COPYWRITER_STYLES, FONTS, COLORS } from "../types";

interface SectionEditorProps {
  sections: SectionData[];
  currentSectionIndex: number;
  onSectionChange: (index: number) => void;
  onSelectCopy: (sectionIndex: number, copyIndex: number) => void;
  onEditCopy: (sectionIndex: number, editedCopy: CopyVariant) => void;
  onUpdateTextLayers: (sectionIndex: number, textLayers: TextLayer[]) => void;
  onPreview: () => void;
}

function getStyleLabel(styleId: string): string {
  return COPYWRITER_STYLES.find((s) => s.id === styleId)?.name || styleId;
}

function getStyleColor(styleId: string): string {
  const colors: Record<string, string> = {
    professional: "bg-blue-100 text-blue-700 border-blue-200",
    friendly: "bg-green-100 text-green-700 border-green-200",
    luxury: "bg-purple-100 text-purple-700 border-purple-200",
    impact: "bg-red-100 text-red-700 border-red-200",
    story: "bg-amber-100 text-amber-700 border-amber-200",
  };
  return colors[styleId] || "bg-gray-100 text-gray-700 border-gray-200";
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
            if (ctx.measureText(tempLine + char).width > maxWidth) {
              lines.push(tempLine);
              tempLine = char;
            } else {
              tempLine += char;
            }
          });
          currentLine = tempLine;
        }
      } else if (ctx.measureText(testLine).width > maxWidth && index === 0) {
        const chars = word.split("");
        let tempLine = "";
        chars.forEach((char) => {
          if (ctx.measureText(tempLine + char).width > maxWidth) {
            lines.push(tempLine);
            tempLine = char;
          } else {
            tempLine += char;
          }
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

export default function SectionEditor({
  sections,
  currentSectionIndex,
  onSectionChange,
  onSelectCopy,
  onEditCopy,
  onUpdateTextLayers,
  onPreview,
}: SectionEditorProps) {
  const section = sections[currentSectionIndex];
  const canvasRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [editingCopyIndex, setEditingCopyIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<CopyVariant | null>(null);
  const [sidebarTab, setSidebarTab] = useState<"copies" | "layers">("copies");

  if (!section) return null;

  const textLayers = section.textLayers || [];
  const hasImage = !!section.imageSrc;

  const setTextLayers = (updater: (prev: TextLayer[]) => TextLayer[]) => {
    onUpdateTextLayers(currentSectionIndex, updater(textLayers));
  };

  const addTextLayer = (text: string = "새로운 텍스트") => {
    const newLayer: TextLayer = {
      id: Math.random().toString(36).substr(2, 9),
      text,
      x: 50,
      y: 50,
      fontSize: 28,
      color: "#FFFFFF",
      fontFamily: "'Noto Sans KR', sans-serif",
      fontWeight: "700",
      width: 300,
      align: "center",
    };
    setTextLayers((prev) => [...prev, newLayer]);
    setSelectedId(newLayer.id);
    setSidebarTab("layers");
  };

  const updateLayer = (id: string, updates: Partial<TextLayer>) => {
    setTextLayers((prev) => prev.map((l) => (l.id === id ? { ...l, ...updates } : l)));
  };

  const deleteLayer = (id: string) => {
    setTextLayers((prev) => prev.filter((l) => l.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const handleMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedId(id);
    setIsDragging(true);
    const layer = textLayers.find((l) => l.id === id);
    if (layer && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      setDragOffset({ x: e.clientX - rect.left - layer.x, y: e.clientY - rect.top - layer.y });
    }
  };

  const handleResizeStart = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedId(id);
    setIsResizing(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    if (isResizing && selectedId) {
      const layer = textLayers.find((l) => l.id === selectedId);
      if (layer) updateLayer(selectedId, { width: Math.max(50, mx - layer.x) });
      return;
    }
    if (isDragging && selectedId) {
      updateLayer(selectedId, { x: mx - dragOffset.x, y: my - dragOffset.y });
    }
  };

  const handleMouseUp = () => { setIsDragging(false); setIsResizing(false); };

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current || (e.target as HTMLElement).tagName === "IMG") {
      setSelectedId(null);
    }
  };

  const handleDownloadSection = async () => {
    if (!canvasRef.current || !section.imageSrc) return;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = section.imageSrc;
    img.onload = () => {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      const previewRect = canvasRef.current!.getBoundingClientRect();
      const scaleX = img.naturalWidth / previewRect.width;
      const scaleY = img.naturalHeight / previewRect.height;
      textLayers.forEach((layer) => {
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
      const link = document.createElement("a");
      link.download = `${section.name}.jpg`;
      link.href = canvas.toDataURL("image/jpeg", 0.92);
      link.click();
    };
  };

  const selectedLayer = textLayers.find((l) => l.id === selectedId);

  const startEdit = (idx: number) => {
    setEditingCopyIndex(idx);
    setEditForm({ ...section.copies[idx] });
  };

  const saveEdit = () => {
    if (editForm && editingCopyIndex !== null) {
      onSelectCopy(currentSectionIndex, editingCopyIndex);
      onEditCopy(currentSectionIndex, editForm);
      setEditingCopyIndex(null);
      setEditForm(null);
    }
  };

  return (
    <div className="flex h-[calc(100vh-60px)] overflow-hidden" onMouseUp={handleMouseUp} onMouseMove={handleMouseMove}>
      <div className="w-80 bg-background border-r flex flex-col z-20 select-none flex-shrink-0">
        <div className="p-3 border-b flex items-center justify-between">
          <h2 className="font-bold text-sm flex items-center gap-2">
            <Move className="w-4 h-4 text-primary" />
            에디터
          </h2>
          <Button variant="outline" size="sm" onClick={onPreview} data-testid="btn-preview-all">
            <Eye className="h-3.5 w-3.5 mr-1" />
            미리보기
          </Button>
        </div>

        <div className="flex border-b">
          <button
            onClick={() => setSidebarTab("copies")}
            className={`flex-1 py-2 text-xs font-medium ${sidebarTab === "copies" ? "text-primary border-b-2 border-primary" : "text-muted-foreground"}`}
          >
            <PenTool className="w-3 h-3 inline mr-1" />
            AI 카피
          </button>
          <button
            onClick={() => setSidebarTab("layers")}
            className={`flex-1 py-2 text-xs font-medium ${sidebarTab === "layers" ? "text-primary border-b-2 border-primary" : "text-muted-foreground"}`}
          >
            <Type className="w-3 h-3 inline mr-1" />
            텍스트 편집
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {sidebarTab === "copies" && (
            <>
              <div className="grid gap-2">
                {section.copies.map((copy, idx) => (
                  <div
                    key={copy.id}
                    className={`p-2.5 rounded-lg border cursor-pointer transition-colors text-sm ${
                      idx === section.selectedCopyIndex
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/30"
                    }`}
                    data-testid={`copy-suggestion-${idx}`}
                  >
                    {editingCopyIndex === idx && editForm ? (
                      <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                        <Textarea value={editForm.headline} onChange={(e) => setEditForm({ ...editForm, headline: e.target.value })} rows={1} className="text-xs" />
                        <Textarea value={editForm.subheadline} onChange={(e) => setEditForm({ ...editForm, subheadline: e.target.value })} rows={1} className="text-xs" />
                        <Textarea value={editForm.body} onChange={(e) => setEditForm({ ...editForm, body: e.target.value })} rows={2} className="text-xs" />
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="sm" onClick={() => { setEditingCopyIndex(null); setEditForm(null); }}>
                            <RotateCcw className="h-3 w-3" />
                          </Button>
                          <Button size="sm" onClick={saveEdit}>
                            <CheckCircle2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div onClick={() => { onSelectCopy(currentSectionIndex, idx); addTextLayer(copy.headline); }}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <Badge variant="outline" className={`text-[10px] px-1 py-0 ${getStyleColor(copy.style)}`}>
                            {getStyleLabel(copy.style)}
                          </Badge>
                          {idx === section.selectedCopyIndex && (
                            <CheckCircle2 className="h-3 w-3 text-primary" />
                          )}
                          <button
                            className="ml-auto text-muted-foreground hover:text-foreground"
                            onClick={(e) => { e.stopPropagation(); startEdit(idx); }}
                          >
                            <Edit3 className="h-3 w-3" />
                          </button>
                        </div>
                        <p className="text-xs font-medium leading-snug">{copy.headline}</p>
                        {copy.subheadline && <p className="text-[11px] text-muted-foreground mt-0.5">{copy.subheadline}</p>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {sidebarTab === "layers" && (
            <>
              {selectedLayer ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground uppercase">텍스트 속성</span>
                    <button onClick={() => deleteLayer(selectedLayer.id)} className="text-red-500 hover:text-red-600 p-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground">내용</label>
                    <Textarea
                      value={selectedLayer.text}
                      onChange={(e) => updateLayer(selectedLayer.id, { text: e.target.value })}
                      className="mt-1 text-xs resize-none h-16"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground">정렬</label>
                    <div className="flex bg-muted rounded-md p-0.5 w-fit mt-1">
                      {[
                        { val: "left" as const, icon: <AlignLeft className="w-3.5 h-3.5" /> },
                        { val: "center" as const, icon: <AlignCenter className="w-3.5 h-3.5" /> },
                        { val: "right" as const, icon: <AlignRight className="w-3.5 h-3.5" /> },
                      ].map((a) => (
                        <button
                          key={a.val}
                          onClick={() => updateLayer(selectedLayer.id, { align: a.val })}
                          className={`p-1.5 rounded ${selectedLayer.align === a.val ? "bg-background shadow-sm" : "text-muted-foreground"}`}
                        >
                          {a.icon}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground">크기</label>
                      <input
                        type="number"
                        value={selectedLayer.fontSize}
                        onChange={(e) => updateLayer(selectedLayer.id, { fontSize: Number(e.target.value) })}
                        className="w-full mt-1 p-1.5 border rounded-md text-xs bg-background"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">폰트</label>
                      <select
                        value={selectedLayer.fontFamily}
                        onChange={(e) => updateLayer(selectedLayer.id, { fontFamily: e.target.value })}
                        className="w-full mt-1 p-1.5 border rounded-md text-xs bg-background"
                      >
                        {FONTS.map((f) => (
                          <option key={f.name} value={f.value}>{f.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground">색상</label>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {COLORS.map((c) => (
                        <button
                          key={c}
                          onClick={() => updateLayer(selectedLayer.id, { color: c })}
                          className={`w-5 h-5 rounded-full border ${selectedLayer.color === c ? "ring-2 ring-offset-1 ring-primary" : "border-border"}`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground">스타일</label>
                    <div className="flex gap-1.5 mt-1">
                      <button
                        onClick={() => updateLayer(selectedLayer.id, { fontWeight: selectedLayer.fontWeight === "700" ? "400" : "700" })}
                        className={`p-1.5 rounded border ${selectedLayer.fontWeight === "700" ? "bg-primary/10 border-primary/20 text-primary" : "bg-background border-border text-muted-foreground"}`}
                      >
                        <Bold className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <Type className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  <p className="text-xs">이미지 위의 텍스트를 클릭하여 편집하세요</p>
                  <p className="text-xs mt-1">또는 AI 카피 탭에서 카피를 클릭하면 추가됩니다</p>
                </div>
              )}

              <Button variant="outline" size="sm" className="w-full" onClick={() => addTextLayer()} data-testid="btn-add-text">
                <Plus className="w-3.5 h-3.5 mr-1" />
                텍스트 추가
              </Button>
            </>
          )}
        </div>

        <div className="p-3 border-t space-y-2">
          {hasImage && (
            <Button variant="outline" size="sm" className="w-full" onClick={handleDownloadSection} data-testid="btn-download-section">
              <Download className="w-3.5 h-3.5 mr-1" />
              이 섹션 다운로드
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex gap-1 px-3 py-2 border-b overflow-x-auto bg-muted/30 flex-shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" disabled={currentSectionIndex === 0} onClick={() => onSectionChange(currentSectionIndex - 1)}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          {sections.map((sec, idx) => (
            <button
              key={sec.id}
              onClick={() => onSectionChange(idx)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                idx === currentSectionIndex
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-background hover:bg-muted text-muted-foreground border"
              }`}
              data-testid={`btn-section-${sec.id}`}
            >
              <span>{sec.icon}</span>
              <span className="hidden lg:inline">{sec.name}</span>
            </button>
          ))}
          <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" disabled={currentSectionIndex === sections.length - 1} onClick={() => onSectionChange(currentSectionIndex + 1)}>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="flex-1 bg-muted/50 flex items-center justify-center p-4 relative overflow-hidden">
          <div className="absolute inset-0 opacity-5" style={{ backgroundImage: "radial-gradient(#000 1px, transparent 1px)", backgroundSize: "20px 20px" }} />

          {hasImage ? (
            <div
              ref={canvasRef}
              className="relative shadow-2xl bg-white select-none"
              style={{ maxHeight: "calc(100vh - 160px)", maxWidth: "100%", aspectRatio: "auto" }}
              onMouseDown={handleCanvasClick}
            >
              <img
                src={section.imageSrc}
                alt={section.name}
                className="max-h-[calc(100vh-160px)] w-auto h-auto object-contain pointer-events-none block"
                draggable={false}
              />

              {textLayers.map((layer) => (
                <div
                  key={layer.id}
                  onMouseDown={(e) => handleMouseDown(e, layer.id)}
                  className={`absolute group leading-tight ${
                    selectedId === layer.id
                      ? "ring-2 ring-blue-500 ring-dashed cursor-move"
                      : "hover:ring-1 hover:ring-blue-300 hover:ring-dashed cursor-pointer"
                  }`}
                  style={{
                    left: layer.x,
                    top: layer.y,
                    width: layer.width || "auto",
                    fontSize: `${layer.fontSize}px`,
                    color: layer.color,
                    fontFamily: layer.fontFamily,
                    fontWeight: layer.fontWeight,
                    textAlign: layer.align || "left",
                    zIndex: 10,
                    textShadow: "0px 2px 4px rgba(0,0,0,0.3)",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {layer.text}
                  {selectedId === layer.id && (
                    <div className="absolute -top-5 left-0 bg-blue-500 text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap">
                      {Math.round(layer.width || 0)}px
                    </div>
                  )}
                  {selectedId === layer.id && (
                    <div
                      className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3.5 h-3.5 bg-white border-2 border-blue-500 rounded-full cursor-e-resize z-20 shadow-sm"
                      onMouseDown={(e) => handleResizeStart(e, layer.id)}
                    />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-muted-foreground">
              <ImageOff className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <p className="font-medium">이미지가 생성되지 않았습니다</p>
              <p className="text-sm mt-1">이 섹션의 배경 이미지 생성에 실패했습니다</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
