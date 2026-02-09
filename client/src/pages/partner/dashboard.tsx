import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { usePartnerAuth } from "@/lib/partner-auth";
import { Loader2, MessageSquareReply, ClipboardList, ScanBarcode, Truck } from "lucide-react";
import { Link } from "wouter";

interface DashboardData {
  pendingAllocations: number;
  unprocessedOrders: number;
  unregisteredTracking: number;
  inShipping: number;
}

export default function PartnerDashboard() {
  const { vendor } = usePartnerAuth();
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["/api/partner/dashboard"],
  });

  const cards = [
    { label: "응답 대기 배분", value: data?.pendingAllocations || 0, icon: MessageSquareReply, href: "/partner/allocations", color: "text-amber-600" },
    { label: "미처리 주문", value: data?.unprocessedOrders || 0, icon: ClipboardList, href: "/partner/orders", color: "text-blue-600" },
    { label: "미등록 운송장", value: data?.unregisteredTracking || 0, icon: ScanBarcode, href: "/partner/tracking", color: "text-orange-600" },
    { label: "배송 중", value: data?.inShipping || 0, icon: Truck, href: "/partner/delivery", color: "text-green-600" },
  ];

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <div>
        <h1 className="text-xl font-bold" data-testid="text-dashboard-title">안녕하세요, {vendor?.companyName}님</h1>
        <p className="text-sm text-muted-foreground mt-1">오늘의 업무 현황을 확인하세요.</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {cards.map((card) => (
            <Link key={card.href} href={card.href}>
              <Card className="cursor-pointer hover-elevate" data-testid={`card-${card.href.split("/").pop()}`}>
                <CardContent className="p-4 text-center">
                  <card.icon className={`h-6 w-6 mx-auto mb-2 ${card.color}`} />
                  <div className="text-2xl font-bold">{card.value}</div>
                  <div className="text-xs text-muted-foreground mt-1">{card.label}</div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
