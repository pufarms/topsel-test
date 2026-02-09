import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Truck, Package, CheckCircle, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";

interface DeliverySummary {
  totalSent: number;
  inTransit: number;
  delivered: number;
  deliveryRate: number;
}

const courierTrackingUrls: Record<string, string> = {
  "CJ대한통운": "https://trace.cjlogistics.com/web/detail.jsp?slipno=",
  "한진택배": "https://www.hanjin.com/kor/CMS/DeliveryMgr/WaybillResult.do?mession-id=",
  "롯데택배": "https://www.lotteglogis.com/home/reservation/tracking/link498?InvNo=",
  "우체국택배": "https://service.epost.go.kr/trace.RetrieveDomRi498.comm?sid1=",
  "경동택배": "https://kdexp.com/service/info/deliveryInfo.do?barcode=",
};

const statusBadge: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  "상품준비중": { label: "운송장등록", variant: "outline" },
  "배송준비중": { label: "운송장등록", variant: "outline" },
  "배송중": { label: "배송중", variant: "default" },
  "배송완료": { label: "배송완료", variant: "default" },
};

export default function PartnerDelivery() {
  const today = new Date().toISOString().split("T")[0];
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
  const [startDate, setStartDate] = useState(weekAgo);
  const [endDate, setEndDate] = useState(today);
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [period, setPeriod] = useState("today");

  const { data: summary, isLoading: loadingSummary } = useQuery<DeliverySummary>({
    queryKey: ["/api/partner/delivery/summary", period],
    queryFn: async () => {
      const res = await fetch(`/api/partner/delivery/summary?period=${period}`, { credentials: "include" });
      if (!res.ok) throw new Error("조회 실패");
      return res.json();
    },
  });

  const queryParams = new URLSearchParams({
    startDate, endDate, status, search, page: String(page), limit: "50",
  }).toString();

  const { data: deliveryData, isLoading: loadingList } = useQuery({
    queryKey: ["/api/partner/delivery", queryParams],
    queryFn: async () => {
      const res = await fetch(`/api/partner/delivery?${queryParams}`, { credentials: "include" });
      if (!res.ok) throw new Error("조회 실패");
      return res.json();
    },
  });

  const orders = deliveryData?.orders || [];
  const total = deliveryData?.total || 0;
  const totalPages = Math.ceil(total / 50);

  const openTracking = (courier: string, trackingNum: string) => {
    const baseUrl = courierTrackingUrls[courier];
    if (baseUrl) {
      window.open(baseUrl + trackingNum, "_blank");
    }
  };

  return (
    <div className="space-y-4 pb-20 lg:pb-0">
      <h1 className="text-xl font-bold" data-testid="text-delivery-title">배송 현황</h1>

      <div className="flex gap-1 mb-2">
        {[
          { key: "today", label: "오늘" },
          { key: "week", label: "이번주" },
          { key: "month", label: "이번달" },
        ].map(p => (
          <Button
            key={p.key}
            size="sm"
            variant={period === p.key ? "default" : "outline"}
            onClick={() => setPeriod(p.key)}
            data-testid={`button-period-${p.key}`}
          >
            {p.label}
          </Button>
        ))}
      </div>

      {loadingSummary ? (
        <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-3 text-center">
              <Package className="h-5 w-5 mx-auto mb-1 text-blue-500" />
              <div className="text-xl font-bold">{summary.totalSent}</div>
              <div className="text-xs text-muted-foreground">총 발송</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <Truck className="h-5 w-5 mx-auto mb-1 text-amber-500" />
              <div className="text-xl font-bold">{summary.inTransit}</div>
              <div className="text-xs text-muted-foreground">배송중</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <CheckCircle className="h-5 w-5 mx-auto mb-1 text-green-500" />
              <div className="text-xl font-bold">{summary.delivered}</div>
              <div className="text-xs text-muted-foreground">배송완료</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <div className="text-xl font-bold">{summary.deliveryRate}%</div>
              <div className="text-xs text-muted-foreground">완료율</div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap gap-2 items-end">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">시작일</label>
              <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); }} className="w-36" data-testid="input-delivery-start" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">종료일</label>
              <Input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); }} className="w-36" data-testid="input-delivery-end" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">상태</label>
              <select
                className="h-9 px-3 rounded-md border text-sm bg-background"
                value={status}
                onChange={(e) => { setStatus(e.target.value); setPage(1); }}
                data-testid="select-delivery-status"
              >
                <option value="all">전체</option>
                <option value="배송중">배송중</option>
                <option value="배송완료">배송완료</option>
              </select>
            </div>
            <div className="space-y-1 flex-1 min-w-[120px]">
              <label className="text-xs text-muted-foreground">검색</label>
              <Input placeholder="수취인명/주문번호" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="input-delivery-search" />
            </div>
          </div>
        </CardContent>
      </Card>

      {loadingList ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : orders.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            조회된 배송 데이터가 없습니다.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left py-2 px-3">주문번호</th>
                    <th className="text-left py-2 px-3">수취인</th>
                    <th className="text-left py-2 px-3">상품명</th>
                    <th className="text-left py-2 px-3">택배사</th>
                    <th className="text-left py-2 px-3">운송장번호</th>
                    <th className="text-center py-2 px-3">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o: any) => {
                    const sb = statusBadge[o.status] || { label: o.status, variant: "secondary" as const };
                    const hasTracking = o.courierCompany && courierTrackingUrls[o.courierCompany];
                    return (
                      <tr key={o.id} className="border-b" data-testid={`row-delivery-${o.id}`}>
                        <td className="py-2 px-3 font-mono text-xs">{o.id}</td>
                        <td className="py-2 px-3">{o.recipientName}</td>
                        <td className="py-2 px-3">{o.productName}</td>
                        <td className="py-2 px-3">{o.courierCompany}</td>
                        <td className="py-2 px-3">
                          {hasTracking ? (
                            <button
                              className="font-mono text-xs text-sky-600 hover:underline flex items-center gap-1"
                              onClick={() => openTracking(o.courierCompany, o.trackingNumber)}
                              data-testid={`link-tracking-${o.id}`}
                            >
                              {o.trackingNumber} <ExternalLink className="h-3 w-3" />
                            </button>
                          ) : (
                            <span className="font-mono text-xs">{o.trackingNumber}</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center"><Badge variant={sb.variant}>{sb.label}</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="md:hidden space-y-2 p-3">
              {orders.map((o: any) => {
                const sb = statusBadge[o.status] || { label: o.status, variant: "secondary" as const };
                return (
                  <Card key={o.id}>
                    <CardContent className="p-3 space-y-1">
                      <div className="flex justify-between items-start">
                        <span className="font-mono text-xs text-muted-foreground">{o.id}</span>
                        <Badge variant={sb.variant}>{sb.label}</Badge>
                      </div>
                      <div className="text-sm font-medium">{o.productName}</div>
                      <div className="text-xs">{o.recipientName} | {o.courierCompany}</div>
                      <div className="text-xs font-mono">{o.trackingNumber}</div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">{page} / {totalPages}</span>
          <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
