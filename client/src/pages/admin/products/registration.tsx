import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Plus, Trash2, Upload, Download, Calculator, Send, StopCircle, Search, RotateCcw, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { PageHeader } from "@/components/admin";
import type { ProductRegistration, Category } from "@shared/schema";
import * as XLSX from "xlsx";

const COLUMN_KEYS = [
  "checkbox", "categoryLarge", "categoryMedium", "categorySmall", "weight", "productCode", "productName",
  "sourceProduct", "sourcePrice", "lossRate", "sourceWeight", "unitPrice", "sourceProductTotal",
  "boxCost", "materialCost", "outerBoxCost", "wrappingCost", "laborCost", "shippingCost", "totalCost",
  "startMarginRate", "startMargin", "startPrice", "drivingMarginRate", "drivingMargin", "drivingPrice",
  "topMarginRate", "topMargin", "topPrice", "save"
] as const;

const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  checkbox: 40, categoryLarge: 70, categoryMedium: 70, categorySmall: 70, weight: 50,
  productCode: 90, productName: 140, sourceProduct: 90, sourcePrice: 80, lossRate: 50,
  sourceWeight: 60, unitPrice: 80, sourceProductTotal: 90, boxCost: 60, materialCost: 60,
  outerBoxCost: 60, wrappingCost: 60, laborCost: 60, shippingCost: 60, totalCost: 90,
  startMarginRate: 60, startMargin: 70, startPrice: 90, drivingMarginRate: 60, drivingMargin: 70,
  drivingPrice: 90, topMarginRate: 60, topMargin: 70, topPrice: 90, save: 50
};

interface EnrichedCategory extends Category {
  childCount: number;
  productCount: number;
  parentName: string | null;
  grandparentName: string | null;
}

type ProductRow = ProductRegistration & { isNew?: boolean };

