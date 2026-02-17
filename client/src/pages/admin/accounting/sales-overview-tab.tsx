import { useState, useRef, useCallback, useMemo, useEffect } from "react";
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
  BarChart3, ShoppingCart, Handshake, Search, X, ChevronDown, AlertTriangle, Truck,
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

type VendorTaxRow = {
  vendorId: number;
  vendorName: string;
  businessNumber: string;
  orderCount: number;
  totalAmount: number;
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
  vendors?: VendorTaxRow[];
  totals: {
    totalOrderAmount: number;
    pointerUsed: number;
    exemptAmount: number;
    taxableAmount: number;
    taxableSupply: number;
    taxableVat: number;
  };
  vendorTotals?: {
    totalAmount: number;
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
  isDirectSale?: boolean;
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
  clientType: string;
  description: string;
  amount: number;
  memo: string | null;
  taxType: string;
  memberId: string | null;
  vendorId: number | null;
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

type InvoiceSummaryRow = {
  type: 'member' | 'vendor';
  targetId: string;
  targetName: string;
  businessNumber: string;
  invoiceId: number | null;
  invoiceType: string | null;
  orderCount: number;
  totalOrderAmount: number;
  pointerUsed: number;
  exemptAmount: number;
  taxableSupply: number;
  taxableVat: number;
  taxableAmount: number;
  issuedStatus: 'issued' | 'not_issued';
  issuedAt: string | null;
  isAutoIssued: boolean;
  memo: string | null;
  orderIds: string[];
};

type InvoiceSummaryData = {
  year: number;
  month: number;
  rows: InvoiceSummaryRow[];
  totals: {
    totalOrderAmount: number;
    pointerUsed: number;
    exemptAmount: number;
    taxableSupply: number;
    taxableVat: number;
    taxableAmount: number;
    issuedCount: number;
    notIssuedCount: number;
  };
};

type TargetOption = {
  id: string;
  name: string;
  businessNumber: string;
};

function MonthlySalesSummary() {
  const { toast } = useToast();
  const now = new Date();
  const kstNow = new Date(now.getTime() + now.getTimezoneOffset() * 60000 + 9 * 60 * 60 * 1000);
  const [selectedYear, setSelectedYear] = useState(kstNow.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(kstNow.getMonth() + 1);
  const [detailMemberId, setDetailMemberId] = useState<string | null>(null);

  const [filterType, setFilterType] = useState<'all' | 'member' | 'vendor'>('all');
  const [searchText, setSearchText] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedSearchId, setSelectedSearchId] = useState<string | null>(null);
  const [issueDialogRow, setIssueDialogRow] = useState<InvoiceSummaryRow | null>(null);
  const [issueMemo, setIssueMemo] = useState("");

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

  const { data: invoiceSummary, isLoading: invoiceLoading } = useQuery<InvoiceSummaryData>({
    queryKey: ["/api/admin/accounting/invoice-summary", selectedYear, selectedMonth, filterType, selectedSearchId],
    queryFn: async () => {
      const params = new URLSearchParams({
        year: String(selectedYear),
        month: String(selectedMonth),
        filterType,
      });
      if (selectedSearchId) params.set("searchId", selectedSearchId);
      const res = await fetch(`/api/admin/accounting/invoice-summary?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("조회 실패");
      return res.json();
    },
  });

  const searchTargetType = filterType === 'all' ? null : filterType;
  const { data: targetOptions } = useQuery<TargetOption[]>({
    queryKey: ["/api/admin/accounting/invoice-targets", searchTargetType, searchText],
    queryFn: async () => {
      if (!searchTargetType) return [];
      const params = new URLSearchParams({ type: searchTargetType, search: searchText });
      const res = await fetch(`/api/admin/accounting/invoice-targets?${params.toString()}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!searchTargetType && searchText.trim().length > 0,
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

  const issueMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/admin/accounting/invoice-issue", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "계산서 발행 완료" });
      setIssueDialogRow(null);
      setIssueMemo("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/accounting/invoice-summary"] });
    },
    onError: (e: any) => {
      toast({ title: "발행 실패", description: e.message, variant: "destructive" });
    },
  });

  const handleIssue = () => {
    if (!issueDialogRow) return;
    const r = issueDialogRow;
    issueMutation.mutate({
      targetType: r.type,
      targetId: r.targetId,
      targetName: r.targetName,
      businessNumber: r.businessNumber,
      invoiceType: r.exemptAmount > 0 && r.taxableAmount > 0 ? 'mixed' : r.taxableAmount > 0 ? 'taxable' : 'exempt',
      year: selectedYear,
      month: selectedMonth,
      orderIds: r.orderIds,
      supplyAmount: r.exemptAmount + r.taxableSupply,
      vatAmount: r.taxableVat,
      totalAmount: r.exemptAmount + r.taxableAmount,
      memo: issueMemo || null,
    });
  };

  const handleExcelDownload = async () => {
    if (!invoiceSummary || invoiceSummary.rows.length === 0) {
      toast({ title: "다운로드할 데이터가 없습니다", variant: "destructive" });
      return;
    }
    try {
      const params = new URLSearchParams({
        year: String(selectedYear),
        month: String(selectedMonth),
        filterType,
      });
      if (selectedSearchId) params.set("searchId", selectedSearchId);
      const res = await fetch(`/api/admin/accounting/invoice-summary-export?${params.toString()}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error("다운로드 실패");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `계산서내역_${selectedYear}년${selectedMonth}월.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast({ title: "다운로드 완료" });
    } catch (e: any) {
      toast({ title: "다운로드 실패", description: e.message, variant: "destructive" });
    }
  };

  const years = Array.from({ length: 3 }, (_, i) => kstNow.getFullYear() - 1 + i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  const rows = invoiceSummary?.rows || [];
  const totals = invoiceSummary?.totals;

  return (
    <>
      <div className="rounded-lg border-l-4 border-l-blue-500 border border-blue-200 dark:border-blue-900 bg-blue-50/40 dark:bg-blue-950/20 shadow-md overflow-hidden">
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
            </div>
          </SectionHeader>

          {salesLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : salesData ? (
            <div className="grid sm:grid-cols-3 gap-4">
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
              <h4 className="text-sm font-semibold text-foreground">계산서 / 세금계산서 내역</h4>
              {totals && (
                <div className="flex items-center gap-1.5 ml-2">
                  <Badge variant="secondary" className="text-xs">{totals.issuedCount}건 발행</Badge>
                  <Badge variant="outline" className="text-xs">{totals.notIssuedCount}건 미발행</Badge>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={filterType} onValueChange={(v) => {
                setFilterType(v as any);
                setSearchText("");
                setSelectedSearchId(null);
                setSearchOpen(false);
              }}>
                <SelectTrigger className="w-[120px]" data-testid="select-invoice-filter-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="member">회원</SelectItem>
                  <SelectItem value="vendor">매입업체</SelectItem>
                </SelectContent>
              </Select>

              {filterType !== 'all' && (
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                  <Input
                    placeholder={filterType === 'member' ? "회원/업체명 검색" : "업체명 검색"}
                    value={searchText}
                    onChange={(e) => {
                      setSearchText(e.target.value);
                      setSearchOpen(true);
                      setSelectedSearchId(null);
                    }}
                    onFocus={() => { if (searchText.trim() && !selectedSearchId) setSearchOpen(true); }}
                    onBlur={() => setTimeout(() => setSearchOpen(false), 200)}
                    className="pl-8 pr-8 w-[240px]"
                    data-testid="input-invoice-search"
                  />
                  {(searchText || selectedSearchId) && (
                    <button
                      onClick={() => { setSearchText(""); setSelectedSearchId(null); setSearchOpen(false); }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground z-10"
                      data-testid="button-clear-invoice-search"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                  {searchOpen && searchText.trim() && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg z-50 max-h-[200px] overflow-y-auto">
                      {(!targetOptions || targetOptions.length === 0) ? (
                        <div className="p-3 text-sm text-muted-foreground text-center">검색 결과가 없습니다</div>
                      ) : (
                        targetOptions.map((t) => (
                          <button
                            key={t.id}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center justify-between gap-2"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setSelectedSearchId(t.id);
                              setSearchText(t.name);
                              setSearchOpen(false);
                            }}
                            data-testid={`suggestion-target-${t.id}`}
                          >
                            <span className="font-medium truncate">{t.name}</span>
                            <span className="text-xs text-muted-foreground shrink-0">{t.businessNumber}</span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}

              <Button variant="outline" className="gap-1" onClick={handleExcelDownload} data-testid="button-invoice-excel">
                <Download className="h-4 w-4" />엑셀
              </Button>
            </div>
          </div>

          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-md p-3 text-xs text-amber-800 dark:text-amber-200 mb-3">
            면세(농산물): 계산서 발행 (공급가 = 예치금, 부가세 없음) | 과세: 세금계산서 발행 (공급가 = 예치금/1.1, 부가세 별도). 포인터 사용분은 발행 대상에서 제외됩니다.
          </div>

          {invoiceLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : rows.length > 0 ? (
            <div className="rounded-md border overflow-x-auto overflow-y-auto max-h-[500px]">
              <table className="w-full text-sm min-w-[1200px] table-fixed">
                <colgroup>
                  <col style={{ width: "7%" }} />
                  <col style={{ width: "15%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "7%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "9%" }} />
                  <col style={{ width: "9%" }} />
                  <col style={{ width: "7%" }} />
                  <col style={{ width: "9%" }} />
                  <col style={{ width: "9%" }} />
                </colgroup>
                <thead className="sticky top-0 z-10">
                  <tr className="border-b bg-muted/50">
                    <th className="text-center py-2.5 px-2 whitespace-nowrap font-semibold text-xs uppercase tracking-wider" rowSpan={2}>구분</th>
                    <th className="text-left py-2.5 px-2 whitespace-nowrap font-semibold text-xs uppercase tracking-wider" rowSpan={2}>업체명(회원명)</th>
                    <th className="text-left py-2.5 px-2 whitespace-nowrap font-semibold text-xs uppercase tracking-wider" rowSpan={2}>사업자번호</th>
                    <th className="text-right py-2.5 px-2 whitespace-nowrap font-semibold text-xs uppercase tracking-wider" rowSpan={2}>건수</th>
                    <th className="text-right py-2.5 px-2 whitespace-nowrap font-semibold text-xs uppercase tracking-wider" rowSpan={2}>총주문액</th>
                    <th className="text-right py-2.5 px-2 whitespace-nowrap font-semibold text-xs uppercase tracking-wider" rowSpan={2}>포인터</th>
                    <th className="text-center py-2 px-2 whitespace-nowrap border-l-2 border-l-green-400 dark:border-l-green-600 border-b bg-green-50/80 dark:bg-green-950/40 font-semibold text-xs text-green-700 dark:text-green-400" colSpan={1}>면세</th>
                    <th className="text-center py-2 px-2 whitespace-nowrap border-l-2 border-l-violet-400 dark:border-l-violet-600 border-b bg-violet-50/80 dark:bg-violet-950/40 font-semibold text-xs text-violet-700 dark:text-violet-400" colSpan={3}>과세(세금계산서)</th>
                    <th className="text-center py-2.5 px-2 whitespace-nowrap font-semibold text-xs uppercase tracking-wider" rowSpan={2}>발행상태</th>
                  </tr>
                  <tr className="border-b bg-muted/50">
                    <th className="text-right py-2 px-2 whitespace-nowrap border-l-2 border-l-green-400 dark:border-l-green-600 bg-green-50/50 dark:bg-green-950/20 text-xs font-medium">공급가액</th>
                    <th className="text-right py-2 px-2 whitespace-nowrap border-l-2 border-l-violet-400 dark:border-l-violet-600 bg-violet-50/50 dark:bg-violet-950/20 text-xs font-medium">공급가액</th>
                    <th className="text-right py-2 px-2 whitespace-nowrap bg-violet-50/50 dark:bg-violet-950/20 text-xs font-medium">부가세</th>
                    <th className="text-right py-2 px-2 whitespace-nowrap bg-violet-50/50 dark:bg-violet-950/20 text-xs font-medium">합계</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => (
                    <tr
                      key={`${r.targetId}-${r.invoiceId || 'new'}-${idx}`}
                      className={`border-b ${r.type === 'member' ? 'hover-elevate cursor-pointer' : ''} ${r.issuedStatus === 'issued' ? 'bg-green-50/20 dark:bg-green-950/10' : ''}`}
                      onClick={() => { if (r.type === 'member') setDetailMemberId(r.targetId); }}
                      data-testid={`row-invoice-${idx}`}
                    >
                      <td className="py-2.5 px-2 text-center whitespace-nowrap">
                        <Badge variant={r.type === 'member' ? 'secondary' : 'outline'} className="text-xs">
                          {r.type === 'member' ? '회원' : '업체'}
                        </Badge>
                      </td>
                      <td className={`py-2.5 px-2 whitespace-nowrap font-medium ${r.type === 'member' ? 'text-blue-600 dark:text-blue-400 underline' : ''}`}>
                        {r.targetName}
                      </td>
                      <td className="py-2.5 px-2 whitespace-nowrap text-muted-foreground">{r.businessNumber || "-"}</td>
                      <td className="py-2.5 px-2 text-right whitespace-nowrap">{r.orderCount}</td>
                      <td className="py-2.5 px-2 text-right whitespace-nowrap font-medium">{formatCurrency(r.totalOrderAmount)}</td>
                      <td className="py-2.5 px-2 text-right whitespace-nowrap text-amber-600 dark:text-amber-400">{r.pointerUsed > 0 ? `-${formatCurrency(r.pointerUsed)}` : "-"}</td>
                      <td className="py-2.5 px-2 text-right whitespace-nowrap border-l-2 border-l-green-400/30 dark:border-l-green-600/30 bg-green-50/30 dark:bg-green-950/10">{r.exemptAmount > 0 ? formatCurrency(r.exemptAmount) : "-"}</td>
                      <td className="py-2.5 px-2 text-right whitespace-nowrap border-l-2 border-l-violet-400/30 dark:border-l-violet-600/30 bg-violet-50/30 dark:bg-violet-950/10">{r.taxableSupply > 0 ? formatCurrency(r.taxableSupply) : "-"}</td>
                      <td className="py-2.5 px-2 text-right whitespace-nowrap bg-violet-50/30 dark:bg-violet-950/10">{r.taxableVat > 0 ? formatCurrency(r.taxableVat) : "-"}</td>
                      <td className="py-2.5 px-2 text-right whitespace-nowrap bg-violet-50/30 dark:bg-violet-950/10 font-medium">{r.taxableAmount > 0 ? formatCurrency(r.taxableAmount) : "-"}</td>
                      <td className="py-2.5 px-2 text-center whitespace-nowrap">
                        {r.issuedStatus === 'issued' ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <Badge variant="default" className="text-xs bg-green-600">발행완료</Badge>
                            <span className="text-[10px] text-muted-foreground">{r.issuedAt ? new Date(r.issuedAt).toLocaleDateString('ko-KR') : ''}</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-1">
                            <Badge variant="outline" className="text-xs text-orange-600 dark:text-orange-400 border-orange-300 dark:border-orange-700">미발행</Badge>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs gap-1 h-6 px-2"
                              onClick={(e) => { e.stopPropagation(); setIssueDialogRow(r); setIssueMemo(""); }}
                              data-testid={`button-issue-${idx}`}
                            >
                              <FileText className="h-3 w-3" />발행하기
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {totals && (
                  <tfoot>
                    <tr className="bg-muted/50 font-semibold border-t-2">
                      <td className="py-2.5 px-2" colSpan={3}>합계</td>
                      <td className="py-2.5 px-2 text-right">{rows.reduce((s, r) => s + r.orderCount, 0)}</td>
                      <td className="py-2.5 px-2 text-right">{formatCurrency(totals.totalOrderAmount)}</td>
                      <td className="py-2.5 px-2 text-right text-amber-600 dark:text-amber-400">{totals.pointerUsed > 0 ? `-${formatCurrency(totals.pointerUsed)}` : "-"}</td>
                      <td className="py-2.5 px-2 text-right border-l-2 border-l-green-400/30 dark:border-l-green-600/30">{formatCurrency(totals.exemptAmount)}</td>
                      <td className="py-2.5 px-2 text-right border-l-2 border-l-violet-400/30 dark:border-l-violet-600/30">{formatCurrency(totals.taxableSupply)}</td>
                      <td className="py-2.5 px-2 text-right">{formatCurrency(totals.taxableVat)}</td>
                      <td className="py-2.5 px-2 text-right">{formatCurrency(totals.taxableAmount)}</td>
                      <td className="py-2.5 px-2"></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          ) : (
            <div className="py-6 text-center text-muted-foreground text-sm">
              해당 월에 계산서 발행 대상 데이터가 없습니다.
            </div>
          )}
        </div>
      </div>

      <Dialog open={!!issueDialogRow} onOpenChange={(open) => { if (!open) { setIssueDialogRow(null); setIssueMemo(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />계산서 수동 발행
            </DialogTitle>
          </DialogHeader>
          {issueDialogRow && (
            <div className="space-y-4">
              <div className="rounded-md bg-muted/30 border p-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">대상</span>
                  <span className="font-medium">{issueDialogRow.targetName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">구분</span>
                  <Badge variant={issueDialogRow.type === 'member' ? 'secondary' : 'outline'} className="text-xs">
                    {issueDialogRow.type === 'member' ? '회원' : '매입업체'}
                  </Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">사업자번호</span>
                  <span>{issueDialogRow.businessNumber || "-"}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">주문 건수</span>
                  <span className="font-medium">{issueDialogRow.orderCount}건</span>
                </div>
                {issueDialogRow.exemptAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-green-700 dark:text-green-400">면세 공급가액</span>
                    <span className="font-medium text-green-700 dark:text-green-400">{formatCurrency(issueDialogRow.exemptAmount)}</span>
                  </div>
                )}
                {issueDialogRow.taxableAmount > 0 && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-violet-700 dark:text-violet-400">과세 공급가액</span>
                      <span className="font-medium text-violet-700 dark:text-violet-400">{formatCurrency(issueDialogRow.taxableSupply)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-violet-700 dark:text-violet-400">부가세</span>
                      <span className="font-medium text-violet-700 dark:text-violet-400">{formatCurrency(issueDialogRow.taxableVat)}</span>
                    </div>
                  </>
                )}
              </div>
              <div className="space-y-1">
                <Label>메모 (선택)</Label>
                <Textarea
                  value={issueMemo}
                  onChange={(e) => setIssueMemo(e.target.value)}
                  placeholder="발행 메모 (선택)"
                  rows={2}
                  data-testid="input-issue-memo"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIssueDialogRow(null); setIssueMemo(""); }}>취소</Button>
            <Button onClick={handleIssue} disabled={issueMutation.isPending} data-testid="button-confirm-issue">
              {issueMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}발행 확인
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                      <tr key={idx} className={`border-b ${o.isDirectSale ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''}`} data-testid={`row-detail-order-${idx}`}>
                        <td className="py-2 px-3 text-center whitespace-nowrap">{o.orderDate}</td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          <span className="flex items-center gap-1.5 flex-wrap">
                            {o.productName}
                            {o.isDirectSale && <Badge variant="outline" className="text-xs border-amber-400 text-amber-600 dark:text-amber-400">직접매출</Badge>}
                          </span>
                        </td>
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
    <div className="rounded-lg border-l-4 border-l-emerald-500 border border-emerald-200 dark:border-emerald-900 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-md overflow-hidden">
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

const materialTypeLabelsDS: Record<string, string> = {
  raw: "원물",
  semi: "반재료",
  subsidiary: "부자재",
  sub: "부자재",
  etc: "기타",
  product: "일반",
};

const salesTypeOptions = [
  { v: "__all__", l: "전체" },
  { v: "raw", l: "원물" },
  { v: "semi", l: "반재료" },
  { v: "sub", l: "부자재" },
  { v: "product", l: "일반" },
];

const unitOptionsDS = ["박스", "kg", "팩", "송이", "개", "롤", "건"];

interface DSItemRow {
  materialType: string;
  productName: string;
  materialCode: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  categoryL?: string;
  categoryM?: string;
  categoryS?: string;
}

interface DSMaterialItem {
  id: string;
  materialType: string;
  materialCode: string;
  materialName: string;
}

interface DSProductStock {
  id: string;
  productCode: string;
  productName: string;
  currentStock: number;
}

interface DSDropdownItem {
  value: string;
  label: string;
  vendorId: number | null;
  supplierId: number | null;
  supplyType: string[];
}

function DirectSalesManagement() {
  const { toast } = useToast();
  const dateRange = useDateRange("month");
  const [editDialog, setEditDialog] = useState<DirectSaleRow | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);

  const now = new Date();
  const kstNow = new Date(now.getTime() + now.getTimezoneOffset() * 60000 + 9 * 60 * 60 * 1000);
  const todayStr = `${kstNow.getFullYear()}-${String(kstNow.getMonth() + 1).padStart(2, '0')}-${String(kstNow.getDate()).padStart(2, '0')}`;

  const [addDate, setAddDate] = useState(todayStr);
  const [addClientType, setAddClientType] = useState<"vendor" | "member">("vendor");
  const [addClientValue, setAddClientValue] = useState("");
  const [clientSearchText, setClientSearchText] = useState("");
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);
  const clientSearchRef = useRef<HTMLDivElement>(null);
  const [addMemo, setAddMemo] = useState("");
  const [addTaxType, setAddTaxType] = useState("exempt");
  const [addMemberId, setAddMemberId] = useState("");
  const [memberSearchText, setMemberSearchText] = useState("");
  const [memberDropdownOpen, setMemberDropdownOpen] = useState(false);
  const memberSearchRef = useRef<HTMLDivElement>(null);
  const [addItems, setAddItems] = useState<DSItemRow[]>([{ materialType: "__all__", productName: "", materialCode: "", quantity: "", unit: "박스", unitPrice: "" }]);
  const [productSuggestionIdx, setProductSuggestionIdx] = useState<number | null>(null);
  const [suggestionHighlight, setSuggestionHighlight] = useState(-1);
  const [activeCell, setActiveCell] = useState<{ row: number; col: number } | null>(null);
  const cellRefs = useRef<Map<string, HTMLElement>>(new Map());
  const spreadsheetRef = useRef<HTMLTableElement>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [dropdownHighlight, setDropdownHighlight] = useState(-1);

  const [editFormData, setEditFormData] = useState({ saleDate: "", clientName: "", description: "", amount: "", memo: "", taxType: "exempt", memberId: "", clientType: "vendor" as string, vendorId: null as number | null });
  const [stockWarningDialog, setStockWarningDialog] = useState<{ open: boolean; insufficientItems: { itemCode: string; itemName: string; itemType: string; requestedQty: number; currentStock: number }[]; validItems: DSItemRow[]; clientName: string }>({ open: false, insufficientItems: [], validItems: [], clientName: "" });
  const [stockChecking, setStockChecking] = useState(false);

  const COLUMNS = ["type", "product", "quantity", "unit", "unitPrice"] as const;

  const setCellRef = useCallback((row: number, col: number, el: HTMLElement | null) => {
    const key = `${row}-${col}`;
    if (el) cellRefs.current.set(key, el);
    else cellRefs.current.delete(key);
  }, []);

  const focusCell = useCallback((row: number, col: number) => {
    setActiveCell({ row, col });
    const key = `${row}-${col}`;
    const colKey = COLUMNS[col];
    if (colKey === "type" || colKey === "unit") {
      setOpenDropdown(key);
    } else {
      setOpenDropdown(null);
    }
    setTimeout(() => {
      const el = cellRefs.current.get(key);
      if (el) {
        if (el.tagName === "INPUT") {
          (el as HTMLInputElement).focus();
          (el as HTMLInputElement).select();
        } else {
          el.focus();
        }
      }
    }, 50);
  }, []);

  const moveToNextCell = useCallback((row: number, col: number) => {
    const nextCol = col + 1;
    if (nextCol < COLUMNS.length) {
      focusCell(row, nextCol);
    } else {
      const newRow = row + 1;
      if (newRow >= addItems.length) {
        setAddItems(prev => [...prev, { materialType: "__all__", productName: "", materialCode: "", quantity: "", unit: "박스", unitPrice: "" }]);
        setTimeout(() => focusCell(newRow, 0), 80);
      } else {
        focusCell(newRow, 0);
      }
    }
  }, [addItems.length, focusCell]);

  const moveToPrevCell = useCallback((row: number, col: number) => {
    if (col > 0) {
      focusCell(row, col - 1);
    } else if (row > 0) {
      focusCell(row - 1, COLUMNS.length - 1);
    }
  }, [focusCell]);

  const handleCellKeyDown = useCallback((e: React.KeyboardEvent, row: number, col: number) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      moveToNextCell(row, col);
    } else if (e.key === "Tab") {
      e.preventDefault();
      if (e.shiftKey) {
        moveToPrevCell(row, col);
      } else {
        moveToNextCell(row, col);
      }
    } else if (e.key === "ArrowRight" && (COLUMNS[col] === "type" || COLUMNS[col] === "unit" || COLUMNS[col] === "product")) {
      moveToNextCell(row, col);
    } else if (e.key === "ArrowLeft" && (COLUMNS[col] === "type" || COLUMNS[col] === "unit" || COLUMNS[col] === "product")) {
      moveToPrevCell(row, col);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (row < addItems.length - 1) focusCell(row + 1, col);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (row > 0) focusCell(row - 1, col);
    }
  }, [moveToNextCell, moveToPrevCell, focusCell, addItems.length]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (clientSearchRef.current && !clientSearchRef.current.contains(e.target as Node)) {
        setClientDropdownOpen(false);
      }
      if (memberSearchRef.current && !memberSearchRef.current.contains(e.target as Node)) {
        setMemberDropdownOpen(false);
      }
      if (spreadsheetRef.current && !spreadsheetRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  const { data: dropdownData } = useQuery<{ items: { value: string; label: string; vendorId: number; businessType: string }[] }>({
    queryKey: ["/api/admin/accounting/sales-vendors/dropdown"],
  });
  const dropdownItems = dropdownData?.items || [];

  const { data: materialsData } = useQuery<DSMaterialItem[]>({
    queryKey: ["/api/materials"],
    queryFn: async () => {
      const res = await fetch("/api/materials", { credentials: "include" });
      if (!res.ok) throw new Error("원재료 목록 조회 실패");
      return res.json();
    },
  });
  const allMaterials = materialsData || [];

  const { data: productStocksData } = useQuery<DSProductStock[]>({
    queryKey: ["/api/product-stocks/all"],
    queryFn: async () => {
      const res = await fetch("/api/product-stocks/all", { credentials: "include" });
      if (!res.ok) throw new Error("공급상품 재고 조회 실패");
      return res.json();
    },
  });
  const allProductStocks = productStocksData || [];

  const { data: currentProductsData } = useQuery<any[]>({
    queryKey: ["/api/current-products"],
    queryFn: async () => {
      const res = await fetch("/api/current-products", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });
  const allCurrentProducts = currentProductsData || [];

  const { data: membersData } = useQuery<any[]>({
    queryKey: ["/api/admin/members"],
    queryFn: async () => {
      const res = await fetch("/api/admin/members", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });
  const allMembers = membersData || [];

  const filteredMembers = useMemo(() => {
    const active = allMembers.filter((m: any) => m.grade && m.grade !== "PENDING");
    if (!memberSearchText.trim()) return active.slice(0, 30);
    const term = memberSearchText.toLowerCase();
    return active.filter((m: any) =>
      (m.companyName || "").toLowerCase().includes(term) ||
      (m.name || "").toLowerCase().includes(term) ||
      (m.memberId || "").toLowerCase().includes(term)
    ).slice(0, 30);
  }, [allMembers, memberSearchText]);

  const filteredClients = useMemo(() => {
    if (!clientSearchText.trim()) return dropdownItems;
    const term = clientSearchText.toLowerCase();
    return dropdownItems.filter(d => d.label.toLowerCase().includes(term));
  }, [dropdownItems, clientSearchText]);

  const materialTypeMap: Record<string, string> = { raw: "raw", semi: "semi", sub: "subsidiary", subsidiary: "subsidiary", etc: "etc" };

  type SuggestionItem = { id: string; code: string; name: string; type: string; typeLabel: string; extra?: string };

  const getSuggestions = (text: string, typeFilter: string): SuggestionItem[] => {
    const results: SuggestionItem[] = [];
    const isMaterialType = typeFilter === "__all__" || typeFilter === "raw" || typeFilter === "semi" || typeFilter === "sub";
    const isProductType = typeFilter === "__all__" || typeFilter === "product";

    if (isMaterialType) {
      let filtered = allMaterials;
      if (typeFilter !== "__all__") {
        filtered = filtered.filter(m => m.materialType === typeFilter);
      }
      if (text.trim()) {
        const term = text.toLowerCase();
        filtered = filtered.filter(m =>
          m.materialName.toLowerCase().includes(term) || m.materialCode.toLowerCase().includes(term)
        );
      }
      filtered.slice(0, typeFilter === "__all__" ? 10 : 20).forEach(m => {
        const mapped = materialTypeMap[m.materialType] || m.materialType;
        results.push({
          id: m.id,
          code: m.materialCode,
          name: m.materialName,
          type: mapped,
          typeLabel: materialTypeLabelsDS[mapped] || m.materialType,
        });
      });
    }

    if (isProductType) {
      let filtered = allProductStocks;
      if (text.trim()) {
        const term = text.toLowerCase();
        filtered = filtered.filter(p =>
          p.productName.toLowerCase().includes(term) || p.productCode.toLowerCase().includes(term)
        );
      }
      filtered.slice(0, typeFilter === "__all__" ? 10 : 20).forEach(p => {
        results.push({
          id: p.id,
          code: p.productCode,
          name: p.productName,
          type: "product",
          typeLabel: "일반",
          extra: `재고: ${p.currentStock}`,
        });
      });
    }

    return results;
  };

  const getUnitByType = (type: string): string => {
    if (type === "product") return "박스";
    if (type === "raw" || type === "semi") return "kg";
    if (type === "sub" || type === "subsidiary") return "개";
    return "박스";
  };

  const selectSuggestion = (idx: number, item: SuggestionItem) => {
    let categoryL = "";
    let categoryM = "";
    let categoryS = "";
    if (item.type === "product") {
      const cp = allCurrentProducts.find((p: any) => p.productCode === item.code);
      if (cp) {
        categoryL = cp.categoryLarge || "";
        categoryM = cp.categoryMedium || "";
        categoryS = cp.categorySmall || "";
      }
    }
    setAddItems(prev => prev.map((row, i) => i === idx ? {
      ...row,
      productName: item.name,
      materialCode: item.code,
      materialType: item.type,
      unit: getUnitByType(item.type),
      categoryL,
      categoryM,
      categoryS,
    } : row));
    setProductSuggestionIdx(null);
  };

  const updateItem = (idx: number, field: keyof DSItemRow, value: string) => {
    setAddItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const itemTotal = (item: DSItemRow) => {
    const q = parseFloat(item.quantity) || 0;
    const p = parseInt(item.unitPrice) || 0;
    return Math.round(q * p);
  };

  const handleAddItem = () => {
    setAddItems(prev => [...prev, { materialType: "__all__", productName: "", materialCode: "", quantity: "", unit: "박스", unitPrice: "" }]);
  };

  const handleRemoveItem = (idx: number) => {
    setAddItems(prev => prev.filter((_, i) => i !== idx));
  };

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
      resetAddForm();
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

  const resetAddForm = () => {
    setShowAddDialog(false);
    setAddDate(todayStr);
    setAddClientType("vendor");
    setAddClientValue("");
    setClientSearchText("");
    setClientDropdownOpen(false);
    setAddMemo("");
    setAddTaxType("exempt");
    setAddMemberId("");
    setMemberSearchText("");
    setMemberDropdownOpen(false);
    setAddItems([{ materialType: "__all__", productName: "", materialCode: "", quantity: "", unit: "박스", unitPrice: "" }]);
    setProductSuggestionIdx(null);
    setActiveCell(null);
    setOpenDropdown(null);
  };

  const doRegister = (validItems: DSItemRow[], clientName: string) => {
    const selectedVendor = addClientType === "vendor" ? dropdownItems.find(d => d.value === addClientValue) : null;
    const promises = validItems.map(item => {
      const amt = itemTotal(item);
      return createMutation.mutateAsync({
        saleDate: addDate,
        clientName,
        clientType: addClientType,
        vendorId: selectedVendor?.vendorId || null,
        description: item.productName,
        amount: amt,
        memo: addMemo || null,
        productCode: item.materialType === "product" ? item.materialCode : null,
        productName: item.productName || null,
        quantity: item.quantity ? parseInt(item.quantity) : null,
        unitPrice: item.unitPrice ? parseInt(item.unitPrice) : null,
        categoryL: item.categoryL || null,
        categoryM: item.categoryM || null,
        categoryS: item.categoryS || null,
        taxType: addTaxType,
        memberId: addClientType === "member" ? addMemberId : null,
        stockItems: item.materialCode ? [{
          materialCode: item.materialCode,
          materialType: item.materialType,
          quantity: item.quantity,
          productName: item.productName,
        }] : undefined,
      });
    });

    Promise.all(promises).then(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/direct-sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/accounting/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/accounting/sales/daily"] });
      queryClient.invalidateQueries({ queryKey: ["/api/product-stocks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/materials"] });
      resetAddForm();
    }).catch(() => {});
  };

  const handleSubmit = async () => {
    if (addClientType === "vendor" && !addClientValue) {
      toast({ title: "매입업체를 선택해주세요", variant: "destructive" });
      return;
    }
    if (addClientType === "member" && !addMemberId) {
      toast({ title: "회원을 선택해주세요", variant: "destructive" });
      return;
    }
    const itemsWithInput = addItems.filter(item => item.productName || item.quantity || item.unitPrice);
    if (itemsWithInput.length === 0) {
      toast({ title: "품목을 입력해주세요", variant: "destructive" });
      return;
    }
    const validItems = itemsWithInput.filter(item => item.productName && item.quantity && item.unitPrice);
    if (validItems.length === 0) {
      toast({ title: "품목 정보를 완전히 입력해주세요", variant: "destructive" });
      return;
    }

    let clientName = "";
    if (addClientType === "vendor") {
      const selectedClient = dropdownItems.find(d => d.value === addClientValue);
      clientName = selectedClient?.label || addClientValue;
    } else {
      const selectedMember = allMembers.find((m: any) => m.memberId === addMemberId);
      clientName = selectedMember?.companyName || selectedMember?.name || addMemberId;
    }

    const itemsWithCode = validItems.filter(item => item.materialCode);
    if (itemsWithCode.length > 0) {
      setStockChecking(true);
      try {
        const checkRes = await apiRequest("POST", "/api/admin/direct-sales/check-stock", {
          items: itemsWithCode.map(item => ({
            materialCode: item.materialCode,
            productName: item.productName,
            materialType: item.materialType,
            quantity: item.quantity,
          })),
        });
        const checkData = await checkRes.json();

        if (!checkData.allSufficient) {
          setStockWarningDialog({
            open: true,
            insufficientItems: checkData.insufficientItems,
            validItems,
            clientName,
          });
          setStockChecking(false);
          return;
        }
      } catch (err: any) {
        toast({ title: "재고 확인 실패", description: err.message, variant: "destructive" });
        setStockChecking(false);
        return;
      }
      setStockChecking(false);
    }

    doRegister(validItems, clientName);
  };

  const handleEditSubmit = () => {
    if (!editDialog) return;
    const payload = {
      ...editFormData,
      amount: parseInt(editFormData.amount) || 0,
      memberId: editFormData.clientType === "member" ? (editFormData.memberId || null) : null,
      vendorId: editFormData.vendorId || null,
    };
    if (!payload.saleDate || !payload.clientName || !payload.description || payload.amount < 1) {
      toast({ title: "필수 항목을 입력해주세요", variant: "destructive" });
      return;
    }
    updateMutation.mutate({ id: editDialog.id, data: payload });
  };

  const handleEdit = (row: DirectSaleRow) => {
    setEditDialog(row);
    setEditFormData({
      saleDate: row.saleDate,
      clientName: row.clientName,
      description: row.description,
      amount: String(row.amount),
      memo: row.memo || "",
      taxType: row.taxType || "exempt",
      memberId: row.memberId || "",
      clientType: row.clientType || "vendor",
      vendorId: row.vendorId || null,
    });
  };

  const totalAmount = directList.reduce((s, d) => s + d.amount, 0);

  return (
    <div className="rounded-lg border-l-4 border-l-amber-500 border border-amber-200 dark:border-amber-900 bg-amber-50/40 dark:bg-amber-950/20 shadow-md">
      <div className="p-5">
        <SectionHeader number="3" title="직접 매출 관리" icon={Handshake} color="amber">
          <div className="flex items-center gap-2">
            <Button size="sm" className="gap-1" onClick={() => { resetAddForm(); setShowAddDialog(true); setAddDate(todayStr); }} data-testid="button-create-direct-sale">
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
                  <th className="text-center py-2.5 px-3 whitespace-nowrap text-xs font-semibold uppercase tracking-wider">구분</th>
                  <th className="text-left py-2.5 px-3 whitespace-nowrap text-xs font-semibold uppercase tracking-wider">거래처명</th>
                  <th className="text-left py-2.5 px-3 whitespace-nowrap text-xs font-semibold uppercase tracking-wider">내용</th>
                  <th className="text-right py-2.5 px-3 whitespace-nowrap text-xs font-semibold uppercase tracking-wider">금액</th>
                  <th className="text-center py-2.5 px-3 whitespace-nowrap text-xs font-semibold uppercase tracking-wider">과세</th>
                  <th className="text-left py-2.5 px-3 whitespace-nowrap text-xs font-semibold uppercase tracking-wider">메모</th>
                  <th className="text-center py-2.5 px-3 whitespace-nowrap text-xs font-semibold uppercase tracking-wider">관리</th>
                </tr>
              </thead>
              <tbody>
                {directList.map((d) => (
                  <tr key={d.id} className="border-b" data-testid={`row-direct-sale-${d.id}`}>
                    <td className="py-2 px-3 text-center whitespace-nowrap">{d.saleDate}</td>
                    <td className="py-2 px-3 text-center whitespace-nowrap">
                      <Badge variant="outline" className={`text-xs no-default-active-elevate ${d.clientType === "member" ? "border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-400" : "border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400"}`}>
                        {d.clientType === "member" ? "회원" : "매입업체"}
                      </Badge>
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">{d.clientName}</td>
                    <td className="py-2 px-3">{d.description}</td>
                    <td className="py-2 px-3 text-right whitespace-nowrap font-medium">{formatCurrency(d.amount)}</td>
                    <td className="py-2 px-3 text-center whitespace-nowrap">
                      <Badge variant={d.taxType === "taxable" ? "default" : "secondary"} className="text-xs">
                        {d.taxType === "taxable" ? "과세" : "면세"}
                      </Badge>
                    </td>
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
                  <td className="py-2.5 px-3" colSpan={4}>합계 ({directList.length}건)</td>
                  <td className="py-2.5 px-3 text-right">{formatCurrency(totalAmount)}</td>
                  <td className="py-2.5 px-3" colSpan={3}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <Dialog open={showAddDialog} onOpenChange={() => resetAddForm()}>
        <DialogContent className="w-[80vw] max-w-[80vw] h-[80vh] max-h-[80vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>매출 등록</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>매출일</Label>
                <Input type="date" value={addDate} onChange={(e) => setAddDate(e.target.value)} data-testid="input-sale-date" />
              </div>
              <div className="space-y-2">
                <Label>거래처 구분</Label>
                <div className="flex items-center gap-4 min-h-9">
                  <label className="flex items-center gap-1.5 cursor-pointer text-sm">
                    <input
                      type="radio"
                      name="clientType"
                      checked={addClientType === "vendor"}
                      onChange={() => { setAddClientType("vendor"); setAddMemberId(""); setMemberSearchText(""); }}
                      className="accent-amber-600"
                      data-testid="radio-client-vendor"
                    />
                    <Building2 className="h-3.5 w-3.5 text-amber-600" />
                    매입업체
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-sm">
                    <input
                      type="radio"
                      name="clientType"
                      checked={addClientType === "member"}
                      onChange={() => { setAddClientType("member"); setAddClientValue(""); setClientSearchText(""); }}
                      className="accent-blue-600"
                      data-testid="radio-client-member"
                    />
                    <Store className="h-3.5 w-3.5 text-blue-600" />
                    회원
                  </label>
                </div>
              </div>
              {addClientType === "vendor" ? (
                <div className="space-y-2" ref={clientSearchRef}>
                  <Label>매입업체 선택</Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
                    <Input
                      value={addClientValue ? (dropdownItems.find(d => d.value === addClientValue)?.label || "") : clientSearchText}
                      onChange={(e) => {
                        if (addClientValue) setAddClientValue("");
                        setClientSearchText(e.target.value);
                        setClientDropdownOpen(true);
                      }}
                      onFocus={() => {
                        if (addClientValue) {
                          const label = dropdownItems.find(d => d.value === addClientValue)?.label || "";
                          setClientSearchText(label);
                          setAddClientValue("");
                        }
                        setClientDropdownOpen(true);
                      }}
                      placeholder="매입업체 검색"
                      className="pl-8 pr-8"
                      data-testid="input-client-search"
                    />
                    {(addClientValue || clientSearchText) ? (
                      <button
                        type="button"
                        onClick={() => { setAddClientValue(""); setClientSearchText(""); setClientDropdownOpen(false); }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        data-testid="button-clear-client"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    ) : (
                      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    )}
                    {clientDropdownOpen && !addClientValue && (
                      <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-md max-h-[200px] overflow-y-auto">
                        {filteredClients.length === 0 ? (
                          <div className="px-3 py-2 text-sm text-muted-foreground">검색 결과가 없습니다</div>
                        ) : (
                          filteredClients.map(d => (
                            <button
                              key={d.value}
                              type="button"
                              className="w-full text-left px-3 py-2 text-sm hover-elevate cursor-pointer"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setAddClientValue(d.value);
                                setClientSearchText("");
                                setClientDropdownOpen(false);
                              }}
                              data-testid={`option-client-${d.value}`}
                            >
                              {d.label}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-2" ref={memberSearchRef}>
                  <Label>회원 선택</Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
                    <Input
                      value={addMemberId ? (allMembers.find((m: any) => m.memberId === addMemberId)?.companyName || addMemberId) : memberSearchText}
                      onChange={(e) => {
                        if (addMemberId) setAddMemberId("");
                        setMemberSearchText(e.target.value);
                        setMemberDropdownOpen(true);
                      }}
                      onFocus={() => {
                        if (addMemberId) {
                          const label = allMembers.find((m: any) => m.memberId === addMemberId)?.companyName || "";
                          setMemberSearchText(label);
                          setAddMemberId("");
                        }
                        setMemberDropdownOpen(true);
                      }}
                      placeholder="회원 검색 (업체명/이름)"
                      className="pl-8 pr-8"
                      data-testid="input-member-search"
                    />
                    {(addMemberId || memberSearchText) ? (
                      <button
                        type="button"
                        onClick={() => { setAddMemberId(""); setMemberSearchText(""); setMemberDropdownOpen(false); }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        data-testid="button-clear-member"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    ) : (
                      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    )}
                    {memberDropdownOpen && !addMemberId && (
                      <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-md max-h-[200px] overflow-y-auto">
                        {filteredMembers.length === 0 ? (
                          <div className="px-3 py-2 text-sm text-muted-foreground">검색 결과가 없습니다</div>
                        ) : (
                          filteredMembers.map((m: any) => (
                            <button
                              key={m.memberId}
                              type="button"
                              className="w-full text-left px-3 py-2 text-sm hover-elevate cursor-pointer"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setAddMemberId(m.memberId);
                                setMemberSearchText("");
                                setMemberDropdownOpen(false);
                              }}
                              data-testid={`option-member-${m.memberId}`}
                            >
                              <span className="font-medium">{m.companyName || m.name}</span>
                              <span className="text-muted-foreground ml-2 text-xs">({m.memberId})</span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label>과세구분</Label>
                <Select value={addTaxType} onValueChange={setAddTaxType}>
                  <SelectTrigger data-testid="select-tax-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="exempt">면세</SelectItem>
                    <SelectItem value="taxable">과세</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>메모 (선택)</Label>
                <Input value={addMemo} onChange={(e) => setAddMemo(e.target.value)} placeholder="메모" data-testid="input-sale-memo" />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>품목 목록 <span className="text-xs text-muted-foreground ml-2">(Enter: 다음 칸 이동 / 방향키·마우스: 자유 이동)</span></Label>
              </div>
              <div className="border rounded-lg">
                <table ref={spreadsheetRef} className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
                  <colgroup>
                    <col style={{ width: "40px" }} />
                    <col style={{ width: "110px" }} />
                    <col />
                    <col style={{ width: "90px" }} />
                    <col style={{ width: "85px" }} />
                    <col style={{ width: "110px" }} />
                    <col style={{ width: "110px" }} />
                    <col style={{ width: "120px" }} />
                    <col style={{ width: "36px" }} />
                  </colgroup>
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">#</th>
                      <th className="px-1 py-2 text-left text-xs font-medium text-muted-foreground">타입</th>
                      <th className="px-1 py-2 text-left text-xs font-medium text-muted-foreground">품목명</th>
                      <th className="px-1 py-2 text-left text-xs font-medium text-muted-foreground">수량</th>
                      <th className="px-1 py-2 text-left text-xs font-medium text-muted-foreground">단위</th>
                      <th className="px-1 py-2 text-left text-xs font-medium text-muted-foreground">단가</th>
                      <th className="px-1 py-2 text-right text-xs font-medium text-muted-foreground">금액</th>
                      <th className="px-1 py-2 text-right text-xs font-medium text-muted-foreground">누적합계</th>
                      <th className="px-1 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {addItems.map((item, idx) => {
                      const isActiveRow = activeCell?.row === idx;
                      const amt = itemTotal(item);
                      const cumAmt = addItems.slice(0, idx + 1).reduce((sum, it) => sum + itemTotal(it), 0);
                      return (
                        <tr key={idx} className={`border-b last:border-b-0 ${isActiveRow ? "bg-blue-50/60 dark:bg-blue-950/20" : ""}`}>
                          <td className="px-2 py-1 text-xs text-muted-foreground">{idx + 1}</td>
                          <td className="px-1 py-1">
                            <div
                              className={`relative h-8 flex items-center rounded-sm border cursor-pointer text-xs px-2 ${activeCell?.row === idx && activeCell?.col === 0 ? "border-primary ring-1 ring-primary bg-background" : "border-transparent"}`}
                              tabIndex={0}
                              ref={(el) => setCellRef(idx, 0, el)}
                              onClick={() => {
                                setActiveCell({ row: idx, col: 0 });
                                const key = `${idx}-0`;
                                setOpenDropdown(prev => {
                                  if (prev === key) return null;
                                  setDropdownHighlight(-1);
                                  return key;
                                });
                              }}
                              onKeyDown={(e) => {
                                if (openDropdown === `${idx}-0`) {
                                  if (e.key === "ArrowDown") { e.preventDefault(); setDropdownHighlight(prev => prev < salesTypeOptions.length - 1 ? prev + 1 : 0); return; }
                                  if (e.key === "ArrowUp") { e.preventDefault(); setDropdownHighlight(prev => prev > 0 ? prev - 1 : salesTypeOptions.length - 1); return; }
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    if (dropdownHighlight >= 0 && dropdownHighlight < salesTypeOptions.length) {
                                      const opt = salesTypeOptions[dropdownHighlight];
                                      setAddItems(prev => prev.map((it, i) => i === idx ? { ...it, materialType: opt.v, productName: "", materialCode: "" } : it));
                                      setOpenDropdown(null); setDropdownHighlight(-1); moveToNextCell(idx, 0);
                                    }
                                    return;
                                  }
                                  if (e.key === "Escape") { e.preventDefault(); setOpenDropdown(null); setDropdownHighlight(-1); return; }
                                } else {
                                  if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === " ") {
                                    e.preventDefault(); setOpenDropdown(`${idx}-0`); setDropdownHighlight(e.key === "ArrowUp" ? salesTypeOptions.length - 1 : 0); return;
                                  }
                                }
                                handleCellKeyDown(e, idx, 0);
                              }}
                              data-testid={`ds-cell-type-${idx}`}
                            >
                              <span className="truncate">{item.materialType === "__all__" ? "전체" : materialTypeLabelsDS[item.materialType] || item.materialType}</span>
                              <ChevronDown className="h-3 w-3 ml-auto shrink-0 text-muted-foreground" />
                              {openDropdown === `${idx}-0` && (
                                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-md">
                                  {salesTypeOptions.map((opt, oIdx) => (
                                    <button
                                      key={opt.v}
                                      type="button"
                                      className={`w-full text-left px-2 py-1.5 text-xs cursor-pointer ${dropdownHighlight === oIdx ? "bg-primary text-primary-foreground font-medium" : "hover-elevate"}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setAddItems(prev => prev.map((it, i) => i === idx ? { ...it, materialType: opt.v, productName: "", materialCode: "" } : it));
                                        setOpenDropdown(null); setDropdownHighlight(-1); moveToNextCell(idx, 0);
                                      }}
                                      onMouseEnter={() => setDropdownHighlight(oIdx)}
                                      data-testid={`ds-cell-type-opt-${idx}-${opt.v}`}
                                    >
                                      {opt.l}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-1 py-1">
                            <div className="relative">
                              {item.materialCode ? (
                                <div
                                  className={`h-8 flex items-center rounded-sm border text-xs px-2 cursor-pointer ${activeCell?.row === idx && activeCell?.col === 1 ? "border-primary ring-1 ring-primary bg-background" : "border-transparent bg-muted/30"}`}
                                  tabIndex={0}
                                  ref={(el) => setCellRef(idx, 1, el)}
                                  onClick={() => {
                                    setAddItems(prev => prev.map((it, i) => i === idx ? { ...it, productName: "", materialCode: "", materialType: "__all__" } : it));
                                    focusCell(idx, 1);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Backspace" || e.key === "Delete") {
                                      setAddItems(prev => prev.map((it, i) => i === idx ? { ...it, productName: "", materialCode: "", materialType: "__all__" } : it));
                                      focusCell(idx, 1);
                                    } else {
                                      handleCellKeyDown(e, idx, 1);
                                    }
                                  }}
                                  data-testid={`ds-cell-product-selected-${idx}`}
                                >
                                  <span className="truncate">{item.productName}</span>
                                  <X className="h-3 w-3 ml-auto shrink-0 text-muted-foreground" />
                                </div>
                              ) : (
                                <input
                                  type="text"
                                  className={`w-full h-8 rounded-sm border text-xs px-2 outline-none bg-background ${activeCell?.row === idx && activeCell?.col === 1 ? "border-primary ring-1 ring-primary" : "border-transparent"}`}
                                  ref={(el) => setCellRef(idx, 1, el as HTMLElement)}
                                  value={item.productName}
                                  onChange={(e) => { updateItem(idx, "productName", e.target.value); setProductSuggestionIdx(idx); setSuggestionHighlight(-1); }}
                                  onFocus={() => { setActiveCell({ row: idx, col: 1 }); setProductSuggestionIdx(idx); setSuggestionHighlight(-1); setOpenDropdown(null); }}
                                  onBlur={() => setTimeout(() => { setProductSuggestionIdx(null); setSuggestionHighlight(-1); }, 200)}
                                  onKeyDown={(e) => {
                                    const suggestions = productSuggestionIdx === idx && !item.materialCode ? getSuggestions(item.productName, item.materialType) : [];
                                    if (suggestions.length > 0) {
                                      if (e.key === "ArrowDown") { e.preventDefault(); setSuggestionHighlight(prev => prev < suggestions.length - 1 ? prev + 1 : 0); return; }
                                      if (e.key === "ArrowUp") { e.preventDefault(); setSuggestionHighlight(prev => prev > 0 ? prev - 1 : suggestions.length - 1); return; }
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        if (suggestionHighlight >= 0 && suggestionHighlight < suggestions.length) {
                                          selectSuggestion(idx, suggestions[suggestionHighlight]); setSuggestionHighlight(-1); moveToNextCell(idx, 1);
                                        } else if (suggestions.length === 1) {
                                          selectSuggestion(idx, suggestions[0]); setSuggestionHighlight(-1); moveToNextCell(idx, 1);
                                        }
                                        return;
                                      }
                                      if (e.key === "Escape") { e.preventDefault(); setProductSuggestionIdx(null); setSuggestionHighlight(-1); return; }
                                    }
                                    if (e.key === "Enter" && item.materialCode) { e.preventDefault(); moveToNextCell(idx, 1); return; }
                                    if (e.key === "ArrowDown" || e.key === "ArrowUp") return;
                                    handleCellKeyDown(e, idx, 1);
                                  }}
                                  placeholder="품목명 검색"
                                  data-testid={`ds-cell-product-${idx}`}
                                />
                              )}
                              {productSuggestionIdx === idx && !item.materialCode && (() => {
                                const suggestions = getSuggestions(item.productName, item.materialType);
                                return (
                                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-md max-h-[220px] overflow-y-auto min-w-[280px]">
                                    {suggestions.length === 0 ? (
                                      <div className="px-2 py-1.5 text-xs text-muted-foreground">검색 결과가 없습니다</div>
                                    ) : (
                                      suggestions.map((s, sIdx) => (
                                        <button
                                          key={`${s.type}-${s.id}`}
                                          type="button"
                                          ref={(el) => { if (el && suggestionHighlight === sIdx) el.scrollIntoView({ block: "nearest" }); }}
                                          className={`w-full text-left px-2 py-1 text-xs cursor-pointer flex items-center gap-1.5 ${suggestionHighlight === sIdx ? "bg-primary text-primary-foreground font-medium" : "hover-elevate"}`}
                                          onMouseDown={(e) => {
                                            e.preventDefault();
                                            selectSuggestion(idx, s); setSuggestionHighlight(-1); moveToNextCell(idx, 1);
                                          }}
                                          onMouseEnter={() => setSuggestionHighlight(sIdx)}
                                          data-testid={`ds-cell-suggestion-${idx}-${s.code}`}
                                        >
                                          <Badge variant="outline" className="no-default-active-elevate text-[10px] shrink-0">
                                            {s.typeLabel}
                                          </Badge>
                                          <span className="truncate">{s.name}</span>
                                          <span className="text-muted-foreground text-[10px] shrink-0">({s.code})</span>
                                          {s.extra && <span className="text-muted-foreground text-[10px] shrink-0">{s.extra}</span>}
                                        </button>
                                      ))
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          </td>
                          <td className="px-1 py-1">
                            <input
                              type="number"
                              className={`w-full h-8 rounded-sm border text-xs px-2 text-right outline-none bg-background ${activeCell?.row === idx && activeCell?.col === 2 ? "border-primary ring-1 ring-primary" : "border-transparent"}`}
                              ref={(el) => setCellRef(idx, 2, el as HTMLElement)}
                              value={item.quantity}
                              onChange={(e) => updateItem(idx, "quantity", e.target.value)}
                              onFocus={() => { setActiveCell({ row: idx, col: 2 }); setOpenDropdown(null); }}
                              onKeyDown={(e) => handleCellKeyDown(e, idx, 2)}
                              placeholder="0"
                              data-testid={`ds-cell-qty-${idx}`}
                            />
                          </td>
                          <td className="px-1 py-1">
                            <div
                              className={`relative h-8 flex items-center rounded-sm border cursor-pointer text-xs px-2 ${activeCell?.row === idx && activeCell?.col === 3 ? "border-primary ring-1 ring-primary bg-background" : "border-transparent"}`}
                              tabIndex={0}
                              ref={(el) => setCellRef(idx, 3, el)}
                              onClick={() => {
                                setActiveCell({ row: idx, col: 3 });
                                const key = `${idx}-3`;
                                setOpenDropdown(prev => {
                                  if (prev === key) return null;
                                  setDropdownHighlight(-1);
                                  return key;
                                });
                              }}
                              onKeyDown={(e) => {
                                if (openDropdown === `${idx}-3`) {
                                  if (e.key === "ArrowDown") { e.preventDefault(); setDropdownHighlight(prev => prev < unitOptionsDS.length - 1 ? prev + 1 : 0); return; }
                                  if (e.key === "ArrowUp") { e.preventDefault(); setDropdownHighlight(prev => prev > 0 ? prev - 1 : unitOptionsDS.length - 1); return; }
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    if (dropdownHighlight >= 0 && dropdownHighlight < unitOptionsDS.length) {
                                      updateItem(idx, "unit", unitOptionsDS[dropdownHighlight]);
                                      setOpenDropdown(null); setDropdownHighlight(-1); moveToNextCell(idx, 3);
                                    }
                                    return;
                                  }
                                  if (e.key === "Escape") { e.preventDefault(); setOpenDropdown(null); setDropdownHighlight(-1); return; }
                                } else {
                                  if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === " ") {
                                    e.preventDefault(); setOpenDropdown(`${idx}-3`); setDropdownHighlight(e.key === "ArrowUp" ? unitOptionsDS.length - 1 : 0); return;
                                  }
                                }
                                handleCellKeyDown(e, idx, 3);
                              }}
                              data-testid={`ds-cell-unit-${idx}`}
                            >
                              <span className="truncate">{item.unit}</span>
                              <ChevronDown className="h-3 w-3 ml-auto shrink-0 text-muted-foreground" />
                              {openDropdown === `${idx}-3` && (
                                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-md">
                                  {unitOptionsDS.map((u, uIdx) => (
                                    <button
                                      key={u}
                                      type="button"
                                      className={`w-full text-left px-2 py-1.5 text-xs cursor-pointer ${dropdownHighlight === uIdx ? "bg-primary text-primary-foreground font-medium" : "hover-elevate"}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        updateItem(idx, "unit", u);
                                        setOpenDropdown(null); setDropdownHighlight(-1); moveToNextCell(idx, 3);
                                      }}
                                      onMouseEnter={() => setDropdownHighlight(uIdx)}
                                      data-testid={`ds-cell-unit-opt-${idx}-${u}`}
                                    >
                                      {u}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-1 py-1">
                            <input
                              type="number"
                              className={`w-full h-8 rounded-sm border text-xs px-2 text-right outline-none bg-background ${activeCell?.row === idx && activeCell?.col === 4 ? "border-primary ring-1 ring-primary" : "border-transparent"}`}
                              ref={(el) => setCellRef(idx, 4, el as HTMLElement)}
                              value={item.unitPrice}
                              onChange={(e) => updateItem(idx, "unitPrice", e.target.value)}
                              onFocus={() => { setActiveCell({ row: idx, col: 4 }); setOpenDropdown(null); }}
                              onKeyDown={(e) => handleCellKeyDown(e, idx, 4)}
                              placeholder="0"
                              data-testid={`ds-cell-price-${idx}`}
                            />
                          </td>
                          <td className="px-1 py-1 text-right text-xs font-medium whitespace-nowrap">{amt > 0 ? `${amt.toLocaleString()}원` : ""}</td>
                          <td className="px-1 py-1 text-right text-xs font-semibold whitespace-nowrap text-orange-500" data-testid={`ds-text-cumulative-${idx}`}>{cumAmt > 0 ? `${cumAmt.toLocaleString()}원` : ""}</td>
                          <td className="px-1 py-1 text-center">
                            {addItems.length > 1 && (
                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleRemoveItem(idx)} data-testid={`ds-button-remove-item-${idx}`}><Trash2 className="h-3 w-3" /></Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between">
                <Button size="sm" variant="outline" onClick={handleAddItem} data-testid="ds-button-add-item">
                  <Plus className="h-3 w-3 mr-1" />행 추가
                </Button>
                <div className="text-sm font-semibold">
                  합계: <span className="text-primary">{addItems.reduce((s, item) => s + itemTotal(item), 0).toLocaleString()}원</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t shrink-0">
            <Button variant="outline" onClick={resetAddForm} data-testid="button-cancel-sale">취소</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || stockChecking} data-testid="button-submit-sale">
              {(createMutation.isPending || stockChecking) && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {stockChecking ? "재고 확인중..." : "등록"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={stockWarningDialog.open} onOpenChange={(open) => !open && setStockWarningDialog(prev => ({ ...prev, open: false }))}>
        <DialogContent className="max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              재고 부족 알림
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">다음 품목의 재고가 부족합니다:</p>
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="text-left px-3 py-2 font-medium">품목명</th>
                    <th className="text-right px-3 py-2 font-medium">요청 수량</th>
                    <th className="text-right px-3 py-2 font-medium">현재 재고</th>
                    <th className="text-right px-3 py-2 font-medium">부족분</th>
                  </tr>
                </thead>
                <tbody>
                  {stockWarningDialog.insufficientItems.map((item, i) => {
                    const typeLabel = item.itemType === "product" ? "일반" : item.itemType === "raw" ? "원물" : item.itemType === "semi" ? "반재료" : item.itemType === "sub" ? "부자재" : item.itemType;
                    const unitLabel = item.itemType === "product" ? "박스" : (item.itemType === "raw" || item.itemType === "semi") ? "kg" : "개";
                    return (
                      <tr key={i} className="border-b last:border-b-0">
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className="no-default-active-elevate text-[10px] shrink-0">{typeLabel}</Badge>
                            <span className="truncate">{item.itemName}</span>
                          </div>
                        </td>
                        <td className="text-right px-3 py-2 text-destructive font-medium">{item.requestedQty} {unitLabel}</td>
                        <td className="text-right px-3 py-2">{item.currentStock} {unitLabel}</td>
                        <td className="text-right px-3 py-2 text-destructive font-medium">
                          -{(item.requestedQty - item.currentStock).toFixed(item.itemType === "raw" || item.itemType === "semi" ? 1 : 0)} {unitLabel}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-sm text-destructive font-medium">재고가 부족하여 등록할 수 없습니다. 재고를 확인한 후 다시 시도해주세요.</p>
          </div>
          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={() => setStockWarningDialog(prev => ({ ...prev, open: false }))} data-testid="button-stock-warning-close">
              닫기
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editDialog} onOpenChange={(open) => { if (!open) setEditDialog(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>직접 매출 수정</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>매출일 *</Label>
              <Input type="date" value={editFormData.saleDate} onChange={(e) => setEditFormData(p => ({ ...p, saleDate: e.target.value }))} data-testid="input-edit-sale-date" />
            </div>
            <div className="space-y-1">
              <Label>거래처명 *</Label>
              <Input value={editFormData.clientName} onChange={(e) => setEditFormData(p => ({ ...p, clientName: e.target.value }))} placeholder="거래처명 입력" data-testid="input-edit-client-name" />
            </div>
            <div className="space-y-1">
              <Label>내용 *</Label>
              <Input value={editFormData.description} onChange={(e) => setEditFormData(p => ({ ...p, description: e.target.value }))} placeholder="매출 내용 입력" data-testid="input-edit-description" />
            </div>
            <div className="space-y-1">
              <Label>금액 *</Label>
              <Input type="number" value={editFormData.amount} onChange={(e) => setEditFormData(p => ({ ...p, amount: e.target.value }))} placeholder="금액 입력" data-testid="input-edit-amount" />
            </div>
            <div className="space-y-1">
              <Label>거래처 구분</Label>
              <div className="flex items-center gap-2 text-sm py-1">
                <Badge variant="outline" className={`no-default-active-elevate ${editFormData.clientType === "member" ? "border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-400" : "border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400"}`}>
                  {editFormData.clientType === "member" ? "회원" : "매입업체"}
                </Badge>
                <span className="text-muted-foreground text-xs">(구분은 변경 불가)</span>
              </div>
            </div>
            <div className="space-y-1">
              <Label>과세구분</Label>
              <Select value={editFormData.taxType} onValueChange={(v) => setEditFormData(p => ({ ...p, taxType: v }))}>
                <SelectTrigger data-testid="select-edit-tax-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="exempt">면세</SelectItem>
                  <SelectItem value="taxable">과세</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>메모</Label>
              <Textarea value={editFormData.memo} onChange={(e) => setEditFormData(p => ({ ...p, memo: e.target.value }))} placeholder="메모 (선택)" rows={2} data-testid="input-edit-memo" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(null)}>취소</Button>
            <Button onClick={handleEditSubmit} disabled={updateMutation.isPending} data-testid="button-submit-edit-sale">
              {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}수정
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function SalesOverviewTab() {
  return (
    <div className="space-y-10">
      <MonthlySalesSummary />
      <DailySalesDetail />
      <DirectSalesManagement />
    </div>
  );
}
