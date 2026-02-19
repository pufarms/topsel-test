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
import { Loader2, Wallet, CreditCard, Gift, Search, Plus, Minus, ArrowUpDown, FileText, BookOpen, ShoppingCart, TrendingUp, DollarSign, Settings, ChevronLeft, ChevronRight, Download, X } from "lucide-react";
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
  type: "order" | "deposit" | "pointer" | "direct_sale";
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

interface VendorSettlementViewItem {
  type: "direct_sale" | "payment";
  date: string;
  companyName: string;
  productName: string;
  productCode: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  paymentAmount: number;
  description?: string;
  balance: number;
}

interface VendorSettlementViewResponse {
  items: VendorSettlementViewItem[];
  companyName: string;
  totalDirectSaleAmount: number;
  totalPaymentAmount: number;
  balance: number;
}

interface VendorOption {
  id: number;
  companyName: string;
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
  const [detailClientType, setDetailClientType] = useState<"member" | "vendor">("member");
  const [detailPage, setDetailPage] = useState(1);
  const [detailTypeFilter, setDetailTypeFilter] = useState("all");
  const [detailSearchText, setDetailSearchText] = useState("");
  const [detailSearchOpen, setDetailSearchOpen] = useState(false);
  const [detailSelectedLabel, setDetailSelectedLabel] = useState("");
  const [vendorPaymentDialog, setVendorPaymentDialog] = useState(false);
  const [vendorPaymentAmount, setVendorPaymentAmount] = useState("");
  const [vendorPaymentDate, setVendorPaymentDate] = useState(() => {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    return kst.toISOString().split("T")[0];
  });
  const [vendorPaymentMethod, setVendorPaymentMethod] = useState("transfer");
  const [vendorPaymentMemo, setVendorPaymentMemo] = useState("");

  const { data: memberList = [], isLoading: membersLoading } = useQuery<MemberBalance[]>({
    queryKey: ["/api/admin/members-balance"],
  });

  const { data: vendorList = [] } = useQuery<VendorOption[]>({
    queryKey: ["/api/admin/vendors"],
    select: (data: any[]) => data.map((v: any) => ({ id: v.id, companyName: v.companyName })),
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
    enabled: !!detailMemberFilter && detailClientType === "member",
  });

