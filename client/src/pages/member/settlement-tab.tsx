import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Wallet, CreditCard, Gift, ArrowUpDown } from "lucide-react";
import { DateRangeFilter, useDateRange } from "@/components/common/DateRangeFilter";

interface SettlementRecord {
  id: number;
  memberId: string;
  orderId: number | null;
  settlementType: string;
  pointerAmount: number;
  depositAmount: number;
  totalAmount: number;
  pointerBalance: number;
  depositBalance: number;
  description: string | null;
  createdAt: string;
}

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

const typeLabels: Record<string, string> = {
  charge: "충전",
  refund: "환급",
  deduct: "정산 차감",
  grant: "지급",
  auto: "자동정산",
  manual: "수동정산",
};

export default function MemberSettlementTab() {
  const [subTab, setSubTab] = useState("balance");

  const settlementDateRange = useDateRange("month");
  const depositDateRange = useDateRange("month");
  const pointerDateRange = useDateRange("month");

  const { data: balanceData, isLoading: balanceLoading } = useQuery<{
    deposit: number;
    point: number;
    pendingOrdersTotal: number;
    availableBalance: number;
  }>({
    queryKey: ["/api/member/my-balance"],
  });

  const { data: settlements } = useQuery<{ records: SettlementRecord[]; total: number }>({
    queryKey: ["/api/member/my-settlements", settlementDateRange.dateRange.startDate, settlementDateRange.dateRange.endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (settlementDateRange.dateRange.startDate) params.set("startDate", settlementDateRange.dateRange.startDate);
      if (settlementDateRange.dateRange.endDate) params.set("endDate", settlementDateRange.dateRange.endDate);
      params.set("limit", "100");
      const res = await fetch(`/api/member/my-settlements?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("조회 실패");
      return res.json();
    },
  });

  const { data: depositRecords } = useQuery<{ records: DepositRecord[]; total: number }>({
    queryKey: ["/api/member/my-deposit-history", depositDateRange.dateRange.startDate, depositDateRange.dateRange.endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (depositDateRange.dateRange.startDate) params.set("startDate", depositDateRange.dateRange.startDate);
      if (depositDateRange.dateRange.endDate) params.set("endDate", depositDateRange.dateRange.endDate);
      params.set("limit", "100");
      const res = await fetch(`/api/member/my-deposit-history?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("조회 실패");
      return res.json();
    },
  });

  const { data: pointerRecords } = useQuery<{ records: PointerRecord[]; total: number }>({
    queryKey: ["/api/member/my-pointer-history", pointerDateRange.dateRange.startDate, pointerDateRange.dateRange.endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (pointerDateRange.dateRange.startDate) params.set("startDate", pointerDateRange.dateRange.startDate);
      if (pointerDateRange.dateRange.endDate) params.set("endDate", pointerDateRange.dateRange.endDate);
      params.set("limit", "100");
      const res = await fetch(`/api/member/my-pointer-history?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("조회 실패");
      return res.json();
    },
  });

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

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
                  onChange={settlementDateRange.setDateRange}
                  defaultPreset="month"
                />
              </div>
            </CardHeader>
            <CardContent className="overflow-hidden">
              <div className="border rounded-lg overflow-x-auto overflow-y-auto max-h-[600px]">
                <Table className="min-w-[800px]">
                  <TableHeader className="sticky top-0 z-10 bg-background">
                    <TableRow>
                      <TableHead>일시</TableHead>
                      <TableHead>유형</TableHead>
                      <TableHead className="text-right">포인터 차감</TableHead>
                      <TableHead className="text-right">예치금 차감</TableHead>
                      <TableHead className="text-right">총액</TableHead>
                      <TableHead className="text-right">포인터 잔액</TableHead>
                      <TableHead className="text-right">예치금 잔액</TableHead>
                      <TableHead>설명</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!settlements?.records?.length ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          정산 이력이 없습니다
                        </TableCell>
                      </TableRow>
                    ) : (
                      settlements.records.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell className="whitespace-nowrap">{formatDate(record.createdAt)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="no-default-active-elevate">
                              {typeLabels[record.settlementType] || record.settlementType}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{record.pointerAmount.toLocaleString()}P</TableCell>
                          <TableCell className="text-right">{record.depositAmount.toLocaleString()}원</TableCell>
                          <TableCell className="text-right font-medium">{record.totalAmount.toLocaleString()}원</TableCell>
                          <TableCell className="text-right text-muted-foreground">{record.pointerBalance.toLocaleString()}P</TableCell>
                          <TableCell className="text-right text-muted-foreground">{record.depositBalance.toLocaleString()}원</TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{record.description || "-"}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              {settlements && <p className="text-sm text-muted-foreground mt-2">총 {settlements.total}건</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deposit-history">
          <Card className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  예치금 이력
                </CardTitle>
                <DateRangeFilter
                  onChange={depositDateRange.setDateRange}
                  defaultPreset="month"
                />
              </div>
            </CardHeader>
            <CardContent className="overflow-hidden">
              <div className="border rounded-lg overflow-x-auto overflow-y-auto max-h-[600px]">
                <Table className="min-w-[700px]">
                  <TableHeader className="sticky top-0 z-10 bg-background">
                    <TableRow>
                      <TableHead>일시</TableHead>
                      <TableHead>유형</TableHead>
                      <TableHead className="text-right">금액</TableHead>
                      <TableHead className="text-right">잔액</TableHead>
                      <TableHead>설명</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!depositRecords?.records?.length ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          예치금 이력이 없습니다
                        </TableCell>
                      </TableRow>
                    ) : (
                      depositRecords.records.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell className="whitespace-nowrap">{formatDate(record.createdAt)}</TableCell>
                          <TableCell>
                            <Badge
                              variant={record.type === "charge" ? "default" : "destructive"}
                              className="no-default-active-elevate"
                            >
                              {typeLabels[record.type] || record.type}
                            </Badge>
                          </TableCell>
                          <TableCell className={`text-right font-medium ${record.type === "charge" ? "text-emerald-600" : "text-red-600"}`}>
                            {record.type === "charge" ? "+" : "-"}{record.amount.toLocaleString()}원
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">{record.balanceAfter.toLocaleString()}원</TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[250px] truncate">{record.description || "-"}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              {depositRecords && <p className="text-sm text-muted-foreground mt-2">총 {depositRecords.total}건</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pointer-history">
          <Card className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Gift className="h-5 w-5" />
                  포인터 이력
                </CardTitle>
                <DateRangeFilter
                  onChange={pointerDateRange.setDateRange}
                  defaultPreset="month"
                />
              </div>
            </CardHeader>
            <CardContent className="overflow-hidden">
              <div className="border rounded-lg overflow-x-auto overflow-y-auto max-h-[600px]">
                <Table className="min-w-[700px]">
                  <TableHeader className="sticky top-0 z-10 bg-background">
                    <TableRow>
                      <TableHead>일시</TableHead>
                      <TableHead>유형</TableHead>
                      <TableHead className="text-right">금액</TableHead>
                      <TableHead className="text-right">잔액</TableHead>
                      <TableHead>설명</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!pointerRecords?.records?.length ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          포인터 이력이 없습니다
                        </TableCell>
                      </TableRow>
                    ) : (
                      pointerRecords.records.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell className="whitespace-nowrap">{formatDate(record.createdAt)}</TableCell>
                          <TableCell>
                            <Badge
                              variant={record.type === "grant" ? "default" : "destructive"}
                              className="no-default-active-elevate"
                            >
                              {typeLabels[record.type] || record.type}
                            </Badge>
                          </TableCell>
                          <TableCell className={`text-right font-medium ${record.type === "grant" ? "text-emerald-600" : "text-red-600"}`}>
                            {record.type === "grant" ? "+" : "-"}{record.amount.toLocaleString()}P
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">{record.balanceAfter.toLocaleString()}P</TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[250px] truncate">{record.description || "-"}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              {pointerRecords && <p className="text-sm text-muted-foreground mt-2">총 {pointerRecords.total}건</p>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
