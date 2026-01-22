import { useState, useRef, useMemo } from "react";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Download, Upload, Loader2, Search, Eye, Edit, Package, X, ChevronLeft, ChevronRight } from "lucide-react";
import type { ProductMapping, ProductMaterialMapping, Material } from "@shared/schema";

interface ProductMappingWithMaterials extends ProductMapping {
  materials: ProductMaterialMapping[];
}

export default function ProductMappingPage() {
  const { toast } = useToast();
  const uploadInputRef = useRef<HTMLInputElement>(null);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState("default");
  const [itemsPerPage, setItemsPerPage] = useState(100);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
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

  const filteredAndSortedMappings = useMemo(() => {
    let result = productMappings.filter((m) => {
      const matchesSearch = searchQuery === "" || 
        m.productCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.productName.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
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
  }, [productMappings, searchQuery, sortOption]);

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

  return (
    <div className="space-y-4 p-4" data-testid="page-product-mapping">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-lg font-medium">총</span>
            <span className="text-lg font-bold text-primary">{filteredAndSortedMappings.length}건</span>
            <span className="text-sm text-muted-foreground ml-4">
              ({currentPage} Page / Tot {totalPages || 1} Page)
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleDownloadTemplate} data-testid="button-download-template">
              <Download className="w-4 h-4 mr-1" />
              양식 다운로드
            </Button>
            <Button variant="outline" size="sm" onClick={() => uploadInputRef.current?.click()} disabled={uploadMutation.isPending} data-testid="button-upload-excel">
              {uploadMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
              엑셀 업로드
            </Button>
            <input
              ref={uploadInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleUpload}
              className="hidden"
              data-testid="input-upload-file"
            />
            <Button size="sm" onClick={() => setAddProductDialogOpen(true)} data-testid="button-add-product">
              <Plus className="w-4 h-4 mr-1" />
              상품 추가
            </Button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="flex items-center gap-2">
            <Label className="text-sm whitespace-nowrap">판매상품명</Label>
            <Input
              placeholder="검색"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-40"
              data-testid="input-search"
            />
            <Button variant="outline" size="sm" onClick={() => setSearchQuery("")}>
              <Search className="w-4 h-4" />
              검색
            </Button>
            {selectedIds.length > 0 && (
              <Button variant="destructive" size="sm" onClick={() => setBulkDeleteDialogOpen(true)} data-testid="button-bulk-delete">
                삭제하기
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2 sm:ml-auto">
            <Select value={sortOption} onValueChange={setSortOption}>
              <SelectTrigger className="w-32" data-testid="select-sort">
                <SelectValue placeholder="정렬" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">정렬_기본</SelectItem>
                <SelectItem value="code_asc">코드 오름차순</SelectItem>
                <SelectItem value="code_desc">코드 내림차순</SelectItem>
                <SelectItem value="name_asc">상품명 오름차순</SelectItem>
                <SelectItem value="name_desc">상품명 내림차순</SelectItem>
              </SelectContent>
            </Select>
            <Select value={String(itemsPerPage)} onValueChange={(v) => { setItemsPerPage(Number(v)); setCurrentPage(1); }}>
              <SelectTrigger className="w-32" data-testid="select-items-per-page">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="50">50개씩 출력</SelectItem>
                <SelectItem value="100">100개씩 출력</SelectItem>
                <SelectItem value="200">200개씩 출력</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="hidden lg:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-amber-50 dark:bg-amber-950/30">
                  <TableHead className="w-12 text-center">
                    <Checkbox
                      checked={paginatedMappings.length > 0 && selectedIds.length === paginatedMappings.length}
                      onCheckedChange={toggleSelectAll}
                      data-testid="checkbox-select-all"
                    />
                  </TableHead>
                  <TableHead className="min-w-[120px]">판매상품코드</TableHead>
                  <TableHead className="min-w-[200px]">판매상품명</TableHead>
                  <TableHead className="bg-amber-100/50 dark:bg-amber-900/30 text-center" colSpan={2}>원재료1</TableHead>
                  <TableHead className="bg-amber-100/50 dark:bg-amber-900/30 text-center" colSpan={2}>원재료2</TableHead>
                  <TableHead className="bg-amber-100/50 dark:bg-amber-900/30 text-center" colSpan={2}>원재료3</TableHead>
                  <TableHead className="bg-amber-100/50 dark:bg-amber-900/30 text-center" colSpan={2}>원재료4</TableHead>
                  <TableHead className="text-center">사용유무</TableHead>
                  <TableHead className="w-24 text-center">작업</TableHead>
                </TableRow>
                <TableRow className="bg-amber-50/50 dark:bg-amber-950/20">
                  <TableHead></TableHead>
                  <TableHead></TableHead>
                  <TableHead></TableHead>
                  <TableHead className="text-center text-xs">원재료품목1</TableHead>
                  <TableHead className="text-center text-xs w-16">수량</TableHead>
                  <TableHead className="text-center text-xs">원재료품목2</TableHead>
                  <TableHead className="text-center text-xs w-16">수량</TableHead>
                  <TableHead className="text-center text-xs">원재료품목3</TableHead>
                  <TableHead className="text-center text-xs w-16">수량</TableHead>
                  <TableHead className="text-center text-xs">원재료품목4</TableHead>
                  <TableHead className="text-center text-xs w-16">수량</TableHead>
                  <TableHead></TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={13} className="text-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : paginatedMappings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={13} className="text-center py-8 text-muted-foreground">
                      등록된 상품이 없습니다
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedMappings.map((mapping) => {
                    const mat1 = getMaterialInfo(mapping.materials, 0);
                    const mat2 = getMaterialInfo(mapping.materials, 1);
                    const mat3 = getMaterialInfo(mapping.materials, 2);
                    const mat4 = getMaterialInfo(mapping.materials, 3);
                    return (
                      <TableRow key={mapping.productCode} data-testid={`row-product-${mapping.productCode}`}>
                        <TableCell className="text-center">
                          <Checkbox
                            checked={selectedIds.includes(mapping.productCode)}
                            onCheckedChange={(checked) => toggleSelectOne(mapping.productCode, checked as boolean)}
                            data-testid={`checkbox-product-${mapping.productCode}`}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-sm text-blue-600 dark:text-blue-400 underline cursor-pointer" onClick={() => handleOpenEditMapping(mapping)}>
                          {mapping.productCode}
                        </TableCell>
                        <TableCell>{mapping.productName}</TableCell>
                        <TableCell className="text-sm">{mat1.name}</TableCell>
                        <TableCell className="text-center text-sm">{mat1.qty}</TableCell>
                        <TableCell className="text-sm">{mat2.name}</TableCell>
                        <TableCell className="text-center text-sm">{mat2.qty}</TableCell>
                        <TableCell className="text-sm">{mat3.name}</TableCell>
                        <TableCell className="text-center text-sm">{mat3.qty}</TableCell>
                        <TableCell className="text-sm">{mat4.name}</TableCell>
                        <TableCell className="text-center text-sm">{mat4.qty}</TableCell>
                        <TableCell className="text-center">
                          <span className={mapping.mappingStatus === "complete" ? "text-green-600" : "text-muted-foreground"}>
                            {mapping.mappingStatus === "complete" ? "사용" : "-"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleOpenEditMapping(mapping)} data-testid={`button-edit-${mapping.productCode}`}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteProduct(mapping.productCode)} data-testid={`button-delete-${mapping.productCode}`}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <div className="lg:hidden divide-y">
            {isLoading ? (
              <div className="p-8 text-center">
                <Loader2 className="w-6 h-6 animate-spin mx-auto" />
              </div>
            ) : paginatedMappings.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                등록된 상품이 없습니다
              </div>
            ) : (
              paginatedMappings.map((mapping) => (
                <div key={mapping.productCode} className="p-4" data-testid={`card-product-${mapping.productCode}`}>
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={selectedIds.includes(mapping.productCode)}
                      onCheckedChange={(checked) => toggleSelectOne(mapping.productCode, checked as boolean)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-mono text-sm text-blue-600 dark:text-blue-400">{mapping.productCode}</div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleOpenEditMapping(mapping)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteProduct(mapping.productCode)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="font-medium mt-1">{mapping.productName}</div>
                      <div className="mt-2 space-y-1">
                        {mapping.materials.slice(0, 4).map((mat, idx) => (
                          <div key={mat.materialCode} className="text-sm text-muted-foreground">
                            원재료{idx + 1}: {mat.materialName} ({mat.quantity})
                          </div>
                        ))}
                        {mapping.materials.length === 0 && (
                          <div className="text-sm text-muted-foreground">매핑된 재료 없음</div>
                        )}
                      </div>
                      <div className="mt-2">
                        <Badge variant={mapping.mappingStatus === "complete" ? "default" : "secondary"}>
                          {mapping.mappingStatus === "complete" ? "사용" : "미사용"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
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
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => p - 1)}
            data-testid="button-prev-page"
          >
            <ChevronLeft className="w-4 h-4" />
            이전
          </Button>
          <span className="text-sm">
            {currentPage} / {totalPages} 페이지
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(p => p + 1)}
            data-testid="button-next-page"
          >
            다음
            <ChevronRight className="w-4 h-4" />
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
