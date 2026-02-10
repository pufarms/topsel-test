import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Download, Upload, ChevronLeft, ChevronRight, CheckCircle, Package, Truck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";

interface OrdersResponse {
  orders: any[];
  total: number;
  page: number;
  limit: number;
  statusCounts: Record<string, number>;
}

interface TrackingEntry {
  customOrderNumber: string;
  courierCompany: string;
  trackingNumber: string;
}

function cleanDeliveryMessage(msg: string | null | undefined): string {
  if (!msg) return "";
  return msg.replace(/\[주소확인필요:[^\]]*\]/g, "").trim();
}

function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const cleaned = phone.replace(/[^0-9-]/g, "");
  if (cleaned && !cleaned.startsWith("0")) {
    return "0" + cleaned;
  }
  return cleaned;
}

const statusBadge: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  "상품준비중": { label: "상품준비중", variant: "outline" },
  "배송준비중": { label: "배송준비중", variant: "secondary" },
  "배송중": { label: "배송중", variant: "default" },
};

function OrderTable({ orders, uploadedTracking }: { orders: any[]; uploadedTracking?: Map<string, TrackingEntry> }) {
  const getTrackingDisplay = (order: any) => {
    if (uploadedTracking) {
      const uploaded = uploadedTracking.get(order.customOrderNumber);
      if (uploaded) return { trackingNumber: uploaded.trackingNumber, courierCompany: uploaded.courierCompany, isUploaded: true };
    }
    return { trackingNumber: order.trackingNumber || "", courierCompany: order.courierCompany || "", isUploaded: false };
  };

  return (
    <>
      <div className="hidden md:block border rounded-md overflow-x-auto" style={{ maxWidth: "100%" }}>
        <table className="text-sm" style={{ minWidth: "1800px", width: "1800px" }}>
          <thead className="sticky top-0 z-10">
            <tr className="border-b bg-muted/30">
              <th className="text-left py-2 px-2 whitespace-nowrap">주문자명</th>
              <th className="text-left py-2 px-2 whitespace-nowrap">주문자 전화번호</th>
              <th className="text-left py-2 px-2 whitespace-nowrap">주문자 주소</th>
              <th className="text-left py-2 px-2 whitespace-nowrap">수령자명</th>
              <th className="text-left py-2 px-2 whitespace-nowrap">수령자 휴대폰번호</th>
              <th className="text-left py-2 px-2 whitespace-nowrap">수령자 전화번호</th>
              <th className="text-left py-2 px-2 whitespace-nowrap">수령자 주소</th>
              <th className="text-left py-2 px-2 whitespace-nowrap">배송메시지</th>
              <th className="text-left py-2 px-2 whitespace-nowrap">상품코드</th>
              <th className="text-left py-2 px-2 whitespace-nowrap">상품명</th>
              <th className="text-right py-2 px-2 whitespace-nowrap">수량</th>
              <th className="text-left py-2 px-2 whitespace-nowrap">주문번호</th>
              <th className="text-left py-2 px-2 whitespace-nowrap">운송장번호</th>
              <th className="text-left py-2 px-2 whitespace-nowrap">택배사</th>
              <th className="text-center py-2 px-2 whitespace-nowrap">상태</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o: any) => {
              const sb = statusBadge[o.status] || { label: o.status, variant: "secondary" as const };
              const tracking = getTrackingDisplay(o);
              return (
                <tr key={o.id} className={`border-b ${tracking.isUploaded ? "bg-blue-50 dark:bg-blue-950/30" : ""}`} data-testid={`row-order-${o.id}`}>
                  <td className="py-2 px-2 whitespace-nowrap">{o.ordererName || ""}</td>
                  <td className="py-2 px-2 text-xs whitespace-nowrap">{formatPhone(o.ordererPhone)}</td>
                  <td className="py-2 px-2 text-xs whitespace-nowrap">{o.ordererAddress || ""}</td>
                  <td className="py-2 px-2 whitespace-nowrap">{o.recipientName || ""}</td>
                  <td className="py-2 px-2 text-xs whitespace-nowrap">{formatPhone(o.recipientMobile)}</td>
                  <td className="py-2 px-2 text-xs whitespace-nowrap">{formatPhone(o.recipientPhone)}</td>
                  <td className="py-2 px-2 text-xs whitespace-nowrap">{o.recipientAddress || ""}</td>
                  <td className="py-2 px-2 text-xs whitespace-nowrap">{cleanDeliveryMessage(o.deliveryMessage)}</td>
                  <td className="py-2 px-2 font-mono text-xs whitespace-nowrap">{o.productCode || ""}</td>
                  <td className="py-2 px-2 whitespace-nowrap">{o.productName || ""}</td>
                  <td className="py-2 px-2 text-right whitespace-nowrap">{o.quantity || 1}</td>
                  <td className="py-2 px-2 font-mono text-xs whitespace-nowrap">{o.customOrderNumber || ""}</td>
                  <td className={`py-2 px-2 font-mono text-xs whitespace-nowrap ${tracking.isUploaded ? "text-blue-600 dark:text-blue-400 font-semibold" : ""}`}>{tracking.trackingNumber}</td>
                  <td className={`py-2 px-2 text-xs whitespace-nowrap ${tracking.isUploaded ? "text-blue-600 dark:text-blue-400 font-semibold" : ""}`}>{tracking.courierCompany}</td>
                  <td className="py-2 px-2 text-center whitespace-nowrap"><Badge variant={sb.variant}>{sb.label}</Badge></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="md:hidden space-y-2 p-3">
        {orders.map((o: any) => {
          const sb = statusBadge[o.status] || { label: o.status, variant: "secondary" as const };
          const tracking = getTrackingDisplay(o);
          return (
            <Card key={o.id} data-testid={`card-order-${o.id}`} className={tracking.isUploaded ? "border-blue-300 dark:border-blue-700" : ""}>
              <CardContent className="p-3 space-y-1">
                <div className="flex justify-between items-start gap-2">
                  <span className="font-mono text-xs text-muted-foreground">{o.customOrderNumber}</span>
                  <Badge variant={sb.variant}>{sb.label}</Badge>
                </div>
                <div className="font-medium text-sm">{o.productName} x{o.quantity || 1}</div>
                <div className="text-xs text-muted-foreground">{o.productCode}</div>
                <div className="text-xs">주문자: {o.ordererName} {formatPhone(o.ordererPhone)}</div>
                <div className="text-xs">수령자: {o.recipientName} {formatPhone(o.recipientMobile)}</div>
                <div className="text-xs text-muted-foreground">{o.recipientAddress}</div>
                {cleanDeliveryMessage(o.deliveryMessage) && <div className="text-xs text-muted-foreground">배송메시지: {cleanDeliveryMessage(o.deliveryMessage)}</div>}
                {(tracking.trackingNumber) && (
                  <div className={`text-xs ${tracking.isUploaded ? "text-blue-600 dark:text-blue-400 font-semibold" : ""}`}>
                    운송장: {tracking.courierCompany} {tracking.trackingNumber}
                    {tracking.isUploaded && " (업로드됨)"}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}

export default function PartnerOrders() {
  const today = new Date().toISOString().split("T")[0];
  const [activeTab, setActiveTab] = useState<"orders" | "tracking">("orders");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [trackingPage, setTrackingPage] = useState(1);
  const [uploadedTracking, setUploadedTracking] = useState<Map<string, TrackingEntry>>(new Map());
  const [isUploading, setIsUploading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; totalCount: number; registerCount: number; skipCount: number }>({ open: false, totalCount: 0, registerCount: 0, skipCount: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const ordersParams = new URLSearchParams({
    startDate, endDate, status: "상품준비중", search, page: String(page), limit: "50",
  }).toString();

  const trackingParams = new URLSearchParams({
    startDate, endDate, status: "배송준비중", search, page: String(trackingPage), limit: "50",
  }).toString();

  const { data: ordersData, isLoading: ordersLoading } = useQuery<OrdersResponse>({
    queryKey: ["/api/partner/orders", "tab-orders", ordersParams],
    queryFn: async () => {
      const res = await fetch(`/api/partner/orders?${ordersParams}`, { credentials: "include" });
      if (!res.ok) throw new Error("조회 실패");
      return res.json();
    },
  });

  const { data: trackingData, isLoading: trackingLoading } = useQuery<OrdersResponse>({
    queryKey: ["/api/partner/orders", "tab-tracking", trackingParams],
    queryFn: async () => {
      const res = await fetch(`/api/partner/orders?${trackingParams}`, { credentials: "include" });
      if (!res.ok) throw new Error("조회 실패");
      return res.json();
    },
  });

  const ordersCount = ordersData?.total || 0;
  const trackingCount = trackingData?.total || 0;

  const handleDownload = () => {
    const params = new URLSearchParams({ startDate, endDate, status: "상품준비중" }).toString();
    const a = document.createElement("a");
    a.href = `/api/partner/orders/download?${params}`;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleTrackingUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws);

      const trackingMap = new Map<string, TrackingEntry>();
      let validCount = 0;
      let invalidCount = 0;

      for (const row of rows) {
        const customOrderNumber = String(row["주문번호"] || "").trim();
        const courierCompany = String(row["택배사"] || "").trim();
        const trackingNumber = String(row["운송장번호"] || "").trim();

        if (customOrderNumber && courierCompany && trackingNumber) {
          trackingMap.set(customOrderNumber, { customOrderNumber, courierCompany, trackingNumber });
          validCount++;
        } else if (customOrderNumber || courierCompany || trackingNumber) {
          invalidCount++;
        }
      }

      setUploadedTracking(trackingMap);

      toast({
        title: "운송장 업로드 완료",
        description: `${validCount}건 로드됨${invalidCount > 0 ? ` (${invalidCount}건 누락항목)` : ""}`,
      });
    } catch (error) {
      toast({
        title: "업로드 실패",
        description: "엑셀 파일을 확인해 주세요",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRegisterClick = () => {
    if (uploadedTracking.size === 0) {
      toast({ title: "등록할 운송장이 없습니다", description: "먼저 운송장 파일을 업로드해 주세요", variant: "destructive" });
      return;
    }

    const allEntries = Array.from(uploadedTracking.values());
    const withTracking = allEntries.filter(e => e.trackingNumber && e.courierCompany);
    const withoutTracking = allEntries.length - withTracking.length;

    setConfirmDialog({
      open: true,
      totalCount: allEntries.length,
      registerCount: withTracking.length,
      skipCount: withoutTracking,
    });
  };

  const handleRegisterConfirm = async () => {
    setConfirmDialog(prev => ({ ...prev, open: false }));
    setIsRegistering(true);
    try {
      const items = Array.from(uploadedTracking.values()).filter(e => e.trackingNumber && e.courierCompany);

      if (items.length === 0) {
        toast({ title: "등록할 운송장이 없습니다", description: "운송장번호와 택배사가 입력된 건이 없습니다", variant: "destructive" });
        return;
      }

      const res = await fetch("/api/partner/orders/tracking/bulk-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ trackingData: items }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "등록 실패");
      }

      const result = await res.json();
      setUploadedTracking(new Map());

      toast({
        title: "운송장 등록 완료",
        description: `성공 ${result.success}건${result.failed > 0 ? `, 실패 ${result.failed}건` : ""}`,
      });

      queryClient.invalidateQueries({ queryKey: ["/api/partner/orders"] });

      if (result.success > 0) {
        setActiveTab("tracking");
      }
    } catch (error: any) {
      toast({ title: "운송장 등록 실패", description: error.message, variant: "destructive" });
    } finally {
      setIsRegistering(false);
    }
  };

  const currentData = activeTab === "orders" ? ordersData : trackingData;
  const currentLoading = activeTab === "orders" ? ordersLoading : trackingLoading;
  const currentOrders = currentData?.orders || [];
  const currentTotal = currentData?.total || 0;
  const currentPage = activeTab === "orders" ? page : trackingPage;
  const setCurrentPage = activeTab === "orders" ? setPage : setTrackingPage;
  const totalPages = Math.ceil(currentTotal / 50);

  return (
    <div className="space-y-4 pb-20 lg:pb-0">
      <h1 className="text-xl font-bold" data-testid="text-orders-title">주문 관리</h1>

      <div className="flex gap-1 border-b">
        <button
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === "orders" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
          onClick={() => setActiveTab("orders")}
          data-testid="tab-orders"
        >
          <Package className="h-4 w-4" />
          주문현황
          <Badge variant="secondary" className="ml-1 text-xs">{ordersCount}</Badge>
        </button>
        <button
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === "tracking" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
          onClick={() => setActiveTab("tracking")}
          data-testid="tab-tracking"
        >
          <Truck className="h-4 w-4" />
          운송장등록
          <Badge variant="secondary" className="ml-1 text-xs">{trackingCount}</Badge>
        </button>
      </div>

      <Card>
        <CardContent className="p-3 space-y-3">
          <div className="flex flex-wrap gap-2 items-end">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">시작일</label>
              <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); setTrackingPage(1); }} className="w-36" data-testid="input-start-date" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">종료일</label>
              <Input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); setTrackingPage(1); }} className="w-36" data-testid="input-end-date" />
            </div>
            <div className="space-y-1 flex-1 min-w-[120px]">
              <label className="text-xs text-muted-foreground">검색</label>
              <div className="flex gap-1">
                <Input placeholder="상품명/수취인명/주문번호" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="input-search" />
              </div>
            </div>
          </div>
          {activeTab === "orders" && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-muted-foreground">총 {ordersCount}건</div>
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="outline" onClick={handleDownload} data-testid="button-download-orders">
                  <Download className="h-4 w-4 mr-1" />주문 다운로드
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleTrackingUpload}
                  data-testid="input-tracking-upload"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  data-testid="button-upload-tracking"
                >
                  {isUploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
                  운송장 업로드
                </Button>
                {uploadedTracking.size > 0 && (
                  <Badge variant="secondary">{uploadedTracking.size}건 로드됨</Badge>
                )}
              </div>
            </div>
          )}
          {activeTab === "tracking" && (
            <div className="text-xs text-muted-foreground">총 {trackingCount}건</div>
          )}
        </CardContent>
      </Card>

      {currentLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : currentOrders.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {activeTab === "orders" ? "조회된 주문이 없습니다." : "운송장 등록된 주문이 없습니다."}
          </CardContent>
        </Card>
      ) : (
        <OrderTable orders={currentOrders} uploadedTracking={activeTab === "orders" ? uploadedTracking : undefined} />
      )}

      {activeTab === "orders" && (
        <div className="flex justify-center py-4">
          <Button
            size="lg"
            onClick={handleRegisterClick}
            disabled={isRegistering || uploadedTracking.size === 0}
            className="bg-blue-600 text-white px-8"
            data-testid="button-register-tracking"
          >
            {isRegistering ? (
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            ) : (
              <CheckCircle className="h-5 w-5 mr-2" />
            )}
            운송장 등록{uploadedTracking.size > 0 ? ` (${uploadedTracking.size}건)` : ""}
          </Button>
        </div>
      )}

      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>운송장 등록 확인</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-muted-foreground">총 수량</span>
                  <span className="font-medium text-right">{confirmDialog.totalCount}건</span>
                  <span className="text-muted-foreground">등록건</span>
                  <span className="font-medium text-right text-blue-600">{confirmDialog.registerCount}건</span>
                  <span className="text-muted-foreground">미등록건</span>
                  <span className="font-medium text-right text-red-500">{confirmDialog.skipCount}건</span>
                </div>
                {confirmDialog.skipCount > 0 && (
                  <p className="text-xs text-muted-foreground">운송장번호 또는 택배사가 없는 {confirmDialog.skipCount}건은 제외됩니다.</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-register">취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleRegisterConfirm} data-testid="button-confirm-register">확인</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button size="sm" variant="outline" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">{currentPage} / {totalPages}</span>
          <Button size="sm" variant="outline" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
