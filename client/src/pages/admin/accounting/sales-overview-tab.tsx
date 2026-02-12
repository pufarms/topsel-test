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
  BarChart3, ShoppingCart, Handshake, Search, X,
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

function SectionHeader({ number, title, icon: Icon, color, children }: {
  number: string;
  title: string;
  icon: any;
  color: "blue" | "emerald" | "amber";
  children?: React.ReactNode;
}) {
  const colorMap = {
    blue: {
      bg: "bg-blue-600 dark:bg-blue-500",
      iconBg: "bg-blue-100 dark:bg-blue-900/50",
      iconText: "text-blue-600 dark:text-blue-400",
      border: "border-l-blue-500",
    },
    emerald: {
      bg: "bg-emerald-600 dark:bg-emerald-500",
      iconBg: "bg-emerald-100 dark:bg-emerald-900/50",
      iconText: "text-emerald-600 dark:text-emerald-400",
      border: "border-l-emerald-500",
    },
    amber: {
      bg: "bg-amber-600 dark:bg-amber-500",
      iconBg: "bg-amber-100 dark:bg-amber-900/50",
      iconText: "text-amber-600 dark:text-amber-400",
      border: "border-l-amber-500",
    },
  };
  const c = colorMap[color];

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div className="flex items-center gap-3">
        <div className={`flex items-center justify-center w-8 h-8 rounded-md ${c.bg} text-white font-bold text-sm`}>
          {number}
        </div>
        <div className={`p-2 rounded-md ${c.iconBg}`}>
          <Icon className={`h-5 w-5 ${c.iconText}`} />
        </div>
        <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      </div>
      {children && <div className="flex items-center gap-2 flex-wrap">{children}</div>}
    </div>
  );
}

