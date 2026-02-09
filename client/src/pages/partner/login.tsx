import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePartnerAuth } from "@/lib/partner-auth";
import { Loader2, Building2 } from "lucide-react";

export default function PartnerLogin() {
  const [loginId, setLoginId] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login, vendor } = usePartnerAuth();
  const [, navigate] = useLocation();

  if (vendor) {
    navigate("/partner");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await login(loginId, loginPassword);
      navigate("/partner");
    } catch (err: any) {
      const msg = err?.message || "로그인에 실패했습니다";
      try {
        const parsed = JSON.parse(msg);
        setError(parsed.message || msg);
      } catch {
        setError(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 to-cyan-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="p-3 rounded-full bg-sky-100 dark:bg-sky-900/40">
              <Building2 className="h-8 w-8 text-sky-600 dark:text-sky-400" />
            </div>
          </div>
          <CardTitle className="text-xl">탑셀러 협력업체 포털</CardTitle>
          <p className="text-sm text-muted-foreground">협력업체 전용 로그인</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="loginId">아이디</Label>
              <Input
                id="loginId"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                placeholder="아이디를 입력하세요"
                autoComplete="username"
                data-testid="input-login-id"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="loginPassword">비밀번호</Label>
              <Input
                id="loginPassword"
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="비밀번호를 입력하세요"
                autoComplete="current-password"
                data-testid="input-login-password"
              />
            </div>
            {error && (
              <p className="text-sm text-destructive" data-testid="text-login-error">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={isSubmitting || !loginId || !loginPassword} data-testid="button-login-submit">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              로그인
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
