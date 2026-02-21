import { SECTION_DEFINITIONS } from "../types";
import { Loader2, CheckCircle2, Circle, AlertCircle, Sparkles, ImageIcon, FileText, Palette } from "lucide-react";

interface GeneratingProgressProps {
  currentSection: number;
  totalSections: number;
  sectionName: string;
  phase: "art-direction" | "copy" | "image";
  error?: string;
}

export default function GeneratingProgress({ currentSection, totalSections, sectionName, phase, error }: GeneratingProgressProps) {
  const isArtDirection = phase === "art-direction";
  const totalSteps = totalSections * 2 + 1;
  const currentStep = isArtDirection ? 0 : 1 + currentSection * 2 + (phase === "image" ? 1 : 0);
  const progress = Math.round((currentStep / totalSteps) * 100);

  const phaseMessage = isArtDirection
    ? "비주얼 기조 설계 중..."
    : phase === "copy"
    ? `${sectionName} — 카피 작성 중...`
    : `${sectionName} — 배경 이미지 생성 중...`;

  return (
    <div className="max-w-2xl mx-auto py-12">
      <div className="text-center mb-10">
        <div className="inline-flex p-4 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-violet-500/20 mb-4 relative">
          <Sparkles className="h-8 w-8 text-cyan-500 animate-pulse" />
          <div className="absolute inset-0 rounded-2xl bg-cyan-500/10 animate-ping" style={{ animationDuration: "2s" }} />
        </div>
        <h2 className="text-2xl font-bold mb-2" data-testid="text-progress-title">AI가 상세페이지를 생성하고 있습니다</h2>
        <p className="text-muted-foreground" data-testid="text-progress-status">
          {error ? "일부 섹션에서 오류가 발생했습니다" : phaseMessage}
        </p>
        <div className="flex items-center justify-center gap-4 mt-3">
          <div className={`flex items-center gap-1.5 text-xs ${isArtDirection ? "text-primary font-medium" : "text-muted-foreground"}`}>
            <Palette className="h-3.5 w-3.5" />
            비주얼 기조
          </div>
          <div className={`flex items-center gap-1.5 text-xs ${phase === "copy" ? "text-primary font-medium" : "text-muted-foreground"}`}>
            <FileText className="h-3.5 w-3.5" />
            카피 생성
          </div>
          <div className={`flex items-center gap-1.5 text-xs ${phase === "image" ? "text-primary font-medium" : "text-muted-foreground"}`}>
            <ImageIcon className="h-3.5 w-3.5" />
            이미지 합성
          </div>
        </div>
      </div>

      <div className="mb-8">
        <div className="flex justify-between text-sm text-muted-foreground mb-2">
          <span>{isArtDirection ? "준비 중" : `${currentSection} / ${totalSections} 섹션`}</span>
          <span>{progress}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="space-y-2">
        <div
          className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 ${
            isArtDirection
              ? "bg-primary/10 border border-primary/20"
              : "bg-green-50 dark:bg-green-950/30"
          }`}
        >
          <span className="text-lg">🎨</span>
          {isArtDirection
            ? <Loader2 className="h-4 w-4 text-primary animate-spin flex-shrink-0" />
            : <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
          }
          <span className={`text-sm font-medium ${isArtDirection ? "text-primary" : "text-green-700 dark:text-green-400"}`}>
            비주얼 기조 설계
          </span>
          <span className="text-xs text-muted-foreground ml-auto">
            {isArtDirection ? "설계 중..." : "완료"}
          </span>
        </div>

        {SECTION_DEFINITIONS.map((section, idx) => {
          let status: "done" | "active-copy" | "active-image" | "pending" | "error" = "pending";
          if (isArtDirection) {
            status = "pending";
          } else if (idx < currentSection) {
            status = "done";
          } else if (idx === currentSection) {
            if (error) status = "error";
            else status = phase === "copy" ? "active-copy" : "active-image";
          }

          return (
            <div
              key={section.id}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 ${
                status === "active-copy" || status === "active-image"
                  ? "bg-primary/10 border border-primary/20"
                  : status === "done"
                  ? "bg-green-50 dark:bg-green-950/30"
                  : status === "error"
                  ? "bg-red-50 dark:bg-red-950/30"
                  : "bg-muted/30"
              }`}
            >
              <span className="text-lg">{section.icon}</span>
              {status === "done" && <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />}
              {status === "active-copy" && <Loader2 className="h-4 w-4 text-primary animate-spin flex-shrink-0" />}
              {status === "active-image" && <Loader2 className="h-4 w-4 text-violet-500 animate-spin flex-shrink-0" />}
              {status === "error" && <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />}
              {status === "pending" && <Circle className="h-4 w-4 text-muted-foreground/30 flex-shrink-0" />}
              <span className={`text-sm font-medium ${
                status === "active-copy" ? "text-primary" : status === "active-image" ? "text-violet-600" : status === "done" ? "text-green-700 dark:text-green-400" : status === "error" ? "text-red-600" : "text-muted-foreground"
              }`}>
                {section.name}
              </span>
              <span className="text-xs text-muted-foreground ml-auto">
                {status === "active-copy" && "카피 생성 중..."}
                {status === "active-image" && "이미지 합성 중..."}
                {status === "done" && "완료"}
                {status === "pending" && "대기"}
                {status === "error" && "오류"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
