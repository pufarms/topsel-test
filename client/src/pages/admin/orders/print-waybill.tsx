import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import OrderStatsBanner from "@/components/order-stats-banner";

export default function OrdersPrintWaybillPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">운송장 출력</h1>
      </div>
      
      <OrderStatsBanner />
      
      <Card>
        <CardHeader>
          <CardTitle>운송장 출력 목록</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">운송장 출력 관리 콘텐츠가 여기에 표시됩니다.</p>
        </CardContent>
      </Card>
    </div>
  );
}
