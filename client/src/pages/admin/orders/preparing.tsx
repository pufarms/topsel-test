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
import { FileDown, Loader2, ChevronLeft, ChevronRight, RotateCcw, ChevronDown } from "lucide-react";
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
  const [downloadFormat, setDownloadFormat] = useState<"default" | "lotte">("default");

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

  const filteredOrders = useAdminCategoryFilter(preparingOrders, filters, getFields);
  
  const totalPages = tablePageSize === "all" ? 1 : Math.ceil(filteredOrders.length / tablePageSize);
  const displayedOrders = tablePageSize === "all" 
    ? filteredOrders 
    : filteredOrders.slice((currentPage - 1) * tablePageSize, currentPage * tablePageSize);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    setSelectedOrders([]);
  };

  const handleDownload = async (format: "default" | "lotte") => {
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
      const formatName = format === "lotte" ? "롯데" : "기본";
      a.download = `상품준비중_${formatName}_${new Date().toISOString().slice(0, 10)}.xlsx`;
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

          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" data-testid="button-select-format">
                    다운양식선택: {downloadFormat === "lotte" ? "롯데 양식" : "기본 양식"}
                    <ChevronDown className="h-4 w-4 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem 
                    onClick={() => setDownloadFormat("default")}
                    data-testid="menu-format-default"
                  >
                    기본 양식
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => setDownloadFormat("lotte")}
                    data-testid="menu-format-lotte"
                  >
                    롯데 양식
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
              <Button size="sm" variant="default" disabled={selectedOrders.length === 0}>
                배송준비완료 처리
              </Button>
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
                    <TableHead className="w-[100px]">순번</TableHead>
                    <TableHead className="w-[120px]">상호명</TableHead>
                    <TableHead className="w-[120px]">대분류</TableHead>
                    <TableHead className="w-[120px]">중분류</TableHead>
                    <TableHead className="w-[120px]">소분류</TableHead>
                    <TableHead className="w-[140px]">상품코드</TableHead>
                    <TableHead className="min-w-[200px]">상품명</TableHead>
                    <TableHead className="w-[100px]">수량</TableHead>
                    <TableHead className="w-[120px]">공급가</TableHead>
                    <TableHead className="w-[100px]">주문자</TableHead>
                    <TableHead className="w-[100px]">수령자</TableHead>
                    <TableHead className="w-[150px]">수령자 연락처</TableHead>
                    <TableHead className="min-w-[250px]">배송지</TableHead>
                    <TableHead className="w-[100px]">상태</TableHead>
                    <TableHead className="w-[150px]">등록일시</TableHead>
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
                      <TableCell className="font-mono text-sm">{order.sequenceNumber || index + 1}</TableCell>
                      <TableCell>{order.memberCompanyName || "-"}</TableCell>
                      <TableCell>{order.categoryLarge || "-"}</TableCell>
                      <TableCell>{order.categoryMedium || "-"}</TableCell>
                      <TableCell>{order.categorySmall || "-"}</TableCell>
                      <TableCell className="font-mono">{order.productCode || "-"}</TableCell>
                      <TableCell>{order.productName || "-"}</TableCell>
                      <TableCell>1</TableCell>
                      <TableCell className="text-right">
                        {order.supplyPrice ? order.supplyPrice.toLocaleString() + "원" : "-"}
                      </TableCell>
                      <TableCell>{order.ordererName || "-"}</TableCell>
                      <TableCell>{order.recipientName || "-"}</TableCell>
                      <TableCell>{order.recipientMobile || order.recipientPhone || "-"}</TableCell>
                      <TableCell className="max-w-[250px] truncate" title={order.recipientAddress || ""}>
                        {order.recipientAddress || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">준비중</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {order.createdAt ? new Date(order.createdAt).toLocaleString("ko-KR") : "-"}
                      </TableCell>
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
        </CardContent>
      </Card>

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
    </div>
  );
}
