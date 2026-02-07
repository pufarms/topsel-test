import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileDown, Truck, Loader2, ChevronLeft, ChevronRight, AlertCircle } from "lucide-react";
import { MemberOrderFilter, type MemberOrderFilterState } from "@/components/member/MemberOrderFilter";
import { DateRangeFilter, useDateRange } from "@/components/common/DateRangeFilter";
import type { PendingOrder } from "@shared/schema";

interface MemberOrderListProps {
  canOrder?: boolean;
}

export default function MemberOrderList({ canOrder = true }: MemberOrderListProps) {
  const [filters, setFilters] = useState<MemberOrderFilterState | null>(null);
  const [tablePageSize, setTablePageSize] = useState<number | "all">(30);
  const [currentPage, setCurrentPage] = useState(1);
  const { dateRange, setDateRange } = useDateRange("today");

  const { data: allOrders = [], isLoading } = useQuery<PendingOrder[]>({
    queryKey: ["/api/member/pending-orders", dateRange.startDate, dateRange.endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateRange.startDate) params.set("startDate", dateRange.startDate);
      if (dateRange.endDate) params.set("endDate", dateRange.endDate);
      const res = await fetch(`/api/member/pending-orders?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const shippingOrders = allOrders.filter(o => o.status === "배송중");

  const applyFilters = useCallback((orders: PendingOrder[], f: MemberOrderFilterState | null) => {
    if (!f) return orders;
    let result = [...orders];

    if (f.categoryLarge && f.categoryLarge !== "all") {
      result = result.filter(o => o.categoryLarge === f.categoryLarge);
    }
    if (f.categoryMedium && f.categoryMedium !== "all") {
      result = result.filter(o => o.categoryMedium === f.categoryMedium);
    }
    if (f.categorySmall && f.categorySmall !== "all") {
      result = result.filter(o => o.categorySmall === f.categorySmall);
    }

    if (f.searchTerm && f.searchTerm.trim()) {
      const term = f.searchTerm.trim().toLowerCase();
      result = result.filter(o => {
        switch (f.searchType) {
          case "orderId":
            return (o.customOrderNumber || "").toLowerCase().includes(term);
          case "productName":
            return (o.productName || "").toLowerCase().includes(term);
          case "recipientName":
            return (o.recipientName || "").toLowerCase().includes(term);
          case "trackingNumber":
            return (o.trackingNumber || "").toLowerCase().includes(term);
          default:
            return true;
        }
      });
    }

    return result;
  }, []);

  const filteredOrders = applyFilters(shippingOrders, filters);

  const totalPages = tablePageSize === "all" ? 1 : Math.ceil(filteredOrders.length / tablePageSize);
  const displayedOrders = tablePageSize === "all"
    ? filteredOrders
    : filteredOrders.slice((currentPage - 1) * tablePageSize, currentPage * tablePageSize);

  const handlePageChange = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const handleFilterChange = (newFilters: MemberOrderFilterState) => {
    setFilters(newFilters);
    setCurrentPage(1);
  };

  return (
    <div className="space-y-4">
      {!canOrder && (
        <Card className="bg-amber-50 dark:bg-amber-950/30">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-6 w-6 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-lg font-bold text-amber-700 dark:text-amber-400 mb-2">기능 제한</h3>
                <p className="text-sm text-muted-foreground">
                  스타트(START) 등급 이상 회원만 엑셀 다운로드가 가능합니다.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      <Card className="overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">배송중 조회</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 overflow-hidden">
          <DateRangeFilter onChange={setDateRange} defaultPreset="today" />
          <MemberOrderFilter
            onFilterChange={handleFilterChange}
            showSearchField={true}
            searchOptions={[
              { value: "orderId", label: "주문번호" },
              { value: "productName", label: "상품명" },
              { value: "recipientName", label: "수령자명" },
              { value: "trackingNumber", label: "운송장번호" },
            ]}
          />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" disabled={!canOrder} data-testid="button-shipping-download">
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
                data-testid="select-shipping-page-size"
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
                <Table className="min-w-[1600px]">
                  <TableHeader className="sticky top-0 z-10 bg-background">
                    <TableRow>
                      <TableHead className="w-[100px] font-semibold whitespace-nowrap">주문자명</TableHead>
                      <TableHead className="w-[140px] font-semibold whitespace-nowrap">주문자 전화번호</TableHead>
                      <TableHead className="min-w-[200px] font-semibold whitespace-nowrap">주문자 주소</TableHead>
                      <TableHead className="w-[100px] font-semibold whitespace-nowrap">수령자명</TableHead>
                      <TableHead className="w-[140px] font-semibold whitespace-nowrap">수령자휴대폰번호</TableHead>
                      <TableHead className="w-[140px] font-semibold whitespace-nowrap">수령자 전화번호</TableHead>
                      <TableHead className="min-w-[250px] font-semibold whitespace-nowrap">수령자 주소</TableHead>
                      <TableHead className="min-w-[150px] font-semibold whitespace-nowrap">배송메시지</TableHead>
                      <TableHead className="min-w-[200px] font-semibold whitespace-nowrap">상품명</TableHead>
                      <TableHead className="w-[80px] font-semibold whitespace-nowrap">수량</TableHead>
                      <TableHead className="w-[140px] font-semibold whitespace-nowrap">주문번호</TableHead>
                      <TableHead className="w-[140px] font-semibold whitespace-nowrap">운송장번호</TableHead>
                      <TableHead className="w-[100px] font-semibold whitespace-nowrap">택배사</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayedOrders.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={13} className="text-center py-8 text-muted-foreground">
                          배송중 내역이 없습니다.
                        </TableCell>
                      </TableRow>
                    ) : displayedOrders.map((order) => (
                      <TableRow key={order.id}>
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
          )}

          {tablePageSize !== "all" && totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button
                size="sm"
                variant="outline"
                disabled={currentPage === 1}
                onClick={() => handlePageChange(currentPage - 1)}
                data-testid="button-shipping-prev-page"
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
                data-testid="button-shipping-next-page"
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
