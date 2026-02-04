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
import { FileDown, Loader2, AlertTriangle } from "lucide-react";
import OrderStatsBanner from "@/components/order-stats-banner";
import { AdminCategoryFilter, useAdminCategoryFilter, type AdminCategoryFilterState } from "@/components/admin-category-filter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { PendingOrder } from "@shared/schema";
import * as XLSX from "xlsx";

interface MaterialProduct {
  productCode: string;
  productName: string;
  orderCount: number;
  materialQuantity: number;
  requiredMaterial: number;
  orderIds: string[];
}

interface MaterialGroup {
  materialCode: string;
  materialName: string;
  materialType: string;
  totalRequired: number;
  currentStock: number;
  remainingStock: number;
  isDeficit: boolean;
  alternateMaterialName?: string;
  alternateMaterialStock?: number;
  products: MaterialProduct[];
}

export default function OrdersAdminCancelPage() {
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
  const [selectedProducts, setSelectedProducts] = useState<{materialCode: string; productCode: string}[]>([]);

  const { data: allOrders = [], isLoading } = useQuery<PendingOrder[]>({
    queryKey: ["/api/admin/orders"],
  });

  const { data: adjustmentData = [], isLoading: isLoadingAdjustment } = useQuery<MaterialGroup[]>({
    queryKey: ["/api/admin/order-adjustment-stock"],
  });

  const adminCancelledOrders = allOrders.filter(o => o.status === "주문조정");

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

  const filteredOrders = useAdminCategoryFilter(adminCancelledOrders, filters, getFields);

  const executeAdjustmentMutation = useMutation({
    mutationFn: async (data: { materialCode: string; products: MaterialProduct[] }) => {
      return await apiRequest("POST", "/api/admin/order-adjustment-execute", data);
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/order-adjustment-stock"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-orders"] });
      setSelectedProducts([]);
      toast({ 
        title: "주문조정 완료", 
        description: result.message 
      });
    },
    onError: (error: any) => {
      toast({ 
        title: "주문조정 실패", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

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

  const handleSelectProduct = (materialCode: string, productCode: string, checked: boolean) => {
    if (checked) {
      setSelectedProducts([...selectedProducts, { materialCode, productCode }]);
    } else {
      setSelectedProducts(selectedProducts.filter(
        p => !(p.materialCode === materialCode && p.productCode === productCode)
      ));
    }
  };

  const isProductSelected = (materialCode: string, productCode: string) => {
    return selectedProducts.some(p => p.materialCode === materialCode && p.productCode === productCode);
  };

  const handleExecuteAdjustment = async () => {
    if (selectedProducts.length === 0) return;
    
    const materialCodes = [...new Set(selectedProducts.map(p => p.materialCode))];
    
    if (!confirm(`선택한 ${selectedProducts.length}개 상품의 주문을 조정하시겠습니까?\n\n공평 배분 알고리즘이 적용되어 순번이 높은 주문부터 취소됩니다.`)) {
      return;
    }

    for (const materialCode of materialCodes) {
      const group = adjustmentData.find(g => g.materialCode === materialCode);
      if (group && group.isDeficit) {
        const selectedProductCodes = selectedProducts
          .filter(p => p.materialCode === materialCode)
          .map(p => p.productCode);
        
        const productsToAdjust = group.products.filter(p => 
          selectedProductCodes.includes(p.productCode)
        );
        
        if (productsToAdjust.length > 0) {
          await executeAdjustmentMutation.mutateAsync({
            materialCode: group.materialCode,
            products: productsToAdjust
          });
        }
      }
    }
  };

  const handleDownloadAdjustmentExcel = () => {
    const rows: any[] = [];
    
    if (adjustmentData.length === 0) {
      rows.push({
        "재료명(원물,반재료)": "",
        "상품코드": "",
        "상품명": "",
        "주문조정선택": "",
        "주문합계": "",
        "원재료": "",
        "해당 원재료 합계": "",
        "원재료 재고(원물,반재료)": "",
        "재고합산(잔여재고)": "",
        "대체발송": "",
        "대체 원재료": "",
        "대체 원재료 재고": "",
        "대체 수량": "",
      });
    } else {
      for (const group of adjustmentData) {
        for (let i = 0; i < group.products.length; i++) {
          const product = group.products[i];
          rows.push({
            "재료명(원물,반재료)": i === 0 ? group.materialName : "",
            "상품코드": product.productCode,
            "상품명": product.productName,
            "주문조정선택": "",
            "주문합계": product.orderCount,
            "원재료": product.requiredMaterial,
            "해당 원재료 합계": i === 0 ? group.totalRequired : "",
            "원재료 재고(원물,반재료)": i === 0 ? group.currentStock : "",
            "재고합산(잔여재고)": i === 0 ? group.remainingStock : "",
            "대체발송": "",
            "대체 원재료": i === 0 ? (group.alternateMaterialName || "") : "",
            "대체 원재료 재고": i === 0 ? (group.alternateMaterialStock || "") : "",
            "대체 수량": "",
          });
        }
      }
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "주문조정 재고표");
    XLSX.writeFile(wb, `주문조정_재고표_${new Date().toISOString().split("T")[0]}.xlsx`);
    
    toast({ title: "다운로드 완료", description: "엑셀 파일이 다운로드되었습니다." });
  };

  const deficitGroups = adjustmentData.filter(g => g.isDeficit);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">주문조정(직권취소)</h1>
      </div>

      <OrderStatsBanner />

      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>원재료 기반 주문조정 재고표</CardTitle>
          <div className="flex items-center gap-2">
            <Button 
              size="sm" 
              variant="outline" 
              onClick={handleDownloadAdjustmentExcel}
              data-testid="button-download-adjustment"
            >
              <FileDown className="h-4 w-4 mr-1" />
              엑셀 다운로드
            </Button>
            <Button 
              size="sm" 
              variant="default" 
              disabled={selectedProducts.length === 0 || executeAdjustmentMutation.isPending}
              onClick={handleExecuteAdjustment}
              data-testid="button-execute-adjustment"
            >
              {executeAdjustmentMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : null}
              주문조정 실행
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 overflow-hidden">
          {deficitGroups.length > 0 && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg border border-destructive/20">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <span className="text-sm text-destructive font-medium">
                재고 부족 원재료: {deficitGroups.length}개 그룹 - 재고합산이 '-'인 상품을 선택하여 주문조정 가능
              </span>
            </div>
          )}

          <div className="border rounded-lg overflow-x-auto overflow-y-auto max-h-[500px]">
            <Table className="min-w-[1400px]">
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead className="min-w-[160px] whitespace-nowrap">재료명(원물,반재료)</TableHead>
                  <TableHead className="min-w-[120px] whitespace-nowrap">상품코드</TableHead>
                  <TableHead className="min-w-[280px] whitespace-nowrap">상품명</TableHead>
                  <TableHead className="min-w-[80px] text-center whitespace-nowrap">주문조정<br/>선택</TableHead>
                  <TableHead className="min-w-[70px] text-center whitespace-nowrap">주문<br/>합계</TableHead>
                  <TableHead className="min-w-[70px] text-center whitespace-nowrap">원재료</TableHead>
                  <TableHead className="min-w-[90px] text-center whitespace-nowrap">해당<br/>원재료 합계</TableHead>
                  <TableHead className="min-w-[120px] text-center whitespace-nowrap">원재료 재고<br/>(원물,반재료)</TableHead>
                  <TableHead className="min-w-[100px] text-center whitespace-nowrap">재고합산<br/>(잔여재고)</TableHead>
                  <TableHead className="min-w-[80px] text-center whitespace-nowrap">대체발송</TableHead>
                  <TableHead className="min-w-[120px] text-center whitespace-nowrap">대체 원재료</TableHead>
                  <TableHead className="min-w-[90px] text-center whitespace-nowrap">대체<br/>원재료 재고</TableHead>
                  <TableHead className="min-w-[80px] text-center whitespace-nowrap">대체 수량</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingAdjustment ? (
                  <TableRow>
                    <TableCell colSpan={13} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : adjustmentData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={13} className="text-center py-8 text-muted-foreground">
                      대기 상태의 주문이 없거나, 상품 매핑이 설정되지 않았습니다.
                    </TableCell>
                  </TableRow>
                ) : (
                  adjustmentData.map((group) => (
                    group.products.map((product, productIndex) => (
                      <TableRow 
                        key={`${group.materialCode}-${product.productCode}`}
                        className={group.isDeficit ? "bg-destructive/5" : ""}
                      >
                        {productIndex === 0 && (
                          <TableCell 
                            rowSpan={group.products.length} 
                            className="font-medium align-middle border-r bg-muted/30 text-sm min-w-[160px]"
                          >
                            {group.materialName}
                            <div className="text-xs text-muted-foreground mt-1">
                              {group.materialType === "raw" ? "원물" : group.materialType === "semi" ? "반재료" : group.materialType}
                            </div>
                          </TableCell>
                        )}
                        <TableCell className="font-mono text-xs min-w-[120px]">{product.productCode}</TableCell>
                        <TableCell className="text-sm min-w-[280px]">{product.productName}</TableCell>
                        <TableCell className="text-center">
                          <Checkbox
                            checked={isProductSelected(group.materialCode, product.productCode)}
                            onCheckedChange={(checked) => handleSelectProduct(group.materialCode, product.productCode, !!checked)}
                            disabled={!group.isDeficit}
                            data-testid={`checkbox-product-${product.productCode}`}
                          />
                        </TableCell>
                        <TableCell className="text-center font-medium">{product.orderCount}</TableCell>
                        <TableCell className="text-center">{product.requiredMaterial}</TableCell>
                        {productIndex === 0 && (
                          <TableCell 
                            rowSpan={group.products.length} 
                            className="text-center font-bold align-middle border-l bg-muted/30"
                          >
                            {group.totalRequired}
                          </TableCell>
                        )}
                        {productIndex === 0 && (
                          <TableCell 
                            rowSpan={group.products.length} 
                            className="text-center align-middle border-l"
                          >
                            {group.currentStock}
                          </TableCell>
                        )}
                        {productIndex === 0 && (
                          <TableCell 
                            rowSpan={group.products.length} 
                            className={`text-center font-bold align-middle border-l ${
                              group.isDeficit ? "text-destructive" : "text-green-600"
                            }`}
                          >
                            {group.remainingStock}
                          </TableCell>
                        )}
                        {productIndex === 0 && (
                          <TableCell 
                            rowSpan={group.products.length} 
                            className="text-center align-middle border-l"
                          >
                            <Checkbox
                              disabled={!group.isDeficit}
                              data-testid={`checkbox-alternate-${group.materialCode}`}
                            />
                          </TableCell>
                        )}
                        {productIndex === 0 && (
                          <TableCell 
                            rowSpan={group.products.length} 
                            className="text-center align-middle border-l text-sm"
                          >
                            {group.alternateMaterialName || "-"}
                          </TableCell>
                        )}
                        {productIndex === 0 && (
                          <TableCell 
                            rowSpan={group.products.length} 
                            className="text-center align-middle border-l"
                          >
                            {group.alternateMaterialStock ?? "-"}
                          </TableCell>
                        )}
                        {productIndex === 0 && (
                          <TableCell 
                            rowSpan={group.products.length} 
                            className="text-center align-middle border-l"
                          >
                            -
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>주문조정(직권취소) 내역</CardTitle>
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

          <div className="border rounded-lg overflow-x-auto overflow-y-auto max-h-[500px]">
            <Table className="min-w-[1600px]">
              <TableHeader className="sticky top-0 z-10 bg-background">
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
                  <TableHead className="w-[150px]">조정일시</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={16} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : filteredOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={16} className="text-center py-8 text-muted-foreground">
                      직권취소 내역이 없습니다.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrders.map((order, index) => (
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
                        <Badge variant="outline" className="border-orange-500 text-orange-500">주문조정</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {order.updatedAt ? new Date(order.updatedAt).toLocaleString("ko-KR") : "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
