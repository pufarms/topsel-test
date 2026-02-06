import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSSE } from "@/hooks/use-sse";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileDown, FileUp, Loader2, ChevronLeft, ChevronRight, RotateCcw, ChevronDown, CheckCircle2, XCircle, AlertTriangle, Eraser, Send } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import OrderStatsBanner from "@/components/order-stats-banner";
import { AdminCategoryFilter, useAdminCategoryFilter, type AdminCategoryFilterState } from "@/components/admin-category-filter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { PendingOrder } from "@shared/schema";

export default function OrdersPreparingPage() {
  const { toast } = useToast();
  useSSE();

  const [filters, setFilters] = useState<AdminCategoryFilterState>({
    memberId: "",
    categoryLarge: "",
    categoryMedium: "",
    categorySmall: "",
    searchFilter: "선택 없음",
    searchTerm: "",
  });
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [tablePageSize, setTablePageSize] = useState<number | "all">(30);
  const [currentPage, setCurrentPage] = useState(1);
  const [showRestoreSelectedDialog, setShowRestoreSelectedDialog] = useState(false);
  const [showRestoreAllDialog, setShowRestoreAllDialog] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadFormat, setDownloadFormat] = useState<"default" | "lotte" | "postoffice">("default");
  const [uploadFormatFilter, setUploadFormatFilter] = useState<"all" | "default" | "postoffice">("all");
  
  // 운송장 업로드 관련 상태
  const [showResetSelectedDialog, setShowResetSelectedDialog] = useState(false);
  const [showResetFilteredDialog, setShowResetFilteredDialog] = useState(false);
  const [isResettingWaybill, setIsResettingWaybill] = useState(false);
  
  const [showTransferAllDialog, setShowTransferAllDialog] = useState(false);
  const [showTransferFilteredDialog, setShowTransferFilteredDialog] = useState(false);
  const [showTransferSelectedDialog, setShowTransferSelectedDialog] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  
  const [showWaybillUploadDialog, setShowWaybillUploadDialog] = useState(false);
  const [waybillCourier, setWaybillCourier] = useState<"lotte" | "postoffice">("lotte");
  const [waybillFile, setWaybillFile] = useState<File | null>(null);
  const [isUploadingWaybill, setIsUploadingWaybill] = useState(false);
  const [showWaybillResultDialog, setShowWaybillResultDialog] = useState(false);
  const [waybillUploadResult, setWaybillUploadResult] = useState<{
    success: number;
    failed: number;
    skipped: number;
    details: Array<{ orderNumber: string; trackingNumber: string; status: "success" | "failed" | "skipped"; reason?: string }>;
  } | null>(null);

  const { data: allPendingOrders = [], isLoading } = useQuery<PendingOrder[]>({
    queryKey: ["/api/admin/pending-orders"],
  });

  const restoreToWaitingMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const results = await Promise.all(
        ids.map(id => 
          apiRequest("PATCH", `/api/admin/pending-orders/${id}`, { status: "대기" })
        )
      );
      return results;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/materials"] });
      queryClient.invalidateQueries({ queryKey: ["/api/order-stats"] });
      setSelectedOrders([]);
      toast({ 
        title: "주문대기 복구 완료", 
        description: `${variables.length}건의 주문이 주문대기 상태로 복구되었습니다. 재고도 복구되었습니다.` 
      });
    },
    onError: () => {
      toast({ title: "복구 실패", description: "주문 복구 중 오류가 발생했습니다.", variant: "destructive" });
    },
  });

  // 상품준비중 페이지는 "상품준비중" 상태만 표시
  const preparingOrders = allPendingOrders.filter(o => o.status === "상품준비중");

  const getFields = useCallback((order: PendingOrder) => ({
    memberId: order.memberId || undefined,
    categoryLarge: order.categoryLarge || undefined,
    categoryMedium: order.categoryMedium || undefined,
    categorySmall: order.categorySmall || undefined,
    ordererName: order.ordererName || undefined,
    recipientName: order.recipientName || undefined,
    productName: order.productName || undefined,
    productCode: order.productCode || undefined,
  }), []);

  const categoryFilteredOrders = useAdminCategoryFilter(preparingOrders, filters, getFields);
  
  // 업로드 양식 필터 적용
  const filteredOrders = uploadFormatFilter === "all" 
    ? categoryFilteredOrders 
    : categoryFilteredOrders.filter(o => (o.uploadFormat || "default") === uploadFormatFilter);
  
  const totalPages = tablePageSize === "all" ? 1 : Math.ceil(filteredOrders.length / tablePageSize);
  const displayedOrders = tablePageSize === "all" 
    ? filteredOrders 
    : filteredOrders.slice((currentPage - 1) * tablePageSize, currentPage * tablePageSize);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    setSelectedOrders([]);
  };

  const handleDownload = async (format: "default" | "lotte" | "postoffice") => {
    const orderIds = selectedOrders.length > 0 ? selectedOrders : filteredOrders.map(o => o.id);
    
    if (orderIds.length === 0) {
      toast({ title: "다운로드할 주문이 없습니다.", variant: "destructive" });
      return;
    }
    
    setIsDownloading(true);
    try {

      const response = await fetch(`/api/admin/orders/download-preparing?format=${format}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds }),
      });

      if (!response.ok) {
        throw new Error("다운로드 실패");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const formatName = format === "postoffice" ? "우체국" : format === "lotte" ? "롯데" : "기본";
      const fileExt = format === "postoffice" ? "xls" : "xlsx";
      a.download = `상품준비중_${formatName}_${new Date().toISOString().slice(0, 10)}.${fileExt}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({ title: "다운로드 완료", description: `${orderIds.length}건 다운로드 (${formatName} 양식)` });
    } catch (error) {
      toast({ title: "다운로드 실패", description: "엑셀 다운로드 중 오류가 발생했습니다.", variant: "destructive" });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedOrders(displayedOrders.map(o => o.id));
    } else {
      setSelectedOrders([]);
    }
  };

  const handleSelectOrder = (orderId: string, checked: boolean) => {
    if (checked) {
      setSelectedOrders([...selectedOrders, orderId]);
    } else {
      setSelectedOrders(selectedOrders.filter(id => id !== orderId));
    }
  };

  const handleRestoreSelected = () => {
    setShowRestoreSelectedDialog(false);
    restoreToWaitingMutation.mutate(selectedOrders);
  };

  const handleRestoreAll = () => {
    setShowRestoreAllDialog(false);
    const allIds = filteredOrders.map(o => o.id);
    restoreToWaitingMutation.mutate(allIds);
  };

  const selectedWithTracking = selectedOrders.filter(id => {
    const order = preparingOrders.find(o => o.id === id);
    return order?.trackingNumber;
  });

  const filteredWithTracking = filteredOrders.filter(o => o.trackingNumber);

  const handleResetSelectedWaybill = async () => {
    setShowResetSelectedDialog(false);
    setIsResettingWaybill(true);
    try {
      const res = await apiRequest("POST", "/api/admin/orders/reset-waybill", {
        mode: "selected",
        orderIds: selectedWithTracking.length > 0 ? selectedWithTracking : selectedOrders,
      });
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-orders"] });
      setSelectedOrders([]);
      toast({ title: "운송장 초기화 완료", description: data.message });
    } catch (error) {
      toast({ title: "초기화 실패", description: "운송장 초기화 중 오류가 발생했습니다.", variant: "destructive" });
    } finally {
      setIsResettingWaybill(false);
    }
  };

  const handleResetFilteredWaybill = async () => {
    setShowResetFilteredDialog(false);
    setIsResettingWaybill(true);
    try {
      const res = await apiRequest("POST", "/api/admin/orders/reset-waybill", {
        mode: "filtered",
        filters: {
          memberId: filters.memberId || undefined,
          categoryLarge: filters.categoryLarge || undefined,
          categoryMedium: filters.categoryMedium || undefined,
          categorySmall: filters.categorySmall || undefined,
          search: filters.searchTerm || undefined,
        },
      });
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-orders"] });
      setSelectedOrders([]);
      toast({ title: "운송장 초기화 완료", description: data.message });
    } catch (error) {
      toast({ title: "초기화 실패", description: "운송장 초기화 중 오류가 발생했습니다.", variant: "destructive" });
    } finally {
      setIsResettingWaybill(false);
    }
  };

  const allWithTracking = preparingOrders.filter(o => o.trackingNumber);
  const filteredWithTrackingForTransfer = filteredOrders.filter(o => o.trackingNumber);
  const selectedWithTrackingForTransfer = selectedOrders.filter(id => {
    const order = preparingOrders.find(o => o.id === id);
    return order?.trackingNumber;
  });

  const handleTransferAll = async () => {
    setShowTransferAllDialog(false);
    setIsTransferring(true);
    try {
      const res = await apiRequest("POST", "/api/admin/orders/to-ready-to-ship", {
        mode: "all",
      });
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-orders"] });
      setSelectedOrders([]);
      toast({ title: "전송 완료", description: data.message });
    } catch (error: any) {
      const errMsg = error?.message || "배송준비중 전송 중 오류가 발생했습니다.";
      toast({ title: "전송 실패", description: errMsg, variant: "destructive" });
    } finally {
      setIsTransferring(false);
    }
  };

  const handleTransferFiltered = async () => {
    setShowTransferFilteredDialog(false);
    setIsTransferring(true);
    try {
      const res = await apiRequest("POST", "/api/admin/orders/to-ready-to-ship", {
        mode: "filtered",
        filters: {
          memberId: filters.memberId || undefined,
          categoryLarge: filters.categoryLarge || undefined,
          categoryMedium: filters.categoryMedium || undefined,
          categorySmall: filters.categorySmall || undefined,
          search: filters.searchTerm || undefined,
        },
      });
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-orders"] });
      setSelectedOrders([]);
      toast({ title: "전송 완료", description: data.message });
    } catch (error: any) {
      const errMsg = error?.message || "배송준비중 전송 중 오류가 발생했습니다.";
      toast({ title: "전송 실패", description: errMsg, variant: "destructive" });
    } finally {
      setIsTransferring(false);
    }
  };

  const handleTransferSelected = async () => {
    setShowTransferSelectedDialog(false);
    setIsTransferring(true);
    try {
      const res = await apiRequest("POST", "/api/admin/orders/to-ready-to-ship", {
        mode: "selected",
        orderIds: selectedOrders,
      });
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-orders"] });
      setSelectedOrders([]);
      toast({ title: "전송 완료", description: data.message });
    } catch (error: any) {
      const errMsg = error?.message || "배송준비중 전송 중 오류가 발생했습니다.";
      toast({ title: "전송 실패", description: errMsg, variant: "destructive" });
    } finally {
      setIsTransferring(false);
    }
  };

  // 운송장 업로드 처리
  const handleWaybillUpload = async () => {
    if (!waybillFile) {
      toast({ title: "파일을 선택해주세요", variant: "destructive" });
      return;
    }

    setIsUploadingWaybill(true);
    try {
      const formData = new FormData();
      formData.append("file", waybillFile);
      formData.append("courier", waybillCourier);

      const response = await fetch("/api/admin/orders/upload-waybill", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "업로드 실패");
      }

      const result = await response.json();
      setWaybillUploadResult(result);
      setShowWaybillUploadDialog(false);
      setShowWaybillResultDialog(true);
      setWaybillFile(null);
      
      // 데이터 새로고침
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-orders"] });
      
    } catch (error: any) {
      toast({ 
        title: "운송장 업로드 실패", 
        description: error.message || "파일 처리 중 오류가 발생했습니다.", 
        variant: "destructive" 
      });
    } finally {
      setIsUploadingWaybill(false);
    }
  };

  const handleOpenWaybillDialog = () => {
    setWaybillFile(null);
    setShowWaybillUploadDialog(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">상품준비중</h1>
      </div>

      <OrderStatsBanner />

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>상품준비중 목록</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 overflow-hidden">
          <AdminCategoryFilter
            onFilterChange={setFilters}
            searchPlaceholder="검색어를 입력하세요"
          />

          <div className="flex items-center gap-2 flex-wrap bg-orange-50 dark:bg-orange-900/30 p-2 rounded-md border border-orange-200 dark:border-orange-800">
            <span className="text-sm font-semibold text-orange-700 dark:text-orange-300">업로드양식 선택:</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="default" className="bg-orange-500 hover:bg-orange-600 text-white" data-testid="button-upload-format-filter">
                  {uploadFormatFilter === "all" ? "전체" : uploadFormatFilter === "postoffice" ? "우체국" : "기본"}
                  <ChevronDown className="h-4 w-4 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem 
                  onClick={() => { setUploadFormatFilter("all"); setCurrentPage(1); }}
                  data-testid="menu-upload-filter-all"
                >
                  전체
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => { setUploadFormatFilter("default"); setCurrentPage(1); }}
                  data-testid="menu-upload-filter-default"
                >
                  기본 양식
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => { setUploadFormatFilter("postoffice"); setCurrentPage(1); }}
                  data-testid="menu-upload-filter-postoffice"
                >
                  우체국 양식
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" data-testid="button-select-format">
                    다운양식선택: {downloadFormat === "postoffice" ? "우체국 양식" : downloadFormat === "lotte" ? "롯데 양식" : "기본 양식"}
                    <ChevronDown className="h-4 w-4 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem 
                    onClick={() => setDownloadFormat("default")}
                    data-testid="menu-format-default"
                  >
                    기본 양식 (.xlsx)
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => setDownloadFormat("lotte")}
                    data-testid="menu-format-lotte"
                  >
                    롯데 양식 (.xlsx)
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => setDownloadFormat("postoffice")}
                    data-testid="menu-format-postoffice"
                  >
                    우체국 양식 (.xls)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                size="sm"
                variant="default"
                disabled={isDownloading}
                onClick={() => handleDownload(downloadFormat)}
                data-testid="button-download-orders"
              >
                {isDownloading ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <FileDown className="h-4 w-4 mr-1" />
                )}
                다운로드
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleOpenWaybillDialog}
                className="bg-blue-50 hover:bg-blue-100 border-blue-300 text-blue-700"
                data-testid="button-upload-waybill"
              >
                <FileUp className="h-4 w-4 mr-1" />
                운송장 업로드
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isResettingWaybill}
                    className="bg-orange-50 border-orange-300 text-orange-700"
                    data-testid="button-reset-waybill-dropdown"
                  >
                    {isResettingWaybill ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Eraser className="h-4 w-4 mr-1" />
                    )}
                    운송장 초기화
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem
                    disabled={selectedOrders.length === 0}
                    onClick={() => setShowResetSelectedDialog(true)}
                    data-testid="button-reset-waybill-selected"
                  >
                    <Eraser className="h-4 w-4 mr-2" />
                    선택 초기화 ({selectedWithTracking.length > 0 ? selectedWithTracking.length : selectedOrders.length}건)
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={filteredWithTracking.length === 0}
                    onClick={() => setShowResetFilteredDialog(true)}
                    data-testid="button-reset-waybill-filtered"
                  >
                    <Eraser className="h-4 w-4 mr-2" />
                    필터 전체 초기화 ({filteredWithTracking.length}건)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                size="sm"
                variant="outline"
                disabled={selectedOrders.length === 0 || restoreToWaitingMutation.isPending}
                onClick={() => setShowRestoreSelectedDialog(true)}
                data-testid="button-restore-selected"
              >
                {restoreToWaitingMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4 mr-1" />
                )}
                선택 복구 ({selectedOrders.length})
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={filteredOrders.length === 0 || restoreToWaitingMutation.isPending}
                onClick={() => setShowRestoreAllDialog(true)}
                data-testid="button-restore-all"
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                필터 전체 복구 ({filteredOrders.length})
              </Button>
              <span className="text-sm text-muted-foreground">
                {displayedOrders.length} / {filteredOrders.length}건
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm">표시 개수:</span>
              <select 
                className="h-8 px-2 border rounded text-sm"
                value={tablePageSize === "all" ? "all" : tablePageSize.toString()}
                onChange={(e) => {
                  setTablePageSize(e.target.value === "all" ? "all" : parseInt(e.target.value));
                  setCurrentPage(1);
                }}
                data-testid="select-page-size"
              >
                <option value="10">10개씩</option>
                <option value="30">30개씩</option>
                <option value="100">100개씩</option>
                <option value="all">전체</option>
              </select>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : displayedOrders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              상품준비중 내역이 없습니다.
            </div>
          ) : (
            <div className="border rounded-lg max-h-[400px] overflow-x-scroll">
              <div className="overflow-y-auto max-h-[383px] min-w-[1600px]">
                <Table className="w-full">
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedOrders.length === displayedOrders.length && displayedOrders.length > 0}
                        onCheckedChange={handleSelectAll}
                        data-testid="checkbox-select-all"
                      />
                    </TableHead>
                    <TableHead className="w-[100px]">주문자명</TableHead>
                    <TableHead className="w-[140px]">주문자 전화번호</TableHead>
                    <TableHead className="min-w-[200px]">주문자 주소</TableHead>
                    <TableHead className="w-[100px]">수령자명</TableHead>
                    <TableHead className="w-[140px]">수령자휴대폰번호</TableHead>
                    <TableHead className="w-[140px]">수령자 전화번호</TableHead>
                    <TableHead className="min-w-[250px]">수령자 주소</TableHead>
                    <TableHead className="min-w-[150px]">배송메시지</TableHead>
                    <TableHead className="min-w-[200px]">상품명</TableHead>
                    <TableHead className="w-[80px]">수량</TableHead>
                    <TableHead className="w-[140px]">주문번호</TableHead>
                    <TableHead className="w-[140px]">운송장번호</TableHead>
                    <TableHead className="w-[100px]">택배사</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedOrders.map((order, index) => (
                    <TableRow key={order.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedOrders.includes(order.id)}
                          onCheckedChange={(checked) => handleSelectOrder(order.id, !!checked)}
                        />
                      </TableCell>
                      <TableCell data-testid={`text-orderer-name-${order.id}`}>{order.ordererName || "-"}</TableCell>
                      <TableCell data-testid={`text-orderer-phone-${order.id}`}>{order.ordererPhone || "-"}</TableCell>
                      <TableCell className="max-w-[200px] truncate" title={order.ordererAddress || ""} data-testid={`text-orderer-address-${order.id}`}>
                        {order.ordererAddress || "-"}
                      </TableCell>
                      <TableCell data-testid={`text-recipient-name-${order.id}`}>{order.recipientName || "-"}</TableCell>
                      <TableCell data-testid={`text-recipient-mobile-${order.id}`}>{order.recipientMobile || "-"}</TableCell>
                      <TableCell data-testid={`text-recipient-phone-${order.id}`}>{order.recipientPhone || "-"}</TableCell>
                      <TableCell className="max-w-[250px] truncate" title={order.recipientAddress || ""} data-testid={`text-recipient-address-${order.id}`}>
                        {order.recipientAddress || "-"}
                      </TableCell>
                      <TableCell data-testid={`text-delivery-message-${order.id}`}>
                        {order.deliveryMessage 
                          ? order.deliveryMessage.replace(/\s*\[주소확인필요:[^\]]*\]/g, "").trim() || "-"
                          : "-"}
                      </TableCell>
                      <TableCell data-testid={`text-product-name-${order.id}`}>{order.productName || "-"}</TableCell>
                      <TableCell data-testid={`text-quantity-${order.id}`}>1</TableCell>
                      <TableCell className="font-mono text-sm" data-testid={`text-order-number-${order.id}`}>{order.customOrderNumber || "-"}</TableCell>
                      <TableCell className="font-mono text-sm" data-testid={`text-tracking-number-${order.id}`}>
                        {order.trackingNumber || "-"}
                      </TableCell>
                      <TableCell data-testid={`text-courier-${order.id}`}>{order.courierCompany || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </div>
          )}

          {tablePageSize !== "all" && totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button
                size="sm"
                variant="outline"
                disabled={currentPage === 1}
                onClick={() => handlePageChange(currentPage - 1)}
                data-testid="button-prev-page"
              >
                <ChevronLeft className="h-4 w-4" />
                이전
              </Button>
              <span className="text-sm text-muted-foreground px-2">
                {currentPage} / {totalPages} 페이지
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={currentPage === totalPages}
                onClick={() => handlePageChange(currentPage + 1)}
                data-testid="button-next-page"
              >
                다음
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          <div className="border-t pt-4 mt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm font-medium text-muted-foreground">
                운송장 등록 주문건 배송준비중으로 전송
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="default"
                  disabled={allWithTracking.length === 0 || isTransferring}
                  onClick={() => setShowTransferAllDialog(true)}
                  data-testid="button-transfer-all"
                >
                  {isTransferring ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-1" />
                  )}
                  전체 일괄전송 ({allWithTracking.length}건)
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={filteredWithTrackingForTransfer.length === 0 || isTransferring}
                  onClick={() => setShowTransferFilteredDialog(true)}
                  data-testid="button-transfer-filtered"
                >
                  {isTransferring ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-1" />
                  )}
                  검색건 일괄전송 ({filteredWithTrackingForTransfer.length}건)
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={selectedWithTrackingForTransfer.length === 0 || isTransferring}
                  onClick={() => setShowTransferSelectedDialog(true)}
                  data-testid="button-transfer-selected"
                >
                  {isTransferring ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-1" />
                  )}
                  선택 전송 ({selectedWithTrackingForTransfer.length}건)
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 전체 일괄전송 확인 */}
      <AlertDialog open={showTransferAllDialog} onOpenChange={setShowTransferAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>전체 일괄전송</AlertDialogTitle>
            <AlertDialogDescription>
              운송장이 등록된 전체 {allWithTracking.length}건의 주문을 배송준비중으로 전송하시겠습니까?
              <br /><br />
              <strong>전송 조건:</strong>
              <ul className="list-disc list-inside mt-2 text-left">
                <li>운송장번호가 등록된 주문만 전송됩니다.</li>
                <li>전송 후 주문 상태가 "상품준비중" → "배송준비중"으로 변경됩니다.</li>
                <li>배송준비중 페이지에서 확인할 수 있습니다.</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-transfer-all-cancel">취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleTransferAll} data-testid="button-transfer-all-confirm">
              전체 전송 실행
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 검색건 일괄전송 확인 */}
      <AlertDialog open={showTransferFilteredDialog} onOpenChange={setShowTransferFilteredDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>검색건 일괄전송</AlertDialogTitle>
            <AlertDialogDescription>
              현재 검색 조건에 해당하는 운송장 등록 {filteredWithTrackingForTransfer.length}건의 주문을 배송준비중으로 전송하시겠습니까?
              <br /><br />
              <strong>전송 조건:</strong>
              <ul className="list-disc list-inside mt-2 text-left">
                <li>현재 검색/필터 조건에 해당하는 주문 중 운송장번호가 등록된 주문만 전송됩니다.</li>
                <li>전송 후 주문 상태가 "상품준비중" → "배송준비중"으로 변경됩니다.</li>
                <li>배송준비중 페이지에서 확인할 수 있습니다.</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-transfer-filtered-cancel">취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleTransferFiltered} data-testid="button-transfer-filtered-confirm">
              검색건 전송 실행
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 선택 전송 확인 */}
      <AlertDialog open={showTransferSelectedDialog} onOpenChange={setShowTransferSelectedDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>선택 전송</AlertDialogTitle>
            <AlertDialogDescription>
              선택한 주문 중 운송장이 등록된 {selectedWithTrackingForTransfer.length}건의 주문을 배송준비중으로 전송하시겠습니까?
              {selectedOrders.length > selectedWithTrackingForTransfer.length && (
                <>
                  <br /><br />
                  <strong className="text-orange-600">
                    선택한 {selectedOrders.length}건 중 운송장이 없는 {selectedOrders.length - selectedWithTrackingForTransfer.length}건은 전송되지 않습니다.
                  </strong>
                </>
              )}
              <br /><br />
              <strong>전송 조건:</strong>
              <ul className="list-disc list-inside mt-2 text-left">
                <li>운송장번호가 등록된 주문만 전송됩니다.</li>
                <li>전송 후 주문 상태가 "상품준비중" → "배송준비중"으로 변경됩니다.</li>
                <li>배송준비중 페이지에서 확인할 수 있습니다.</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-transfer-selected-cancel">취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleTransferSelected} data-testid="button-transfer-selected-confirm">
              선택 전송 실행
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showRestoreSelectedDialog} onOpenChange={setShowRestoreSelectedDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>선택 주문 복구</AlertDialogTitle>
            <AlertDialogDescription>
              선택한 {selectedOrders.length}건의 주문을 주문대기 상태로 복구하시겠습니까?
              <br /><br />
              <strong>복구 시 발생하는 변경사항:</strong>
              <ul className="list-disc list-inside mt-2 text-left">
                <li>주문 상태가 "상품준비중" → "대기"로 변경됩니다.</li>
                <li>해당 주문의 원재료 재고가 자동으로 복구됩니다.</li>
                <li>복구된 주문은 다시 주문조정 단계를 거쳐야 합니다.</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-restore-selected-cancel">취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestoreSelected} data-testid="button-restore-selected-confirm">
              복구 실행
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showRestoreAllDialog} onOpenChange={setShowRestoreAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>전체 주문 복구</AlertDialogTitle>
            <AlertDialogDescription>
              현재 목록의 {filteredOrders.length}건의 주문을 모두 주문대기 상태로 복구하시겠습니까?
              <br /><br />
              <strong>복구 시 발생하는 변경사항:</strong>
              <ul className="list-disc list-inside mt-2 text-left">
                <li>모든 주문 상태가 "상품준비중" → "대기"로 변경됩니다.</li>
                <li>모든 주문의 원재료 재고가 자동으로 복구됩니다.</li>
                <li>복구된 주문은 다시 주문조정 단계를 거쳐야 합니다.</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-restore-all-cancel">취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestoreAll} data-testid="button-restore-all-confirm">
              전체 복구 실행
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 운송장 선택 초기화 확인 */}
      <AlertDialog open={showResetSelectedDialog} onOpenChange={setShowResetSelectedDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>선택 운송장 초기화</AlertDialogTitle>
            <AlertDialogDescription>
              선택한 주문 중 운송장이 등록된 {selectedWithTracking.length > 0 ? selectedWithTracking.length : selectedOrders.length}건의 운송장번호와 택배사 정보를 초기화하시겠습니까?
              <br /><br />
              <strong>초기화 후:</strong>
              <ul className="list-disc list-inside mt-2 text-left">
                <li>운송장번호와 택배사 정보가 삭제됩니다.</li>
                <li>주문 상태는 "상품준비중"으로 유지됩니다.</li>
                <li>새 운송장 파일을 다시 업로드할 수 있습니다.</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-reset-selected-cancel">취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetSelectedWaybill} data-testid="button-reset-selected-confirm">
              초기화 실행
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 운송장 필터 전체 초기화 확인 */}
      <AlertDialog open={showResetFilteredDialog} onOpenChange={setShowResetFilteredDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>필터 전체 운송장 초기화</AlertDialogTitle>
            <AlertDialogDescription>
              현재 검색 조건에 해당하는 {filteredWithTracking.length}건의 운송장번호와 택배사 정보를 모두 초기화하시겠습니까?
              <br /><br />
              <strong>초기화 후:</strong>
              <ul className="list-disc list-inside mt-2 text-left">
                <li>해당 주문의 운송장번호와 택배사 정보가 삭제됩니다.</li>
                <li>주문 상태는 "상품준비중"으로 유지됩니다.</li>
                <li>새 운송장 파일을 다시 업로드할 수 있습니다.</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-reset-filtered-cancel">취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetFilteredWaybill} data-testid="button-reset-filtered-confirm">
              전체 초기화 실행
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 운송장 업로드 다이얼로그 */}
      <Dialog open={showWaybillUploadDialog} onOpenChange={setShowWaybillUploadDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>운송장 파일 업로드</DialogTitle>
            <DialogDescription>
              택배사를 선택하고 운송장 파일을 업로드하세요.
              주문번호와 운송장번호가 자동으로 매핑됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>택배사 선택</Label>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300" data-testid="badge-selected-courier">
                  {waybillCourier === "lotte" ? "롯데택배" : "우체국택배"} 선택됨
                </Badge>
              </div>
              <RadioGroup
                value={waybillCourier}
                onValueChange={(value) => setWaybillCourier(value as "lotte" | "postoffice")}
                className="flex gap-4"
              >
                <div 
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md cursor-pointer border transition-colors ${waybillCourier === "lotte" ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:bg-gray-50"}`}
                  onClick={() => setWaybillCourier("lotte")}
                  data-testid="option-courier-lotte"
                >
                  <RadioGroupItem value="lotte" id="courier-lotte" data-testid="radio-courier-lotte" />
                  <Label htmlFor="courier-lotte" className="font-normal cursor-pointer">롯데택배</Label>
                </div>
                <div 
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md cursor-pointer border transition-colors ${waybillCourier === "postoffice" ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:bg-gray-50"}`}
                  onClick={() => setWaybillCourier("postoffice")}
                  data-testid="option-courier-postoffice"
                >
                  <RadioGroupItem value="postoffice" id="courier-postoffice" data-testid="radio-courier-postoffice" />
                  <Label htmlFor="courier-postoffice" className="font-normal cursor-pointer">우체국택배</Label>
                </div>
              </RadioGroup>
            </div>
            <div className="space-y-2">
              <Label>파일 선택</Label>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => setWaybillFile(e.target.files?.[0] || null)}
                  className="flex-1 text-sm file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  data-testid="input-waybill-file"
                />
              </div>
              {waybillFile && (
                <p className="text-sm text-muted-foreground">
                  선택된 파일: {waybillFile.name}
                </p>
              )}
            </div>
            <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-800 border border-amber-200">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">주의사항</p>
                  <ul className="list-disc list-inside mt-1 text-xs space-y-1">
                    <li>롯데택배: 주문번호(10번째), 운송장번호(7번째) 컬럼 사용</li>
                    <li>우체국택배: 주문번호(21번째), 등기번호(2번째) 컬럼 사용</li>
                    <li>동일 주문번호가 여러 건인 경우 순서대로 매핑됩니다.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowWaybillUploadDialog(false)}
              data-testid="button-waybill-cancel"
            >
              취소
            </Button>
            <Button
              onClick={handleWaybillUpload}
              disabled={!waybillFile || isUploadingWaybill}
              data-testid="button-waybill-upload-confirm"
            >
              {isUploadingWaybill ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  처리중...
                </>
              ) : (
                <>
                  <FileUp className="h-4 w-4 mr-1" />
                  업로드
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 운송장 업로드 결과 다이얼로그 */}
      <Dialog open={showWaybillResultDialog} onOpenChange={setShowWaybillResultDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>운송장 업로드 결과</DialogTitle>
            <DialogDescription>
              운송장 파일 처리가 완료되었습니다.
            </DialogDescription>
          </DialogHeader>
          {waybillUploadResult && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-lg bg-green-50 p-3 text-center border border-green-200">
                  <CheckCircle2 className="h-6 w-6 text-green-600 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-green-700">{waybillUploadResult.success}</p>
                  <p className="text-xs text-green-600">성공</p>
                </div>
                <div className="rounded-lg bg-red-50 p-3 text-center border border-red-200">
                  <XCircle className="h-6 w-6 text-red-600 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-red-700">{waybillUploadResult.failed}</p>
                  <p className="text-xs text-red-600">실패</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3 text-center border border-gray-200">
                  <AlertTriangle className="h-6 w-6 text-gray-500 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-gray-700">{waybillUploadResult.skipped}</p>
                  <p className="text-xs text-gray-600">스킵</p>
                </div>
              </div>
              
              {waybillUploadResult.details.length > 0 && (
                <div className="space-y-2">
                  <Label>상세 내역</Label>
                  <ScrollArea className="h-[200px] rounded-md border p-2">
                    <div className="space-y-1">
                      {waybillUploadResult.details.map((item, index) => (
                        <div key={index} className={`flex items-center justify-between text-sm px-2 py-1 rounded ${
                          item.status === "success" ? "bg-green-50" :
                          item.status === "failed" ? "bg-red-50" : "bg-gray-50"
                        }`}>
                          <div className="flex items-center gap-2">
                            {item.status === "success" && <CheckCircle2 className="h-3 w-3 text-green-600" />}
                            {item.status === "failed" && <XCircle className="h-3 w-3 text-red-600" />}
                            {item.status === "skipped" && <AlertTriangle className="h-3 w-3 text-gray-500" />}
                            <span className="font-mono text-xs">{item.orderNumber || "-"}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="font-mono">{item.trackingNumber || "-"}</span>
                            {item.reason && <span className="text-red-600">({item.reason})</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowWaybillResultDialog(false)} data-testid="button-waybill-result-close">
              확인
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
