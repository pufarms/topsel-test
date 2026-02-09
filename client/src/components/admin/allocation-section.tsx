import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Loader2, RefreshCw, Send, CheckCircle, AlertCircle, Package, Truck, Plus, ChevronDown, ChevronRight } from "lucide-react";

interface AllocationDetail {
  id: number;
  allocationId: number;
  vendorId: number | null;
  vendorName: string | null;
  requestedQuantity: number;
  confirmedQuantity: number | null;
  allocatedQuantity: number;
  vendorPrice: number | null;
  status: string;
  notifiedAt: string | null;
  respondedAt: string | null;
  confirmedAt: string | null;
  memo: string | null;
  deadlineExceeded?: boolean;
}

interface AvailableVendor {
  vendorId: number;
  companyName: string;
  vendorPrice: number;
}

interface Allocation {
  id: number;
  allocationDate: string;
  productCode: string;
  productName: string | null;
  totalQuantity: number;
  allocatedQuantity: number;
  unallocatedQuantity: number | null;
  status: string;
  details?: AllocationDetail[];
  availableVendors?: AvailableVendor[];
}

interface AssignResult {
  allocationId: number;
  assignedOrders: number;
  adjustedOrders: number;
  adjustReason?: string;
  byVendor: { vendorId: number | null; companyName: string; orderCount: number; totalQuantity: number }[];
  adjustedOrderIds?: string[];
}

interface AllocationsResponse {
  date: string;
  totalProducts: number;
  confirmedCount: number;
  pendingCount: number;
  allocations: Allocation[];
}

interface DetailsResponse {
  allocation: Allocation;
  details: AllocationDetail[];
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "배분 대기", variant: "secondary" },
  notifying: { label: "알림 발송중", variant: "default" },
  waiting: { label: "회신 대기", variant: "outline" },
  confirmed: { label: "배분 완료", variant: "default" },
  assigned: { label: "배정 완료", variant: "default" },
  cancelled: { label: "취소", variant: "destructive" },
};

const detailStatusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "대기", variant: "secondary" },
  notified: { label: "알림 발송", variant: "default" },
  responded: { label: "회신 완료", variant: "outline" },
  confirmed: { label: "확정", variant: "default" },
  rejected: { label: "거절", variant: "destructive" },
};

