import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSSE } from "@/hooks/use-sse";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { FileDown, Loader2, AlertTriangle, Search, Check, X, Send } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import OrderStatsBanner from "@/components/order-stats-banner";
import { AdminCategoryFilter, useAdminCategoryFilter, type AdminCategoryFilterState } from "@/components/admin-category-filter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { PendingOrder, Material } from "@shared/schema";
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

interface AlternateSelection {
  materialCode: string;
  alternateMaterialCode: string;
  alternateMaterialName: string;
  alternateMaterialStock: number;
  alternateQuantity: number;
  useAlternate: boolean;
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
  const [alternateSelections, setAlternateSelections] = useState<Map<string, AlternateSelection>>(new Map());
  const [openPopovers, setOpenPopovers] = useState<Map<string, boolean>>(new Map());
  const [showDeficitDialog, setShowDeficitDialog] = useState(false);
  const [deficitMaterials, setDeficitMaterials] = useState<MaterialGroup[]>([]);
  const [isTransferring, setIsTransferring] = useState(false);

  const { data: allOrders = [], isLoading } = useQuery<PendingOrder[]>({
    queryKey: ["/api/admin/orders"],
  });

  const { data: adjustmentData = [], isLoading: isLoadingAdjustment } = useQuery<MaterialGroup[]>({
    queryKey: ["/api/admin/order-adjustment-stock"],
  });

  const { data: allMaterials = [] } = useQuery<Material[]>({
    queryKey: ["/api/materials"],
  });

  const rawSemiMaterials = useMemo(() => {
    return allMaterials.filter(m => m.materialType === "raw" || m.materialType === "semi");
  }, [allMaterials]);

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
      queryClient.invalidateQueries({ queryKey: ["/api/materials"] });
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

