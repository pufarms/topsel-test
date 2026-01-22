import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, MoreHorizontal, Pencil, Trash2, Download, Upload, Loader2 } from "lucide-react";
import type { MaterialCategoryLarge, MaterialCategoryMedium, Material, MaterialType } from "@shared/schema";
import { materialTypeLabels } from "@shared/schema";

export default function MaterialsPage() {
  const { toast } = useToast();
  const [selectedLarge, setSelectedLarge] = useState<string | null>(null);
  const [selectedMedium, setSelectedMedium] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [largeCategoryDialogOpen, setLargeCategoryDialogOpen] = useState(false);
  const [largeCategoryEditId, setLargeCategoryEditId] = useState<string | null>(null);
  const [largeCategoryName, setLargeCategoryName] = useState("");

  const [mediumCategoryDialogOpen, setMediumCategoryDialogOpen] = useState(false);
  const [mediumCategoryEditId, setMediumCategoryEditId] = useState<string | null>(null);
  const [mediumCategoryName, setMediumCategoryName] = useState("");

  const [materialDialogOpen, setMaterialDialogOpen] = useState(false);
  const [materialEditId, setMaterialEditId] = useState<string | null>(null);
  const [materialType, setMaterialType] = useState<MaterialType>("raw");
  const [materialLargeCategoryId, setMaterialLargeCategoryId] = useState("");
  const [materialMediumCategoryId, setMaterialMediumCategoryId] = useState("");
  const [materialCode, setMaterialCode] = useState("");
  const [materialName, setMaterialName] = useState("");
  const [materialStock, setMaterialStock] = useState("0");

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteCategoryType, setDeleteCategoryType] = useState<"large" | "medium" | null>(null);
  const [deleteCategoryId, setDeleteCategoryId] = useState<string | null>(null);
  const [deleteCategoryName, setDeleteCategoryName] = useState("");

  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);

  const [uploadErrorsDialogOpen, setUploadErrorsDialogOpen] = useState(false);
  const [uploadErrors, setUploadErrors] = useState<{ row: number; error: string }[]>([]);

  const { data: largeCategories = [] } = useQuery<MaterialCategoryLarge[]>({
    queryKey: ["/api/material-categories/large"],
  });

  const { data: mediumCategories = [] } = useQuery<MaterialCategoryMedium[]>({
    queryKey: ["/api/material-categories/medium"],
  });

  const { data: allMaterials = [] } = useQuery<Material[]>({
    queryKey: ["/api/materials"],
  });

  const filteredMediumCategories = selectedLarge 
    ? mediumCategories.filter(m => m.largeCategoryId === selectedLarge)
    : [];

  const filteredMaterials = (() => {
    if (selectedMedium) {
      return allMaterials.filter(m => m.mediumCategoryId === selectedMedium);
    }
    if (selectedLarge) {
      return allMaterials.filter(m => m.largeCategoryId === selectedLarge);
    }
    return allMaterials;
  })();

  const createLargeCategoryMutation = useMutation({
    mutationFn: async (data: { name: string }) => {
      const res = await apiRequest("POST", "/api/material-categories/large", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/material-categories/large"] });
      setLargeCategoryDialogOpen(false);
      setLargeCategoryName("");
      toast({ title: "대분류가 추가되었습니다." });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "오류", description: error.message });
    },
  });

  const updateLargeCategoryMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const res = await apiRequest("PUT", `/api/material-categories/large/${id}`, { name });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/material-categories/large"] });
      setLargeCategoryDialogOpen(false);
      setLargeCategoryEditId(null);
      setLargeCategoryName("");
      toast({ title: "대분류가 수정되었습니다." });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "오류", description: error.message });
    },
  });

  const deleteLargeCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/material-categories/large/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/material-categories/large"] });
      setDeleteDialogOpen(false);
      if (selectedLarge === deleteCategoryId) {
        setSelectedLarge(null);
        setSelectedMedium(null);
      }
      toast({ title: "대분류가 삭제되었습니다." });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "오류", description: error.message });
    },
  });

  const createMediumCategoryMutation = useMutation({
    mutationFn: async (data: { largeCategoryId: string; name: string }) => {
      const res = await apiRequest("POST", "/api/material-categories/medium", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/material-categories/medium"] });
      setMediumCategoryDialogOpen(false);
      setMediumCategoryName("");
      toast({ title: "중분류가 추가되었습니다." });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "오류", description: error.message });
    },
  });

  const updateMediumCategoryMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const res = await apiRequest("PUT", `/api/material-categories/medium/${id}`, { name });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/material-categories/medium"] });
      setMediumCategoryDialogOpen(false);
      setMediumCategoryEditId(null);
      setMediumCategoryName("");
      toast({ title: "중분류가 수정되었습니다." });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "오류", description: error.message });
    },
  });

  const deleteMediumCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/material-categories/medium/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/material-categories/medium"] });
      setDeleteDialogOpen(false);
      if (selectedMedium === deleteCategoryId) {
        setSelectedMedium(null);
      }
      toast({ title: "중분류가 삭제되었습니다." });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "오류", description: error.message });
    },
  });

  const createMaterialMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/materials", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/materials"] });
      setMaterialDialogOpen(false);
      resetMaterialForm();
      toast({ title: "재료가 등록되었습니다." });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "오류", description: error.message });
    },
  });

  const updateMaterialMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PUT", `/api/materials/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/materials"] });
      setMaterialDialogOpen(false);
      setMaterialEditId(null);
      resetMaterialForm();
      toast({ title: "재료가 수정되었습니다." });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "오류", description: error.message });
    },
  });

  const bulkDeleteMaterialsMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await apiRequest("DELETE", "/api/materials/bulk", { ids });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/materials"] });
      setBulkDeleteDialogOpen(false);
      setSelectedIds([]);
      toast({ title: data.message });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "오류", description: error.message });
    },
  });

  const uploadMaterialsMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/materials/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "업로드 실패");
      }
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/materials"] });
      queryClient.invalidateQueries({ queryKey: ["/api/material-categories/large"] });
      queryClient.invalidateQueries({ queryKey: ["/api/material-categories/medium"] });
      
      let message = data.message;
      if (data.newLargeCategories > 0 || data.newMediumCategories > 0) {
        message += ` (신규 대분류 ${data.newLargeCategories}개, 중분류 ${data.newMediumCategories}개 생성)`;
      }
      toast({ title: message });
      
      if (data.errors && data.errors.length > 0) {
        setUploadErrors(data.errors);
        setUploadErrorsDialogOpen(true);
      }
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "오류", description: error.message });
    },
  });

  const resetMaterialForm = () => {
    setMaterialType("raw");
    setMaterialLargeCategoryId("");
    setMaterialMediumCategoryId("");
    setMaterialCode("");
    setMaterialName("");
    setMaterialStock("0");
  };

  const handleOpenLargeCategoryDialog = (category?: MaterialCategoryLarge) => {
    if (category) {
      setLargeCategoryEditId(category.id);
      setLargeCategoryName(category.name);
    } else {
      setLargeCategoryEditId(null);
      setLargeCategoryName("");
    }
    setLargeCategoryDialogOpen(true);
  };

  const handleOpenMediumCategoryDialog = (category?: MaterialCategoryMedium) => {
    if (category) {
      setMediumCategoryEditId(category.id);
      setMediumCategoryName(category.name);
    } else {
      setMediumCategoryEditId(null);
      setMediumCategoryName("");
    }
    setMediumCategoryDialogOpen(true);
  };

  const handleOpenMaterialDialog = (material?: Material) => {
    if (material) {
      setMaterialEditId(material.id);
      setMaterialType(material.materialType as MaterialType);
      setMaterialLargeCategoryId(material.largeCategoryId);
      setMaterialMediumCategoryId(material.mediumCategoryId);
      setMaterialCode(material.materialCode);
      setMaterialName(material.materialName);
      setMaterialStock(String(material.currentStock));
    } else {
      setMaterialEditId(null);
      resetMaterialForm();
      if (selectedLarge) setMaterialLargeCategoryId(selectedLarge);
      if (selectedMedium) setMaterialMediumCategoryId(selectedMedium);
    }
    setMaterialDialogOpen(true);
  };

  const handleSaveLargeCategory = () => {
    if (largeCategoryEditId) {
      updateLargeCategoryMutation.mutate({ id: largeCategoryEditId, name: largeCategoryName });
    } else {
      createLargeCategoryMutation.mutate({ name: largeCategoryName });
    }
  };

  const handleSaveMediumCategory = () => {
    if (!selectedLarge) return;
    if (mediumCategoryEditId) {
      updateMediumCategoryMutation.mutate({ id: mediumCategoryEditId, name: mediumCategoryName });
    } else {
      createMediumCategoryMutation.mutate({ largeCategoryId: selectedLarge, name: mediumCategoryName });
    }
  };

  const handleSaveMaterial = () => {
    if (materialEditId) {
      const updateData = {
        materialType,
        largeCategoryId: materialLargeCategoryId,
        mediumCategoryId: materialMediumCategoryId,
        materialName,
      };
      updateMaterialMutation.mutate({ id: materialEditId, data: updateData });
    } else {
      const createData = {
        materialType,
        largeCategoryId: materialLargeCategoryId,
        mediumCategoryId: materialMediumCategoryId,
        materialCode: materialCode || undefined,
        materialName,
        currentStock: parseFloat(materialStock) || 0,
      };
      createMaterialMutation.mutate(createData);
    }
  };

  const handleDeleteCategory = (type: "large" | "medium", id: string, name: string) => {
    setDeleteCategoryType(type);
    setDeleteCategoryId(id);
    setDeleteCategoryName(name);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteCategory = () => {
    if (!deleteCategoryId) return;
    if (deleteCategoryType === "large") {
      deleteLargeCategoryMutation.mutate(deleteCategoryId);
    } else {
      deleteMediumCategoryMutation.mutate(deleteCategoryId);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredMaterials.map(m => m.id));
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadMaterialsMutation.mutate(file);
    e.target.value = "";
  };

  const getLargeCategoryName = (id: string) => {
    return largeCategories.find(c => c.id === id)?.name || "";
  };

  const getMediumCategoryName = (id: string) => {
    return mediumCategories.find(c => c.id === id)?.name || "";
  };

  const availableMediumCategories = materialLargeCategoryId
    ? mediumCategories.filter(m => m.largeCategoryId === materialLargeCategoryId)
    : [];

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">재료 관리</h1>
          <p className="text-sm text-muted-foreground">원재료, 반재료, 부재료의 카테고리와 재료를 관리합니다.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.open("/api/materials/template", "_blank")} data-testid="button-download-template">
            <Download className="h-4 w-4 mr-2" /> 양식 다운로드
          </Button>
          <label>
            <Button variant="outline" asChild disabled={uploadMaterialsMutation.isPending}>
              <span>
                {uploadMaterialsMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                엑셀 일괄등록
              </span>
            </Button>
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileUpload} data-testid="input-file-upload" />
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              대분류
              <Button size="sm" variant="ghost" onClick={() => handleOpenLargeCategoryDialog()} data-testid="button-add-large-category">
                <Plus className="h-4 w-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            <ScrollArea className="h-[400px]">
              <div className="space-y-1">
                {largeCategories.map(category => (
                  <div
                    key={category.id}
                    className={`flex items-center justify-between px-3 py-2 rounded-md cursor-pointer text-sm ${
                      selectedLarge === category.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                    }`}
                    onClick={() => {
                      setSelectedLarge(selectedLarge === category.id ? null : category.id);
                      setSelectedMedium(null);
                    }}
                    data-testid={`large-category-${category.id}`}
                  >
                    <span className="truncate">{category.name}</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button size="icon" variant="ghost" className="h-6 w-6">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleOpenLargeCategoryDialog(category); }}>
                          <Pencil className="h-4 w-4 mr-2" /> 수정
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDeleteCategory("large", category.id, category.name); }} className="text-destructive">
                          <Trash2 className="h-4 w-4 mr-2" /> 삭제
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
                {largeCategories.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">대분류가 없습니다</p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              중분류
              <Button 
                size="sm" 
                variant="ghost" 
                disabled={!selectedLarge}
                onClick={() => handleOpenMediumCategoryDialog()}
                data-testid="button-add-medium-category"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            <ScrollArea className="h-[400px]">
              {!selectedLarge ? (
                <p className="text-sm text-muted-foreground text-center py-4">대분류를 선택해주세요</p>
              ) : filteredMediumCategories.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">중분류가 없습니다</p>
              ) : (
                <div className="space-y-1">
                  {filteredMediumCategories.map(category => (
                    <div
                      key={category.id}
                      className={`flex items-center justify-between px-3 py-2 rounded-md cursor-pointer text-sm ${
                        selectedMedium === category.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                      }`}
                      onClick={() => setSelectedMedium(selectedMedium === category.id ? null : category.id)}
                      data-testid={`medium-category-${category.id}`}
                    >
                      <span className="truncate">{category.name}</span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button size="icon" variant="ghost" className="h-6 w-6">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleOpenMediumCategoryDialog(category); }}>
                            <Pencil className="h-4 w-4 mr-2" /> 수정
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDeleteCategory("medium", category.id, category.name); }} className="text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" /> 삭제
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="lg:col-span-8">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              <span>재료 목록 ({filteredMaterials.length}개)</span>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => handleOpenMaterialDialog()} data-testid="button-add-material">
                  <Plus className="h-4 w-4 mr-1" /> 재료 등록
                </Button>
                <Button 
                  size="sm" 
                  variant="destructive" 
                  disabled={selectedIds.length === 0}
                  onClick={() => setBulkDeleteDialogOpen(true)}
                  data-testid="button-delete-selected"
                >
                  <Trash2 className="h-4 w-4 mr-1" /> 선택 삭제
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-auto" style={{ maxHeight: "420px" }}>
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left w-10">
                      <Checkbox
                        checked={selectedIds.length === filteredMaterials.length && filteredMaterials.length > 0}
                        onCheckedChange={handleSelectAll}
                        data-testid="checkbox-select-all"
                      />
                    </th>
                    <th className="px-3 py-2 text-left">타입</th>
                    <th className="px-3 py-2 text-left">대분류</th>
                    <th className="px-3 py-2 text-left">중분류</th>
                    <th className="px-3 py-2 text-left">재료코드</th>
                    <th className="px-3 py-2 text-left">재료명</th>
                    <th className="px-3 py-2 text-right">현재재고</th>
                    <th className="px-3 py-2 text-center w-16">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMaterials.map((material, idx) => {
                    const isSelected = selectedIds.includes(material.id);
                    return (
                      <tr
                        key={material.id}
                        className={isSelected ? "bg-blue-50" : idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
                        data-testid={`row-material-${material.id}`}
                      >
                        <td className="px-3 py-2">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => handleSelectOne(material.id, !!checked)}
                          />
                        </td>
                        <td className="px-3 py-2">{materialTypeLabels[material.materialType as MaterialType]}</td>
                        <td className="px-3 py-2">{getLargeCategoryName(material.largeCategoryId)}</td>
                        <td className="px-3 py-2">{getMediumCategoryName(material.mediumCategoryId)}</td>
                        <td className="px-3 py-2 font-mono">{material.materialCode}</td>
                        <td className="px-3 py-2">{material.materialName}</td>
                        <td className="px-3 py-2 text-right">{material.currentStock.toFixed(1)}</td>
                        <td className="px-3 py-2 text-center">
                          <Button size="sm" variant="ghost" onClick={() => handleOpenMaterialDialog(material)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredMaterials.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-muted-foreground">
                        재료가 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={largeCategoryDialogOpen} onOpenChange={setLargeCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{largeCategoryEditId ? "대분류 수정" : "대분류 추가"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>대분류명</Label>
              <Input
                value={largeCategoryName}
                onChange={(e) => setLargeCategoryName(e.target.value)}
                placeholder="예: 사과, 배, 부재료"
                data-testid="input-large-category-name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLargeCategoryDialogOpen(false)}>취소</Button>
            <Button onClick={handleSaveLargeCategory} disabled={!largeCategoryName.trim()}>
              {largeCategoryEditId ? "저장" : "추가"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={mediumCategoryDialogOpen} onOpenChange={setMediumCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{mediumCategoryEditId ? "중분류 수정" : "중분류 추가"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>대분류</Label>
              <Input value={getLargeCategoryName(selectedLarge || "")} disabled />
            </div>
            <div>
              <Label>중분류명</Label>
              <Input
                value={mediumCategoryName}
                onChange={(e) => setMediumCategoryName(e.target.value)}
                placeholder="예: 부사, 홍로, 박스"
                data-testid="input-medium-category-name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMediumCategoryDialogOpen(false)}>취소</Button>
            <Button onClick={handleSaveMediumCategory} disabled={!mediumCategoryName.trim()}>
              {mediumCategoryEditId ? "저장" : "추가"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={materialDialogOpen} onOpenChange={setMaterialDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{materialEditId ? "재료 수정" : "재료 등록"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>재료타입</Label>
              <Select value={materialType} onValueChange={(v) => setMaterialType(v as MaterialType)}>
                <SelectTrigger data-testid="select-material-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="raw">원재료</SelectItem>
                  <SelectItem value="semi">반재료</SelectItem>
                  <SelectItem value="sub">부재료</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>대분류</Label>
              <Select value={materialLargeCategoryId} onValueChange={(v) => { setMaterialLargeCategoryId(v); setMaterialMediumCategoryId(""); }}>
                <SelectTrigger data-testid="select-material-large-category">
                  <SelectValue placeholder="대분류 선택" />
                </SelectTrigger>
                <SelectContent>
                  {largeCategories.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>중분류</Label>
              <Select value={materialMediumCategoryId} onValueChange={setMaterialMediumCategoryId} disabled={!materialLargeCategoryId}>
                <SelectTrigger data-testid="select-material-medium-category">
                  <SelectValue placeholder="중분류 선택" />
                </SelectTrigger>
                <SelectContent>
                  {availableMediumCategories.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>재료코드 {!materialEditId && "(미입력 시 자동생성)"}</Label>
              <Input
                value={materialCode}
                onChange={(e) => setMaterialCode(e.target.value)}
                placeholder="예: R001"
                disabled={!!materialEditId}
                data-testid="input-material-code"
              />
            </div>
            <div>
              <Label>재료명</Label>
              <Input
                value={materialName}
                onChange={(e) => setMaterialName(e.target.value)}
                placeholder="예: 부사 정품 4다이(원물)"
                data-testid="input-material-name"
              />
            </div>
            <div>
              <Label>재고</Label>
              {!materialEditId ? (
                <Input
                  type="number"
                  step="0.1"
                  value={materialStock}
                  onChange={(e) => setMaterialStock(e.target.value)}
                  placeholder="초기재고 (기본: 0)"
                  data-testid="input-material-stock"
                />
              ) : (
                <p className="text-sm text-muted-foreground py-2">{parseFloat(materialStock).toFixed(1)} (입고 관리 페이지에서 변경)</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMaterialDialogOpen(false)}>취소</Button>
            <Button 
              onClick={handleSaveMaterial} 
              disabled={!materialLargeCategoryId || !materialMediumCategoryId || !materialName.trim()}
            >
              {materialEditId ? "저장" : "등록"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deleteCategoryType === "large" ? "대분류" : "중분류"} 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteCategoryName}" {deleteCategoryType === "large" ? "대분류" : "중분류"}를 삭제하시겠습니까?
              {deleteCategoryType === "large" && (
                <>
                  <br /><br />
                  <span className="text-destructive font-medium">하위 중분류와 재료도 함께 삭제됩니다.</span>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteCategory} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>재료 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              선택한 {selectedIds.length}개 재료를 삭제하시겠습니까?
              <br /><br />
              <span className="text-destructive font-medium">삭제된 재료는 복구할 수 없습니다.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => bulkDeleteMaterialsMutation.mutate(selectedIds)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {bulkDeleteMaterialsMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={uploadErrorsDialogOpen} onOpenChange={setUploadErrorsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>업로드 오류</DialogTitle>
            <DialogDescription>
              일부 행은 등록되지 않았습니다. ({uploadErrors.length}개 오류)
            </DialogDescription>
          </DialogHeader>
          <div className="bg-destructive/10 p-3 rounded-md max-h-60 overflow-auto">
            <p className="text-sm font-medium text-destructive mb-2">오류 목록</p>
            {uploadErrors.map((err, i) => (
              <p key={i} className="text-sm text-destructive">행 {err.row}: {err.error}</p>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={() => setUploadErrorsDialogOpen(false)}>확인</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
