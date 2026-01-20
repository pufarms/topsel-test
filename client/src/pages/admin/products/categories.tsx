import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Plus, Pencil, Trash2, FolderTree, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { PageHeader, FilterSection, FilterField, DataTable, MobileCard, MobileCardField, MobileCardsList, type Column } from "@/components/admin";
import type { Category } from "@shared/schema";

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
  const [activeTab, setActiveTab] = useState<"large" | "medium" | "small">("large");
  const [searchTerm, setSearchTerm] = useState("");
  const [parentFilter, setParentFilter] = useState<string>("all");
  const [grandparentFilter, setGrandparentFilter] = useState<string>("all");
  const [showDialog, setShowDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<EnrichedCategory | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: categories = [], isLoading } = useQuery<EnrichedCategory[]>({
    queryKey: ["/api/categories"],
  });

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

  const closeDialog = () => {
    setShowDialog(false);
    setEditingCategory(null);
    form.reset({ name: "", level: activeTab, parentId: null });
  };

  const openCreateDialog = () => {
    form.reset({ name: "", level: activeTab, parentId: null });
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

  const getFilteredCategories = () => {
    let filtered = categories.filter(c => c.level === activeTab);
    
    if (searchTerm) {
      filtered = filtered.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    
    if (activeTab === "medium" && parentFilter !== "all") {
      filtered = filtered.filter(c => c.parentId === parentFilter);
    }
    
    if (activeTab === "small") {
      if (grandparentFilter !== "all") {
        const mediumIds = mediumCategories.filter(m => m.parentId === grandparentFilter).map(m => m.id);
        filtered = filtered.filter(c => c.parentId && mediumIds.includes(c.parentId));
      }
      if (parentFilter !== "all") {
        filtered = filtered.filter(c => c.parentId === parentFilter);
      }
    }
    
    return filtered;
  };

  const filteredCategories = getFilteredCategories();

  const getMediumOptionsForSmall = () => {
    if (grandparentFilter !== "all") {
      return mediumCategories.filter(m => m.parentId === grandparentFilter);
    }
    return mediumCategories;
  };

  const largeColumns: Column<EnrichedCategory>[] = [
    { key: "name", label: "분류명", render: (c) => <span className="font-medium">{c.name}</span> },
    { key: "createdAt", label: "등록일", render: (c) => formatDate(c.createdAt) },
    { key: "childCount", label: "중분류 수", className: "text-center" },
    { key: "productCount", label: "상품 수", className: "text-center" },
    {
      key: "actions",
      label: "관리",
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

  const mediumColumns: Column<EnrichedCategory>[] = [
    { key: "name", label: "분류명", render: (c) => <span className="font-medium">{c.name}</span> },
    { key: "parentName", label: "상위분류" },
    { key: "createdAt", label: "등록일", render: (c) => formatDate(c.createdAt) },
    { key: "childCount", label: "소분류 수", className: "text-center" },
    { key: "productCount", label: "상품 수", className: "text-center" },
    {
      key: "actions",
      label: "관리",
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

  const smallColumns: Column<EnrichedCategory>[] = [
    { key: "name", label: "분류명", render: (c) => <span className="font-medium">{c.name}</span> },
    { key: "grandparentName", label: "대분류" },
    { key: "parentName", label: "중분류" },
    { key: "createdAt", label: "등록일", render: (c) => formatDate(c.createdAt) },
    { key: "productCount", label: "상품 수", className: "text-center" },
    {
      key: "actions",
      label: "관리",
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
          <Button size="sm" onClick={openCreateDialog} data-testid="button-add-category">
            <Plus className="h-4 w-4 mr-1" />
            카테고리 추가
          </Button>
        }
      />

      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as any); setParentFilter("all"); setGrandparentFilter("all"); }}>
        <TabsList>
          <TabsTrigger value="large" data-testid="tab-large">대분류 ({largeCategories.length})</TabsTrigger>
          <TabsTrigger value="medium" data-testid="tab-medium">중분류 ({mediumCategories.length})</TabsTrigger>
          <TabsTrigger value="small" data-testid="tab-small">소분류 ({smallCategories.length})</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-3 space-y-3">
          <FilterSection onReset={() => { setSearchTerm(""); setParentFilter("all"); setGrandparentFilter("all"); }}>
            {activeTab === "small" && (
              <FilterField label="대분류">
                <Select value={grandparentFilter} onValueChange={setGrandparentFilter}>
                  <SelectTrigger className="h-9" data-testid="select-grandparent">
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
            )}
            {(activeTab === "medium" || activeTab === "small") && (
              <FilterField label={activeTab === "medium" ? "대분류" : "중분류"}>
                <Select value={parentFilter} onValueChange={setParentFilter}>
                  <SelectTrigger className="h-9" data-testid="select-parent">
                    <SelectValue placeholder="전체" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체</SelectItem>
                    {(activeTab === "medium" ? largeCategories : getMediumOptionsForSmall()).map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterField>
            )}
            <FilterField label="검색">
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
              columns={activeTab === "large" ? largeColumns : activeTab === "medium" ? mediumColumns : smallColumns}
              data={filteredCategories}
              keyField="id"
              emptyMessage="등록된 카테고리가 없습니다"
            />
          </div>

          <MobileCardsList>
            {filteredCategories.map((cat) => (
              <MobileCard key={cat.id} testId={`card-category-${cat.id}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{cat.name}</span>
                  <Badge variant="secondary">{cat.productCount}개 상품</Badge>
                </div>
                {cat.parentName && (
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
        </TabsContent>
      </Tabs>

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
                              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
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
                      <Input placeholder="분류명 입력" {...field} data-testid="input-category-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeDialog}>취소</Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit">
                  {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingCategory ? "수정" : "추가"}
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
              이 카테고리를 삭제하시겠습니까? 하위 분류나 연결된 상품이 있으면 삭제할 수 없습니다.
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