function MonthlySalesSummary() {
  const { toast } = useToast();
  const now = new Date();
  const kstNow = new Date(now.getTime() + now.getTimezoneOffset() * 60000 + 9 * 60 * 60 * 1000);
  const [selectedYear, setSelectedYear] = useState(kstNow.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(kstNow.getMonth() + 1);
  const [detailMemberId, setDetailMemberId] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberSearchOpen, setMemberSearchOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

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
      <div className="rounded-lg border-l-4 border-l-blue-500 border border-border bg-card overflow-hidden">
        <div className="p-5">
          <SectionHeader number="1" title="월별 매출 요약" icon={BarChart3} color="blue">
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
          </SectionHeader>

          {salesLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : salesData ? (
            <div className="grid sm:grid-cols-3 gap-4 mb-5">
              <div className="rounded-lg bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/40 dark:to-blue-900/20 border border-blue-200/60 dark:border-blue-800/40 p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-blue-500 rounded-lg">
                    <DollarSign className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-blue-600/80 dark:text-blue-400/80 uppercase tracking-wider">총 매출</p>
                    <p className="text-2xl font-bold text-blue-900 dark:text-blue-100" data-testid="text-total-sales">{formatCurrency(salesData.totalSales)}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-lg bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/40 dark:to-emerald-900/20 border border-emerald-200/60 dark:border-emerald-800/40 p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-500 rounded-lg">
                    <ShoppingCart className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-emerald-600/80 dark:text-emerald-400/80 uppercase tracking-wider">사이트 매출 ({salesData.siteSales.count}건)</p>
                    <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100" data-testid="text-site-sales">{formatCurrency(salesData.siteSales.total)}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-lg bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/40 dark:to-amber-900/20 border border-amber-200/60 dark:border-amber-800/40 p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-amber-500 rounded-lg">
                    <Handshake className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-amber-600/80 dark:text-amber-400/80 uppercase tracking-wider">직접 매출 ({salesData.directSales.count}건)</p>
                    <p className="text-2xl font-bold text-amber-900 dark:text-amber-100" data-testid="text-direct-sales">{formatCurrency(salesData.directSales.total)}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="border-t border-border bg-muted/20 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <h4 className="text-sm font-semibold text-foreground">회원별 계산서 / 세금계산서 내역</h4>
            </div>
            {monthlyData && monthlyData.members.length > 0 && (
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                <Input
                  placeholder="업체명 검색"
                  value={memberSearch}
                  onChange={(e) => {
                    setMemberSearch(e.target.value);
                    setMemberSearchOpen(true);
                    setSelectedMemberId(null);
                  }}
                  onFocus={() => { if (memberSearch.trim() && !selectedMemberId) setMemberSearchOpen(true); }}
                  onBlur={() => setTimeout(() => setMemberSearchOpen(false), 200)}
                  className="pl-8 pr-8 w-[240px]"
                  data-testid="input-member-search"
                />
                {(memberSearch || selectedMemberId) && (
                  <button
                    onClick={() => { setMemberSearch(""); setSelectedMemberId(null); setMemberSearchOpen(false); }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground z-10"
                    data-testid="button-clear-member-search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                {memberSearchOpen && memberSearch.trim() && (() => {
                  const q = memberSearch.trim().toLowerCase();
                  const suggestions = monthlyData.members.filter((m) =>
                    m.businessName?.toLowerCase().includes(q) ||
                    m.memberName?.toLowerCase().includes(q) ||
                    m.businessNumber?.includes(q)
                  );
                  if (suggestions.length === 0) return (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg z-50 p-3 text-sm text-muted-foreground text-center">
                      검색 결과가 없습니다
                    </div>
                  );
                  return (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg z-50 max-h-[200px] overflow-y-auto">
                      {suggestions.map((m) => (
                        <button
                          key={m.memberId}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center justify-between gap-2"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setSelectedMemberId(m.memberId);
                            setMemberSearch(m.businessName);
                            setMemberSearchOpen(false);
                          }}
                          data-testid={`suggestion-member-${m.memberId}`}
                        >
                          <span className="font-medium truncate">{m.businessName}</span>
                          <span className="text-xs text-muted-foreground shrink-0">{m.businessNumber || m.memberName}</span>
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {monthlyLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : monthlyData && monthlyData.members.length > 0 ? (
            <>
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-md p-3 text-xs text-amber-800 dark:text-amber-200 mb-3">
                면세(농산물): 계산서 발행 (공급가 = 예치금, 부가세 없음) | 과세: 세금계산서 발행 (공급가 = 예치금/1.1, 부가세 별도). 포인터 사용분은 발행 대상에서 제외됩니다.
              </div>
              <div className="rounded-md border overflow-x-auto overflow-y-auto max-h-[500px]">
                <table className="w-full text-sm min-w-[1100px]">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b bg-muted/50">
                      <th className="text-left py-2.5 px-3 whitespace-nowrap font-semibold text-xs uppercase tracking-wider" rowSpan={2}>회원명(업체명)</th>
                      <th className="text-left py-2.5 px-3 whitespace-nowrap font-semibold text-xs uppercase tracking-wider" rowSpan={2}>사업자번호</th>
                      <th className="text-right py-2.5 px-3 whitespace-nowrap font-semibold text-xs uppercase tracking-wider" rowSpan={2}>주문건수</th>
                      <th className="text-right py-2.5 px-3 whitespace-nowrap font-semibold text-xs uppercase tracking-wider" rowSpan={2}>총주문액</th>
                      <th className="text-right py-2.5 px-3 whitespace-nowrap font-semibold text-xs uppercase tracking-wider" rowSpan={2}>포인터사용</th>
                      <th className="text-center py-2 px-3 whitespace-nowrap border-l-2 border-l-green-400 dark:border-l-green-600 border-b bg-green-50/80 dark:bg-green-950/40 font-semibold text-xs text-green-700 dark:text-green-400" colSpan={1}>면세(계산서)</th>
                      <th className="text-center py-2 px-3 whitespace-nowrap border-l-2 border-l-violet-400 dark:border-l-violet-600 border-b bg-violet-50/80 dark:bg-violet-950/40 font-semibold text-xs text-violet-700 dark:text-violet-400" colSpan={3}>과세(세금계산서)</th>
                    </tr>
                    <tr className="border-b bg-muted/50">
                      <th className="text-right py-2 px-3 whitespace-nowrap border-l-2 border-l-green-400 dark:border-l-green-600 bg-green-50/50 dark:bg-green-950/20 text-xs font-medium">공급가액</th>
                      <th className="text-right py-2 px-3 whitespace-nowrap border-l-2 border-l-violet-400 dark:border-l-violet-600 bg-violet-50/50 dark:bg-violet-950/20 text-xs font-medium">공급가액</th>
                      <th className="text-right py-2 px-3 whitespace-nowrap bg-violet-50/50 dark:bg-violet-950/20 text-xs font-medium">부가세</th>
                      <th className="text-right py-2 px-3 whitespace-nowrap bg-violet-50/50 dark:bg-violet-950/20 text-xs font-medium">합계</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyData.members
                      .filter((m) => {
                        if (selectedMemberId) return m.memberId === selectedMemberId;
                        if (!memberSearch.trim()) return true;
                        const q = memberSearch.trim().toLowerCase();
                        return (
                          m.businessName?.toLowerCase().includes(q) ||
                          m.memberName?.toLowerCase().includes(q) ||
                          m.businessNumber?.includes(q)
                        );
                      })
                      .map((m) => (
                      <tr
                        key={m.memberId}
                        className="border-b hover-elevate cursor-pointer"
                        onClick={() => setDetailMemberId(m.memberId)}
                        data-testid={`row-member-tax-${m.memberId}`}
                      >
                        <td className="py-2.5 px-3 whitespace-nowrap font-medium text-blue-600 dark:text-blue-400 underline">{m.businessName}</td>
                        <td className="py-2.5 px-3 whitespace-nowrap text-muted-foreground">{m.businessNumber || "-"}</td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">{m.orderCount}</td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap font-medium">{formatCurrency(m.totalOrderAmount)}</td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap text-amber-600 dark:text-amber-400">-{formatCurrency(m.pointerUsed)}</td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap border-l-2 border-l-green-400/30 dark:border-l-green-600/30 bg-green-50/30 dark:bg-green-950/10">{m.exemptAmount > 0 ? formatCurrency(m.exemptAmount) : "-"}</td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap border-l-2 border-l-violet-400/30 dark:border-l-violet-600/30 bg-violet-50/30 dark:bg-violet-950/10">{m.taxableSupply > 0 ? formatCurrency(m.taxableSupply) : "-"}</td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap bg-violet-50/30 dark:bg-violet-950/10">{m.taxableVat > 0 ? formatCurrency(m.taxableVat) : "-"}</td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap bg-violet-50/30 dark:bg-violet-950/10 font-medium">{m.taxableAmount > 0 ? formatCurrency(m.taxableAmount) : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/50 font-semibold border-t-2">
                      <td className="py-2.5 px-3" colSpan={2}>합계</td>
                      <td className="py-2.5 px-3 text-right">{monthlyData.members.reduce((s, m) => s + m.orderCount, 0)}</td>
                      <td className="py-2.5 px-3 text-right">{formatCurrency(monthlyData.totals.totalOrderAmount)}</td>
                      <td className="py-2.5 px-3 text-right text-amber-600 dark:text-amber-400">-{formatCurrency(monthlyData.totals.pointerUsed)}</td>
                      <td className="py-2.5 px-3 text-right border-l-2 border-l-green-400/30 dark:border-l-green-600/30">{formatCurrency(monthlyData.totals.exemptAmount)}</td>
                      <td className="py-2.5 px-3 text-right border-l-2 border-l-violet-400/30 dark:border-l-violet-600/30">{formatCurrency(monthlyData.totals.taxableSupply)}</td>
                      <td className="py-2.5 px-3 text-right">{formatCurrency(monthlyData.totals.taxableVat)}</td>
                      <td className="py-2.5 px-3 text-right">{formatCurrency(monthlyData.totals.taxableAmount)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div className="flex justify-end mt-3">
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
        </div>
      </div>

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
              <div className="rounded-md bg-muted/30 border p-3">
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                  <span className="text-muted-foreground">사업자번호: <strong className="text-foreground">{memberDetail.member.businessNumber || "-"}</strong></span>
                  <span className="text-muted-foreground">대표자: <strong className="text-foreground">{memberDetail.member.representative || "-"}</strong></span>
                  <span className="text-muted-foreground">연락처: <strong className="text-foreground">{memberDetail.member.phone || "-"}</strong></span>
                </div>
              </div>
              <div className="border rounded-md overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full text-sm min-w-[800px]">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b bg-muted/50">
                      <th className="text-center py-2.5 px-3 whitespace-nowrap text-xs font-semibold uppercase tracking-wider">날짜</th>
                      <th className="text-left py-2.5 px-3 whitespace-nowrap text-xs font-semibold uppercase tracking-wider">상품명</th>
                      <th className="text-center py-2.5 px-3 whitespace-nowrap text-xs font-semibold uppercase tracking-wider">과세구분</th>
                      <th className="text-right py-2.5 px-3 whitespace-nowrap text-xs font-semibold uppercase tracking-wider">단가</th>
                      <th className="text-right py-2.5 px-3 whitespace-nowrap text-xs font-semibold uppercase tracking-wider">금액</th>
                      <th className="text-right py-2.5 px-3 whitespace-nowrap text-xs font-semibold uppercase tracking-wider">포인터</th>
                      <th className="text-right py-2.5 px-3 whitespace-nowrap text-xs font-semibold uppercase tracking-wider">예치금</th>
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
              <div className="rounded-md border overflow-hidden">
                <div className="bg-muted/40 px-4 py-3 border-b">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">총 주문금액</span>
                    <span className="font-bold text-base">{formatCurrency(memberDetail.summary.totalOrderAmount)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-amber-600 dark:text-amber-400 mt-1">
                    <span>포인터 사용</span>
                    <span>-{formatCurrency(memberDetail.summary.pointerUsed)}</span>
                  </div>
                </div>
                <div className="px-4 py-3 space-y-2">
                  {memberDetail.summary.exemptAmount > 0 && (
                    <div className="flex justify-between items-center text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        <span className="font-medium text-green-700 dark:text-green-400">면세 계산서 발행액</span>
                      </div>
                      <span className="font-semibold text-green-700 dark:text-green-400">{formatCurrency(memberDetail.summary.exemptAmount)}</span>
                    </div>
                  )}
                  {memberDetail.summary.taxableAmount > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-violet-500" />
                          <span className="font-medium text-violet-700 dark:text-violet-400">과세 세금계산서 합계</span>
                        </div>
                        <span className="font-semibold text-violet-700 dark:text-violet-400">{formatCurrency(memberDetail.summary.taxableAmount)}</span>
                      </div>
                      <div className="flex justify-between text-sm text-muted-foreground pl-6">
                        <span>공급가액</span>
                        <span>{formatCurrency(memberDetail.summary.taxableSupply)}</span>
                      </div>
                      <div className="flex justify-between text-sm text-muted-foreground pl-6">
                        <span>부가세</span>
                        <span>{formatCurrency(memberDetail.summary.taxableVat)}</span>
                      </div>
                    </div>
                  )}
                </div>
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
    <div className="rounded-lg border-l-4 border-l-emerald-500 border border-border bg-card overflow-hidden">
      <div className="p-5">
        <SectionHeader number="2" title="일별 매출 상세" icon={Calendar} color="emerald">
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
        </SectionHeader>

        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : daily.length === 0 ? (
          <div className="py-6 text-center text-muted-foreground text-sm">해당 기간에 매출 데이터가 없습니다.</div>
        ) : (
          <div className="border rounded-md overflow-x-auto overflow-y-auto max-h-[400px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="border-b bg-muted/50">
                  <th className="text-center py-2.5 px-3 whitespace-nowrap text-xs font-semibold uppercase tracking-wider">날짜</th>
                  {(filter === "all" || filter === "site") && <th className="text-right py-2.5 px-3 whitespace-nowrap text-xs font-semibold uppercase tracking-wider">사이트 매출</th>}
                  {(filter === "all" || filter === "direct") && <th className="text-right py-2.5 px-3 whitespace-nowrap text-xs font-semibold uppercase tracking-wider">직접 매출</th>}
                  <th className="text-right py-2.5 px-3 whitespace-nowrap text-xs font-semibold uppercase tracking-wider">합계</th>
                  <th className="text-right py-2.5 px-3 whitespace-nowrap text-xs font-semibold uppercase tracking-wider">전일 대비</th>
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
                <tr className="bg-muted/50 font-semibold border-t-2">
                  <td className="py-2.5 px-3 text-center">합계</td>
                  {(filter === "all" || filter === "site") && <td className="py-2.5 px-3 text-right">{formatCurrency(totalSite)}</td>}
                  {(filter === "all" || filter === "direct") && <td className="py-2.5 px-3 text-right">{formatCurrency(totalDirect)}</td>}
                  <td className="py-2.5 px-3 text-right">{formatCurrency(filter === "site" ? totalSite : filter === "direct" ? totalDirect : totalSite + totalDirect)}</td>
                  <td className="py-2.5 px-3 text-right">-</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
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
    <div className="rounded-lg border-l-4 border-l-amber-500 border border-border bg-card overflow-hidden">
      <div className="p-5">
        <SectionHeader number="3" title="직접 매출 관리" icon={Handshake} color="amber">
          <div className="flex items-center gap-2">
            <Button size="sm" className="gap-1" onClick={handleCreate} data-testid="button-create-direct-sale">
              <Plus className="h-4 w-4" />등록
            </Button>
            <DateRangeFilter onChange={(range) => dateRange.setDateRange(range)} defaultPreset="month" />
          </div>
        </SectionHeader>

        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : directList.length === 0 ? (
          <div className="py-6 text-center text-muted-foreground text-sm">등록된 직접 매출이 없습니다.</div>
        ) : (
          <div className="border rounded-md overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-center py-2.5 px-3 whitespace-nowrap text-xs font-semibold uppercase tracking-wider">날짜</th>
                  <th className="text-left py-2.5 px-3 whitespace-nowrap text-xs font-semibold uppercase tracking-wider">거래처명</th>
                  <th className="text-left py-2.5 px-3 whitespace-nowrap text-xs font-semibold uppercase tracking-wider">내용</th>
                  <th className="text-right py-2.5 px-3 whitespace-nowrap text-xs font-semibold uppercase tracking-wider">금액</th>
                  <th className="text-left py-2.5 px-3 whitespace-nowrap text-xs font-semibold uppercase tracking-wider">메모</th>
                  <th className="text-center py-2.5 px-3 whitespace-nowrap text-xs font-semibold uppercase tracking-wider">관리</th>
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
                <tr className="bg-muted/50 font-semibold border-t-2">
                  <td className="py-2.5 px-3" colSpan={3}>합계 ({directList.length}건)</td>
                  <td className="py-2.5 px-3 text-right">{formatCurrency(totalAmount)}</td>
                  <td className="py-2.5 px-3" colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

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
    </div>
  );
}

export default function SalesOverviewTab() {
  return (
    <div className="space-y-8">
      <MonthlySalesSummary />
      <DailySalesDetail />
      <DirectSalesManagement />
    </div>
  );
}
