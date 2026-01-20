import { useState, useRef, useCallback } from "react";
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
  const [searchCode, setSearchCode] = useState("");
  const [searchName, setSearchName] = useState("");
  
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

  const searchMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/product-registrations?status=active`);
      return res.json();
    },
    onSuccess: (data: ProductRegistration[]) => {
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
      if (searchCode) {
        filtered = filtered.filter(p => p.productCode.toLowerCase().includes(searchCode.toLowerCase()));
      }
      if (searchName) {
        filtered = filtered.filter(p => p.productName.toLowerCase().includes(searchName.toLowerCase()));
      }
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
      await apiRequest("DELETE", "/api/product-registrations/bulk", { ids });
    },
    onSuccess: () => {
      toast({ title: "삭제 완료" });
      setDeleteDialogOpen(false);
      setSelectedIds([]);
      searchMutation.mutate();
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

  const handleReset = () => {
    setSearchCategoryLarge("all");
    setSearchCategoryMedium("all");
    setSearchCategorySmall("all");
    setSearchCode("");
    setSearchName("");
    setProducts([]);
    setSelectedIds([]);
  };

  const handleBulkApply = () => {
    if (selectedIds.length === 0) {
      toast({ variant: "destructive", title: "오류", description: "상품을 선택해주세요" });
      return;
    }
    const data: any = {};
    if (bulkSourcePrice) data.sourcePrice = parseInt(bulkSourcePrice);
    if (bulkLossRate) data.lossRate = parseInt(bulkLossRate);
    if (bulkSourceWeight) data.sourceWeight = parseInt(bulkSourceWeight);
    if (bulkBoxCost) data.boxCost = parseInt(bulkBoxCost);
    if (bulkMaterialCost) data.materialCost = parseInt(bulkMaterialCost);
    if (bulkOuterBoxCost) data.outerBoxCost = parseInt(bulkOuterBoxCost);
    if (bulkWrappingCost) data.wrappingCost = parseInt(bulkWrappingCost);
    if (bulkLaborCost) data.laborCost = parseInt(bulkLaborCost);
    if (bulkShippingCost) data.shippingCost = parseInt(bulkShippingCost);
    if (bulkStartMargin) data.startMarginRate = parseInt(bulkStartMargin);
    if (bulkDrivingMargin) data.drivingMarginRate = parseInt(bulkDrivingMargin);
    if (bulkTopMargin) data.topMarginRate = parseInt(bulkTopMargin);
    
    if (Object.keys(data).length === 0) {
      toast({ variant: "destructive", title: "오류", description: "적용할 값을 입력해주세요" });
      return;
    }
    bulkUpdateMutation.mutate({ ids: selectedIds, data });
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
  };

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/product-registrations", data);
      return res;
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
    const unitPrice = sourceWeight > 0 ? Math.round((sourcePrice * (1 + lossRate / 100)) / sourceWeight) : 0;
    
    const totalCost = unitPrice + (p.boxCost || 0) + (p.materialCost || 0) + (p.outerBoxCost || 0) + (p.wrappingCost || 0) + (p.laborCost || 0) + (p.shippingCost || 0);
    
    p.unitPrice = unitPrice;
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
  };

  const handleSaveRow = async (index: number) => {
    const p = products[index];
    if (!p.productCode || !p.productName || !p.weight) {
      toast({ variant: "destructive", title: "오류", description: "상품코드, 상품명, 중량은 필수입니다" });
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
        <CardHeader className="p-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Upload className="h-4 w-4" />
            엑셀 업로드 (임시등록)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <div 
            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover-elevate"
            onClick={() => fileInputRef.current?.click()}
            data-testid="upload-zone"
          >
            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">엑셀 파일을 드래그하거나 클릭하여 업로드하세요</p>
            <Button size="sm" variant="outline" className="mt-2" onClick={(e) => { e.stopPropagation(); handleDownloadTemplate(); }} data-testid="button-download-template">
              <Download className="h-4 w-4 mr-1" />
              양식 다운로드
            </Button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleFileUpload}
            data-testid="input-file"
          />
          <p className="text-xs text-muted-foreground mt-2">* 업로드 시 기본정보(대분류~상품명)가 테이블에 추가됩니다.</p>
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
            <Input placeholder="상품코드" value={searchCode} onChange={e => setSearchCode(e.target.value)} className="h-9" data-testid="input-search-code" />
            <Input placeholder="상품명" value={searchName} onChange={e => setSearchName(e.target.value)} className="h-9" data-testid="input-search-name" />
          </div>
          <div className="flex gap-2 mt-2">
            <Button size="sm" onClick={handleSearch} disabled={searchMutation.isPending} data-testid="button-search">
              {searchMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              <Search className="h-4 w-4 mr-1" />
              검색
            </Button>
            <Button size="sm" variant="outline" onClick={handleReset} data-testid="button-reset">
              <RotateCcw className="h-4 w-4 mr-1" />
              초기화
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-3">
          <CardTitle className="text-sm">일괄 적용 (선택한 상품에 한꺼번에 값 적용)</CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0 space-y-3">
          <div>
            <p className="text-xs font-medium mb-1 text-muted-foreground">[상품 원가]</p>
            <div className="grid grid-cols-3 gap-2">
              <Input placeholder="원상품 기준가" value={bulkSourcePrice} onChange={e => setBulkSourcePrice(e.target.value)} className="h-9" type="number" data-testid="input-bulk-source-price" />
              <Input placeholder="로스율 (%)" value={bulkLossRate} onChange={e => setBulkLossRate(e.target.value)} className="h-9" type="number" data-testid="input-bulk-loss-rate" />
              <Input placeholder="원상품 기준중량 (kg)" value={bulkSourceWeight} onChange={e => setBulkSourceWeight(e.target.value)} className="h-9" type="number" data-testid="input-bulk-source-weight" />
            </div>
          </div>
          <div>
            <p className="text-xs font-medium mb-1 text-muted-foreground">[부대비용]</p>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
              <Input placeholder="박스비" value={bulkBoxCost} onChange={e => setBulkBoxCost(e.target.value)} className="h-9" type="number" />
              <Input placeholder="자재비" value={bulkMaterialCost} onChange={e => setBulkMaterialCost(e.target.value)} className="h-9" type="number" />
              <Input placeholder="아웃박스" value={bulkOuterBoxCost} onChange={e => setBulkOuterBoxCost(e.target.value)} className="h-9" type="number" />
              <Input placeholder="보자기" value={bulkWrappingCost} onChange={e => setBulkWrappingCost(e.target.value)} className="h-9" type="number" />
              <Input placeholder="작업비" value={bulkLaborCost} onChange={e => setBulkLaborCost(e.target.value)} className="h-9" type="number" />
              <Input placeholder="택배비" value={bulkShippingCost} onChange={e => setBulkShippingCost(e.target.value)} className="h-9" type="number" />
            </div>
          </div>
          <div>
            <p className="text-xs font-medium mb-1 text-muted-foreground">[등급별 마진율]</p>
            <div className="grid grid-cols-3 gap-2">
              <Input placeholder="Start 마진율 (%)" value={bulkStartMargin} onChange={e => setBulkStartMargin(e.target.value)} className="h-9" type="number" data-testid="input-bulk-start-margin" />
              <Input placeholder="Driving 마진율 (%)" value={bulkDrivingMargin} onChange={e => setBulkDrivingMargin(e.target.value)} className="h-9" type="number" data-testid="input-bulk-driving-margin" />
              <Input placeholder="Top 마진율 (%)" value={bulkTopMargin} onChange={e => setBulkTopMargin(e.target.value)} className="h-9" type="number" data-testid="input-bulk-top-margin" />
            </div>
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={handleBulkApply} disabled={bulkUpdateMutation.isPending} data-testid="button-bulk-apply">
              {bulkUpdateMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
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
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-2 text-left sticky left-0 bg-muted/50 z-10">
                  <Checkbox checked={selectedIds.length === products.length && products.length > 0} onCheckedChange={toggleSelectAll} data-testid="checkbox-select-all" />
                </th>
                <th className="p-2 text-left whitespace-nowrap">대분류</th>
                <th className="p-2 text-left whitespace-nowrap">중분류</th>
                <th className="p-2 text-left whitespace-nowrap">소분류</th>
                <th className="p-2 text-left whitespace-nowrap">중량</th>
                <th className="p-2 text-left whitespace-nowrap">코드</th>
                <th className="p-2 text-left whitespace-nowrap">상품명</th>
                <th className="p-2 text-left whitespace-nowrap">원상품</th>
                <th className="p-2 text-right whitespace-nowrap">기준가</th>
                <th className="p-2 text-right whitespace-nowrap">로스율%</th>
                <th className="p-2 text-right whitespace-nowrap">기준중량</th>
                <th className="p-2 text-right whitespace-nowrap bg-yellow-100 dark:bg-yellow-900/30">개별단가</th>
                <th className="p-2 text-right whitespace-nowrap">박스비</th>
                <th className="p-2 text-right whitespace-nowrap">자재비</th>
                <th className="p-2 text-right whitespace-nowrap">아웃박스</th>
                <th className="p-2 text-right whitespace-nowrap">보자기</th>
                <th className="p-2 text-right whitespace-nowrap">작업비</th>
                <th className="p-2 text-right whitespace-nowrap">택배비</th>
                <th className="p-2 text-right whitespace-nowrap bg-yellow-100 dark:bg-yellow-900/30">총원가</th>
                <th className="p-2 text-right whitespace-nowrap">S마진율</th>
                <th className="p-2 text-right whitespace-nowrap bg-yellow-100 dark:bg-yellow-900/30">S공급가</th>
                <th className="p-2 text-right whitespace-nowrap bg-yellow-100 dark:bg-yellow-900/30">S마진</th>
                <th className="p-2 text-right whitespace-nowrap">D마진율</th>
                <th className="p-2 text-right whitespace-nowrap bg-yellow-100 dark:bg-yellow-900/30">D공급가</th>
                <th className="p-2 text-right whitespace-nowrap bg-yellow-100 dark:bg-yellow-900/30">D마진</th>
                <th className="p-2 text-right whitespace-nowrap">T마진율</th>
                <th className="p-2 text-right whitespace-nowrap bg-yellow-100 dark:bg-yellow-900/30">T공급가</th>
                <th className="p-2 text-right whitespace-nowrap bg-yellow-100 dark:bg-yellow-900/30">T마진</th>
                <th className="p-2 text-center whitespace-nowrap">저장</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p, idx) => (
                <tr key={p.id} className="border-b hover:bg-muted/30" data-testid={`row-product-${p.id}`}>
                  <td className="p-2 sticky left-0 bg-background">
                    <Checkbox checked={selectedIds.includes(p.id)} onCheckedChange={() => toggleSelect(p.id)} />
                  </td>
                  <td className={`p-1 ${getCellClass(p.categoryLarge, false)}`}>
                    <Input value={p.categoryLarge || ""} onChange={e => handleCellChange(idx, "categoryLarge", e.target.value)} className="h-7 text-xs w-16" />
                  </td>
                  <td className={`p-1 ${getCellClass(p.categoryMedium, false)}`}>
                    <Input value={p.categoryMedium || ""} onChange={e => handleCellChange(idx, "categoryMedium", e.target.value)} className="h-7 text-xs w-16" />
                  </td>
                  <td className={`p-1 ${getCellClass(p.categorySmall, false)}`}>
                    <Input value={p.categorySmall || ""} onChange={e => handleCellChange(idx, "categorySmall", e.target.value)} className="h-7 text-xs w-16" />
                  </td>
                  <td className={`p-1 ${getCellClass(p.weight, false)}`}>
                    <Input value={p.weight} onChange={e => handleCellChange(idx, "weight", e.target.value)} className="h-7 text-xs w-14" />
                  </td>
                  <td className={`p-1 ${getCellClass(p.productCode, false)}`}>
                    <Input value={p.productCode} onChange={e => handleCellChange(idx, "productCode", e.target.value)} className="h-7 text-xs w-16" />
                  </td>
                  <td className={`p-1 ${getCellClass(p.productName, false)}`}>
                    <Input value={p.productName} onChange={e => handleCellChange(idx, "productName", e.target.value)} className="h-7 text-xs w-24" />
                  </td>
                  <td className="p-1">
                    <Input value={p.sourceProduct || ""} onChange={e => handleCellChange(idx, "sourceProduct", e.target.value)} className="h-7 text-xs w-16" />
                  </td>
                  <td className={`p-1 ${getCellClass(p.sourcePrice, false)}`}>
                    <Input value={p.sourcePrice ?? ""} onChange={e => handleCellChange(idx, "sourcePrice", e.target.value ? parseInt(e.target.value) : null)} className="h-7 text-xs w-16 text-right" type="number" />
                  </td>
                  <td className="p-1">
                    <Input value={p.lossRate} onChange={e => handleCellChange(idx, "lossRate", parseInt(e.target.value) || 0)} className="h-7 text-xs w-12 text-right" type="number" />
                  </td>
                  <td className={`p-1 ${getCellClass(p.sourceWeight, false)}`}>
                    <Input value={p.sourceWeight ?? ""} onChange={e => handleCellChange(idx, "sourceWeight", e.target.value ? parseInt(e.target.value) : null)} className="h-7 text-xs w-14 text-right" type="number" />
                  </td>
                  <td className="p-1 bg-yellow-100 dark:bg-yellow-900/30 text-right">{formatNumber(p.unitPrice)}</td>
                  <td className="p-1">
                    <Input value={p.boxCost} onChange={e => handleCellChange(idx, "boxCost", parseInt(e.target.value) || 0)} className="h-7 text-xs w-14 text-right" type="number" />
                  </td>
                  <td className="p-1">
                    <Input value={p.materialCost} onChange={e => handleCellChange(idx, "materialCost", parseInt(e.target.value) || 0)} className="h-7 text-xs w-14 text-right" type="number" />
                  </td>
                  <td className="p-1">
                    <Input value={p.outerBoxCost} onChange={e => handleCellChange(idx, "outerBoxCost", parseInt(e.target.value) || 0)} className="h-7 text-xs w-14 text-right" type="number" />
                  </td>
                  <td className="p-1">
                    <Input value={p.wrappingCost} onChange={e => handleCellChange(idx, "wrappingCost", parseInt(e.target.value) || 0)} className="h-7 text-xs w-14 text-right" type="number" />
                  </td>
                  <td className="p-1">
                    <Input value={p.laborCost} onChange={e => handleCellChange(idx, "laborCost", parseInt(e.target.value) || 0)} className="h-7 text-xs w-14 text-right" type="number" />
                  </td>
                  <td className="p-1">
                    <Input value={p.shippingCost} onChange={e => handleCellChange(idx, "shippingCost", parseInt(e.target.value) || 0)} className="h-7 text-xs w-14 text-right" type="number" />
                  </td>
                  <td className="p-1 bg-yellow-100 dark:bg-yellow-900/30 text-right">{formatNumber(p.totalCost)}</td>
                  <td className={`p-1 ${getCellClass(p.startMarginRate, false)}`}>
                    <Input value={p.startMarginRate ?? ""} onChange={e => handleCellChange(idx, "startMarginRate", e.target.value ? parseInt(e.target.value) : null)} className="h-7 text-xs w-12 text-right" type="number" />
                  </td>
                  <td className="p-1 bg-yellow-100 dark:bg-yellow-900/30 text-right">{formatNumber(p.startPrice)}</td>
                  <td className="p-1 bg-yellow-100 dark:bg-yellow-900/30 text-right">{formatNumber(p.startMargin)}</td>
                  <td className={`p-1 ${getCellClass(p.drivingMarginRate, false)}`}>
                    <Input value={p.drivingMarginRate ?? ""} onChange={e => handleCellChange(idx, "drivingMarginRate", e.target.value ? parseInt(e.target.value) : null)} className="h-7 text-xs w-12 text-right" type="number" />
                  </td>
                  <td className="p-1 bg-yellow-100 dark:bg-yellow-900/30 text-right">{formatNumber(p.drivingPrice)}</td>
                  <td className="p-1 bg-yellow-100 dark:bg-yellow-900/30 text-right">{formatNumber(p.drivingMargin)}</td>
                  <td className={`p-1 ${getCellClass(p.topMarginRate, false)}`}>
                    <Input value={p.topMarginRate ?? ""} onChange={e => handleCellChange(idx, "topMarginRate", e.target.value ? parseInt(e.target.value) : null)} className="h-7 text-xs w-12 text-right" type="number" />
                  </td>
                  <td className="p-1 bg-yellow-100 dark:bg-yellow-900/30 text-right">{formatNumber(p.topPrice)}</td>
                  <td className="p-1 bg-yellow-100 dark:bg-yellow-900/30 text-right">{formatNumber(p.topMargin)}</td>
                  <td className="p-1 text-center">
                    <Button size="sm" variant={p.isNew ? "default" : "ghost"} onClick={() => handleSaveRow(idx)} disabled={createMutation.isPending || updateMutation.isPending} data-testid={`button-save-${p.id}`}>
                      <Save className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
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