  const executeAlternateShipmentMutation = useMutation({
    mutationFn: async (data: { 
      materialCode: string; 
      alternateMaterialCode: string;
      alternateQuantity: number;
    }) => {
      return await apiRequest("POST", "/api/admin/alternate-shipment-execute", data);
    },
    onSuccess: (result: any, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/order-adjustment-stock"] });
      queryClient.invalidateQueries({ queryKey: ["/api/materials"] });
      const newSelections = new Map(alternateSelections);
      newSelections.delete(variables.materialCode);
      setAlternateSelections(newSelections);
      toast({ 
        title: "대체발송 완료", 
        description: result.message 
      });
    },
    onError: (error: any) => {
      toast({ 
        title: "대체발송 실패", 
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

  const handleAlternateCheck = (materialCode: string, checked: boolean) => {
    const newSelections = new Map(alternateSelections);
    const existing = newSelections.get(materialCode);
    if (existing) {
      newSelections.set(materialCode, { ...existing, useAlternate: checked });
    } else {
      newSelections.set(materialCode, {
        materialCode,
        alternateMaterialCode: "",
        alternateMaterialName: "",
        alternateMaterialStock: 0,
        alternateQuantity: 0,
        useAlternate: checked,
      });
    }
    setAlternateSelections(newSelections);
  };

  const handleSelectAlternateMaterial = (materialCode: string, material: Material) => {
    const newSelections = new Map(alternateSelections);
    const existing = newSelections.get(materialCode);
    newSelections.set(materialCode, {
      materialCode,
      alternateMaterialCode: material.materialCode,
      alternateMaterialName: material.materialName,
      alternateMaterialStock: material.currentStock,
      alternateQuantity: existing?.alternateQuantity || 0,
      useAlternate: existing?.useAlternate || true,
    });
    setAlternateSelections(newSelections);
    
    const newPopovers = new Map(openPopovers);
    newPopovers.set(materialCode, false);
    setOpenPopovers(newPopovers);
  };

  const handleClearAlternateMaterial = (materialCode: string) => {
    const newSelections = new Map(alternateSelections);
    newSelections.delete(materialCode);
    setAlternateSelections(newSelections);
  };

  const handleAlternateQuantityChange = (materialCode: string, quantity: number) => {
    const newSelections = new Map(alternateSelections);
    const existing = newSelections.get(materialCode);
    if (existing) {
      newSelections.set(materialCode, { ...existing, alternateQuantity: quantity });
      setAlternateSelections(newSelections);
    }
  };

  const getAdjustedRemainingStock = (group: MaterialGroup): number => {
    const selection = alternateSelections.get(group.materialCode);
    if (selection && selection.useAlternate && selection.alternateQuantity > 0) {
      return group.remainingStock + selection.alternateQuantity;
    }
    return group.remainingStock;
  };

  const isStillDeficit = (group: MaterialGroup): boolean => {
    return getAdjustedRemainingStock(group) < 0;
  };

  const handleExecuteAdjustment = async () => {
    if (selectedProducts.length === 0) return;
    
    const materialCodes = [...new Set(selectedProducts.map(p => p.materialCode))];
    
    const alternateShipments: { materialCode: string; alternateMaterialCode: string; alternateQuantity: number; alternateMaterialName: string }[] = [];
    for (const materialCode of materialCodes) {
      const selection = alternateSelections.get(materialCode);
      if (selection && selection.useAlternate && selection.alternateMaterialCode && selection.alternateQuantity > 0) {
        if (selection.alternateQuantity > selection.alternateMaterialStock) {
          toast({
            title: "재고 부족",
            description: `${selection.alternateMaterialName}의 대체 수량이 재고보다 많습니다.`,
            variant: "destructive",
          });
          return;
        }
        alternateShipments.push({
          materialCode,
          alternateMaterialCode: selection.alternateMaterialCode,
          alternateQuantity: selection.alternateQuantity,
          alternateMaterialName: selection.alternateMaterialName,
        });
      }
    }

    let confirmMessage = `선택한 ${selectedProducts.length}개 상품의 주문을 조정하시겠습니까?\n\n공평 배분 알고리즘이 적용되어 순번이 높은 주문부터 취소됩니다.`;
    if (alternateShipments.length > 0) {
      confirmMessage = `대체발송 ${alternateShipments.length}건과 주문조정을 동시에 실행하시겠습니까?\n\n` +
        alternateShipments.map(a => `• ${a.alternateMaterialName}: ${a.alternateQuantity}개 대체`).join('\n') +
        `\n\n공평 배분 알고리즘이 적용되어 순번이 높은 주문부터 취소됩니다.`;
    }
    
    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      let totalAlternateExecuted = 0;
      let totalOrdersAdjusted = 0;

      for (const shipment of alternateShipments) {
        await apiRequest("POST", "/api/admin/alternate-shipment-execute", {
          materialCode: shipment.materialCode,
          alternateMaterialCode: shipment.alternateMaterialCode,
          alternateQuantity: shipment.alternateQuantity,
        });
        totalAlternateExecuted++;
      }

      for (const materialCode of materialCodes) {
        const group = adjustmentData.find(g => g.materialCode === materialCode);
        if (group && isStillDeficit(group)) {
          const selectedProductCodes = selectedProducts
            .filter(p => p.materialCode === materialCode)
            .map(p => p.productCode);
          
          const productsToAdjust = group.products.filter(p => 
            selectedProductCodes.includes(p.productCode)
          );
          
          if (productsToAdjust.length > 0) {
            const result: any = await apiRequest("POST", "/api/admin/order-adjustment-execute", {
              materialCode: group.materialCode,
              products: productsToAdjust
            });
            if (result.cancelledOrderIds) {
              totalOrdersAdjusted += result.cancelledOrderIds.length;
            }
          }
        }
      }

      queryClient.invalidateQueries({ queryKey: ["/api/admin/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/order-adjustment-stock"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/materials"] });
      
      setSelectedProducts([]);
      setAlternateSelections(new Map());
      setOpenPopovers(new Map());

      let summaryMessage = "";
      if (totalAlternateExecuted > 0 && totalOrdersAdjusted > 0) {
        summaryMessage = `대체발송 ${totalAlternateExecuted}건 실행, ${totalOrdersAdjusted}건 주문 조정 완료`;
      } else if (totalAlternateExecuted > 0) {
        summaryMessage = `대체발송 ${totalAlternateExecuted}건 실행 완료`;
      } else if (totalOrdersAdjusted > 0) {
        summaryMessage = `${totalOrdersAdjusted}건 주문 조정 완료`;
      } else {
        summaryMessage = "주문조정이 완료되었습니다.";
      }

      toast({ 
        title: "주문조정 완료", 
        description: summaryMessage 
      });
    } catch (error: any) {
      toast({ 
        title: "주문조정 실패", 
        description: error.message, 
        variant: "destructive" 
      });
    }
  };

  const getAdjustedRemainingStockForTransfer = (group: MaterialGroup): number => {
    const selection = alternateSelections.get(group.materialCode);
    let adjustedStock = group.remainingStock;
    if (selection?.useAlternate && selection.alternateQuantity > 0) {
      adjustedStock += selection.alternateQuantity;
    }
    return adjustedStock;
  };

  const handleTransferToPreparation = async () => {
    const deficitGroups = adjustmentData.filter(group => getAdjustedRemainingStockForTransfer(group) < 0);
    
    if (deficitGroups.length > 0) {
      setDeficitMaterials(deficitGroups);
      setShowDeficitDialog(true);
      return;
    }

    await executeTransfer(false);
  };

  const executeTransfer = async (excludeDeficit: boolean) => {
    setIsTransferring(true);
    setShowDeficitDialog(false);
    
    try {
      const materialCodesToExclude = excludeDeficit 
        ? deficitMaterials.map(g => g.materialCode)
        : [];

      const result: any = await apiRequest("POST", "/api/admin/orders-to-preparation", {
        excludeMaterialCodes: materialCodesToExclude
      });

      queryClient.invalidateQueries({ queryKey: ["/api/admin/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/order-adjustment-stock"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-orders"] });

      toast({
        title: "상품준비중으로 전송 완료",
        description: result.message || `${result.transferredCount || 0}건의 주문이 상품준비중으로 전송되었습니다.`,
      });
    } catch (error: any) {
      toast({
        title: "전송 실패",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsTransferring(false);
      setDeficitMaterials([]);
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
        const selection = alternateSelections.get(group.materialCode);
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
            "재고합산(잔여재고)": i === 0 ? getAdjustedRemainingStock(group) : "",
            "대체발송": i === 0 ? (selection?.useAlternate ? "O" : "") : "",
            "대체 원재료": i === 0 ? (selection?.alternateMaterialName || "") : "",
            "대체 원재료 재고": i === 0 ? (selection?.alternateMaterialStock || "") : "",
            "대체 수량": i === 0 ? (selection?.alternateQuantity || "") : "",
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
                재고 부족 원재료: {deficitGroups.length}개 그룹 - 대체발송 또는 주문조정 가능
              </span>
            </div>
          )}

          <div className="border rounded-lg overflow-x-auto overflow-y-auto max-h-[600px]">
            <Table className="min-w-[1600px]">
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
                  <TableHead className="min-w-[200px] text-center whitespace-nowrap">대체 원재료</TableHead>
                  <TableHead className="min-w-[90px] text-center whitespace-nowrap">대체<br/>원재료 재고</TableHead>
                  <TableHead className="min-w-[100px] text-center whitespace-nowrap">대체 수량</TableHead>
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
                  adjustmentData.map((group) => {
                    const selection = alternateSelections.get(group.materialCode);
                    const adjustedRemaining = getAdjustedRemainingStock(group);
                    const stillDeficit = isStillDeficit(group);
                    
                    return group.products.map((product, productIndex) => (
                      <TableRow 
                        key={`${group.materialCode}-${product.productCode}`}
                        className={stillDeficit ? "bg-destructive/5" : group.isDeficit ? "bg-yellow-50 dark:bg-yellow-900/10" : ""}
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
                            disabled={!stillDeficit}
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
                              stillDeficit ? "text-destructive" : adjustedRemaining >= 0 ? "text-green-600" : "text-orange-500"
                            }`}
                          >
                            {adjustedRemaining}
                            {selection && selection.alternateQuantity > 0 && (
                              <div className="text-xs text-muted-foreground">
                                (대체: +{selection.alternateQuantity})
                              </div>
                            )}
                          </TableCell>
                        )}
                        {productIndex === 0 && (
                          <TableCell 
                            rowSpan={group.products.length} 
                            className="text-center align-middle border-l"
                          >
                            <Checkbox
                              checked={selection?.useAlternate || false}
                              onCheckedChange={(checked) => handleAlternateCheck(group.materialCode, !!checked)}
                              disabled={!group.isDeficit}
                              data-testid={`checkbox-alternate-${group.materialCode}`}
                            />
                          </TableCell>
                        )}
                        {productIndex === 0 && (
                          <TableCell 
                            rowSpan={group.products.length} 
                            className="text-center align-middle border-l"
                          >
                            {group.isDeficit && selection?.useAlternate ? (
                              <div className="flex items-center gap-1">
                                <Popover 
                                  open={openPopovers.get(group.materialCode) || false} 
                                  onOpenChange={(open) => {
                                    const newPopovers = new Map(openPopovers);
                                    newPopovers.set(group.materialCode, open);
                                    setOpenPopovers(newPopovers);
                                  }}
                                >
                                  <PopoverTrigger asChild>
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      className="w-full justify-start text-left font-normal"
                                      data-testid={`button-select-alternate-${group.materialCode}`}
                                    >
                                      {selection?.alternateMaterialName || (
                                        <span className="text-muted-foreground flex items-center gap-1">
                                          <Search className="h-3 w-3" />
                                          원재료 검색
                                        </span>
                                      )}
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-[300px] p-0" align="start">
                                    <Command>
                                      <CommandInput placeholder="원재료명 또는 코드 검색..." />
                                      <CommandList>
                                        <CommandEmpty>검색 결과가 없습니다.</CommandEmpty>
                                        <CommandGroup heading="원물/반재료">
                                          {rawSemiMaterials
                                            .filter(m => m.materialCode !== group.materialCode && m.currentStock > 0)
                                            .map((material) => (
                                              <CommandItem
                                                key={material.id}
                                                value={`${material.materialName} ${material.materialCode}`}
                                                onSelect={() => handleSelectAlternateMaterial(group.materialCode, material)}
                                              >
                                                <Check
                                                  className={`mr-2 h-4 w-4 ${
                                                    selection?.alternateMaterialCode === material.materialCode
                                                      ? "opacity-100"
                                                      : "opacity-0"
                                                  }`}
                                                />
                                                <div className="flex flex-col">
                                                  <span className="text-sm">{material.materialName}</span>
                                                  <span className="text-xs text-muted-foreground">
                                                    {material.materialCode} | 재고: {material.currentStock}
                                                  </span>
                                                </div>
                                              </CommandItem>
                                            ))}
                                        </CommandGroup>
                                      </CommandList>
                                    </Command>
                                  </PopoverContent>
                                </Popover>
                                {selection?.alternateMaterialCode && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 shrink-0"
                                    onClick={() => handleClearAlternateMaterial(group.materialCode)}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        )}
                        {productIndex === 0 && (
                          <TableCell 
                            rowSpan={group.products.length} 
                            className="text-center align-middle border-l"
                          >
                            {selection?.alternateMaterialCode ? (
                              <span className="font-medium">{selection.alternateMaterialStock}</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        )}
                        {productIndex === 0 && (
                          <TableCell 
                            rowSpan={group.products.length} 
                            className="text-center align-middle border-l"
                          >
                            {selection?.alternateMaterialCode ? (
                              <Input
                                type="number"
                                min={0}
                                max={selection.alternateMaterialStock}
                                value={selection.alternateQuantity || ""}
                                onChange={(e) => handleAlternateQuantityChange(group.materialCode, Number(e.target.value) || 0)}
                                className="w-20 text-center mx-auto"
                                data-testid={`input-alternate-quantity-${group.materialCode}`}
                              />
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ));
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-center py-4">
        <Button 
          size="lg" 
          onClick={handleTransferToPreparation}
          disabled={isTransferring || isLoadingAdjustment || adjustmentData.length === 0}
          data-testid="button-transfer-to-preparation"
        >
          {isTransferring ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              전송 중...
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              상품준비중으로 전송
            </>
          )}
        </Button>
      </div>

      <Dialog open={showDeficitDialog} onOpenChange={setShowDeficitDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              재고 부족 원재료 발견
            </DialogTitle>
            <DialogDescription>
              다음 원재료의 재고가 부족합니다. 어떻게 진행하시겠습니까?
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-2 py-4">
            {deficitMaterials.map(group => (
              <div key={group.materialCode} className="flex justify-between items-center p-3 border rounded-lg bg-destructive/5">
                <div>
                  <span className="font-medium">{group.materialName}</span>
                  <span className="text-sm text-muted-foreground ml-2">({group.materialCode})</span>
                </div>
                <Badge variant="destructive">
                  잔여재고: {getAdjustedRemainingStock(group)}
                </Badge>
              </div>
            ))}
          </div>
          
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={() => setShowDeficitDialog(false)}
              className="w-full sm:w-auto"
            >
              취소 (다시 조정)
            </Button>
            <Button 
              variant="default" 
              onClick={() => executeTransfer(true)}
              className="w-full sm:w-auto"
            >
              부족 상품 제외하고 전송
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
