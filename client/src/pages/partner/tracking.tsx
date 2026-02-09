import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, Download, ScanBarcode, CheckCircle, AlertCircle } from "lucide-react";

const courierOptions = [
  "CJ대한통운", "한진택배", "롯데택배", "우체국택배", "로젠택배", "경동택배", "기타"
];

interface OrdersResponse {
  orders: any[];
  total: number;
}

interface BulkResult {
  success: number;
  failed: number;
  failedList: { row: number; orderNumber: string; reason: string }[];
}

export default function PartnerTracking() {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [trackingTarget, setTrackingTarget] = useState<any>(null);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [courierCompany, setCourierCompany] = useState(courierOptions[0]);
  const [bulkResult, setBulkResult] = useState<BulkResult | null>(null);

  const { data: unregistered, isLoading: loadingUnreg } = useQuery<OrdersResponse>({
    queryKey: ["/api/partner/orders", "unregistered"],
    queryFn: async () => {
      const res = await fetch("/api/partner/orders?status=all&limit=200", { credentials: "include" });
      if (!res.ok) throw new Error("조회 실패");
      const data = await res.json();
      return {
        orders: data.orders.filter((o: any) => !o.trackingNumber && o.vendorId),
        total: data.orders.filter((o: any) => !o.trackingNumber && o.vendorId).length,
      };
    },
  });

  const { data: registered, isLoading: loadingReg } = useQuery<OrdersResponse>({
    queryKey: ["/api/partner/orders", "registered"],
    queryFn: async () => {
      const res = await fetch("/api/partner/orders?status=all&limit=200", { credentials: "include" });
      if (!res.ok) throw new Error("조회 실패");
      const data = await res.json();
      return {
        orders: data.orders.filter((o: any) => o.trackingNumber),
        total: data.orders.filter((o: any) => o.trackingNumber).length,
      };
    },
  });

  const trackingMutation = useMutation({
    mutationFn: async ({ orderId, trackingNumber, courierCompany }: { orderId: string; trackingNumber: string; courierCompany: string }) => {
      await apiRequest("PUT", `/api/partner/orders/${orderId}/tracking`, { trackingNumber, courierCompany });
    },
    onSuccess: () => {
      toast({ title: "등록 완료", description: "운송장이 등록되었습니다" });
      queryClient.invalidateQueries({ queryKey: ["/api/partner/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/partner/dashboard"] });
      setTrackingTarget(null);
    },
    onError: (err: any) => {
      toast({ title: "등록 실패", description: err.message, variant: "destructive" });
    },
  });

  const bulkMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/partner/orders/tracking/bulk", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error("업로드 실패");
      return res.json() as Promise<BulkResult>;
    },
    onSuccess: (result) => {
      setBulkResult(result);
      queryClient.invalidateQueries({ queryKey: ["/api/partner/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/partner/dashboard"] });
      if (result.success > 0) {
        toast({ title: "일괄 등록 완료", description: `성공: ${result.success}건, 실패: ${result.failed}건` });
      }
    },
    onError: (err: any) => {
      toast({ title: "업로드 실패", description: err.message, variant: "destructive" });
    },
  });

  const handleTrackingSubmit = () => {
    if (!trackingTarget || !trackingNumber.trim()) {
      toast({ title: "입력 오류", description: "운송장 번호를 입력해 주세요", variant: "destructive" });
      return;
    }
    trackingMutation.mutate({ orderId: trackingTarget.id, trackingNumber: trackingNumber.trim(), courierCompany });
  };

  const openTrackingDialog = (order: any) => {
    setTrackingTarget(order);
    setTrackingNumber(order.trackingNumber || "");
    setCourierCompany(order.courierCompany || courierOptions[0]);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) bulkMutation.mutate(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleTemplateDownload = () => {
    window.open("/api/partner/orders/tracking/template", "_blank");
  };

  const unregOrders = unregistered?.orders || [];
  const regOrders = registered?.orders || [];

  return (
    <div className="space-y-4 pb-20 lg:pb-0">
      <h1 className="text-xl font-bold" data-testid="text-tracking-title">운송장 등록</h1>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            미등록 주문 ({unregOrders.length}건)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={handleTemplateDownload} data-testid="button-template-download">
              <Download className="h-4 w-4 mr-1" />양식 다운로드
            </Button>
            <div className="relative">
              <input type="file" ref={fileRef} accept=".xlsx,.xls" onChange={handleFileUpload} className="hidden" />
              <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={bulkMutation.isPending} data-testid="button-bulk-upload">
                {bulkMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
                엑셀 일괄 등록
              </Button>
            </div>
          </div>

          {bulkResult && (
            <div className="p-3 rounded-md border text-sm space-y-1">
              <div>성공: <span className="font-bold text-green-600">{bulkResult.success}건</span> / 실패: <span className="font-bold text-destructive">{bulkResult.failed}건</span></div>
              {bulkResult.failedList.length > 0 && (
                <div className="mt-2 space-y-1">
                  {bulkResult.failedList.map((f, i) => (
                    <div key={i} className="text-xs text-destructive">행 {f.row}: {f.orderNumber} - {f.reason}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {loadingUnreg ? (
            <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : unregOrders.length === 0 ? (
            <div className="text-center text-muted-foreground py-4 text-sm">미등록 주문이 없습니다.</div>
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2">주문번호</th>
                      <th className="text-left py-2 px-2">수취인</th>
                      <th className="text-left py-2 px-2">상품명</th>
                      <th className="text-right py-2 px-2">수량</th>
                      <th className="text-center py-2 px-2">액션</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unregOrders.map((o: any) => (
                      <tr key={o.id} className="border-b">
                        <td className="py-2 px-2 font-mono text-xs">{o.id}</td>
                        <td className="py-2 px-2">{o.recipientName}</td>
                        <td className="py-2 px-2">{o.productName}</td>
                        <td className="py-2 px-2 text-right">{o.quantity || 1}</td>
                        <td className="py-2 px-2 text-center">
                          <Button size="sm" onClick={() => openTrackingDialog(o)} data-testid={`button-register-${o.id}`}>
                            <ScanBarcode className="h-3 w-3 mr-1" />등록
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="md:hidden space-y-2">
                {unregOrders.map((o: any) => (
                  <Card key={o.id}>
                    <CardContent className="p-3 flex justify-between items-center">
                      <div>
                        <div className="text-sm font-medium">{o.productName} x{o.quantity || 1}</div>
                        <div className="text-xs text-muted-foreground">{o.recipientName} | {o.id}</div>
                      </div>
                      <Button size="sm" onClick={() => openTrackingDialog(o)}>등록</Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {regOrders.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              등록 완료 ({regOrders.length}건)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2">주문번호</th>
                    <th className="text-left py-2 px-2">수취인</th>
                    <th className="text-left py-2 px-2">택배사</th>
                    <th className="text-left py-2 px-2">운송장번호</th>
                    <th className="text-center py-2 px-2">수정</th>
                  </tr>
                </thead>
                <tbody>
                  {regOrders.map((o: any) => (
                    <tr key={o.id} className="border-b">
                      <td className="py-2 px-2 font-mono text-xs">{o.id}</td>
                      <td className="py-2 px-2">{o.recipientName}</td>
                      <td className="py-2 px-2">{o.courierCompany}</td>
                      <td className="py-2 px-2 font-mono text-xs">{o.trackingNumber}</td>
                      <td className="py-2 px-2 text-center">
                        <Button size="sm" variant="outline" onClick={() => openTrackingDialog(o)}>수정</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!trackingTarget} onOpenChange={(open) => { if (!open) setTrackingTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>운송장 {trackingTarget?.trackingNumber ? "수정" : "등록"}</DialogTitle>
          </DialogHeader>
          {trackingTarget && (
            <div className="space-y-4">
              <div className="text-sm space-y-1">
                <div><span className="text-muted-foreground">주문번호:</span> {trackingTarget.id}</div>
                <div><span className="text-muted-foreground">수취인:</span> {trackingTarget.recipientName}</div>
                <div><span className="text-muted-foreground">상품:</span> {trackingTarget.productName}</div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">택배사</label>
                <select
                  className="w-full h-9 px-3 rounded-md border text-sm bg-background"
                  value={courierCompany}
                  onChange={(e) => setCourierCompany(e.target.value)}
                  data-testid="select-courier"
                >
                  {courierOptions.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">운송장 번호</label>
                <Input
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="운송장 번호를 입력하세요"
                  data-testid="input-tracking-number"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setTrackingTarget(null)}>취소</Button>
            <Button onClick={handleTrackingSubmit} disabled={trackingMutation.isPending} data-testid="button-submit-tracking">
              {trackingMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
