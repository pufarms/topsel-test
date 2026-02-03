import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
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
import { Plus, Trash2, Download, Upload, Loader2, Search, Edit, X, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, GripVertical, Filter, Link2 } from "lucide-react";
import { PageHeader } from "@/components/admin";
import type { ProductMapping, ProductMaterialMapping, Material, Category } from "@shared/schema";
import * as XLSX from "xlsx";

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
  saveStatus: number;
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
  saveStatus: 70,
  actions: 80,
};

export default function ProductMappingPage() {
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const uploadInputRef = useRef<HTMLInputElement>(null);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [unmappedProductsFromUrl, setUnmappedProductsFromUrl] = useState<{ productCode: string; productName: string; categoryLarge?: string | null; categoryMedium?: string | null; categorySmall?: string | null }[] | null>(null);
  const [sortOption, setSortOption] = useState("default");
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  const [filterCategoryLarge, setFilterCategoryLarge] = useState<string>("all");
  const [filterCategoryMedium, setFilterCategoryMedium] = useState<string>("all");
  const [filterCategorySmall, setFilterCategorySmall] = useState<string>("all");
  
  const [columnWidths, setColumnWidths] = useState<ColumnWidth>(DEFAULT_COLUMN_WIDTHS);
  const [resizing, setResizing] = useState<{ column: keyof ColumnWidth; startX: number; startWidth: number } | null>(null);
  
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [productDialogMode, setProductDialogMode] = useState<"add" | "edit">("add");
  const [editProductCode, setEditProductCode] = useState("");
  const [editProductName, setEditProductName] = useState("");
  const [editCategoryLarge, setEditCategoryLarge] = useState("");
  const [editCategoryMedium, setEditCategoryMedium] = useState("");
  const [editCategorySmall, setEditCategorySmall] = useState("");
  const [editMaterials, setEditMaterials] = useState<{ materialCode: string; materialName: string; materialType: string; quantity: number }[]>([]);
  const [editUsageStatus, setEditUsageStatus] = useState<"사용" | "미사용">("사용");
  const [editMemo, setEditMemo] = useState("");
  const [originalProductCode, setOriginalProductCode] = useState("");
  
  const [materialSelectDialogOpen, setMaterialSelectDialogOpen] = useState(false);
  const [materialSearchQuery, setMaterialSearchQuery] = useState("");
  const [materialFilterLarge, setMaterialFilterLarge] = useState("all");
  const [materialFilterMedium, setMaterialFilterMedium] = useState("all");
  const [materialCurrentPage, setMaterialCurrentPage] = useState(1);
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteProductCode, setDeleteProductCode] = useState("");
  
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  
  // 상품등록 미등록 경고 다이얼로그
  const [notRegisteredDialogOpen, setNotRegisteredDialogOpen] = useState(false);
  const [notRegisteredProductCode, setNotRegisteredProductCode] = useState("");
  
  const [uploadResultDialogOpen, setUploadResultDialogOpen] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ totalProducts: number; productOnlyCount: number; productWithMappingCount: number; errors: string[] } | null>(null);

  const { data: productMappings = [], isLoading } = useQuery<ProductMappingWithMaterials[]>({
    queryKey: ["/api/product-mappings"],
  });

  const { data: availableProducts = [] } = useQuery<{ productCode: string; productName: string; categoryLarge?: string | null; categoryMedium?: string | null; categorySmall?: string | null }[]>({
    queryKey: ["/api/product-mappings/available-products"],
  });

  const { data: allMaterials = [] } = useQuery<Material[]>({
    queryKey: ["/api/materials"],
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: materialCategoriesLarge = [] } = useQuery<{ id: string; name: string; sortOrder: number }[]>({
    queryKey: ["/api/material-categories/large"],
  });

  const { data: materialCategoriesMediumAll = [] } = useQuery<{ id: string; name: string; largeCategoryId: string | null; sortOrder: number }[]>({
    queryKey: ["/api/material-categories/medium"],
  });

  const materialCategoriesMedium = useMemo(() => {
    if (materialFilterLarge === "all" || materialFilterLarge === "") return [];
    return materialCategoriesMediumAll.filter(c => c.largeCategoryId === materialFilterLarge);
  }, [materialCategoriesMediumAll, materialFilterLarge]);

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

  // State to track if we need to open a specific product from URL
  const [pendingProductCodeFromUrl, setPendingProductCodeFromUrl] = useState<string | null>(null);

  // Parse URL parameter for unmapped products and auto-add them
  useEffect(() => {
    const url = new URL(window.location.href);
    const unmappedParam = url.searchParams.get("unmapped");
    const productCodeParam = url.searchParams.get("productCode");
    
    if (unmappedParam) {
      try {
        const products = JSON.parse(decodeURIComponent(unmappedParam)) as { productCode: string; productName: string; categoryLarge?: string | null; categoryMedium?: string | null; categorySmall?: string | null }[];
        if (products && products.length > 0) {
          setUnmappedProductsFromUrl(products);
          // Clear the URL parameter to prevent re-adding on refresh
          url.searchParams.delete("unmapped");
          window.history.replaceState({}, "", url.toString());
        }
      } catch (e) {
        console.error("Failed to parse unmapped products from URL:", e);
      }
    }
    
    // Handle productCode parameter to open edit modal for a specific product
    if (productCodeParam) {
      setPendingProductCodeFromUrl(decodeURIComponent(productCodeParam));
      // Clear the URL parameter
      url.searchParams.delete("productCode");
      url.searchParams.delete("mode");
      url.searchParams.delete("returnTo");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);
  
  // Open edit modal when product code from URL is found in mappings
  useEffect(() => {
    if (pendingProductCodeFromUrl && !isLoading) {
      const foundMapping = productMappings.find(m => m.productCode === pendingProductCodeFromUrl);
      if (foundMapping) {
        handleOpenEditMapping(foundMapping);
      }
      setPendingProductCodeFromUrl(null);
    }
  }, [pendingProductCodeFromUrl, productMappings, isLoading]);

  // Auto-add unmapped products when they are parsed from URL
  useEffect(() => {
    if (unmappedProductsFromUrl && unmappedProductsFromUrl.length > 0 && !isLoading) {
      // Filter out products that already exist in productMappings
      const existingCodes = new Set(productMappings.map(p => p.productCode));
      const newProducts = unmappedProductsFromUrl.filter(p => !existingCodes.has(p.productCode));
      
      if (newProducts.length > 0) {
        // Use bulk add mutation to add all products
        bulkAddProductMutation.mutate(newProducts, {
          onSuccess: () => {
            toast({
              title: "매핑 필요 상품이 추가되었습니다",
              description: `${newProducts.length}개 상품이 목록에 추가되었습니다. 재료 매핑을 완료해주세요.`,
            });
            setUnmappedProductsFromUrl(null);
          },
        });
      } else {
        // All products already exist
        toast({
          title: "상품이 이미 존재합니다",
          description: `${unmappedProductsFromUrl.length}개 상품이 이미 목록에 있습니다. 재료 매핑을 완료해주세요.`,
        });
        setUnmappedProductsFromUrl(null);
      }
    }
  }, [unmappedProductsFromUrl, productMappings, isLoading]);

  const editSelectedLargeCategory = useMemo(() => 
    largeCategories.find(lc => lc.name === editCategoryLarge), [largeCategories, editCategoryLarge]);
  
  const editMediumCategories = useMemo(() => {
    if (!editCategoryLarge || !editSelectedLargeCategory) return [];
    return categories.filter(c => c.level === "medium" && c.parentId === editSelectedLargeCategory.id);
  }, [categories, editCategoryLarge, editSelectedLargeCategory]);
  
  const editSelectedMediumCategory = useMemo(() => 
    editMediumCategories.find(mc => mc.name === editCategoryMedium), [editMediumCategories, editCategoryMedium]);
  
  const editSmallCategories = useMemo(() => {
    if (!editCategoryMedium || !editSelectedMediumCategory) return [];
    return categories.filter(c => c.level === "small" && c.parentId === editSelectedMediumCategory.id);
  }, [categories, editCategoryMedium, editSelectedMediumCategory]);

  const filteredMaterialsForSelect = useMemo(() => {
    return allMaterials.filter(m => {
      const matchesSearch = materialSearchQuery === "" ||
        m.materialCode.toLowerCase().includes(materialSearchQuery.toLowerCase()) ||
        m.materialName.toLowerCase().includes(materialSearchQuery.toLowerCase());
      const matchesLargeCategory = materialFilterLarge === "" || materialFilterLarge === "all" || m.largeCategoryId === materialFilterLarge;
      const matchesMediumCategory = materialFilterMedium === "" || materialFilterMedium === "all" || m.mediumCategoryId === materialFilterMedium;
      return matchesSearch && matchesLargeCategory && matchesMediumCategory;
    });
  }, [allMaterials, materialSearchQuery, materialFilterLarge, materialFilterMedium]);

  const MATERIAL_PAGE_SIZE = 10;
  const materialTotalPages = Math.ceil(filteredMaterialsForSelect.length / MATERIAL_PAGE_SIZE);
  const paginatedMaterialsForSelect = filteredMaterialsForSelect.slice(
    (materialCurrentPage - 1) * MATERIAL_PAGE_SIZE,
    materialCurrentPage * MATERIAL_PAGE_SIZE
  );

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

    // 기본 정렬: 미저장(재료 없음) 상품이 맨 위로
    result = [...result].sort((a, b) => {
      const aHasMaterials = a.materials && a.materials.length > 0;
      const bHasMaterials = b.materials && b.materials.length > 0;
      
      // 미저장 상품 우선 (재료 없는 상품이 먼저)
      if (!aHasMaterials && bHasMaterials) return -1;
      if (aHasMaterials && !bHasMaterials) return 1;
      
      // 동일 저장상태 내에서 추가 정렬 옵션 적용
      if (sortOption === "code_asc") {
        return a.productCode.localeCompare(b.productCode);
      } else if (sortOption === "code_desc") {
        return b.productCode.localeCompare(a.productCode);
      } else if (sortOption === "name_asc") {
        return a.productName.localeCompare(b.productName);
      } else if (sortOption === "name_desc") {
        return b.productName.localeCompare(a.productName);
      }
      return 0;
    });

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
    mutationFn: async (data: { productCode: string; productName: string; categoryLarge?: string; categoryMedium?: string; categorySmall?: string; usageStatus?: string }) => {
      const res = await apiRequest("POST", "/api/product-mappings", data);
      return res.json();
    },
    onError: (error: any) => {
      toast({ title: "오류", description: error.message, variant: "destructive" });
    },
  });

  const bulkAddProductMutation = useMutation({
    mutationFn: async (products: { productCode: string; productName: string; categoryLarge?: string | null; categoryMedium?: string | null; categorySmall?: string | null }[]) => {
      const res = await apiRequest("POST", "/api/product-mappings/bulk", { products });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/product-mappings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/product-mappings/available-products"] });
      toast({ title: `${data.created}개 상품이 추가되었습니다` });
      resetProductForm();
    },
    onError: (error: any) => {
      toast({ title: "오류", description: error.message, variant: "destructive" });
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (productCode: string) => {
      const res = await fetch(`/api/product-mappings/${productCode}`, { method: "DELETE", credentials: "include" });
      const data = await res.json();
      return { ok: res.ok, data, message: data.message };
    },
    onSuccess: (result) => {
      setDeleteDialogOpen(false);
      if (result.ok) {
        queryClient.invalidateQueries({ queryKey: ["/api/product-mappings"] });
        queryClient.invalidateQueries({ queryKey: ["/api/product-mappings/available-products"] });
        toast({ title: "상품이 삭제되었습니다" });
      } else {
        toast({ title: "삭제 불가", description: result.message || "삭제에 실패했습니다", variant: "destructive" });
      }
    },
    onError: () => {
      setDeleteDialogOpen(false);
      toast({ title: "오류", description: "네트워크 오류가 발생했습니다", variant: "destructive" });
    },
  });

  const saveMaterialsMutation = useMutation({
    mutationFn: async ({ productCode, materials }: { productCode: string; materials: { materialCode: string; materialName: string; materialType: string; quantity: number }[] }) => {
      const res = await fetch(`/api/product-mappings/${productCode}/materials`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ materials }),
      });
      const data = await res.json();
      return { ok: res.ok, data, message: data.message };
    },
    onSuccess: (result) => {
      if (result.ok) {
        queryClient.invalidateQueries({ queryKey: ["/api/product-mappings"] });
        toast({ title: "재료 매핑이 저장되었습니다" });
        resetProductForm();
      } else {
        toast({ title: "저장 불가", description: result.message || "저장에 실패했습니다", variant: "destructive" });
      }
    },
    onError: () => {
      toast({ title: "오류", description: "네트워크 오류가 발생했습니다", variant: "destructive" });
    },
  });

  const updateProductMappingMutation = useMutation({
    mutationFn: async (data: { productCode: string; productName: string; categoryLarge?: string; categoryMedium?: string; categorySmall?: string; usageStatus?: string }) => {
      const res = await apiRequest("PUT", `/api/product-mappings/${data.productCode}`, data);
      return res.json();
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

  const resetProductForm = () => {
    setProductDialogOpen(false);
    setProductDialogMode("add");
    setEditProductCode("");
    setEditProductName("");
    setEditCategoryLarge("");
    setEditCategoryMedium("");
    setEditCategorySmall("");
    setEditMaterials([]);
    setEditUsageStatus("사용");
    setEditMemo("");
    setOriginalProductCode("");
  };

  const handleOpenAddProduct = () => {
    resetProductForm();
    setProductDialogMode("add");
    setProductDialogOpen(true);
  };

  const handleOpenEditMapping = (product: ProductMappingWithMaterials) => {
    setProductDialogMode("edit");
    setOriginalProductCode(product.productCode);
    setEditProductCode(product.productCode);
    setEditProductName(product.productName);
    setEditCategoryLarge(product.categoryLarge || "");
    setEditCategoryMedium(product.categoryMedium || "");
    setEditCategorySmall(product.categorySmall || "");
    setEditMaterials(product.materials.map(m => {
      const materialInfo = allMaterials.find(mat => mat.materialCode === m.materialCode);
      return {
        materialCode: m.materialCode,
        materialName: m.materialName,
        materialType: materialInfo?.materialType || "raw",
        quantity: m.quantity,
      };
    }));
    setEditUsageStatus(product.usageStatus === "Y" ? "사용" : "미사용");
    setEditMemo("");
    setProductDialogOpen(true);
  };

  const handleAddMaterialToMapping = (material: Material) => {
    if (editMaterials.some(m => m.materialCode === material.materialCode)) {
      toast({ title: "이미 추가된 재료입니다", variant: "destructive" });
      return;
    }
    setEditMaterials([...editMaterials, {
      materialCode: material.materialCode,
      materialName: material.materialName,
      materialType: material.materialType || "원재료",
      quantity: 1,
    }]);
    setMaterialSelectDialogOpen(false);
    setMaterialSearchQuery("");
    setMaterialFilterLarge("all");
    setMaterialFilterMedium("all");
  };

  const handleRemoveMaterialFromMapping = (materialCode: string) => {
    setEditMaterials(editMaterials.filter(m => m.materialCode !== materialCode));
  };

  const handleUpdateMaterialQuantity = (materialCode: string, quantity: number) => {
    setEditMaterials(editMaterials.map(m => 
      m.materialCode === materialCode ? { ...m, quantity } : m
    ));
  };

  const handleSaveMaterials = async () => {
    if (!editCategoryLarge || !editCategoryMedium || !editCategorySmall) {
      toast({ 
        title: "카테고리 필수", 
        description: "대분류, 중분류, 소분류 카테고리를 모두 선택해야 합니다.", 
        variant: "destructive" 
      });
      return;
    }
    
    try {
      if (productDialogMode === "add") {
        // 상품등록(공급가계산) 연계 체크 (필수!)
        const checkRes = await fetch(`/api/product-registrations/check-by-code/${encodeURIComponent(editProductCode)}`, {
          credentials: "include"
        });
        const checkData = await checkRes.json();
        
        if (!checkData.exists) {
          // 상품등록에 없음 → 경고 다이얼로그 표시
          setNotRegisteredProductCode(editProductCode);
          setNotRegisteredDialogOpen(true);
          return;
        }
        
        // 등록 모드: 먼저 상품 매핑을 생성하고, 그 다음 재료를 저장
        await addProductMutation.mutateAsync({
          productCode: editProductCode,
          productName: editProductName,
          categoryLarge: editCategoryLarge || undefined,
          categoryMedium: editCategoryMedium || undefined,
          categorySmall: editCategorySmall || undefined,
          usageStatus: editUsageStatus === "사용" ? "Y" : "N",
        });
        // 재료가 있으면 저장
        if (editMaterials.length > 0) {
          const result = await saveMaterialsMutation.mutateAsync({ productCode: editProductCode, materials: editMaterials });
          if (!result.ok) {
            return; // 에러는 onSuccess에서 처리됨
          }
        } else {
          queryClient.invalidateQueries({ queryKey: ["/api/product-mappings"] });
          toast({ title: "상품이 추가되었습니다" });
          resetProductForm();
        }
      } else {
        // 수정 모드: 상품 매핑 업데이트 후 재료 저장
        await updateProductMappingMutation.mutateAsync({
          productCode: editProductCode,
          productName: editProductName,
          categoryLarge: editCategoryLarge || undefined,
          categoryMedium: editCategoryMedium || undefined,
          categorySmall: editCategorySmall || undefined,
          usageStatus: editUsageStatus === "사용" ? "Y" : "N",
        });
        // 재료 저장
        const result = await saveMaterialsMutation.mutateAsync({ productCode: editProductCode, materials: editMaterials });
        if (!result.ok) {
          return; // 에러는 onSuccess에서 처리됨
        }
      }
    } catch (error: any) {
      toast({ title: "오류", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteProduct = (productCode: string) => {
    setDeleteProductCode(productCode);
    setDeleteDialogOpen(true);
  };

  const handleBulkDelete = async () => {
    const protectedProducts: string[] = [];
    const deletedProducts: string[] = [];
    
    for (const productCode of selectedIds) {
      const result = await deleteProductMutation.mutateAsync(productCode);
      if (result.ok) {
        deletedProducts.push(productCode);
      } else {
        protectedProducts.push(productCode);
      }
    }
    
    setBulkDeleteDialogOpen(false);
    setSelectedIds([]);
    
    if (deletedProducts.length > 0) {
      queryClient.invalidateQueries({ queryKey: ["/api/product-mappings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/product-mappings/available-products"] });
    }
    
    if (protectedProducts.length > 0 && deletedProducts.length > 0) {
      toast({ 
        title: "일부 삭제 완료", 
        description: `${deletedProducts.length}개 삭제, ${protectedProducts.length}개는 차주/현재 공급가 상품으로 삭제 불가`,
        variant: "default"
      });
    } else if (protectedProducts.length > 0) {
      toast({ 
        title: "삭제 불가", 
        description: `선택한 ${protectedProducts.length}개 상품은 차주/현재 공급가 상품으로 삭제가 불가합니다`,
        variant: "destructive"
      });
    } else if (deletedProducts.length > 0) {
      toast({ title: `${deletedProducts.length}개 상품이 삭제되었습니다` });
    }
  };

  const handleDownloadTemplate = () => {
    window.location.href = "/api/product-mappings/template";
  };

  const handleDownloadList = () => {
    if (filteredAndSortedMappings.length === 0) {
      toast({ title: "다운로드 실패", description: "다운로드할 상품매핑이 없습니다.", variant: "destructive" });
      return;
    }

    const headers = ["상품코드", "상품명", "대분류", "중분류", "소분류", "사용여부", "매핑상태", "재료1", "수량1", "재료2", "수량2", "재료3", "수량3", "재료4", "수량4"];
    const rows = filteredAndSortedMappings.map(m => {
      const mats = m.materials || [];
      return [
        m.productCode || "",
        m.productName || "",
        m.categoryLarge || "",
        m.categoryMedium || "",
        m.categorySmall || "",
        m.usageStatus === "Y" ? "사용" : "미사용",
        m.mappingStatus === "complete" ? "완료" : "미완료",
        mats[0]?.materialName || "",
        mats[0]?.quantity || "",
        mats[1]?.materialName || "",
        mats[1]?.quantity || "",
        mats[2]?.materialName || "",
        mats[2]?.quantity || "",
        mats[3]?.materialName || "",
        mats[3]?.quantity || "",
      ];
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    XLSX.utils.book_append_sheet(wb, ws, "상품매핑");

    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    XLSX.writeFile(wb, `상품매핑_${dateStr}.xlsx`);
    toast({ title: "다운로드 완료", description: `${filteredAndSortedMappings.length}개 상품매핑이 다운로드되었습니다.` });
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

  const getMaterialTypeLabel = (type: string): string => {
    switch (type) {
      case "raw": return "원재료";
      case "semi": return "반재료";
      case "sub": return "부재료";
      default: return "원재료";
    }
  };

  const getMaterialInfo = (materials: ProductMaterialMapping[], index: number) => {
    const mat = materials[index];
    if (!mat) return { name: "", qty: "" };
    const typeLabel = getMaterialTypeLabel(mat.materialType || "raw");
    return { name: `${typeLabel}/ ${mat.materialName}`, qty: mat.quantity };
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
    <div className="space-y-3 p-4" data-testid="page-product-mapping">
      <PageHeader
        title="상품매핑"
        description="공급상품과 원재료를 연결하여 재고관리에 활용합니다."
        icon={Link2}
      />

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">총</span>
                <span className="text-lg font-bold text-primary">{filteredAndSortedMappings.length}건</span>
                <span className="text-sm text-muted-foreground ml-2">
                  ({currentPage} Page / Tot {totalPages || 1} Page)
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={handleDownloadList} data-testid="button-download-list">
                  <Download className="w-4 h-4 mr-1" />
                  엑셀 다운로드
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownloadTemplate} data-testid="button-download-template">
                  <Download className="w-4 h-4 mr-1" />
                  양식 다운로드
                </Button>
                <Button variant="outline" size="sm" onClick={() => uploadInputRef.current?.click()} disabled={uploadMutation.isPending} data-testid="button-upload-excel">
                  {uploadMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
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
                <Button size="sm" onClick={handleOpenAddProduct} data-testid="button-add-product">
                  <Plus className="w-4 h-4 mr-1" />
                  추가
                </Button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <div className="flex items-center gap-2 flex-wrap">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <Select 
                  value={filterCategoryLarge} 
                  onValueChange={(v) => {
                    setFilterCategoryLarge(v);
                    setFilterCategoryMedium("all");
                    setFilterCategorySmall("all");
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="w-28 h-9" data-testid="select-category-large">
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
                  <SelectTrigger className="w-28 h-9" data-testid="select-category-medium">
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
                  <SelectTrigger className="w-28 h-9" data-testid="select-category-small">
                    <SelectValue placeholder="소분류" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">소분류 전체</SelectItem>
                    {smallCategories.map((c) => (
                      <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Label className="text-sm whitespace-nowrap ml-3">판매상품명</Label>
                <Input
                  placeholder="검색"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-40 h-9"
                  data-testid="input-search"
                />
                <Button variant="outline" size="sm" className="h-9" onClick={() => setSearchQuery("")}>
                  <Search className="w-4 h-4" />
                </Button>
                {selectedIds.length > 0 && (
                  <Button variant="destructive" size="sm" className="h-9" onClick={() => setBulkDeleteDialogOpen(true)} data-testid="button-bulk-delete">
                    삭제하기
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2 sm:ml-auto">
                <Select value={sortOption} onValueChange={setSortOption}>
                  <SelectTrigger className="w-32 h-9" data-testid="select-sort">
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
                  <SelectTrigger className="w-24 h-9" data-testid="select-items-per-page">
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
        </CardContent>
      </Card>

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
                  <div className={`${headerCellClass} text-center`} style={{ width: columnWidths.status }}>사용유무</div>
                  <div className={`${headerCellClass} text-center`} style={{ width: columnWidths.saveStatus }}>저장상태</div>
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
                        <span className={mapping.usageStatus === "Y" ? "text-green-600" : "text-muted-foreground"}>
                          {mapping.usageStatus === "Y" ? "사용" : "미사용"}
                        </span>
                      </div>
                      <div className={`${cellClass} text-center`} style={{ width: columnWidths.saveStatus }}>
                        {mapping.materials && mapping.materials.length > 0 ? (
                          <span className="text-blue-600 dark:text-blue-400 font-medium">저장</span>
                        ) : (
                          <span className="text-red-600 dark:text-red-400 font-medium">미저장</span>
                        )}
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
                                재료{idx + 1}: {getMaterialTypeLabel(mat.materialType || "raw")}/ {mat.materialName} ({mat.quantity})
                              </div>
                            ))}
                            {mapping.materials.length === 0 && (
                              <div className="text-xs text-muted-foreground">매핑된 재료 없음</div>
                            )}
                          </div>
                          <div className="flex gap-1 mt-1">
                            <Badge variant={mapping.usageStatus === "Y" ? "default" : "secondary"} className="text-xs h-5">
                              {mapping.usageStatus === "Y" ? "사용" : "미사용"}
                            </Badge>
                            <Badge 
                              variant="outline" 
                              className={`text-xs h-5 ${mapping.materials && mapping.materials.length > 0 ? "text-blue-600 border-blue-600" : "text-red-600 border-red-600"}`}
                            >
                              {mapping.materials && mapping.materials.length > 0 ? "저장" : "미저장"}
                            </Badge>
                          </div>
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

      <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              판매상품 매핑 {productDialogMode === "add" ? "등록" : "수정"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-[100px_1fr] gap-4 items-start">
              <Label className="text-sm font-medium text-right pt-2 bg-amber-100 dark:bg-amber-900/30 px-2 py-2 rounded">카테고리</Label>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">대분류</Label>
                  <Select 
                    value={editCategoryLarge} 
                    onValueChange={(v) => {
                      setEditCategoryLarge(v);
                      setEditCategoryMedium("");
                      setEditCategorySmall("");
                    }}
                  >
                    <SelectTrigger className="mt-1" data-testid="input-category-large">
                      <SelectValue placeholder="선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {largeCategories.map((c) => (
                        <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">중분류</Label>
                  <Select 
                    value={editCategoryMedium} 
                    onValueChange={(v) => {
                      setEditCategoryMedium(v);
                      setEditCategorySmall("");
                    }}
                    disabled={!editCategoryLarge}
                  >
                    <SelectTrigger className="mt-1" data-testid="input-category-medium">
                      <SelectValue placeholder="선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {editMediumCategories.map((c) => (
                        <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">소분류</Label>
                  <Select 
                    value={editCategorySmall} 
                    onValueChange={setEditCategorySmall}
                    disabled={!editCategoryMedium}
                  >
                    <SelectTrigger className="mt-1" data-testid="input-category-small">
                      <SelectValue placeholder="선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {editSmallCategories.map((c) => (
                        <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-[100px_1fr] gap-4 items-start">
              <Label className="text-sm font-medium text-right pt-2 bg-amber-100 dark:bg-amber-900/30 px-2 py-2 rounded">판매상품코드</Label>
              <div>
                <Input
                  value={editProductCode}
                  onChange={(e) => setEditProductCode(e.target.value)}
                  placeholder="상품코드 입력"
                  data-testid="input-product-code"
                />
                <p className="text-xs text-destructive mt-1">* 수정은 가능하나 고유값으로 진행해주세요</p>
              </div>
            </div>

            <div className="grid grid-cols-[100px_1fr] gap-4 items-start">
              <Label className="text-sm font-medium text-right pt-2 bg-amber-100 dark:bg-amber-900/30 px-2 py-2 rounded">판매상품명</Label>
              <Input
                value={editProductName}
                onChange={(e) => setEditProductName(e.target.value)}
                placeholder="상품명 입력"
                data-testid="input-product-name"
              />
            </div>

            <div className="grid grid-cols-[100px_1fr] gap-4 items-start">
              <Label className="text-sm font-medium text-right pt-2 bg-amber-100 dark:bg-amber-900/30 px-2 py-2 rounded">연결된<br/>원재료품목</Label>
              <div className="space-y-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => {
                    setMaterialSelectDialogOpen(true);
                    setMaterialSearchQuery("");
                    setMaterialFilterLarge("all");
                    setMaterialFilterMedium("all");
                    setMaterialCurrentPage(1);
                  }} 
                  data-testid="button-add-material"
                >
                  추가
                </Button>
                
                {editMaterials.length > 0 && (
                  <div className="border rounded-md overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">재료타입</th>
                          <th className="px-3 py-2 text-left font-medium">원재료품목코드</th>
                          <th className="px-3 py-2 text-left font-medium">원재료품목명</th>
                          <th className="px-3 py-2 text-center font-medium">수량(Kg)</th>
                          <th className="px-3 py-2 text-center font-medium">Act</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {editMaterials.map((mat) => (
                          <tr key={mat.materialCode}>
                            <td className="px-3 py-2">{mat.materialType === "raw" ? "원재료" : mat.materialType === "semi" ? "반재료" : "부재료"}</td>
                            <td className="px-3 py-2 font-mono">{mat.materialCode}</td>
                            <td className="px-3 py-2">{mat.materialName}</td>
                            <td className="px-3 py-2">
                              <Input
                                type="number"
                                min={0}
                                step={0.1}
                                value={mat.quantity}
                                onChange={(e) => handleUpdateMaterialQuantity(mat.materialCode, Number(e.target.value) || 0)}
                                className="w-20 h-8 text-center"
                                data-testid={`input-quantity-${mat.materialCode}`}
                              />
                            </td>
                            <td className="px-3 py-2 text-center">
                              <Button 
                                variant="destructive" 
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => handleRemoveMaterialFromMapping(mat.materialCode)} 
                                data-testid={`button-remove-material-${mat.materialCode}`}
                              >
                                삭제
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-[100px_1fr] gap-4 items-center">
              <Label className="text-sm font-medium text-right bg-amber-100 dark:bg-amber-900/30 px-2 py-2 rounded">사용유무</Label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="radio" 
                    checked={editUsageStatus === "사용"} 
                    onChange={() => setEditUsageStatus("사용")}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">사용</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="radio" 
                    checked={editUsageStatus === "미사용"} 
                    onChange={() => setEditUsageStatus("미사용")}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">미사용</span>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-[100px_1fr] gap-4 items-start">
              <Label className="text-sm font-medium text-right pt-2 bg-amber-100 dark:bg-amber-900/30 px-2 py-2 rounded">메모</Label>
              <textarea
                value={editMemo}
                onChange={(e) => setEditMemo(e.target.value)}
                className="w-full min-h-[100px] border rounded-md p-2 text-sm resize-y"
                placeholder="메모를 입력하세요"
                data-testid="input-memo"
              />
            </div>
          </div>

          <DialogFooter className="flex justify-end gap-2 mt-4">
            {productDialogMode === "edit" && (
              <Button 
                variant="secondary" 
                onClick={() => handleDeleteProduct(originalProductCode)}
                data-testid="button-delete-mapping"
              >
                삭제
              </Button>
            )}
            <Button 
              onClick={handleSaveMaterials} 
              disabled={saveMaterialsMutation.isPending || addProductMutation.isPending}
              className="bg-amber-500 hover:bg-amber-600 text-white"
              data-testid="button-save-product"
            >
              {(saveMaterialsMutation.isPending || addProductMutation.isPending) && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              저장
            </Button>
            <Button variant="outline" onClick={resetProductForm}>
              목록
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={materialSelectDialogOpen} onOpenChange={setMaterialSelectDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader className="flex flex-row items-center justify-between">
            <DialogTitle className="text-lg font-bold">추가할 원재료품목</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">총 {filteredMaterialsForSelect.length} 건</span>
              <span className="text-sm text-muted-foreground">
                ({materialCurrentPage} Page / Tot {materialTotalPages} Page)
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <Select 
                value={materialFilterLarge} 
                onValueChange={(v) => {
                  setMaterialFilterLarge(v);
                  setMaterialFilterMedium("all");
                  setMaterialCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-32" data-testid="select-material-category-large">
                  <SelectValue placeholder="대분류" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  {materialCategoriesLarge.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select 
                value={materialFilterMedium} 
                onValueChange={(v) => {
                  setMaterialFilterMedium(v);
                  setMaterialCurrentPage(1);
                }}
                disabled={materialFilterLarge === "all"}
              >
                <SelectTrigger className="w-32" data-testid="select-material-category-medium">
                  <SelectValue placeholder="중분류" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  {materialCategoriesMedium.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="원재료품목명"
                value={materialSearchQuery}
                onChange={(e) => {
                  setMaterialSearchQuery(e.target.value);
                  setMaterialCurrentPage(1);
                }}
                className="flex-1"
                data-testid="input-material-search"
              />
              <Button variant="default" size="sm" className="bg-blue-500 hover:bg-blue-600">
                <Search className="w-4 h-4 mr-1" />
                검색
              </Button>
            </div>

            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">분류</th>
                    <th className="px-3 py-2 text-left font-medium">원재료품목코드</th>
                    <th className="px-3 py-2 text-left font-medium">원재료품목명</th>
                    <th className="px-3 py-2 text-center font-medium">재고수량(Kg)</th>
                    <th className="px-3 py-2 text-center font-medium">Act</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {paginatedMaterialsForSelect.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                        재료를 찾을 수 없습니다
                      </td>
                    </tr>
                  ) : (
                    paginatedMaterialsForSelect.map((m) => (
                      <tr key={m.materialCode} className="hover:bg-muted/30">
                        <td className="px-3 py-2">{m.materialType === "raw" ? "원재료" : m.materialType === "semi" ? "반재료" : "부재료"}</td>
                        <td className="px-3 py-2 font-mono">{m.materialCode}</td>
                        <td className="px-3 py-2">{m.materialName}</td>
                        <td className="px-3 py-2 text-center text-red-500 font-medium">{m.currentStock}</td>
                        <td className="px-3 py-2 text-center">
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => handleAddMaterialToMapping(m)}
                            data-testid={`button-select-material-${m.materialCode}`}
                          >
                            추가
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {materialTotalPages > 1 && (
              <div className="flex items-center justify-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={materialCurrentPage === 1}
                  onClick={() => setMaterialCurrentPage(1)}
                  className="h-8 w-8 p-0"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={materialCurrentPage === 1}
                  onClick={() => setMaterialCurrentPage(p => p - 1)}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                {(() => {
                  const pages: number[] = [];
                  const maxVisiblePages = 5;
                  let startPage = Math.max(1, materialCurrentPage - Math.floor(maxVisiblePages / 2));
                  let endPage = Math.min(materialTotalPages, startPage + maxVisiblePages - 1);
                  
                  if (endPage - startPage + 1 < maxVisiblePages) {
                    startPage = Math.max(1, endPage - maxVisiblePages + 1);
                  }
                  
                  for (let i = startPage; i <= endPage; i++) {
                    pages.push(i);
                  }
                  
                  return pages.map(page => (
                    <Button
                      key={page}
                      variant={page === materialCurrentPage ? "default" : "outline"}
                      size="sm"
                      onClick={() => setMaterialCurrentPage(page)}
                      className="h-8 w-8 p-0"
                    >
                      {page}
                    </Button>
                  ));
                })()}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={materialCurrentPage === materialTotalPages}
                  onClick={() => setMaterialCurrentPage(p => p + 1)}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={materialCurrentPage === materialTotalPages}
                  onClick={() => setMaterialCurrentPage(materialTotalPages)}
                  className="h-8 w-8 p-0"
                >
                  <ChevronsRight className="w-4 h-4" />
                </Button>
              </div>
            )}
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

      <AlertDialog open={notRegisteredDialogOpen} onOpenChange={setNotRegisteredDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-amber-600">등록되지 않은 상품</AlertDialogTitle>
            <AlertDialogDescription className="whitespace-pre-line">
              상품코드 "{notRegisteredProductCode}"는 상품등록(공급가계산)에 등록되지 않은 상품입니다.{"\n\n"}
              상품등록 후 상품매핑과 재고등록이 가능합니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setNotRegisteredDialogOpen(false);
                resetProductForm();
                const params = new URLSearchParams();
                params.set("newProductCode", notRegisteredProductCode);
                setLocation(`/admin/products/registration?${params.toString()}`);
              }}
              data-testid="button-go-to-registration"
            >
              상품등록으로 이동
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
