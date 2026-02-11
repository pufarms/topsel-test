import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Wallet, CreditCard, Gift, Search, Plus, Minus, ArrowUpDown, FileText, BookOpen, Building2, ShoppingCart, Receipt, TrendingUp, DollarSign, Settings } from "lucide-react";
import { DateRangeFilter, useDateRange } from "@/components/common/DateRangeFilter";
import VendorManagementTab from "./accounting/vendor-management-tab";
import PurchaseManagementTab from "./accounting/purchase-management-tab";
import PurchaseSettlementTab from "./accounting/purchase-settlement-tab";
import SalesOverviewTab from "./accounting/sales-overview-tab";
import ProfitLossTab from "./accounting/profit-loss-tab";

interface MemberBalance {
  id: string;
  companyName: string;
  grade: string;
  deposit: number;
  point: number;
  username: string;
}

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
  memberCompanyName: string | null;
}

interface DepositRecord {
  id: number;
  memberId: string;
  type: string;
  amount: number;
  balanceAfter: number;
  description: string | null;
  relatedOrderId: number | null;
  adminId: string | null;
  createdAt: string;
  memberCompanyName: string | null;
}

interface PointerRecord {
  id: number;
  memberId: string;
  type: string;
  amount: number;
  balanceAfter: number;
  description: string | null;
  relatedOrderId: number | null;
  adminId: string | null;
  createdAt: string;
  memberCompanyName: string | null;
}

const gradeLabels: Record<string, string> = {
  START: "스타트",
  DRIVING: "드라이빙",
  TOP: "탑",
};

const typeLabels: Record<string, string> = {
  charge: "충전",
  refund: "환급",
  deduct: "차감",
  grant: "지급",
  auto: "자동정산",
  manual: "수동정산",
};

