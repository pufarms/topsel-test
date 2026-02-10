import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";

interface OrdersResponse {
  orders: any[];
  total: number;
  page: number;
  limit: number;
  statusCounts: Record<string, number>;
}

function cleanDeliveryMessage(msg: string | null | undefined): string {
  if (!msg) return "";
  return msg.replace(/\[주소확인필요:[^\]]*\]/g, "").trim();
}

function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const cleaned = phone.replace(/[^0-9-]/g, "");
  if (cleaned && !cleaned.startsWith("0")) {
    return "0" + cleaned;
  }
  return cleaned;
}

type PeriodKey = "today" | "yesterday" | "thisWeek" | "thisMonth" | "custom";
type SearchType = "productName" | "recipientName" | "trackingNumber" | "orderNumber";

const periodOptions: { key: PeriodKey; label: string }[] = [
  { key: "today", label: "오늘" },
  { key: "yesterday", label: "어제" },
  { key: "thisWeek", label: "이번주" },
  { key: "thisMonth", label: "이달" },
  { key: "custom", label: "기간설정" },
];

const searchTypeOptions: { key: SearchType; label: string }[] = [
  { key: "productName", label: "상품명" },
  { key: "recipientName", label: "수령자명" },
  { key: "trackingNumber", label: "운송장번호" },
  { key: "orderNumber", label: "주문번호" },
];

function getDateRange(period: PeriodKey): { start: string; end: string } {
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().split("T")[0];

  switch (period) {
    case "today":
      return { start: fmt(now), end: fmt(now) };
    case "yesterday": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { start: fmt(y), end: fmt(y) };
    }
    case "thisWeek": {
      const day = now.getDay();
      const diff = day === 0 ? 6 : day - 1;
      const mon = new Date(now);
      mon.setDate(mon.getDate() - diff);
      return { start: fmt(mon), end: fmt(now) };
    }
    case "thisMonth": {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: fmt(first), end: fmt(now) };
    }
    default:
      return { start: fmt(now), end: fmt(now) };
  }
}