export default function ProductRegistrationPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
  const [searchCategoryLarge, setSearchCategoryLarge] = useState<string>("all");
  const [searchCategoryMedium, setSearchCategoryMedium] = useState<string>("all");
  const [searchCategorySmall, setSearchCategorySmall] = useState<string>("all");
  const [searchWeight, setSearchWeight] = useState<string>("all");
  const [searchName, setSearchName] = useState("");
  const [showTempOnly, setShowTempOnly] = useState(false);
  const [tempProducts, setTempProducts] = useState<ProductRow[]>([]);
  
  const [bulkWeight, setBulkWeight] = useState<string>("");
  const [bulkSourcePrice, setBulkSourcePrice] = useState<string>("");
  const [bulkLossRate, setBulkLossRate] = useState<string>("");
  const [bulkSourceWeight, setBulkSourceWeight] = useState<string>("");
  const [bulkBoxCost, setBulkBoxCost] = useState<string>("");
  const [bulkMaterialCost, setBulkMaterialCost] = useState<string>("");
  const [bulkOuterBoxCost, setBulkOuterBoxCost] = useState<string>("");
  const [bulkWrappingCost, setBulkWrappingCost] = useState<string>("");
  const [bulkLaborCost, setBulkLaborCost] = useState<string>("");
  const [bulkShippingCost, setBulkShippingCost] = useState<string>("");
  const [bulkStartMargin, setBulkStartMargin] = useState<string>("");
  const [bulkDrivingMargin, setBulkDrivingMargin] = useState<string>("");
  const [bulkTopMargin, setBulkTopMargin] = useState<string>("");

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({ ...DEFAULT_COLUMN_WIDTHS });
  const [resizing, setResizing] = useState<{ key: string; startX: number; startWidth: number } | null>(null);

  const handleResizeStart = useCallback((e: React.MouseEvent, key: string) => {
    e.preventDefault();
    e.stopPropagation();
    setResizing({
      key,
      startX: e.clientX,
      startWidth: columnWidths[key] || DEFAULT_COLUMN_WIDTHS[key] || 80
    });
  }, [columnWidths]);

  useEffect(() => {
    if (!resizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - resizing.startX;
      const newWidth = Math.max(30, resizing.startWidth + diff);
      setColumnWidths(prev => ({ ...prev, [resizing.key]: newWidth }));
    };

    const handleMouseUp = () => {
      setResizing(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizing]);

  const { data: categories = [] } = useQuery<EnrichedCategory[]>({
    queryKey: ["/api/categories"],
  });

  const largeCategories = categories.filter(c => c.level === "large");
  const mediumCategories = categories.filter(c => c.level === "medium");
  const smallCategories = categories.filter(c => c.level === "small");

  const getFilteredMedium = (largeId: string) => {
    if (largeId === "all") return mediumCategories;
    const largeCat = largeCategories.find(c => c.id === largeId);
    return mediumCategories.filter(m => m.parentId === largeId || (largeCat && m.parentName === largeCat.name));
  };

  const getFilteredSmall = (mediumId: string) => {
    if (mediumId === "all") return smallCategories;
    const mediumCat = mediumCategories.find(c => c.id === mediumId);
    return smallCategories.filter(s => s.parentId === mediumId || (mediumCat && s.parentName === mediumCat.name));
  };

  const allWeights = Array.from(new Set([
    ...tempProducts.map(p => p.weight).filter(w => w != null && w !== ""),
    ...products.filter(p => !p.id.startsWith("new-")).map(p => p.weight).filter(w => w != null && w !== "")
  ])).sort((a, b) => parseFloat(String(a)) - parseFloat(String(b)));

  const applyFilters = (data: ProductRow[]) => {
    let filtered = data;
    if (searchCategoryLarge !== "all") {
      const largeName = largeCategories.find(c => c.id === searchCategoryLarge)?.name;
      filtered = filtered.filter(p => p.categoryLarge === largeName);
    }
    if (searchCategoryMedium !== "all") {
      const mediumName = mediumCategories.find(c => c.id === searchCategoryMedium)?.name;
      filtered = filtered.filter(p => p.categoryMedium === mediumName);
    }
    if (searchCategorySmall !== "all") {
      const smallName = smallCategories.find(c => c.id === searchCategorySmall)?.name;
      filtered = filtered.filter(p => p.categorySmall === smallName);
    }
    if (searchWeight !== "all") {
      filtered = filtered.filter(p => String(p.weight) === searchWeight);
    }
    if (searchName) {
      const searchWords = searchName.trim().toLowerCase().split(/\s+/);
      filtered = filtered.filter(p => {
        if (!p.productName) return false;
        const productWords = p.productName.toLowerCase().split(/\s+/);
        return searchWords.every(sw => productWords.some(pw => pw === sw));
      });
    }
    return filtered;
  };

  const searchMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/product-registrations?status=active&_t=${Date.now()}`, {
        cache: 'no-store'
      });
      return res.json();
    },
    onSuccess: (data: ProductRegistration[]) => {
      const allData = [...tempProducts, ...data.filter(d => !tempProducts.some(t => t.id === d.id))];
      const filtered = applyFilters(allData);
      setProducts(filtered);
      setSelectedIds([]);
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/product-registrations/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "업로드 완료", description: `${data.created}개 상품이 추가되었습니다.` });
      if (data.errors?.length > 0) {
        toast({ variant: "destructive", title: "일부 오류", description: `${data.errors.length}개 행에서 오류 발생` });
      }
      searchMutation.mutate();
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "업로드 실패", description: error.message });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      await apiRequest("PUT", `/api/product-registrations/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/product-registrations"] });
    },
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ ids, data }: { ids: string[]; data: any }) => {
      await apiRequest("PUT", "/api/product-registrations/bulk", { ids, data });
    },
    onSuccess: () => {
      toast({ title: "일괄 적용 완료" });
      searchMutation.mutate();
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "오류", description: error.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const existingIds = ids.filter(id => !id.startsWith("new-"));
      if (existingIds.length > 0) {
        await apiRequest("DELETE", "/api/product-registrations/bulk", { ids: existingIds });
      }
      return ids;
    },
    onSuccess: (deletedIds: string[]) => {
      toast({ title: "삭제 완료" });
      setDeleteDialogOpen(false);
      setSelectedIds([]);
      setProducts(prev => prev.filter(p => !deletedIds.includes(p.id)));
      setTempProducts(prev => prev.filter(p => !deletedIds.includes(p.id)));
    },
  });

  const suspendMutation = useMutation({
    mutationFn: async ({ ids, reason }: { ids: string[]; reason: string }) => {
      await apiRequest("POST", "/api/product-registrations/suspend", { ids, reason });
    },
    onSuccess: () => {
      toast({ title: "공급 중지 설정 완료" });
      setSuspendDialogOpen(false);
      setSuspendReason("");
      setSelectedIds([]);
      searchMutation.mutate();
    },
  });

  const sendMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await apiRequest("POST", "/api/product-registrations/send-to-next-week", { ids });
      return res;
    },
    onSuccess: (data: any) => {
      toast({ title: "전송 완료", description: data.message });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "전송 실패", description: error.message });
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadMutation.mutate(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDownloadTemplate = () => {
    window.open("/api/product-registrations/template", "_blank");
  };

  const handleSearch = () => {
    searchMutation.mutate();
  };

  const handleBulkReset = () => {
    setBulkWeight("");
    setBulkSourcePrice("");
    setBulkLossRate("");
    setBulkSourceWeight("");
    setBulkBoxCost("");
    setBulkMaterialCost("");
    setBulkOuterBoxCost("");
    setBulkWrappingCost("");
    setBulkLaborCost("");
    setBulkShippingCost("");
    setBulkStartMargin("");
    setBulkDrivingMargin("");
    setBulkTopMargin("");
  };

  const handleShowTempList = () => {
    const tempOnly = tempProducts.filter(p => {
      const hasNoPrice = !p.startPrice && !p.drivingPrice && !p.topPrice;
      return hasNoPrice;
    });
    setProducts(tempOnly);
    setShowTempOnly(true);
    setSelectedIds([]);
  };

  const handleShowAll = () => {
    setShowTempOnly(false);
    searchMutation.mutate();
  };

  const handleBulkApply = () => {
    if (selectedIds.length === 0) {
      toast({ variant: "destructive", title: "오류", description: "상품을 선택해주세요" });
      return;
    }
    const data: any = {};
    if (bulkWeight) data.weight = bulkWeight;
    if (bulkSourcePrice) data.sourcePrice = parseInt(bulkSourcePrice);
    if (bulkLossRate) data.lossRate = parseInt(bulkLossRate);
    if (bulkSourceWeight) data.sourceWeight = parseInt(bulkSourceWeight);
    if (bulkBoxCost) data.boxCost = parseInt(bulkBoxCost);
    if (bulkMaterialCost) data.materialCost = parseInt(bulkMaterialCost);
    if (bulkOuterBoxCost) data.outerBoxCost = parseInt(bulkOuterBoxCost);
    if (bulkWrappingCost) data.wrappingCost = parseInt(bulkWrappingCost);
    if (bulkLaborCost) data.laborCost = parseInt(bulkLaborCost);
    if (bulkShippingCost) data.shippingCost = parseInt(bulkShippingCost);
    if (bulkStartMargin) data.startMarginRate = parseFloat(bulkStartMargin);
    if (bulkDrivingMargin) data.drivingMarginRate = parseFloat(bulkDrivingMargin);
    if (bulkTopMargin) data.topMarginRate = parseFloat(bulkTopMargin);
    
    if (Object.keys(data).length === 0) {
      toast({ variant: "destructive", title: "오류", description: "적용할 값을 입력해주세요" });
      return;
    }

    const newRowIds = selectedIds.filter(id => id.startsWith("new-"));
    const existingRowIds = selectedIds.filter(id => !id.startsWith("new-"));

    if (newRowIds.length > 0) {
      setProducts(prev => prev.map(p => {
        if (newRowIds.includes(p.id)) {
          return { ...p, ...data };
        }
        return p;
      }));
    }

    if (existingRowIds.length > 0) {
      bulkUpdateMutation.mutate({ ids: existingRowIds, data });
    } else {
      toast({ title: "일괄 적용 완료" });
    }
  };

  const handleAddRow = () => {
    const newRow: ProductRow = {
      id: `new-${Date.now()}`,
      status: "active",
      suspendedAt: null,
      suspendReason: null,
      categoryLarge: null,
      categoryMedium: null,
      categorySmall: null,
      weight: "",
      productCode: "",
      productName: "",
      sourceProduct: null,
      sourcePrice: null,
      lossRate: 0,
      sourceWeight: null,
      unitPrice: null,
      sourceProductTotal: null,
      boxCost: 0,
      materialCost: 0,
      outerBoxCost: 0,
      wrappingCost: 0,
      laborCost: 0,
      shippingCost: 0,
      totalCost: null,
      startMarginRate: null,
      startPrice: null,
      startMargin: null,
      drivingMarginRate: null,
      drivingPrice: null,
      drivingMargin: null,
      topMarginRate: null,
      topPrice: null,
      topMargin: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      isNew: true,
    };
    setProducts([...products, newRow]);
    setTempProducts(prev => [...prev, newRow]);
  };

  const createMutation = useMutation({
    mutationFn: async (data: any): Promise<ProductRegistration> => {
      const res = await apiRequest("POST", "/api/product-registrations", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/product-registrations"] });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "저장 실패", description: error.message });
    },
  });

  const handleCellChange = (index: number, field: keyof ProductRow, value: any) => {
    const updated = [...products];
    (updated[index] as any)[field] = value;
    
    const p = updated[index];
    const sourcePrice = p.sourcePrice || 0;
    const lossRate = p.lossRate || 0;
    const sourceWeight = p.sourceWeight || 1;
    const weight = parseFloat(p.weight) || 0;
    const unitPrice = sourceWeight > 0 ? Math.round((sourcePrice * (1 + lossRate / 100)) / sourceWeight) : 0;
    const sourceProductTotal = Math.round(weight * unitPrice);
    
    const totalCost = sourceProductTotal + (p.boxCost || 0) + (p.materialCost || 0) + (p.outerBoxCost || 0) + (p.wrappingCost || 0) + (p.laborCost || 0) + (p.shippingCost || 0);
    
    p.unitPrice = unitPrice;
    p.sourceProductTotal = sourceProductTotal;
    p.totalCost = totalCost;
    
    if (p.startMarginRate != null) {
      p.startPrice = Math.round(totalCost * (1 + p.startMarginRate / 100));
      p.startMargin = p.startPrice - totalCost;
    }
    if (p.drivingMarginRate != null) {
      p.drivingPrice = Math.round(totalCost * (1 + p.drivingMarginRate / 100));
      p.drivingMargin = p.drivingPrice - totalCost;
    }
    if (p.topMarginRate != null) {
      p.topPrice = Math.round(totalCost * (1 + p.topMarginRate / 100));
      p.topMargin = p.topPrice - totalCost;
    }
    
    setProducts(updated);
    
    if (p.id.startsWith("new-")) {
      setTempProducts(prev => prev.map(t => t.id === p.id ? { ...p } : t));
    }
  };

  const handleSaveRow = async (index: number) => {
    const p = products[index];
    if (!p.productCode || !p.productName || !p.weight) {
      toast({ variant: "destructive", title: "오류", description: "상품코드, 상품명, 중량은 필수입니다" });
      return;
    }
    
    if (!p.startPrice || !p.drivingPrice || !p.topPrice) {
      toast({ variant: "destructive", title: "오류", description: "공급가(Start/Driving/Top) 3개 모두 입력해야 합니다" });
      return;
    }
    
    if (p.isNew) {
      try {
        const res = await createMutation.mutateAsync({
          categoryLarge: p.categoryLarge,
          categoryMedium: p.categoryMedium,
          categorySmall: p.categorySmall,
          weight: p.weight,
          productCode: p.productCode,
          productName: p.productName,
          sourceProduct: p.sourceProduct,
          sourcePrice: p.sourcePrice,
          lossRate: p.lossRate,
          sourceWeight: p.sourceWeight,
          boxCost: p.boxCost,
          materialCost: p.materialCost,
          outerBoxCost: p.outerBoxCost,
          wrappingCost: p.wrappingCost,
          laborCost: p.laborCost,
          shippingCost: p.shippingCost,
          startMarginRate: p.startMarginRate,
          drivingMarginRate: p.drivingMarginRate,
          topMarginRate: p.topMarginRate,
        });
        const updated = [...products];
        updated[index] = { ...res, isNew: false };
        setProducts(updated);
        toast({ title: "저장 완료", description: "상품이 등록되었습니다" });
      } catch (err) {
        // Error handled in mutation
      }
    } else {
      updateMutation.mutate({ id: p.id, data: p });
      toast({ title: "저장 완료", description: "상품이 수정되었습니다" });
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === products.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(products.map(p => p.id));
    }
  };

  const handleSend = () => {
    const ids = selectedIds.length > 0 ? selectedIds : products.map(p => p.id);
    sendMutation.mutate(ids);
  };

  const formatNumber = (n: number | null | undefined) => n != null ? n.toLocaleString() : "";

  const getCellClass = (value: any, isCalculated: boolean) => {
    if (isCalculated) return "bg-yellow-100 dark:bg-yellow-900/30 cursor-not-allowed";
    if (value === null || value === undefined || value === "") return "bg-red-100 dark:bg-red-900/30";
    return "";
  };

  return (
    <div className="space-y-3 p-4">
      <PageHeader
        title="상품등록 (공급가 계산)"
        description="상품 정보를 입력하고 공급가를 계산하여 차주 예상공급가로 전송합니다"
        icon={Calculator}
      />

      <Card>
        <CardContent className="p-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Upload className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">엑셀 업로드 (임시등록)</span>
              <span className="text-xs text-muted-foreground">* 업로드 시 기본정보(대분류~상품명)가 테이블에 추가됩니다.</span>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} data-testid="upload-zone">
                <Upload className="h-4 w-4 mr-1" />
                엑셀 파일 선택
              </Button>
              <Button size="sm" variant="outline" onClick={handleDownloadTemplate} data-testid="button-download-template">
                <Download className="h-4 w-4 mr-1" />
                양식 다운로드
              </Button>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleFileUpload}
            data-testid="input-file"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Search className="h-4 w-4" />
            기존 상품 검색 (수정용)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <Select value={searchCategoryLarge} onValueChange={setSearchCategoryLarge}>
              <SelectTrigger className="h-9" data-testid="select-search-large">
                <SelectValue placeholder="대분류" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                {largeCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={searchCategoryMedium} onValueChange={setSearchCategoryMedium}>
              <SelectTrigger className="h-9" data-testid="select-search-medium">
                <SelectValue placeholder="중분류" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                {getFilteredMedium(searchCategoryLarge).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={searchCategorySmall} onValueChange={setSearchCategorySmall}>
              <SelectTrigger className="h-9" data-testid="select-search-small">
                <SelectValue placeholder="소분류" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                {getFilteredSmall(searchCategoryMedium).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={searchWeight} onValueChange={setSearchWeight}>
              <SelectTrigger className="h-9" data-testid="select-search-weight">
                <SelectValue placeholder="중량(수량)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                {allWeights.map(w => <SelectItem key={String(w)} value={String(w)}>{String(w)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input placeholder="상품명" value={searchName} onChange={e => setSearchName(e.target.value)} className="h-9" data-testid="input-search-name" />
          </div>
          <div className="flex gap-2 mt-2">
            <Button size="sm" onClick={handleSearch} disabled={searchMutation.isPending} data-testid="button-search">
              {searchMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              <Search className="h-4 w-4 mr-1" />
              검색
            </Button>
            {showTempOnly ? (
              <Button size="sm" variant="secondary" onClick={handleShowAll} data-testid="button-show-all">
                전체 보기
              </Button>
            ) : (
              <Button size="sm" variant="secondary" onClick={handleShowTempList} data-testid="button-show-temp">
                임시등록 리스트 보기
              </Button>
            )}
            {tempProducts.length > 0 && (
              <Badge variant="outline" className="ml-2">임시등록: {tempProducts.length}건</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-3">
          <CardTitle className="text-sm">일괄 적용 (선택한 상품에 한꺼번에 값 적용)</CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          {/* 1행: 중량 ~ 아웃박스 */}
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <label className="flex items-center gap-1">
              <span className="text-xs whitespace-nowrap text-muted-foreground">중량:</span>
              <Input 
                value={bulkWeight} 
                onChange={e => {
                  const val = e.target.value;
                  if (val === "" || /^\d*\.?\d{0,1}$/.test(val)) {
                    setBulkWeight(val);
                  }
                }} 
                className="h-7 w-16 px-2 text-xs" 
                type="text"
                inputMode="decimal"
                data-testid="input-bulk-weight" 
              />
            </label>
            <label className="flex items-center gap-1">
              <span className="text-xs whitespace-nowrap text-muted-foreground">기준가:</span>
              <Input value={bulkSourcePrice} onChange={e => setBulkSourcePrice(e.target.value)} className="h-7 w-20 px-2 text-xs" type="number" data-testid="input-bulk-source-price" />
            </label>
            <label className="flex items-center gap-1">
              <span className="text-xs whitespace-nowrap text-muted-foreground">로스율%:</span>
              <Input value={bulkLossRate} onChange={e => setBulkLossRate(e.target.value)} className="h-7 w-14 px-2 text-xs" type="number" data-testid="input-bulk-loss-rate" />
            </label>
            <label className="flex items-center gap-1">
              <span className="text-xs whitespace-nowrap text-muted-foreground">기준중량:</span>
              <Input value={bulkSourceWeight} onChange={e => setBulkSourceWeight(e.target.value)} className="h-7 w-14 px-2 text-xs" type="number" data-testid="input-bulk-source-weight" />
            </label>
            <label className="flex items-center gap-1">
              <span className="text-xs whitespace-nowrap text-muted-foreground">박스비:</span>
              <Input value={bulkBoxCost} onChange={e => setBulkBoxCost(e.target.value)} className="h-7 w-16 px-2 text-xs" type="number" />
            </label>
            <label className="flex items-center gap-1">
              <span className="text-xs whitespace-nowrap text-muted-foreground">자재비:</span>
              <Input value={bulkMaterialCost} onChange={e => setBulkMaterialCost(e.target.value)} className="h-7 w-16 px-2 text-xs" type="number" />
            </label>
            <label className="flex items-center gap-1">
              <span className="text-xs whitespace-nowrap text-muted-foreground">아웃박스:</span>
              <Input value={bulkOuterBoxCost} onChange={e => setBulkOuterBoxCost(e.target.value)} className="h-7 w-16 px-2 text-xs" type="number" />
            </label>
          </div>
          
          {/* 2행: 보자기 ~ Top마진율 */}
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <label className="flex items-center gap-1">
              <span className="text-xs whitespace-nowrap text-muted-foreground">보자기:</span>
              <Input value={bulkWrappingCost} onChange={e => setBulkWrappingCost(e.target.value)} className="h-7 w-16 px-2 text-xs" type="number" />
            </label>
            <label className="flex items-center gap-1">
              <span className="text-xs whitespace-nowrap text-muted-foreground">작업비:</span>
              <Input value={bulkLaborCost} onChange={e => setBulkLaborCost(e.target.value)} className="h-7 w-16 px-2 text-xs" type="number" />
            </label>
            <label className="flex items-center gap-1">
              <span className="text-xs whitespace-nowrap text-muted-foreground">택배비:</span>
              <Input value={bulkShippingCost} onChange={e => setBulkShippingCost(e.target.value)} className="h-7 w-16 px-2 text-xs" type="number" />
            </label>
            <label className="flex items-center gap-1">
              <span className="text-xs whitespace-nowrap text-muted-foreground">S마진율%:</span>
              <Input value={bulkStartMargin} onChange={e => setBulkStartMargin(e.target.value)} className="h-7 w-14 px-2 text-xs" type="number" step="0.1" data-testid="input-bulk-start-margin" />
            </label>
            <label className="flex items-center gap-1">
              <span className="text-xs whitespace-nowrap text-muted-foreground">D마진율%:</span>
              <Input value={bulkDrivingMargin} onChange={e => setBulkDrivingMargin(e.target.value)} className="h-7 w-14 px-2 text-xs" type="number" step="0.1" data-testid="input-bulk-driving-margin" />
            </label>
            <label className="flex items-center gap-1">
              <span className="text-xs whitespace-nowrap text-muted-foreground">T마진율%:</span>
              <Input value={bulkTopMargin} onChange={e => setBulkTopMargin(e.target.value)} className="h-7 w-14 px-2 text-xs" type="number" step="0.1" data-testid="input-bulk-top-margin" />
            </label>
            <div className="flex-1" />
            <Button size="sm" variant="outline" onClick={handleBulkReset} className="h-7 text-xs" data-testid="button-bulk-reset">
              <RotateCcw className="h-3 w-3 mr-1" />
              초기화
            </Button>
            <Button size="sm" onClick={handleBulkApply} disabled={bulkUpdateMutation.isPending} className="h-7 text-xs" data-testid="button-bulk-apply">
              {bulkUpdateMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              선택한 상품에 일괄 적용
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={handleAddRow} data-testid="button-add-row">
          <Plus className="h-4 w-4 mr-1" />
          새 행 추가
        </Button>
        <Button size="sm" variant="outline" onClick={() => setDeleteDialogOpen(true)} disabled={selectedIds.length === 0} data-testid="button-delete-selected">
          <Trash2 className="h-4 w-4 mr-1" />
          선택 삭제
        </Button>
        <Button size="sm" variant="outline" onClick={() => setSuspendDialogOpen(true)} disabled={selectedIds.length === 0} data-testid="button-suspend">
          <StopCircle className="h-4 w-4 mr-1" />
          공급 중지 설정
        </Button>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto overflow-y-auto border rounded-lg" style={{ maxHeight: 'calc(40px + (36px * 15))' }}>
          <table className="text-xs border-collapse" style={{ tableLayout: 'fixed' }}>
            <thead className="bg-muted/50 sticky top-0 z-20">
              <tr>
                <th className="px-2 py-2 text-center sticky left-0 z-30 bg-muted border-r-2 border-gray-300 dark:border-gray-600" style={{ width: columnWidths.checkbox }}>
                  <Checkbox checked={selectedIds.length === products.length && products.length > 0} onCheckedChange={toggleSelectAll} data-testid="checkbox-select-all" />
                </th>
                {[
                  { key: "categoryLarge", label: "대분류", align: "left", bg: "" },
                  { key: "categoryMedium", label: "중분류", align: "left", bg: "" },
                  { key: "categorySmall", label: "소분류", align: "left", bg: "" },
                  { key: "weight", label: "중량", align: "center", bg: "" },
                  { key: "productCode", label: "코드", align: "left", bg: "" },
                  { key: "productName", label: "상품명", align: "left", bg: "" },
                  { key: "sourceProduct", label: "원상품", align: "left", bg: "" },
                  { key: "sourcePrice", label: "기준가", align: "right", bg: "" },
                  { key: "lossRate", label: "로스율%", align: "right", bg: "" },
                  { key: "sourceWeight", label: "기준중량", align: "right", bg: "" },
                  { key: "unitPrice", label: "개별단가", align: "right", bg: "bg-yellow-100 dark:bg-yellow-900/30" },
                  { key: "sourceProductTotal", label: "원상품합계", align: "right", bg: "bg-yellow-100 dark:bg-yellow-900/30" },
                  { key: "boxCost", label: "박스비", align: "right", bg: "" },
                  { key: "materialCost", label: "자재비", align: "right", bg: "" },
                  { key: "outerBoxCost", label: "아웃박스", align: "right", bg: "" },
                  { key: "wrappingCost", label: "보자기", align: "right", bg: "" },
                  { key: "laborCost", label: "작업비", align: "right", bg: "" },
                  { key: "shippingCost", label: "택배비", align: "right", bg: "" },
                  { key: "totalCost", label: "총원가", align: "right", bg: "bg-yellow-100 dark:bg-yellow-900/30" },
                  { key: "startMarginRate", label: "S마진율", align: "right", bg: "bg-blue-100 dark:bg-blue-900/30" },
                  { key: "startMargin", label: "S마진", align: "right", bg: "bg-blue-100 dark:bg-blue-900/30" },
                  { key: "startPrice", label: "S공급가", align: "right", bg: "bg-blue-100 dark:bg-blue-900/30", bold: true },
                  { key: "drivingMarginRate", label: "D마진율", align: "right", bg: "bg-green-100 dark:bg-green-900/30" },
                  { key: "drivingMargin", label: "D마진", align: "right", bg: "bg-green-100 dark:bg-green-900/30" },
                  { key: "drivingPrice", label: "D공급가", align: "right", bg: "bg-green-100 dark:bg-green-900/30", bold: true },
                  { key: "topMarginRate", label: "T마진율", align: "right", bg: "bg-purple-100 dark:bg-purple-900/30" },
                  { key: "topMargin", label: "T마진", align: "right", bg: "bg-purple-100 dark:bg-purple-900/30" },
                  { key: "topPrice", label: "T공급가", align: "right", bg: "bg-purple-100 dark:bg-purple-900/30", bold: true },
                  { key: "save", label: "저장", align: "center", bg: "" },
                ].map((col) => (
                  <th 
                    key={col.key}
                    className={`relative px-2 py-2 whitespace-nowrap border border-gray-200 dark:border-gray-700 ${col.bg} ${col.bold ? "font-bold" : ""} text-${col.align}`}
                    style={{ width: columnWidths[col.key] || DEFAULT_COLUMN_WIDTHS[col.key] }}
                  >
                    {col.label}
                    <div
                      className="absolute top-0 right-0 w-2 h-full cursor-col-resize hover:bg-blue-400/50 active:bg-blue-500/50"
                      onMouseDown={(e) => handleResizeStart(e, col.key)}
                      style={{ userSelect: 'none' }}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {products.map((p, idx) => {
                const isSelected = selectedIds.includes(p.id);
                const rowBg = isSelected ? "bg-blue-100 dark:bg-blue-900/30" : "";
                return (
                <tr key={p.id} className={`hover:bg-muted/30 ${rowBg}`} data-testid={`row-product-${p.id}`}>
                  <td className={`px-2 py-1 sticky left-0 z-10 border-r-2 border-gray-300 dark:border-gray-600 ${isSelected ? "bg-blue-100 dark:bg-blue-900/30" : "bg-background"}`} style={{ width: columnWidths.checkbox }}>
                    <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(p.id)} />
                  </td>
                  <td className={`px-1 py-0.5 border border-gray-200 dark:border-gray-700 overflow-hidden ${getCellClass(p.categoryLarge, false)}`} style={{ width: columnWidths.categoryLarge }}>
                    <input value={p.categoryLarge || ""} onChange={e => handleCellChange(idx, "categoryLarge", e.target.value)} className="w-full px-1 py-0.5 border-none bg-transparent outline-none text-xs focus:ring-2 focus:ring-inset focus:ring-blue-500" />
                  </td>
                  <td className={`px-1 py-0.5 border border-gray-200 dark:border-gray-700 overflow-hidden ${getCellClass(p.categoryMedium, false)}`} style={{ width: columnWidths.categoryMedium }}>
                    <input value={p.categoryMedium || ""} onChange={e => handleCellChange(idx, "categoryMedium", e.target.value)} className="w-full px-1 py-0.5 border-none bg-transparent outline-none text-xs focus:ring-2 focus:ring-inset focus:ring-blue-500" />
                  </td>
                  <td className={`px-1 py-0.5 border border-gray-200 dark:border-gray-700 overflow-hidden ${getCellClass(p.categorySmall, false)}`} style={{ width: columnWidths.categorySmall }}>
                    <input value={p.categorySmall || ""} onChange={e => handleCellChange(idx, "categorySmall", e.target.value)} className="w-full px-1 py-0.5 border-none bg-transparent outline-none text-xs focus:ring-2 focus:ring-inset focus:ring-blue-500" />
                  </td>
                  <td className={`px-1 py-0.5 border border-gray-200 dark:border-gray-700 overflow-hidden ${getCellClass(p.weight, false)}`} style={{ width: columnWidths.weight }}>
                    <input 
                      value={p.weight} 
                      onChange={e => {
                        const val = e.target.value;
                        if (val === "" || /^\d*\.?\d{0,1}$/.test(val)) {
                          handleCellChange(idx, "weight", val);
                        }
                      }} 
                      className="w-full px-1 py-0.5 border-none bg-transparent outline-none text-xs text-right focus:ring-2 focus:ring-inset focus:ring-blue-500" 
                      type="text"
                      inputMode="decimal"
                      placeholder="0.0"
                      data-testid={`input-weight-${idx}`}
                    />
                  </td>
                  <td className={`px-1 py-0.5 border border-gray-200 dark:border-gray-700 overflow-hidden ${getCellClass(p.productCode, false)}`} style={{ width: columnWidths.productCode }}>
                    <input value={p.productCode} onChange={e => handleCellChange(idx, "productCode", e.target.value)} className="w-full px-1 py-0.5 border-none bg-transparent outline-none text-xs focus:ring-2 focus:ring-inset focus:ring-blue-500" />
                  </td>
                  <td className={`px-1 py-0.5 border border-gray-200 dark:border-gray-700 overflow-hidden ${getCellClass(p.productName, false)}`} style={{ width: columnWidths.productName }}>
                    <input value={p.productName} onChange={e => handleCellChange(idx, "productName", e.target.value)} className="w-full px-1 py-0.5 border-none bg-transparent outline-none text-xs focus:ring-2 focus:ring-inset focus:ring-blue-500" />
                  </td>
                  <td className="px-1 py-0.5 border border-gray-200 dark:border-gray-700 overflow-hidden" style={{ width: columnWidths.sourceProduct }}>
                    <input value={p.sourceProduct || ""} onChange={e => handleCellChange(idx, "sourceProduct", e.target.value)} className="w-full px-1 py-0.5 border-none bg-transparent outline-none text-xs focus:ring-2 focus:ring-inset focus:ring-blue-500" />
                  </td>
                  <td className={`px-1 py-0.5 border border-gray-200 dark:border-gray-700 overflow-hidden ${getCellClass(p.sourcePrice, false)}`} style={{ width: columnWidths.sourcePrice }}>
                    <input value={p.sourcePrice ?? ""} onChange={e => handleCellChange(idx, "sourcePrice", e.target.value ? parseInt(e.target.value) : null)} className="w-full px-1 py-0.5 border-none bg-transparent outline-none text-xs text-right focus:ring-2 focus:ring-inset focus:ring-blue-500" type="number" />
                  </td>
                  <td className="px-1 py-0.5 border border-gray-200 dark:border-gray-700 overflow-hidden" style={{ width: columnWidths.lossRate }}>
                    <input value={p.lossRate} onChange={e => handleCellChange(idx, "lossRate", parseInt(e.target.value) || 0)} className="w-full px-1 py-0.5 border-none bg-transparent outline-none text-xs text-right focus:ring-2 focus:ring-inset focus:ring-blue-500" type="number" />
                  </td>
                  <td className={`px-1 py-0.5 border border-gray-200 dark:border-gray-700 overflow-hidden ${getCellClass(p.sourceWeight, false)}`} style={{ width: columnWidths.sourceWeight }}>
                    <input value={p.sourceWeight ?? ""} onChange={e => handleCellChange(idx, "sourceWeight", e.target.value ? parseInt(e.target.value) : null)} className="w-full px-1 py-0.5 border-none bg-transparent outline-none text-xs text-right focus:ring-2 focus:ring-inset focus:ring-blue-500" type="number" />
                  </td>
                  <td className="px-2 py-1 border border-gray-200 dark:border-gray-700 bg-yellow-100 dark:bg-yellow-900/30 text-right overflow-hidden text-ellipsis" style={{ width: columnWidths.unitPrice }}>{formatNumber(p.unitPrice)}</td>
                  <td className="px-2 py-1 border border-gray-200 dark:border-gray-700 bg-yellow-100 dark:bg-yellow-900/30 text-right overflow-hidden text-ellipsis" style={{ width: columnWidths.sourceProductTotal }}>{formatNumber(p.sourceProductTotal)}</td>
                  <td className="px-1 py-0.5 border border-gray-200 dark:border-gray-700 overflow-hidden" style={{ width: columnWidths.boxCost }}>
                    <input value={p.boxCost} onChange={e => handleCellChange(idx, "boxCost", parseInt(e.target.value) || 0)} className="w-full px-1 py-0.5 border-none bg-transparent outline-none text-xs text-right focus:ring-2 focus:ring-inset focus:ring-blue-500" type="number" />
                  </td>
                  <td className="px-1 py-0.5 border border-gray-200 dark:border-gray-700 overflow-hidden" style={{ width: columnWidths.materialCost }}>
                    <input value={p.materialCost} onChange={e => handleCellChange(idx, "materialCost", parseInt(e.target.value) || 0)} className="w-full px-1 py-0.5 border-none bg-transparent outline-none text-xs text-right focus:ring-2 focus:ring-inset focus:ring-blue-500" type="number" />
                  </td>
                  <td className="px-1 py-0.5 border border-gray-200 dark:border-gray-700 overflow-hidden" style={{ width: columnWidths.outerBoxCost }}>
                    <input value={p.outerBoxCost} onChange={e => handleCellChange(idx, "outerBoxCost", parseInt(e.target.value) || 0)} className="w-full px-1 py-0.5 border-none bg-transparent outline-none text-xs text-right focus:ring-2 focus:ring-inset focus:ring-blue-500" type="number" />
                  </td>
                  <td className="px-1 py-0.5 border border-gray-200 dark:border-gray-700 overflow-hidden" style={{ width: columnWidths.wrappingCost }}>
                    <input value={p.wrappingCost} onChange={e => handleCellChange(idx, "wrappingCost", parseInt(e.target.value) || 0)} className="w-full px-1 py-0.5 border-none bg-transparent outline-none text-xs text-right focus:ring-2 focus:ring-inset focus:ring-blue-500" type="number" />
                  </td>
                  <td className="px-1 py-0.5 border border-gray-200 dark:border-gray-700 overflow-hidden" style={{ width: columnWidths.laborCost }}>
                    <input value={p.laborCost} onChange={e => handleCellChange(idx, "laborCost", parseInt(e.target.value) || 0)} className="w-full px-1 py-0.5 border-none bg-transparent outline-none text-xs text-right focus:ring-2 focus:ring-inset focus:ring-blue-500" type="number" />
                  </td>
                  <td className="px-1 py-0.5 border border-gray-200 dark:border-gray-700 overflow-hidden" style={{ width: columnWidths.shippingCost }}>
                    <input value={p.shippingCost} onChange={e => handleCellChange(idx, "shippingCost", parseInt(e.target.value) || 0)} className="w-full px-1 py-0.5 border-none bg-transparent outline-none text-xs text-right focus:ring-2 focus:ring-inset focus:ring-blue-500" type="number" />
                  </td>
                  <td className="px-2 py-1 border border-gray-200 dark:border-gray-700 bg-yellow-100 dark:bg-yellow-900/30 text-right overflow-hidden text-ellipsis" style={{ width: columnWidths.totalCost }}>{formatNumber(p.totalCost)}</td>
                  <td className={`px-1 py-0.5 border border-gray-200 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/20 overflow-hidden ${getCellClass(p.startMarginRate, false)}`} style={{ width: columnWidths.startMarginRate }}>
                    <input value={p.startMarginRate ?? ""} onChange={e => handleCellChange(idx, "startMarginRate", e.target.value ? parseFloat(e.target.value) : null)} className="w-full px-1 py-0.5 border-none bg-transparent outline-none text-xs text-right focus:ring-2 focus:ring-inset focus:ring-blue-500" type="number" step="0.1" />
                  </td>
                  <td className="px-2 py-1 border border-gray-200 dark:border-gray-700 bg-blue-100 dark:bg-blue-900/30 text-right overflow-hidden text-ellipsis" style={{ width: columnWidths.startMargin }}>{formatNumber(p.startMargin)}</td>
                  <td className="px-2 py-1 border border-gray-200 dark:border-gray-700 bg-blue-100 dark:bg-blue-900/30 text-right font-bold overflow-hidden text-ellipsis" style={{ width: columnWidths.startPrice }}>{formatNumber(p.startPrice)}</td>
                  <td className={`px-1 py-0.5 border border-gray-200 dark:border-gray-700 bg-green-50 dark:bg-green-900/20 overflow-hidden ${getCellClass(p.drivingMarginRate, false)}`} style={{ width: columnWidths.drivingMarginRate }}>
                    <input value={p.drivingMarginRate ?? ""} onChange={e => handleCellChange(idx, "drivingMarginRate", e.target.value ? parseFloat(e.target.value) : null)} className="w-full px-1 py-0.5 border-none bg-transparent outline-none text-xs text-right focus:ring-2 focus:ring-inset focus:ring-blue-500" type="number" step="0.1" />
                  </td>
                  <td className="px-2 py-1 border border-gray-200 dark:border-gray-700 bg-green-100 dark:bg-green-900/30 text-right overflow-hidden text-ellipsis" style={{ width: columnWidths.drivingMargin }}>{formatNumber(p.drivingMargin)}</td>
                  <td className="px-2 py-1 border border-gray-200 dark:border-gray-700 bg-green-100 dark:bg-green-900/30 text-right font-bold overflow-hidden text-ellipsis" style={{ width: columnWidths.drivingPrice }}>{formatNumber(p.drivingPrice)}</td>
                  <td className={`px-1 py-0.5 border border-gray-200 dark:border-gray-700 bg-purple-50 dark:bg-purple-900/20 overflow-hidden ${getCellClass(p.topMarginRate, false)}`} style={{ width: columnWidths.topMarginRate }}>
                    <input value={p.topMarginRate ?? ""} onChange={e => handleCellChange(idx, "topMarginRate", e.target.value ? parseFloat(e.target.value) : null)} className="w-full px-1 py-0.5 border-none bg-transparent outline-none text-xs text-right focus:ring-2 focus:ring-inset focus:ring-blue-500" type="number" step="0.1" />
                  </td>
                  <td className="px-2 py-1 border border-gray-200 dark:border-gray-700 bg-purple-100 dark:bg-purple-900/30 text-right overflow-hidden text-ellipsis" style={{ width: columnWidths.topMargin }}>{formatNumber(p.topMargin)}</td>
                  <td className="px-2 py-1 border border-gray-200 dark:border-gray-700 bg-purple-100 dark:bg-purple-900/30 text-right font-bold overflow-hidden text-ellipsis" style={{ width: columnWidths.topPrice }}>{formatNumber(p.topPrice)}</td>
                  <td className="px-1 py-0.5 border border-gray-200 dark:border-gray-700 text-center overflow-hidden" style={{ width: columnWidths.save }}>
                    <Button size="sm" variant={p.isNew ? "default" : "ghost"} onClick={() => handleSaveRow(idx)} disabled={createMutation.isPending || updateMutation.isPending} className="h-6 w-6 p-0" data-testid={`button-save-${p.id}`}>
                      <Save className="h-3 w-3" />
                    </Button>
                  </td>
                </tr>
              );})}
              {products.length === 0 && (
                <tr>
                  <td colSpan={29} className="text-center py-8 text-muted-foreground">
                    상품을 검색하거나 엑셀을 업로드하세요
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="flex justify-center">
        <Button onClick={handleSend} disabled={products.length === 0 || sendMutation.isPending} data-testid="button-send">
          {sendMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          <Send className="h-4 w-4 mr-2" />
          차주 예상공급가 상품으로 전송
        </Button>
      </div>

      <Dialog open={suspendDialogOpen} onOpenChange={setSuspendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>공급 중지 설정</DialogTitle>
            <DialogDescription>선택한 {selectedIds.length}개 상품을 공급 중지합니다.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium">중지 사유</label>
            <Input 
              placeholder="예: 시즌 종료, 품질 이슈, 재고 소진" 
              value={suspendReason} 
              onChange={e => setSuspendReason(e.target.value)}
              className="mt-2"
              data-testid="input-suspend-reason"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendDialogOpen(false)}>취소</Button>
            <Button onClick={() => suspendMutation.mutate({ ids: selectedIds, reason: suspendReason })} disabled={suspendMutation.isPending} data-testid="button-confirm-suspend">
              {suspendMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              공급 중지
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>상품 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              선택한 {selectedIds.length}개 상품을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate(selectedIds)} className="bg-destructive text-destructive-foreground" data-testid="button-confirm-delete">
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
