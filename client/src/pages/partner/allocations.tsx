import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send, CheckCircle, Clock, AlertCircle } from "lucide-react";

interface AllocationItem {
  id: number;
  allocationId: number;
  allocationDate: string;
  productCode: string;
  productName: string | null;
  requestedQuantity: number;
  confirmedQuantity: number | null;
  status: string;
  notifiedAt: string | null;
  respondedAt: string | null;
  confirmedAt: string | null;
  memo: string | null;
  allocationStatus: string;
}

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "대기", variant: "secondary" },
  notified: { label: "응답 대기", variant: "outline" },
  responded: { label: "응답 완료", variant: "default" },
  confirmed: { label: "확정", variant: "default" },
  rejected: { label: "거절", variant: "destructive" },
};

export default function PartnerAllocations() {
  const { toast } = useToast();
  const [filter, setFilter] = useState("all");
  const [respondTarget, setRespondTarget] = useState<AllocationItem | null>(null);
  const [availableQuantity, setAvailableQuantity] = useState("");
  const [respondMemo, setRespondMemo] = useState("");

  const { data: allocations = [], isLoading } = useQuery<AllocationItem[]>({
    queryKey: ["/api/partner/allocations", filter],
    queryFn: async () => {
      const res = await fetch(`/api/partner/allocations?filter=${filter}`, { credentials: "include" });
      if (!res.ok) throw new Error("조회 실패");
      return res.json();
    },
  });

  const respondMutation = useMutation({
    mutationFn: async ({ id, availableQuantity, memo }: { id: number; availableQuantity: number; memo: string }) => {
      await apiRequest("PUT", `/api/partner/allocations/${id}/respond`, { availableQuantity, memo });
    },
    onSuccess: () => {
      toast({ title: "응답 완료", description: "가능수량이 등록되었습니다" });
      queryClient.invalidateQueries({ queryKey: ["/api/partner/allocations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/partner/dashboard"] });
      setRespondTarget(null);
    },
    onError: (err: any) => {
      toast({ title: "응답 실패", description: err.message, variant: "destructive" });
    },
  });

  const pendingItems = allocations.filter(a => a.status === "notified" || a.status === "pending");
  const respondedItems = allocations.filter(a => a.status !== "notified" && a.status !== "pending");

  const handleRespond = () => {
    if (!respondTarget) return;
    const qty = parseInt(availableQuantity);
    if (isNaN(qty) || qty < 0) {
      toast({ title: "입력 오류", description: "올바른 수량을 입력해 주세요", variant: "destructive" });
      return;
    }
    respondMutation.mutate({ id: respondTarget.id, availableQuantity: qty, memo: respondMemo });
  };

  const openRespondDialog = (item: AllocationItem) => {
    setRespondTarget(item);
    setAvailableQuantity(String(item.requestedQuantity || 0));
    setRespondMemo("");
  };

  return (
    <div className="space-y-4 pb-20 lg:pb-0">
      <h1 className="text-xl font-bold" data-testid="text-allocations-title">예상수량 응답</h1>

      <div className="flex gap-2 flex-wrap">
        {[
          { key: "all", label: "전체" },
          { key: "pending", label: "응답 대기" },
          { key: "responded", label: "응답 완료" },
        ].map(f => (
          <Button
            key={f.key}
            size="sm"
            variant={filter === f.key ? "default" : "outline"}
            onClick={() => setFilter(f.key)}
            data-testid={`button-filter-${f.key}`}
          >
            {f.label}
            {f.key === "pending" && pendingItems.length > 0 && (
              <Badge variant="destructive" className="ml-1">{pendingItems.length}</Badge>
            )}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : allocations.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            배분 요청이 없습니다.
          </CardContent>
        </Card>
      ) : (
        <>
          {pendingItems.length > 0 && (filter === "all" || filter === "pending") && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  응답 대기 ({pendingItems.length}건)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-2">배분일</th>
                        <th className="text-left py-2 px-2">상품명</th>
                        <th className="text-right py-2 px-2">예상수량</th>
                        <th className="text-center py-2 px-2">액션</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingItems.map(item => (
                        <tr key={item.id} className="border-b">
                          <td className="py-2 px-2">{item.allocationDate}</td>
                          <td className="py-2 px-2">{item.productName} <span className="text-xs text-muted-foreground">({item.productCode})</span></td>
                          <td className="py-2 px-2 text-right font-bold">{item.requestedQuantity}</td>
                          <td className="py-2 px-2 text-center">
                            <Button size="sm" onClick={() => openRespondDialog(item)} data-testid={`button-respond-${item.id}`}>
                              <Send className="h-3 w-3 mr-1" />응답
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="md:hidden space-y-2">
                  {pendingItems.map(item => (
                    <Card key={item.id}>
                      <CardContent className="p-3 space-y-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium text-sm">{item.productName}</div>
                            <div className="text-xs text-muted-foreground">{item.productCode} | {item.allocationDate}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold">{item.requestedQuantity}개</div>
                          </div>
                        </div>
                        <Button size="sm" className="w-full" onClick={() => openRespondDialog(item)} data-testid={`button-respond-mobile-${item.id}`}>
                          <Send className="h-3 w-3 mr-1" />응답하기
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {respondedItems.length > 0 && (filter === "all" || filter === "responded") && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  응답 완료 ({respondedItems.length}건)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-2">배분일</th>
                        <th className="text-left py-2 px-2">상품명</th>
                        <th className="text-right py-2 px-2">예상수량</th>
                        <th className="text-right py-2 px-2">응답수량</th>
                        <th className="text-center py-2 px-2">상태</th>
                        <th className="text-left py-2 px-2">응답일시</th>
                      </tr>
                    </thead>
                    <tbody>
                      {respondedItems.map(item => {
                        const st = statusLabels[item.status] || statusLabels.pending;
                        return (
                          <tr key={item.id} className="border-b">
                            <td className="py-2 px-2">{item.allocationDate}</td>
                            <td className="py-2 px-2">{item.productName}</td>
                            <td className="py-2 px-2 text-right">{item.requestedQuantity}</td>
                            <td className="py-2 px-2 text-right font-bold">{item.confirmedQuantity ?? "-"}</td>
                            <td className="py-2 px-2 text-center">
                              <Badge variant={st.variant}>{st.label}</Badge>
                            </td>
                            <td className="py-2 px-2 text-xs text-muted-foreground">
                              {item.respondedAt ? new Date(item.respondedAt).toLocaleString("ko-KR") : "-"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Dialog open={!!respondTarget} onOpenChange={(open) => { if (!open) setRespondTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>가능수량 응답</DialogTitle>
          </DialogHeader>
          {respondTarget && (
            <div className="space-y-4">
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">상품</div>
                <div className="font-medium">{respondTarget.productName} ({respondTarget.productCode})</div>
              </div>
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">예상수량 (요청)</div>
                <div className="font-bold text-lg">{respondTarget.requestedQuantity}개</div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">가능수량</label>
                <Input
                  type="number"
                  min={0}
                  value={availableQuantity}
                  onChange={(e) => setAvailableQuantity(e.target.value)}
                  placeholder="가능한 수량을 입력하세요"
                  data-testid="input-available-quantity"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">메모 (선택)</label>
                <Textarea
                  value={respondMemo}
                  onChange={(e) => setRespondMemo(e.target.value)}
                  placeholder="전달사항이 있으면 입력하세요"
                  rows={2}
                  data-testid="input-respond-memo"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRespondTarget(null)}>취소</Button>
            <Button onClick={handleRespond} disabled={respondMutation.isPending} data-testid="button-confirm-respond">
              {respondMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              응답 등록
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
