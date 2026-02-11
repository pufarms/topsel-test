import { Card, CardContent } from "@/components/ui/card";
import { DollarSign } from "lucide-react";

export default function SalesOverviewTab() {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <DollarSign className="h-12 w-12 mb-4 opacity-30" />
          <h3 className="text-lg font-medium mb-2">매출 현황</h3>
          <p className="text-sm">사이트 매출 자동연동 + 직접 매출 관리 + 세금계산서 기능이 준비 중입니다.</p>
        </div>
      </CardContent>
    </Card>
  );
}
