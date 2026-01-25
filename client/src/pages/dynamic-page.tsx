import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Loader2 } from "lucide-react";
import { DynamicPageRenderer } from "@/components/dynamic-page-renderer";
import { PublicLayout } from "@/components/public";
import type { PageContent } from "@shared/schema";

interface Page {
  id: string;
  name: string;
  path: string;
  description?: string;
  status: string;
  accessLevel: string;
  content?: PageContent;
}

export default function DynamicPage() {
  const [, params] = useRoute("/:path*");
  const fullPath = "/" + ((params as Record<string, string>)?.["path*"] || "");
  
  const { data: page, isLoading, error } = useQuery<Page>({
    queryKey: ["/api/pages/by-path", fullPath],
    queryFn: async () => {
      const res = await fetch(`/api/pages/by-path?path=${encodeURIComponent(fullPath)}`);
      if (!res.ok) {
        throw new Error("Page not found");
      }
      return res.json();
    },
    retry: false,
  });

  if (isLoading) {
    return (
      <PublicLayout>
        <div className="flex items-center justify-center min-h-[400px]" data-testid="loading-spinner">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </PublicLayout>
    );
  }

  if (error || !page) {
    return (
      <PublicLayout>
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center" data-testid="page-not-found">
          <h1 className="text-4xl font-bold mb-4">404</h1>
          <p className="text-muted-foreground">페이지를 찾을 수 없습니다.</p>
        </div>
      </PublicLayout>
    );
  }

  if (page.status !== "active") {
    return (
      <PublicLayout>
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center" data-testid="page-not-available">
          <h1 className="text-2xl font-bold mb-4">페이지 준비 중</h1>
          <p className="text-muted-foreground">이 페이지는 현재 이용할 수 없습니다.</p>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="min-h-[400px]" data-testid={`dynamic-page-${page.id}`}>
        {page.content ? (
          <DynamicPageRenderer content={page.content} />
        ) : (
          <div className="container mx-auto py-12 px-4">
            <h1 className="text-3xl font-bold mb-4">{page.name}</h1>
            {page.description && (
              <p className="text-muted-foreground">{page.description}</p>
            )}
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
