import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function OrdersShippingPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">배송중</h1>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>배송중 목록</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">배송중 관리 콘텐츠가 여기에 표시됩니다.</p>
        </CardContent>
      </Card>
    </div>
  );
}
