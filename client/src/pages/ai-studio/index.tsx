import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles } from "lucide-react";
import type { AppStep, ProductInfo, SectionData, CopyVariant, TextLayer } from "./types";
import LandingHero from "./components/LandingHero";
import ApiKeySetup from "./components/ApiKeySetup";
import ProductInfoForm from "./components/ProductInfoForm";
import GeneratingProgress from "./components/GeneratingProgress";
import SectionEditor from "./components/SectionEditor";
import PreviewPage from "./components/PreviewPage";
import { generateAllSections } from "./services/geminiService";

export default function AIStudioApp() {
  const { toast } = useToast();
  const [step, setStep] = useState<AppStep>("landing");
  const [product, setProduct] = useState<ProductInfo | null>(null);
  const [sections, setSections] = useState<SectionData[]>([]);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [generatingSection, setGeneratingSection] = useState(0);
  const [generatingSectionName, setGeneratingSectionName] = useState("");
  const [generatingPhase, setGeneratingPhase] = useState<"copy" | "image">("copy");

  const handleStart = () => setStep("api-key");
  const handleApiKeyComplete = () => setStep("input");

  const handleGenerate = useCallback(async (productInfo: ProductInfo) => {
    setProduct(productInfo);
    setStep("generating");
    setGeneratingSection(0);
    setGeneratingPhase("copy");

    try {
      const results = await generateAllSections(
        productInfo,
        productInfo.imageBase64,
        (idx, name, phase) => {
          setGeneratingSection(idx);
          setGeneratingSectionName(name);
          setGeneratingPhase(phase);
        }
      );

      setSections(results);
      setStep("editor");
      toast({ title: "생성 완료!", description: "8개 섹션의 카피와 이미지가 생성되었습니다" });
    } catch (error: any) {
      toast({ title: "생성 실패", description: error?.message || "AI 생성 중 오류가 발생했습니다", variant: "destructive" });
      setStep("input");
    }
  }, [toast]);

  const handleSelectCopy = (sectionIdx: number, copyIdx: number) => {
    setSections((prev) =>
      prev.map((s, i) => (i === sectionIdx ? { ...s, selectedCopyIndex: copyIdx, editedCopy: null } : s))
    );
  };

  const handleEditCopy = (sectionIdx: number, editedCopy: CopyVariant) => {
    setSections((prev) =>
      prev.map((s, i) => (i === sectionIdx ? { ...s, editedCopy } : s))
    );
  };

  const handleUpdateTextLayers = (sectionIdx: number, textLayers: TextLayer[]) => {
    setSections((prev) =>
      prev.map((s, i) => (i === sectionIdx ? { ...s, textLayers } : s))
    );
  };

  const stepHeader = step !== "landing" && step !== "generating" && step !== "preview" && (
    <div className="flex items-center justify-between mb-6 pb-4 border-b">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500/10 to-violet-500/10">
          <Sparkles className="h-5 w-5 text-cyan-600" />
        </div>
        <div>
          <h1 className="font-bold text-lg">AI 상세페이지 마법사</h1>
          <p className="text-xs text-muted-foreground">
            {step === "api-key" && "1단계: API Key 설정"}
            {step === "input" && "2단계: 제품 정보 입력"}
            {step === "editor" && "3단계: 이미지 + 카피 편집"}
          </p>
        </div>
      </div>
      {step === "editor" && (
        <Button variant="ghost" size="sm" onClick={() => setStep("input")} data-testid="btn-restart">
          <ArrowLeft className="h-4 w-4 mr-1" />
          처음부터
        </Button>
      )}
    </div>
  );

  return (
    <div className={step === "editor" ? "" : "p-4 md:p-6"}>
      {stepHeader}

      {step === "landing" && <LandingHero onStart={handleStart} />}
      {step === "api-key" && <ApiKeySetup onComplete={handleApiKeyComplete} />}
      {step === "input" && (
        <ProductInfoForm
          onSubmit={handleGenerate}
          onBack={() => setStep("api-key")}
        />
      )}
      {step === "generating" && (
        <GeneratingProgress
          currentSection={generatingSection}
          totalSections={8}
          sectionName={generatingSectionName}
          phase={generatingPhase}
        />
      )}
      {step === "editor" && product && (
        <SectionEditor
          sections={sections}
          currentSectionIndex={currentSectionIndex}
          onSectionChange={setCurrentSectionIndex}
          onSelectCopy={handleSelectCopy}
          onEditCopy={handleEditCopy}
          onUpdateTextLayers={handleUpdateTextLayers}
          onPreview={() => setStep("preview")}
        />
      )}
      {step === "preview" && product && (
        <PreviewPage
          sections={sections}
          product={product}
          onBack={() => setStep("editor")}
        />
      )}
    </div>
  );
}
