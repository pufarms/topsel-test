import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, MoreHorizontal, Pencil, Trash2, Loader2, Package, RefreshCw } from "lucide-react";
import type { MaterialTypeRecord } from "@shared/schema";

function generateCode(name: string, existingCodes: string[]): string {
  const baseCode = name
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]/g, '')
    .slice(0, 10);
  
  if (baseCode && !existingCodes.includes(baseCode)) {
    return baseCode;
  }
  
  const timestamp = Date.now().toString(36).slice(-4);
  const randomCode = `type_${timestamp}`;
  
  if (!existingCodes.includes(randomCode)) {
    return randomCode;
  }
  
  return `type_${Date.now().toString(36)}`;
}

export default function MaterialTypesPage() {
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [isActive, setIsActive] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteName, setDeleteName] = useState("");
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [autoCodeEnabled, setAutoCodeEnabled] = useState(true);

  const { data: materialTypes = [], isLoading } = useQuery<MaterialTypeRecord[]>({
    queryKey: ["/api/material-types"],
  });

  const existingCodes = materialTypes.map(t => t.code);

  useEffect(() => {
    if (!editId && autoCodeEnabled && name.trim()) {
      const newCode = generateCode(name.trim(), existingCodes);
      setCode(newCode);
    }
  }, [name, editId, autoCodeEnabled, existingCodes]);

  const createMutation = useMutation({
    mutationFn: async (data: { code: string; name: string; description: string; sortOrder: number; isActive: boolean }) => {
      const res = await apiRequest("POST", "/api/material-types", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/material-types"] });
      toast({ title: "재료타입이 등록되었습니다" });
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "등록 실패", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<{ code: string; name: string; description: string; sortOrder: number; isActive: boolean }> }) => {
      const res = await apiRequest("PUT", `/api/material-types/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/material-types"] });
      toast({ title: "재료타입이 수정되었습니다" });
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "수정 실패", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/material-types/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/material-types"] });
      toast({ title: "재료타입이 삭제되었습니다" });
      setDeleteDialogOpen(false);
      setDeleteId(null);
    },
    onError: (error: Error) => {
      toast({ title: "삭제 실패", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setDialogOpen(false);
    setEditId(null);
    setCode("");
    setName("");
    setDescription("");
    setSortOrder("0");
    setIsActive(true);
    setAutoCodeEnabled(true);
  };

  const regenerateCode = () => {
    if (name.trim()) {
      const newCode = generateCode(name.trim(), existingCodes);
      setCode(newCode);
    } else {
      const newCode = `type_${Date.now().toString(36).slice(-6)}`;
      setCode(newCode);
    }
  };

  const openEdit = (type: MaterialTypeRecord) => {
    setEditId(type.id);
    setCode(type.code);
    setName(type.name);
    setDescription(type.description || "");
    setSortOrder(String(type.sortOrder));
    setIsActive(type.isActive);
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!code.trim() || !name.trim()) {
      toast({ title: "코드와 이름은 필수입니다", variant: "destructive" });
      return;
    }
    if (editId) {
      const updateData = {
        name: name.trim(),
        description: description.trim(),
        sortOrder: parseInt(sortOrder) || 0,
        isActive,
      };
      updateMutation.mutate({ id: editId, data: updateData });
    } else {
      const createData = {
        code: code.trim(),
        name: name.trim(),
        description: description.trim(),
        sortOrder: parseInt(sortOrder) || 0,
        isActive,
      };
      createMutation.mutate(createData);
    }
  };

  const handleDelete = (type: MaterialTypeRecord) => {
    setDeleteId(type.id);
    setDeleteName(type.name);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (deleteId) {
      deleteMutation.mutate(deleteId);
    }
  };

  const handleBulkDelete = async () => {
    for (const id of selectedIds) {
      await deleteMutation.mutateAsync(id);
    }
    setSelectedIds([]);
    setBulkDeleteDialogOpen(false);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === materialTypes.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(materialTypes.map(t => t.id));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Package className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold">재료타입 관리</h1>
            <p className="text-sm text-muted-foreground">재료 분류에 사용되는 타입을 관리합니다</p>
          </div>
        </div>
        <div className="flex gap-2">
          {selectedIds.length > 0 && (
            <Button 
              variant="destructive" 
              size="sm"
              onClick={() => setBulkDeleteDialogOpen(true)}
              data-testid="button-bulk-delete"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              {selectedIds.length}개 삭제
            </Button>
          )}
          <Button onClick={() => setDialogOpen(true)} data-testid="button-add-material-type">
            <Plus className="h-4 w-4 mr-1" />
            재료타입 등록
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">재료타입 목록 ({materialTypes.length}건)</CardTitle>
        </CardHeader>
        <CardContent className="overflow-hidden">
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox 
                      checked={selectedIds.length === materialTypes.length && materialTypes.length > 0}
                      onCheckedChange={toggleSelectAll}
                      data-testid="checkbox-select-all"
                    />
                  </TableHead>
                  <TableHead>코드</TableHead>
                  <TableHead>이름</TableHead>
                  <TableHead>설명</TableHead>
                  <TableHead className="text-center">정렬순서</TableHead>
                  <TableHead className="text-center">활성화</TableHead>
                  <TableHead className="text-right">관리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {materialTypes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                      등록된 재료타입이 없습니다
                    </TableCell>
                  </TableRow>
                ) : (
                  materialTypes.map((type) => (
                    <TableRow key={type.id}>
                      <TableCell>
                        <Checkbox 
                          checked={selectedIds.includes(type.id)}
                          onCheckedChange={() => toggleSelect(type.id)}
                          data-testid={`checkbox-select-${type.id}`}
                        />
                      </TableCell>
                      <TableCell className="font-mono">{type.code}</TableCell>
                      <TableCell className="font-medium">{type.name}</TableCell>
                      <TableCell className="text-muted-foreground max-w-[200px] truncate">
                        {type.description || "-"}
                      </TableCell>
                      <TableCell className="text-center">{type.sortOrder}</TableCell>
                      <TableCell className="text-center">
                        <Switch 
                          checked={type.isActive}
                          onCheckedChange={(checked) => {
                            updateMutation.mutate({ id: type.id, data: { isActive: checked } });
                          }}
                          data-testid={`switch-active-${type.id}`}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" data-testid={`button-actions-${type.id}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(type)} data-testid={`menu-edit-${type.id}`}>
                              <Pencil className="h-4 w-4 mr-2" />
                              수정
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDelete(type)} 
                              className="text-destructive"
                              data-testid={`menu-delete-${type.id}`}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              삭제
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? "재료타입 수정" : "재료타입 등록"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>이름 *</Label>
              <Input 
                value={name} 
                onChange={(e) => setName(e.target.value)}
                placeholder="예: 원재료, 반재료, 부재료"
                data-testid="input-name"
              />
              <p className="text-xs text-muted-foreground mt-1">화면에 표시되는 이름</p>
            </div>
            <div>
              <Label>코드 {!editId && "(자동생성)"}</Label>
              <div className="flex gap-2">
                <Input 
                  value={code} 
                  onChange={(e) => {
                    setCode(e.target.value);
                    setAutoCodeEnabled(false);
                  }}
                  placeholder="자동 생성됨"
                  disabled={!!editId}
                  className={editId ? "bg-muted flex-1" : "flex-1"}
                  data-testid="input-code"
                />
                {!editId && (
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="icon"
                    onClick={regenerateCode}
                    title="코드 재생성"
                    data-testid="button-regenerate-code"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {editId 
                  ? "코드는 수정할 수 없습니다 (기존 재료 데이터 보호)" 
                  : "이름 입력 시 자동 생성됩니다 (직접 수정도 가능)"}
              </p>
            </div>
            <div>
              <Label>설명</Label>
              <Textarea 
                value={description} 
                onChange={(e) => setDescription(e.target.value)}
                placeholder="재료타입에 대한 설명 (선택)"
                data-testid="input-description"
              />
            </div>
            <div>
              <Label>정렬순서</Label>
              <Input 
                type="number"
                value={sortOrder} 
                onChange={(e) => setSortOrder(e.target.value)}
                data-testid="input-sort-order"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch 
                checked={isActive} 
                onCheckedChange={setIsActive}
                data-testid="switch-is-active"
              />
              <Label>활성화</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm} data-testid="button-cancel">
              취소
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-submit"
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              )}
              {editId ? "수정" : "등록"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>재료타입 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteName}" 재료타입을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-delete-cancel">취소</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-delete-confirm"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>일괄 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              선택한 {selectedIds.length}개의 재료타입을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-bulk-delete-cancel">취소</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-bulk-delete-confirm"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
