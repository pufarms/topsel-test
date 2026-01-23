import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, RotateCcw, Play, Trash2, StopCircle, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { PageHeader } from "@/components/admin";
import type { CurrentProduct, Category } from "@shared/schema";
import * as XLSX from "xlsx";

const MIN_COLUMN_WIDTHS: Record<string, number> = {
  checkbox: 40, categoryLarge: 70, categoryMedium: 70, categorySmall: 70, weight: 60,
  productCode: 90, productName: 120, suspendedAt: 100, suspendReason: 150, action: 60,
};

const COLUMNS = ["checkbox", "categoryLarge", "categoryMedium", "categorySmall", "weight", "productCode", "productName", "suspendedAt", "suspendReason", "action"];

const HEADER_LABELS: Record<string, string> = {
  checkbox: "", categoryLarge: "대분류", categoryMedium: "중분류", categorySmall: "소분류", weight: "중량(수량)",
  productCode: "상품코드", productName: "상품명", suspendedAt: "중지일", suspendReason: "중지사유", action: "관리",
};

export default function SuspendedProductsPage() {
  const { toast } = useToast();
  
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchCategoryLarge, setSearchCategoryLarge] = useState<string>("all");
  const [searchCategoryMedium, setSearchCategoryMedium] = useState<string>("all");
  const [searchCategorySmall, setSearchCategorySmall] = useState<string>("all");
  const [searchWeight, setSearchWeight] = useState<string>("");
  const [searchProductCode, setSearchProductCode] = useState<string>("");
  const [searchProductName, setSearchProductName] = useState<string>("");
  
  const [resumeDialogOpen, setResumeDialogOpen] = useState(false);
  const [resumeIds, setResumeIds] = useState<string[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const { data: products = [], isLoading } = useQuery<CurrentProduct[]>({
    queryKey: ["/api/suspended-products"],
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const resumeMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await apiRequest("POST", "/api/suspended-products/resume", { ids });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/suspended-products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/current-products"] });
      toast({ title: "공급 재개 완료", description: data.message });
      setSelectedIds([]);
      setResumeIds([]);
      setResumeDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "공급 재개 실패", description: error.message || "공급 재개 처리에 실패했습니다.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await apiRequest("DELETE", "/api/suspended-products/bulk", { ids });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/suspended-products"] });
      toast({ title: "삭제 완료", description: data.message });
      setSelectedIds([]);
      setDeleteDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "삭제 실패", description: error.message || "삭제 처리에 실패했습니다.", variant: "destructive" });
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
    let result = [...products];
    if (searchCategoryLarge !== "all") result = result.filter(p => p.categoryLarge === searchCategoryLarge);
    if (searchCategoryMedium !== "all") result = result.filter(p => p.categoryMedium === searchCategoryMedium);
    if (searchCategorySmall !== "all") result = result.filter(p => p.categorySmall === searchCategorySmall);
    if (searchWeight) result = result.filter(p => p.weight?.includes(searchWeight));
    if (searchProductCode) result = result.filter(p => p.productCode?.toLowerCase().includes(searchProductCode.toLowerCase()));
    if (searchProductName) result = result.filter(p => p.productName?.toLowerCase().includes(searchProductName.toLowerCase()));
    return result;
  }, [products, searchCategoryLarge, searchCategoryMedium, searchCategorySmall, searchWeight, searchProductCode, searchProductName]);

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

  const handleResumeSelected = () => {
    if (selectedIds.length === 0) {
      toast({ title: "선택 항목 없음", description: "재개할 상품을 선택해주세요.", variant: "destructive" });
      return;
    }
    setResumeIds(selectedIds);
    setResumeDialogOpen(true);
  };

  const handleResumeSingle = (id: string) => {
    setResumeIds([id]);
    setResumeDialogOpen(true);
  };

  const confirmResume = () => {
    resumeMutation.mutate(resumeIds);
  };

  const handleDeleteSelected = () => {
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
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "-";
    const d = new Date(date);
    return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
  };

  const handleDownload = () => {
    if (filteredProducts.length === 0) {
      toast({ title: "다운로드 실패", description: "다운로드할 상품이 없습니다.", variant: "destructive" });
      return;
    }

    const headers = ["대분류", "중분류", "소분류", "중량(수량)", "상품코드", "상품명", "중지일", "중지사유"];
    const rows = filteredProducts.map(p => [
      p.categoryLarge || "",
      p.categoryMedium || "",
      p.categorySmall || "",
      p.weight || "",
      p.productCode || "",
      p.productName || "",
      formatDate(p.suspendedAt),
      p.suspendReason || "",
    ]);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    XLSX.utils.book_append_sheet(wb, ws, "공급중지상품");

    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    XLSX.writeFile(wb, `공급중지상품_${dateStr}.xlsx`);
    toast({ title: "다운로드 완료", description: "엑셀 파일이 다운로드되었습니다." });
  };

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
        title="공급 중지 상품"
        description="공급이 중지된 상품입니다. 공급 재개 시 다시 활성화됩니다."
        icon={StopCircle}
      />

      <Card>
        <CardContent className="p-3">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
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
          </div>
          <div className="flex gap-2 mt-2 justify-end">
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="h-4 w-4 mr-1" /> 초기화
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2 flex-wrap">
        <Button onClick={handleResumeSelected} disabled={selectedIds.length === 0}>
          <Play className="h-4 w-4 mr-1" /> 선택 공급 재개
        </Button>
        <Button variant="destructive" onClick={handleDeleteSelected} disabled={selectedIds.length === 0}>
          <Trash2 className="h-4 w-4 mr-1" /> 선택 삭제
        </Button>
        <Button variant="outline" onClick={handleDownload} data-testid="button-download-excel">
          <Download className="h-4 w-4 mr-1" /> 엑셀 다운로드
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-auto" style={{ maxHeight: "calc(40px + 40px * 15)" }}>
            <table className="w-full text-sm" data-testid="suspended-products-table">
              <thead className="bg-muted sticky top-0 z-10">
                <tr>
                  {COLUMNS.map(col => (
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
                      {COLUMNS.map(col => (
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
                            col === "suspendedAt" ? formatDate(product.suspendedAt) :
                            col === "suspendReason" ? (product.suspendReason || "-") :
                            col === "action" ? (
                              <Button size="sm" variant="outline" onClick={() => handleResumeSingle(product.id)} data-testid={`button-resume-${product.id}`}>
                                재개
                              </Button>
                            ) : null}
                        </td>
                      ))}
                    </tr>
                  );
                })}
                {filteredProducts.length === 0 && (
                  <tr>
                    <td colSpan={COLUMNS.length} className="text-center py-8 text-muted-foreground">
                      공급 중지된 상품이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={resumeDialogOpen} onOpenChange={setResumeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>공급 재개</DialogTitle>
            <DialogDescription>
              {resumeIds.length === 1 ? "이 상품의 공급을 재개하시겠습니까?" : `선택한 ${resumeIds.length}개 상품의 공급을 재개하시겠습니까?`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResumeDialogOpen(false)}>취소</Button>
            <Button onClick={confirmResume} disabled={resumeMutation.isPending}>
              {resumeMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              확인
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>상품 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              선택한 {selectedIds.length}개 상품을 완전히 삭제하시겠습니까?
              <br />
              <span className="text-red-500 font-medium">이 작업은 되돌릴 수 없습니다.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
