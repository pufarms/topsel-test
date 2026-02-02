import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function OrdersCancelledPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">취소건 관리</h1>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>취소건 목록</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">취소건 관리 콘텐츠가 여기에 표시됩니다.</p>
        </CardContent>
      </Card>
    </div>
  );
}
