import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Plus, Trash2, Upload, Download, Calculator, Send, StopCircle, Search, RotateCcw, Save, Check, CheckCircle, AlertTriangle, Link2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { PageHeader } from "@/components/admin";
import type { ProductRegistration, Category } from "@shared/schema";
import * as XLSX from "xlsx";

// Debounce utility function
function debounce<T extends (...args: any[]) => any>(fn: T, delay: number): T & { cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const debounced = (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
  debounced.cancel = () => {
    if (timeoutId) clearTimeout(timeoutId);
  };
  return debounced as T & { cancel: () => void };
}

const COLUMN_KEYS = [
  "checkbox", "categoryLarge", "categoryMedium", "categorySmall", "weight", "productCode", "productName",
  "sourceProduct", "sourcePrice", "lossRate", "sourceWeight", "unitPrice", "sourceProductTotal",
  "boxCost", "materialCost", "outerBoxCost", "wrappingCost", "laborCost", "shippingCost", "totalCost",
  "startMarginRate", "startMargin", "startPrice", "drivingMarginRate", "drivingMargin", "drivingPrice",
  "topMarginRate", "topMargin", "topPrice", "mappingStatus", "save"
] as const;

const MIN_COLUMN_WIDTHS: Record<string, number> = {
  checkbox: 40, categoryLarge: 50, categoryMedium: 50, categorySmall: 50, weight: 40,
  productCode: 50, productName: 80, sourceProduct: 50, sourcePrice: 50, lossRate: 45,
  sourceWeight: 50, unitPrice: 60, sourceProductTotal: 70, boxCost: 50, materialCost: 50,
  outerBoxCost: 55, wrappingCost: 50, laborCost: 50, shippingCost: 50, totalCost: 60,
  startMarginRate: 50, startMargin: 55, startPrice: 60, drivingMarginRate: 50, drivingMargin: 55,
  drivingPrice: 60, topMarginRate: 50, topMargin: 55, topPrice: 60, mappingStatus: 75, save: 45
};

const HEADER_LABELS: Record<string, string> = {
  checkbox: "", categoryLarge: "대분류", categoryMedium: "중분류", categorySmall: "소분류", weight: "중량",
  productCode: "코드", productName: "상품명", sourceProduct: "원상품", sourcePrice: "기준가", lossRate: "로스율%",
  sourceWeight: "기준중량", unitPrice: "개별단가", sourceProductTotal: "원상품합계", boxCost: "박스비", materialCost: "자재비",
  outerBoxCost: "아웃박스", wrappingCost: "보자기", laborCost: "작업비", shippingCost: "택배비", totalCost: "총원가",
  startMarginRate: "S마진율", startMargin: "S마진", startPrice: "S공급가", drivingMarginRate: "D마진율", drivingMargin: "D마진",
  drivingPrice: "D공급가", topMarginRate: "T마진율", topMargin: "T마진", topPrice: "T공급가", mappingStatus: "매핑", save: "저장"
};

const calculateColumnWidth = (key: string, data: ProductRow[]): number => {
  const headerLen = (HEADER_LABELS[key] || "").length;
  let maxDataLen = 0;
  
  for (const row of data) {
    let value = "";
    switch (key) {
      case "categoryLarge": value = row.categoryLarge || ""; break;
      case "categoryMedium": value = row.categoryMedium || ""; break;
      case "categorySmall": value = row.categorySmall || ""; break;
      case "weight": value = String(row.weight || ""); break;
      case "productCode": value = row.productCode || ""; break;
      case "productName": value = row.productName || ""; break;
      case "sourceProduct": value = row.sourceProduct || ""; break;
      case "sourcePrice": value = row.sourcePrice != null ? row.sourcePrice.toLocaleString() : ""; break;
      case "lossRate": value = String(row.lossRate || ""); break;
      case "sourceWeight": value = row.sourceWeight != null ? String(row.sourceWeight) : ""; break;
      case "unitPrice": value = row.unitPrice != null ? row.unitPrice.toLocaleString() : ""; break;
      case "sourceProductTotal": value = row.sourceProductTotal != null ? row.sourceProductTotal.toLocaleString() : ""; break;
      case "boxCost": value = String(row.boxCost || ""); break;
      case "materialCost": value = String(row.materialCost || ""); break;
      case "outerBoxCost": value = String(row.outerBoxCost || ""); break;
      case "wrappingCost": value = String(row.wrappingCost || ""); break;
      case "laborCost": value = String(row.laborCost || ""); break;
      case "shippingCost": value = String(row.shippingCost || ""); break;
      case "totalCost": value = row.totalCost != null ? row.totalCost.toLocaleString() : ""; break;
      case "startMarginRate": value = row.startMarginRate != null ? String(row.startMarginRate) : ""; break;
      case "startMargin": value = row.startMargin != null ? row.startMargin.toLocaleString() : ""; break;
      case "startPrice": value = row.startPrice != null ? row.startPrice.toLocaleString() : ""; break;
      case "drivingMarginRate": value = row.drivingMarginRate != null ? String(row.drivingMarginRate) : ""; break;
      case "drivingMargin": value = row.drivingMargin != null ? row.drivingMargin.toLocaleString() : ""; break;
      case "drivingPrice": value = row.drivingPrice != null ? row.drivingPrice.toLocaleString() : ""; break;
      case "topMarginRate": value = row.topMarginRate != null ? String(row.topMarginRate) : ""; break;
      case "topMargin": value = row.topMargin != null ? row.topMargin.toLocaleString() : ""; break;
      case "topPrice": value = row.topPrice != null ? row.topPrice.toLocaleString() : ""; break;
    }
    if (value.length > maxDataLen) maxDataLen = value.length;
  }
  
  const maxLen = Math.max(headerLen, maxDataLen);
  const charWidth = 8;
  const padding = 16;
  const calculatedWidth = maxLen * charWidth + padding;
  
  return Math.max(MIN_COLUMN_WIDTHS[key] || 50, calculatedWidth);
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

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({ ...MIN_COLUMN_WIDTHS });
  const [manuallyResizedColumns, setManuallyResizedColumns] = useState<Set<string>>(new Set());
  const [resizing, setResizing] = useState<{ key: string; startX: number; startWidth: number } | null>(null);

  // Auto-save state
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  // Send to next week state
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [newProductsList, setNewProductsList] = useState<{ productCode: string; productName: string }[]>([]);
  const [isSending, setIsSending] = useState(false);
  
  // Send confirmation dialog state
  const [sendConfirmDialogOpen, setSendConfirmDialogOpen] = useState(false);
  const [sendMode, setSendMode] = useState<"all" | "selected">("all");
  const [productsToSend, setProductsToSend] = useState<ProductRow[]>([]);
  
  // Mapping check dialog state
  const [mappingCheckDialogOpen, setMappingCheckDialogOpen] = useState(false);
  const [unmappedProducts, setUnmappedProducts] = useState<{ productCode: string; productName: string; categoryLarge?: string | null; categoryMedium?: string | null; categorySmall?: string | null }[]>([]);
  const [isCheckingMapping, setIsCheckingMapping] = useState(false);
  
  const [location, setLocation] = useLocation();
  const [urlParamsProcessed, setUrlParamsProcessed] = useState(false);

  useEffect(() => {
    if (products.length === 0) return;
    
    const newWidths: Record<string, number> = { ...columnWidths };
    let changed = false;
    
    for (const key of COLUMN_KEYS) {
      if (manuallyResizedColumns.has(key)) continue;
      
      const calculatedWidth = calculateColumnWidth(key, products);
      if (calculatedWidth !== newWidths[key]) {
        newWidths[key] = calculatedWidth;
        changed = true;
      }
    }
    
    if (changed) {
      setColumnWidths(newWidths);
    }
  }, [products, manuallyResizedColumns]);

  // Handle URL params for new product from mapping page
  useEffect(() => {
    if (urlParamsProcessed) return;
    
    const urlParams = new URLSearchParams(window.location.search);
    const newProductCode = urlParams.get("newProductCode");
    
    if (newProductCode) {
      // Check if this product code already exists in the list
      const existsInList = products.some(p => p.productCode === newProductCode) || 
                          tempProducts.some(p => p.productCode === newProductCode);
      
      if (!existsInList) {
        const newRow: ProductRow = {
          id: `new-${Date.now()}`,
          status: "active",
          categoryLarge: null,
          categoryMedium: null,
          categorySmall: null,
          weight: "",
          productCode: newProductCode,
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
          mappingStatus: "incomplete",
          suspendedAt: null,
          suspendReason: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          isNew: true,
        };
        setProducts(prev => [newRow, ...prev]);
        setTempProducts(prev => [newRow, ...prev]);
        toast({ 
          title: "신규 상품 추가됨", 
          description: `상품코드 "${newProductCode}"가 등록 목록에 추가되었습니다.` 
        });
      }
      
      // Clear URL params after processing
      window.history.replaceState({}, "", window.location.pathname);
      setUrlParamsProcessed(true);
    }
  }, [urlParamsProcessed, products, tempProducts, toast]);

  // Count missing prices for a product
  const countMissingPrices = (p: ProductRow): number => {
    let count = 0;
    if (p.startPrice == null || p.startPrice === 0) count++;
    if (p.drivingPrice == null || p.drivingPrice === 0) count++;
    if (p.topPrice == null || p.topPrice === 0) count++;
    return count;
  };

  // Get missing price labels for a product
  const getMissingPriceLabels = (p: ProductRow): string[] => {
    const missing: string[] = [];
    if (p.startPrice == null || p.startPrice === 0) missing.push("S공급가");
    if (p.drivingPrice == null || p.drivingPrice === 0) missing.push("D공급가");
    if (p.topPrice == null || p.topPrice === 0) missing.push("T공급가");
    return missing;
  };

  // Sort products: more missing prices first (3 → 2 → 1 → 0)
  const sortProductsByPriceCompletion = (data: ProductRow[]): ProductRow[] => {
    return [...data].sort((a, b) => {
      // New items always first
      if (a.isNew && !b.isNew) return -1;
      if (!a.isNew && b.isNew) return 1;
      
      // Sort by number of missing prices (more missing = higher priority)
      const aMissing = countMissingPrices(a);
      const bMissing = countMissingPrices(b);
      
      return bMissing - aMissing; // Descending: 3 missing first, then 2, then 1, then 0
    });
  };

  const handleResizeStart = useCallback((e: React.MouseEvent, key: string) => {
    e.preventDefault();
    e.stopPropagation();
    setResizing({
      key,
      startX: e.clientX,
      startWidth: columnWidths[key] || MIN_COLUMN_WIDTHS[key] || 80
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
      setManuallyResizedColumns(prev => new Set(Array.from(prev).concat(resizing.key)));
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

  // Helper functions for cascading category selection in table cells (by name)
  const getMediumCategoriesByLargeName = (largeName: string | null) => {
    if (!largeName) return [];
    const largeCat = largeCategories.find(c => c.name === largeName);
    if (!largeCat) return [];
    return mediumCategories.filter(m => m.parentId === largeCat.id);
  };

  const getSmallCategoriesByMediumName = (largeName: string | null, mediumName: string | null) => {
    if (!largeName || !mediumName) return [];
    const largeCat = largeCategories.find(c => c.name === largeName);
    if (!largeCat) return [];
    const mediumCat = mediumCategories.find(m => m.parentId === largeCat.id && m.name === mediumName);
    if (!mediumCat) return [];
    return smallCategories.filter(s => s.parentId === mediumCat.id);
  };

  // Handle category change with cascading clear
  const handleCategoryChange = (idx: number, field: "categoryLarge" | "categoryMedium" | "categorySmall", value: string) => {
    const updated = [...products];
    const p = { ...updated[idx] };
    
    if (field === "categoryLarge") {
      p.categoryLarge = value || null;
      p.categoryMedium = null; // Clear dependent categories
      p.categorySmall = null;
    } else if (field === "categoryMedium") {
      p.categoryMedium = value || null;
      p.categorySmall = null; // Clear dependent category
    } else {
      p.categorySmall = value || null;
    }
    
    updated[idx] = p;
    setProducts(updated);
    
    if (p.id.startsWith("new-")) {
      setTempProducts(prev => prev.map(t => t.id === p.id ? { ...p } : t));
    }
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
      const sorted = sortProductsByPriceCompletion(filtered);
      setProducts(sorted);
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
        const errorDetails = data.errors.slice(0, 5).map((e: any) => 
          `행 ${e.row}: ${e.error || e.message || '알 수 없는 오류'}`
        ).join('\n');
        const moreText = data.errors.length > 5 ? `\n... 외 ${data.errors.length - 5}건 더 있음` : '';
        toast({ 
          variant: "destructive", 
          title: `일부 오류 (${data.errors.length}건)`, 
          description: errorDetails + moreText,
          duration: 10000,
        });
      }
      searchMutation.mutate();
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "업로드 실패", description: error.message });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PUT", `/api/product-registrations/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/product-registrations"] });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "저장 실패", description: error.message });
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
      const recalculateRow = (p: ProductRow): ProductRow => {
        const merged = { ...p, ...data };
        
        // Recalculate derived values
        const sourcePrice = merged.sourcePrice || 0;
        const lossRate = merged.lossRate || 0;
        const sourceWeight = merged.sourceWeight || 1;
        const weight = parseFloat(merged.weight) || 0;
        const unitPrice = sourceWeight > 0 ? Math.round((sourcePrice * (1 + lossRate / 100)) / sourceWeight) : 0;
        const sourceProductTotal = Math.round(weight * unitPrice);
        
        const totalCost = sourceProductTotal + (merged.boxCost || 0) + (merged.materialCost || 0) + (merged.outerBoxCost || 0) + (merged.wrappingCost || 0) + (merged.laborCost || 0) + (merged.shippingCost || 0);
        
        merged.unitPrice = unitPrice;
        merged.sourceProductTotal = sourceProductTotal;
        merged.totalCost = totalCost;
        
        if (merged.startMarginRate != null) {
          merged.startPrice = Math.round(totalCost * (1 + merged.startMarginRate / 100));
          merged.startMargin = merged.startPrice - totalCost;
        }
        if (merged.drivingMarginRate != null) {
          merged.drivingPrice = Math.round(totalCost * (1 + merged.drivingMarginRate / 100));
          merged.drivingMargin = merged.drivingPrice - totalCost;
        }
        if (merged.topMarginRate != null) {
          merged.topPrice = Math.round(totalCost * (1 + merged.topMarginRate / 100));
          merged.topMargin = merged.topPrice - totalCost;
        }
        
        return merged;
      };
      
      setProducts(prev => prev.map(p => {
        if (newRowIds.includes(p.id)) {
          return recalculateRow(p);
        }
        return p;
      }));
      
      // Also update tempProducts to stay in sync
      setTempProducts(prev => prev.map(p => {
        if (newRowIds.includes(p.id)) {
          return recalculateRow(p);
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
      mappingStatus: "incomplete",
      createdAt: new Date(),
      updatedAt: new Date(),
      isNew: true,
    };
    setProducts([newRow, ...products]);
    setTempProducts(prev => [newRow, ...prev]);
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

  // Auto-save mutation for existing products
  const autoSaveMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }): Promise<ProductRegistration> => {
      const res = await apiRequest("PUT", `/api/product-registrations/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      setSaveStatus("saved");
      setLastSavedAt(new Date());
      setTimeout(() => {
        if (saveStatus === "saved") setSaveStatus("idle");
      }, 3000);
    },
    onError: (error: any) => {
      setSaveStatus("error");
      console.error("Auto-save error:", error);
    },
  });

  // Debounced auto-save function
  const debouncedAutoSave = useMemo(
    () => debounce((id: string, productData: ProductRow) => {
      if (id.startsWith("new-")) return; // Don't auto-save new rows
      
      setSaveStatus("saving");
      autoSaveMutation.mutate({
        id,
        data: {
          categoryLarge: productData.categoryLarge,
          categoryMedium: productData.categoryMedium,
          categorySmall: productData.categorySmall,
          weight: productData.weight,
          productCode: productData.productCode,
          productName: productData.productName,
          sourceProduct: productData.sourceProduct,
          sourcePrice: productData.sourcePrice,
          lossRate: productData.lossRate,
          sourceWeight: productData.sourceWeight,
          boxCost: productData.boxCost,
          materialCost: productData.materialCost,
          outerBoxCost: productData.outerBoxCost,
          wrappingCost: productData.wrappingCost,
          laborCost: productData.laborCost,
          shippingCost: productData.shippingCost,
          startMarginRate: productData.startMarginRate,
          drivingMarginRate: productData.drivingMarginRate,
          topMarginRate: productData.topMarginRate,
        }
      });
    }, 500),
    []
  );

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
    } else {
      // Auto-save for existing products (debounced 500ms)
      debouncedAutoSave(p.id, p);
    }
  };

  // Navigate to product mapping page with product code
  const handleGoToMapping = (productCode: string, mode: "view" | "edit") => {
    const returnTo = "/admin/products/registration";
    setLocation(`/admin/inventory/mapping?productCode=${encodeURIComponent(productCode)}&mode=${mode}&returnTo=${encodeURIComponent(returnTo)}`);
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
    
    // Check for duplicate product code in current list (excluding self)
    const duplicateInList = products.find((other, otherIdx) => 
      otherIdx !== index && other.productCode === p.productCode
    );
    if (duplicateInList) {
      toast({ 
        variant: "destructive", 
        title: "상품코드 중복", 
        description: `상품코드 "${p.productCode}"가 현재 목록에 이미 존재합니다. 다른 상품코드를 입력해주세요.` 
      });
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
        // Error handled in mutation onError
      }
    } else {
      try {
        await updateMutation.mutateAsync({ id: p.id, data: p });
        toast({ title: "저장 완료", description: "상품이 수정되었습니다" });
      } catch (err) {
        // Error handled in mutation onError
      }
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

  // Open confirmation dialog for sending to next week
  const openSendConfirmDialog = async (mode: "all" | "selected") => {
    const targetProducts = mode === "all" ? products : products.filter(p => selectedIds.includes(p.id));
    
    if (targetProducts.length === 0) {
      toast({
        variant: "destructive",
        title: "전송 불가",
        description: mode === "all" ? "전송할 상품이 없습니다." : "선택된 상품이 없습니다.",
      });
      return;
    }

    // Check if there are unsaved new products
    const newProducts = targetProducts.filter(p => p.id.startsWith("new-"));
    if (newProducts.length > 0) {
      toast({
        variant: "destructive",
        title: "전송 불가",
        description: `${newProducts.length}개의 신규 상품이 저장되지 않았습니다. 먼저 저장해주세요.`,
      });
      return;
    }

    // Check if products have at least 1 valid price (block only if all 3 are missing)
    const completelyInvalidProducts = targetProducts.filter(p => countMissingPrices(p) === 3);
    
    if (completelyInvalidProducts.length > 0) {
      // Block: products with NO prices at all
      const errorDetails = completelyInvalidProducts.slice(0, 5).map(p => {
        return `• ${p.productCode || "(코드없음)"}: S/D/T 공급가 모두 누락`;
      }).join("\n");
      
      const moreText = completelyInvalidProducts.length > 5 
        ? `\n... 외 ${completelyInvalidProducts.length - 5}건 더 있음` 
        : "";
      
      toast({
        variant: "destructive",
        title: "전송 불가 - 공급가 없음",
        description: `${completelyInvalidProducts.length}개의 상품에 공급가가 전혀 없습니다.\n\n${errorDetails}${moreText}\n\n최소 1개 이상의 공급가(S/D/T)가 입력되어야 전송 가능합니다.`,
        duration: 10000,
      });
      return;
    }

    // Warn about partially missing prices (but allow sending)
    const partiallyInvalidProducts = targetProducts.filter(p => {
      const missing = countMissingPrices(p);
      return missing > 0 && missing < 3;
    });
    
    if (partiallyInvalidProducts.length > 0) {
      const warningDetails = partiallyInvalidProducts.slice(0, 5).map(p => {
        const missingLabels = getMissingPriceLabels(p);
        return `• ${p.productCode || "(코드없음)"}: ${missingLabels.join(", ")} 누락`;
      }).join("\n");
      
      const moreText = partiallyInvalidProducts.length > 5 
        ? `\n... 외 ${partiallyInvalidProducts.length - 5}건 더 있음` 
        : "";
      
      toast({
        title: "공급가 일부 누락 안내",
        description: `${partiallyInvalidProducts.length}개의 상품에 일부 공급가가 누락되었습니다.\n\n${warningDetails}${moreText}`,
        duration: 8000,
      });
      // Continue with sending (don't return)
    }

    // Check mapping status before sending
    setIsCheckingMapping(true);
    try {
      const productCodes = targetProducts.map(p => p.productCode).filter(Boolean);
      const res = await apiRequest("POST", "/api/product-registrations/check-mapping", { productCodes });
      const result = await res.json();
      
      if (!result.allMapped && result.unmappedProducts.length > 0) {
        // Show unmapped products dialog
        setUnmappedProducts(result.unmappedProducts);
        setSendMode(mode);
        setProductsToSend(targetProducts);
        setMappingCheckDialogOpen(true);
        setIsCheckingMapping(false);
        return;
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "매핑 확인 오류",
        description: "상품 매핑 상태를 확인하는 중 오류가 발생했습니다.",
      });
      setIsCheckingMapping(false);
      return;
    }
    setIsCheckingMapping(false);

    // Set the mode and products to send, then open confirmation dialog
    setSendMode(mode);
    setProductsToSend(targetProducts);
    setSendConfirmDialogOpen(true);
  };

  // Actually send to next week products (after confirmation)
  const handleConfirmSend = async () => {
    setSendConfirmDialogOpen(false);
    setIsSending(true);
    
    try {
      const res = await apiRequest("POST", "/api/product-registrations/send-to-next-week", {
        ids: productsToSend.map(p => p.id),
      });
      const result = await res.json();
      
      toast({
        title: "전송 완료",
        description: `${result.count}개의 상품이 차주 예상공급가로 전송되었습니다.`,
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/next-week-products"] });

      if (result.newProducts && result.newProducts.length > 0) {
        setNewProductsList(result.newProducts);
        setSendDialogOpen(true);
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "전송 실패",
        description: error.message || "전송 중 오류가 발생했습니다.",
      });
    } finally {
      setIsSending(false);
      setProductsToSend([]);
    }
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
          <table className="text-xs border-collapse" style={{ tableLayout: 'fixed', minWidth: Object.values(columnWidths).reduce((sum, w) => sum + w, 0) }}>
            <thead className="sticky top-0 z-20">
              <tr>
                <th className="px-2 py-2 text-center sticky left-0 z-30 bg-muted/80 border-r-2 border-gray-300 dark:border-gray-600" style={{ width: columnWidths.checkbox }}>
                  <Checkbox checked={selectedIds.length === products.length && products.length > 0} onCheckedChange={toggleSelectAll} data-testid="checkbox-select-all" />
                </th>
                {[
                  { key: "categoryLarge", label: "대분류", align: "left", bgColor: "" },
                  { key: "categoryMedium", label: "중분류", align: "left", bgColor: "" },
                  { key: "categorySmall", label: "소분류", align: "left", bgColor: "" },
                  { key: "weight", label: "중량", align: "center", bgColor: "" },
                  { key: "productCode", label: "코드", align: "left", bgColor: "" },
                  { key: "productName", label: "상품명", align: "left", bgColor: "" },
                  { key: "sourceProduct", label: "원상품", align: "left", bgColor: "" },
                  { key: "sourcePrice", label: "기준가", align: "right", bgColor: "" },
                  { key: "lossRate", label: "로스율%", align: "right", bgColor: "" },
                  { key: "sourceWeight", label: "기준중량", align: "right", bgColor: "" },
                  { key: "unitPrice", label: "개별단가", align: "right", bgColor: "#fef9c3" },
                  { key: "sourceProductTotal", label: "원상품합계", align: "right", bgColor: "#fef9c3" },
                  { key: "boxCost", label: "박스비", align: "right", bgColor: "" },
                  { key: "materialCost", label: "자재비", align: "right", bgColor: "" },
                  { key: "outerBoxCost", label: "아웃박스", align: "right", bgColor: "" },
                  { key: "wrappingCost", label: "보자기", align: "right", bgColor: "" },
                  { key: "laborCost", label: "작업비", align: "right", bgColor: "" },
                  { key: "shippingCost", label: "택배비", align: "right", bgColor: "" },
                  { key: "totalCost", label: "총원가", align: "right", bgColor: "#fef9c3" },
                  { key: "startMarginRate", label: "S마진율", align: "right", bgColor: "#dbeafe" },
                  { key: "startMargin", label: "S마진", align: "right", bgColor: "#dbeafe" },
                  { key: "startPrice", label: "S공급가", align: "right", bgColor: "#dbeafe", bold: true },
                  { key: "drivingMarginRate", label: "D마진율", align: "right", bgColor: "#dcfce7" },
                  { key: "drivingMargin", label: "D마진", align: "right", bgColor: "#dcfce7" },
                  { key: "drivingPrice", label: "D공급가", align: "right", bgColor: "#dcfce7", bold: true },
                  { key: "topMarginRate", label: "T마진율", align: "right", bgColor: "#fee2e2" },
                  { key: "topMargin", label: "T마진", align: "right", bgColor: "#fee2e2" },
                  { key: "topPrice", label: "T공급가", align: "right", bgColor: "#fee2e2", bold: true },
                  { key: "mappingStatus", label: "매핑", align: "center", bgColor: "" },
                  { key: "save", label: "저장", align: "center", bgColor: "" },
                ].map((col) => (
                  <th 
                    key={col.key}
                    className={`relative px-2 py-2 whitespace-nowrap border border-gray-300 dark:border-gray-600 bg-muted/80 ${col.bold ? "font-bold" : ""} text-${col.align}`}
                    style={{ width: columnWidths[col.key] || MIN_COLUMN_WIDTHS[col.key], backgroundColor: col.bgColor || undefined }}
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
                  <td className={`px-0 py-0 border border-gray-300 dark:border-gray-600 overflow-visible ${getCellClass(p.categoryLarge, false)}`} style={{ width: columnWidths.categoryLarge }}>
                    <select 
                      value={p.categoryLarge || ""} 
                      onChange={e => handleCategoryChange(idx, "categoryLarge", e.target.value)}
                      className="w-full h-6 px-0.5 border-none bg-transparent outline-none text-xs focus:ring-2 focus:ring-inset focus:ring-blue-500 cursor-pointer"
                      data-testid={`select-category-large-${idx}`}
                    >
                      <option value="">선택</option>
                      {largeCategories.map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className={`px-0 py-0 border border-gray-300 dark:border-gray-600 overflow-visible ${getCellClass(p.categoryMedium, false)}`} style={{ width: columnWidths.categoryMedium }}>
                    <select 
                      value={p.categoryMedium || ""} 
                      onChange={e => handleCategoryChange(idx, "categoryMedium", e.target.value)}
                      className="w-full h-6 px-0.5 border-none bg-transparent outline-none text-xs focus:ring-2 focus:ring-inset focus:ring-blue-500 cursor-pointer disabled:opacity-50"
                      disabled={!p.categoryLarge}
                      data-testid={`select-category-medium-${idx}`}
                    >
                      <option value="">선택</option>
                      {getMediumCategoriesByLargeName(p.categoryLarge).map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className={`px-0 py-0 border border-gray-300 dark:border-gray-600 overflow-visible ${getCellClass(p.categorySmall, false)}`} style={{ width: columnWidths.categorySmall }}>
                    <select 
                      value={p.categorySmall || ""} 
                      onChange={e => handleCategoryChange(idx, "categorySmall", e.target.value)}
                      className="w-full h-6 px-0.5 border-none bg-transparent outline-none text-xs focus:ring-2 focus:ring-inset focus:ring-blue-500 cursor-pointer disabled:opacity-50"
                      disabled={!p.categoryMedium}
                      data-testid={`select-category-small-${idx}`}
                    >
                      <option value="">선택</option>
                      {getSmallCategoriesByMediumName(p.categoryLarge, p.categoryMedium).map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className={`px-1 py-0.5 border border-gray-300 dark:border-gray-600 overflow-hidden ${getCellClass(p.weight, false)}`} style={{ width: columnWidths.weight }}>
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
                  <td className={`px-1 py-0.5 border border-gray-300 dark:border-gray-600 overflow-hidden ${getCellClass(p.productCode, false)}`} style={{ width: columnWidths.productCode }}>
                    <input value={p.productCode} onChange={e => handleCellChange(idx, "productCode", e.target.value)} className="w-full px-1 py-0.5 border-none bg-transparent outline-none text-xs focus:ring-2 focus:ring-inset focus:ring-blue-500" />
                  </td>
                  <td className={`px-1 py-0.5 border border-gray-300 dark:border-gray-600 overflow-hidden ${getCellClass(p.productName, false)}`} style={{ width: columnWidths.productName }}>
                    <input value={p.productName} onChange={e => handleCellChange(idx, "productName", e.target.value)} className="w-full px-1 py-0.5 border-none bg-transparent outline-none text-xs focus:ring-2 focus:ring-inset focus:ring-blue-500" />
                  </td>
                  <td className="px-1 py-0.5 border border-gray-300 dark:border-gray-600 overflow-hidden" style={{ width: columnWidths.sourceProduct }}>
                    <input value={p.sourceProduct || ""} onChange={e => handleCellChange(idx, "sourceProduct", e.target.value)} className="w-full px-1 py-0.5 border-none bg-transparent outline-none text-xs focus:ring-2 focus:ring-inset focus:ring-blue-500" />
                  </td>
                  <td className={`px-1 py-0.5 border border-gray-300 dark:border-gray-600 overflow-hidden ${getCellClass(p.sourcePrice, false)}`} style={{ width: columnWidths.sourcePrice }}>
                    <input value={p.sourcePrice ?? ""} onChange={e => handleCellChange(idx, "sourcePrice", e.target.value ? parseInt(e.target.value) : null)} className="w-full px-1 py-0.5 border-none bg-transparent outline-none text-xs text-right focus:ring-2 focus:ring-inset focus:ring-blue-500" type="number" />
                  </td>
                  <td className="px-1 py-0.5 border border-gray-300 dark:border-gray-600 overflow-hidden" style={{ width: columnWidths.lossRate }}>
                    <input value={p.lossRate} onChange={e => handleCellChange(idx, "lossRate", parseInt(e.target.value) || 0)} className="w-full px-1 py-0.5 border-none bg-transparent outline-none text-xs text-right focus:ring-2 focus:ring-inset focus:ring-blue-500" type="number" />
                  </td>
                  <td className={`px-1 py-0.5 border border-gray-300 dark:border-gray-600 overflow-hidden ${getCellClass(p.sourceWeight, false)}`} style={{ width: columnWidths.sourceWeight }}>
                    <input value={p.sourceWeight ?? ""} onChange={e => handleCellChange(idx, "sourceWeight", e.target.value ? parseInt(e.target.value) : null)} className="w-full px-1 py-0.5 border-none bg-transparent outline-none text-xs text-right focus:ring-2 focus:ring-inset focus:ring-blue-500" type="number" />
                  </td>
                  <td className="px-2 py-1 border border-gray-300 dark:border-gray-600 bg-yellow-100 dark:bg-yellow-900/30 text-right overflow-hidden text-ellipsis" style={{ width: columnWidths.unitPrice }}>{formatNumber(p.unitPrice)}</td>
                  <td className="px-2 py-1 border border-gray-300 dark:border-gray-600 bg-yellow-100 dark:bg-yellow-900/30 text-right overflow-hidden text-ellipsis" style={{ width: columnWidths.sourceProductTotal }}>{formatNumber(p.sourceProductTotal)}</td>
                  <td className="px-1 py-0.5 border border-gray-300 dark:border-gray-600 overflow-hidden" style={{ width: columnWidths.boxCost }}>
                    <input value={p.boxCost} onChange={e => handleCellChange(idx, "boxCost", parseInt(e.target.value) || 0)} className="w-full px-1 py-0.5 border-none bg-transparent outline-none text-xs text-right focus:ring-2 focus:ring-inset focus:ring-blue-500" type="number" />
                  </td>
                  <td className="px-1 py-0.5 border border-gray-300 dark:border-gray-600 overflow-hidden" style={{ width: columnWidths.materialCost }}>
                    <input value={p.materialCost} onChange={e => handleCellChange(idx, "materialCost", parseInt(e.target.value) || 0)} className="w-full px-1 py-0.5 border-none bg-transparent outline-none text-xs text-right focus:ring-2 focus:ring-inset focus:ring-blue-500" type="number" />
                  </td>
                  <td className="px-1 py-0.5 border border-gray-300 dark:border-gray-600 overflow-hidden" style={{ width: columnWidths.outerBoxCost }}>
                    <input value={p.outerBoxCost} onChange={e => handleCellChange(idx, "outerBoxCost", parseInt(e.target.value) || 0)} className="w-full px-1 py-0.5 border-none bg-transparent outline-none text-xs text-right focus:ring-2 focus:ring-inset focus:ring-blue-500" type="number" />
                  </td>
                  <td className="px-1 py-0.5 border border-gray-300 dark:border-gray-600 overflow-hidden" style={{ width: columnWidths.wrappingCost }}>
                    <input value={p.wrappingCost} onChange={e => handleCellChange(idx, "wrappingCost", parseInt(e.target.value) || 0)} className="w-full px-1 py-0.5 border-none bg-transparent outline-none text-xs text-right focus:ring-2 focus:ring-inset focus:ring-blue-500" type="number" />
                  </td>
                  <td className="px-1 py-0.5 border border-gray-300 dark:border-gray-600 overflow-hidden" style={{ width: columnWidths.laborCost }}>
                    <input value={p.laborCost} onChange={e => handleCellChange(idx, "laborCost", parseInt(e.target.value) || 0)} className="w-full px-1 py-0.5 border-none bg-transparent outline-none text-xs text-right focus:ring-2 focus:ring-inset focus:ring-blue-500" type="number" />
                  </td>
                  <td className="px-1 py-0.5 border border-gray-300 dark:border-gray-600 overflow-hidden" style={{ width: columnWidths.shippingCost }}>
                    <input value={p.shippingCost} onChange={e => handleCellChange(idx, "shippingCost", parseInt(e.target.value) || 0)} className="w-full px-1 py-0.5 border-none bg-transparent outline-none text-xs text-right focus:ring-2 focus:ring-inset focus:ring-blue-500" type="number" />
                  </td>
                  <td className="px-2 py-1 border border-gray-300 dark:border-gray-600 bg-yellow-100 dark:bg-yellow-900/30 text-right overflow-hidden text-ellipsis" style={{ width: columnWidths.totalCost }}>{formatNumber(p.totalCost)}</td>
                  <td className={`px-1 py-0.5 border border-gray-300 dark:border-gray-600 overflow-hidden ${getCellClass(p.startMarginRate, false)}`} style={{ width: columnWidths.startMarginRate, backgroundColor: "#dbeafe" }}>
                    <input value={p.startMarginRate ?? ""} onChange={e => handleCellChange(idx, "startMarginRate", e.target.value ? parseFloat(e.target.value) : null)} className="w-full px-1 py-0.5 border-none bg-transparent outline-none text-xs text-right focus:ring-2 focus:ring-inset focus:ring-blue-500" type="number" step="0.1" />
                  </td>
                  <td className="px-2 py-1 border border-gray-300 dark:border-gray-600 text-right overflow-hidden text-ellipsis" style={{ width: columnWidths.startMargin, backgroundColor: "#dbeafe" }}>{formatNumber(p.startMargin)}</td>
                  <td className="px-2 py-1 border border-gray-300 dark:border-gray-600 text-right font-bold overflow-hidden text-ellipsis" style={{ width: columnWidths.startPrice, backgroundColor: "#dbeafe" }}>{formatNumber(p.startPrice)}</td>
                  <td className={`px-1 py-0.5 border border-gray-300 dark:border-gray-600 overflow-hidden ${getCellClass(p.drivingMarginRate, false)}`} style={{ width: columnWidths.drivingMarginRate, backgroundColor: "#dcfce7" }}>
                    <input value={p.drivingMarginRate ?? ""} onChange={e => handleCellChange(idx, "drivingMarginRate", e.target.value ? parseFloat(e.target.value) : null)} className="w-full px-1 py-0.5 border-none bg-transparent outline-none text-xs text-right focus:ring-2 focus:ring-inset focus:ring-blue-500" type="number" step="0.1" />
                  </td>
                  <td className="px-2 py-1 border border-gray-300 dark:border-gray-600 text-right overflow-hidden text-ellipsis" style={{ width: columnWidths.drivingMargin, backgroundColor: "#dcfce7" }}>{formatNumber(p.drivingMargin)}</td>
                  <td className="px-2 py-1 border border-gray-300 dark:border-gray-600 text-right font-bold overflow-hidden text-ellipsis" style={{ width: columnWidths.drivingPrice, backgroundColor: "#dcfce7" }}>{formatNumber(p.drivingPrice)}</td>
                  <td className={`px-1 py-0.5 border border-gray-300 dark:border-gray-600 overflow-hidden ${getCellClass(p.topMarginRate, false)}`} style={{ width: columnWidths.topMarginRate, backgroundColor: "#fee2e2" }}>
                    <input value={p.topMarginRate ?? ""} onChange={e => handleCellChange(idx, "topMarginRate", e.target.value ? parseFloat(e.target.value) : null)} className="w-full px-1 py-0.5 border-none bg-transparent outline-none text-xs text-right focus:ring-2 focus:ring-inset focus:ring-blue-500" type="number" step="0.1" />
                  </td>
                  <td className="px-2 py-1 border border-gray-300 dark:border-gray-600 text-right overflow-hidden text-ellipsis" style={{ width: columnWidths.topMargin, backgroundColor: "#fee2e2" }}>{formatNumber(p.topMargin)}</td>
                  <td className="px-2 py-1 border border-gray-300 dark:border-gray-600 text-right font-bold overflow-hidden text-ellipsis" style={{ width: columnWidths.topPrice, backgroundColor: "#fee2e2" }}>{formatNumber(p.topPrice)}</td>
                  <td className="px-1 py-0.5 border border-gray-300 dark:border-gray-600 text-center overflow-hidden" style={{ width: columnWidths.mappingStatus }}>
                    {p.isNew ? (
                      <span className="text-xs text-muted-foreground">-</span>
                    ) : p.mappingStatus === "complete" ? (
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => handleGoToMapping(p.productCode, "view")} 
                        className="h-6 px-1.5 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        data-testid={`button-mapping-view-${p.id}`}
                      >
                        매핑완료
                      </Button>
                    ) : (
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => handleGoToMapping(p.productCode, "edit")} 
                        className="h-6 px-1.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                        data-testid={`button-mapping-edit-${p.id}`}
                      >
                        미매핑
                      </Button>
                    )}
                  </td>
                  <td className="px-1 py-0.5 border border-gray-300 dark:border-gray-600 text-center overflow-hidden" style={{ width: columnWidths.save }}>
                    <Button size="sm" variant={p.isNew ? "default" : "ghost"} onClick={() => handleSaveRow(idx)} disabled={createMutation.isPending || updateMutation.isPending} className="h-6 w-6 p-0" data-testid={`button-save-${p.id}`}>
                      <Save className="h-3 w-3" />
                    </Button>
                  </td>
                </tr>
              );})}
              {products.length === 0 && (
                <tr>
                  <td colSpan={30} className="text-center py-8 text-muted-foreground">
                    상품을 검색하거나 엑셀을 업로드하세요
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="flex items-center justify-center gap-4">
        {/* Save Status Indicator */}
        <div className="flex items-center gap-2" data-testid="save-status-indicator">
          {saveStatus === "saving" && (
            <>
              <div className="h-2 w-2 bg-yellow-500 rounded-full animate-pulse" data-testid="status-saving" />
              <span className="text-sm text-muted-foreground">저장 중...</span>
            </>
          )}
          {saveStatus === "saved" && (
            <>
              <CheckCircle className="h-4 w-4 text-green-500" data-testid="status-saved" />
              <span className="text-sm text-green-600">저장됨</span>
              {lastSavedAt && (
                <span className="text-xs text-muted-foreground">
                  ({lastSavedAt.toLocaleTimeString()})
                </span>
              )}
            </>
          )}
          {saveStatus === "error" && (
            <>
              <AlertTriangle className="h-4 w-4 text-red-500" data-testid="status-error" />
              <span className="text-sm text-red-600">저장 실패</span>
            </>
          )}
          {saveStatus === "idle" && (
            <span className="text-sm text-muted-foreground" data-testid="status-idle">자동저장 대기</span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="outline"
            onClick={() => openSendConfirmDialog("selected")} 
            disabled={selectedIds.length === 0 || isSending || isCheckingMapping} 
            data-testid="button-send-selected"
          >
            {(isSending || isCheckingMapping) && sendMode === "selected" ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            선택항목 예상공급가 전송 ({selectedIds.length}개)
          </Button>
          <Button 
            onClick={() => openSendConfirmDialog("all")} 
            disabled={products.length === 0 || isSending || isCheckingMapping} 
            data-testid="button-send-all"
          >
            {(isSending || isCheckingMapping) && sendMode === "all" ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            전체항목 예상공급가 전송 ({products.length}개)
          </Button>
        </div>
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

      {/* Send Confirmation Dialog */}
      <AlertDialog open={sendConfirmDialogOpen} onOpenChange={setSendConfirmDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-blue-500" />
              차주 예상공급가 상품으로 전송
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  {sendMode === "all" 
                    ? `전체 ${productsToSend.length}개 상품을 차주 예상공급가로 전송하시겠습니까?`
                    : `선택한 ${productsToSend.length}개 상품을 차주 예상공급가로 전송하시겠습니까?`
                  }
                </p>
                <div className="bg-muted p-3 rounded-md text-sm">
                  <div className="font-medium mb-2">전송 대상 상품 ({productsToSend.length}개)</div>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {productsToSend.slice(0, 10).map((p, idx) => (
                      <div key={p.id} className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{p.productCode}</span>
                        <span className="truncate ml-2">{p.productName}</span>
                      </div>
                    ))}
                    {productsToSend.length > 10 && (
                      <div className="text-xs text-muted-foreground text-center pt-1">
                        ... 외 {productsToSend.length - 10}개 상품
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  전송된 상품은 "차주 예상공급가 상품" 목록에서 확인할 수 있습니다.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-send">취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSend} data-testid="button-confirm-send">
              <Send className="h-4 w-4 mr-2" />
              전송
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unmapped Products Dialog */}
      <AlertDialog open={mappingCheckDialogOpen} onOpenChange={setMappingCheckDialogOpen}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              상품 매핑 필요
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  다음 {unmappedProducts.length}개 상품이 재고관리에서 매핑되지 않았습니다.
                  상품을 차주 예상공급가로 전송하기 전에 먼저 상품 매핑을 완료해주세요.
                </p>
                <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 p-3 rounded-md text-sm">
                  <div className="font-medium mb-2 text-orange-700 dark:text-orange-300">매핑되지 않은 상품 ({unmappedProducts.length}개)</div>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {unmappedProducts.slice(0, 10).map((p, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
                        <span className="text-xs font-mono">{p.productCode}</span>
                        <span className="text-muted-foreground">-</span>
                        <span className="text-xs truncate">{p.productName}</span>
                      </div>
                    ))}
                    {unmappedProducts.length > 10 && (
                      <div className="text-xs text-muted-foreground pt-1">
                        ... 외 {unmappedProducts.length - 10}개
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  "상품 매핑으로 이동" 버튼을 클릭하여 매핑을 완료한 후 다시 전송해주세요.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-mapping-dialog">취소</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                setMappingCheckDialogOpen(false);
                toast({
                  title: "상품 매핑 페이지로 이동합니다",
                  description: `${unmappedProducts.length}개 상품의 매핑이 필요합니다.`,
                });
                // Pass unmapped products via URL parameter
                const productsParam = encodeURIComponent(JSON.stringify(unmappedProducts));
                setLocation(`/admin/inventory/mapping?unmapped=${productsParam}`);
              }}
              className="bg-orange-500 hover:bg-orange-600"
              data-testid="button-go-to-mapping"
            >
              <Link2 className="h-4 w-4 mr-2" />
              상품 매핑으로 이동
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* New Products Dialog */}
      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              신규 상품 전송 완료
            </DialogTitle>
            <DialogDescription>
              다음 상품들이 처음으로 차주 예상공급가에 추가되었습니다.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-60 overflow-y-auto" data-testid="new-products-list">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2">상품코드</th>
                  <th className="text-left py-2 px-2">상품명</th>
                </tr>
              </thead>
              <tbody>
                {newProductsList.map((p, idx) => (
                  <tr key={idx} className="border-b" data-testid={`new-product-row-${idx}`}>
                    <td className="py-2 px-2 text-muted-foreground" data-testid={`new-product-code-${idx}`}>{p.productCode}</td>
                    <td className="py-2 px-2" data-testid={`new-product-name-${idx}`}>{p.productName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <DialogFooter>
            <Button onClick={() => setSendDialogOpen(false)} data-testid="button-close-new-products">
              확인
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
