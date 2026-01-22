import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Trash2, Download, Upload, Loader2, Search, Edit, X, ChevronLeft, ChevronRight, GripVertical, Filter } from "lucide-react";
import type { ProductMapping, ProductMaterialMapping, Material, Category } from "@shared/schema";

interface ProductMappingWithMaterials extends ProductMapping {
  materials: ProductMaterialMapping[];
}

interface ColumnWidth {
  checkbox: number;
  productCode: number;
  productName: number;
  mat1Name: number;
  mat1Qty: number;
  mat2Name: number;
  mat2Qty: number;
  mat3Name: number;
  mat3Qty: number;
  mat4Name: number;
  mat4Qty: number;
  status: number;
  actions: number;
}

const DEFAULT_COLUMN_WIDTHS: ColumnWidth = {
  checkbox: 40,
  productCode: 120,
  productName: 180,
  mat1Name: 140,
  mat1Qty: 50,
  mat2Name: 140,
  mat2Qty: 50,
  mat3Name: 140,
  mat3Qty: 50,
  mat4Name: 140,
  mat4Qty: 50,
  status: 70,
  actions: 80,
};

export default function ProductMappingPage() {
  const { toast } = useToast();
  const uploadInputRef = useRef<HTMLInputElement>(null);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState("default");
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  const [filterCategoryLarge, setFilterCategoryLarge] = useState<string>("all");
  const [filterCategoryMedium, setFilterCategoryMedium] = useState<string>("all");
  const [filterCategorySmall, setFilterCategorySmall] = useState<string>("all");
  
  const [columnWidths, setColumnWidths] = useState<ColumnWidth>(DEFAULT_COLUMN_WIDTHS);
  const [resizing, setResizing] = useState<{ column: keyof ColumnWidth; startX: number; startWidth: number } | null>(null);
  
  const [addProductDialogOpen, setAddProductDialogOpen] = useState(false);
  const [addProductMode, setAddProductMode] = useState<"import" | "manual">("import");
  const [manualProductCode, setManualProductCode] = useState("");
  const [manualProductName, setManualProductName] = useState("");
  const [selectedImportProducts, setSelectedImportProducts] = useState<string[]>([]);
  
  const [editMappingDialogOpen, setEditMappingDialogOpen] = useState(false);
  const [editProductCode, setEditProductCode] = useState("");
  const [editProductName, setEditProductName] = useState("");
  const [editMaterials, setEditMaterials] = useState<{ materialCode: string; materialName: string; quantity: number }[]>([]);
  
  const [addMaterialDialogOpen, setAddMaterialDialogOpen] = useState(false);
  const [materialSearchQuery, setMaterialSearchQuery] = useState("");
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteProductCode, setDeleteProductCode] = useState("");
  
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  
  const [uploadResultDialogOpen, setUploadResultDialogOpen] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ totalProducts: number; productOnlyCount: number; productWithMappingCount: number; errors: string[] } | null>(null);

  const { data: productMappings = [], isLoading } = useQuery<ProductMappingWithMaterials[]>({
    queryKey: ["/api/product-mappings"],
  });

  const { data: availableProducts = [] } = useQuery<{ productCode: string; productName: string }[]>({
    queryKey: ["/api/product-mappings/available-products"],
  });

  const { data: allMaterials = [] } = useQuery<Material[]>({
    queryKey: ["/api/materials"],
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const largeCategories = useMemo(() => 
    categories.filter(c => c.level === "large"), [categories]);
  
  const selectedLargeCategory = useMemo(() => 
    largeCategories.find(lc => lc.name === filterCategoryLarge), [largeCategories, filterCategoryLarge]);
  
  const mediumCategories = useMemo(() => {
    if (filterCategoryLarge === "all") return [];
    if (!selectedLargeCategory) return [];
    return categories.filter(c => c.level === "medium" && c.parentId === selectedLargeCategory.id);
  }, [categories, filterCategoryLarge, selectedLargeCategory]);
  
  const selectedMediumCategory = useMemo(() => 
    mediumCategories.find(mc => mc.name === filterCategoryMedium), [mediumCategories, filterCategoryMedium]);
  
  const smallCategories = useMemo(() => {
    if (filterCategoryMedium === "all") return [];
    if (!selectedMediumCategory) return [];
    return categories.filter(c => c.level === "small" && c.parentId === selectedMediumCategory.id);
  }, [categories, filterCategoryMedium, selectedMediumCategory]);

  const filteredAndSortedMappings = useMemo(() => {
    let result = productMappings.filter((m) => {
      const matchesSearch = searchQuery === "" || 
        m.productCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.productName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategoryLarge = filterCategoryLarge === "all" || m.categoryLarge === filterCategoryLarge;
      const matchesCategoryMedium = filterCategoryMedium === "all" || m.categoryMedium === filterCategoryMedium;
      const matchesCategorySmall = filterCategorySmall === "all" || m.categorySmall === filterCategorySmall;
      return matchesSearch && matchesCategoryLarge && matchesCategoryMedium && matchesCategorySmall;
    });

    if (sortOption === "code_asc") {
      result = [...result].sort((a, b) => a.productCode.localeCompare(b.productCode));
    } else if (sortOption === "code_desc") {
      result = [...result].sort((a, b) => b.productCode.localeCompare(a.productCode));
    } else if (sortOption === "name_asc") {
      result = [...result].sort((a, b) => a.productName.localeCompare(b.productName));
    } else if (sortOption === "name_desc") {
      result = [...result].sort((a, b) => b.productName.localeCompare(a.productName));
    }

    return result;
  }, [productMappings, searchQuery, sortOption, filterCategoryLarge, filterCategoryMedium, filterCategorySmall]);

  const totalPages = Math.ceil(filteredAndSortedMappings.length / itemsPerPage);
  const paginatedMappings = filteredAndSortedMappings.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const filteredMaterials = allMaterials.filter((m) => 
    materialSearchQuery === "" ||
    m.materialCode.toLowerCase().includes(materialSearchQuery.toLowerCase()) ||
    m.materialName.toLowerCase().includes(materialSearchQuery.toLowerCase())
  );

  const handleMouseDown = useCallback((column: keyof ColumnWidth, e: React.MouseEvent) => {
    e.preventDefault();
    setResizing({ column, startX: e.clientX, startWidth: columnWidths[column] });
  }, [columnWidths]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!resizing) return;
    const diff = e.clientX - resizing.startX;
    const newWidth = Math.max(30, resizing.startWidth + diff);
    setColumnWidths(prev => ({ ...prev, [resizing.column]: newWidth }));
  }, [resizing]);

  const handleMouseUp = useCallback(() => {
    setResizing(null);
  }, []);

  useEffect(() => {
    if (resizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [resizing, handleMouseMove, handleMouseUp]);

  const addProductMutation = useMutation({
    mutationFn: async (data: { productCode: string; productName: string }) => {
      const res = await apiRequest("POST", "/api/product-mappings", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/product-mappings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/product-mappings/available-products"] });
      toast({ title: "상품이 추가되었습니다" });
      resetAddProductForm();
    },
    onError: (error: any) => {
      toast({ title: "오류", description: error.message, variant: "destructive" });
    },
  });

  const bulkAddProductMutation = useMutation({
    mutationFn: async (products: { productCode: string; productName: string }[]) => {
      const res = await apiRequest("POST", "/api/product-mappings/bulk", { products });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/product-mappings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/product-mappings/available-products"] });
      toast({ title: `${data.created}개 상품이 추가되었습니다` });
      resetAddProductForm();
    },
    onError: (error: any) => {
      toast({ title: "오류", description: error.message, variant: "destructive" });
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (productCode: string) => {
      const res = await apiRequest("DELETE", `/api/product-mappings/${productCode}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/product-mappings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/product-mappings/available-products"] });
      toast({ title: "상품이 삭제되었습니다" });
      setDeleteDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "오류", description: error.message, variant: "destructive" });
    },
  });

  const saveMaterialsMutation = useMutation({
    mutationFn: async ({ productCode, materials }: { productCode: string; materials: { materialCode: string; materialName: string; quantity: number }[] }) => {
      const res = await apiRequest("PUT", `/api/product-mappings/${productCode}/materials`, { materials });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/product-mappings"] });
      toast({ title: "재료 매핑이 저장되었습니다" });
      setEditMappingDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "오류", description: error.message, variant: "destructive" });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/product-mappings/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/product-mappings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/product-mappings/available-products"] });
      setUploadResult(data);
      setUploadResultDialogOpen(true);
    },
    onError: (error: any) => {
      toast({ title: "업로드 실패", description: error.message, variant: "destructive" });
    },
  });

  const resetAddProductForm = () => {
    setAddProductDialogOpen(false);
    setAddProductMode("import");
    setManualProductCode("");
    setManualProductName("");
    setSelectedImportProducts([]);
  };

  const handleAddProduct = () => {
    if (addProductMode === "manual") {
      if (!manualProductCode || !manualProductName) {
        toast({ title: "상품코드와 상품명을 입력해주세요", variant: "destructive" });
        return;
      }
      addProductMutation.mutate({ productCode: manualProductCode, productName: manualProductName });
    } else {
      if (selectedImportProducts.length === 0) {
        toast({ title: "가져올 상품을 선택해주세요", variant: "destructive" });
        return;
      }
      const products = selectedImportProducts.map(code => {
        const p = availableProducts.find(ap => ap.productCode === code);
        return { productCode: code, productName: p?.productName || "" };
      });
      bulkAddProductMutation.mutate(products);
    }
  };

  const handleOpenEditMapping = (product: ProductMappingWithMaterials) => {
    setEditProductCode(product.productCode);
    setEditProductName(product.productName);
    setEditMaterials(product.materials.map(m => ({
      materialCode: m.materialCode,
      materialName: m.materialName,
      quantity: m.quantity,
    })));
    setEditMappingDialogOpen(true);
  };

  const handleAddMaterialToMapping = (material: Material) => {
    if (editMaterials.some(m => m.materialCode === material.materialCode)) {
      toast({ title: "이미 추가된 재료입니다", variant: "destructive" });
      return;
    }
    setEditMaterials([...editMaterials, {
      materialCode: material.materialCode,
      materialName: material.materialName,
      quantity: 1,
    }]);
    setAddMaterialDialogOpen(false);
    setMaterialSearchQuery("");
  };

  const handleRemoveMaterialFromMapping = (materialCode: string) => {
    setEditMaterials(editMaterials.filter(m => m.materialCode !== materialCode));
  };

  const handleUpdateMaterialQuantity = (materialCode: string, quantity: number) => {
    setEditMaterials(editMaterials.map(m => 
      m.materialCode === materialCode ? { ...m, quantity } : m
    ));
  };

  const handleSaveMaterials = () => {
    saveMaterialsMutation.mutate({ productCode: editProductCode, materials: editMaterials });
  };

  const handleDeleteProduct = (productCode: string) => {
    setDeleteProductCode(productCode);
    setDeleteDialogOpen(true);
  };

  const handleBulkDelete = async () => {
    for (const productCode of selectedIds) {
      await deleteProductMutation.mutateAsync(productCode);
    }
    setSelectedIds([]);
    setBulkDeleteDialogOpen(false);
  };

  const handleDownloadTemplate = () => {
    window.location.href = "/api/product-mappings/template";
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadMutation.mutate(file);
    }
    e.target.value = "";
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(paginatedMappings.map(m => m.productCode));
    } else {
      setSelectedIds([]);
    }
  };

  const toggleSelectOne = (productCode: string, checked: boolean) => {
    if (checked) {
      setSelectedIds([...selectedIds, productCode]);
    } else {
      setSelectedIds(selectedIds.filter(id => id !== productCode));
    }
  };

  const getMaterialInfo = (materials: ProductMaterialMapping[], index: number) => {
    const mat = materials[index];
    return mat ? { name: mat.materialName, qty: mat.quantity } : { name: "", qty: "" };
  };

  const ResizeHandle = ({ column }: { column: keyof ColumnWidth }) => (
    <div
      className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 active:bg-primary"
      onMouseDown={(e) => handleMouseDown(column, e)}
    />
  );

  const cellClass = "border border-border/50 px-1.5 py-0.5 text-xs";
  const headerCellClass = "border border-border/50 px-1.5 py-1 text-xs font-medium relative";

  return (
    <div className="space-y-2 p-2" data-testid="page-product-mapping">
      <div className="flex flex-col gap-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">총</span>
            <span className="text-sm font-bold text-primary">{filteredAndSortedMappings.length}건</span>
            <span className="text-xs text-muted-foreground ml-2">
              ({currentPage} Page / Tot {totalPages || 1} Page)
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleDownloadTemplate} data-testid="button-download-template">
              <Download className="w-3 h-3 mr-1" />
              양식
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => uploadInputRef.current?.click()} disabled={uploadMutation.isPending} data-testid="button-upload-excel">
              {uploadMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Upload className="w-3 h-3 mr-1" />}
              업로드
            </Button>
            <input
              ref={uploadInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleUpload}
              className="hidden"
              data-testid="input-upload-file"
            />
            <Button size="sm" className="h-7 text-xs" onClick={() => setAddProductDialogOpen(true)} data-testid="button-add-product">
              <Plus className="w-3 h-3 mr-1" />
              추가
            </Button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
          <div className="flex items-center gap-1 flex-wrap">
            <Filter className="w-3 h-3 text-muted-foreground" />
            <Select 
              value={filterCategoryLarge} 
              onValueChange={(v) => {
                setFilterCategoryLarge(v);
                setFilterCategoryMedium("all");
                setFilterCategorySmall("all");
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-24 h-7 text-xs" data-testid="select-category-large">
                <SelectValue placeholder="대분류" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">대분류 전체</SelectItem>
                {largeCategories.map((c) => (
                  <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select 
              value={filterCategoryMedium} 
              onValueChange={(v) => {
                setFilterCategoryMedium(v);
                setFilterCategorySmall("all");
                setCurrentPage(1);
              }}
              disabled={filterCategoryLarge === "all"}
            >
              <SelectTrigger className="w-24 h-7 text-xs" data-testid="select-category-medium">
                <SelectValue placeholder="중분류" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">중분류 전체</SelectItem>
                {mediumCategories.map((c) => (
                  <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select 
              value={filterCategorySmall} 
              onValueChange={(v) => {
                setFilterCategorySmall(v);
                setCurrentPage(1);
              }}
              disabled={filterCategoryMedium === "all"}
            >
              <SelectTrigger className="w-24 h-7 text-xs" data-testid="select-category-small">
                <SelectValue placeholder="소분류" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">소분류 전체</SelectItem>
                {smallCategories.map((c) => (
                  <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Label className="text-xs whitespace-nowrap ml-2">판매상품명</Label>
            <Input
              placeholder="검색"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-32 h-7 text-xs"
              data-testid="input-search"
            />
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setSearchQuery("")}>
              <Search className="w-3 h-3" />
            </Button>
            {selectedIds.length > 0 && (
              <Button variant="destructive" size="sm" className="h-7 text-xs" onClick={() => setBulkDeleteDialogOpen(true)} data-testid="button-bulk-delete">
                삭제하기
              </Button>
            )}
          </div>
          <div className="flex items-center gap-1 sm:ml-auto">
            <Select value={sortOption} onValueChange={setSortOption}>
              <SelectTrigger className="w-28 h-7 text-xs" data-testid="select-sort">
                <SelectValue placeholder="정렬" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">정렬_기본</SelectItem>
                <SelectItem value="code_asc">코드↑</SelectItem>
                <SelectItem value="code_desc">코드↓</SelectItem>
                <SelectItem value="name_asc">상품명↑</SelectItem>
                <SelectItem value="name_desc">상품명↓</SelectItem>
              </SelectContent>
            </Select>
            <Select value={String(itemsPerPage)} onValueChange={(v) => { setItemsPerPage(Number(v)); setCurrentPage(1); }}>
              <SelectTrigger className="w-24 h-7 text-xs" data-testid="select-items-per-page">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="20">20개</SelectItem>
                <SelectItem value="50">50개</SelectItem>
                <SelectItem value="100">100개</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="hidden lg:block">
            <div className="overflow-x-auto">
              <div className="bg-amber-50 dark:bg-amber-950/30 border-b">
                <div className="flex">
                  <div className={`${headerCellClass} bg-amber-100/80 dark:bg-amber-900/50 text-center`} style={{ width: columnWidths.checkbox, minWidth: columnWidths.checkbox }}>
                    <Checkbox
                      checked={paginatedMappings.length > 0 && selectedIds.length === paginatedMappings.length}
                      onCheckedChange={toggleSelectAll}
                      data-testid="checkbox-select-all"
                    />
                  </div>
                  <div className={`${headerCellClass} bg-amber-100/80 dark:bg-amber-900/50`} style={{ width: columnWidths.productCode, minWidth: columnWidths.productCode }}>
                    판매상품코드
                    <ResizeHandle column="productCode" />
                  </div>
                  <div className={`${headerCellClass} bg-amber-100/80 dark:bg-amber-900/50`} style={{ width: columnWidths.productName, minWidth: columnWidths.productName }}>
                    판매상품명
                    <ResizeHandle column="productName" />
                  </div>
                  <div className={`${headerCellClass} bg-amber-200/60 dark:bg-amber-800/40 text-center`} style={{ width: columnWidths.mat1Name + columnWidths.mat1Qty }}>
                    원재료1
                  </div>
                  <div className={`${headerCellClass} bg-amber-200/60 dark:bg-amber-800/40 text-center`} style={{ width: columnWidths.mat2Name + columnWidths.mat2Qty }}>
                    원재료2
                  </div>
                  <div className={`${headerCellClass} bg-amber-200/60 dark:bg-amber-800/40 text-center`} style={{ width: columnWidths.mat3Name + columnWidths.mat3Qty }}>
                    원재료3
                  </div>
                  <div className={`${headerCellClass} bg-amber-200/60 dark:bg-amber-800/40 text-center`} style={{ width: columnWidths.mat4Name + columnWidths.mat4Qty }}>
                    원재료4
                  </div>
                  <div className={`${headerCellClass} bg-amber-100/80 dark:bg-amber-900/50 text-center`} style={{ width: columnWidths.status, minWidth: columnWidths.status }}>
                    사용유무
                    <ResizeHandle column="status" />
                  </div>
                  <div className={`${headerCellClass} bg-amber-100/80 dark:bg-amber-900/50 text-center`} style={{ width: columnWidths.actions, minWidth: columnWidths.actions }}>
                    작업
                  </div>
                </div>
                <div className="flex">
                  <div className={`${headerCellClass}`} style={{ width: columnWidths.checkbox }}></div>
                  <div className={`${headerCellClass}`} style={{ width: columnWidths.productCode }}></div>
                  <div className={`${headerCellClass}`} style={{ width: columnWidths.productName }}></div>
                  <div className={`${headerCellClass} text-center`} style={{ width: columnWidths.mat1Name }}>
                    원재료품목1
                    <ResizeHandle column="mat1Name" />
                  </div>
                  <div className={`${headerCellClass} text-center`} style={{ width: columnWidths.mat1Qty }}>수량</div>
                  <div className={`${headerCellClass} text-center`} style={{ width: columnWidths.mat2Name }}>
                    원재료품목2
                    <ResizeHandle column="mat2Name" />
                  </div>
                  <div className={`${headerCellClass} text-center`} style={{ width: columnWidths.mat2Qty }}>수량</div>
                  <div className={`${headerCellClass} text-center`} style={{ width: columnWidths.mat3Name }}>
                    원재료품목3
                    <ResizeHandle column="mat3Name" />
                  </div>
                  <div className={`${headerCellClass} text-center`} style={{ width: columnWidths.mat3Qty }}>수량</div>
                  <div className={`${headerCellClass} text-center`} style={{ width: columnWidths.mat4Name }}>
                    원재료품목4
                    <ResizeHandle column="mat4Name" />
                  </div>
                  <div className={`${headerCellClass} text-center`} style={{ width: columnWidths.mat4Qty }}>수량</div>
                  <div className={`${headerCellClass}`} style={{ width: columnWidths.status }}></div>
                  <div className={`${headerCellClass}`} style={{ width: columnWidths.actions }}></div>
                </div>
              </div>
            </div>
            <div className="overflow-y-auto overflow-x-auto" style={{ maxHeight: "calc(100vh - 280px)" }}>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : paginatedMappings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  등록된 상품이 없습니다
                </div>
              ) : (
                paginatedMappings.map((mapping) => {
                  const mat1 = getMaterialInfo(mapping.materials, 0);
                  const mat2 = getMaterialInfo(mapping.materials, 1);
                  const mat3 = getMaterialInfo(mapping.materials, 2);
                  const mat4 = getMaterialInfo(mapping.materials, 3);
                  return (
                    <div key={mapping.productCode} className="flex hover:bg-muted/30" data-testid={`row-product-${mapping.productCode}`}>
                      <div className={`${cellClass} text-center flex items-center justify-center`} style={{ width: columnWidths.checkbox, minWidth: columnWidths.checkbox }}>
                        <Checkbox
                          checked={selectedIds.includes(mapping.productCode)}
                          onCheckedChange={(checked) => toggleSelectOne(mapping.productCode, checked as boolean)}
                          data-testid={`checkbox-product-${mapping.productCode}`}
                        />
                      </div>
                      <div 
                        className={`${cellClass} font-mono text-blue-600 dark:text-blue-400 underline cursor-pointer truncate`} 
                        style={{ width: columnWidths.productCode, minWidth: columnWidths.productCode }}
                        onClick={() => handleOpenEditMapping(mapping)}
                      >
                        {mapping.productCode}
                      </div>
                      <div className={`${cellClass} truncate`} style={{ width: columnWidths.productName, minWidth: columnWidths.productName }}>
                        {mapping.productName}
                      </div>
                      <div className={`${cellClass} truncate`} style={{ width: columnWidths.mat1Name }}>{mat1.name}</div>
                      <div className={`${cellClass} text-center`} style={{ width: columnWidths.mat1Qty }}>{mat1.qty}</div>
                      <div className={`${cellClass} truncate`} style={{ width: columnWidths.mat2Name }}>{mat2.name}</div>
                      <div className={`${cellClass} text-center`} style={{ width: columnWidths.mat2Qty }}>{mat2.qty}</div>
                      <div className={`${cellClass} truncate`} style={{ width: columnWidths.mat3Name }}>{mat3.name}</div>
                      <div className={`${cellClass} text-center`} style={{ width: columnWidths.mat3Qty }}>{mat3.qty}</div>
                      <div className={`${cellClass} truncate`} style={{ width: columnWidths.mat4Name }}>{mat4.name}</div>
                      <div className={`${cellClass} text-center`} style={{ width: columnWidths.mat4Qty }}>{mat4.qty}</div>
                      <div className={`${cellClass} text-center`} style={{ width: columnWidths.status }}>
                        <span className={mapping.mappingStatus === "complete" ? "text-green-600" : "text-muted-foreground"}>
                          {mapping.mappingStatus === "complete" ? "사용" : "-"}
                        </span>
                      </div>
                      <div className={`${cellClass} text-center`} style={{ width: columnWidths.actions }}>
                        <div className="flex justify-center gap-0.5">
                          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleOpenEditMapping(mapping)} data-testid={`button-edit-${mapping.productCode}`}>
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleDeleteProduct(mapping.productCode)} data-testid={`button-delete-${mapping.productCode}`}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="lg:hidden">
            <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 220px)" }}>
              {isLoading ? (
                <div className="p-4 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                </div>
              ) : paginatedMappings.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground text-sm">
                  등록된 상품이 없습니다
                </div>
              ) : (
                <div className="divide-y">
                  {paginatedMappings.map((mapping) => (
                    <div key={mapping.productCode} className="p-2" data-testid={`card-product-${mapping.productCode}`}>
                      <div className="flex items-start gap-2">
                        <Checkbox
                          checked={selectedIds.includes(mapping.productCode)}
                          onCheckedChange={(checked) => toggleSelectOne(mapping.productCode, checked as boolean)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <div className="font-mono text-xs text-blue-600 dark:text-blue-400">{mapping.productCode}</div>
                            <div className="flex gap-0.5">
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleOpenEditMapping(mapping)}>
                                <Edit className="w-3 h-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDeleteProduct(mapping.productCode)}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                          <div className="text-sm font-medium truncate">{mapping.productName}</div>
                          <div className="mt-1 space-y-0.5">
                            {mapping.materials.slice(0, 4).map((mat, idx) => (
                              <div key={mat.materialCode} className="text-xs text-muted-foreground">
                                원재료{idx + 1}: {mat.materialName} ({mat.quantity})
                              </div>
                            ))}
                            {mapping.materials.length === 0 && (
                              <div className="text-xs text-muted-foreground">매핑된 재료 없음</div>
                            )}
                          </div>
                          <Badge variant={mapping.mappingStatus === "complete" ? "default" : "secondary"} className="mt-1 text-xs h-5">
                            {mapping.mappingStatus === "complete" ? "사용" : "미사용"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-xs"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => p - 1)}
            data-testid="button-prev-page"
          >
            <ChevronLeft className="w-3 h-3" />
            이전
          </Button>
          <span className="text-xs px-2">
            {currentPage} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-xs"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(p => p + 1)}
            data-testid="button-next-page"
          >
            다음
            <ChevronRight className="w-3 h-3" />
          </Button>
        </div>
      )}

      <Dialog open={addProductDialogOpen} onOpenChange={setAddProductDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>상품 추가</DialogTitle>
            <DialogDescription>매핑할 상품을 추가합니다</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                variant={addProductMode === "import" ? "default" : "outline"}
                size="sm"
                onClick={() => setAddProductMode("import")}
                data-testid="button-mode-import"
              >
                상품등록에서 가져오기
              </Button>
              <Button
                variant={addProductMode === "manual" ? "default" : "outline"}
                size="sm"
                onClick={() => setAddProductMode("manual")}
                data-testid="button-mode-manual"
              >
                직접 입력
              </Button>
            </div>

            {addProductMode === "import" ? (
              <div>
                <Label className="text-sm">가져올 상품 선택</Label>
                {availableProducts.length === 0 ? (
                  <div className="mt-2 p-4 text-center text-muted-foreground border rounded-md">
                    가져올 수 있는 상품이 없습니다
                  </div>
                ) : (
                  <ScrollArea className="h-[200px] mt-2 border rounded-md">
                    <div className="p-2 space-y-1">
                      {availableProducts.map((p) => (
                        <div
                          key={p.productCode}
                          className="flex items-center gap-2 p-2 rounded hover-elevate cursor-pointer"
                          onClick={() => {
                            if (selectedImportProducts.includes(p.productCode)) {
                              setSelectedImportProducts(selectedImportProducts.filter(c => c !== p.productCode));
                            } else {
                              setSelectedImportProducts([...selectedImportProducts, p.productCode]);
                            }
                          }}
                        >
                          <Checkbox checked={selectedImportProducts.includes(p.productCode)} />
                          <div>
                            <div className="font-mono text-sm">{p.productCode}</div>
                            <div className="text-sm text-muted-foreground">{p.productName}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
                {selectedImportProducts.length > 0 && (
                  <div className="mt-2 text-sm text-muted-foreground">
                    {selectedImportProducts.length}개 선택됨
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <Label className="text-sm">상품코드</Label>
                  <Input
                    value={manualProductCode}
                    onChange={(e) => setManualProductCode(e.target.value)}
                    placeholder="상품코드 입력"
                    className="mt-1"
                    data-testid="input-product-code"
                  />
                </div>
                <div>
                  <Label className="text-sm">상품명</Label>
                  <Input
                    value={manualProductName}
                    onChange={(e) => setManualProductName(e.target.value)}
                    placeholder="상품명 입력"
                    className="mt-1"
                    data-testid="input-product-name"
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetAddProductForm}>취소</Button>
            <Button
              onClick={handleAddProduct}
              disabled={addProductMutation.isPending || bulkAddProductMutation.isPending}
              data-testid="button-confirm-add"
            >
              {(addProductMutation.isPending || bulkAddProductMutation.isPending) && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              추가
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editMappingDialogOpen} onOpenChange={setEditMappingDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>재료 매핑 편집</DialogTitle>
            <DialogDescription>
              {editProductCode} - {editProductName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm">매핑된 재료 ({editMaterials.length}개)</Label>
              <Button size="sm" variant="outline" onClick={() => setAddMaterialDialogOpen(true)} data-testid="button-add-material">
                <Plus className="w-4 h-4 mr-1" />
                재료 추가
              </Button>
            </div>
            {editMaterials.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground border rounded-md">
                매핑된 재료가 없습니다
              </div>
            ) : (
              <div className="border rounded-md divide-y">
                {editMaterials.map((mat) => (
                  <div key={mat.materialCode} className="p-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-sm">{mat.materialCode}</div>
                      <div className="text-sm text-muted-foreground truncate">{mat.materialName}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-sm">수량:</Label>
                      <Input
                        type="number"
                        min={1}
                        value={mat.quantity}
                        onChange={(e) => handleUpdateMaterialQuantity(mat.materialCode, Number(e.target.value) || 1)}
                        className="w-20"
                        data-testid={`input-quantity-${mat.materialCode}`}
                      />
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleRemoveMaterialFromMapping(mat.materialCode)} data-testid={`button-remove-material-${mat.materialCode}`}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditMappingDialogOpen(false)}>취소</Button>
            <Button onClick={handleSaveMaterials} disabled={saveMaterialsMutation.isPending} data-testid="button-save-materials">
              {saveMaterialsMutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addMaterialDialogOpen} onOpenChange={setAddMaterialDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>재료 선택</DialogTitle>
            <DialogDescription>매핑할 재료를 선택합니다</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="재료코드 또는 재료명 검색"
                value={materialSearchQuery}
                onChange={(e) => setMaterialSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-material-search"
              />
            </div>
            <ScrollArea className="h-[300px] border rounded-md">
              <div className="p-2 space-y-1">
                {filteredMaterials.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">
                    재료를 찾을 수 없습니다
                  </div>
                ) : (
                  filteredMaterials.map((m) => (
                    <div
                      key={m.materialCode}
                      className="flex items-center gap-3 p-2 rounded hover-elevate cursor-pointer"
                      onClick={() => handleAddMaterialToMapping(m)}
                      data-testid={`material-option-${m.materialCode}`}
                    >
                      <Badge variant="secondary" className="text-xs">{m.materialType === "raw" ? "원" : m.materialType === "semi" ? "반" : "부"}</Badge>
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-sm">{m.materialCode}</div>
                        <div className="text-sm text-muted-foreground truncate">{m.materialName}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>상품 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteProductCode}" 상품을 삭제하시겠습니까? 매핑된 재료 정보도 함께 삭제됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteProductMutation.mutate(deleteProductCode)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>선택 상품 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              선택한 {selectedIds.length}개 상품을 삭제하시겠습니까? 매핑된 재료 정보도 함께 삭제됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-bulk-delete"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={uploadResultDialogOpen} onOpenChange={setUploadResultDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>업로드 결과</DialogTitle>
          </DialogHeader>
          {uploadResult && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>전체 상품:</div>
                <div className="font-medium">{uploadResult.totalProducts}개</div>
                <div>상품만 추가:</div>
                <div className="font-medium">{uploadResult.productOnlyCount}개</div>
                <div>재료 매핑 포함:</div>
                <div className="font-medium">{uploadResult.productWithMappingCount}개</div>
              </div>
              {uploadResult.errors.length > 0 && (
                <div className="mt-4">
                  <Label className="text-sm text-destructive">오류 ({uploadResult.errors.length}건)</Label>
                  <ScrollArea className="h-[100px] mt-2 border rounded-md p-2">
                    {uploadResult.errors.map((err, idx) => (
                      <div key={idx} className="text-sm text-destructive">{err}</div>
                    ))}
                  </ScrollArea>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setUploadResultDialogOpen(false)}>확인</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
