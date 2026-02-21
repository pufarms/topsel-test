import { SECTION_DEFINITIONS } from "../types";
import { Loader2, CheckCircle2, Circle, AlertCircle, Sparkles } from "lucide-react";

interface GeneratingProgressProps {
  currentSection: number;
  totalSections: number;
  sectionName: string;
  error?: string;
}

export default function GeneratingProgress({ currentSection, totalSections, sectionName, error }: GeneratingProgressProps) {
  const progress = Math.round(((currentSection) / totalSections) * 100);

  return (
    <div className="max-w-2xl mx-auto py-12">
      <div className="text-center mb-10">
        <div className="inline-flex p-4 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-violet-500/20 mb-4 relative">
          <Sparkles className="h-8 w-8 text-cyan-500 animate-pulse" />
          <div className="absolute inset-0 rounded-2xl bg-cyan-500/10 animate-ping" style={{ animationDuration: "2s" }} />
        </div>
        <h2 className="text-2xl font-bold mb-2">AI가 카피를 생성하고 있습니다</h2>
        <p className="text-muted-foreground">
          {error ? "일부 섹션에서 오류가 발생했습니다" : `${sectionName} 섹션을 작성 중입니다...`}
        </p>
      </div>

      <div className="mb-8">
        <div className="flex justify-between text-sm text-muted-foreground mb-2">
          <span>{currentSection} / {totalSections} 섹션</span>
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
        {SECTION_DEFINITIONS.map((section, idx) => {
          let status: "done" | "active" | "pending" | "error" = "pending";
          if (idx < currentSection) status = "done";
          else if (idx === currentSection) status = error ? "error" : "active";

          return (
            <div
              key={section.id}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 ${
                status === "active"
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
              {status === "active" && <Loader2 className="h-4 w-4 text-primary animate-spin flex-shrink-0" />}
              {status === "error" && <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />}
              {status === "pending" && <Circle className="h-4 w-4 text-muted-foreground/30 flex-shrink-0" />}
              <span className={`text-sm font-medium ${
                status === "active" ? "text-primary" : status === "done" ? "text-green-700 dark:text-green-400" : status === "error" ? "text-red-600" : "text-muted-foreground"
              }`}>
                {section.name}
              </span>
              <span className="text-xs text-muted-foreground ml-auto">{section.description}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
