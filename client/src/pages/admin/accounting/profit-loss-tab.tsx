import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";

export default function ProfitLossTab() {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <TrendingUp className="h-12 w-12 mb-4 opacity-30" />
          <h3 className="text-lg font-medium mb-2">손익 현황</h3>
          <p className="text-sm">매출 - 매입 = 이익 분석 및 차트 기능이 준비 중입니다.</p>
        </div>
      </CardContent>
    </Card>
  );
}
