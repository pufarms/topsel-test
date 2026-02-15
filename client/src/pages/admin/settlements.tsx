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
import { Loader2, Wallet, CreditCard, Gift, Search, Plus, Minus, ArrowUpDown, FileText, BookOpen, ShoppingCart, TrendingUp, DollarSign, Settings, ChevronLeft, ChevronRight, Download } from "lucide-react";
import * as XLSX from "xlsx";
import { DateRangeFilter, useDateRange } from "@/components/common/DateRangeFilter";
import PurchaseManagementTab from "./accounting/purchase-management-tab";
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

interface MemberSettlementViewItem {
  type: "order" | "deposit" | "pointer";
  date: string;
  companyName: string;
  productName: string;
  productCode: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  pointerChange: number;
  depositChange: number;
  description?: string;
  balance: number;
}

interface MemberSettlementViewResponse {
  items: MemberSettlementViewItem[];
  companyName: string;
  startingBalance: number;
  endingBalance: number;
  startingDepositBalance: number;
  startingPointerBalance: number;
  endingDepositBalance: number;
  endingPointerBalance: number;
  totalOrderAmount: number;
  totalDepositChange: number;
  totalPointerChange: number;
}

const gradeLabels: Record<string, string> = {
  START: "스타트",
  DRIVING: "드라이빙",
  TOP: "탑",
};

function formatCurrency(n: number): string {
  return n.toLocaleString("ko-KR") + "원";
}

const ITEMS_PER_PAGE = 30;

