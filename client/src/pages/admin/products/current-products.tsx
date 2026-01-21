import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Download, RotateCcw, Package, CheckCircle, Calendar, StopCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { PageHeader } from "@/components/admin";
import type { CurrentProduct, Category } from "@shared/schema";
import * as XLSX from "xlsx";

const MIN_COLUMN_WIDTHS: Record<string, number> = {
  checkbox: 40, categoryLarge: 70, categoryMedium: 70, categorySmall: 70, weight: 60,
  productCode: 90, productName: 120, startPrice: 100, drivingPrice: 100, topPrice: 100, supplyStatus: 80,
};

const COLUMNS = ["checkbox", "categoryLarge", "categoryMedium", "categorySmall", "weight", "productCode", "productName", "startPrice", "drivingPrice", "topPrice", "supplyStatus"];

const HEADER_LABELS: Record<string, string> = {
  checkbox: "", categoryLarge: "대분류", categoryMedium: "중분류", categorySmall: "소분류", weight: "중량(수량)",
  productCode: "상품코드", productName: "상품명", startPrice: "Start회원 공급가", drivingPrice: "Driving회원 공급가",
  topPrice: "Top회원 공급가", supplyStatus: "공급상태",
};

export default function CurrentProductsPage() {
  const { toast } = useToast();
  
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchCategoryLarge, setSearchCategoryLarge] = useState<string>("all");
  const [searchCategoryMedium, setSearchCategoryMedium] = useState<string>("all");
  const [searchCategorySmall, setSearchCategorySmall] = useState<string>("all");
  const [searchWeight, setSearchWeight] = useState<string>("");
  const [searchProductCode, setSearchProductCode] = useState<string>("");
  const [searchProductName, setSearchProductName] = useState<string>("");
  const [searchSupplyStatus, setSearchSupplyStatus] = useState<string>("all");
  
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");


  const { data: products = [], isLoading } = useQuery<CurrentProduct[]>({
    queryKey: ["/api/current-products"],
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const suspendMutation = useMutation({
    mutationFn: async ({ ids, reason }: { ids: string[]; reason: string }) => {
      const res = await apiRequest("POST", "/api/current-products/suspend", { ids, reason });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/current-products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/suspended-products"] });
      toast({ title: "공급 중지 완료", description: data.message });
      setSelectedIds([]);
      setSuspendDialogOpen(false);
      setSuspendReason("");
    },
    onError: () => {
      toast({ title: "공급 중지 실패", description: "공급 중지 처리에 실패했습니다.", variant: "destructive" });
    },
  });

  const largeCategories = useMemo(() => categories.filter(c => c.level === "large"), [categories]);
  const mediumCategories = useMemo(() => {
    if (searchCategoryLarge === "all") return categories.filter(c => c.level === "medium");
    const parent = categories.find(c => c.name === searchCategoryLarge && c.level === "large");
    return categories.filter(c => c.level === "medium" && c.parentId === parent?.id);
  }, [categories, searchCategoryLarge]);
  const smallCategories = useMemo(() => {
    if (searchCategoryMedium === "all") return categories.filter(c => c.level === "small");
    const parent = categories.find(c => c.name === searchCategoryMedium && c.level === "medium");
    return categories.filter(c => c.level === "small" && c.parentId === parent?.id);
  }, [categories, searchCategoryMedium]);

  const filteredProducts = useMemo(() => {
    let result = products.filter(p => p.supplyStatus !== "suspended");
    if (searchCategoryLarge !== "all") result = result.filter(p => p.categoryLarge === searchCategoryLarge);
    if (searchCategoryMedium !== "all") result = result.filter(p => p.categoryMedium === searchCategoryMedium);
    if (searchCategorySmall !== "all") result = result.filter(p => p.categorySmall === searchCategorySmall);
    if (searchWeight) result = result.filter(p => p.weight?.includes(searchWeight));
    if (searchProductCode) result = result.filter(p => p.productCode?.toLowerCase().includes(searchProductCode.toLowerCase()));
    if (searchProductName) result = result.filter(p => p.productName?.toLowerCase().includes(searchProductName.toLowerCase()));
    if (searchSupplyStatus !== "all") result = result.filter(p => p.supplyStatus === searchSupplyStatus);
    return result;
  }, [products, searchCategoryLarge, searchCategoryMedium, searchCategorySmall, searchWeight, searchProductCode, searchProductName, searchSupplyStatus]);

  const stats = useMemo(() => {
    const all = products.filter(p => p.supplyStatus !== "suspended");
    return {
      total: all.length,
      supply: all.filter(p => p.supplyStatus === "supply").length,
      scheduled: all.filter(p => p.supplyStatus === "scheduled").length,
    };
  }, [products]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredProducts.map(p => p.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(i => i !== id));
    }
  };

  const handleSuspend = () => {
    if (selectedIds.length === 0) {
      toast({ title: "선택 항목 없음", description: "공급 중지할 상품을 선택해주세요.", variant: "destructive" });
      return;
    }
    setSuspendDialogOpen(true);
  };

  const confirmSuspend = () => {
    suspendMutation.mutate({ ids: selectedIds, reason: suspendReason });
  };

  const handleReset = () => {
    setSearchCategoryLarge("all");
    setSearchCategoryMedium("all");
    setSearchCategorySmall("all");
    setSearchWeight("");
    setSearchProductCode("");
    setSearchProductName("");
    setSearchSupplyStatus("all");
  };

  const handleDownload = () => {
    const headerRow = ["대분류", "중분류", "소분류", "중량(수량)", "상품코드", "상품명", "Start회원 공급가", "Driving회원 공급가", "Top회원 공급가", "공급상태"];
    
    const dataRows = filteredProducts.map(p => [p.categoryLarge, p.categoryMedium, p.categorySmall, p.weight, p.productCode, p.productName, p.startPrice, p.drivingPrice, p.topPrice, p.supplyStatus === "supply" ? "공급" : "공급예정"]);

    const data = [
      ["현재 공급가 상품"],
      [],
      headerRow,
      ...dataRows
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "현재공급가");
    
    const today = new Date().toISOString().slice(0,10).replace(/-/g,".");
    XLSX.writeFile(wb, `현재_공급가_${today}.xlsx`);
    toast({ title: "다운로드 완료", description: "엑셀 파일이 다운로드되었습니다." });
  };

  const columns = COLUMNS;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4">
      <PageHeader
        title="현재 공급가 상품"
        description="현재 적용 중인 공급가입니다. 주문 정산 시 이 가격이 적용됩니다."
        icon={Package}
      />

      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3 flex items-center gap-3">
            <Package className="h-8 w-8 text-gray-500" />
            <div>
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-sm text-muted-foreground">전체</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-green-500" />
            <div>
              <div className="text-2xl font-bold">{stats.supply}</div>
              <div className="text-sm text-muted-foreground">공급</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 flex items-center gap-3">
            <Calendar className="h-8 w-8 text-yellow-500" />
            <div>
              <div className="text-2xl font-bold">{stats.scheduled}</div>
              <div className="text-sm text-muted-foreground">공급예정</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-3">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
            <Select value={searchCategoryLarge} onValueChange={setSearchCategoryLarge}>
              <SelectTrigger className="h-9"><SelectValue placeholder="대분류" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                {largeCategories.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={searchCategoryMedium} onValueChange={setSearchCategoryMedium}>
              <SelectTrigger className="h-9"><SelectValue placeholder="중분류" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                {mediumCategories.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={searchCategorySmall} onValueChange={setSearchCategorySmall}>
              <SelectTrigger className="h-9"><SelectValue placeholder="소분류" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                {smallCategories.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input placeholder="중량" value={searchWeight} onChange={e => setSearchWeight(e.target.value)} className="h-9" />
            <Input placeholder="상품코드" value={searchProductCode} onChange={e => setSearchProductCode(e.target.value)} className="h-9" />
            <Input placeholder="상품명" value={searchProductName} onChange={e => setSearchProductName(e.target.value)} className="h-9" />
            <Select value={searchSupplyStatus} onValueChange={setSearchSupplyStatus}>
              <SelectTrigger className="h-9"><SelectValue placeholder="공급상태" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                <SelectItem value="supply">공급</SelectItem>
                <SelectItem value="scheduled">공급예정</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 mt-2 justify-end">
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="h-4 w-4 mr-1" /> 초기화
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2 flex-wrap">
        <Button variant="destructive" onClick={handleSuspend} disabled={selectedIds.length === 0}>
          <StopCircle className="h-4 w-4 mr-1" /> 선택 공급중지
        </Button>
        <Button variant="outline" onClick={handleDownload}>
          <Download className="h-4 w-4 mr-1" /> 엑셀 다운로드
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-auto" style={{ maxHeight: "calc(40px + 40px * 15)" }}>
            <table className="w-full text-sm" data-testid="current-products-table">
              <thead className="bg-muted sticky top-0 z-10">
                <tr>
                  {columns.map((col: string) => (
                    <th
                      key={col}
                      className={`px-3 py-2 text-left whitespace-nowrap border-b ${col === "checkbox" ? "sticky left-0 z-20 bg-muted" : ""}`}
                      style={{ minWidth: MIN_COLUMN_WIDTHS[col] }}
                    >
                      {col === "checkbox" ? (
                        <Checkbox
                          checked={selectedIds.length === filteredProducts.length && filteredProducts.length > 0}
                          onCheckedChange={handleSelectAll}
                          data-testid="checkbox-select-all"
                        />
                      ) : HEADER_LABELS[col]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product, idx) => {
                  const isSelected = selectedIds.includes(product.id);
                  return (
                    <tr
                      key={product.id}
                      className={isSelected ? "bg-blue-100" : idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
                      data-testid={`row-product-${product.id}`}
                    >
                      {columns.map((col: string) => (
                        <td
                          key={col}
                          className={`px-3 py-2 border-b whitespace-nowrap ${col === "checkbox" ? "sticky left-0 z-10 border-r-2" : ""}`}
                          style={{
                            minWidth: MIN_COLUMN_WIDTHS[col],
                            backgroundColor: col === "checkbox" ? (isSelected ? "#DBEAFE" : idx % 2 === 0 ? "#ffffff" : "#f9fafb") : undefined,
                          }}
                        >
                          {col === "checkbox" ? (
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) => handleSelectOne(product.id, !!checked)}
                              data-testid={`checkbox-row-${product.id}`}
                            />
                          ) : col === "categoryLarge" ? product.categoryLarge :
                            col === "categoryMedium" ? product.categoryMedium :
                            col === "categorySmall" ? product.categorySmall :
                            col === "weight" ? product.weight :
                            col === "productCode" ? product.productCode :
                            col === "productName" ? product.productName :
                            col === "startPrice" ? product.startPrice?.toLocaleString() :
                            col === "drivingPrice" ? product.drivingPrice?.toLocaleString() :
                            col === "topPrice" ? product.topPrice?.toLocaleString() :
                            col === "supplyStatus" ? (
                              <Badge variant={product.supplyStatus === "supply" ? "default" : "secondary"} className={product.supplyStatus === "supply" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}>
                                {product.supplyStatus === "supply" ? "공급" : "공급예정"}
                              </Badge>
                            ) : null}
                        </td>
                      ))}
                    </tr>
                  );
                })}
                {filteredProducts.length === 0 && (
                  <tr>
                    <td colSpan={columns.length} className="text-center py-8 text-muted-foreground">
                      상품이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={suspendDialogOpen} onOpenChange={setSuspendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>공급 중지 설정</DialogTitle>
            <DialogDescription>
              선택한 {selectedIds.length}개 상품을 공급 중지합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium">중지 사유</label>
            <Input
              placeholder="예: 시즌 종료, 품질 이슈, 재고 소진"
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              className="mt-1"
              data-testid="input-suspend-reason"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendDialogOpen(false)}>취소</Button>
            <Button variant="destructive" onClick={confirmSuspend} disabled={suspendMutation.isPending}>
              {suspendMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              공급 중지
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
