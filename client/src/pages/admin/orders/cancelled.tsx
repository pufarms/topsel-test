import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { FileDown, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import OrderStatsBanner from "@/components/order-stats-banner";
import { AdminCategoryFilter, useAdminCategoryFilter, type AdminCategoryFilterState } from "@/components/admin-category-filter";
import type { PendingOrder } from "@shared/schema";
import { DateRangeFilter, useDateRange } from "@/components/common/DateRangeFilter";

export default function OrdersCancelledPage() {
  useSSE();

  const { dateRange, setDateRange } = useDateRange("today");

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

  const cancelledOrders = allPendingOrders.filter(o => o.status === "회원취소" || o.status === "취소");

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

  const filteredOrders = useAdminCategoryFilter(cancelledOrders, filters, getFields);

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
        <h1 className="text-2xl font-bold">취소건 관리</h1>
      </div>

      <OrderStatsBanner />

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>회원취소 목록</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 overflow-hidden">
          <DateRangeFilter onChange={setDateRange} />
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
            <div className="border rounded-lg table-scroll-container">
                <Table className="w-max">
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow>
                    <TableHead className="whitespace-nowrap px-3">
                      <Checkbox
                        checked={selectedOrders.length === displayedOrders.length && displayedOrders.length > 0}
                        onCheckedChange={handleSelectAll}
                        data-testid="checkbox-select-all"
                      />
                    </TableHead>
                    <TableHead className="whitespace-nowrap px-3">상태</TableHead>
                    <TableHead className="whitespace-nowrap px-3">주문자명</TableHead>
                    <TableHead className="whitespace-nowrap px-3">주문자 전화번호</TableHead>
                    <TableHead className="whitespace-nowrap px-3">주문자 주소</TableHead>
                    <TableHead className="whitespace-nowrap px-3">수령자명</TableHead>
                    <TableHead className="whitespace-nowrap px-3">수령자 휴대폰번호</TableHead>
                    <TableHead className="whitespace-nowrap px-3">수령자 전화번호</TableHead>
                    <TableHead className="whitespace-nowrap px-3">수령자 주소</TableHead>
                    <TableHead className="whitespace-nowrap px-3">배송메시지</TableHead>
                    <TableHead className="whitespace-nowrap px-3">상품명</TableHead>
                    <TableHead className="whitespace-nowrap px-3">수량</TableHead>
                    <TableHead className="whitespace-nowrap px-3">주문번호</TableHead>
                    <TableHead className="whitespace-nowrap px-3">운송장번호</TableHead>
                    <TableHead className="whitespace-nowrap px-3">택배사</TableHead>
                    <TableHead className="whitespace-nowrap px-3">발송구분</TableHead>
                    <TableHead className="whitespace-nowrap px-3">취소일시</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={17} className="text-center py-8 text-muted-foreground">
                        취소 내역이 없습니다.
                      </TableCell>
                    </TableRow>
                  ) : displayedOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="px-3">
                        <Checkbox
                          checked={selectedOrders.includes(order.id)}
                          onCheckedChange={(checked) => handleSelectOrder(order.id, !!checked)}
                        />
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-3">
                        <Badge variant="destructive">{order.status === "회원취소" ? "회원취소" : "취소"}</Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-3" data-testid={`text-orderer-name-${order.id}`}>{order.ordererName || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap px-3" data-testid={`text-orderer-phone-${order.id}`}>{order.ordererPhone || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap px-3 max-w-[300px] truncate" title={order.ordererAddress || ""} data-testid={`text-orderer-address-${order.id}`}>
                        {order.ordererAddress || "-"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-3" data-testid={`text-recipient-name-${order.id}`}>{order.recipientName || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap px-3" data-testid={`text-recipient-mobile-${order.id}`}>{order.recipientMobile || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap px-3" data-testid={`text-recipient-phone-${order.id}`}>{order.recipientPhone || "-"}</TableCell>
                      <TableCell className="px-3 max-w-[400px] truncate" title={order.recipientAddress || ""} data-testid={`text-recipient-address-${order.id}`}>
                        {order.recipientAddress || "-"}
                      </TableCell>
                      <TableCell className="px-3 max-w-[200px] truncate" data-testid={`text-delivery-message-${order.id}`}>
                        {order.deliveryMessage
                          ? order.deliveryMessage.replace(/\s*\[주소확인필요:[^\]]*\]/g, "").trim() || "-"
                          : "-"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-3" data-testid={`text-product-name-${order.id}`}>{order.productName || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap px-3 text-center" data-testid={`text-quantity-${order.id}`}>1</TableCell>
                      <TableCell className="whitespace-nowrap px-3 font-mono text-sm" data-testid={`text-order-number-${order.id}`}>{order.customOrderNumber || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap px-3 font-mono text-sm" data-testid={`text-tracking-number-${order.id}`}>
                        {order.trackingNumber || "-"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-3" data-testid={`text-courier-${order.id}`}>{order.courierCompany || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap px-3" data-testid={`text-fulfillment-${order.id}`}>
                        {order.fulfillmentType === "vendor" ? (
                          <span className="text-orange-600 dark:text-orange-400">외주</span>
                        ) : (
                          <span className="text-blue-600 dark:text-blue-400">자체</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-3 text-sm text-muted-foreground">
                        {order.updatedAt ? new Date(order.updatedAt).toLocaleString("ko-KR") : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
