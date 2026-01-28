import { useEffect } from "react";

export default function Register() {
  useEffect(() => {
    window.location.href = "/signup.html";
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">회원가입 페이지로 이동 중...</p>
      </div>
    </div>
  );
}
