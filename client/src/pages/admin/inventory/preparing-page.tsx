import { Construction } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface PreparingPageProps {
  title: string;
}

export default function PreparingPage({ title }: PreparingPageProps) {
  return (
    <div className="space-y-4 p-4">
      <h1 className="text-xl md:text-2xl font-bold">{title}</h1>
      
      <Card>
        <CardContent className="flex flex-col items-center justify-center min-h-[400px]">
          <Construction className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">준비 중입니다</h2>
          <p className="text-muted-foreground">이 기능은 곧 제공될 예정입니다.</p>
        </CardContent>
      </Card>
    </div>
  );
}
