import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Download, Search, RotateCcw, Calendar, Package, ArrowRight, CheckCircle, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { PageHeader } from "@/components/admin";
import type { NextWeekProduct, Category } from "@shared/schema";
import * as XLSX from "xlsx";

function getNextWeekPeriod() {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysUntilNextMonday = (8 - dayOfWeek) % 7 || 7;
  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + daysUntilNextMonday);
  const nextFriday = new Date(nextMonday);
  nextFriday.setDate(nextMonday.getDate() + 4);
  return { start: nextMonday, end: nextFriday };
}

function formatDate(date: Date) {
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}.${m}.${d}(${days[date.getDay()]})`;
}

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

export default function NextWeekProductsPage() {
  const { toast } = useToast();
  const period = getNextWeekPeriod();
  
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchCategoryLarge, setSearchCategoryLarge] = useState<string>("all");
  const [searchCategoryMedium, setSearchCategoryMedium] = useState<string>("all");
  const [searchCategorySmall, setSearchCategorySmall] = useState<string>("all");
  const [searchWeight, setSearchWeight] = useState<string>("");
  const [searchProductCode, setSearchProductCode] = useState<string>("");
  const [searchProductName, setSearchProductName] = useState<string>("");
  const [searchSupplyStatus, setSearchSupplyStatus] = useState<string>("all");
  
  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [applyAllDialogOpen, setApplyAllDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [newProductsList, setNewProductsList] = useState<{ productCode: string; productName: string }[]>([]);
  const [isApplying, setIsApplying] = useState(false);


  const { data: products = [], isLoading } = useQuery<NextWeekProduct[]>({
    queryKey: ["/api/next-week-products"],
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });
  
  // Fetch current products to show "현재" badge
  const { data: currentProducts = [] } = useQuery<{ productCode: string }[]>({
    queryKey: ["/api/current-products"],
  });
  
  const currentProductCodes = useMemo(() => {
    return new Set(currentProducts.map(p => p.productCode));
  }, [currentProducts]);

  const checkNewMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await apiRequest("POST", "/api/next-week-products/check-new", { ids });
      return res.json();
    },
  });

  const applyCurrentMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await apiRequest("POST", "/api/next-week-products/apply-current", { ids });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/next-week-products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/current-products"] });
      toast({ title: "적용 완료", description: data.message });
      setSelectedIds([]);
      setApplyDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "적용 실패", description: error.message || "현재 공급가 적용에 실패했습니다.", variant: "destructive" });
    },
  });

  const applyAllMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/next-week-products/apply-current-all", {});
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/next-week-products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/current-products"] });
      toast({ title: "적용 완료", description: data.message });
      setApplyAllDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "적용 실패", description: error.message || "현재 공급가 적용에 실패했습니다.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await apiRequest("DELETE", "/api/next-week-products/bulk", { ids });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/next-week-products"] });
      toast({ title: "삭제 완료", description: data.message });
      setSelectedIds([]);
      setDeleteDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "삭제 실패", description: error.message || "삭제에 실패했습니다.", variant: "destructive" });
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

  const handleApplySelected = async () => {
    if (selectedIds.length === 0) {
      toast({ title: "선택 항목 없음", description: "적용할 상품을 선택해주세요.", variant: "destructive" });
      return;
    }
    try {
      const result = await checkNewMutation.mutateAsync(selectedIds);
      setNewProductsList(result.newProducts);
      setApplyDialogOpen(true);
    } catch (e) {
      toast({ title: "오류", description: "신규 상품 확인에 실패했습니다.", variant: "destructive" });
    }
  };

  const handleApplyAll = async () => {
    const allIds = filteredProducts.map(p => p.id);
    try {
      const result = await checkNewMutation.mutateAsync(allIds);
      setNewProductsList(result.newProducts);
      setApplyAllDialogOpen(true);
    } catch (e) {
      toast({ title: "오류", description: "신규 상품 확인에 실패했습니다.", variant: "destructive" });
    }
  };

  const confirmApplySelected = async () => {
    setIsApplying(true);
    try {
      await applyCurrentMutation.mutateAsync(selectedIds);
    } finally {
      setIsApplying(false);
    }
  };

  const confirmApplyAll = async () => {
    setIsApplying(true);
    try {
      await applyAllMutation.mutateAsync();
    } finally {
      setIsApplying(false);
    }
  };

  const handleDelete = () => {
    if (selectedIds.length === 0) {
      toast({ title: "선택 항목 없음", description: "삭제할 상품을 선택해주세요.", variant: "destructive" });
      return;
    }
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    deleteMutation.mutate(selectedIds);
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
    const periodStr = `${formatDate(period.start)} ~ ${formatDate(period.end)}`;
    
    const headerRow = ["대분류", "중분류", "소분류", "중량(수량)", "상품코드", "상품명", "Start회원 공급가", "Driving회원 공급가", "Top회원 공급가", "공급상태"];
    
    const dataRows = filteredProducts.map(p => [p.categoryLarge, p.categoryMedium, p.categorySmall, p.weight, p.productCode, p.productName, p.startPrice, p.drivingPrice, p.topPrice, p.supplyStatus === "supply" ? "공급" : "공급예정"]);

    const data = [
      ["차주 예상공급가"],
      [`적용 기간: ${periodStr} (출고일 기준)`],
      [],
      headerRow,
      ...dataRows
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "차주예상공급가");
    
    const fileName = `차주_예상공급가_${period.start.toISOString().slice(0,10).replace(/-/g,".")}-${period.end.toISOString().slice(5,10).replace(/-/g,".")}.xlsx`;
    XLSX.writeFile(wb, fileName);
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
        title="차주 예상공급가 상품"
        description="다음 주 적용 예정 공급가입니다."
        icon={Calendar}
      />

      <Card>
        <CardContent className="p-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-600" />
            <span className="font-medium">차주 적용 기간: {formatDate(period.start)} ~ {formatDate(period.end)}</span>
            <span className="text-muted-foreground text-sm">(출고일 기준 적용)</span>
          </div>
        </CardContent>
      </Card>

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

      <Card>
        <CardContent className="p-0">
          <div className="overflow-auto" style={{ maxHeight: "calc(40px + 40px * 15)" }}>
            <table className="w-full text-sm" data-testid="next-week-products-table">
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
                            col === "productCode" ? (
                              <div className="flex items-center gap-1">
                                <span>{product.productCode}</span>
                                {currentProductCodes.has(product.productCode) && (
                                  <Badge variant="default" className="text-[9px] px-1 py-0 h-4 bg-green-500 hover:bg-green-600 shrink-0">
                                    현재
                                  </Badge>
                                )}
                              </div>
                            ) :
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

      <div className="flex gap-2 flex-wrap">
        <Button onClick={handleApplySelected} disabled={selectedIds.length === 0}>
          <ArrowRight className="h-4 w-4 mr-1" /> 선택 항목 현재 공급가 적용
        </Button>
        <Button variant="outline" onClick={handleApplyAll}>
          <ArrowRight className="h-4 w-4 mr-1" /> 전체 현재 공급가 적용
        </Button>
        <Button variant="destructive" onClick={handleDelete} disabled={selectedIds.length === 0}>
          <Trash2 className="h-4 w-4 mr-1" /> 선택 항목 삭제
        </Button>
        <Button variant="outline" onClick={handleDownload}>
          <Download className="h-4 w-4 mr-1" /> 엑셀 다운로드
        </Button>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>상품 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              선택한 {selectedIds.length}개 상품을 삭제하시겠습니까?
              <br />
              <span className="text-destructive font-medium">삭제된 상품은 복구할 수 없습니다.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={applyDialogOpen} onOpenChange={setApplyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>현재 공급가 적용</DialogTitle>
            <DialogDescription>
              선택한 {selectedIds.length}개 상품을 현재 공급가로 적용하시겠습니까?
            </DialogDescription>
          </DialogHeader>
          {newProductsList.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded p-3">
              <div className="font-medium text-blue-800 mb-2">신규 상품 {newProductsList.length}개가 추가됩니다.</div>
              <ul className="text-sm text-blue-700 max-h-32 overflow-auto">
                {newProductsList.map(p => (
                  <li key={p.productCode}>- {p.productCode} ({p.productName})</li>
                ))}
              </ul>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setApplyDialogOpen(false)}>취소</Button>
            <Button onClick={confirmApplySelected} disabled={isApplying}>
              {isApplying && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              확인
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={applyAllDialogOpen} onOpenChange={setApplyAllDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>전체 현재 공급가 적용</DialogTitle>
            <DialogDescription>
              전체 {filteredProducts.length}개 상품을 현재 공급가로 적용하시겠습니까?
            </DialogDescription>
          </DialogHeader>
          {newProductsList.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded p-3">
              <div className="font-medium text-blue-800 mb-2">신규 상품 {newProductsList.length}개가 추가됩니다.</div>
              <ul className="text-sm text-blue-700 max-h-32 overflow-auto">
                {newProductsList.map(p => (
                  <li key={p.productCode}>- {p.productCode} ({p.productName})</li>
                ))}
              </ul>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setApplyAllDialogOpen(false)}>취소</Button>
            <Button onClick={confirmApplyAll} disabled={isApplying}>
              {isApplying && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              확인
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
