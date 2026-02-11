import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  RefreshCw,
  Banknote,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Search,
  UserCheck,
  XCircle,
} from "lucide-react";

interface BankdaSummary {
  todayCount: number;
  todayAmount: number;
  matchedCount: number;
  unmatchedCount: number;
  lastSyncAt: string | null;
}

interface MatchedMember {
  memberName: string | null;
  companyName: string;
}

interface BankdaTransaction {
  id: number;
  bkcode: string;
  accountnum: string;
  bkname: string;
  bkdate: string;
  bktime: string;
  bkjukyo: string;
  bkcontent: string;
  bketc: string;
  bkinput: number;
  bkoutput: number;
  bkjango: number;
  matchStatus: string;
  matchedMemberId: string | null;
  matchedAt: string | null;
  depositCharged: boolean;
  depositHistoryId: string | null;
  chargeError: string | null;
  adminMemo: string | null;
  createdAt: string;
  updatedAt: string;
  matchedMember: MatchedMember | null;
}

interface SearchMemberResult {
  id: string;
  memberName: string;
  companyName: string;
  phone: string;
  deposit: number;
  grade: string;
}

const statusFilterOptions = [
  { value: "all", label: "전체" },
  { value: "matched", label: "매칭완료" },
  { value: "unmatched", label: "미매칭" },
  { value: "duplicate_name", label: "동명이인" },
  { value: "ignored", label: "무시" },
];

const matchStatusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  matched: { label: "매칭완료", variant: "default" },
  unmatched: { label: "미매칭", variant: "destructive" },
  duplicate_name: { label: "동명이인", variant: "secondary" },
  manual: { label: "수동매칭", variant: "outline" },
  ignored: { label: "무시", variant: "secondary" },
  pending: { label: "대기", variant: "secondary" },
};

function formatBkDate(bkdate: string | null | undefined): string {
  if (!bkdate) return '-';
  if (bkdate.length === 8) {
    return `${bkdate.slice(0, 4)}-${bkdate.slice(4, 6)}-${bkdate.slice(6, 8)}`;
  }
  return bkdate;
}

function formatBkTime(bktime: string | null | undefined): string {
  if (!bktime) return '-';
  if (bktime.length === 6) {
    return `${bktime.slice(0, 2)}:${bktime.slice(2, 4)}:${bktime.slice(4, 6)}`;
  }
  return bktime;
}

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case "matched":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
    case "unmatched":
      return "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-red-200 dark:border-red-800";
    case "duplicate_name":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800";
    case "manual":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800";
    case "ignored":
    case "pending":
    default:
      return "";
  }
}

