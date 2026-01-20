import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import * as XLSX from "xlsx";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Plus, Pencil, Trash2, FolderTree, Search, Upload, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { PageHeader, FilterSection, FilterField, DataTable, MobileCard, MobileCardField, MobileCardsList, type Column } from "@/components/admin";
import type { Category, ProductRegistration } from "@shared/schema";

interface EnrichedCategory extends Category {
  childCount: number;
  productCount: number;
  parentName: string | null;
  grandparentName: string | null;
}

const categoryFormSchema = z.object({
  name: z.string().min(1, "분류명을 입력해주세요"),
  level: z.enum(["large", "medium", "small"]),
  parentId: z.string().nullable().optional(),
});

type CategoryForm = z.infer<typeof categoryFormSchema>;

export default function CategoryManagement() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [largeFilter, setLargeFilter] = useState<string>("all");
  const [mediumFilter, setMediumFilter] = useState<string>("all");
  const [smallFilter, setSmallFilter] = useState<string>("all");
  const [weightFilter, setWeightFilter] = useState<string>("all");
  const [showDialog, setShowDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<EnrichedCategory | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: categories = [], isLoading } = useQuery<EnrichedCategory[]>({
    queryKey: ["/api/categories"],
  });

  const { data: productRegistrations = [] } = useQuery<ProductRegistration[]>({
    queryKey: ["/api/product-registrations"],
  });

  const uniqueWeights = Array.from(new Set(productRegistrations.map(p => p.weight).filter(w => w && w !== ""))).sort((a, b) => parseFloat(a) - parseFloat(b));

  const largeCategories = categories.filter(c => c.level === "large");
  const mediumCategories = categories.filter(c => c.level === "medium");
  const smallCategories = categories.filter(c => c.level === "small");

  const form = useForm<CategoryForm>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: "",
      level: "large",
      parentId: null,
    },
  });

  const watchedLevel = form.watch("level");
  const watchedParentId = form.watch("parentId");

  const createMutation = useMutation({
    mutationFn: async (data: CategoryForm) => {
      await apiRequest("POST", "/api/categories", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      toast({ title: "등록 완료", description: "카테고리가 등록되었습니다." });
      closeDialog();
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "오류", description: error.message || "등록에 실패했습니다." });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CategoryForm> }) => {
      await apiRequest("PUT", `/api/categories/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      toast({ title: "수정 완료", description: "카테고리가 수정되었습니다." });
      closeDialog();
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "오류", description: error.message || "수정에 실패했습니다." });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/categories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      toast({ title: "삭제 완료", description: "카테고리가 삭제되었습니다." });
      setDeleteId(null);
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "삭제 실패", description: error.message });
      setDeleteId(null);
    },
  });

  const bulkUploadMutation = useMutation({
    mutationFn: async (cats: Array<{ large: string; medium?: string; small?: string }>) => {
      const res = await apiRequest("POST", "/api/categories/bulk", { categories: cats });
      return res.json();
    },
    onSuccess: (data: { created: number; skipped: number; message: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      toast({ title: "일괄 등록 완료", description: data.message });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "일괄 등록 실패", description: error.message });
    },
  });

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<any>(sheet);

        const cats: Array<{ large: string; medium?: string; small?: string }> = [];
        for (const row of rows) {
          const large = row["대분류"] || row["large"] || "";
          const medium = row["중분류"] || row["medium"] || "";
          const small = row["소분류"] || row["small"] || "";
          if (large) {
            cats.push({ large, medium: medium || undefined, small: small || undefined });
          }
        }

        if (cats.length === 0) {
          toast({ variant: "destructive", title: "오류", description: "유효한 카테고리 데이터가 없습니다" });
          return;
        }

        bulkUploadMutation.mutate(cats);
      } catch (err) {
        toast({ variant: "destructive", title: "파일 오류", description: "엑셀 파일을 읽을 수 없습니다" });
      }
    };
    reader.readAsArrayBuffer(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["대분류", "중분류", "소분류"],
      ["과일", "국산과일", "사과"],
      ["과일", "국산과일", "배"],
      ["과일", "수입과일", "바나나"],
      ["채소", "엽채류", "상추"],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "카테고리");
    XLSX.writeFile(wb, "카테고리_양식.xlsx");
  };

  const closeDialog = () => {
    setShowDialog(false);
    setEditingCategory(null);
    form.reset({ name: "", level: "large", parentId: null });
  };

  const openCreateDialog = () => {
    form.reset({ name: "", level: "large", parentId: null });
    setShowDialog(true);
  };

  const openEditDialog = (cat: EnrichedCategory) => {
    setEditingCategory(cat);
    form.reset({ name: cat.name, level: cat.level as "large" | "medium" | "small", parentId: cat.parentId });
    setShowDialog(true);
  };

  const onSubmit = (data: CategoryForm) => {
    if (editingCategory) {
      updateMutation.mutate({ id: editingCategory.id, data: { name: data.name } });
    } else {
      createMutation.mutate(data);
    }
  };

  const formatDate = (date: Date | string) => new Date(date).toLocaleDateString("ko-KR");

  const getLevelLabel = (level: string) => {
    switch (level) {
      case "large": return "대분류";
      case "medium": return "중분류";
      case "small": return "소분류";
      default: return level;
    }
  };

  const getFilteredMediumCategories = () => {
    if (largeFilter === "all") return mediumCategories;
    return mediumCategories.filter(m => m.parentId === largeFilter);
  };

  const getFilteredSmallCategories = () => {
    let filtered = smallCategories;
    if (largeFilter !== "all") {
      const mediumIds = mediumCategories.filter(m => m.parentId === largeFilter).map(m => m.id);
      filtered = filtered.filter(s => s.parentId && mediumIds.includes(s.parentId));
    }
    if (mediumFilter !== "all") {
      filtered = filtered.filter(s => s.parentId === mediumFilter);
    }
    return filtered;
  };

  const getFilteredCategories = () => {
    let filtered = [...categories];
    
    if (largeFilter !== "all") {
      filtered = filtered.filter(c => {
        if (c.level === "large") return c.id === largeFilter;
        if (c.level === "medium") return c.parentId === largeFilter;
        if (c.level === "small") {
          const mediumIds = mediumCategories.filter(m => m.parentId === largeFilter).map(m => m.id);
          return c.parentId && mediumIds.includes(c.parentId);
        }
        return true;
      });
    }
    
    if (mediumFilter !== "all") {
      filtered = filtered.filter(c => {
        if (c.level === "large") return false;
        if (c.level === "medium") return c.id === mediumFilter;
        if (c.level === "small") return c.parentId === mediumFilter;
        return true;
      });
    }
    
    if (smallFilter !== "all") {
      filtered = filtered.filter(c => c.level === "small" && c.id === smallFilter);
    }
    
    if (weightFilter !== "all") {
      const productsWithWeight = productRegistrations.filter(p => p.weight === weightFilter);
      const categoryNames = new Set<string>();
      productsWithWeight.forEach(p => {
        if (p.categoryLarge) categoryNames.add(p.categoryLarge);
        if (p.categoryMedium) categoryNames.add(p.categoryMedium);
        if (p.categorySmall) categoryNames.add(p.categorySmall);
      });
      filtered = filtered.filter(c => categoryNames.has(c.name));
    }
    
    if (searchTerm) {
      filtered = filtered.filter(c => 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.parentName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.grandparentName?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    filtered.sort((a, b) => {
      const levelOrder = { large: 0, medium: 1, small: 2 };
      const aOrder = levelOrder[a.level as keyof typeof levelOrder] ?? 3;
      const bOrder = levelOrder[b.level as keyof typeof levelOrder] ?? 3;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.name.localeCompare(b.name, 'ko');
    });
    
    return filtered;
  };

  const filteredCategories = getFilteredCategories();

  const handleResetFilters = () => {
    setSearchTerm("");
    setLargeFilter("all");
    setMediumFilter("all");
    setSmallFilter("all");
    setWeightFilter("all");
  };

  const columns: Column<EnrichedCategory>[] = [
    { 
      key: "level", 
      label: "구분", 
      className: "w-20",
      render: (c) => (
        <Badge variant={c.level === "large" ? "default" : c.level === "medium" ? "secondary" : "outline"}>
          {getLevelLabel(c.level)}
        </Badge>
      )
    },
    { 
      key: "grandparentName", 
      label: "대분류",
      render: (c) => c.level === "large" ? c.name : (c.grandparentName || c.parentName || "-")
    },
    { 
      key: "parentName", 
      label: "중분류",
      render: (c) => c.level === "medium" ? c.name : (c.level === "small" ? c.parentName : "-") || "-"
    },
    { 
      key: "name", 
      label: "소분류",
      render: (c) => c.level === "small" ? <span className="font-medium">{c.name}</span> : "-"
    },
    { key: "childCount", label: "하위분류 수", className: "text-center w-24" },
    { key: "productCount", label: "상품 수", className: "text-center w-20" },
    { key: "createdAt", label: "등록일", render: (c) => formatDate(c.createdAt), className: "w-24" },
    {
      key: "actions",
      label: "관리",
      className: "w-20",
      render: (c) => (
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => openEditDialog(c)} data-testid={`button-edit-${c.id}`}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setDeleteId(c.id)} data-testid={`button-delete-${c.id}`}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4">
      <PageHeader
        title="카테고리 관리"
        description="상품의 대분류/중분류/소분류 카테고리를 관리합니다"
        icon={FolderTree}
        actions={
          <div className="flex gap-2 flex-wrap">
            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx,.xls"
              onChange={handleExcelUpload}
              className="hidden"
              data-testid="input-excel-file"
            />
            <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={bulkUploadMutation.isPending} data-testid="button-excel-upload">
              {bulkUploadMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
              엑셀 업로드
            </Button>
            <Button size="sm" variant="outline" onClick={downloadTemplate} data-testid="button-download-template">
              <Download className="h-4 w-4 mr-1" />
              양식 다운로드
            </Button>
            <Button size="sm" onClick={openCreateDialog} data-testid="button-add-category">
              <Plus className="h-4 w-4 mr-1" />
              카테고리 추가
            </Button>
          </div>
        }
      />

      <FilterSection onReset={handleResetFilters}>
        <FilterField label="대분류">
          <Select value={largeFilter} onValueChange={(v) => { setLargeFilter(v); setMediumFilter("all"); setSmallFilter("all"); }}>
            <SelectTrigger className="h-9" data-testid="select-large">
              <SelectValue placeholder="전체" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              {largeCategories.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label="중분류">
          <Select value={mediumFilter} onValueChange={(v) => { setMediumFilter(v); setSmallFilter("all"); }}>
            <SelectTrigger className="h-9" data-testid="select-medium">
              <SelectValue placeholder="전체" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              {getFilteredMediumCategories().map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label="소분류">
          <Select value={smallFilter} onValueChange={setSmallFilter}>
            <SelectTrigger className="h-9" data-testid="select-small">
              <SelectValue placeholder="전체" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              {getFilteredSmallCategories().map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label="중량">
          <Select value={weightFilter} onValueChange={setWeightFilter}>
            <SelectTrigger className="h-9" data-testid="select-weight">
              <SelectValue placeholder="전체" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              {uniqueWeights.map((w) => (
                <SelectItem key={w} value={w}>{w}kg</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label="검색어 입력">
          <div className="flex gap-2">
            <Input
              placeholder="분류명 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9"
              data-testid="input-search"
            />
          </div>
        </FilterField>
      </FilterSection>

      <div className="hidden lg:block">
        <DataTable
          title={`총 ${filteredCategories.length}건`}
          columns={columns}
          data={filteredCategories}
          keyField="id"
          emptyMessage="등록된 카테고리가 없습니다"
        />
      </div>

      <MobileCardsList>
        {filteredCategories.map((cat) => (
          <MobileCard key={cat.id} testId={`card-category-${cat.id}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Badge variant={cat.level === "large" ? "default" : cat.level === "medium" ? "secondary" : "outline"}>
                  {getLevelLabel(cat.level)}
                </Badge>
                <span className="font-medium">{cat.name}</span>
              </div>
              <Badge variant="secondary">{cat.productCount}개 상품</Badge>
            </div>
            {(cat.parentName || cat.grandparentName) && (
              <p className="text-xs text-muted-foreground mb-2">
                {cat.grandparentName && `${cat.grandparentName} > `}{cat.parentName}
              </p>
            )}
            <div className="flex justify-between items-center">
              <MobileCardField label="등록일" value={formatDate(cat.createdAt)} />
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => openEditDialog(cat)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setDeleteId(cat.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          </MobileCard>
        ))}
        {filteredCategories.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">등록된 카테고리가 없습니다</div>
        )}
      </MobileCardsList>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategory ? "카테고리 수정" : "카테고리 추가"}</DialogTitle>
            <DialogDescription>
              {editingCategory ? "카테고리 이름을 수정합니다" : "새로운 카테고리를 추가합니다"}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {!editingCategory && (
                <FormField
                  control={form.control}
                  name="level"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>분류 단계</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex gap-4"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="large" id="large" />
                            <label htmlFor="large">대분류</label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="medium" id="medium" />
                            <label htmlFor="medium">중분류</label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="small" id="small" />
                            <label htmlFor="small">소분류</label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {!editingCategory && watchedLevel === "medium" && (
                <FormField
                  control={form.control}
                  name="parentId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>상위 대분류</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                        <FormControl>
                          <SelectTrigger data-testid="select-parent-large">
                            <SelectValue placeholder="대분류 선택" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {largeCategories.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {!editingCategory && watchedLevel === "small" && (
                <>
                  <FormItem>
                    <FormLabel>상위 대분류</FormLabel>
                    <Select 
                      value={largeCategories.find(l => mediumCategories.find(m => m.id === watchedParentId)?.parentId === l.id)?.id || ""}
                      onValueChange={(val) => {
                        const firstMedium = mediumCategories.find(m => m.parentId === val);
                        if (firstMedium) form.setValue("parentId", firstMedium.id);
                      }}
                    >
                      <SelectTrigger data-testid="select-parent-large-for-small">
                        <SelectValue placeholder="대분류 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {largeCategories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                  <FormField
                    control={form.control}
                    name="parentId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>상위 중분류</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                          <FormControl>
                            <SelectTrigger data-testid="select-parent-medium">
                              <SelectValue placeholder="중분류 선택" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {mediumCategories.map((c) => (
                              <SelectItem key={c.id} value={c.id}>{c.name} ({largeCategories.find(l => l.id === c.parentId)?.name})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>분류명</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="분류명 입력" data-testid="input-category-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeDialog}>취소</Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit-category">
                  {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  {editingCategory ? "수정" : "등록"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>카테고리 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              이 카테고리를 삭제하시겠습니까? 하위 카테고리가 있는 경우 삭제할 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
