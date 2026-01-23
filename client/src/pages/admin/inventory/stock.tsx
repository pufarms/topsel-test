import { useState, useRef, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus, Download, Upload, Loader2, Search, RotateCcw, Package, ArrowUp, ArrowDown, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import type { ProductMapping, Category } from "@shared/schema";
import * as XLSX from "xlsx";

interface ProductMappingWithStock extends ProductMapping {
  currentStock: number;
}

export default function ProductStockPage() {
  const { toast } = useToast();
  const uploadInputRef = useRef<HTMLInputElement>(null);
  
  const [searchCode, setSearchCode] = useState("");
  const [searchName, setSearchName] = useState("");
  const [filterCategoryLarge, setFilterCategoryLarge] = useState("all");
  const [filterCategoryMedium, setFilterCategoryMedium] = useState("all");
  const [filterCategorySmall, setFilterCategorySmall] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  
  const [stockInDialogOpen, setStockInDialogOpen] = useState(false);
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductMappingWithStock | null>(null);
  
  const [stockInQuantity, setStockInQuantity] = useState("");
  const [stockInNote, setStockInNote] = useState("");
  
  const [adjustType, setAdjustType] = useState<"increase" | "decrease">("decrease");
  const [adjustQuantity, setAdjustQuantity] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustNote, setAdjustNote] = useState("");
  
  const [productSearchDialogOpen, setProductSearchDialogOpen] = useState(false);
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [productSearchCategoryLarge, setProductSearchCategoryLarge] = useState("all");
  const [productSearchCategoryMedium, setProductSearchCategoryMedium] = useState("all");
  const [productSearchCategorySmall, setProductSearchCategorySmall] = useState("all");
  const [dialogMode, setDialogMode] = useState<"stockIn" | "adjust">("stockIn");
  
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadResultDialogOpen, setUploadResultDialogOpen] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ successItems: { productCode: string; productName: string; quantity: number }[]; errors: string[] } | null>(null);
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteProductCode, setDeleteProductCode] = useState("");

  const { data: productsWithStock = [], isLoading } = useQuery<ProductMappingWithStock[]>({
    queryKey: ["/api/product-stocks/with-mappings"],
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const stockInMutation = useMutation({
    mutationFn: async (data: { productCode: string; productName: string; quantity: number; note: string }) => {
      return apiRequest("POST", "/api/product-stocks/stock-in", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/product-stocks/with-mappings"] });
      toast({ title: "입고가 완료되었습니다" });
      closeStockInDialog();
    },
    onError: (error: Error) => {
      toast({ title: "입고 실패", description: error.message, variant: "destructive" });
    },
  });

  const adjustMutation = useMutation({
    mutationFn: async (data: { productCode: string; adjustType: string; quantity: number; reason: string; note: string }) => {
      return apiRequest("POST", "/api/product-stocks/adjust", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/product-stocks/with-mappings"] });
      toast({ title: "재고 조정이 완료되었습니다" });
      closeAdjustDialog();
    },
    onError: (error: Error) => {
      toast({ title: "조정 실패", description: error.message, variant: "destructive" });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/product-stocks/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: (data) => {
      setUploadResult(data);
      setUploadDialogOpen(false);
      setUploadResultDialogOpen(true);
    },
    onError: (error: Error) => {
      toast({ title: "업로드 실패", description: error.message, variant: "destructive" });
    },
  });

  const confirmUploadMutation = useMutation({
    mutationFn: async (items: { productCode: string; productName: string; quantity: number }[]) => {
      return apiRequest("POST", "/api/product-stocks/upload/confirm", { items });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/product-stocks/with-mappings"] });
      toast({ title: data.message || "입고 완료" });
      setUploadResultDialogOpen(false);
      setUploadResult(null);
    },
    onError: (error: Error) => {
      toast({ title: "입고 확정 실패", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (productCode: string) => {
      return apiRequest("DELETE", `/api/product-stocks/${productCode}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/product-stocks/with-mappings"] });
      toast({ title: "재고가 삭제되었습니다" });
      setDeleteDialogOpen(false);
      setDeleteProductCode("");
    },
    onError: (error: Error) => {
      toast({ title: "삭제 실패", description: error.message, variant: "destructive" });
    },
  });

  const handleDeleteClick = (productCode: string) => {
    setDeleteProductCode(productCode);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (deleteProductCode) {
      deleteMutation.mutate(deleteProductCode);
    }
  };

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

  const searchSelectedLargeCategory = useMemo(() => 
    largeCategories.find(lc => lc.name === productSearchCategoryLarge), [largeCategories, productSearchCategoryLarge]);
  
  const searchMediumCategories = useMemo(() => {
    if (productSearchCategoryLarge === "all") return [];
    if (!searchSelectedLargeCategory) return [];
    return categories.filter(c => c.level === "medium" && c.parentId === searchSelectedLargeCategory.id);
  }, [categories, productSearchCategoryLarge, searchSelectedLargeCategory]);
  
  const searchSelectedMediumCategory = useMemo(() => 
    searchMediumCategories.find(mc => mc.name === productSearchCategoryMedium), [searchMediumCategories, productSearchCategoryMedium]);
  
  const searchSmallCategories = useMemo(() => {
    if (productSearchCategoryMedium === "all") return [];
    if (!searchSelectedMediumCategory) return [];
    return categories.filter(c => c.level === "small" && c.parentId === searchSelectedMediumCategory.id);
  }, [categories, productSearchCategoryMedium, searchSelectedMediumCategory]);

  const stockProducts = useMemo(() => {
    return productsWithStock.filter(p => p.currentStock > 0);
  }, [productsWithStock]);

  const filteredProducts = useMemo(() => {
    let filtered = stockProducts;
    
    if (filterCategoryLarge !== "all") {
      filtered = filtered.filter(p => p.categoryLarge === filterCategoryLarge);
    }
    if (filterCategoryMedium !== "all") {
      filtered = filtered.filter(p => p.categoryMedium === filterCategoryMedium);
    }
    if (filterCategorySmall !== "all") {
      filtered = filtered.filter(p => p.categorySmall === filterCategorySmall);
    }
    if (searchCode.trim()) {
      filtered = filtered.filter(p => p.productCode.toLowerCase().includes(searchCode.toLowerCase()));
    }
    if (searchName.trim()) {
      filtered = filtered.filter(p => p.productName.toLowerCase().includes(searchName.toLowerCase()));
    }
    
    return filtered;
  }, [stockProducts, filterCategoryLarge, filterCategoryMedium, filterCategorySmall, searchCode, searchName]);

  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(start, start + itemsPerPage);
  }, [filteredProducts, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);

  const handleDownloadList = () => {
    if (filteredProducts.length === 0) {
      toast({ title: "다운로드 실패", description: "다운로드할 상품이 없습니다.", variant: "destructive" });
      return;
    }

    const headers = ["상품코드", "상품명", "대분류", "중분류", "소분류", "사용여부", "매핑상태", "현재재고"];
    const rows = filteredProducts.map(p => [
      p.productCode || "",
      p.productName || "",
      p.categoryLarge || "",
      p.categoryMedium || "",
      p.categorySmall || "",
      p.usageStatus === "Y" ? "사용" : "미사용",
      p.mappingStatus === "complete" ? "완료" : "미완료",
      p.currentStock ?? 0,
    ]);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    XLSX.utils.book_append_sheet(wb, ws, "공급상품재고");

    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    XLSX.writeFile(wb, `공급상품재고_${dateStr}.xlsx`);
    toast({ title: "다운로드 완료", description: `${filteredProducts.length}개 상품이 다운로드되었습니다.` });
  };

  const searchableProducts = useMemo(() => {
    let filtered = productsWithStock;
    
    if (productSearchCategoryLarge !== "all") {
      filtered = filtered.filter(p => p.categoryLarge === productSearchCategoryLarge);
    }
    if (productSearchCategoryMedium !== "all") {
      filtered = filtered.filter(p => p.categoryMedium === productSearchCategoryMedium);
    }
    if (productSearchCategorySmall !== "all") {
      filtered = filtered.filter(p => p.categorySmall === productSearchCategorySmall);
    }
    if (productSearchQuery.trim()) {
      filtered = filtered.filter(p => 
        p.productCode.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
        p.productName.toLowerCase().includes(productSearchQuery.toLowerCase())
      );
    }
    
    return filtered;
  }, [productsWithStock, productSearchCategoryLarge, productSearchCategoryMedium, productSearchCategorySmall, productSearchQuery]);

  const openStockInDialog = (product?: ProductMappingWithStock) => {
    setDialogMode("stockIn");
    if (product) {
      setSelectedProduct(product);
      setStockInDialogOpen(true);
    } else {
      setSelectedProduct(null);
      setProductSearchDialogOpen(true);
    }
    setStockInQuantity("");
    setStockInNote("");
  };

  const openAdjustDialog = (product?: ProductMappingWithStock) => {
    setDialogMode("adjust");
    if (product) {
      setSelectedProduct(product);
      setAdjustDialogOpen(true);
    } else {
      setSelectedProduct(null);
      setProductSearchDialogOpen(true);
    }
    setAdjustType("decrease");
    setAdjustQuantity("");
    setAdjustReason("");
    setAdjustNote("");
  };

  const closeStockInDialog = () => {
    setStockInDialogOpen(false);
    setSelectedProduct(null);
    setStockInQuantity("");
    setStockInNote("");
  };

  const closeAdjustDialog = () => {
    setAdjustDialogOpen(false);
    setSelectedProduct(null);
    setAdjustType("decrease");
    setAdjustQuantity("");
    setAdjustReason("");
    setAdjustNote("");
  };

  const handleSelectProduct = (product: ProductMappingWithStock) => {
    setSelectedProduct(product);
    setProductSearchDialogOpen(false);
    if (dialogMode === "stockIn") {
      setStockInDialogOpen(true);
    } else {
      setAdjustDialogOpen(true);
    }
  };

  const handleStockIn = () => {
    if (!selectedProduct) return;
    const qty = parseInt(stockInQuantity);
    if (isNaN(qty) || qty <= 0) {
      toast({ title: "입고 수량은 양의 정수만 가능합니다", variant: "destructive" });
      return;
    }
    stockInMutation.mutate({
      productCode: selectedProduct.productCode,
      productName: selectedProduct.productName,
      quantity: qty,
      note: stockInNote,
    });
  };

  const handleAdjust = () => {
    if (!selectedProduct) return;
    const qty = parseInt(adjustQuantity);
    if (isNaN(qty) || qty <= 0) {
      toast({ title: "조정 수량은 양의 정수만 가능합니다", variant: "destructive" });
      return;
    }
    if (adjustType === "decrease" && qty > selectedProduct.currentStock) {
      toast({ title: "현재 재고보다 많은 수량을 감소할 수 없습니다", variant: "destructive" });
      return;
    }
    adjustMutation.mutate({
      productCode: selectedProduct.productCode,
      adjustType,
      quantity: qty,
      reason: adjustReason,
      note: adjustNote,
    });
  };

  const adjustedStock = useMemo(() => {
    if (!selectedProduct) return 0;
    const qty = parseInt(adjustQuantity) || 0;
    if (adjustType === "increase") {
      return selectedProduct.currentStock + qty;
    } else {
      return Math.max(0, selectedProduct.currentStock - qty);
    }
  }, [selectedProduct, adjustQuantity, adjustType]);

  const resetFilters = () => {
    setFilterCategoryLarge("all");
    setFilterCategoryMedium("all");
    setFilterCategorySmall("all");
    setSearchCode("");
    setSearchName("");
    setCurrentPage(1);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadMutation.mutate(file);
    }
    e.target.value = "";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">공급상품 재고 관리</h1>
          <p className="text-sm text-muted-foreground">완성된 공급상품의 재고를 관리합니다.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.open("/api/product-stocks/template", "_blank")} data-testid="button-download-template">
            <Download className="h-4 w-4 mr-2" /> 양식 다운로드
          </Button>
          <Button variant="outline" onClick={() => setUploadDialogOpen(true)} data-testid="button-upload-excel">
            <Upload className="h-4 w-4 mr-2" /> 엑셀 업로드
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>※ 상품 카테고리는 "상품관리 &gt; 카테고리 관리"에서 설정한 카테고리입니다.</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div>
                <Label className="text-xs">대분류</Label>
                <Select value={filterCategoryLarge} onValueChange={(v) => {
                  setFilterCategoryLarge(v);
                  setFilterCategoryMedium("all");
                  setFilterCategorySmall("all");
                }}>
                  <SelectTrigger data-testid="select-category-large">
                    <SelectValue placeholder="전체" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체</SelectItem>
                    {largeCategories.map(c => (
                      <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">중분류</Label>
                <Select 
                  value={filterCategoryMedium} 
                  onValueChange={(v) => {
                    setFilterCategoryMedium(v);
                    setFilterCategorySmall("all");
                  }}
                  disabled={filterCategoryLarge === "all"}
                >
                  <SelectTrigger data-testid="select-category-medium">
                    <SelectValue placeholder="전체" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체</SelectItem>
                    {mediumCategories.map(c => (
                      <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">소분류</Label>
                <Select 
                  value={filterCategorySmall} 
                  onValueChange={setFilterCategorySmall}
                  disabled={filterCategoryMedium === "all"}
                >
                  <SelectTrigger data-testid="select-category-small">
                    <SelectValue placeholder="전체" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체</SelectItem>
                    {smallCategories.map(c => (
                      <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">상품코드</Label>
                <Input
                  placeholder="상품코드 검색"
                  value={searchCode}
                  onChange={(e) => setSearchCode(e.target.value)}
                  data-testid="input-search-code"
                />
              </div>
              <div>
                <Label className="text-xs">상품명</Label>
                <Input
                  placeholder="상품명 검색"
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  data-testid="input-search-name"
                />
              </div>
              <div className="flex items-end gap-2">
                <Button onClick={() => setCurrentPage(1)} data-testid="button-search">
                  <Search className="h-4 w-4 mr-1" /> 검색
                </Button>
                <Button variant="outline" onClick={resetFilters} data-testid="button-reset">
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => openStockInDialog()} data-testid="button-stock-in">
            <Plus className="h-4 w-4 mr-1" /> 입고 등록
          </Button>
          <Button variant="outline" onClick={() => openAdjustDialog()} data-testid="button-adjust">
            <Package className="h-4 w-4 mr-1" /> 재고 조정
          </Button>
          <Button variant="outline" onClick={handleDownloadList} data-testid="button-download-list">
            <Download className="h-4 w-4 mr-1" /> 엑셀 다운로드
          </Button>
        </div>
        <div className="text-sm text-muted-foreground">
          총 {filteredProducts.length}개 (재고 있는 상품)
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium">대분류</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">중분류</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">소분류</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">상품코드</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">상품명</th>
                  <th className="px-4 py-3 text-center text-sm font-medium">현재재고</th>
                  <th className="px-4 py-3 text-center text-sm font-medium">관리</th>
                </tr>
              </thead>
              <tbody>
                {paginatedProducts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      재고가 있는 상품이 없습니다.
                    </td>
                  </tr>
                ) : (
                  paginatedProducts.map((product) => (
                    <tr key={product.id} className="border-t hover-elevate" data-testid={`row-product-${product.productCode}`}>
                      <td className="px-4 py-3 text-sm">{product.categoryLarge || "-"}</td>
                      <td className="px-4 py-3 text-sm">{product.categoryMedium || "-"}</td>
                      <td className="px-4 py-3 text-sm">{product.categorySmall || "-"}</td>
                      <td className="px-4 py-3 text-sm font-medium">{product.productCode}</td>
                      <td className="px-4 py-3 text-sm">{product.productName}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant="secondary" className="font-bold">
                          {product.currentStock}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button size="sm" variant="outline" onClick={() => openStockInDialog(product)} data-testid={`button-stock-in-${product.productCode}`}>
                            입고
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => openAdjustDialog(product)} data-testid={`button-adjust-${product.productCode}`}>
                            조정
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleDeleteClick(product.productCode)} data-testid={`button-delete-${product.productCode}`}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-2 p-4">
            {paginatedProducts.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                재고가 있는 상품이 없습니다.
              </div>
            ) : (
              paginatedProducts.map((product) => (
                <Card key={product.id} className="p-4" data-testid={`card-product-${product.productCode}`}>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-medium">{product.productName}</div>
                      <div className="text-sm text-muted-foreground">{product.productCode}</div>
                    </div>
                    <Badge variant="secondary" className="font-bold text-lg">
                      {product.currentStock}개
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mb-3">
                    {product.categoryLarge} &gt; {product.categoryMedium} &gt; {product.categorySmall}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => openStockInDialog(product)}>
                      입고
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => openAdjustDialog(product)}>
                      조정
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDeleteClick(product.productCode)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            이전
          </Button>
          <span className="text-sm">
            {currentPage} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            다음
          </Button>
        </div>
      )}

      <div className="text-xs text-muted-foreground space-y-1">
        <p>※ 재고가 0인 상품은 표시되지 않습니다.</p>
        <p>※ 입고/조정 시에는 모든 상품(상품 매핑에 등록된)을 검색할 수 있습니다.</p>
      </div>

      <Dialog open={productSearchDialogOpen} onOpenChange={setProductSearchDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{dialogMode === "stockIn" ? "공급상품 입고 등록" : "재고 조정"} - 상품 선택</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <Select value={productSearchCategoryLarge} onValueChange={(v) => {
                setProductSearchCategoryLarge(v);
                setProductSearchCategoryMedium("all");
                setProductSearchCategorySmall("all");
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="대분류" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  {largeCategories.map(c => (
                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select 
                value={productSearchCategoryMedium} 
                onValueChange={(v) => {
                  setProductSearchCategoryMedium(v);
                  setProductSearchCategorySmall("all");
                }}
                disabled={productSearchCategoryLarge === "all"}
              >
                <SelectTrigger>
                  <SelectValue placeholder="중분류" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  {searchMediumCategories.map(c => (
                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select 
                value={productSearchCategorySmall} 
                onValueChange={setProductSearchCategorySmall}
                disabled={productSearchCategoryMedium === "all"}
              >
                <SelectTrigger>
                  <SelectValue placeholder="소분류" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  {searchSmallCategories.map(c => (
                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative">
                <Input
                  placeholder="상품명 검색"
                  value={productSearchQuery}
                  onChange={(e) => setProductSearchQuery(e.target.value)}
                />
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            <ScrollArea className="h-[300px] border rounded-md">
              <div className="p-2 space-y-1">
                {searchableProducts.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between p-3 rounded-md hover:bg-muted cursor-pointer"
                    onClick={() => handleSelectProduct(product)}
                    data-testid={`select-product-${product.productCode}`}
                  >
                    <div>
                      <div className="font-medium">{product.productCode} - {product.productName}</div>
                      <div className="text-xs text-muted-foreground">
                        {product.categoryLarge} &gt; {product.categoryMedium} &gt; {product.categorySmall}
                      </div>
                    </div>
                    <Badge variant="outline">재고: {product.currentStock}</Badge>
                  </div>
                ))}
                {searchableProducts.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    검색 결과가 없습니다.
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProductSearchDialogOpen(false)}>
              취소
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={stockInDialogOpen} onOpenChange={setStockInDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>공급상품 입고 등록</DialogTitle>
          </DialogHeader>
          {selectedProduct && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-md">
                <div className="font-medium">{selectedProduct.productCode} - {selectedProduct.productName}</div>
                <div className="text-sm text-muted-foreground">현재 재고: {selectedProduct.currentStock}개</div>
              </div>
              <div>
                <Label>입고 수량</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="1"
                    value={stockInQuantity}
                    onChange={(e) => setStockInQuantity(e.target.value)}
                    placeholder="수량 입력"
                    data-testid="input-stock-in-quantity"
                  />
                  <span className="text-sm text-muted-foreground">개 (정수만 입력)</span>
                </div>
              </div>
              <div>
                <Label>비고 (선택)</Label>
                <Input
                  value={stockInNote}
                  onChange={(e) => setStockInNote(e.target.value)}
                  placeholder="비고 입력"
                  data-testid="input-stock-in-note"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeStockInDialog}>취소</Button>
            <Button onClick={handleStockIn} disabled={stockInMutation.isPending} data-testid="button-confirm-stock-in">
              {stockInMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              입고 등록
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={adjustDialogOpen} onOpenChange={setAdjustDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>재고 조정</DialogTitle>
          </DialogHeader>
          {selectedProduct && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-md">
                <div className="font-medium">{selectedProduct.productCode} - {selectedProduct.productName}</div>
                <div className="text-sm text-muted-foreground">현재 재고: {selectedProduct.currentStock}개</div>
              </div>
              <div>
                <Label>조정 유형</Label>
                <RadioGroup value={adjustType} onValueChange={(v) => setAdjustType(v as "increase" | "decrease")} className="flex gap-4 mt-2">
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="increase" id="adjust-increase" />
                    <Label htmlFor="adjust-increase" className="flex items-center gap-1 cursor-pointer">
                      <ArrowUp className="h-4 w-4 text-green-500" /> 증가 (+)
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="decrease" id="adjust-decrease" />
                    <Label htmlFor="adjust-decrease" className="flex items-center gap-1 cursor-pointer">
                      <ArrowDown className="h-4 w-4 text-red-500" /> 감소 (-)
                    </Label>
                  </div>
                </RadioGroup>
              </div>
              <div>
                <Label>조정 수량</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="1"
                    value={adjustQuantity}
                    onChange={(e) => setAdjustQuantity(e.target.value)}
                    placeholder="수량 입력"
                    data-testid="input-adjust-quantity"
                  />
                  <span className="text-sm text-muted-foreground">개 (정수만 입력)</span>
                </div>
              </div>
              <div>
                <Label>조정 사유</Label>
                <Select value={adjustReason} onValueChange={setAdjustReason}>
                  <SelectTrigger data-testid="select-adjust-reason">
                    <SelectValue placeholder="사유 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="파손">파손</SelectItem>
                    <SelectItem value="오차 수정">오차 수정</SelectItem>
                    <SelectItem value="폐기">폐기</SelectItem>
                    <SelectItem value="기타">기타</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>비고 (선택)</Label>
                <Input
                  value={adjustNote}
                  onChange={(e) => setAdjustNote(e.target.value)}
                  placeholder="비고 입력"
                  data-testid="input-adjust-note"
                />
              </div>
              <div className="p-3 border rounded-md bg-muted/50">
                <div className="flex justify-between text-sm">
                  <span>현재 재고:</span>
                  <span className="font-medium">{selectedProduct.currentStock}개</span>
                </div>
                <div className="flex justify-between text-sm font-bold mt-1">
                  <span>조정 후 재고:</span>
                  <span className={adjustType === "increase" ? "text-green-600" : "text-red-600"}>
                    {adjustedStock}개
                  </span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeAdjustDialog}>취소</Button>
            <Button onClick={handleAdjust} disabled={adjustMutation.isPending} data-testid="button-confirm-adjust">
              {adjustMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              조정 완료
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>엑셀 업로드</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
              onClick={() => uploadInputRef.current?.click()}
            >
              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                엑셀 파일을 드래그하거나<br />
                클릭하여 업로드
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                (.xlsx, .xls 파일만 가능)
              </p>
            </div>
            <input
              ref={uploadInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileUpload}
            />
            <Button variant="outline" className="w-full" onClick={() => window.open("/api/product-stocks/template", "_blank")}>
              <Download className="h-4 w-4 mr-2" /> 양식 다운로드
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
              취소
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={uploadResultDialogOpen} onOpenChange={setUploadResultDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>엑셀 업로드 결과</DialogTitle>
          </DialogHeader>
          {uploadResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-3 bg-muted rounded-md">
                  <div className="text-2xl font-bold">{uploadResult.successItems.length + uploadResult.errors.length}</div>
                  <div className="text-xs text-muted-foreground">전체</div>
                </div>
                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-md">
                  <div className="text-2xl font-bold text-green-600">{uploadResult.successItems.length}</div>
                  <div className="text-xs text-muted-foreground">입고 가능</div>
                </div>
                <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-md">
                  <div className="text-2xl font-bold text-red-600">{uploadResult.errors.length}</div>
                  <div className="text-xs text-muted-foreground">오류</div>
                </div>
              </div>
              
              {uploadResult.successItems.length > 0 && (
                <div>
                  <Label className="mb-2 block">입고 예정 목록</Label>
                  <ScrollArea className="h-[150px] border rounded-md">
                    <table className="w-full">
                      <thead className="bg-muted/50 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs">상품코드</th>
                          <th className="px-3 py-2 text-left text-xs">상품명</th>
                          <th className="px-3 py-2 text-center text-xs">입고수량</th>
                        </tr>
                      </thead>
                      <tbody>
                        {uploadResult.successItems.map((item, i) => (
                          <tr key={i} className="border-t">
                            <td className="px-3 py-2 text-sm">{item.productCode}</td>
                            <td className="px-3 py-2 text-sm">{item.productName}</td>
                            <td className="px-3 py-2 text-center text-sm font-medium">{item.quantity}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ScrollArea>
                </div>
              )}
              
              {uploadResult.errors.length > 0 && (
                <div>
                  <Label className="mb-2 block">오류 목록</Label>
                  <ScrollArea className="h-[100px] border rounded-md p-3">
                    <ul className="text-sm space-y-1">
                      {uploadResult.errors.map((err, i) => (
                        <li key={i} className="text-red-600">• {err}</li>
                      ))}
                    </ul>
                  </ScrollArea>
                </div>
              )}
              
              <p className="text-xs text-muted-foreground">
                ※ 오류가 있는 항목은 제외하고 입고됩니다.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadResultDialogOpen(false)}>
              취소
            </Button>
            <Button 
              onClick={() => uploadResult && confirmUploadMutation.mutate(uploadResult.successItems)}
              disabled={confirmUploadMutation.isPending || !uploadResult?.successItems.length}
              data-testid="button-confirm-upload"
            >
              {confirmUploadMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {uploadResult?.successItems.length || 0}개 상품 입고하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>재고 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              이 상품의 재고 정보를 삭제하시겠습니까? 삭제된 재고는 복구할 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
