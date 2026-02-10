import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";

interface SettlementItem {
  date: string;
  productName: string;
  productCode: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface SettlementResponse {
  items: SettlementItem[];
  totalAmount: number;
}

type PeriodKey = "today" | "yesterday" | "thisWeek" | "thisMonth" | "custom";

const periodOptions: { key: PeriodKey; label: string }[] = [
  { key: "today", label: "오늘" },
  { key: "yesterday", label: "어제" },
  { key: "thisWeek", label: "이번주" },
  { key: "thisMonth", label: "이달" },
  { key: "custom", label: "기간설정" },
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

function formatCurrency(n: number): string {
  return n.toLocaleString("ko-KR") + "원";
}

export default function PartnerSettlement() {
  const [period, setPeriod] = useState<PeriodKey>("thisMonth");
  const initRange = getDateRange("thisMonth");
  const [customStartDate, setCustomStartDate] = useState(initRange.start);
  const [customEndDate, setCustomEndDate] = useState(initRange.end);
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 50;

  const dateRange = period === "custom"
    ? { start: customStartDate, end: customEndDate }
    : getDateRange(period);

  const queryParams = new URLSearchParams({
    startDate: dateRange.start,
    endDate: dateRange.end,
  }).toString();

  const { data, isLoading } = useQuery<SettlementResponse>({
    queryKey: ["/api/partner/settlement", queryParams],
    queryFn: async () => {
      const res = await fetch(`/api/partner/settlement?${queryParams}`, { credentials: "include" });
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

  const allItems = data?.items || [];
  const totalAmount = data?.totalAmount || 0;

  let runningBalance = 0;
  const itemsWithBalance = allItems.map((item) => {
    runningBalance += item.subtotal;
    return { ...item, payment: 0, balance: runningBalance };
  });

  const totalPages = Math.ceil(itemsWithBalance.length / ITEMS_PER_PAGE);
  const pagedItems = itemsWithBalance.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  return (
    <div className="space-y-4 pb-20 lg:pb-0">
      <h1 className="text-xl font-bold" data-testid="text-settlement-title">정산현황</h1>

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
                  data-testid={`button-settlement-period-${p.key}`}
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
                  data-testid="input-settlement-start-date"
                />
                <span className="text-xs text-muted-foreground">~</span>
                <Input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => { setCustomEndDate(e.target.value); setPage(1); }}
                  className="w-36"
                  data-testid="input-settlement-end-date"
                />
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-4 items-center text-sm">
            <span className="text-muted-foreground">총 {allItems.length}건</span>
            <span className="font-semibold">합계: {formatCurrency(totalAmount)}</span>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : allItems.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            조회된 정산 데이터가 없습니다.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="hidden md:block border rounded-md overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="border-b bg-muted/30">
                  <th className="text-center py-2 px-3 whitespace-nowrap">적용날짜</th>
                  <th className="text-left py-2 px-3 whitespace-nowrap">상품명</th>
                  <th className="text-right py-2 px-3 whitespace-nowrap">수량</th>
                  <th className="text-right py-2 px-3 whitespace-nowrap">공급단가</th>
                  <th className="text-right py-2 px-3 whitespace-nowrap">합계</th>
                  <th className="text-right py-2 px-3 whitespace-nowrap">결재</th>
                  <th className="text-right py-2 px-3 whitespace-nowrap">잔액</th>
                </tr>
              </thead>
              <tbody>
                {pagedItems.map((item, idx) => (
                  <tr key={`${item.date}-${item.productCode}-${item.unitPrice}-${idx}`} className="border-b" data-testid={`row-settlement-${idx}`}>
                    <td className="py-2 px-3 text-center whitespace-nowrap">{item.date}</td>
                    <td className="py-2 px-3 whitespace-nowrap">{item.productName}</td>
                    <td className="py-2 px-3 text-right whitespace-nowrap">{item.quantity}</td>
                    <td className="py-2 px-3 text-right whitespace-nowrap">{formatCurrency(item.unitPrice)}</td>
                    <td className="py-2 px-3 text-right whitespace-nowrap font-medium">{formatCurrency(item.subtotal)}</td>
                    <td className="py-2 px-3 text-right whitespace-nowrap text-muted-foreground">{formatCurrency(item.payment)}</td>
                    <td className="py-2 px-3 text-right whitespace-nowrap font-medium">{formatCurrency(item.balance)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-muted/20 font-semibold">
                  <td className="py-2 px-3 text-center" colSpan={2}>합계</td>
                  <td className="py-2 px-3 text-right">{allItems.reduce((s, i) => s + i.quantity, 0)}</td>
                  <td className="py-2 px-3"></td>
                  <td className="py-2 px-3 text-right">{formatCurrency(totalAmount)}</td>
                  <td className="py-2 px-3 text-right">{formatCurrency(0)}</td>
                  <td className="py-2 px-3 text-right">{formatCurrency(totalAmount)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="md:hidden space-y-2">
            {pagedItems.map((item, idx) => (
              <Card key={`${item.date}-${item.productCode}-${item.unitPrice}-${idx}`} data-testid={`card-settlement-${idx}`}>
                <CardContent className="p-3 space-y-1">
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-xs text-muted-foreground">{item.date}</span>
                    <span className="text-xs font-medium">잔액: {formatCurrency(item.balance)}</span>
                  </div>
                  <div className="font-medium text-sm">{item.productName}</div>
                  <div className="flex justify-between text-xs">
                    <span>{item.quantity}개 x {formatCurrency(item.unitPrice)}</span>
                    <span className="font-medium">{formatCurrency(item.subtotal)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
            <Card>
              <CardContent className="p-3">
                <div className="flex justify-between font-semibold text-sm">
                  <span>합계</span>
                  <span>{formatCurrency(totalAmount)}</span>
                </div>
              </CardContent>
            </Card>
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