export default function BankdaDeposits() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [manualMatchTx, setManualMatchTx] = useState<BankdaTransaction | null>(null);
  const [ignoreTx, setIgnoreTx] = useState<BankdaTransaction | null>(null);
  const [ignoreMemo, setIgnoreMemo] = useState("");
  const [memberSearchQuery, setMemberSearchQuery] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  const { data: summary, isLoading: summaryLoading } = useQuery<BankdaSummary>({
    queryKey: ["/api/admin/bankda/summary"],
  });

  const txQueryKey = ["/api/admin/bankda/transactions", statusFilter, startDate, endDate];
  const { data: transactions = [], isLoading: txLoading } = useQuery<BankdaTransaction[]>({
    queryKey: txQueryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      const res = await fetch(`/api/admin/bankda/transactions?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("조회 실패");
      return res.json();
    },
  });

  const { data: searchResults = [], isFetching: searchFetching } = useQuery<SearchMemberResult[]>({
    queryKey: ["/api/admin/bankda/search-members", memberSearchQuery],
    queryFn: async () => {
      if (!memberSearchQuery.trim()) return [];
      const res = await fetch(`/api/admin/bankda/search-members?q=${encodeURIComponent(memberSearchQuery)}`, { credentials: "include" });
      if (!res.ok) throw new Error("검색 실패");
      return res.json();
    },
    enabled: !!memberSearchQuery.trim(),
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/bankda/sync");
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success === false) {
        toast({
          title: data.rateLimited ? "조회 제한" : "동기화 실패",
          description: data.error,
          variant: data.rateLimited ? "default" : "destructive",
        });
        return;
      }
      toast({
        title: "동기화 완료",
        description: `처리: ${data.processed}건, 매칭: ${data.matched}건, 미매칭: ${data.unmatched}건, 건너뜀: ${data.skipped}건`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bankda/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bankda/transactions"] });
    },
    onError: (error: any) => {
      toast({ title: "동기화 실패", description: error.message, variant: "destructive" });
    },
  });

  const manualMatchMutation = useMutation({
    mutationFn: async ({ txId, memberId }: { txId: number; memberId: string }) => {
      const res = await apiRequest("POST", `/api/admin/bankda/transactions/${txId}/manual-match`, { memberId });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "수동 매칭 완료", description: data.message });
      setManualMatchTx(null);
      setMemberSearchQuery("");
      setSelectedMemberId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bankda/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bankda/transactions"] });
    },
    onError: (error: any) => {
      toast({ title: "매칭 실패", description: error.message, variant: "destructive" });
    },
  });

  const ignoreMutation = useMutation({
    mutationFn: async ({ txId, memo }: { txId: number; memo: string }) => {
      const res = await apiRequest("POST", `/api/admin/bankda/transactions/${txId}/ignore`, { memo });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "무시 처리 완료", description: data.message });
      setIgnoreTx(null);
      setIgnoreMemo("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bankda/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bankda/transactions"] });
    },
    onError: (error: any) => {
      toast({ title: "처리 실패", description: error.message, variant: "destructive" });
    },
  });

  const handleManualMatchConfirm = () => {
    if (!manualMatchTx || !selectedMemberId) return;
    manualMatchMutation.mutate({ txId: manualMatchTx.id, memberId: selectedMemberId });
  };

  const handleIgnoreConfirm = () => {
    if (!ignoreTx) return;
    ignoreMutation.mutate({ txId: ignoreTx.id, memo: ignoreMemo });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl md:text-2xl font-bold" data-testid="text-page-title">뱅크다 입금 관리</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">오늘 입금</CardTitle>
            <Banknote className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <div className="text-2xl font-bold" data-testid="text-today-count">
                  {summary?.todayCount ?? 0}건
                </div>
                <p className="text-xs text-muted-foreground" data-testid="text-today-amount">
                  {(summary?.todayAmount ?? 0).toLocaleString("ko-KR")}원
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">자동 매칭 성공</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <div className="text-2xl font-bold" data-testid="text-matched-count">
                {summary?.matchedCount ?? 0}건
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">미매칭 (처리 필요)</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold" data-testid="text-unmatched-count">
                  {summary?.unmatchedCount ?? 0}건
                </span>
                {(summary?.unmatchedCount ?? 0) > 0 && (
                  <Badge variant="destructive" className="no-default-active-elevate" data-testid="badge-unmatched-alert">
                    처리 필요
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">마지막 동기화</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <div className="text-lg font-semibold" data-testid="text-last-sync">
                {summary?.lastSyncAt
                  ? new Date(summary.lastSyncAt).toLocaleString("ko-KR")
                  : "동기화 기록 없음"}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              data-testid="button-sync-bankda"
            >
              {syncMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              지금 동기화
            </Button>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]" data-testid="select-status-filter">
                <SelectValue placeholder="상태 필터" />
              </SelectTrigger>
              <SelectContent>
                {statusFilterOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} data-testid={`option-status-${opt.value}`}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-[150px]"
                data-testid="input-start-date"
              />
              <span className="text-muted-foreground">~</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-[150px]"
                data-testid="input-end-date"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {txLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="border rounded-lg overflow-x-auto overflow-y-auto max-h-[600px]">
              <Table className="min-w-[1100px]">
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow>
                    <TableHead>거래일시</TableHead>
                    <TableHead>입금자명</TableHead>
                    <TableHead className="text-right">입금액</TableHead>
                    <TableHead>매칭상태</TableHead>
                    <TableHead>매칭회원</TableHead>
                    <TableHead>충전여부</TableHead>
                    <TableHead>액션</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        거래 내역이 없습니다
                      </TableCell>
                    </TableRow>
                  ) : (
                    transactions.map((tx) => {
                      const statusCfg = matchStatusConfig[tx.matchStatus] || matchStatusConfig.pending;
                      const customClass = getStatusBadgeClass(tx.matchStatus);
                      const showActions = ["unmatched", "duplicate_name", "pending"].includes(tx.matchStatus);
                      const showMemberInfo = ["matched", "manual"].includes(tx.matchStatus);

                      return (
                        <TableRow key={tx.id} data-testid={`row-tx-${tx.id}`}>
                          <TableCell className="whitespace-nowrap">
                            <span data-testid={`text-tx-date-${tx.id}`}>
                              {formatBkDate(tx.bkdate)} {formatBkTime(tx.bktime)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="font-medium" data-testid={`text-tx-name-${tx.id}`}>
                              {tx.bkjukyo}
                            </span>
                            {tx.bketc && (
                              <span className="ml-1 text-xs text-muted-foreground">({tx.bketc.split(/\s+/)[0]})</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-medium" data-testid={`text-tx-amount-${tx.id}`}>
                            {tx.bkinput.toLocaleString("ko-KR")}원
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={statusCfg.variant}
                              className={`no-default-active-elevate ${customClass}`}
                              data-testid={`badge-status-${tx.id}`}
                            >
                              {statusCfg.label}
                            </Badge>
                          </TableCell>
                          <TableCell data-testid={`text-matched-member-${tx.id}`}>
                            {tx.matchedMember
                              ? `${tx.matchedMember.memberName || ""} (${tx.matchedMember.companyName})`
                              : "-"}
                          </TableCell>
                          <TableCell data-testid={`text-charged-${tx.id}`}>
                            {tx.depositCharged ? (
                              <Badge variant="outline" className="no-default-active-elevate bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300">
                                충전완료
                              </Badge>
                            ) : tx.chargeError ? (
                              <Badge variant="destructive" className="no-default-active-elevate">
                                오류
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {showActions && (
                              <div className="flex items-center gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1"
                                  onClick={() => {
                                    setManualMatchTx(tx);
                                    setMemberSearchQuery("");
                                    setSelectedMemberId(null);
                                  }}
                                  data-testid={`button-manual-match-${tx.id}`}
                                >
                                  <UserCheck className="h-3 w-3" />
                                  수동 매칭
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1"
                                  onClick={() => {
                                    setIgnoreTx(tx);
                                    setIgnoreMemo("");
                                  }}
                                  data-testid={`button-ignore-${tx.id}`}
                                >
                                  <XCircle className="h-3 w-3" />
                                  무시
                                </Button>
                              </div>
                            )}
                            {showMemberInfo && tx.matchedMember && (
                              <span className="text-sm text-muted-foreground" data-testid={`text-action-info-${tx.id}`}>
                                {tx.matchedMember.memberName || tx.matchedMember.companyName}
                              </span>
                            )}
                            {tx.matchStatus === "ignored" && (
                              <span className="text-sm text-muted-foreground" data-testid={`text-ignored-${tx.id}`}>
                                무시됨
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!manualMatchTx} onOpenChange={(open) => { if (!open) setManualMatchTx(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>수동 매칭</DialogTitle>
          </DialogHeader>
          {manualMatchTx && (
            <div className="space-y-4">
              <div className="rounded-lg border p-3 space-y-1">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-sm text-muted-foreground">입금자명</span>
                  <span className="font-medium" data-testid="text-dialog-depositor">
                    {manualMatchTx.bkjukyo}
                    {manualMatchTx.bketc && <span className="ml-1 text-xs text-muted-foreground">({manualMatchTx.bketc.split(/\s+/)[0]})</span>}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-sm text-muted-foreground">입금액</span>
                  <span className="font-medium" data-testid="text-dialog-amount">
                    {manualMatchTx.bkinput.toLocaleString("ko-KR")}원
                  </span>
                </div>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="회원 검색 (이름, 상호명, 전화번호)"
                  value={memberSearchQuery}
                  onChange={(e) => {
                    setMemberSearchQuery(e.target.value);
                    setSelectedMemberId(null);
                  }}
                  className="pl-9"
                  data-testid="input-member-search"
                />
              </div>

              <div className="max-h-[250px] overflow-y-auto space-y-1">
                {searchFetching && (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                )}
                {!searchFetching && memberSearchQuery.trim() && searchResults.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">검색 결과가 없습니다</p>
                )}
                {searchResults.map((member) => (
                  <div
                    key={member.id}
                    className={`rounded-lg border p-3 cursor-pointer transition-colors ${
                      selectedMemberId === member.id
                        ? "border-primary bg-primary/5"
                        : "hover-elevate"
                    }`}
                    onClick={() => setSelectedMemberId(member.id)}
                    data-testid={`card-member-${member.id}`}
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div>
                        <span className="font-medium">{member.memberName}</span>
                        <span className="text-sm text-muted-foreground ml-2">({member.companyName})</span>
                      </div>
                      <Badge variant="outline" className="no-default-active-elevate">{member.grade}</Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground flex-wrap">
                      <span>{member.phone}</span>
                      <span>예치금: {member.deposit.toLocaleString("ko-KR")}원</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setManualMatchTx(null)}
                  data-testid="button-cancel-match"
                >
                  취소
                </Button>
                <Button
                  onClick={handleManualMatchConfirm}
                  disabled={!selectedMemberId || manualMatchMutation.isPending}
                  data-testid="button-confirm-match"
                >
                  {manualMatchMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  매칭 확인
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!ignoreTx} onOpenChange={(open) => { if (!open) setIgnoreTx(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>입금 무시 처리</DialogTitle>
          </DialogHeader>
          {ignoreTx && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                <strong>{ignoreTx.bkjukyo}</strong>님의{" "}
                <strong>{ignoreTx.bkinput.toLocaleString("ko-KR")}원</strong> 입금을 무시 처리합니다.
              </p>
              <Textarea
                placeholder="메모 (선택사항)"
                value={ignoreMemo}
                onChange={(e) => setIgnoreMemo(e.target.value)}
                data-testid="input-ignore-memo"
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIgnoreTx(null)}
                  data-testid="button-cancel-ignore"
                >
                  취소
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleIgnoreConfirm}
                  disabled={ignoreMutation.isPending}
                  data-testid="button-confirm-ignore"
                >
                  {ignoreMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  무시 처리
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
