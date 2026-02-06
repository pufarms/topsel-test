import { useState, useCallback, useMemo } from "react";
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
import { FileDown, Loader2, ChevronLeft, ChevronRight, Send, Bell, BanIcon } from "lucide-react";
import OrderStatsBanner from "@/components/order-stats-banner";
import { AdminCategoryFilter, useAdminCategoryFilter, type AdminCategoryFilterState } from "@/components/admin-category-filter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { DateRangeFilter, useDateRange } from "@/components/common/DateRangeFilter";
import type { PendingOrder } from "@shared/schema";

export default function OrdersReadyToShipPage() {
  useSSE();
  const { toast } = useToast();

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

  const { dateRange, setDateRange } = useDateRange("today");

  const [showTransferAllDialog, setShowTransferAllDialog] = useState(false);
  const [showTransferFilteredDialog, setShowTransferFilteredDialog] = useState(false);
  const [showTransferSelectedDialog, setShowTransferSelectedDialog] = useState(false);
  const [showDeliverDialog, setShowDeliverDialog] = useState(false);
  const [showCancelDeadlineDialog, setShowCancelDeadlineDialog] = useState(false);

  const { data: allPendingOrders = [], isLoading } = useQuery<PendingOrder[]>({
    queryKey: ["/api/admin/pending-orders", dateRange.startDate, dateRange.endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateRange.startDate) params.set("startDate", dateRange.startDate);
      if (dateRange.endDate) params.set("endDate", dateRange.endDate);
      const res = await fetch(`/api/admin/pending-orders?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: deliveryStatus } = useQuery<{ waybillDelivered: boolean; cancelDeadlineClosed: boolean }>({
    queryKey: ["/api/admin/ready-to-ship-status"],
  });

  const waybillDelivered = deliveryStatus?.waybillDelivered ?? false;
  const cancelDeadlineClosed = deliveryStatus?.cancelDeadlineClosed ?? false;

  const readyOrders = allPendingOrders.filter(o => o.status === "배송준비중");
  const nonCancelledReadyOrders = readyOrders;

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

  const filteredOrders = useAdminCategoryFilter(readyOrders, filters, getFields);

  const totalPages = tablePageSize === "all" ? 1 : Math.ceil(filteredOrders.length / tablePageSize);
  const displayedOrders = tablePageSize === "all"
    ? filteredOrders
    : filteredOrders.slice((currentPage - 1) * tablePageSize, currentPage * tablePageSize);

  const handlePageChange = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
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

  const transferMutation = useMutation({
    mutationFn: async (body: any) => {
      const res = await apiRequest("POST", "/api/admin/orders/to-shipping", body);
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "전송 완료", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-orders"] });
      setSelectedOrders([]);
    },
    onError: (error: any) => {
      toast({ title: "전송 실패", description: error.message, variant: "destructive" });
    },
  });

  const deliverMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/ready-to-ship/deliver-waybill");
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "운송장 전달 완료", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ready-to-ship-status"] });
    },
    onError: (error: any) => {
      toast({ title: "운송장 전달 실패", description: error.message, variant: "destructive" });
    },
  });

  const cancelDeadlineMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/ready-to-ship/close-cancel-deadline");
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "회원취소 마감 완료", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ready-to-ship-status"] });
    },
    onError: (error: any) => {
      toast({ title: "회원취소 마감 실패", description: error.message, variant: "destructive" });
    },
  });

  const isTransferring = transferMutation.isPending;

  const handleTransferAll = () => {
    transferMutation.mutate({ mode: "all" });
    setShowTransferAllDialog(false);
  };

  const handleTransferFiltered = () => {
    const filterPayload: any = {};
    if (filters.memberId) filterPayload.memberId = filters.memberId;
    if (filters.categoryLarge) filterPayload.categoryLarge = filters.categoryLarge;
    if (filters.categoryMedium) filterPayload.categoryMedium = filters.categoryMedium;
    if (filters.categorySmall) filterPayload.categorySmall = filters.categorySmall;
    if (filters.searchTerm) {
      filterPayload.search = filters.searchTerm;
      if (filters.searchFilter && filters.searchFilter !== "선택 없음") {
        filterPayload.searchFilter = filters.searchFilter;
      }
    }
    transferMutation.mutate({ mode: "filtered", filters: filterPayload });
    setShowTransferFilteredDialog(false);
  };

  const handleTransferSelected = () => {
    transferMutation.mutate({ mode: "selected", orderIds: selectedOrders });
    setShowTransferSelectedDialog(false);
  };

  const handleDeliverWaybill = () => {
    deliverMutation.mutate();
    setShowDeliverDialog(false);
  };

  const handleCloseCancelDeadline = () => {
    cancelDeadlineMutation.mutate();
    setShowCancelDeadlineDialog(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">배송준비중</h1>
      </div>

      <OrderStatsBanner />

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-2">
            <span>배송준비중 목록</span>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant={waybillDelivered ? "outline" : "default"}
                disabled={readyOrders.length === 0 || deliverMutation.isPending}
                onClick={() => setShowDeliverDialog(true)}
                data-testid="button-deliver-waybill"
              >
                {deliverMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Bell className="h-4 w-4 mr-1" />
                )}
                {waybillDelivered ? "운송장전달 완료" : "운송장 전달"}
              </Button>
              <Button
                size="sm"
                variant={cancelDeadlineClosed ? "outline" : "destructive"}
                disabled={cancelDeadlineClosed || cancelDeadlineMutation.isPending}
                onClick={() => setShowCancelDeadlineDialog(true)}
                data-testid="button-close-cancel-deadline"
              >
                {cancelDeadlineMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <BanIcon className="h-4 w-4 mr-1" />
                )}
                {cancelDeadlineClosed ? "취소마감중" : "회원취소마감"}
              </Button>
              <Badge variant={cancelDeadlineClosed ? "default" : "secondary"}>
                {cancelDeadlineClosed ? "전송 가능" : "취소 접수중"}
              </Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 overflow-hidden">
          <DateRangeFilter onChange={setDateRange} defaultPreset="today" />
          <AdminCategoryFilter
            onFilterChange={setFilters}
            searchPlaceholder="검색어를 입력하세요"
          />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" data-testid="button-download-orders">
                <FileDown className="h-4 w-4 mr-1" />
                엑셀 다운로드
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
                  {displayedOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={14} className="text-center py-8 text-muted-foreground">
                        배송준비중 내역이 없습니다.
                      </TableCell>
                    </TableRow>
                  ) : displayedOrders.map((order) => (
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
            <div className="flex flex-wrap items-center justify-end gap-3">
              <span className="text-base font-bold text-orange-500 whitespace-nowrap">
                취소제외 주문건 배송중으로 전송
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="default"
                  disabled={nonCancelledReadyOrders.length === 0 || isTransferring || !cancelDeadlineClosed}
                  onClick={() => setShowTransferAllDialog(true)}
                  data-testid="button-transfer-all-shipping"
                >
                  {isTransferring ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-1" />
                  )}
                  전체 일괄전송 ({nonCancelledReadyOrders.length}건)
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={filteredOrders.length === 0 || isTransferring || !cancelDeadlineClosed}
                  onClick={() => setShowTransferFilteredDialog(true)}
                  data-testid="button-transfer-filtered-shipping"
                >
                  {isTransferring ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-1" />
                  )}
                  검색건 일괄전송 ({filteredOrders.length}건)
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={selectedOrders.length === 0 || isTransferring || !cancelDeadlineClosed}
                  onClick={() => setShowTransferSelectedDialog(true)}
                  data-testid="button-transfer-selected-shipping"
                >
                  {isTransferring ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-1" />
                  )}
                  선택건 전송 ({selectedOrders.length}건)
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showTransferAllDialog} onOpenChange={setShowTransferAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>전체 일괄전송</AlertDialogTitle>
            <AlertDialogDescription>
              배송준비중인 전체 {nonCancelledReadyOrders.length}건의 주문을 배송중으로 전송하시겠습니까?
              <br /><br />
              <strong>전송 조건:</strong>
              <ul className="list-disc list-inside mt-2 text-left">
                <li>취소 상태가 아닌 배송준비중 주문만 전송됩니다.</li>
                <li>전송 후 주문 상태가 "배송준비중" → "배송중"으로 변경됩니다.</li>
                <li>배송중 페이지에서 확인할 수 있습니다.</li>
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

      <AlertDialog open={showTransferFilteredDialog} onOpenChange={setShowTransferFilteredDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>검색건 일괄전송</AlertDialogTitle>
            <AlertDialogDescription>
              현재 검색 조건에 해당하는 {filteredOrders.length}건의 주문을 배송중으로 전송하시겠습니까?
              <br /><br />
              <strong>전송 조건:</strong>
              <ul className="list-disc list-inside mt-2 text-left">
                <li>현재 검색/필터 조건에 해당하는 주문이 전송됩니다.</li>
                <li>전송 후 주문 상태가 "배송준비중" → "배송중"으로 변경됩니다.</li>
                <li>배송중 페이지에서 확인할 수 있습니다.</li>
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

      <AlertDialog open={showTransferSelectedDialog} onOpenChange={setShowTransferSelectedDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>선택건 전송</AlertDialogTitle>
            <AlertDialogDescription>
              선택한 {selectedOrders.length}건의 주문을 배송중으로 전송하시겠습니까?
              <br /><br />
              <strong>전송 조건:</strong>
              <ul className="list-disc list-inside mt-2 text-left">
                <li>선택한 주문이 배송중으로 전송됩니다.</li>
                <li>전송 후 주문 상태가 "배송준비중" → "배송중"으로 변경됩니다.</li>
                <li>배송중 페이지에서 확인할 수 있습니다.</li>
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

      <AlertDialog open={showDeliverDialog} onOpenChange={setShowDeliverDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>운송장 전달</AlertDialogTitle>
            <AlertDialogDescription>
              배송준비중인 주문의 운송장 정보를 회원들에게 전달하시겠습니까?
              <br /><br />
              <strong>운송장 전달 시:</strong>
              <ul className="list-disc list-inside mt-2 text-left">
                <li>회원들이 자신의 대시보드에서 배송준비중 주문을 확인할 수 있습니다.</li>
                <li>회원들이 운송장 파일을 다운로드할 수 있게 됩니다.</li>
                <li>운송장 전달 후 회원 취소 접수가 가능해집니다.</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-deliver-cancel">취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeliverWaybill} data-testid="button-deliver-confirm">
              운송장 전달 실행
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showCancelDeadlineDialog} onOpenChange={setShowCancelDeadlineDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>회원취소 마감</AlertDialogTitle>
            <AlertDialogDescription>
              회원 취소 접수를 마감하시겠습니까?
              <br /><br />
              <strong>마감 시 주의사항:</strong>
              <ul className="list-disc list-inside mt-2 text-left">
                <li>마감 후에는 회원들이 더 이상 취소를 접수할 수 없습니다.</li>
                <li>마감 완료 후 배송중으로 전송이 가능해집니다.</li>
                <li>이 작업은 되돌릴 수 없습니다.</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-deadline-cancel">취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleCloseCancelDeadline} data-testid="button-deadline-confirm">
              마감 실행
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
