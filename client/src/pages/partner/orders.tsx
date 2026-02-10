import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, Search, ChevronLeft, ChevronRight } from "lucide-react";

interface OrdersResponse {
  orders: any[];
  total: number;
  page: number;
  limit: number;
  statusCounts: Record<string, number>;
}

function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const cleaned = phone.replace(/[^0-9-]/g, "");
  if (cleaned && !cleaned.startsWith("0")) {
    return "0" + cleaned;
  }
  return cleaned;
}

const statusBadge: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  "상품준비중": { label: "상품준비중", variant: "outline" },
  "배송준비중": { label: "배송준비중", variant: "secondary" },
  "배송중": { label: "배송중", variant: "default" },
};

export default function PartnerOrders() {
  const today = new Date().toISOString().split("T")[0];
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const queryParams = new URLSearchParams({
    startDate, endDate, status, search, page: String(page), limit: "50",
  }).toString();

  const { data, isLoading } = useQuery<OrdersResponse>({
    queryKey: ["/api/partner/orders", queryParams],
    queryFn: async () => {
      const res = await fetch(`/api/partner/orders?${queryParams}`, { credentials: "include" });
      if (!res.ok) throw new Error("조회 실패");
      return res.json();
    },
  });

  const handleDownload = () => {
    const params = new URLSearchParams({ startDate, endDate, status }).toString();
    window.open(`/api/partner/orders/download?${params}`, "_blank");
  };

  const orders = data?.orders || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / 50);

  return (
    <div className="space-y-4 pb-20 lg:pb-0">
      <h1 className="text-xl font-bold" data-testid="text-orders-title">주문 현황</h1>

      <Card>
        <CardContent className="p-3 space-y-3">
          <div className="flex flex-wrap gap-2 items-end">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">시작일</label>
              <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); }} className="w-36" data-testid="input-start-date" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">종료일</label>
              <Input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); }} className="w-36" data-testid="input-end-date" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">상태</label>
              <select
                className="h-9 px-3 rounded-md border text-sm bg-background"
                value={status}
                onChange={(e) => { setStatus(e.target.value); setPage(1); }}
                data-testid="select-status"
              >
                <option value="all">전체</option>
                <option value="상품준비중">상품준비중</option>
                <option value="배송준비중">배송준비중</option>
                <option value="배송중">배송중</option>
              </select>
            </div>
            <div className="space-y-1 flex-1 min-w-[120px]">
              <label className="text-xs text-muted-foreground">검색</label>
              <div className="flex gap-1">
                <Input placeholder="상품명/수취인명/주문번호" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="input-search" />
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={handleDownload} data-testid="button-download">
              <Download className="h-4 w-4 mr-1" />엑셀
            </Button>
          </div>
          {data?.statusCounts && (
            <div className="flex gap-2 flex-wrap text-xs text-muted-foreground">
              <span>총 {total}건</span>
              {Object.entries(data.statusCounts).map(([s, c]) => (
                <span key={s}>| {s}: {c}건</span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : orders.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            조회된 주문이 없습니다.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b bg-muted/30">
                    <th className="text-left py-2 px-2 whitespace-nowrap">주문자명</th>
                    <th className="text-left py-2 px-2 whitespace-nowrap">주문자 전화번호</th>
                    <th className="text-left py-2 px-2 whitespace-nowrap">주문자 주소</th>
                    <th className="text-left py-2 px-2 whitespace-nowrap">수령자명</th>
                    <th className="text-left py-2 px-2 whitespace-nowrap">수령자 휴대폰번호</th>
                    <th className="text-left py-2 px-2 whitespace-nowrap">수령자 전화번호</th>
                    <th className="text-left py-2 px-2 whitespace-nowrap">수령자 주소</th>
                    <th className="text-left py-2 px-2 whitespace-nowrap">배송메시지</th>
                    <th className="text-left py-2 px-2 whitespace-nowrap">상품코드</th>
                    <th className="text-left py-2 px-2 whitespace-nowrap">상품명</th>
                    <th className="text-right py-2 px-2 whitespace-nowrap">수량</th>
                    <th className="text-left py-2 px-2 whitespace-nowrap">주문번호</th>
                    <th className="text-left py-2 px-2 whitespace-nowrap">운송장번호</th>
                    <th className="text-left py-2 px-2 whitespace-nowrap">택배사</th>
                    <th className="text-center py-2 px-2 whitespace-nowrap">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o: any) => {
                    const sb = statusBadge[o.status] || { label: o.status, variant: "secondary" as const };
                    const fullAddress = [o.address, o.addressDetail].filter(Boolean).join(" ");
                    const ordererFullAddress = o.ordererAddress || "";
                    return (
                      <tr key={o.id} className="border-b" data-testid={`row-order-${o.id}`}>
                        <td className="py-2 px-2 whitespace-nowrap">{o.ordererName || ""}</td>
                        <td className="py-2 px-2 text-xs whitespace-nowrap">{formatPhone(o.ordererPhone)}</td>
                        <td className="py-2 px-2 text-xs max-w-[150px] truncate" title={ordererFullAddress}>{ordererFullAddress}</td>
                        <td className="py-2 px-2 whitespace-nowrap">{o.recipientName || ""}</td>
                        <td className="py-2 px-2 text-xs whitespace-nowrap">{formatPhone(o.recipientMobile)}</td>
                        <td className="py-2 px-2 text-xs whitespace-nowrap">{formatPhone(o.recipientPhone)}</td>
                        <td className="py-2 px-2 text-xs max-w-[180px] truncate" title={o.recipientAddress || ""}>{o.recipientAddress || ""}</td>
                        <td className="py-2 px-2 text-xs max-w-[120px] truncate" title={o.deliveryMessage || ""}>{o.deliveryMessage || ""}</td>
                        <td className="py-2 px-2 font-mono text-xs whitespace-nowrap">{o.productCode || ""}</td>
                        <td className="py-2 px-2 whitespace-nowrap">{o.productName || ""}</td>
                        <td className="py-2 px-2 text-right whitespace-nowrap">{o.quantity || 1}</td>
                        <td className="py-2 px-2 font-mono text-xs whitespace-nowrap">{o.orderNumber || ""}</td>
                        <td className="py-2 px-2 font-mono text-xs whitespace-nowrap">{o.trackingNumber || ""}</td>
                        <td className="py-2 px-2 text-xs whitespace-nowrap">{o.courierCompany || ""}</td>
                        <td className="py-2 px-2 text-center whitespace-nowrap"><Badge variant={sb.variant}>{sb.label}</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="md:hidden space-y-2 p-3">
              {orders.map((o: any) => {
                const sb = statusBadge[o.status] || { label: o.status, variant: "secondary" as const };
                const fullAddress = [o.address, o.addressDetail].filter(Boolean).join(" ");
                return (
                  <Card key={o.id} data-testid={`card-order-${o.id}`}>
                    <CardContent className="p-3 space-y-1">
                      <div className="flex justify-between items-start gap-2">
                        <span className="font-mono text-xs text-muted-foreground">{o.orderNumber}</span>
                        <Badge variant={sb.variant}>{sb.label}</Badge>
                      </div>
                      <div className="font-medium text-sm">{o.productName} x{o.quantity || 1}</div>
                      <div className="text-xs text-muted-foreground">{o.productCode}</div>
                      <div className="text-xs">주문자: {o.ordererName} {formatPhone(o.ordererPhone)}</div>
                      <div className="text-xs">수령자: {o.recipientName} {formatPhone(o.recipientMobile)}</div>
                      <div className="text-xs text-muted-foreground">{o.recipientAddress}</div>
                      {o.deliveryMessage && <div className="text-xs text-muted-foreground">배송메시지: {o.deliveryMessage}</div>}
                      {o.trackingNumber && <div className="text-xs">운송장: {o.courierCompany} {o.trackingNumber}</div>}
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