function MemberSettlementTab() {
  const { toast } = useToast();
  const [activeSubTab, setActiveSubTab] = useState("members");
  const [selectedMember, setSelectedMember] = useState<MemberBalance | null>(null);
  const [actionDialog, setActionDialog] = useState<"deposit-charge" | "deposit-refund" | "pointer-grant" | null>(null);
  const [actionAmount, setActionAmount] = useState("");
  const [actionDescription, setActionDescription] = useState("");
  const [memberFilter, setMemberFilter] = useState("");
  const [memberGradeFilter, setMemberGradeFilter] = useState("all");

  const detailDateRange = useDateRange("month");
  const [detailMemberFilter, setDetailMemberFilter] = useState("");
  const [detailPage, setDetailPage] = useState(1);

  const { data: memberList = [], isLoading: membersLoading } = useQuery<MemberBalance[]>({
    queryKey: ["/api/admin/members-balance"],
  });

  const { data: settlementView, isLoading: settlementViewLoading } = useQuery<MemberSettlementViewResponse>({
    queryKey: ["/api/admin/member-settlement-view", detailMemberFilter, detailDateRange.dateRange.startDate, detailDateRange.dateRange.endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("memberId", detailMemberFilter);
      if (detailDateRange.dateRange.startDate) params.set("startDate", detailDateRange.dateRange.startDate);
      if (detailDateRange.dateRange.endDate) params.set("endDate", detailDateRange.dateRange.endDate);
      const res = await fetch(`/api/admin/member-settlement-view?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("조회 실패");
      return res.json();
    },
    enabled: !!detailMemberFilter,
  });

  const depositChargeMutation = useMutation({
    mutationFn: async ({ memberId, amount, description }: { memberId: string; amount: number; description: string }) => {
      const res = await apiRequest("POST", `/api/admin/members/${memberId}/deposit/charge`, { amount, description });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "예치금 충전 완료", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/members-balance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/member-settlement-view"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/admin/member-settlement-view"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/admin/member-settlement-view"] });
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
    if (memberGradeFilter !== "all" && m.grade !== memberGradeFilter) return false;
    if (!memberFilter) return true;
    const term = memberFilter.toLowerCase();
    return m.companyName.toLowerCase().includes(term) || m.username.toLowerCase().includes(term);
  });

  const memberOptions = memberList.map(m => ({ id: m.id, label: `${m.companyName} (${m.username})` }));

  const allItems = settlementView?.items || [];
  const detailTotalPages = Math.max(1, Math.ceil(allItems.length / ITEMS_PER_PAGE));
  const pagedItems = allItems.slice((detailPage - 1) * ITEMS_PER_PAGE, detailPage * ITEMS_PER_PAGE);
  const isFirstPage = detailPage === 1;
  const isLastPage = detailPage >= detailTotalPages || detailTotalPages <= 1;

  const handleExcelDownload = () => {
    if (!settlementView || !allItems.length) return;
    const cn = settlementView.companyName || "전체";
    const sd = detailDateRange.dateRange.startDate || "";
    const ed = detailDateRange.dateRange.endDate || "";

    const excelData: any[] = [];
    excelData.push({
      "적용날짜": "-",
      "상호명": cn,
      "내역(상품명)": "기간 시작 잔액",
      "수량": "",
      "단가": "",
      "합계": "",
      "포인터": settlementView.startingPointerBalance.toLocaleString() + "P",
      "예치금": formatCurrency(settlementView.startingDepositBalance),
      "예치금+포인터 잔액": formatCurrency(settlementView.startingBalance),
    });

    for (const item of allItems) {
      excelData.push({
        "적용날짜": item.date,
        "상호명": item.companyName,
        "내역(상품명)": item.productName,
        "수량": item.quantity || "",
        "단가": item.type === "order" ? item.unitPrice : "",
        "합계": item.type === "order" ? item.subtotal : "",
        "포인터": item.pointerChange !== 0 ? (item.pointerChange > 0 ? `+${item.pointerChange.toLocaleString()}P` : `${item.pointerChange.toLocaleString()}P`) : "",
        "예치금": item.depositChange !== 0 ? (item.depositChange > 0 ? `+${formatCurrency(item.depositChange)}` : `-${formatCurrency(Math.abs(item.depositChange))}`) : "",
        "예치금+포인터 잔액": formatCurrency(item.balance),
      });
    }

    excelData.push({
      "적용날짜": "-",
      "상호명": cn,
      "내역(상품명)": "기간 종료 잔액",
      "수량": "",
      "단가": "",
      "합계": "",
      "포인터": settlementView.endingPointerBalance.toLocaleString() + "P",
      "예치금": formatCurrency(settlementView.endingDepositBalance),
      "예치금+포인터 잔액": formatCurrency(settlementView.endingBalance),
    });

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "업체별정산내역");
    XLSX.writeFile(wb, `업체별정산내역_${cn}_${sd}~${ed}.xlsx`);
    toast({ title: "다운로드 완료", description: "엑셀 파일이 다운로드되었습니다." });
  };

  return (
    <div className="space-y-4">
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="members" data-testid="tab-members">회원 잔액</TabsTrigger>
          <TabsTrigger value="member-detail" data-testid="tab-member-detail">업체별 정산 내역</TabsTrigger>
        </TabsList>

        <TabsContent value="members">
          <Card className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Wallet className="h-5 w-5" />
                  회원별 잔액 현황
                </CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={memberGradeFilter} onValueChange={setMemberGradeFilter}>
                    <SelectTrigger className="w-[120px]" data-testid="select-member-grade">
                      <SelectValue placeholder="등급" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">전체 등급</SelectItem>
                      <SelectItem value="START">스타트</SelectItem>
                      <SelectItem value="DRIVING">드라이빙</SelectItem>
                      <SelectItem value="TOP">탑</SelectItem>
                    </SelectContent>
                  </Select>
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
                  <span className="text-sm text-muted-foreground">{filteredMembers.length}명</span>
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

        <TabsContent value="member-detail">
          <Card className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-5 w-5" />업체별 정산 내역
                  </CardTitle>
                  <DateRangeFilter onChange={(range) => { detailDateRange.setDateRange(range); setDetailPage(1); }} defaultPreset="month" />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={detailMemberFilter || "none"} onValueChange={(v) => { setDetailMemberFilter(v === "none" ? "" : v); setDetailPage(1); }}>
                    <SelectTrigger className="w-[240px]" data-testid="select-detail-member">
                      <SelectValue placeholder="상호명 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">상호명 선택</SelectItem>
                      {memberOptions.map(m => (
                        <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {detailMemberFilter && allItems.length > 0 && (
                    <Button size="sm" variant="outline" className="gap-1" onClick={handleExcelDownload} data-testid="button-excel-download">
                      <Download className="h-4 w-4" />엑셀 다운로드
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="overflow-hidden space-y-3">
              {!detailMemberFilter ? (
                <div className="py-12 text-center text-muted-foreground">
                  <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p className="text-base font-medium">상호명을 선택해주세요</p>
                  <p className="text-sm mt-1">업체를 선택하면 해당 업체의 정산 내역을 확인할 수 있습니다.</p>
                </div>
              ) : settlementViewLoading ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : (
                <>
                  {settlementView && (
                    <div className="flex flex-wrap gap-4 items-center text-sm border rounded-md p-2 bg-muted/20">
                      <span className="text-muted-foreground">총 {allItems.length}건</span>
                      <span className="font-semibold">주문합계: {formatCurrency(settlementView.totalOrderAmount)}</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">예치금 변동: {settlementView.totalDepositChange >= 0 ? "+" : ""}{formatCurrency(settlementView.totalDepositChange)}</span>
                      <span className="font-semibold text-amber-600 dark:text-amber-400">포인터 변동: {settlementView.totalPointerChange >= 0 ? "+" : ""}{settlementView.totalPointerChange.toLocaleString()}P</span>
                    </div>
                  )}

                  <div className="border rounded-lg overflow-x-auto overflow-y-auto max-h-[600px]">
                    <table className="w-full text-sm min-w-[1000px]">
                      <thead className="sticky top-0 z-10">
                        <tr className="border-b bg-muted/30">
                          <th className="text-center py-2 px-3 whitespace-nowrap">적용날짜</th>
                          <th className="text-left py-2 px-3 whitespace-nowrap">상호명</th>
                          <th className="text-left py-2 px-3 whitespace-nowrap">내역(상품명)</th>
                          <th className="text-right py-2 px-3 whitespace-nowrap">수량</th>
                          <th className="text-right py-2 px-3 whitespace-nowrap">단가</th>
                          <th className="text-right py-2 px-3 whitespace-nowrap">합계</th>
                          <th className="text-right py-2 px-3 whitespace-nowrap">포인터</th>
                          <th className="text-right py-2 px-3 whitespace-nowrap">예치금</th>
                          <th className="text-right py-2 px-3 whitespace-nowrap">예치금+포인터 잔액</th>
                        </tr>
                      </thead>
                      <tbody>
                        {isFirstPage && settlementView && (
                          <tr className="border-b bg-blue-50 dark:bg-blue-950/30" data-testid="row-starting-balance">
                            <td className="py-2 px-3 text-center whitespace-nowrap text-muted-foreground">-</td>
                            <td className="py-2 px-3 whitespace-nowrap">{settlementView.companyName}</td>
                            <td className="py-2 px-3 whitespace-nowrap font-semibold text-blue-600 dark:text-blue-400" colSpan={4}>기간 시작 잔액</td>
                            <td className="py-2 px-3 text-right whitespace-nowrap text-blue-600 dark:text-blue-400">{settlementView.startingPointerBalance.toLocaleString()}P</td>
                            <td className="py-2 px-3 text-right whitespace-nowrap text-blue-600 dark:text-blue-400">{formatCurrency(settlementView.startingDepositBalance)}</td>
                            <td className="py-2 px-3 text-right whitespace-nowrap font-semibold text-blue-600 dark:text-blue-400">{formatCurrency(settlementView.startingBalance)}</td>
                          </tr>
                        )}
                        {allItems.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="text-center py-8 text-muted-foreground">선택한 기간에 정산 내역이 없습니다</td>
                          </tr>
                        ) : (
                          pagedItems.map((item, idx) => (
                            <tr
                              key={`${item.type}-${item.date}-${item.productCode}-${idx}`}
                              className={`border-b ${item.type !== "order" ? "bg-emerald-50/50 dark:bg-emerald-950/20" : ""}`}
                              data-testid={`row-detail-${idx}`}
                            >
                              <td className="py-2 px-3 text-center whitespace-nowrap">{item.date}</td>
                              <td className="py-2 px-3 whitespace-nowrap">{item.companyName}</td>
                              <td className="py-2 px-3 whitespace-nowrap">
                                {item.type === "order" ? (
                                  item.productName
                                ) : (
                                  <span className={item.type === "deposit" ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-amber-600 dark:text-amber-400 font-medium"}>
                                    {item.productName}
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-right whitespace-nowrap">
                                {item.quantity || ""}
                              </td>
                              <td className="py-2 px-3 text-right whitespace-nowrap">
                                {item.type === "order" ? formatCurrency(item.unitPrice) : ""}
                              </td>
                              <td className="py-2 px-3 text-right whitespace-nowrap font-medium">
                                {item.type === "order" ? formatCurrency(item.subtotal) : ""}
                              </td>
                              <td className={`py-2 px-3 text-right whitespace-nowrap font-medium ${item.pointerChange > 0 ? "text-amber-600 dark:text-amber-400" : item.pointerChange < 0 ? "text-red-600 dark:text-red-400" : ""}`}>
                                {item.pointerChange !== 0 ? (item.pointerChange > 0 ? `+${item.pointerChange.toLocaleString()}P` : `${item.pointerChange.toLocaleString()}P`) : ""}
                              </td>
                              <td className={`py-2 px-3 text-right whitespace-nowrap font-medium ${item.depositChange > 0 ? "text-emerald-600 dark:text-emerald-400" : item.depositChange < 0 ? "text-red-600 dark:text-red-400" : ""}`}>
                                {item.depositChange !== 0 ? (item.depositChange > 0 ? `+${formatCurrency(item.depositChange)}` : `-${formatCurrency(Math.abs(item.depositChange))}`) : ""}
                              </td>
                              <td className="py-2 px-3 text-right whitespace-nowrap font-medium">{formatCurrency(item.balance)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      <tfoot>
                        {isLastPage && settlementView && (
                          <tr className="bg-blue-50 dark:bg-blue-950/30 font-semibold" data-testid="row-ending-balance">
                            <td className="py-2 px-3 text-center text-muted-foreground">-</td>
                            <td className="py-2 px-3">{settlementView.companyName}</td>
                            <td className="py-2 px-3 text-blue-600 dark:text-blue-400" colSpan={4}>기간 종료 잔액</td>
                            <td className="py-2 px-3 text-right text-blue-600 dark:text-blue-400">{settlementView.endingPointerBalance.toLocaleString()}P</td>
                            <td className="py-2 px-3 text-right text-blue-600 dark:text-blue-400">{formatCurrency(settlementView.endingDepositBalance)}</td>
                            <td className="py-2 px-3 text-right text-blue-600 dark:text-blue-400">{formatCurrency(settlementView.endingBalance)}</td>
                          </tr>
                        )}
                      </tfoot>
                    </table>
                  </div>

                  {detailTotalPages > 1 && (
                    <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
                      <p className="text-sm text-muted-foreground">총 {allItems.length}건</p>
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="outline" disabled={detailPage <= 1} onClick={() => setDetailPage(p => p - 1)} data-testid="button-detail-prev">
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm px-2">{detailPage} / {detailTotalPages}</span>
                        <Button size="sm" variant="outline" disabled={detailPage >= detailTotalPages} onClick={() => setDetailPage(p => p + 1)} data-testid="button-detail-next">
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
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
            <Wallet className="h-4 w-4" />회원정산 관리
          </TabsTrigger>
          <TabsTrigger value="purchase-management" className="gap-1" data-testid="tab-purchase-management">
            <ShoppingCart className="h-4 w-4" />매입관리
          </TabsTrigger>
          <TabsTrigger value="sales-overview" className="gap-1" data-testid="tab-sales-overview">
            <DollarSign className="h-4 w-4" />매출 관리
          </TabsTrigger>
          <TabsTrigger value="profit-loss" className="gap-1" data-testid="tab-profit-loss">
            <TrendingUp className="h-4 w-4" />손익 현황
          </TabsTrigger>
        </TabsList>

        <TabsContent value="member-settlement">
          <MemberSettlementTab />
        </TabsContent>

        <TabsContent value="purchase-management">
          <PurchaseManagementTab />
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
