import { useState, useRef } from "react";
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
import { Plus, Trash2, Download, Upload, Loader2, Search, Eye, Edit, Package, X } from "lucide-react";
import type { ProductMapping, ProductMaterialMapping, Material } from "@shared/schema";

interface ProductMappingWithMaterials extends ProductMapping {
  materials: ProductMaterialMapping[];
}

export default function ProductMappingPage() {
  const { toast } = useToast();
  const uploadInputRef = useRef<HTMLInputElement>(null);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  const [addProductDialogOpen, setAddProductDialogOpen] = useState(false);
  const [addProductMode, setAddProductMode] = useState<"import" | "manual">("import");
  const [manualProductCode, setManualProductCode] = useState("");
  const [manualProductName, setManualProductName] = useState("");
  const [selectedImportProducts, setSelectedImportProducts] = useState<string[]>([]);
  
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductMappingWithMaterials | null>(null);
  
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

  const filteredMappings = productMappings.filter((m) => {
    const matchesSearch = searchQuery === "" || 
      m.productCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.productName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || m.mappingStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

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

  const handleOpenDetail = (product: ProductMappingWithMaterials) => {
    setSelectedProduct(product);
    setDetailDialogOpen(true);
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
      setSelectedIds(filteredMappings.map(m => m.productCode));
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

  const completeCount = productMappings.filter(m => m.mappingStatus === "complete").length;
  const incompleteCount = productMappings.filter(m => m.mappingStatus === "incomplete").length;

  return (
    <div className="space-y-4 p-4" data-testid="page-product-mapping">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">상품 매핑</h1>
          <p className="text-sm text-muted-foreground mt-1">상품에 필요한 재료를 매핑합니다</p>
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-3" data-testid="card-stat-total">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">전체 상품</span>
          </div>
          <div className="text-2xl font-bold mt-1">{productMappings.length}</div>
        </Card>
        <Card className="p-3" data-testid="card-stat-complete">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-sm text-muted-foreground">매핑 완료</span>
          </div>
          <div className="text-2xl font-bold mt-1">{completeCount}</div>
        </Card>
        <Card className="p-3" data-testid="card-stat-incomplete">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-yellow-500" />
            <span className="text-sm text-muted-foreground">매핑 미완료</span>
          </div>
          <div className="text-2xl font-bold mt-1">{incompleteCount}</div>
        </Card>
      </div>

      <Card className="p-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="상품코드 또는 상품명 검색"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-status-filter">
              <SelectValue placeholder="상태 필터" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              <SelectItem value="complete">매핑 완료</SelectItem>
              <SelectItem value="incomplete">매핑 미완료</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {selectedIds.length > 0 && (
        <Card className="p-3 bg-muted/50">
          <div className="flex items-center justify-between">
            <span className="text-sm">{selectedIds.length}개 선택됨</span>
            <Button variant="destructive" size="sm" onClick={() => setBulkDeleteDialogOpen(true)} data-testid="button-bulk-delete">
              <Trash2 className="w-4 h-4 mr-1" />
              선택 삭제
            </Button>
          </div>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="hidden lg:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={filteredMappings.length > 0 && selectedIds.length === filteredMappings.length}
                      onCheckedChange={toggleSelectAll}
                      data-testid="checkbox-select-all"
                    />
                  </TableHead>
                  <TableHead>상품코드</TableHead>
                  <TableHead>상품명</TableHead>
                  <TableHead>매핑된 재료</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead className="w-24">작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : filteredMappings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      등록된 상품이 없습니다
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMappings.map((mapping) => (
                    <TableRow key={mapping.productCode} data-testid={`row-product-${mapping.productCode}`}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.includes(mapping.productCode)}
                          onCheckedChange={(checked) => toggleSelectOne(mapping.productCode, checked as boolean)}
                          data-testid={`checkbox-product-${mapping.productCode}`}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-sm">{mapping.productCode}</TableCell>
                      <TableCell>{mapping.productName}</TableCell>
                      <TableCell>
                        <span className="text-muted-foreground">{mapping.materials.length}개</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={mapping.mappingStatus === "complete" ? "default" : "secondary"}>
                          {mapping.mappingStatus === "complete" ? "완료" : "미완료"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleOpenDetail(mapping)} data-testid={`button-view-${mapping.productCode}`}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleOpenEditMapping(mapping)} data-testid={`button-edit-${mapping.productCode}`}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteProduct(mapping.productCode)} data-testid={`button-delete-${mapping.productCode}`}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="lg:hidden divide-y">
            {isLoading ? (
              <div className="p-8 text-center">
                <Loader2 className="w-6 h-6 animate-spin mx-auto" />
              </div>
            ) : filteredMappings.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                등록된 상품이 없습니다
              </div>
            ) : (
              filteredMappings.map((mapping) => (
                <div key={mapping.productCode} className="p-4" data-testid={`card-product-${mapping.productCode}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={selectedIds.includes(mapping.productCode)}
                        onCheckedChange={(checked) => toggleSelectOne(mapping.productCode, checked as boolean)}
                      />
                      <div>
                        <div className="font-mono text-sm text-muted-foreground">{mapping.productCode}</div>
                        <div className="font-medium mt-1">{mapping.productName}</div>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-sm text-muted-foreground">재료 {mapping.materials.length}개</span>
                          <Badge variant={mapping.mappingStatus === "complete" ? "default" : "secondary"} className="text-xs">
                            {mapping.mappingStatus === "complete" ? "완료" : "미완료"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenDetail(mapping)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleOpenEditMapping(mapping)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteProduct(mapping.productCode)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

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
                          data-testid={`import-product-${p.productCode}`}
                        >
                          <Checkbox checked={selectedImportProducts.includes(p.productCode)} />
                          <div className="flex-1">
                            <span className="font-mono text-sm text-muted-foreground">{p.productCode}</span>
                            <span className="ml-2">{p.productName}</span>
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
                  <Label htmlFor="productCode">상품코드</Label>
                  <Input
                    id="productCode"
                    value={manualProductCode}
                    onChange={(e) => setManualProductCode(e.target.value)}
                    placeholder="상품코드 입력"
                    data-testid="input-product-code"
                  />
                </div>
                <div>
                  <Label htmlFor="productName">상품명</Label>
                  <Input
                    id="productName"
                    value={manualProductName}
                    onChange={(e) => setManualProductName(e.target.value)}
                    placeholder="상품명 입력"
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
              {(addProductMutation.isPending || bulkAddProductMutation.isPending) && (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              )}
              추가
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>상품 상세</DialogTitle>
            <DialogDescription>{selectedProduct?.productCode} - {selectedProduct?.productName}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">매핑 상태</span>
              <Badge variant={selectedProduct?.mappingStatus === "complete" ? "default" : "secondary"}>
                {selectedProduct?.mappingStatus === "complete" ? "완료" : "미완료"}
              </Badge>
            </div>
            <div>
              <Label className="text-sm">매핑된 재료 ({selectedProduct?.materials.length || 0}개)</Label>
              {selectedProduct?.materials.length === 0 ? (
                <div className="mt-2 p-4 text-center text-muted-foreground border rounded-md">
                  매핑된 재료가 없습니다
                </div>
              ) : (
                <ScrollArea className="h-[200px] mt-2 border rounded-md">
                  <div className="p-2 space-y-1">
                    {selectedProduct?.materials.map((m) => (
                      <div key={m.materialCode} className="flex items-center justify-between p-2 rounded bg-muted/50">
                        <div>
                          <span className="font-mono text-sm text-muted-foreground">{m.materialCode}</span>
                          <span className="ml-2">{m.materialName}</span>
                        </div>
                        <span className="text-sm font-medium">{m.quantity}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>닫기</Button>
            <Button onClick={() => {
              setDetailDialogOpen(false);
              if (selectedProduct) handleOpenEditMapping(selectedProduct);
            }} data-testid="button-edit-from-detail">
              <Edit className="w-4 h-4 mr-1" />
              매핑 편집
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editMappingDialogOpen} onOpenChange={setEditMappingDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>재료 매핑 편집</DialogTitle>
            <DialogDescription>{editProductCode} - {editProductName}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm">매핑된 재료 ({editMaterials.length}개)</Label>
              <Button variant="outline" size="sm" onClick={() => setAddMaterialDialogOpen(true)} data-testid="button-add-material">
                <Plus className="w-4 h-4 mr-1" />
                재료 추가
              </Button>
            </div>
            {editMaterials.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground border rounded-md">
                매핑된 재료가 없습니다. 재료를 추가해주세요.
              </div>
            ) : (
              <ScrollArea className="h-[250px] border rounded-md">
                <div className="p-2 space-y-2">
                  {editMaterials.map((m) => (
                    <div key={m.materialCode} className="flex items-center gap-3 p-2 rounded bg-muted/50">
                      <div className="flex-1">
                        <span className="font-mono text-sm text-muted-foreground">{m.materialCode}</span>
                        <span className="ml-2">{m.materialName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground">수량</Label>
                        <Input
                          type="number"
                          value={m.quantity}
                          onChange={(e) => handleUpdateMaterialQuantity(m.materialCode, parseFloat(e.target.value) || 0)}
                          className="w-20 h-8 text-sm"
                          step="0.1"
                          min="0"
                          data-testid={`input-quantity-${m.materialCode}`}
                        />
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleRemoveMaterialFromMapping(m.materialCode)} data-testid={`button-remove-material-${m.materialCode}`}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
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
            <DialogDescription>매핑할 재료를 선택하세요</DialogDescription>
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
                    검색 결과가 없습니다
                  </div>
                ) : (
                  filteredMaterials.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between p-2 rounded hover-elevate cursor-pointer"
                      onClick={() => handleAddMaterialToMapping(m)}
                      data-testid={`select-material-${m.materialCode}`}
                    >
                      <div>
                        <span className="font-mono text-sm text-muted-foreground">{m.materialCode}</span>
                        <span className="ml-2">{m.materialName}</span>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {m.materialType === "raw" ? "원재료" : m.materialType === "semi" ? "반재료" : "부재료"}
                      </Badge>
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
              상품 "{deleteProductCode}"를 삭제하시겠습니까? 연결된 재료 매핑도 함께 삭제됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteProductMutation.mutate(deleteProductCode)} data-testid="button-confirm-delete">삭제</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>선택 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              선택한 {selectedIds.length}개 상품을 삭제하시겠습니까? 연결된 재료 매핑도 함께 삭제됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} data-testid="button-confirm-bulk-delete">삭제</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={uploadResultDialogOpen} onOpenChange={setUploadResultDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>업로드 결과</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-muted/50 rounded-md">
                <div className="text-sm text-muted-foreground">등록된 상품</div>
                <div className="text-xl font-bold">{uploadResult?.totalProducts || 0}개</div>
              </div>
              <div className="p-3 bg-muted/50 rounded-md">
                <div className="text-sm text-muted-foreground">재료 매핑 완료</div>
                <div className="text-xl font-bold">{uploadResult?.productWithMappingCount || 0}개</div>
              </div>
            </div>
            {uploadResult?.errors && uploadResult.errors.length > 0 && (
              <div>
                <Label className="text-sm text-destructive">오류 ({uploadResult.errors.length}건)</Label>
                <ScrollArea className="h-[150px] mt-2 border rounded-md border-destructive/50">
                  <div className="p-2 space-y-1">
                    {uploadResult.errors.map((err, i) => (
                      <div key={i} className="text-sm text-destructive">{err}</div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setUploadResultDialogOpen(false)}>확인</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
