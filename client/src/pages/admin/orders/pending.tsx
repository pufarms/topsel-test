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
import { FileDown, Loader2, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import OrderStatsBanner from "@/components/order-stats-banner";
import { AdminCategoryFilter, useAdminCategoryFilter, type AdminCategoryFilterState } from "@/components/admin-category-filter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { PendingOrder } from "@shared/schema";

export default function OrdersPendingPage() {
  const { toast } = useToast();
  
  // SSE 실시간 업데이트 연결
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

  const { data: pendingOrders = [], isLoading } = useQuery<PendingOrder[]>({
    queryKey: ["/api/admin/pending-orders"],
  });

  const deleteSelectedMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await apiRequest("DELETE", "/api/admin/pending-orders", { ids });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-orders"] });
      setSelectedOrders([]);
      toast({ title: "선택한 주문이 삭제되었습니다." });
    },
    onError: () => {
      toast({ title: "삭제 실패", description: "주문 삭제 중 오류가 발생했습니다.", variant: "destructive" });
    },
  });

  const deleteAllMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", "/api/admin/pending-orders/all");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-orders"] });
      setSelectedOrders([]);
      toast({ title: "모든 주문이 삭제되었습니다." });
    },
    onError: () => {
      toast({ title: "삭제 실패", description: "전체 삭제 중 오류가 발생했습니다.", variant: "destructive" });
    },
  });

  const handleDeleteSelected = () => {
    if (selectedOrders.length === 0) return;
    if (confirm(`선택한 ${selectedOrders.length}건의 주문을 삭제하시겠습니까?`)) {
      deleteSelectedMutation.mutate(selectedOrders);
    }
  };

  const handleDeleteAll = () => {
    if (pendingOrders.length === 0) return;
    if (confirm(`전체 ${pendingOrders.length}건의 주문을 모두 삭제하시겠습니까?`)) {
      deleteAllMutation.mutate();
    }
  };

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

  const filteredOrders = useAdminCategoryFilter(pendingOrders, filters, getFields);
  
  // 페이지네이션 계산
  const totalPages = tablePageSize === "all" 
    ? 1 
    : Math.ceil(filteredOrders.length / tablePageSize);
  
  // 페이지 크기 변경 시 첫 페이지로 이동
  const handlePageSizeChange = (newSize: number | "all") => {
    setTablePageSize(newSize);
    setCurrentPage(1);
  };
  
  // 표시할 주문 목록 (현재 페이지에 해당하는 데이터)
  const displayedOrders = tablePageSize === "all" 
    ? filteredOrders 
    : filteredOrders.slice((currentPage - 1) * tablePageSize, currentPage * tablePageSize);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">주문 대기</h1>
      </div>

      <OrderStatsBanner />

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>주문 대기 목록</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 overflow-hidden">
          <AdminCategoryFilter
            onFilterChange={setFilters}
            searchPlaceholder="검색어를 입력하세요"
          />

          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" data-testid="button-download-orders">
                <FileDown className="h-4 w-4 mr-1" />
                엑셀 다운로드
              </Button>
              <Button 
                size="sm" 
                variant="destructive" 
                onClick={handleDeleteSelected}
                disabled={selectedOrders.length === 0 || deleteSelectedMutation.isPending}
                data-testid="button-delete-selected"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                선택삭제 {selectedOrders.length > 0 && `(${selectedOrders.length})`}
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                onClick={handleDeleteAll}
                disabled={pendingOrders.length === 0 || deleteAllMutation.isPending}
                data-testid="button-delete-all"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                전체삭제
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
                onChange={(e) => handlePageSizeChange(e.target.value === "all" ? "all" : parseInt(e.target.value))}
                data-testid="select-page-size"
              >
                <option value="10">10개씩</option>
                <option value="30">30개씩</option>
                <option value="100">100개씩</option>
                <option value="all">전체</option>
              </select>
            </div>
          </div>

          <div className="border rounded-lg overflow-x-auto overflow-y-auto max-h-[600px]">
            <Table className="w-max min-w-[2200px]">
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedOrders.length === displayedOrders.length && displayedOrders.length > 0}
                      onCheckedChange={handleSelectAll}
                      data-testid="checkbox-select-all"
                    />
                  </TableHead>
                  <TableHead className="font-semibold whitespace-nowrap w-12">순번</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">상호명(업체명)</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">대분류</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">중분류</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">소분류</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">상품코드</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">상품명</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">공급가</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">주문자명</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">주문자 전화번호</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">수령자명</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">수령자휴대폰번호</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">수령자 전화번호</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">수령자 주소</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">배송메시지</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">주문번호</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">자체주문번호</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">운송장번호</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">택배사</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={20} className="text-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : displayedOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={20} className="text-center py-12 text-muted-foreground">
                      주문 대기 내역이 없습니다.
                    </TableCell>
                  </TableRow>
                ) : (
                  displayedOrders.map((order, index) => (
                    <TableRow key={order.id} data-testid={`row-order-${order.id}`}>
                      <TableCell>
                        <Checkbox
                          checked={selectedOrders.includes(order.id)}
                          onCheckedChange={(checked) => handleSelectOrder(order.id, !!checked)}
                          data-testid={`checkbox-order-${order.id}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium font-mono text-xs">{order.sequenceNumber || index + 1}</TableCell>
                      <TableCell className="text-sm font-medium">{order.memberCompanyName || "-"}</TableCell>
                      <TableCell className="text-sm">{order.categoryLarge || "-"}</TableCell>
                      <TableCell className="text-sm">{order.categoryMedium || "-"}</TableCell>
                      <TableCell className="text-sm">{order.categorySmall || "-"}</TableCell>
                      <TableCell className="text-sm font-mono">{order.productCode || "-"}</TableCell>
                      <TableCell className="text-sm">{order.productName || "-"}</TableCell>
                      <TableCell className="text-sm text-right">{order.supplyPrice?.toLocaleString() || "-"}</TableCell>
                      <TableCell className="text-sm">{order.ordererName || "-"}</TableCell>
                      <TableCell className="text-sm">{order.ordererPhone || "-"}</TableCell>
                      <TableCell className="text-sm">{order.recipientName || "-"}</TableCell>
                      <TableCell className="text-sm">{order.recipientMobile || "-"}</TableCell>
                      <TableCell className="text-sm">{order.recipientPhone || "-"}</TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">{order.recipientAddress || "-"}</TableCell>
                      <TableCell className="text-sm max-w-[150px] truncate">{order.deliveryMessage || "-"}</TableCell>
                      <TableCell className="text-sm font-mono">{order.orderNumber || "-"}</TableCell>
                      <TableCell className="text-sm font-mono">{order.customOrderNumber || "-"}</TableCell>
                      <TableCell className="text-sm">{order.trackingNumber || "-"}</TableCell>
                      <TableCell className="text-sm">{order.courierCompany || "-"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* 페이지 네비게이션 */}
          {tablePageSize !== "all" && totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                data-testid="button-first-page"
              >
                처음
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                data-testid="button-prev-page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <div className="flex items-center gap-1">
                {(() => {
                  const pages = [];
                  const startPage = Math.max(1, currentPage - 2);
                  const endPage = Math.min(totalPages, currentPage + 2);
                  
                  for (let i = startPage; i <= endPage; i++) {
                    pages.push(
                      <Button
                        key={i}
                        size="sm"
                        variant={i === currentPage ? "default" : "outline"}
                        onClick={() => setCurrentPage(i)}
                        data-testid={`button-page-${i}`}
                      >
                        {i}
                      </Button>
                    );
                  }
                  return pages;
                })()}
              </div>
              
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                data-testid="button-next-page"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                data-testid="button-last-page"
              >
                마지막
              </Button>
              
              <span className="text-sm text-muted-foreground ml-2">
                {currentPage} / {totalPages} 페이지
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
