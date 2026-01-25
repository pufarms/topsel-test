import { useQuery } from "@tanstack/react-query";
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

export default function Home() {
  const { data: page, isLoading } = useQuery<Page>({
    queryKey: ["/api/pages/by-path", "/"],
    queryFn: async () => {
      const res = await fetch(`/api/pages/by-path?path=${encodeURIComponent("/")}`);
      if (!res.ok) {
        throw new Error("Page not found");
      }
      return res.json();
    },
    retry: false,
  });

  const hasHeroBanner = page?.content?.sections?.[0]?.type === "hero";

  if (isLoading) {
    return (
      <PublicLayout>
        <div className="flex items-center justify-center min-h-[400px]" data-testid="loading-spinner">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout transparentHeader={hasHeroBanner} hasHeroBanner={hasHeroBanner}>
      <div className="min-h-[400px]" data-testid="home-page">
        {page?.content ? (
          <DynamicPageRenderer content={page.content} />
        ) : (
          <div className="container mx-auto py-12 px-4 text-center">
            <h1 className="text-4xl font-bold mb-4">탑셀러</h1>
            <p className="text-muted-foreground">B2B 과일 도매 플랫폼</p>
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
