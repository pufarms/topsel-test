import { Card, CardContent } from "@/components/ui/card";
import { Construction } from "lucide-react";

interface PlaceholderPageProps {
  title: string;
  description?: string;
}

export default function ProductPlaceholder({ title, description }: PlaceholderPageProps) {
  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-muted">
          <Construction className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold">{title}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Construction className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold mb-2">준비 중</h2>
          <p className="text-muted-foreground text-center">
            이 기능은 2차 개발에서 구현 예정입니다.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
