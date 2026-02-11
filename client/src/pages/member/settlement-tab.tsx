import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Wallet, CreditCard, Gift, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { DateRangeFilter, useDateRange } from "@/components/common/DateRangeFilter";

interface DepositRecord {
  id: number;
  type: string;
  amount: number;
  balanceAfter: number;
  description: string | null;
  createdAt: string;
}

interface PointerRecord {
  id: number;
  type: string;
  amount: number;
  balanceAfter: number;
  description: string | null;
  createdAt: string;
}

interface SettlementViewItem {
  type: "order" | "deposit" | "pointer";
  date: string;
  productName: string;
  productCode: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  depositAmount: number;
  pointerAmount: number;
  description?: string;
}

interface SettlementViewResponse {
  items: SettlementViewItem[];
  totalOrderAmount: number;
  totalDeposit: number;
  totalPointer: number;
  totalBalance: number;
}


function formatCurrency(n: number): string {
  return n.toLocaleString("ko-KR") + "원";
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const depositTypeLabels: Record<string, string> = {
  charge: "입금/예치금 충전",
  deduct: "정산 차감",
  refund: "환급/예치금 환급",
};

const pointerTypeLabels: Record<string, string> = {
  grant: "포인터 충전",
  deduct: "정산 차감",
  expire: "포인터 만료",
};

function DepositHistoryTab({ dateRange }: { dateRange: any }) {
  const [page, setPage] = useState(1);
  const PER_PAGE = 50;

  const { data, isLoading } = useQuery<{ records: DepositRecord[]; total: number }>({
    queryKey: ["/api/member/my-deposit-history", dateRange.dateRange.startDate, dateRange.dateRange.endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateRange.dateRange.startDate) params.set("startDate", dateRange.dateRange.startDate);
      if (dateRange.dateRange.endDate) params.set("endDate", dateRange.dateRange.endDate);
      params.set("limit", "500");
      const res = await fetch(`/api/member/my-deposit-history?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("조회 실패");
      return res.json();
    },
  });

  const allRecords = [...(data?.records || [])].reverse();
  const totalCharge = allRecords.filter(r => r.type === "charge").reduce((s, r) => s + r.amount, 0);
  const totalDeduct = allRecords.filter(r => r.type === "deduct").reduce((s, r) => s + r.amount, 0);
  const totalRefund = allRecords.filter(r => r.type === "refund").reduce((s, r) => s + r.amount, 0);
  const lastBalance = allRecords.length > 0 ? allRecords[allRecords.length - 1].balanceAfter : 0;

  const totalPages = Math.ceil(allRecords.length / PER_PAGE);
  const pagedRecords = allRecords.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            예치금 이력
          </CardTitle>
          <DateRangeFilter
            onChange={(range) => { dateRange.setDateRange(range); setPage(1); }}
            defaultPreset="month"
          />
        </div>
      </CardHeader>
      <CardContent className="overflow-hidden space-y-3">
        <div className="flex flex-wrap gap-4 items-center text-sm">
          <span className="text-muted-foreground">총 {allRecords.length}건</span>
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">충전합계: {formatCurrency(totalCharge)}</span>
          <span className="font-semibold text-red-600 dark:text-red-400">차감합계: {formatCurrency(totalDeduct + totalRefund)}</span>
          <span className="font-semibold">예치금 잔액: {formatCurrency(lastBalance)}</span>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : allRecords.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">조회된 예치금 이력이 없습니다.</div>
        ) : (
          <>
            <div className="hidden md:block border rounded-md overflow-x-auto overflow-y-auto max-h-[600px]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b bg-muted/30">
                    <th className="text-center py-2 px-3 whitespace-nowrap">적용날짜</th>
                    <th className="text-left py-2 px-3 whitespace-nowrap">구분</th>
                    <th className="text-right py-2 px-3 whitespace-nowrap">금액</th>
                    <th className="text-left py-2 px-3 whitespace-nowrap">적요</th>
                    <th className="text-right py-2 px-3 whitespace-nowrap">예치금 잔액</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedRecords.map((record, idx) => {
                    const isCredit = record.type === "charge";
                    const isRefund = record.type === "refund";
                    return (
                      <tr
                        key={record.id}
                        className={`border-b ${isCredit ? "bg-emerald-50 dark:bg-emerald-950/30" : ""}`}
                        data-testid={`row-deposit-${idx}`}
                      >
                        <td className="py-2 px-3 text-center whitespace-nowrap">{formatDateShort(record.createdAt)}</td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          <span className={isCredit ? "text-emerald-600 dark:text-emerald-400 font-medium" : isRefund ? "text-red-600 dark:text-red-400 font-medium" : "font-medium"}>
                            {depositTypeLabels[record.type] || record.type}
                          </span>
                        </td>
                        <td className={`py-2 px-3 text-right whitespace-nowrap font-medium ${isCredit ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                          {isCredit ? `+${formatCurrency(record.amount)}` : `-${formatCurrency(record.amount)}`}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap text-sm text-muted-foreground">{record.description || "-"}</td>
                        <td className="py-2 px-3 text-right whitespace-nowrap font-medium">{formatCurrency(record.balanceAfter)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/20 font-semibold">
                    <td className="py-2 px-3 text-center" colSpan={2}>합계</td>
                    <td className="py-2 px-3 text-right">
                      <span className="text-emerald-600 dark:text-emerald-400">+{formatCurrency(totalCharge)}</span>
                      {" / "}
                      <span className="text-red-600 dark:text-red-400">-{formatCurrency(totalDeduct + totalRefund)}</span>
                    </td>
                    <td className="py-2 px-3"></td>
                    <td className="py-2 px-3 text-right">{formatCurrency(lastBalance)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="md:hidden space-y-2">
              {pagedRecords.map((record, idx) => {
                const isCredit = record.type === "charge";
                const isRefund = record.type === "refund";
                return (
                  <Card
                    key={record.id}
                    className={isCredit ? "border-emerald-200 dark:border-emerald-800" : ""}
                    data-testid={`card-deposit-${idx}`}
                  >
                    <CardContent className="p-3 space-y-1">
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-xs text-muted-foreground">{formatDateShort(record.createdAt)}</span>
                        <span className="text-xs font-medium">잔액: {formatCurrency(record.balanceAfter)}</span>
                      </div>
                      <div className={`font-medium text-sm ${isCredit ? "text-emerald-600 dark:text-emerald-400" : isRefund ? "text-red-600 dark:text-red-400" : ""}`}>
                        {depositTypeLabels[record.type] || record.type}
                        <span className="ml-2">
                          {isCredit ? `+${formatCurrency(record.amount)}` : `-${formatCurrency(record.amount)}`}
                        </span>
                      </div>
                      {record.description && (
                        <div className="text-xs text-muted-foreground">{record.description}</div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
              <Card>
                <CardContent className="p-3">
                  <div className="flex flex-col gap-1 text-sm">
                    <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                      <span>충전합계</span>
                      <span>+{formatCurrency(totalCharge)}</span>
                    </div>
                    <div className="flex justify-between text-red-600 dark:text-red-400">
                      <span>차감합계</span>
                      <span>-{formatCurrency(totalDeduct + totalRefund)}</span>
                    </div>
                    <div className="flex justify-between font-semibold border-t pt-1">
                      <span>예치금 잔액</span>
                      <span>{formatCurrency(lastBalance)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)} data-testid="button-deposit-prev">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">{page} / {totalPages}</span>
            <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} data-testid="button-deposit-next">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PointerHistoryTab({ dateRange }: { dateRange: any }) {
  const [page, setPage] = useState(1);
  const PER_PAGE = 50;

  const { data, isLoading } = useQuery<{ records: PointerRecord[]; total: number }>({
    queryKey: ["/api/member/my-pointer-history", dateRange.dateRange.startDate, dateRange.dateRange.endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateRange.dateRange.startDate) params.set("startDate", dateRange.dateRange.startDate);
      if (dateRange.dateRange.endDate) params.set("endDate", dateRange.dateRange.endDate);
      params.set("limit", "500");
      const res = await fetch(`/api/member/my-pointer-history?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("조회 실패");
      return res.json();
    },
  });

  const allRecords = [...(data?.records || [])].reverse();
  const totalGrant = allRecords.filter(r => r.type === "grant").reduce((s, r) => s + r.amount, 0);
  const totalDeduct = allRecords.filter(r => r.type === "deduct").reduce((s, r) => s + r.amount, 0);
  const totalExpire = allRecords.filter(r => r.type === "expire").reduce((s, r) => s + r.amount, 0);
  const lastBalance = allRecords.length > 0 ? allRecords[allRecords.length - 1].balanceAfter : 0;

  const totalPages = Math.ceil(allRecords.length / PER_PAGE);
  const pagedRecords = allRecords.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Gift className="h-5 w-5" />
            포인터 이력
          </CardTitle>
          <DateRangeFilter
            onChange={(range) => { dateRange.setDateRange(range); setPage(1); }}
            defaultPreset="month"
          />
        </div>
      </CardHeader>
      <CardContent className="overflow-hidden space-y-3">
        <div className="flex flex-wrap gap-4 items-center text-sm">
          <span className="text-muted-foreground">총 {allRecords.length}건</span>
          <span className="font-semibold text-amber-600 dark:text-amber-400">충전합계: {totalGrant.toLocaleString()}P</span>
          <span className="font-semibold text-red-600 dark:text-red-400">차감합계: {(totalDeduct + totalExpire).toLocaleString()}P</span>
          <span className="font-semibold">포인터 잔액: {lastBalance.toLocaleString()}P</span>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : allRecords.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">조회된 포인터 이력이 없습니다.</div>
        ) : (
          <>
            <div className="hidden md:block border rounded-md overflow-x-auto overflow-y-auto max-h-[600px]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b bg-muted/30">
                    <th className="text-center py-2 px-3 whitespace-nowrap">적용날짜</th>
                    <th className="text-left py-2 px-3 whitespace-nowrap">구분</th>
                    <th className="text-right py-2 px-3 whitespace-nowrap">금액</th>
                    <th className="text-left py-2 px-3 whitespace-nowrap">적요</th>
                    <th className="text-right py-2 px-3 whitespace-nowrap">포인터 잔액</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedRecords.map((record, idx) => {
                    const isCredit = record.type === "grant";
                    return (
                      <tr
                        key={record.id}
                        className={`border-b ${isCredit ? "bg-amber-50 dark:bg-amber-950/30" : ""}`}
                        data-testid={`row-pointer-${idx}`}
                      >
                        <td className="py-2 px-3 text-center whitespace-nowrap">{formatDateShort(record.createdAt)}</td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          <span className={isCredit ? "text-amber-600 dark:text-amber-400 font-medium" : "font-medium"}>
                            {pointerTypeLabels[record.type] || record.type}
                          </span>
                        </td>
                        <td className={`py-2 px-3 text-right whitespace-nowrap font-medium ${isCredit ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>
                          {isCredit ? `+${record.amount.toLocaleString()}P` : `-${record.amount.toLocaleString()}P`}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap text-sm text-muted-foreground">{record.description || "-"}</td>
                        <td className="py-2 px-3 text-right whitespace-nowrap font-medium">{record.balanceAfter.toLocaleString()}P</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/20 font-semibold">
                    <td className="py-2 px-3 text-center" colSpan={2}>합계</td>
                    <td className="py-2 px-3 text-right">
                      <span className="text-amber-600 dark:text-amber-400">+{totalGrant.toLocaleString()}P</span>
                      {" / "}
                      <span className="text-red-600 dark:text-red-400">-{(totalDeduct + totalExpire).toLocaleString()}P</span>
                    </td>
                    <td className="py-2 px-3"></td>
                    <td className="py-2 px-3 text-right">{lastBalance.toLocaleString()}P</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="md:hidden space-y-2">
              {pagedRecords.map((record, idx) => {
                const isCredit = record.type === "grant";
                return (
                  <Card
                    key={record.id}
                    className={isCredit ? "border-amber-200 dark:border-amber-800" : ""}
                    data-testid={`card-pointer-${idx}`}
                  >
                    <CardContent className="p-3 space-y-1">
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-xs text-muted-foreground">{formatDateShort(record.createdAt)}</span>
                        <span className="text-xs font-medium">잔액: {record.balanceAfter.toLocaleString()}P</span>
                      </div>
                      <div className={`font-medium text-sm ${isCredit ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>
                        {pointerTypeLabels[record.type] || record.type}
                        <span className="ml-2">
                          {isCredit ? `+${record.amount.toLocaleString()}P` : `-${record.amount.toLocaleString()}P`}
                        </span>
                      </div>
                      {record.description && (
                        <div className="text-xs text-muted-foreground">{record.description}</div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
              <Card>
                <CardContent className="p-3">
                  <div className="flex flex-col gap-1 text-sm">
                    <div className="flex justify-between text-amber-600 dark:text-amber-400">
                      <span>충전합계</span>
                      <span>+{totalGrant.toLocaleString()}P</span>
                    </div>
                    <div className="flex justify-between text-red-600 dark:text-red-400">
                      <span>차감합계</span>
                      <span>-{(totalDeduct + totalExpire).toLocaleString()}P</span>
                    </div>
                    <div className="flex justify-between font-semibold border-t pt-1">
                      <span>포인터 잔액</span>
                      <span>{lastBalance.toLocaleString()}P</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)} data-testid="button-pointer-prev">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">{page} / {totalPages}</span>
            <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} data-testid="button-pointer-next">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function MemberSettlementTab() {
  const [subTab, setSubTab] = useState("balance");

  const settlementDateRange = useDateRange("month");
  const depositDateRange = useDateRange("month");
  const pointerDateRange = useDateRange("month");

  const ITEMS_PER_PAGE = 50;
  const [settlementPage, setSettlementPage] = useState(1);

  const { data: balanceData, isLoading: balanceLoading } = useQuery<{
    deposit: number;
    point: number;
    pendingOrdersTotal: number;
    availableBalance: number;
  }>({
    queryKey: ["/api/member/my-balance"],
  });

  const { data: settlementView, isLoading: settlementViewLoading } = useQuery<SettlementViewResponse>({
    queryKey: ["/api/member/my-settlement-view", settlementDateRange.dateRange.startDate, settlementDateRange.dateRange.endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (settlementDateRange.dateRange.startDate) params.set("startDate", settlementDateRange.dateRange.startDate);
      if (settlementDateRange.dateRange.endDate) params.set("endDate", settlementDateRange.dateRange.endDate);
      const res = await fetch(`/api/member/my-settlement-view?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("조회 실패");
      return res.json();
    },
  });


  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const allItems = settlementView?.items || [];
  const totalOrderAmount = settlementView?.totalOrderAmount || 0;
  const totalDeposit = settlementView?.totalDeposit || 0;
  const totalPointer = settlementView?.totalPointer || 0;
  const totalBalance = settlementView?.totalBalance || 0;

  let runningOrderTotal = 0;
  let runningCreditTotal = 0;
  const itemsWithBalance = allItems.map((item) => {
    if (item.type === "order") {
      runningOrderTotal += item.subtotal;
    } else {
      runningCreditTotal += (item.depositAmount + item.pointerAmount);
    }
    return { ...item, balance: runningCreditTotal - runningOrderTotal };
  });

  const totalPages = Math.ceil(itemsWithBalance.length / ITEMS_PER_PAGE);
  const pagedItems = itemsWithBalance.slice((settlementPage - 1) * ITEMS_PER_PAGE, settlementPage * ITEMS_PER_PAGE);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-emerald-600" />
            <CardTitle className="text-base">내 잔액 현황</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {balanceLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : balanceData ? (
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="border rounded-lg p-4 flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 dark:bg-emerald-900/40 rounded-lg">
                    <CreditCard className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">예치금</p>
                    <p className="text-xl font-bold" data-testid="text-deposit">{balanceData.deposit.toLocaleString()}원</p>
                  </div>
                </div>
                <div className="border rounded-lg p-4 flex items-center gap-3">
                  <div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-lg">
                    <Gift className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">포인터</p>
                    <p className="text-xl font-bold" data-testid="text-pointer">{balanceData.point.toLocaleString()}P</p>
                  </div>
                </div>
              </div>
              <div className="border rounded-lg p-3 bg-muted/30">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">진행중 주문 총액</span>
                  <span className="font-medium">-{balanceData.pendingOrdersTotal.toLocaleString()}원</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-1 pt-1 border-t">
                  <span className="font-medium">사용 가능 잔액</span>
                  <span className="font-bold text-emerald-600" data-testid="text-available-balance">{balanceData.availableBalance.toLocaleString()}원</span>
                </div>
              </div>
              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-lg p-4">
                <p className="text-sm font-medium mb-1">예치금 충전 안내</p>
                <p className="text-xs text-muted-foreground">
                  예치금 충전은 관리자에게 문의해주세요. 계좌이체 후 관리자가 확인하여 충전해드립니다.
                </p>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="balance" data-testid="tab-balance">정산 이력</TabsTrigger>
          <TabsTrigger value="deposit-history" data-testid="tab-deposit-history">예치금 이력</TabsTrigger>
          <TabsTrigger value="pointer-history" data-testid="tab-pointer-history">포인터 이력</TabsTrigger>
        </TabsList>

        <TabsContent value="balance">
          <Card className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ArrowUpDown className="h-5 w-5" />
                  정산 이력
                </CardTitle>
                <DateRangeFilter
                  onChange={(range) => { settlementDateRange.setDateRange(range); setSettlementPage(1); }}
                  defaultPreset="month"
                />
              </div>
            </CardHeader>
            <CardContent className="overflow-hidden space-y-3">
              <div className="flex flex-wrap gap-4 items-center text-sm">
                <span className="text-muted-foreground">총 {allItems.length}건</span>
                <span className="font-semibold">주문합계: {formatCurrency(totalOrderAmount)}</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">입금합계: {formatCurrency(totalDeposit + totalPointer)}</span>
                <span className="font-semibold">예치금+포인터 잔액: {formatCurrency(itemsWithBalance.length > 0 ? itemsWithBalance[itemsWithBalance.length - 1].balance : 0)}</span>
              </div>

              {settlementViewLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : allItems.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  조회된 정산 데이터가 없습니다.
                </div>
              ) : (
                <>
                  <div className="hidden md:block border rounded-md overflow-x-auto overflow-y-auto max-h-[600px]">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 z-10">
                        <tr className="border-b bg-muted/30">
                          <th className="text-center py-2 px-3 whitespace-nowrap">적용날짜</th>
                          <th className="text-left py-2 px-3 whitespace-nowrap">상품명</th>
                          <th className="text-right py-2 px-3 whitespace-nowrap">수량</th>
                          <th className="text-right py-2 px-3 whitespace-nowrap">공급단가</th>
                          <th className="text-right py-2 px-3 whitespace-nowrap">합계</th>
                          <th className="text-right py-2 px-3 whitespace-nowrap">적요</th>
                          <th className="text-right py-2 px-3 whitespace-nowrap">예치금+포인터 잔액</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagedItems.map((item, idx) => (
                          <tr
                            key={`${item.type}-${item.date}-${item.productCode}-${item.unitPrice}-${idx}`}
                            className={`border-b ${item.type !== "order" ? "bg-emerald-50 dark:bg-emerald-950/30" : ""}`}
                            data-testid={`row-settlement-${idx}`}
                          >
                            <td className="py-2 px-3 text-center whitespace-nowrap">{item.date}</td>
                            <td className="py-2 px-3 whitespace-nowrap">
                              {item.type === "deposit" ? (
                                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                  {item.depositAmount < 0 ? "환급/예치금 환급" : "입금/예치금 충전"}
                                </span>
                              ) : item.type === "pointer" ? (
                                <span className="text-amber-600 dark:text-amber-400 font-medium">
                                  포인터 충전
                                </span>
                              ) : item.productName}
                            </td>
                            <td className="py-2 px-3 text-right whitespace-nowrap">
                              {item.type === "order" ? item.quantity : ""}
                            </td>
                            <td className="py-2 px-3 text-right whitespace-nowrap">
                              {item.type === "order" ? formatCurrency(item.unitPrice) : ""}
                            </td>
                            <td className="py-2 px-3 text-right whitespace-nowrap font-medium">
                              {item.type === "order" ? formatCurrency(item.subtotal) : ""}
                            </td>
                            <td className={`py-2 px-3 text-right whitespace-nowrap font-medium ${item.type === "deposit" && item.depositAmount < 0 ? "text-red-600 dark:text-red-400" : item.type !== "order" ? "text-emerald-600 dark:text-emerald-400" : ""}`}>
                              {item.type === "deposit" && item.depositAmount !== 0 ? (item.depositAmount < 0 ? `-${formatCurrency(Math.abs(item.depositAmount))}` : `+${formatCurrency(item.depositAmount)}`) : ""}
                              {item.type === "pointer" && item.pointerAmount > 0 ? `+${item.pointerAmount.toLocaleString()}P` : ""}
                            </td>
                            <td className="py-2 px-3 text-right whitespace-nowrap font-medium">{formatCurrency(item.balance)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-muted/20 font-semibold">
                          <td className="py-2 px-3 text-center" colSpan={2}>합계</td>
                          <td className="py-2 px-3 text-right">
                            {allItems.filter(i => i.type === "order").reduce((s, i) => s + i.quantity, 0)}
                          </td>
                          <td className="py-2 px-3"></td>
                          <td className="py-2 px-3 text-right">{formatCurrency(totalOrderAmount)}</td>
                          <td className="py-2 px-3 text-right text-emerald-600 dark:text-emerald-400">+{formatCurrency(totalDeposit + totalPointer)}</td>
                          <td className="py-2 px-3 text-right">{formatCurrency(itemsWithBalance.length > 0 ? itemsWithBalance[itemsWithBalance.length - 1].balance : 0)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  <div className="md:hidden space-y-2">
                    {pagedItems.map((item, idx) => (
                      <Card
                        key={`${item.type}-${item.date}-${item.productCode}-${item.unitPrice}-${idx}`}
                        className={item.type !== "order" ? "border-emerald-200 dark:border-emerald-800" : ""}
                        data-testid={`card-settlement-${idx}`}
                      >
                        <CardContent className="p-3 space-y-1">
                          <div className="flex justify-between items-start gap-2">
                            <span className="text-xs text-muted-foreground">{item.date}</span>
                            <span className="text-xs font-medium">잔액: {formatCurrency(item.balance)}</span>
                          </div>
                          {item.type === "deposit" ? (
                            <div className={`font-medium text-sm ${item.depositAmount < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                              {item.depositAmount < 0 ? `환급/예치금 환급` : `입금/예치금 충전`}
                              <span className="ml-2">{item.depositAmount < 0 ? `-${formatCurrency(Math.abs(item.depositAmount))}` : `+${formatCurrency(item.depositAmount)}`}</span>
                            </div>
                          ) : item.type === "pointer" ? (
                            <div className="font-medium text-sm text-amber-600 dark:text-amber-400">
                              포인터 충전
                              <span className="ml-2">+{item.pointerAmount.toLocaleString()}P</span>
                            </div>
                          ) : (
                            <>
                              <div className="font-medium text-sm">{item.productName}</div>
                              <div className="flex justify-between text-xs">
                                <span>{item.quantity}개 x {formatCurrency(item.unitPrice)}</span>
                                <span className="font-medium">{formatCurrency(item.subtotal)}</span>
                              </div>
                            </>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                    <Card>
                      <CardContent className="p-3">
                        <div className="flex flex-col gap-1 text-sm">
                          <div className="flex justify-between font-semibold">
                            <span>주문합계</span>
                            <span>{formatCurrency(totalOrderAmount)}</span>
                          </div>
                          <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                            <span>입금합계</span>
                            <span>{formatCurrency(totalDeposit + totalPointer)}</span>
                          </div>
                          <div className="flex justify-between font-semibold border-t pt-1">
                            <span>예치금+포인터 잔액</span>
                            <span>{formatCurrency(itemsWithBalance.length > 0 ? itemsWithBalance[itemsWithBalance.length - 1].balance : 0)}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </>
              )}

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                  <Button size="sm" variant="outline" disabled={settlementPage <= 1} onClick={() => setSettlementPage(p => p - 1)} data-testid="button-settlement-prev">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm">{settlementPage} / {totalPages}</span>
                  <Button size="sm" variant="outline" disabled={settlementPage >= totalPages} onClick={() => setSettlementPage(p => p + 1)} data-testid="button-settlement-next">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deposit-history">
          <DepositHistoryTab dateRange={depositDateRange} />
        </TabsContent>

        <TabsContent value="pointer-history">
          <PointerHistoryTab dateRange={pointerDateRange} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
