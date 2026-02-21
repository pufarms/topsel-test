import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Key, Shield, Trash2, ExternalLink, CheckCircle2, Loader2, AlertCircle, Eye, EyeOff, ArrowRight } from "lucide-react";
import { validateApiKey } from "../services/geminiService";


interface ApiKeySetupProps {
  onComplete: () => void;
}

export default function ApiKeySetup({ onComplete }: ApiKeySetupProps) {
  const { toast } = useToast();
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  const { data: keyInfo, isLoading } = useQuery<{ hasKey: boolean; maskedKey: string | null; updatedAt: string | null }>({
    queryKey: ["/api/ai-studio/api-key"],
  });

  const saveMutation = useMutation({
    mutationFn: async (apiKey: string) => {
      const res = await apiRequest("POST", "/api/ai-studio/api-key", { apiKey });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-studio/api-key"] });
      setApiKeyInput("");
      toast({ title: "API Key 저장 완료", description: "안전하게 암호화되어 저장되었습니다" });
    },
    onError: () => {
      toast({ title: "저장 실패", description: "API Key 저장 중 오류가 발생했습니다", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", "/api/ai-studio/api-key");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-studio/api-key"] });
      toast({ title: "API Key 삭제 완료" });
    },
  });

  const handleSave = async () => {
    if (!apiKeyInput.trim()) return;
    setIsValidating(true);
    try {
      const result = await validateApiKey(apiKeyInput.trim());
      if (!result.valid) {
        if (result.authError) {
          toast({ title: "로그인이 필요합니다", description: "세션이 만료되었습니다. 페이지를 새로고침 후 다시 로그인해주세요.", variant: "destructive" });
        } else {
          toast({ title: "유효하지 않은 API Key", description: "Google AI Studio에서 발급받은 올바른 Key를 입력해주세요", variant: "destructive" });
        }
        return;
      }
      saveMutation.mutate(apiKeyInput.trim());
    } catch {
      toast({ title: "검증 실패", description: "API Key 검증 중 오류가 발생했습니다", variant: "destructive" });
    } finally {
      setIsValidating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center mb-8">
        <div className="inline-flex p-4 rounded-2xl bg-primary/10 mb-4">
          <Key className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Google Gemini API Key 설정</h2>
        <p className="text-muted-foreground">AI 상세페이지 생성을 위해 API Key가 필요합니다</p>
      </div>

      {keyInfo?.hasKey ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <div>
                  <p className="font-medium">API Key 등록됨</p>
                  <p className="text-sm text-muted-foreground font-mono">{keyInfo.maskedKey}</p>
                  {keyInfo.updatedAt && (
                    <p className="text-xs text-muted-foreground mt-1">
                      마지막 수정: {new Date(keyInfo.updatedAt).toLocaleDateString("ko-KR")}
                    </p>
                  )}
                </div>
              </div>
              <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">활성</Badge>
            </div>
            <div className="flex gap-2">
              <Button onClick={onComplete} className="flex-1" data-testid="btn-continue-to-input">
                다음 단계로
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => deleteMutation.mutate()} data-testid="btn-delete-key">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              API Key 등록
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="relative">
                <Input
                  type={showKey ? "text" : "password"}
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="AIzaSy... (Google AI Studio에서 발급)"
                  className="pr-10 font-mono text-sm"
                  data-testid="input-api-key"
                />
                <button
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                <Shield className="h-3 w-3" />
                AES-256 암호화로 안전하게 저장됩니다
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                disabled={!apiKeyInput.trim() || isValidating || saveMutation.isPending}
                className="flex-1"
                data-testid="btn-save-key"
              >
                {isValidating || saveMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {isValidating ? "검증 중..." : "저장 중..."}
                  </>
                ) : (
                  "저장 및 검증"
                )}
              </Button>
              <Dialog open={guideOpen} onOpenChange={setGuideOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" data-testid="btn-guide">
                    <ExternalLink className="h-4 w-4 mr-1" />
                    발급 가이드
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>API Key 발급 방법</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 text-sm">
                    <div className="space-y-3">
                      <div className="flex gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold">1</span>
                        <p>Google AI Studio 접속: <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-primary underline">aistudio.google.com/apikey</a></p>
                      </div>
                      <div className="flex gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold">2</span>
                        <p>Google 계정으로 로그인</p>
                      </div>
                      <div className="flex gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold">3</span>
                        <p>"Create API Key" 버튼 클릭</p>
                      </div>
                      <div className="flex gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold">4</span>
                        <p>생성된 Key를 복사하여 위 입력란에 붙여넣기</p>
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 flex gap-2 text-xs">
                      <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      <p>API Key는 무료로 발급받을 수 있으며, 사용량에 따라 요금이 부과될 수 있습니다. 일반적인 사용량에서는 무료 범위 내에서 충분히 사용 가능합니다.</p>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
