import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, DollarSign, TrendingUp, TrendingDown, Store, FileText,
  Download, Plus, Pencil, Trash2, Calendar, Building2, ArrowUpDown,
} from "lucide-react";
import { DateRangeFilter, useDateRange } from "@/components/common/DateRangeFilter";

function formatCurrency(n: number) {
  return n.toLocaleString() + "원";
}

function formatPercent(n: number) {
  if (n === 0) return "-";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

type SalesData = {
  siteSales: { total: number; count: number };
  directSales: { total: number; count: number };
  totalSales: number;
};

type DailyRow = {
  date: string;
  siteSales: number;
  directSales: number;
  total: number;
  changeRate: number;
};

type MemberTaxRow = {
  memberId: string;
  memberName: string;
  businessName: string;
  businessNumber: string;
  representative: string;
  orderCount: number;
  totalOrderAmount: number;
  pointerUsed: number;
  exemptAmount: number;
  taxableAmount: number;
  taxableSupply: number;
  taxableVat: number;
};

type MonthlyByMemberData = {
  year: number;
  month: number;
  closingStatus: string;
  deadline: string;
  members: MemberTaxRow[];
  totals: {
    totalOrderAmount: number;
    pointerUsed: number;
    exemptAmount: number;
    taxableAmount: number;
    taxableSupply: number;
    taxableVat: number;
  };
};

type MemberOrderDetail = {
  orderId: string;
  orderDate: string;
  productName: string;
  productCode: string;
  unitPrice: number;
  quantity: number;
  amount: number;
  pointerUsed: number;
  depositUsed: number;
  taxType: string;
};

type MemberDetailData = {
  member: {
    id: string;
    name: string;
    companyName: string;
    businessNumber: string;
    representative: string;
    phone: string;
  };
  orders: MemberOrderDetail[];
  summary: {
    totalOrderAmount: number;
    pointerUsed: number;
    exemptAmount: number;
    taxableAmount: number;
    taxableSupply: number;
    taxableVat: number;
  };
};

type DirectSaleRow = {
  id: number;
  saleDate: string;
  clientName: string;
  description: string;
  amount: number;
  memo: string | null;
};

function MonthlySalesSummary() {
  const { toast } = useToast();
  const now = new Date();
  const kstNow = new Date(now.getTime() + now.getTimezoneOffset() * 60000 + 9 * 60 * 60 * 1000);
  const [selectedYear, setSelectedYear] = useState(kstNow.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(kstNow.getMonth() + 1);
  const [detailMemberId, setDetailMemberId] = useState<string | null>(null);

  const monthStart = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
  const nextM = selectedMonth === 12 ? 1 : selectedMonth + 1;
  const nextY = selectedMonth === 12 ? selectedYear + 1 : selectedYear;
  const lastDay = new Date(nextY, nextM - 1, 0).getDate();
  const monthEnd = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const { data: salesData, isLoading: salesLoading } = useQuery<SalesData>({
    queryKey: ["/api/admin/accounting/sales", monthStart, monthEnd],
    queryFn: async () => {
      const res = await fetch(`/api/admin/accounting/sales?startDate=${monthStart}&endDate=${monthEnd}`, { credentials: "include" });
      if (!res.ok) throw new Error("조회 실패");
      return res.json();
    },
  });

  const { data: monthlyData, isLoading: monthlyLoading } = useQuery<MonthlyByMemberData>({
    queryKey: ["/api/admin/accounting/sales/monthly-by-member", selectedYear, selectedMonth],
    queryFn: async () => {
      const res = await fetch(`/api/admin/accounting/sales/monthly-by-member?year=${selectedYear}&month=${selectedMonth}`, { credentials: "include" });
      if (!res.ok) throw new Error("조회 실패");
      return res.json();
    },
  });

  const { data: memberDetail, isLoading: detailLoading } = useQuery<MemberDetailData>({
    queryKey: ["/api/admin/accounting/sales/member-detail", detailMemberId, selectedYear, selectedMonth],
    queryFn: async () => {
      const res = await fetch(`/api/admin/accounting/sales/member/${detailMemberId}/monthly-detail?year=${selectedYear}&month=${selectedMonth}`, { credentials: "include" });
      if (!res.ok) throw new Error("조회 실패");
      return res.json();
    },
    enabled: !!detailMemberId,
  });

  const handleExcelDownload = async () => {
    try {
      const res = await fetch(`/api/admin/accounting/sales/tax-invoice-export?year=${selectedYear}&month=${selectedMonth}`, { credentials: "include" });
      if (!res.ok) throw new Error("다운로드 실패");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `계산서_${selectedYear}년${selectedMonth}월.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast({ title: "다운로드 완료" });
    } catch (e: any) {
      toast({ title: "다운로드 실패", description: e.message, variant: "destructive" });
    }
  };

  const years = Array.from({ length: 3 }, (_, i) => kstNow.getFullYear() - 1 + i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  const closingBadge = (status: string) => {
    switch (status) {
      case "open": return <Badge variant="secondary" data-testid="badge-closing-open">진행중</Badge>;
      case "warning": return <Badge variant="destructive" data-testid="badge-closing-warning">발행 기한 임박</Badge>;
      case "overdue": return <Badge variant="destructive" data-testid="badge-closing-overdue">기한 초과</Badge>;
      default: return <Badge variant="outline" data-testid="badge-closing-closed">마감 완료</Badge>;
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-5 w-5" />
              월별 매출 요약 (계산서/세금계산서)
            </CardTitle>
            <div className="flex items-center gap-2">
              <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                <SelectTrigger className="w-[100px]" data-testid="select-year">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map(y => <SelectItem key={y} value={String(y)}>{y}년</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
                <SelectTrigger className="w-[80px]" data-testid="select-month">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map(m => <SelectItem key={m} value={String(m)}>{m}월</SelectItem>)}
                </SelectContent>
              </Select>
              {monthlyData && closingBadge(monthlyData.closingStatus)}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {salesLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : salesData ? (
            <div className="grid sm:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-lg">
                      <DollarSign className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">총 매출</p>
                      <p className="text-xl font-bold" data-testid="text-total-sales">{formatCurrency(salesData.totalSales)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-100 dark:bg-emerald-900/40 rounded-lg">
                      <Store className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">사이트 매출 ({salesData.siteSales.count}건)</p>
                      <p className="text-xl font-bold" data-testid="text-site-sales">{formatCurrency(salesData.siteSales.total)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-lg">
                      <Building2 className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">직접 매출 ({salesData.directSales.count}건)</p>
                      <p className="text-xl font-bold" data-testid="text-direct-sales">{formatCurrency(salesData.directSales.total)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}

          {monthlyLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : monthlyData && monthlyData.members.length > 0 ? (
            <>
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg p-3 text-sm text-amber-800 dark:text-amber-200">
                면세(농산물): 계산서 발행 (공급가 = 예치금, 부가세 없음) | 과세: 세금계산서 발행 (공급가 = 예치금/1.1, 부가세 별도). 포인터 사용분은 발행 대상에서 제외됩니다.
              </div>
              <div className="border rounded-lg overflow-x-auto overflow-y-auto max-h-[500px]">
                <table className="w-full text-sm min-w-[1100px]">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b bg-muted/30">
                      <th className="text-left py-2 px-3 whitespace-nowrap" rowSpan={2}>회원명(업체명)</th>
                      <th className="text-left py-2 px-3 whitespace-nowrap" rowSpan={2}>사업자번호</th>
                      <th className="text-right py-2 px-3 whitespace-nowrap" rowSpan={2}>주문건수</th>
                      <th className="text-right py-2 px-3 whitespace-nowrap" rowSpan={2}>총주문액</th>
                      <th className="text-right py-2 px-3 whitespace-nowrap" rowSpan={2}>포인터사용</th>
                      <th className="text-center py-2 px-3 whitespace-nowrap border-l border-b-0 bg-green-50 dark:bg-green-950/30" colSpan={1}>면세(계산서)</th>
                      <th className="text-center py-2 px-3 whitespace-nowrap border-l border-b-0 bg-blue-50 dark:bg-blue-950/30" colSpan={3}>과세(세금계산서)</th>
                    </tr>
                    <tr className="border-b bg-muted/30">
                      <th className="text-right py-2 px-3 whitespace-nowrap border-l bg-green-50 dark:bg-green-950/30">공급가액</th>
                      <th className="text-right py-2 px-3 whitespace-nowrap border-l bg-blue-50 dark:bg-blue-950/30">공급가액</th>
                      <th className="text-right py-2 px-3 whitespace-nowrap bg-blue-50 dark:bg-blue-950/30">부가세</th>
                      <th className="text-right py-2 px-3 whitespace-nowrap bg-blue-50 dark:bg-blue-950/30">합계</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyData.members.map((m) => (
                      <tr
                        key={m.memberId}
                        className="border-b hover-elevate cursor-pointer"
                        onClick={() => setDetailMemberId(m.memberId)}
                        data-testid={`row-member-tax-${m.memberId}`}
                      >
                        <td className="py-2 px-3 whitespace-nowrap font-medium text-blue-600 dark:text-blue-400 underline">{m.businessName}</td>
                        <td className="py-2 px-3 whitespace-nowrap">{m.businessNumber || "-"}</td>
                        <td className="py-2 px-3 text-right whitespace-nowrap">{m.orderCount}</td>
                        <td className="py-2 px-3 text-right whitespace-nowrap">{formatCurrency(m.totalOrderAmount)}</td>
                        <td className="py-2 px-3 text-right whitespace-nowrap text-amber-600 dark:text-amber-400">-{formatCurrency(m.pointerUsed)}</td>
                        <td className="py-2 px-3 text-right whitespace-nowrap border-l bg-green-50/50 dark:bg-green-950/20">{m.exemptAmount > 0 ? formatCurrency(m.exemptAmount) : "-"}</td>
                        <td className="py-2 px-3 text-right whitespace-nowrap border-l bg-blue-50/50 dark:bg-blue-950/20">{m.taxableSupply > 0 ? formatCurrency(m.taxableSupply) : "-"}</td>
                        <td className="py-2 px-3 text-right whitespace-nowrap bg-blue-50/50 dark:bg-blue-950/20">{m.taxableVat > 0 ? formatCurrency(m.taxableVat) : "-"}</td>
                        <td className="py-2 px-3 text-right whitespace-nowrap bg-blue-50/50 dark:bg-blue-950/20">{m.taxableAmount > 0 ? formatCurrency(m.taxableAmount) : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/30 font-semibold border-t">
                      <td className="py-2 px-3" colSpan={2}>합계</td>
                      <td className="py-2 px-3 text-right">{monthlyData.members.reduce((s, m) => s + m.orderCount, 0)}</td>
                      <td className="py-2 px-3 text-right">{formatCurrency(monthlyData.totals.totalOrderAmount)}</td>
                      <td className="py-2 px-3 text-right text-amber-600 dark:text-amber-400">-{formatCurrency(monthlyData.totals.pointerUsed)}</td>
                      <td className="py-2 px-3 text-right border-l">{formatCurrency(monthlyData.totals.exemptAmount)}</td>
                      <td className="py-2 px-3 text-right border-l">{formatCurrency(monthlyData.totals.taxableSupply)}</td>
                      <td className="py-2 px-3 text-right">{formatCurrency(monthlyData.totals.taxableVat)}</td>
                      <td className="py-2 px-3 text-right">{formatCurrency(monthlyData.totals.taxableAmount)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div className="flex justify-end">
                <Button variant="outline" className="gap-1" onClick={handleExcelDownload} data-testid="button-tax-excel">
                  <Download className="h-4 w-4" />계산서 엑셀 다운로드
                </Button>
              </div>
            </>
          ) : (
            <div className="py-6 text-center text-muted-foreground text-sm">
              해당 월에 계산서 발행 대상 데이터가 없습니다.
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!detailMemberId} onOpenChange={(open) => { if (!open) setDetailMemberId(null); }}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {memberDetail?.member.companyName || "..."} — {selectedYear}년 {selectedMonth}월 공급 내역
            </DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : memberDetail ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-4 text-sm">
                <span className="text-muted-foreground">사업자번호: <strong>{memberDetail.member.businessNumber || "-"}</strong></span>
                <span className="text-muted-foreground">대표자: <strong>{memberDetail.member.representative || "-"}</strong></span>
                <span className="text-muted-foreground">연락처: <strong>{memberDetail.member.phone || "-"}</strong></span>
              </div>
              <div className="border rounded-lg overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full text-sm min-w-[800px]">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b bg-muted/30">
                      <th className="text-center py-2 px-3 whitespace-nowrap">날짜</th>
                      <th className="text-left py-2 px-3 whitespace-nowrap">상품명</th>
                      <th className="text-center py-2 px-3 whitespace-nowrap">과세구분</th>
                      <th className="text-right py-2 px-3 whitespace-nowrap">단가</th>
                      <th className="text-right py-2 px-3 whitespace-nowrap">금액</th>
                      <th className="text-right py-2 px-3 whitespace-nowrap">포인터</th>
                      <th className="text-right py-2 px-3 whitespace-nowrap">예치금</th>
                    </tr>
                  </thead>
                  <tbody>
                    {memberDetail.orders.map((o, idx) => (
                      <tr key={idx} className="border-b" data-testid={`row-detail-order-${idx}`}>
                        <td className="py-2 px-3 text-center whitespace-nowrap">{o.orderDate}</td>
                        <td className="py-2 px-3 whitespace-nowrap">{o.productName}</td>
                        <td className="py-2 px-3 text-center whitespace-nowrap">
                          <Badge variant={o.taxType === 'taxable' ? 'default' : 'secondary'} className="text-xs">
                            {o.taxType === 'taxable' ? '과세' : '면세'}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 text-right whitespace-nowrap">{formatCurrency(o.unitPrice)}</td>
                        <td className="py-2 px-3 text-right whitespace-nowrap">{formatCurrency(o.amount)}</td>
                        <td className="py-2 px-3 text-right whitespace-nowrap text-amber-600 dark:text-amber-400">{o.pointerUsed > 0 ? `-${formatCurrency(o.pointerUsed)}` : "-"}</td>
                        <td className="py-2 px-3 text-right whitespace-nowrap">{formatCurrency(o.depositUsed)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="border rounded-lg p-4 space-y-2 bg-muted/20">
                <div className="flex justify-between text-sm">
                  <span>총 주문금액</span>
                  <span className="font-semibold">{formatCurrency(memberDetail.summary.totalOrderAmount)}</span>
                </div>
                <div className="flex justify-between text-sm text-amber-600 dark:text-amber-400">
                  <span>포인터 사용</span>
                  <span>-{formatCurrency(memberDetail.summary.pointerUsed)}</span>
                </div>
                {memberDetail.summary.exemptAmount > 0 && (
                  <div className="border-t pt-2 flex justify-between text-sm font-semibold text-green-700 dark:text-green-400">
                    <span>면세 계산서 발행액</span>
                    <span>{formatCurrency(memberDetail.summary.exemptAmount)}</span>
                  </div>
                )}
                {memberDetail.summary.taxableAmount > 0 && (
                  <>
                    <div className="border-t pt-2 flex justify-between text-sm">
                      <span>과세 세금계산서 합계</span>
                      <span className="font-semibold">{formatCurrency(memberDetail.summary.taxableAmount)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-muted-foreground pl-4">
                      <span>공급가액</span>
                      <span>{formatCurrency(memberDetail.summary.taxableSupply)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-muted-foreground pl-4">
                      <span>부가세</span>
                      <span>{formatCurrency(memberDetail.summary.taxableVat)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function DailySalesDetail() {
  const dateRange = useDateRange("month");

  const { data, isLoading } = useQuery<{ daily: DailyRow[] }>({
    queryKey: ["/api/admin/accounting/sales/daily", dateRange.dateRange.startDate, dateRange.dateRange.endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateRange.dateRange.startDate) params.set("startDate", dateRange.dateRange.startDate);
      if (dateRange.dateRange.endDate) params.set("endDate", dateRange.dateRange.endDate);
      const res = await fetch(`/api/admin/accounting/sales/daily?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("조회 실패");
      return res.json();
    },
  });

  const [filter, setFilter] = useState<"all" | "site" | "direct">("all");
  const daily = data?.daily || [];

  const totalSite = daily.reduce((s, d) => s + d.siteSales, 0);
  const totalDirect = daily.reduce((s, d) => s + d.directSales, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            일별 매출 상세
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
              <SelectTrigger className="w-[120px]" data-testid="select-daily-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                <SelectItem value="site">사이트 매출</SelectItem>
                <SelectItem value="direct">직접 매출</SelectItem>
              </SelectContent>
            </Select>
            <DateRangeFilter onChange={(range) => dateRange.setDateRange(range)} defaultPreset="month" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : daily.length === 0 ? (
          <div className="py-6 text-center text-muted-foreground text-sm">해당 기간에 매출 데이터가 없습니다.</div>
        ) : (
          <div className="border rounded-lg overflow-x-auto overflow-y-auto max-h-[400px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="border-b bg-muted/30">
                  <th className="text-center py-2 px-3 whitespace-nowrap">날짜</th>
                  {(filter === "all" || filter === "site") && <th className="text-right py-2 px-3 whitespace-nowrap">사이트 매출</th>}
                  {(filter === "all" || filter === "direct") && <th className="text-right py-2 px-3 whitespace-nowrap">직접 매출</th>}
                  <th className="text-right py-2 px-3 whitespace-nowrap">합계</th>
                  <th className="text-right py-2 px-3 whitespace-nowrap">전일 대비</th>
                </tr>
              </thead>
              <tbody>
                {daily.map((d, idx) => {
                  const displayTotal = filter === "site" ? d.siteSales : filter === "direct" ? d.directSales : d.total;
                  return (
                    <tr key={d.date} className="border-b" data-testid={`row-daily-${idx}`}>
                      <td className="py-2 px-3 text-center whitespace-nowrap">{d.date}</td>
                      {(filter === "all" || filter === "site") && <td className="py-2 px-3 text-right whitespace-nowrap">{formatCurrency(d.siteSales)}</td>}
                      {(filter === "all" || filter === "direct") && <td className="py-2 px-3 text-right whitespace-nowrap">{formatCurrency(d.directSales)}</td>}
                      <td className="py-2 px-3 text-right whitespace-nowrap font-medium">{formatCurrency(displayTotal)}</td>
                      <td className={`py-2 px-3 text-right whitespace-nowrap ${d.changeRate > 0 ? "text-emerald-600 dark:text-emerald-400" : d.changeRate < 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
                        {d.changeRate > 0 && <TrendingUp className="inline h-3 w-3 mr-1" />}
                        {d.changeRate < 0 && <TrendingDown className="inline h-3 w-3 mr-1" />}
                        {formatPercent(d.changeRate)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-muted/30 font-semibold border-t">
                  <td className="py-2 px-3 text-center">합계</td>
                  {(filter === "all" || filter === "site") && <td className="py-2 px-3 text-right">{formatCurrency(totalSite)}</td>}
                  {(filter === "all" || filter === "direct") && <td className="py-2 px-3 text-right">{formatCurrency(totalDirect)}</td>}
                  <td className="py-2 px-3 text-right">{formatCurrency(filter === "site" ? totalSite : filter === "direct" ? totalDirect : totalSite + totalDirect)}</td>
                  <td className="py-2 px-3 text-right">-</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DirectSalesManagement() {
  const { toast } = useToast();
  const dateRange = useDateRange("month");
  const [editDialog, setEditDialog] = useState<DirectSaleRow | null>(null);
  const [createDialog, setCreateDialog] = useState(false);
  const [formData, setFormData] = useState({ saleDate: "", clientName: "", description: "", amount: "", memo: "" });

  const now = new Date();
  const kstNow = new Date(now.getTime() + now.getTimezoneOffset() * 60000 + 9 * 60 * 60 * 1000);
  const todayStr = `${kstNow.getFullYear()}-${String(kstNow.getMonth() + 1).padStart(2, '0')}-${String(kstNow.getDate()).padStart(2, '0')}`;

  const { data: directList = [], isLoading } = useQuery<DirectSaleRow[]>({
    queryKey: ["/api/admin/direct-sales", dateRange.dateRange.startDate, dateRange.dateRange.endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateRange.dateRange.startDate) params.set("startDate", dateRange.dateRange.startDate);
      if (dateRange.dateRange.endDate) params.set("endDate", dateRange.dateRange.endDate);
      const res = await fetch(`/api/admin/direct-sales?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("조회 실패");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/admin/direct-sales", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "직접 매출 등록 완료" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/direct-sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/accounting/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/accounting/sales/daily"] });
      setCreateDialog(false);
      resetForm();
    },
    onError: (e: any) => toast({ title: "등록 실패", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PUT", `/api/admin/direct-sales/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "수정 완료" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/direct-sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/accounting/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/accounting/sales/daily"] });
      setEditDialog(null);
      resetForm();
    },
    onError: (e: any) => toast({ title: "수정 실패", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/admin/direct-sales/${id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "삭제 완료" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/direct-sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/accounting/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/accounting/sales/daily"] });
    },
    onError: (e: any) => toast({ title: "삭제 실패", description: e.message, variant: "destructive" }),
  });

  const resetForm = () => setFormData({ saleDate: todayStr, clientName: "", description: "", amount: "", memo: "" });

  const handleCreate = () => {
    setCreateDialog(true);
    resetForm();
  };

  const handleEdit = (row: DirectSaleRow) => {
    setEditDialog(row);
    setFormData({
      saleDate: row.saleDate,
      clientName: row.clientName,
      description: row.description,
      amount: String(row.amount),
      memo: row.memo || "",
    });
  };

  const handleSubmit = () => {
    const payload = { ...formData, amount: parseInt(formData.amount) || 0 };
    if (!payload.saleDate || !payload.clientName || !payload.description || payload.amount < 1) {
      toast({ title: "필수 항목을 입력해주세요", variant: "destructive" });
      return;
    }
    if (editDialog) {
      updateMutation.mutate({ id: editDialog.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const totalAmount = directList.reduce((s, d) => s + d.amount, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            직접 매출 관리
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button size="sm" className="gap-1" onClick={handleCreate} data-testid="button-create-direct-sale">
              <Plus className="h-4 w-4" />등록
            </Button>
            <DateRangeFilter onChange={(range) => dateRange.setDateRange(range)} defaultPreset="month" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : directList.length === 0 ? (
          <div className="py-6 text-center text-muted-foreground text-sm">등록된 직접 매출이 없습니다.</div>
        ) : (
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-center py-2 px-3 whitespace-nowrap">날짜</th>
                  <th className="text-left py-2 px-3 whitespace-nowrap">거래처명</th>
                  <th className="text-left py-2 px-3 whitespace-nowrap">내용</th>
                  <th className="text-right py-2 px-3 whitespace-nowrap">금액</th>
                  <th className="text-left py-2 px-3 whitespace-nowrap">메모</th>
                  <th className="text-center py-2 px-3 whitespace-nowrap">관리</th>
                </tr>
              </thead>
              <tbody>
                {directList.map((d) => (
                  <tr key={d.id} className="border-b" data-testid={`row-direct-sale-${d.id}`}>
                    <td className="py-2 px-3 text-center whitespace-nowrap">{d.saleDate}</td>
                    <td className="py-2 px-3 whitespace-nowrap">{d.clientName}</td>
                    <td className="py-2 px-3">{d.description}</td>
                    <td className="py-2 px-3 text-right whitespace-nowrap font-medium">{formatCurrency(d.amount)}</td>
                    <td className="py-2 px-3 text-muted-foreground">{d.memo || "-"}</td>
                    <td className="py-2 px-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <Button size="icon" variant="ghost" onClick={() => handleEdit(d)} data-testid={`button-edit-${d.id}`}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => { if (confirm("삭제하시겠습니까?")) deleteMutation.mutate(d.id); }} data-testid={`button-delete-${d.id}`}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-muted/30 font-semibold border-t">
                  <td className="py-2 px-3" colSpan={3}>합계 ({directList.length}건)</td>
                  <td className="py-2 px-3 text-right">{formatCurrency(totalAmount)}</td>
                  <td className="py-2 px-3" colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </CardContent>

      <Dialog open={createDialog || !!editDialog} onOpenChange={(open) => { if (!open) { setCreateDialog(false); setEditDialog(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editDialog ? "직접 매출 수정" : "직접 매출 등록"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>매출일 *</Label>
              <Input type="date" value={formData.saleDate} onChange={(e) => setFormData(p => ({ ...p, saleDate: e.target.value }))} data-testid="input-sale-date" />
            </div>
            <div className="space-y-1">
              <Label>거래처명 *</Label>
              <Input value={formData.clientName} onChange={(e) => setFormData(p => ({ ...p, clientName: e.target.value }))} placeholder="거래처명 입력" data-testid="input-client-name" />
            </div>
            <div className="space-y-1">
              <Label>내용 *</Label>
              <Input value={formData.description} onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))} placeholder="매출 내용 입력" data-testid="input-description" />
            </div>
            <div className="space-y-1">
              <Label>금액 *</Label>
              <Input type="number" value={formData.amount} onChange={(e) => setFormData(p => ({ ...p, amount: e.target.value }))} placeholder="금액 입력" data-testid="input-amount" />
            </div>
            <div className="space-y-1">
              <Label>메모</Label>
              <Textarea value={formData.memo} onChange={(e) => setFormData(p => ({ ...p, memo: e.target.value }))} placeholder="메모 (선택)" rows={2} data-testid="input-memo" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateDialog(false); setEditDialog(null); }}>취소</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit-direct-sale">
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {editDialog ? "수정" : "등록"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default function SalesOverviewTab() {
  return (
    <div className="space-y-6">
      <MonthlySalesSummary />
      <DailySalesDetail />
      <DirectSalesManagement />
    </div>
  );
}
