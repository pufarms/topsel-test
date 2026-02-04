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
import { FileDown, Loader2 } from "lucide-react";
import OrderStatsBanner from "@/components/order-stats-banner";
import { AdminCategoryFilter, useAdminCategoryFilter, type AdminCategoryFilterState } from "@/components/admin-category-filter";
import type { PendingOrder } from "@shared/schema";

export default function OrdersCancelledPage() {
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

  const { data: allPendingOrders = [], isLoading } = useQuery<PendingOrder[]>({
    queryKey: ["/api/admin/pending-orders"],
  });

  // 취소 페이지는 "취소" 상태만 표시
  const cancelledOrders = allPendingOrders.filter(o => o.status === "취소");

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

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedOrders(filteredOrders.map(o => o.id));
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
          <CardTitle>회원 취소 목록</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 overflow-hidden">
          <AdminCategoryFilter
            onFilterChange={setFilters}
            searchPlaceholder="검색어를 입력하세요"
          />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" data-testid="button-download-orders">
                <FileDown className="h-4 w-4 mr-1" />
                엑셀 다운로드
              </Button>
              <span className="text-sm text-muted-foreground">
                총 {filteredOrders.length}건
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="default" disabled={selectedOrders.length === 0}>
                주문 복구
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              취소 내역이 없습니다.
            </div>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <Table className="min-w-[1600px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedOrders.length === filteredOrders.length && filteredOrders.length > 0}
                        onCheckedChange={handleSelectAll}
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
                    <TableHead className="w-[150px]">취소일시</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order, index) => (
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
                        <Badge variant="destructive">회원취소</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {order.updatedAt ? new Date(order.updatedAt).toLocaleString("ko-KR") : "-"}
                      </TableCell>
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
