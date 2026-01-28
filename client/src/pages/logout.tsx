import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { PublicHeader } from "@/components/public/PublicHeader";
import type { Page } from "@shared/schema";

interface LogoutPageContent {
  title?: string;
  description?: string;
  messages?: {
    success_title?: string;
    success_description?: string;
  };
}

export default function Logout() {
  const [, navigate] = useLocation();
  const { logout, user } = useAuth();
  const { toast } = useToast();
  const [isLoggingOut, setIsLoggingOut] = useState(true);

  const { data: pageData } = useQuery<Page>({
    queryKey: ["/api/pages/by-path", { path: "/logout" }],
    queryFn: async () => {
      const res = await fetch("/api/pages/by-path?path=/logout");
      if (!res.ok) throw new Error("Failed to fetch page");
      return res.json();
    },
  });

  const content = (pageData?.content as LogoutPageContent) || {};
  const messages = content.messages || {};

  useEffect(() => {
    const performLogout = async () => {
      if (user) {
        try {
          await logout();
          toast({
            title: messages.success_title || "로그아웃 완료",
            description: messages.success_description || "안녕히 가세요!",
          });
        } catch (error) {
          console.error("Logout error:", error);
        }
      }
      setTimeout(() => {
        navigate("/");
      }, 1500);
    };

    performLogout();
  }, [user, logout, navigate, toast, messages.success_title, messages.success_description]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PublicHeader />

      <main className="flex-1 flex items-center justify-center p-6 pt-24">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">{content.title || "로그아웃"}</CardTitle>
            <CardDescription>{content.description || "로그아웃 처리 중..."}</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center py-8">
            {isLoggingOut && <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