function MemberSettlementTab() {
  const { toast } = useToast();
  const [activeSubTab, setActiveSubTab] = useState("members");
  const [selectedMember, setSelectedMember] = useState<MemberBalance | null>(null);
  const [actionDialog, setActionDialog] = useState<"deposit-charge" | "deposit-refund" | "pointer-grant" | null>(null);
  const [actionAmount, setActionAmount] = useState("");
  const [actionDescription, setActionDescription] = useState("");
  const [memberFilter, setMemberFilter] = useState("");

  const settlementDateRange = useDateRange("month");
  const depositDateRange = useDateRange("month");
  const pointerDateRange = useDateRange("month");

  const { data: memberList = [], isLoading: membersLoading } = useQuery<MemberBalance[]>({
    queryKey: ["/api/admin/members-balance"],
  });

  const { data: settlements } = useQuery<{ records: SettlementRecord[]; total: number }>({
    queryKey: ["/api/admin/settlements", settlementDateRange.dateRange.startDate, settlementDateRange.dateRange.endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (settlementDateRange.dateRange.startDate) params.set("startDate", settlementDateRange.dateRange.startDate);
      if (settlementDateRange.dateRange.endDate) params.set("endDate", settlementDateRange.dateRange.endDate);
      params.set("limit", "100");
      const res = await fetch(`/api/admin/settlements?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("조회 실패");
      return res.json();
    },
  });

  const { data: depositRecords } = useQuery<{ records: DepositRecord[]; total: number }>({
    queryKey: ["/api/admin/deposit-history", depositDateRange.dateRange.startDate, depositDateRange.dateRange.endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (depositDateRange.dateRange.startDate) params.set("startDate", depositDateRange.dateRange.startDate);
      if (depositDateRange.dateRange.endDate) params.set("endDate", depositDateRange.dateRange.endDate);
      params.set("limit", "100");
      const res = await fetch(`/api/admin/deposit-history?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("조회 실패");
      return res.json();
    },
  });

  const { data: pointerRecords } = useQuery<{ records: PointerRecord[]; total: number }>({
    queryKey: ["/api/admin/pointer-history", pointerDateRange.dateRange.startDate, pointerDateRange.dateRange.endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (pointerDateRange.dateRange.startDate) params.set("startDate", pointerDateRange.dateRange.startDate);
      if (pointerDateRange.dateRange.endDate) params.set("endDate", pointerDateRange.dateRange.endDate);
      params.set("limit", "100");
      const res = await fetch(`/api/admin/pointer-history?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("조회 실패");
      return res.json();
    },
  });

  const depositChargeMutation = useMutation({
    mutationFn: async ({ memberId, amount, description }: { memberId: string; amount: number; description: string }) => {
      const res = await apiRequest("POST", `/api/admin/members/${memberId}/deposit/charge`, { amount, description });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "예치금 충전 완료", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/members-balance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/deposit-history"] });
      setActionDialog(null);
      setActionAmount("");
      setActionDescription("");
      setSelectedMember(null);
    },
    onError: (error: any) => {
      toast({ title: "충전 실패", description: error.message, variant: "destructive" });
    },
  });

  const depositRefundMutation = useMutation({
    mutationFn: async ({ memberId, amount, description }: { memberId: string; amount: number; description: string }) => {
      const res = await apiRequest("POST", `/api/admin/members/${memberId}/deposit/refund`, { amount, description });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "예치금 환급 완료", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/members-balance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/deposit-history"] });
      setActionDialog(null);
      setActionAmount("");
      setActionDescription("");
      setSelectedMember(null);
    },
    onError: (error: any) => {
      toast({ title: "환급 실패", description: error.message, variant: "destructive" });
    },
  });

  const pointerGrantMutation = useMutation({
    mutationFn: async ({ memberId, amount, description }: { memberId: string; amount: number; description: string }) => {
      const res = await apiRequest("POST", `/api/admin/members/${memberId}/pointer/grant`, { amount, description });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "포인터 지급 완료", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/members-balance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pointer-history"] });
      setActionDialog(null);
      setActionAmount("");
      setActionDescription("");
      setSelectedMember(null);
    },
    onError: (error: any) => {
      toast({ title: "지급 실패", description: error.message, variant: "destructive" });
    },
  });

  const handleAction = () => {
    if (!selectedMember || !actionDialog) return;
    const amount = parseInt(actionAmount);
    if (!amount || amount <= 0) {
      toast({ title: "금액 오류", description: "올바른 금액을 입력해주세요", variant: "destructive" });
      return;
    }
    const params = { memberId: selectedMember.id, amount, description: actionDescription };
    if (actionDialog === "deposit-charge") depositChargeMutation.mutate(params);
    else if (actionDialog === "deposit-refund") depositRefundMutation.mutate(params);
    else if (actionDialog === "pointer-grant") pointerGrantMutation.mutate(params);
  };

  const filteredMembers = memberList.filter(m => {
    if (!memberFilter) return true;
    const term = memberFilter.toLowerCase();
    return m.companyName.toLowerCase().includes(term) || m.username.toLowerCase().includes(term);
  });

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
    return `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, "0")}-${String(kst.getUTCDate()).padStart(2, "0")} ${String(kst.getUTCHours()).padStart(2, "0")}:${String(kst.getUTCMinutes()).padStart(2, "0")}:${String(kst.getUTCSeconds()).padStart(2, "0")}`;
  };

  return (
    <div className="space-y-4">
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="members" data-testid="tab-members">회원 잔액</TabsTrigger>
          <TabsTrigger value="settlements" data-testid="tab-settlements">정산 이력</TabsTrigger>
          <TabsTrigger value="deposits" data-testid="tab-deposits">예치금 이력</TabsTrigger>
          <TabsTrigger value="pointers" data-testid="tab-pointers">포인터 이력</TabsTrigger>
        </TabsList>

        <TabsContent value="members">
          <Card className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Wallet className="h-5 w-5" />
                  회원별 잔액 현황
                </CardTitle>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="상호명/아이디 검색"
                      value={memberFilter}
                      onChange={(e) => setMemberFilter(e.target.value)}
                      className="pl-9 w-48"
                      data-testid="input-member-filter"
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="overflow-hidden">
              {membersLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <div className="border rounded-lg overflow-x-auto overflow-y-auto max-h-[600px]">
                  <Table className="min-w-[800px]">
                    <TableHeader className="sticky top-0 z-10 bg-background">
                      <TableRow>
                        <TableHead>상호명</TableHead>
                        <TableHead>아이디</TableHead>
                        <TableHead>등급</TableHead>
                        <TableHead className="text-right">예치금</TableHead>
                        <TableHead className="text-right">포인터</TableHead>
                        <TableHead className="text-right">합계</TableHead>
                        <TableHead className="text-center">관리</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMembers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            회원 데이터가 없습니다
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredMembers.map((member) => (
                          <TableRow key={member.id} data-testid={`row-member-${member.id}`}>
                            <TableCell className="font-medium">{member.companyName}</TableCell>
                            <TableCell className="text-muted-foreground">{member.username}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="no-default-active-elevate">
                                {gradeLabels[member.grade] || member.grade}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">{member.deposit.toLocaleString()}원</TableCell>
                            <TableCell className="text-right">{member.point.toLocaleString()}P</TableCell>
                            <TableCell className="text-right font-medium">{(member.deposit + member.point).toLocaleString()}원</TableCell>
                            <TableCell>
                              <div className="flex items-center justify-center gap-1">
                                <Button size="sm" variant="outline" className="gap-1" onClick={() => { setSelectedMember(member); setActionDialog("deposit-charge"); }} data-testid={`button-deposit-charge-${member.id}`}>
                                  <Plus className="h-3 w-3" />충전
                                </Button>
                                <Button size="sm" variant="outline" className="gap-1" onClick={() => { setSelectedMember(member); setActionDialog("deposit-refund"); }} data-testid={`button-deposit-refund-${member.id}`}>
                                  <Minus className="h-3 w-3" />환급
                                </Button>
                                <Button size="sm" variant="outline" className="gap-1" onClick={() => { setSelectedMember(member); setActionDialog("pointer-grant"); }} data-testid={`button-pointer-grant-${member.id}`}>
                                  <Gift className="h-3 w-3" />포인터
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settlements">
          <Card className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ArrowUpDown className="h-5 w-5" />정산 이력
                </CardTitle>
                <DateRangeFilter onChange={settlementDateRange.setDateRange} defaultPreset="month" />
              </div>
            </CardHeader>
            <CardContent className="overflow-hidden">
              <div className="border rounded-lg overflow-x-auto overflow-y-auto max-h-[600px]">
                <Table className="min-w-[1000px]">
                  <TableHeader className="sticky top-0 z-10 bg-background">
                    <TableRow>
                      <TableHead>일시</TableHead>
                      <TableHead>상호명</TableHead>
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
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">선택한 기간에 정산 이력이 없습니다</TableCell>
                      </TableRow>
                    ) : (
                      settlements.records.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell className="whitespace-nowrap">{formatDate(record.createdAt)}</TableCell>
                          <TableCell>{record.memberCompanyName || "-"}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="no-default-active-elevate">{typeLabels[record.settlementType] || record.settlementType}</Badge>
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

        <TabsContent value="deposits">
          <Card className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />예치금 이력
                </CardTitle>
                <DateRangeFilter onChange={depositDateRange.setDateRange} defaultPreset="month" />
              </div>
            </CardHeader>
            <CardContent className="overflow-hidden space-y-3">
              {depositRecords?.records?.length ? (
                <div className="flex flex-wrap gap-4 items-center text-sm">
                  <span className="text-muted-foreground">총 {depositRecords.total}건</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    충전합계: {depositRecords.records.filter(r => r.type === "charge").reduce((s, r) => s + r.amount, 0).toLocaleString()}원
                  </span>
                  <span className="font-semibold text-red-600 dark:text-red-400">
                    차감/환급합계: {depositRecords.records.filter(r => r.type === "deduct" || r.type === "refund").reduce((s, r) => s + r.amount, 0).toLocaleString()}원
                  </span>
                </div>
              ) : null}
              <div className="border rounded-lg overflow-x-auto overflow-y-auto max-h-[600px]">
                <Table className="min-w-[900px]">
                  <TableHeader className="sticky top-0 z-10 bg-background">
                    <TableRow>
                      <TableHead>일시</TableHead>
                      <TableHead>상호명</TableHead>
                      <TableHead>유형</TableHead>
                      <TableHead className="text-right">금액</TableHead>
                      <TableHead className="text-right">잔액</TableHead>
                      <TableHead>설명</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!depositRecords?.records?.length ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">선택한 기간에 예치금 이력이 없습니다</TableCell>
                      </TableRow>
                    ) : (
                      depositRecords.records.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell className="whitespace-nowrap">{formatDate(record.createdAt)}</TableCell>
                          <TableCell>{record.memberCompanyName || "-"}</TableCell>
                          <TableCell>
                            <Badge variant={record.type === "charge" ? "default" : record.type === "deduct" ? "destructive" : "secondary"} className="no-default-active-elevate">
                              {typeLabels[record.type] || record.type}
                            </Badge>
                          </TableCell>
                          <TableCell className={`text-right font-medium ${record.type === "charge" ? "text-emerald-600" : record.type === "deduct" || record.type === "refund" ? "text-red-600" : ""}`}>
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pointers">
          <Card className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Gift className="h-5 w-5" />포인터 이력
                </CardTitle>
                <DateRangeFilter onChange={pointerDateRange.setDateRange} defaultPreset="month" />
              </div>
            </CardHeader>
            <CardContent className="overflow-hidden space-y-3">
              {pointerRecords?.records?.length ? (
                <div className="flex flex-wrap gap-4 items-center text-sm">
                  <span className="text-muted-foreground">총 {pointerRecords.total}건</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    지급합계: {pointerRecords.records.filter(r => r.type === "grant").reduce((s, r) => s + r.amount, 0).toLocaleString()}P
                  </span>
                  <span className="font-semibold text-red-600 dark:text-red-400">
                    차감합계: {pointerRecords.records.filter(r => r.type === "deduct").reduce((s, r) => s + r.amount, 0).toLocaleString()}P
                  </span>
                </div>
              ) : null}
              <div className="border rounded-lg overflow-x-auto overflow-y-auto max-h-[600px]">
                <Table className="min-w-[900px]">
                  <TableHeader className="sticky top-0 z-10 bg-background">
                    <TableRow>
                      <TableHead>일시</TableHead>
                      <TableHead>상호명</TableHead>
                      <TableHead>유형</TableHead>
                      <TableHead className="text-right">금액</TableHead>
                      <TableHead className="text-right">잔액</TableHead>
                      <TableHead>설명</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!pointerRecords?.records?.length ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">선택한 기간에 포인터 이력이 없습니다</TableCell>
                      </TableRow>
                    ) : (
                      pointerRecords.records.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell className="whitespace-nowrap">{formatDate(record.createdAt)}</TableCell>
                          <TableCell>{record.memberCompanyName || "-"}</TableCell>
                          <TableCell>
                            <Badge variant={record.type === "grant" ? "default" : "destructive"} className="no-default-active-elevate">
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
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!actionDialog} onOpenChange={() => { setActionDialog(null); setActionAmount(""); setActionDescription(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog === "deposit-charge" && "예치금 충전"}
              {actionDialog === "deposit-refund" && "예치금 환급"}
              {actionDialog === "pointer-grant" && "포인터 지급"}
            </DialogTitle>
          </DialogHeader>
          {selectedMember && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                대상: <span className="font-medium text-foreground">{selectedMember.companyName}</span> ({selectedMember.username})
              </div>
              <div className="text-sm flex gap-4">
                <span>예치금: {selectedMember.deposit.toLocaleString()}원</span>
                <span>포인터: {selectedMember.point.toLocaleString()}P</span>
              </div>
              <div className="space-y-2">
                <Label>금액</Label>
                <Input type="number" value={actionAmount} onChange={(e) => setActionAmount(e.target.value)} placeholder="금액을 입력하세요" data-testid="input-action-amount" />
              </div>
              <div className="space-y-2">
                <Label>설명 (선택)</Label>
                <Textarea value={actionDescription} onChange={(e) => setActionDescription(e.target.value)} placeholder="메모를 입력하세요" data-testid="input-action-description" />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setActionDialog(null); setActionAmount(""); setActionDescription(""); }} data-testid="button-action-cancel">취소</Button>
                <Button onClick={handleAction} disabled={depositChargeMutation.isPending || depositRefundMutation.isPending || pointerGrantMutation.isPending} data-testid="button-action-confirm">
                  {(depositChargeMutation.isPending || depositRefundMutation.isPending || pointerGrantMutation.isPending) && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                  확인
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function SettlementsPage() {
  const [activeMainTab, setActiveMainTab] = useState("member-settlement");

  return (
    <div data-testid="page-settlements">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-6">
        <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
          <BookOpen className="h-6 w-6" />
          회계장부
        </h1>
      </div>

      <Tabs value={activeMainTab} onValueChange={setActiveMainTab}>
        <TabsList className="flex-wrap mb-4">
          <TabsTrigger value="member-settlement" className="gap-1" data-testid="tab-member-settlement">
            <Wallet className="h-4 w-4" />회원 정산
          </TabsTrigger>
          <TabsTrigger value="vendor-management" className="gap-1" data-testid="tab-vendor-management">
            <Building2 className="h-4 w-4" />공급업체 관리
          </TabsTrigger>
          <TabsTrigger value="purchase-management" className="gap-1" data-testid="tab-purchase-management">
            <ShoppingCart className="h-4 w-4" />매입 관리
          </TabsTrigger>
          <TabsTrigger value="purchase-settlement" className="gap-1" data-testid="tab-purchase-settlement">
            <Receipt className="h-4 w-4" />매입 정산
          </TabsTrigger>
          <TabsTrigger value="sales-overview" className="gap-1" data-testid="tab-sales-overview">
            <DollarSign className="h-4 w-4" />매출 현황
          </TabsTrigger>
          <TabsTrigger value="profit-loss" className="gap-1" data-testid="tab-profit-loss">
            <TrendingUp className="h-4 w-4" />손익 현황
          </TabsTrigger>
        </TabsList>

        <TabsContent value="member-settlement">
          <MemberSettlementTab />
        </TabsContent>

        <TabsContent value="vendor-management">
          <VendorManagementTab />
        </TabsContent>

        <TabsContent value="purchase-management">
          <PurchaseManagementTab />
        </TabsContent>

        <TabsContent value="purchase-settlement">
          <PurchaseSettlementTab />
        </TabsContent>

        <TabsContent value="sales-overview">
          <SalesOverviewTab />
        </TabsContent>

        <TabsContent value="profit-loss">
          <ProfitLossTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
