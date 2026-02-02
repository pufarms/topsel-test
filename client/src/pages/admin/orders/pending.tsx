import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function OrdersPendingPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">주문 대기</h1>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>주문 대기 목록</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">주문 대기 관리 콘텐츠가 여기에 표시됩니다.</p>
        </CardContent>
      </Card>
    </div>
  );
}
