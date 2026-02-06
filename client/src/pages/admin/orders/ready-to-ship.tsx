import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSSE } from "@/hooks/use-sse";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileDown, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import OrderStatsBanner from "@/components/order-stats-banner";
import { AdminCategoryFilter, useAdminCategoryFilter, type AdminCategoryFilterState } from "@/components/admin-category-filter";
import type { PendingOrder } from "@shared/schema";

export default function OrdersReadyToShipPage() {
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

  const { data: allPendingOrders = [], isLoading } = useQuery<PendingOrder[]>({
    queryKey: ["/api/admin/pending-orders"],
  });

  const readyOrders = allPendingOrders.filter(o => o.status === "배송준비중");

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">배송준비중</h1>
      </div>

      <OrderStatsBanner />

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>배송준비중 목록</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 overflow-hidden">
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
              <Button size="sm" variant="default" disabled={selectedOrders.length === 0}>
                배송중 처리
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : displayedOrders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              배송준비중 내역이 없습니다.
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
                  {displayedOrders.map((order) => (
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
                      <TableCell className="font-mono text-sm" data-testid={`text-order-number-${order.id}`}>{order.orderNumber || "-"}</TableCell>
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
        </CardContent>
      </Card>
    </div>
  );
}