export default function PartnerTracking() {
  const [period, setPeriod] = useState<PeriodKey>("today");
  const initRange = getDateRange("today");
  const [customStartDate, setCustomStartDate] = useState(initRange.start);
  const [customEndDate, setCustomEndDate] = useState(initRange.end);
  const [searchType, setSearchType] = useState<SearchType>("productName");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const dateRange = period === "custom"
    ? { start: customStartDate, end: customEndDate }
    : getDateRange(period);

  const queryParams = new URLSearchParams({
    startDate: dateRange.start,
    endDate: dateRange.end,
    status: "배송준비중",
    search,
    searchType,
    page: String(page),
    limit: "50",
  }).toString();

  const { data, isLoading } = useQuery<OrdersResponse>({
    queryKey: ["/api/partner/orders", "tracking-tab", queryParams],
    queryFn: async () => {
      const res = await fetch(`/api/partner/orders?${queryParams}`, { credentials: "include" });
      if (!res.ok) throw new Error("조회 실패");
      return res.json();
    },
  });

  const handlePeriodChange = (key: PeriodKey) => {
    setPeriod(key);
    setPage(1);
    if (key !== "custom") {
      const range = getDateRange(key);
      setCustomStartDate(range.start);
      setCustomEndDate(range.end);
    }
  };

  const orders = data?.orders || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / 50);

  return (
    <div className="space-y-4 pb-20 lg:pb-0">
      <h1 className="text-xl font-bold" data-testid="text-tracking-title">운송장 등록 리스트</h1>

      <Card>
        <CardContent className="p-3 space-y-3">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">기간</label>
            <div className="flex flex-wrap gap-1">
              {periodOptions.map((p) => (
                <Button
                  key={p.key}
                  size="sm"
                  variant={period === p.key ? "default" : "outline"}
                  onClick={() => handlePeriodChange(p.key)}
                  data-testid={`button-period-${p.key}`}
                >
                  {p.label}
                </Button>
              ))}
            </div>
            {period === "custom" && (
              <div className="flex flex-wrap gap-2 items-center">
                <Input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => { setCustomStartDate(e.target.value); setPage(1); }}
                  className="w-36"
                  data-testid="input-tracking-start-date"
                />
                <span className="text-xs text-muted-foreground">~</span>
                <Input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => { setCustomEndDate(e.target.value); setPage(1); }}
                  className="w-36"
                  data-testid="input-tracking-end-date"
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">검색</label>
            <div className="flex flex-wrap gap-2">
              <select
                className="h-9 px-3 rounded-md border text-sm bg-background"
                value={searchType}
                onChange={(e) => { setSearchType(e.target.value as SearchType); setPage(1); }}
                data-testid="select-search-type"
              >
                {searchTypeOptions.map((opt) => (
                  <option key={opt.key} value={opt.key}>{opt.label}</option>
                ))}
              </select>
              <div className="flex-1 min-w-[150px]">
                <Input
                  placeholder={searchTypeOptions.find(o => o.key === searchType)?.label + " 검색"}
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  data-testid="input-tracking-search"
                />
              </div>
            </div>
          </div>

          <div className="text-xs text-muted-foreground">총 {total}건</div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : orders.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            운송장 등록된 주문이 없습니다.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="hidden md:block border rounded-md overflow-x-auto" style={{ maxWidth: "100%" }}>
            <table className="text-sm" style={{ minWidth: "1800px", width: "1800px" }}>
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
                {orders.map((o: any) => (
                  <tr key={o.id} className="border-b" data-testid={`row-tracking-${o.id}`}>
                    <td className="py-2 px-2 whitespace-nowrap">{o.ordererName || ""}</td>
                    <td className="py-2 px-2 text-xs whitespace-nowrap">{formatPhone(o.ordererPhone)}</td>
                    <td className="py-2 px-2 text-xs whitespace-nowrap">{o.ordererAddress || ""}</td>
                    <td className="py-2 px-2 whitespace-nowrap">{o.recipientName || ""}</td>
                    <td className="py-2 px-2 text-xs whitespace-nowrap">{formatPhone(o.recipientMobile)}</td>
                    <td className="py-2 px-2 text-xs whitespace-nowrap">{formatPhone(o.recipientPhone)}</td>
                    <td className="py-2 px-2 text-xs whitespace-nowrap">{o.recipientAddress || ""}</td>
                    <td className="py-2 px-2 text-xs whitespace-nowrap">{cleanDeliveryMessage(o.deliveryMessage)}</td>
                    <td className="py-2 px-2 font-mono text-xs whitespace-nowrap">{o.productCode || ""}</td>
                    <td className="py-2 px-2 whitespace-nowrap">{o.productName || ""}</td>
                    <td className="py-2 px-2 text-right whitespace-nowrap">{o.quantity || 1}</td>
                    <td className="py-2 px-2 font-mono text-xs whitespace-nowrap">{o.customOrderNumber || ""}</td>
                    <td className="py-2 px-2 font-mono text-xs whitespace-nowrap">{o.trackingNumber || ""}</td>
                    <td className="py-2 px-2 text-xs whitespace-nowrap">{o.courierCompany || ""}</td>
                    <td className="py-2 px-2 text-center whitespace-nowrap">
                      <Badge className="bg-blue-500 text-white border-blue-500">운송장 완료</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="md:hidden space-y-2 p-3">
            {orders.map((o: any) => (
              <Card key={o.id} data-testid={`card-tracking-${o.id}`}>
                <CardContent className="p-3 space-y-1">
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{o.customOrderNumber}</span>
                    <Badge className="bg-blue-500 text-white border-blue-500">운송장 완료</Badge>
                  </div>
                  <div className="font-medium text-sm">{o.productName} x{o.quantity || 1}</div>
                  <div className="text-xs text-muted-foreground">{o.productCode}</div>
                  <div className="text-xs">주문자: {o.ordererName} {formatPhone(o.ordererPhone)}</div>
                  <div className="text-xs">수령자: {o.recipientName} {formatPhone(o.recipientMobile)}</div>
                  <div className="text-xs text-muted-foreground">{o.recipientAddress}</div>
                  {cleanDeliveryMessage(o.deliveryMessage) && <div className="text-xs text-muted-foreground">배송메시지: {cleanDeliveryMessage(o.deliveryMessage)}</div>}
                  <div className="text-xs">
                    운송장: {o.courierCompany} {o.trackingNumber}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
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