  const { data: vendorSettlementView, isLoading: vendorSettlementViewLoading } = useQuery<VendorSettlementViewResponse>({
    queryKey: ["/api/admin/vendor-settlement-view", detailMemberFilter, detailDateRange.dateRange.startDate, detailDateRange.dateRange.endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("vendorId", detailMemberFilter);
      if (detailDateRange.dateRange.startDate) params.set("startDate", detailDateRange.dateRange.startDate);
      if (detailDateRange.dateRange.endDate) params.set("endDate", detailDateRange.dateRange.endDate);
      const res = await fetch(`/api/admin/vendor-settlement-view?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("조회 실패");
      return res.json();
    },
    enabled: !!detailMemberFilter && detailClientType === "vendor",
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

  const vendorPaymentMutation = useMutation({
    mutationFn: async ({ vendorId, amount, paymentDate, paymentMethod, memo }: { vendorId: number; amount: number; paymentDate: string; paymentMethod: string; memo: string }) => {
      const res = await apiRequest("POST", "/api/admin/vendor-payments", { vendorId, amount, paymentDate, paymentMethod, memo });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "입금 등록 완료", description: "매입업체 입금이 등록되었습니다." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/vendor-settlement-view"] });
      setVendorPaymentDialog(false);
      setVendorPaymentAmount("");
      setVendorPaymentMemo("");
      setVendorPaymentMethod("transfer");
    },
    onError: (error: any) => {
      toast({ title: "입금 등록 실패", description: error.message, variant: "destructive" });
    },
  });

  const handleVendorPayment = () => {
    const amount = parseInt(vendorPaymentAmount);
    if (!amount || amount <= 0) {
      toast({ title: "금액 오류", description: "올바른 금액을 입력해주세요", variant: "destructive" });
      return;
    }
    if (!vendorPaymentDate) {
      toast({ title: "날짜 오류", description: "입금일을 입력해주세요", variant: "destructive" });
      return;
    }
    vendorPaymentMutation.mutate({
      vendorId: parseInt(detailMemberFilter),
      amount,
      paymentDate: vendorPaymentDate,
      paymentMethod: vendorPaymentMethod,
      memo: vendorPaymentMemo,
    });
  };

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


  const isVendorMode = detailClientType === "vendor";
  const currentView = isVendorMode ? vendorSettlementView : settlementView;
  const currentLoading = isVendorMode ? vendorSettlementViewLoading : settlementViewLoading;

  const allItems: any[] = currentView?.items || [];
  const filteredItems = detailTypeFilter === "all" ? allItems : allItems.filter((i: any) => {
    if (detailTypeFilter === "order") return i.type === "order";
    if (detailTypeFilter === "direct_sale") return i.type === "direct_sale";
    if (detailTypeFilter === "deposit") return i.type === "deposit";
    if (detailTypeFilter === "pointer") return i.type === "pointer";
    if (detailTypeFilter === "payment") return i.type === "payment";
    return true;
  });
  const detailTotalPages = Math.max(1, Math.ceil(filteredItems.length / ITEMS_PER_PAGE));
  const pagedItems = filteredItems.slice((detailPage - 1) * ITEMS_PER_PAGE, detailPage * ITEMS_PER_PAGE);
  const isFirstPage = detailPage === 1;
  const isLastPage = detailPage >= detailTotalPages || detailTotalPages <= 1;

  const handleExcelDownload = () => {
    if (!allItems.length) return;
    const sd = detailDateRange.dateRange.startDate || "";
    const ed = detailDateRange.dateRange.endDate || "";

    if (isVendorMode && vendorSettlementView) {
      const cn = vendorSettlementView.companyName;
      const excelData: any[] = [];
      for (const item of allItems) {
        excelData.push({
          "적용날짜": item.date,
          "상호명": item.companyName,
          "내역(상품명)": item.productName,
          "수량": item.quantity || "",
          "단가": item.type === "direct_sale" ? item.unitPrice : "",
          "합계": item.type === "direct_sale" ? item.subtotal : "",
          "입금액": item.paymentAmount > 0 ? formatCurrency(item.paymentAmount) : "",
          "미수금 잔액": formatCurrency(item.balance),
        });
      }
      excelData.push({
        "적용날짜": "-",
        "상호명": cn,
        "내역(상품명)": "합계",
        "수량": "",
        "단가": "",
        "합계": formatCurrency(vendorSettlementView.totalDirectSaleAmount),
        "입금액": formatCurrency(vendorSettlementView.totalPaymentAmount),
        "미수금 잔액": formatCurrency(vendorSettlementView.balance),
      });
      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "업체별정산내역");
      XLSX.writeFile(wb, `업체별정산내역_${cn}_${sd}~${ed}.xlsx`);
      toast({ title: "다운로드 완료", description: "엑셀 파일이 다운로드되었습니다." });
      return;
    }

    if (!settlementView) return;
    const cn = settlementView.companyName || "전체";

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
        "단가": (item.type === "order" || item.type === "direct_sale") ? item.unitPrice : "",
        "합계": (item.type === "order" || item.type === "direct_sale") ? item.subtotal : "",
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
                    {filteredMembers.length > 0 && (
                      <tfoot className="sticky bottom-0 z-10 bg-muted/80 border-t-2 border-border">
                        <tr>
                          <td colSpan={3} className="py-2.5 px-3 font-semibold text-sm">합계</td>
                          <td className="py-2.5 px-3 text-right font-semibold text-sm">{filteredMembers.reduce((s, m) => s + m.deposit, 0).toLocaleString()}원</td>
                          <td className="py-2.5 px-3 text-right font-semibold text-sm">{filteredMembers.reduce((s, m) => s + m.point, 0).toLocaleString()}P</td>
                          <td className="py-2.5 px-3 text-right font-semibold text-sm">{filteredMembers.reduce((s, m) => s + m.deposit + m.point, 0).toLocaleString()}원</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    )}
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
                  <DateRangeFilter onChange={(range) => { detailDateRange.setDateRange(range); setDetailPage(1); }} defaultPreset="month" controlledPreset={detailDateRange.activePreset} onPresetChange={detailDateRange.setActivePreset} />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    value={detailClientType}
                    onValueChange={(v) => {
                      setDetailClientType(v as "member" | "vendor");
                      setDetailMemberFilter("");
                      setDetailSearchText("");
                      setDetailSelectedLabel("");
                      setDetailPage(1);
                      setDetailTypeFilter("all");
                    }}
                  >
                    <SelectTrigger className="w-[120px]" data-testid="select-detail-client-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">회원</SelectItem>
                      <SelectItem value="vendor">매입업체</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                    <Input
                      placeholder={detailClientType === "member" ? "회원 검색 (상호명/아이디)" : "매입업체 검색"}
                      value={detailSelectedLabel || detailSearchText}
                      onChange={(e) => {
                        setDetailSearchText(e.target.value);
                        setDetailSelectedLabel("");
                        setDetailMemberFilter("");
                        setDetailSearchOpen(true);
                      }}
                      onFocus={() => {
                        if (!detailSelectedLabel && detailSearchText.trim()) setDetailSearchOpen(true);
                      }}
                      onBlur={() => setTimeout(() => setDetailSearchOpen(false), 200)}
                      className="pl-8 pr-8 w-[240px]"
                      data-testid="input-detail-search"
                    />
                    {(detailSelectedLabel || detailSearchText) && (
                      <button
                        onClick={() => {
                          setDetailSearchText("");
                          setDetailSelectedLabel("");
                          setDetailMemberFilter("");
                          setDetailSearchOpen(false);
                          setDetailPage(1);
                          setDetailTypeFilter("all");
                        }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground z-10"
                        data-testid="button-clear-detail-search"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                    {detailSearchOpen && detailSearchText.trim() && !detailSelectedLabel && (() => {
                      const q = detailSearchText.trim().toLowerCase();
                      if (detailClientType === "member") {
                        const suggestions = memberList.filter((m) =>
                          m.companyName?.toLowerCase().includes(q) ||
                          m.username?.toLowerCase().includes(q)
                        ).slice(0, 20);
                        if (suggestions.length === 0) return (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg z-50 p-3 text-sm text-muted-foreground text-center">
                            검색 결과가 없습니다
                          </div>
                        );
                        return (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg z-50 max-h-[200px] overflow-y-auto">
                            {suggestions.map((m) => (
                              <button
                                key={m.id}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center justify-between gap-2"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  setDetailMemberFilter(m.id);
                                  setDetailSelectedLabel(m.companyName);
                                  setDetailSearchText("");
                                  setDetailSearchOpen(false);
                                  setDetailPage(1);
                                  setDetailTypeFilter("all");
                                }}
                                data-testid={`suggestion-member-${m.id}`}
                              >
                                <span className="font-medium truncate">{m.companyName}</span>
                                <span className="text-xs text-muted-foreground shrink-0">{m.username}</span>
                              </button>
                            ))}
                          </div>
                        );
                      } else {
                        const suggestions = vendorList.filter((v) =>
                          v.companyName?.toLowerCase().includes(q)
                        ).slice(0, 20);
                        if (suggestions.length === 0) return (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg z-50 p-3 text-sm text-muted-foreground text-center">
                            검색 결과가 없습니다
                          </div>
                        );
                        return (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg z-50 max-h-[200px] overflow-y-auto">
                            {suggestions.map((v) => (
                              <button
                                key={v.id}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  setDetailMemberFilter(String(v.id));
                                  setDetailSelectedLabel(v.companyName);
                                  setDetailSearchText("");
                                  setDetailSearchOpen(false);
                                  setDetailPage(1);
                                  setDetailTypeFilter("all");
                                }}
                                data-testid={`suggestion-vendor-${v.id}`}
                              >
                                <span className="font-medium">{v.companyName}</span>
                              </button>
                            ))}
                          </div>
                        );
                      }
                    })()}
                  </div>
                  {detailMemberFilter && (
                    <Select value={detailTypeFilter} onValueChange={(v) => { setDetailTypeFilter(v); setDetailPage(1); }}>
                      <SelectTrigger className="w-[140px]" data-testid="select-detail-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">전체</SelectItem>
                        {isVendorMode ? (
                          <>
                            <SelectItem value="direct_sale">직접매출</SelectItem>
                            <SelectItem value="payment">입금</SelectItem>
                          </>
                        ) : (
                          <>
                            <SelectItem value="order">주문정산</SelectItem>
                            <SelectItem value="direct_sale">직접매출</SelectItem>
                            <SelectItem value="deposit">입금/환급</SelectItem>
                            <SelectItem value="pointer">포인터</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  )}
                  {detailMemberFilter && isVendorMode && (
                    <Button size="sm" variant="default" className="gap-1" onClick={() => setVendorPaymentDialog(true)} data-testid="button-vendor-payment">
                      <Plus className="h-4 w-4" />입금 등록
                    </Button>
                  )}
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
              ) : currentLoading ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : (
                <>
                  {isVendorMode && vendorSettlementView && (
                    <div className="flex flex-wrap gap-4 items-center text-sm border rounded-md p-2 bg-muted/20">
                      <span className="text-muted-foreground">총 {filteredItems.length}건{detailTypeFilter !== "all" ? ` (전체 ${allItems.length}건)` : ""}</span>
                      <span className="font-semibold text-amber-700 dark:text-amber-400">직접매출 합계: {formatCurrency(vendorSettlementView.totalDirectSaleAmount)}</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">입금 합계: {formatCurrency(vendorSettlementView.totalPaymentAmount)}</span>
                      <span className="font-semibold">미수금: {formatCurrency(vendorSettlementView.balance)}</span>
                    </div>
                  )}
                  {!isVendorMode && settlementView && (
                    <div className="flex flex-wrap gap-4 items-center text-sm border rounded-md p-2 bg-muted/20">
                      <span className="text-muted-foreground">총 {filteredItems.length}건{detailTypeFilter !== "all" ? ` (전체 ${allItems.length}건)` : ""}</span>
                      <span className="font-semibold">주문합계: {formatCurrency(settlementView.totalOrderAmount)}</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">예치금 변동: {settlementView.totalDepositChange >= 0 ? "+" : ""}{formatCurrency(settlementView.totalDepositChange)}</span>
                      <span className="font-semibold text-amber-600 dark:text-amber-400">포인터 변동: {settlementView.totalPointerChange >= 0 ? "+" : ""}{settlementView.totalPointerChange.toLocaleString()}P</span>
                    </div>
                  )}

                  <div className="border rounded-lg overflow-x-auto overflow-y-auto max-h-[600px]">
                    <table className="w-full text-sm min-w-[800px]">
                      <thead className="sticky top-0 z-10">
                        <tr className="border-b bg-muted/30">
                          <th className="text-center py-2 px-3 whitespace-nowrap">적용날짜</th>
                          <th className="text-left py-2 px-3 whitespace-nowrap">상호명</th>
                          <th className="text-left py-2 px-3 whitespace-nowrap">내역(상품명)</th>
                          <th className="text-right py-2 px-3 whitespace-nowrap">수량</th>
                          <th className="text-right py-2 px-3 whitespace-nowrap">단가</th>
                          <th className="text-right py-2 px-3 whitespace-nowrap">합계</th>
                          {isVendorMode ? (
                            <>
                              <th className="text-right py-2 px-3 whitespace-nowrap">입금액</th>
                              <th className="text-right py-2 px-3 whitespace-nowrap">미수금 잔액</th>
                            </>
                          ) : (
                            <>
                              <th className="text-right py-2 px-3 whitespace-nowrap">포인터</th>
                              <th className="text-right py-2 px-3 whitespace-nowrap">예치금</th>
                              <th className="text-right py-2 px-3 whitespace-nowrap">예치금+포인터 잔액</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {!isVendorMode && isFirstPage && settlementView && (
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
                            <td colSpan={isVendorMode ? 8 : 9} className="text-center py-8 text-muted-foreground">선택한 기간에 정산 내역이 없습니다</td>
                          </tr>
                        ) : (
                          pagedItems.map((item: any, idx: number) => (
                            <tr
                              key={`${item.type}-${item.date}-${item.productCode || ''}-${idx}`}
                              className={`border-b ${item.type === "direct_sale" ? "bg-amber-50/50 dark:bg-amber-950/20" : item.type === "payment" ? "bg-emerald-50/50 dark:bg-emerald-950/20" : item.type !== "order" ? "bg-emerald-50/50 dark:bg-emerald-950/20" : ""}`}
                              data-testid={`row-detail-${idx}`}
                            >
                              <td className="py-2 px-3 text-center whitespace-nowrap">{item.date}</td>
                              <td className="py-2 px-3 whitespace-nowrap">{item.companyName}</td>
                              <td className="py-2 px-3 whitespace-nowrap">
                                {item.type === "order" ? (
                                  item.productName
                                ) : item.type === "direct_sale" ? (
                                  <span className="text-amber-700 dark:text-amber-400 font-medium">{item.productName}</span>
                                ) : item.type === "payment" ? (
                                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">{item.productName}</span>
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
                                {(item.type === "order" || item.type === "direct_sale") ? formatCurrency(item.unitPrice) : ""}
                              </td>
                              <td className="py-2 px-3 text-right whitespace-nowrap font-medium">
                                {(item.type === "order" || item.type === "direct_sale") ? formatCurrency(item.subtotal) : ""}
                              </td>
                              {isVendorMode ? (
                                <>
                                  <td className={`py-2 px-3 text-right whitespace-nowrap font-medium ${item.paymentAmount > 0 ? "text-emerald-600 dark:text-emerald-400" : ""}`}>
                                    {item.paymentAmount > 0 ? formatCurrency(item.paymentAmount) : ""}
                                  </td>
                                  <td className="py-2 px-3 text-right whitespace-nowrap font-medium">{formatCurrency(item.balance)}</td>
                                </>
                              ) : (
                                <>
                                  <td className={`py-2 px-3 text-right whitespace-nowrap font-medium ${item.pointerChange > 0 ? "text-amber-600 dark:text-amber-400" : item.pointerChange < 0 ? "text-red-600 dark:text-red-400" : ""}`}>
                                    {item.pointerChange !== 0 ? (item.pointerChange > 0 ? `+${item.pointerChange.toLocaleString()}P` : `${item.pointerChange.toLocaleString()}P`) : ""}
                                  </td>
                                  <td className={`py-2 px-3 text-right whitespace-nowrap font-medium ${item.depositChange > 0 ? "text-emerald-600 dark:text-emerald-400" : item.depositChange < 0 ? "text-red-600 dark:text-red-400" : ""}`}>
                                    {item.depositChange !== 0 ? (item.depositChange > 0 ? `+${formatCurrency(item.depositChange)}` : `-${formatCurrency(Math.abs(item.depositChange))}`) : ""}
                                  </td>
                                  <td className="py-2 px-3 text-right whitespace-nowrap font-medium">{formatCurrency(item.balance)}</td>
                                </>
                              )}
                            </tr>
                          ))
                        )}
                      </tbody>
                      <tfoot>
                        {!isVendorMode && isLastPage && settlementView && (
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
                      <p className="text-sm text-muted-foreground">총 {filteredItems.length}건</p>
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

      <Dialog open={vendorPaymentDialog} onOpenChange={(open) => { if (!open) { setVendorPaymentDialog(false); setVendorPaymentAmount(""); setVendorPaymentMemo(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              매입업체 입금 등록
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              대상: <span className="font-medium text-foreground">{detailSelectedLabel}</span>
            </div>
            {vendorSettlementView && (
              <div className="text-sm flex flex-wrap gap-4">
                <span>직접매출: <strong>{formatCurrency(vendorSettlementView.totalDirectSaleAmount)}</strong></span>
                <span>입금: <strong>{formatCurrency(vendorSettlementView.totalPaymentAmount)}</strong></span>
                <span>미수금: <strong className="text-red-600 dark:text-red-400">{formatCurrency(vendorSettlementView.balance)}</strong></span>
              </div>
            )}
            <div className="space-y-2">
              <Label>입금일</Label>
              <Input type="date" value={vendorPaymentDate} onChange={(e) => setVendorPaymentDate(e.target.value)} data-testid="input-vendor-payment-date" />
            </div>
            <div className="space-y-2">
              <Label>입금액</Label>
              <Input type="number" value={vendorPaymentAmount} onChange={(e) => setVendorPaymentAmount(e.target.value)} placeholder="금액을 입력하세요" data-testid="input-vendor-payment-amount" />
            </div>
            <div className="space-y-2">
              <Label>결제 방법</Label>
              <Select value={vendorPaymentMethod} onValueChange={setVendorPaymentMethod}>
                <SelectTrigger data-testid="select-vendor-payment-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="transfer">계좌이체</SelectItem>
                  <SelectItem value="card">카드</SelectItem>
                  <SelectItem value="product_offset">상품상계</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>메모 (선택)</Label>
              <Textarea value={vendorPaymentMemo} onChange={(e) => setVendorPaymentMemo(e.target.value)} placeholder="메모를 입력하세요" data-testid="input-vendor-payment-memo" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setVendorPaymentDialog(false); setVendorPaymentAmount(""); setVendorPaymentMemo(""); }} data-testid="button-vendor-payment-cancel">취소</Button>
              <Button onClick={handleVendorPayment} disabled={vendorPaymentMutation.isPending} data-testid="button-vendor-payment-confirm">
                {vendorPaymentMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                입금 등록
              </Button>
            </div>
          </div>
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
        <TabsList className="flex-wrap mb-4 bg-emerald-50 dark:bg-emerald-950/30">
          <TabsTrigger value="member-settlement" className="gap-1 data-[state=active]:bg-orange-100 data-[state=active]:dark:bg-orange-900/30" data-testid="tab-member-settlement">
            <Wallet className="h-4 w-4" />회원정산 관리
          </TabsTrigger>
          <TabsTrigger value="purchase-management" className="gap-1 data-[state=active]:bg-orange-100 data-[state=active]:dark:bg-orange-900/30" data-testid="tab-purchase-management">
            <ShoppingCart className="h-4 w-4" />매입관리
          </TabsTrigger>
          <TabsTrigger value="sales-overview" className="gap-1 data-[state=active]:bg-orange-100 data-[state=active]:dark:bg-orange-900/30" data-testid="tab-sales-overview">
            <DollarSign className="h-4 w-4" />매출 관리
          </TabsTrigger>
          <TabsTrigger value="profit-loss" className="gap-1 data-[state=active]:bg-orange-100 data-[state=active]:dark:bg-orange-900/30" data-testid="tab-profit-loss">
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
