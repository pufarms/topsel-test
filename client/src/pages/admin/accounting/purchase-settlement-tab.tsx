import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, AlertTriangle, Download } from "lucide-react";
import { DateRangeFilter, useDateRange } from "@/components/common/DateRangeFilter";

interface VendorBalance {
  id: number;
  companyName: string;
  totalPurchases: number;
  totalPayments: number;
  outstandingBalance: number;
}

interface TransactionRecord {
  id: number;
  date: string;
  type: "purchase" | "payment";
  description: string;
  amount: number;
  runningBalance: number;
}

export default function PurchaseSettlementTab() {
  const { toast } = useToast();
  const [selectedVendor, setSelectedVendor] = useState<VendorBalance | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMemo, setPaymentMemo] = useState("");
  const detailDateRange = useDateRange("3months");

  const { data: vendorBalances = [], isLoading } = useQuery<VendorBalance[]>({
    queryKey: ["/api/admin/accounting/vendor-balances"],
  });

  const { data: transactions = [] } = useQuery<TransactionRecord[]>({
    queryKey: ["/api/admin/accounting/vendor-transactions", selectedVendor?.id, detailDateRange.dateRange.startDate, detailDateRange.dateRange.endDate],
    queryFn: async () => {
      if (!selectedVendor) return [];
      const params = new URLSearchParams();
      if (detailDateRange.dateRange.startDate) params.set("startDate", detailDateRange.dateRange.startDate);
      if (detailDateRange.dateRange.endDate) params.set("endDate", detailDateRange.dateRange.endDate);
      const res = await fetch(`/api/admin/accounting/vendors/${selectedVendor.id}/transactions?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("조회 실패");
      return res.json();
    },
    enabled: !!selectedVendor,
  });

  const paymentMutation = useMutation({
    mutationFn: async (body: any) => {
      const res = await apiRequest("POST", "/api/admin/vendor-payments", body);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "입금 등록 완료" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/accounting/vendor-balances"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/accounting/vendor-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/accounting/vendors"] });
      setShowPaymentDialog(false);
      setPaymentDate(new Date().toISOString().slice(0, 10));
      setPaymentAmount("");
      setPaymentMemo("");
    },
    onError: (error: any) => {
      toast({ title: "등록 실패", description: error.message, variant: "destructive" });
    },
  });

  const handlePaymentSubmit = () => {
    if (!selectedVendor) return;
    const amount = parseInt(paymentAmount);
    if (!amount || amount <= 0) { toast({ title: "올바른 금액을 입력해주세요", variant: "destructive" }); return; }
    if (amount > (selectedVendor.outstandingBalance || 0)) {
      toast({ title: "경고", description: `외상 잔액(${selectedVendor.outstandingBalance.toLocaleString()}원)보다 큰 금액입니다. 선급금으로 처리됩니다.` });
    }
    paymentMutation.mutate({
      vendorId: selectedVendor.id,
      paymentDate,
      amount,
      memo: paymentMemo || null,
    });
  };

  const totalOutstanding = vendorBalances.reduce((s, v) => s + (v.outstandingBalance || 0), 0);
  const totalPurchases = vendorBalances.reduce((s, v) => s + (v.totalPurchases || 0), 0);
  const totalPayments = vendorBalances.reduce((s, v) => s + (v.totalPayments || 0), 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4">
          <h3 className="font-semibold mb-3">업체별 외상 현황</h3>
          {isLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <div className="border rounded-lg overflow-x-auto overflow-y-auto max-h-[400px]">
              <Table className="min-w-[700px]">
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow>
                    <TableHead>업체명</TableHead>
                    <TableHead className="text-right">총 매입액</TableHead>
                    <TableHead className="text-right">총 입금액</TableHead>
                    <TableHead className="text-right">외상 잔액</TableHead>
                    <TableHead className="text-center">상태</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendorBalances.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">데이터가 없습니다</TableCell>
                    </TableRow>
                  ) : (
                    <>
                      {vendorBalances.map((v) => (
                        <TableRow
                          key={v.id}
                          className={`cursor-pointer ${selectedVendor?.id === v.id ? "bg-muted/50" : ""}`}
                          onClick={() => setSelectedVendor(v)}
                          data-testid={`row-vendor-balance-${v.id}`}
                        >
                          <TableCell className="font-medium">{v.companyName}</TableCell>
                          <TableCell className="text-right">{(v.totalPurchases || 0).toLocaleString()}원</TableCell>
                          <TableCell className="text-right">{(v.totalPayments || 0).toLocaleString()}원</TableCell>
                          <TableCell className="text-right font-semibold">{(v.outstandingBalance || 0).toLocaleString()}원</TableCell>
                          <TableCell className="text-center">
                            {(v.outstandingBalance || 0) >= 1000000 && (
                              <AlertTriangle className="h-4 w-4 text-amber-500 inline" />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-semibold bg-muted/30">
                        <TableCell>합계</TableCell>
                        <TableCell className="text-right">{totalPurchases.toLocaleString()}원</TableCell>
                        <TableCell className="text-right">{totalPayments.toLocaleString()}원</TableCell>
                        <TableCell className="text-right">{totalOutstanding.toLocaleString()}원</TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    </>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-2">⚠️ = 외상 잔액 100만원 이상</p>
        </CardContent>
      </Card>

      {selectedVendor && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-semibold">{selectedVendor.companyName} 거래 내역</h3>
              <div className="flex items-center gap-2">
                <DateRangeFilter onChange={detailDateRange.setDateRange} defaultPreset="3months" />
                <Button size="sm" onClick={() => setShowPaymentDialog(true)} data-testid="button-add-payment">
                  <Plus className="h-4 w-4 mr-1" />입금 등록
                </Button>
              </div>
            </div>
            <div className="border rounded-lg overflow-x-auto overflow-y-auto max-h-[400px]">
              <Table className="min-w-[600px]">
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow>
                    <TableHead>날짜</TableHead>
                    <TableHead>구분</TableHead>
                    <TableHead>내용</TableHead>
                    <TableHead className="text-right">금액</TableHead>
                    <TableHead className="text-right">잔액</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">거래 내역이 없습니다</TableCell>
                    </TableRow>
                  ) : (
                    transactions.map((t, idx) => (
                      <TableRow key={`${t.type}-${t.id}-${idx}`} className={t.type === "payment" ? "bg-blue-50/50 dark:bg-blue-950/20" : ""}>
                        <TableCell className="whitespace-nowrap">{t.date}</TableCell>
                        <TableCell>
                          <Badge variant={t.type === "payment" ? "default" : "outline"} className="no-default-active-elevate text-xs">
                            {t.type === "purchase" ? "매입" : "입금"}
                          </Badge>
                        </TableCell>
                        <TableCell>{t.description}</TableCell>
                        <TableCell className={`text-right font-medium ${t.type === "payment" ? "text-blue-600" : ""}`}>
                          {t.type === "purchase" ? "+" : "-"}{Math.abs(t.amount).toLocaleString()}원
                        </TableCell>
                        <TableCell className="text-right">{t.runningBalance.toLocaleString()}원</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>입금 등록 — {selectedVendor?.companyName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              현재 외상 잔액: <span className="font-semibold text-foreground">{(selectedVendor?.outstandingBalance || 0).toLocaleString()}원</span>
            </div>
            <div className="space-y-2">
              <Label>입금일</Label>
              <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} data-testid="input-payment-date" />
            </div>
            <div className="space-y-2">
              <Label>입금액</Label>
              <Input type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder="금액" data-testid="input-payment-amount" />
            </div>
            <div className="space-y-2">
              <Label>메모 (선택)</Label>
              <Textarea value={paymentMemo} onChange={(e) => setPaymentMemo(e.target.value)} placeholder="계좌이체 등" data-testid="input-payment-memo" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>취소</Button>
              <Button onClick={handlePaymentSubmit} disabled={paymentMutation.isPending} data-testid="button-submit-payment">
                {paymentMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}등록
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