export default function AllocationSection() {
  const { toast } = useToast();
  const today = new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedAllocation, setSelectedAllocation] = useState<Allocation | null>(null);
  const [isOpen, setIsOpen] = useState(true);

  const [notifyDialogOpen, setNotifyDialogOpen] = useState(false);
  const [additionalNotifyDialogOpen, setAdditionalNotifyDialogOpen] = useState(false);
  const [respondDialogOpen, setRespondDialogOpen] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignTargetAllocation, setAssignTargetAllocation] = useState<Allocation | null>(null);

  const [vendorInputs, setVendorInputs] = useState<{ vendorId: number; companyName: string; requestedQuantity: number; vendorPrice: number }[]>([]);
  const [additionalVendorInputs, setAdditionalVendorInputs] = useState<{ vendorId: number; companyName: string; requestedQuantity: number; vendorPrice: number }[]>([]);
  const [respondDetail, setRespondDetail] = useState<{ detailId: number; vendorName: string; confirmedQuantity: number; memo: string } | null>(null);
  const [confirmInputs, setConfirmInputs] = useState<{ detailId: number; vendorName: string; allocatedQuantity: number }[]>([]);
  const [selfQuantity, setSelfQuantity] = useState(0);

  const { data: allocationsData, isLoading, refetch } = useQuery<AllocationsResponse>({
    queryKey: ["/api/admin/allocations", `?date=${selectedDate}`],
    enabled: !!selectedDate,
  });

  const { data: detailsData, refetch: refetchDetails } = useQuery<DetailsResponse>({
    queryKey: ["/api/admin/allocations", String(selectedAllocation?.id || ""), "details"],
    enabled: !!selectedAllocation?.id,
  });

  const refreshAll = () => {
    refetch();
    if (selectedAllocation?.id) refetchDetails();
    queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-orders"] });
    queryClient.invalidateQueries({ queryKey: ["/api/order-stats"] });
  };

  const generateMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/allocations/generate", { date: selectedDate }),
    onSuccess: () => {
      toast({ title: "외주상품 집계 완료" });
      refreshAll();
    },
    onError: (err: any) => toast({ title: "집계 실패", description: err.message, variant: "destructive" }),
  });

  const notifyMutation = useMutation({
    mutationFn: (data: { allocationId: number; vendors: { vendorId: number; requestedQuantity: number }[] }) =>
      apiRequest("POST", `/api/admin/allocations/${data.allocationId}/notify`, { vendors: data.vendors }),
    onSuccess: () => {
      toast({ title: "업체 알림 발송 완료" });
      setNotifyDialogOpen(false);
      refreshAll();
    },
    onError: (err: any) => toast({ title: "알림 발송 실패", description: err.message, variant: "destructive" }),
  });

  const additionalNotifyMutation = useMutation({
    mutationFn: (data: { allocationId: number; vendors: { vendorId: number; requestedQuantity: number }[] }) =>
      apiRequest("POST", `/api/admin/allocations/${data.allocationId}/notify-additional`, { vendors: data.vendors }),
    onSuccess: () => {
      toast({ title: "추가 업체 알림 발송 완료" });
      setAdditionalNotifyDialogOpen(false);
      refreshAll();
    },
    onError: (err: any) => toast({ title: "추가 알림 발송 실패", description: err.message, variant: "destructive" }),
  });

  const respondMutation = useMutation({
    mutationFn: (data: { detailId: number; confirmedQuantity: number; memo?: string }) =>
      apiRequest("PUT", `/api/admin/allocation-details/${data.detailId}/respond`, { confirmedQuantity: data.confirmedQuantity, memo: data.memo }),
    onSuccess: () => {
      toast({ title: "가능수량 접수 완료" });
      setRespondDialogOpen(false);
      refreshAll();
    },
    onError: (err: any) => toast({ title: "접수 실패", description: err.message, variant: "destructive" }),
  });

  const confirmMutation = useMutation({
    mutationFn: (data: { allocationId: number; details: { detailId: number; allocatedQuantity: number }[]; selfQuantity: number }) =>
      apiRequest("POST", `/api/admin/allocations/${data.allocationId}/confirm`, { details: data.details, selfQuantity: data.selfQuantity }),
    onSuccess: () => {
      toast({ title: "배분 확정 완료" });
      setConfirmDialogOpen(false);
      refreshAll();
    },
    onError: (err: any) => toast({ title: "배분 확정 실패", description: err.message, variant: "destructive" }),
  });

  const assignMutation = useMutation({
    mutationFn: async (allocationId: number) => {
      const res = await apiRequest("POST", `/api/admin/allocations/${allocationId}/assign-orders`);
      return await res.json() as AssignResult;
    },
    onSuccess: (result: AssignResult) => {
      const desc = result.adjustedOrders > 0
        ? `${result.assignedOrders}건 배정, ${result.adjustedOrders}건 주문조정 처리됨`
        : `${result.assignedOrders}건 배정 완료`;
      toast({ title: "주문 배정 완료", description: desc });
      setAssignDialogOpen(false);
      setAssignTargetAllocation(null);
      refreshAll();
    },
    onError: (err: any) => {
      toast({ title: "주문 배정 실패", description: err.message, variant: "destructive" });
      setAssignDialogOpen(false);
      setAssignTargetAllocation(null);
    },
  });

  const openNotifyDialog = (alloc: Allocation) => {
    setSelectedAllocation(alloc);
    const vendors = alloc.availableVendors || [];
    setVendorInputs(vendors.map(v => ({ vendorId: v.vendorId, companyName: v.companyName, requestedQuantity: 0, vendorPrice: v.vendorPrice })));
    setNotifyDialogOpen(true);
  };

  const openAdditionalNotifyDialog = () => {
    if (!selectedAllocation) return;
    const existingVendorIds = new Set((detailsData?.details || []).map(d => d.vendorId));
    const available = (selectedAllocation.availableVendors || []).filter(v => !existingVendorIds.has(v.vendorId));
    setAdditionalVendorInputs(available.map(v => ({ vendorId: v.vendorId, companyName: v.companyName, requestedQuantity: 0, vendorPrice: v.vendorPrice })));
    setAdditionalNotifyDialogOpen(true);
  };

  const openRespondDialog = (detail: AllocationDetail) => {
    setRespondDetail({
      detailId: detail.id,
      vendorName: detail.vendorName || "",
      confirmedQuantity: detail.requestedQuantity || 0,
      memo: "",
    });
    setRespondDialogOpen(true);
  };

  const openConfirmDialog = () => {
    if (!detailsData) return;
    const inputs = detailsData.details
      .filter(d => d.status === "responded" || d.status === "notified")
      .map(d => ({
        detailId: d.id,
        vendorName: d.vendorName || "알 수 없음",
        allocatedQuantity: d.confirmedQuantity ?? d.requestedQuantity ?? 0,
      }));
    setConfirmInputs(inputs);
    setSelfQuantity(0);
    setConfirmDialogOpen(true);
  };

  const allocations = allocationsData?.allocations || [];
  const details = detailsData?.details || [];
  const hasRespondedOrNotified = details.some(d => d.status === "responded" || d.status === "notified");

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <Card data-testid="allocation-section" className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer flex flex-row items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                {isOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                <CardTitle className="text-lg">외주(공급)업체 주문 배분</CardTitle>
                {allocationsData && (
                  <div className="flex gap-2">
                    <Badge variant="secondary" data-testid="badge-alloc-total">상품 {allocationsData.totalProducts}</Badge>
                    <Badge variant="outline" data-testid="badge-alloc-pending">대기 {allocationsData.pendingCount}</Badge>
                    <Badge variant="default" data-testid="badge-alloc-confirmed">완료 {allocationsData.confirmedCount}</Badge>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-44"
                  data-testid="input-allocation-date"
                />
                <Button
                  size="sm"
                  onClick={() => generateMutation.mutate()}
                  disabled={generateMutation.isPending}
                  data-testid="button-generate-allocations"
                >
                  {generateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                  외주상품 집계
                </Button>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              {isLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : allocations.length === 0 ? (
                <div className="py-6 text-center text-muted-foreground">
                  <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  해당 날짜의 배분 대상이 없습니다. "외주상품 집계" 버튼을 눌러 주세요.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-2">상품코드</th>
                        <th className="text-left py-2 px-2">상품명</th>
                        <th className="text-right py-2 px-2">총 주문수량</th>
                        <th className="text-right py-2 px-2">배정수량</th>
                        <th className="text-right py-2 px-2">주문조정</th>
                        <th className="text-center py-2 px-2">상태</th>
                        <th className="text-center py-2 px-2">액션</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allocations.map((alloc) => {
                        const sc = statusConfig[alloc.status || "pending"] || statusConfig.pending;
                        return (
                          <tr
                            key={alloc.id}
                            className={`border-b cursor-pointer ${selectedAllocation?.id === alloc.id ? "bg-muted/50" : ""}`}
                            onClick={() => setSelectedAllocation(alloc)}
                            data-testid={`row-allocation-${alloc.id}`}
                          >
                            <td className="py-2 px-2 font-mono text-xs">{alloc.productCode}</td>
                            <td className="py-2 px-2">{alloc.productName}</td>
                            <td className="py-2 px-2 text-right font-bold">{alloc.totalQuantity}</td>
                            <td className="py-2 px-2 text-right">
                              {alloc.status === "assigned" ? (
                                <span className="text-green-600 font-medium">{alloc.allocatedQuantity || 0}</span>
                              ) : (
                                <span>{alloc.allocatedQuantity || 0}</span>
                              )}
                            </td>
                            <td className="py-2 px-2 text-right">
                              {alloc.status === "assigned" && (alloc.unallocatedQuantity ?? 0) > 0 ? (
                                <span className="text-destructive font-medium">{alloc.unallocatedQuantity}</span>
                              ) : alloc.status === "assigned" ? (
                                <span className="text-muted-foreground">0</span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                            <td className="py-2 px-2 text-center">
                              <Badge variant={sc.variant} data-testid={`badge-status-${alloc.id}`}>{sc.label}</Badge>
                            </td>
                            <td className="py-2 px-2 text-center">
                              <div className="flex gap-1 justify-center flex-wrap">
                                {(alloc.status === "pending" || alloc.status === "waiting") && (
                                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); openNotifyDialog(alloc); }} data-testid={`button-notify-${alloc.id}`}>
                                    <Send className="h-3 w-3 mr-1" />알림
                                  </Button>
                                )}
                                {alloc.status === "confirmed" && (
                                  <Button size="sm" variant="default" onClick={(e) => { e.stopPropagation(); setAssignTargetAllocation(alloc); setAssignDialogOpen(true); }} disabled={assignMutation.isPending} data-testid={`button-assign-${alloc.id}`}>
                                    <Truck className="h-3 w-3 mr-1" />배정
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {selectedAllocation && (
                <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold">
                      배분 상세: {selectedAllocation.productName} ({selectedAllocation.productCode})
                    </h3>
                    <div className="flex gap-1 flex-wrap">
                      {(selectedAllocation.status === "waiting" || details.length > 0) && selectedAllocation.status !== "confirmed" && (
                        <Button size="sm" variant="outline" onClick={openAdditionalNotifyDialog} data-testid="button-additional-notify">
                          <Plus className="h-3 w-3 mr-1" />추가 업체 알림
                        </Button>
                      )}
                      {hasRespondedOrNotified && (
                        <Button size="sm" variant="outline" onClick={openConfirmDialog} data-testid="button-open-confirm">
                          <CheckCircle className="h-3 w-3 mr-1" />배분 확정
                        </Button>
                      )}
                    </div>
                  </div>
                  {details.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground text-sm">
                      아직 업체에 알림을 발송하지 않았습니다.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 px-2">업체명</th>
                            <th className="text-right py-2 px-2">요청수량</th>
                            <th className="text-right py-2 px-2">확인수량</th>
                            <th className="text-right py-2 px-2">확정수량</th>
                            <th className="text-right py-2 px-2">매입가</th>
                            <th className="text-center py-2 px-2">상태</th>
                            <th className="text-center py-2 px-2">액션</th>
                          </tr>
                        </thead>
                        <tbody>
                          {details.map((detail) => {
                            const ds = detailStatusConfig[detail.status || "pending"] || detailStatusConfig.pending;
                            return (
                              <tr key={detail.id} className="border-b" data-testid={`row-detail-${detail.id}`}>
                                <td className="py-2 px-2">{detail.vendorName || "자체발송"}</td>
                                <td className="py-2 px-2 text-right">{detail.requestedQuantity}</td>
                                <td className="py-2 px-2 text-right">{detail.confirmedQuantity ?? "-"}</td>
                                <td className="py-2 px-2 text-right">{detail.allocatedQuantity || "-"}</td>
                                <td className="py-2 px-2 text-right">{detail.vendorPrice ? detail.vendorPrice.toLocaleString() + "원" : "-"}</td>
                                <td className="py-2 px-2 text-center">
                                  <Badge variant={ds.variant}>{ds.label}</Badge>
                                  {detail.deadlineExceeded && detail.status === "notified" && (
                                    <AlertCircle className="h-3 w-3 text-destructive inline ml-1" />
                                  )}
                                </td>
                                <td className="py-2 px-2 text-center">
                                  {(detail.status === "notified" || detail.status === "responded") && (
                                    <Button size="sm" variant="outline" onClick={() => openRespondDialog(detail)} data-testid={`button-respond-${detail.id}`}>
                                      {detail.status === "responded" ? "수정" : "가능수량 입력"}
                                    </Button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Dialog open={notifyDialogOpen} onOpenChange={setNotifyDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>업체 알림 발송</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              상품: {selectedAllocation?.productName} | 총 필요수량: {selectedAllocation?.totalQuantity}
            </div>
            {vendorInputs.map((vi, idx) => (
              <div key={vi.vendorId} className="flex items-center gap-2">
                <span className="text-sm min-w-[80px]">{vi.companyName}</span>
                <span className="text-xs text-muted-foreground min-w-[60px]">{vi.vendorPrice.toLocaleString()}원</span>
                <Input
                  type="number"
                  min={0}
                  value={vi.requestedQuantity}
                  onChange={(e) => {
                    const updated = [...vendorInputs];
                    updated[idx].requestedQuantity = parseInt(e.target.value) || 0;
                    setVendorInputs(updated);
                  }}
                  className="w-20"
                  data-testid={`input-notify-qty-${vi.vendorId}`}
                />
                <span className="text-xs text-muted-foreground">박스</span>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotifyDialogOpen(false)} data-testid="button-cancel-notify">취소</Button>
            <Button
              onClick={() => {
                if (!selectedAllocation) return;
                const filtered = vendorInputs.filter(v => v.requestedQuantity > 0).map(v => ({ vendorId: v.vendorId, requestedQuantity: v.requestedQuantity }));
                if (filtered.length === 0) {
                  toast({ title: "요청수량을 입력해 주세요", variant: "destructive" });
                  return;
                }
                notifyMutation.mutate({ allocationId: selectedAllocation.id, vendors: filtered });
              }}
              disabled={notifyMutation.isPending}
              data-testid="button-send-notify"
            >
              {notifyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
              알림 발송
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={additionalNotifyDialogOpen} onOpenChange={setAdditionalNotifyDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>추가 업체 알림 발송</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              상품: {selectedAllocation?.productName} | 부족분에 대해 추가 업체에 알림을 보냅니다.
            </div>
            {additionalVendorInputs.length === 0 ? (
              <div className="text-sm text-center text-muted-foreground py-2">추가 가능한 업체가 없습니다.</div>
            ) : (
              additionalVendorInputs.map((vi, idx) => (
                <div key={vi.vendorId} className="flex items-center gap-2">
                  <span className="text-sm min-w-[80px]">{vi.companyName}</span>
                  <span className="text-xs text-muted-foreground min-w-[60px]">{vi.vendorPrice.toLocaleString()}원</span>
                  <Input
                    type="number"
                    min={0}
                    value={vi.requestedQuantity}
                    onChange={(e) => {
                      const updated = [...additionalVendorInputs];
                      updated[idx].requestedQuantity = parseInt(e.target.value) || 0;
                      setAdditionalVendorInputs(updated);
                    }}
                    className="w-20"
                    data-testid={`input-additional-qty-${vi.vendorId}`}
                  />
                  <span className="text-xs text-muted-foreground">박스</span>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdditionalNotifyDialogOpen(false)} data-testid="button-cancel-additional-notify">취소</Button>
            <Button
              onClick={() => {
                if (!selectedAllocation) return;
                const filtered = additionalVendorInputs.filter(v => v.requestedQuantity > 0).map(v => ({ vendorId: v.vendorId, requestedQuantity: v.requestedQuantity }));
                if (filtered.length === 0) {
                  toast({ title: "요청수량을 입력해 주세요", variant: "destructive" });
                  return;
                }
                additionalNotifyMutation.mutate({ allocationId: selectedAllocation.id, vendors: filtered });
              }}
              disabled={additionalNotifyMutation.isPending}
              data-testid="button-send-additional-notify"
            >
              {additionalNotifyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
              추가 알림 발송
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={respondDialogOpen} onOpenChange={setRespondDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>가능수량 입력</DialogTitle>
          </DialogHeader>
          {respondDetail && (
            <div className="space-y-3">
              <div className="text-sm">업체: {respondDetail.vendorName}</div>
              <div>
                <label className="text-sm font-medium">가능수량 (박스)</label>
                <Input
                  type="number"
                  min={0}
                  value={respondDetail.confirmedQuantity}
                  onChange={(e) => setRespondDetail({ ...respondDetail, confirmedQuantity: parseInt(e.target.value) || 0 })}
                  data-testid="input-confirmed-qty"
                />
              </div>
              <div>
                <label className="text-sm font-medium">메모</label>
                <Input
                  value={respondDetail.memo}
                  onChange={(e) => setRespondDetail({ ...respondDetail, memo: e.target.value })}
                  placeholder="예: 전화 통화로 확인"
                  data-testid="input-respond-memo"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRespondDialogOpen(false)} data-testid="button-cancel-respond">취소</Button>
            <Button
              onClick={() => {
                if (!respondDetail) return;
                respondMutation.mutate({ detailId: respondDetail.detailId, confirmedQuantity: respondDetail.confirmedQuantity, memo: respondDetail.memo });
              }}
              disabled={respondMutation.isPending}
              data-testid="button-submit-respond"
            >
              {respondMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              접수
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>배분 확정</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              총 필요수량: {selectedAllocation?.totalQuantity}
            </div>
            {confirmInputs.map((ci, idx) => (
              <div key={ci.detailId} className="flex items-center gap-2">
                <span className="text-sm min-w-[80px]">{ci.vendorName}</span>
                <Input
                  type="number"
                  min={0}
                  value={ci.allocatedQuantity}
                  onChange={(e) => {
                    const updated = [...confirmInputs];
                    updated[idx].allocatedQuantity = parseInt(e.target.value) || 0;
                    setConfirmInputs(updated);
                  }}
                  className="w-20"
                  data-testid={`input-confirm-qty-${ci.detailId}`}
                />
                <span className="text-xs text-muted-foreground">박스</span>
              </div>
            ))}
            <div className="flex items-center gap-2 border-t pt-2">
              <span className="text-sm min-w-[80px] font-medium">자체발송</span>
              <Input
                type="number"
                min={0}
                value={selfQuantity}
                onChange={(e) => setSelfQuantity(parseInt(e.target.value) || 0)}
                className="w-20"
                data-testid="input-self-qty"
              />
              <span className="text-xs text-muted-foreground">박스</span>
            </div>
            <div className="text-xs text-muted-foreground">
              배분 합계: {confirmInputs.reduce((sum, c) => sum + c.allocatedQuantity, 0) + selfQuantity} / {selectedAllocation?.totalQuantity}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialogOpen(false)} data-testid="button-cancel-confirm">취소</Button>
            <Button
              onClick={() => {
                if (!selectedAllocation) return;
                confirmMutation.mutate({
                  allocationId: selectedAllocation.id,
                  details: confirmInputs.map(c => ({ detailId: c.detailId, allocatedQuantity: c.allocatedQuantity })),
                  selfQuantity,
                });
              }}
              disabled={confirmMutation.isPending}
              data-testid="button-submit-confirm"
            >
              {confirmMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              배분 확정
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>주문 배정 확인</DialogTitle>
          </DialogHeader>
          {assignTargetAllocation && (
            <div className="space-y-3">
              <div className="text-sm">
                <span className="font-medium">상품:</span> {assignTargetAllocation.productName} ({assignTargetAllocation.productCode})
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>총 필요수량:</span>
                  <span className="font-bold">{assignTargetAllocation.totalQuantity}건</span>
                </div>
                <div className="flex justify-between">
                  <span>배정 가능:</span>
                  <span className="font-bold text-foreground">{assignTargetAllocation.allocatedQuantity || 0}건</span>
                </div>
                {(() => {
                  const unalloc = assignTargetAllocation.totalQuantity - (assignTargetAllocation.allocatedQuantity || 0);
                  return unalloc > 0 ? (
                    <div className="flex justify-between">
                      <span>미배정 (주문조정 예정):</span>
                      <span className="font-bold text-destructive">{unalloc}건</span>
                    </div>
                  ) : null;
                })()}
              </div>
              {(() => {
                const unalloc = assignTargetAllocation.totalQuantity - (assignTargetAllocation.allocatedQuantity || 0);
                return unalloc > 0 ? (
                  <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 inline mr-1" />
                    배정을 진행하면 미배정 주문 {unalloc}건은 자동으로 주문조정 처리됩니다.
                  </div>
                ) : null;
              })()}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAssignDialogOpen(false); setAssignTargetAllocation(null); }} data-testid="button-cancel-assign">취소</Button>
            <Button
              onClick={() => {
                if (!assignTargetAllocation) return;
                assignMutation.mutate(assignTargetAllocation.id);
              }}
              disabled={assignMutation.isPending}
              data-testid="button-submit-assign"
            >
              {assignMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Truck className="h-4 w-4 mr-1" />}
              배정 진행
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
