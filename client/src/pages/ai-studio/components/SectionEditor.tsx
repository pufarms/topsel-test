import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, Edit3, RotateCcw, ChevronLeft, ChevronRight, Eye } from "lucide-react";
import type { SectionData, CopyVariant } from "../types";
import { COPYWRITER_STYLES } from "../types";

interface SectionEditorProps {
  sections: SectionData[];
  currentSectionIndex: number;
  onSectionChange: (index: number) => void;
  onSelectCopy: (sectionIndex: number, copyIndex: number) => void;
  onEditCopy: (sectionIndex: number, editedCopy: CopyVariant) => void;
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

export default function SectionEditor({ sections, currentSectionIndex, onSectionChange, onSelectCopy, onEditCopy, onPreview }: SectionEditorProps) {
  const section = sections[currentSectionIndex];
  const [editingCopyIndex, setEditingCopyIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<CopyVariant | null>(null);

  if (!section) return null;

  const activeCopy = section.editedCopy || section.copies[section.selectedCopyIndex];

  const startEdit = (idx: number) => {
    const copy = section.copies[idx];
    setEditingCopyIndex(idx);
    setEditForm({ ...copy });
  };

  const saveEdit = () => {
    if (editForm && editingCopyIndex !== null) {
      onSelectCopy(currentSectionIndex, editingCopyIndex);
      onEditCopy(currentSectionIndex, editForm);
      setEditingCopyIndex(null);
      setEditForm(null);
    }
  };

  const cancelEdit = () => {
    setEditingCopyIndex(null);
    setEditForm(null);
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">섹션별 카피 편집</h2>
        <Button onClick={onPreview} variant="outline" data-testid="btn-preview-all">
          <Eye className="h-4 w-4 mr-2" />
          전체 미리보기
        </Button>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {sections.map((sec, idx) => (
          <button
            key={sec.id}
            onClick={() => onSectionChange(idx)}
            className={`flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              idx === currentSectionIndex
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/50 hover:bg-muted text-muted-foreground"
            }`}
            data-testid={`btn-section-${sec.id}`}
          >
            <span>{sec.icon}</span>
            <span className="hidden sm:inline">{sec.name}</span>
            {sec.editedCopy && <Edit3 className="h-3 w-3" />}
          </button>
        ))}
      </div>

      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{section.icon}</span>
          <div>
            <h3 className="font-bold text-lg">{section.name}</h3>
            <p className="text-sm text-muted-foreground">{section.description}</p>
          </div>
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            disabled={currentSectionIndex === 0}
            onClick={() => onSectionChange(currentSectionIndex - 1)}
            data-testid="btn-prev-section"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            disabled={currentSectionIndex === sections.length - 1}
            onClick={() => onSectionChange(currentSectionIndex + 1)}
            data-testid="btn-next-section"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="select" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="select">카피 선택</TabsTrigger>
          <TabsTrigger value="preview">선택된 카피</TabsTrigger>
        </TabsList>

        <TabsContent value="select">
          <div className="grid gap-4">
            {section.copies.map((copy, idx) => (
              <Card
                key={copy.id}
                className={`cursor-pointer transition-all ${
                  idx === section.selectedCopyIndex
                    ? "ring-2 ring-primary shadow-md"
                    : "hover:border-primary/30"
                }`}
                onClick={() => {
                  if (editingCopyIndex === null) {
                    onSelectCopy(currentSectionIndex, idx);
                  }
                }}
              >
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={getStyleColor(copy.style)}>
                        {getStyleLabel(copy.style)}
                      </Badge>
                      {idx === section.selectedCopyIndex && (
                        <Badge className="bg-primary/10 text-primary border-primary/20">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          선택됨
                        </Badge>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        startEdit(idx);
                      }}
                      data-testid={`btn-edit-copy-${idx}`}
                    >
                      <Edit3 className="h-3 w-3 mr-1" />
                      수정
                    </Button>
                  </div>

                  {editingCopyIndex === idx && editForm ? (
                    <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">헤드라인</label>
                        <Textarea
                          value={editForm.headline}
                          onChange={(e) => setEditForm({ ...editForm, headline: e.target.value })}
                          rows={1}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">서브 헤드라인</label>
                        <Textarea
                          value={editForm.subheadline}
                          onChange={(e) => setEditForm({ ...editForm, subheadline: e.target.value })}
                          rows={1}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">본문</label>
                        <Textarea
                          value={editForm.body}
                          onChange={(e) => setEditForm({ ...editForm, body: e.target.value })}
                          rows={3}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">CTA</label>
                        <Textarea
                          value={editForm.cta}
                          onChange={(e) => setEditForm({ ...editForm, cta: e.target.value })}
                          rows={1}
                          className="mt-1"
                        />
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" size="sm" onClick={cancelEdit}>
                          <RotateCcw className="h-3 w-3 mr-1" />
                          취소
                        </Button>
                        <Button size="sm" onClick={saveEdit}>
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          저장
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <h4 className="font-bold text-base">{copy.headline}</h4>
                      {copy.subheadline && <p className="text-sm text-muted-foreground font-medium">{copy.subheadline}</p>}
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{copy.body}</p>
                      {copy.cta && (
                        <p className="text-sm font-semibold text-primary mt-2">{copy.cta}</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="preview">
          {activeCopy && (
            <Card>
              <CardContent className="pt-6">
                <Badge variant="outline" className={`${getStyleColor(activeCopy.style)} mb-4`}>
                  {getStyleLabel(activeCopy.style)}
                  {section.editedCopy && " (수정됨)"}
                </Badge>
                <h3 className="text-xl font-bold mb-2">{activeCopy.headline}</h3>
                {activeCopy.subheadline && <p className="text-muted-foreground font-medium mb-3">{activeCopy.subheadline}</p>}
                <p className="leading-relaxed whitespace-pre-wrap mb-4">{activeCopy.body}</p>
                {activeCopy.cta && (
                  <div className="pt-3 border-t">
                    <p className="font-semibold text-primary">{activeCopy.cta}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
