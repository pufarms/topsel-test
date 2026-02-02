import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { FileDown, Loader2 } from "lucide-react";
import OrderStatsBanner from "@/components/order-stats-banner";
import { AdminCategoryFilter, useAdminCategoryFilter, type AdminCategoryFilterState } from "@/components/admin-category-filter";
import type { PendingOrder } from "@shared/schema";

export default function OrdersPendingPage() {
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

  const { data: pendingOrders = [], isLoading } = useQuery<PendingOrder[]>({
    queryKey: ["/api/admin/orders"],
  });

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
  
  // 표시할 주문 목록 (페이지 크기에 따라 자르기)
  const displayedOrders = tablePageSize === "all" 
    ? filteredOrders 
    : filteredOrders.slice(0, tablePageSize);

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
              <span className="text-sm text-muted-foreground">
                {displayedOrders.length} / {filteredOrders.length}건
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm">표시 개수:</span>
              <select 
                className="h-8 px-2 border rounded text-sm"
                value={tablePageSize === "all" ? "all" : tablePageSize.toString()}
                onChange={(e) => setTablePageSize(e.target.value === "all" ? "all" : parseInt(e.target.value))}
                data-testid="select-page-size"
              >
                <option value="10">10개씩</option>
                <option value="30">30개씩</option>
                <option value="100">100개씩</option>
                <option value="all">전체</option>
              </select>
              <Button size="sm" variant="default" disabled={selectedOrders.length === 0}>
                1차 주문마감
              </Button>
              <Button size="sm" variant="secondary" disabled={selectedOrders.length === 0}>
                2차 주문마감
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : displayedOrders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              주문 대기 내역이 없습니다.
            </div>
          ) : (
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
                  {displayedOrders.map((order, index) => (
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
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
