import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Pencil, Trash2, Building2, Check, X } from "lucide-react";

interface Vendor {
  id: number;
  companyName: string;
  isActive: boolean | null;
}

interface ProductVendorMapping {
  id: number;
  productCode: string;
  vendorId: number;
  vendorPrice: number;
  isActive: boolean | null;
  memo: string | null;
  updatedAt: string;
  vendorName: string;
}

interface ProductVendorSectionProps {
  productCode: string;
  productName: string;
  isVendorProduct?: boolean;
  onVendorProductChange?: (checked: boolean) => void;
}

export function ProductVendorSection({
  productCode,
  productName,
  isVendorProduct = false,
  onVendorProductChange,
}: ProductVendorSectionProps) {
  const { toast } = useToast();
  const [showSection, setShowSection] = useState(isVendorProduct);
  const [selectedVendorId, setSelectedVendorId] = useState<string>("");
  const [vendorPrice, setVendorPrice] = useState("");
  const [vendorMemo, setVendorMemo] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [editMemo, setEditMemo] = useState("");

  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: ["/api/admin/vendors", "active"],
    queryFn: async () => {
      const res = await fetch("/api/admin/vendors?isActive=true");
      if (!res.ok) throw new Error("업체 조회 실패");
      return res.json();
    },
  });

  const { data: mappings = [], isLoading } = useQuery<ProductVendorMapping[]>({
    queryKey: ["/api/admin/product-vendors", productCode],
    queryFn: async () => {
      const res = await fetch(`/api/admin/product-vendors/${encodeURIComponent(productCode)}`);
      if (!res.ok) throw new Error("매핑 조회 실패");
      return res.json();
    },
    enabled: showSection,
  });

  const addMutation = useMutation({
    mutationFn: async (data: { productCode: string; vendorId: number; vendorPrice: number; memo?: string }) => {
      await apiRequest("POST", "/api/admin/product-vendors", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/product-vendors", productCode] });
      toast({ title: "업체 매핑 추가 완료" });
      setSelectedVendorId("");
      setVendorPrice("");
      setVendorMemo("");
    },
    onError: (error: any) => {
      toast({ title: "추가 실패", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { vendorPrice?: number; memo?: string } }) => {
      await apiRequest("PUT", `/api/admin/product-vendors/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/product-vendors", productCode] });
      toast({ title: "매입가 수정 완료" });
      setEditingId(null);
    },
    onError: (error: any) => {
      toast({ title: "수정 실패", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/product-vendors/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/product-vendors", productCode] });
      toast({ title: "매핑 삭제 완료" });
    },
    onError: (error: any) => {
      toast({ title: "삭제 실패", description: error.message, variant: "destructive" });
    },
  });

  function handleCheckChange(checked: boolean) {
    setShowSection(checked);
    onVendorProductChange?.(checked);
  }

  function handleAdd() {
    if (!selectedVendorId || !vendorPrice) {
      toast({ title: "업체와 매입가를 입력해주세요", variant: "destructive" });
      return;
    }
    addMutation.mutate({
      productCode,
      vendorId: parseInt(selectedVendorId),
      vendorPrice: parseInt(vendorPrice),
      memo: vendorMemo || undefined,
    });
  }

  function startEdit(m: ProductVendorMapping) {
    setEditingId(m.id);
    setEditPrice(m.vendorPrice.toString());
    setEditMemo(m.memo || "");
  }

  function saveEdit() {
    if (editingId === null) return;
    updateMutation.mutate({
      id: editingId,
      data: { vendorPrice: parseInt(editPrice), memo: editMemo },
    });
  }

  const availableVendors = vendors.filter(
    (v) => !mappings.some((m) => m.vendorId === v.id)
  );

  return (
    <Card className="mt-4">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center gap-3">
          <Checkbox
            checked={showSection}
            onCheckedChange={(checked) => handleCheckChange(!!checked)}
            data-testid="checkbox-vendor-product"
          />
          <CardTitle className="text-sm flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            외주업체 공급 가능
            {showSection && (
              <Badge variant="secondary" className="ml-2">
                {productCode} - {productName}
              </Badge>
            )}
          </CardTitle>
        </div>
      </CardHeader>

      {showSection && (
        <CardContent className="pt-0 px-4 pb-4 space-y-4">
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1 min-w-[180px]">
              <Label className="text-xs">업체 선택</Label>
              <Select value={selectedVendorId} onValueChange={setSelectedVendorId}>
                <SelectTrigger className="h-8 text-xs" data-testid="select-vendor">
                  <SelectValue placeholder="업체 선택" />
                </SelectTrigger>
                <SelectContent>
                  {availableVendors.map((v) => (
                    <SelectItem key={v.id} value={v.id.toString()}>
                      {v.companyName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 min-w-[120px]">
              <Label className="text-xs">매입가 (원)</Label>
              <Input
                type="number"
                value={vendorPrice}
                onChange={(e) => setVendorPrice(e.target.value)}
                className="h-8 text-xs"
                placeholder="매입가"
                data-testid="input-vendor-price"
              />
            </div>
            <div className="space-y-1 min-w-[150px]">
              <Label className="text-xs">메모</Label>
              <Input
                value={vendorMemo}
                onChange={(e) => setVendorMemo(e.target.value)}
                className="h-8 text-xs"
                placeholder="메모 (선택)"
                data-testid="input-vendor-mapping-memo"
              />
            </div>
            <Button size="sm" onClick={handleAdd} disabled={addMutation.isPending} data-testid="button-add-vendor-mapping">
              {addMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3 mr-1" />}
              추가
            </Button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : mappings.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">
              매핑된 외주업체가 없습니다
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">업체명</TableHead>
                  <TableHead className="text-xs text-right">매입가</TableHead>
                  <TableHead className="text-xs">메모</TableHead>
                  <TableHead className="text-xs">수정일</TableHead>
                  <TableHead className="text-xs text-center">액션</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mappings.map((m) => (
                  <TableRow key={m.id} data-testid={`row-vendor-mapping-${m.id}`}>
                    <TableCell className="text-xs font-medium">{m.vendorName}</TableCell>
                    <TableCell className="text-xs text-right">
                      {editingId === m.id ? (
                        <Input
                          type="number"
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                          className="h-6 text-xs w-20 ml-auto"
                          data-testid="input-edit-vendor-price"
                        />
                      ) : (
                        <span data-testid={`text-vendor-price-${m.id}`}>{m.vendorPrice.toLocaleString()}원</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {editingId === m.id ? (
                        <Input
                          value={editMemo}
                          onChange={(e) => setEditMemo(e.target.value)}
                          className="h-6 text-xs w-32"
                          data-testid="input-edit-vendor-memo"
                        />
                      ) : (
                        m.memo || "-"
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(m.updatedAt).toLocaleDateString("ko-KR")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        {editingId === m.id ? (
                          <>
                            <Button variant="ghost" size="icon" onClick={saveEdit} disabled={updateMutation.isPending} data-testid="button-save-edit">
                              <Check className="h-3 w-3 text-green-500" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setEditingId(null)} data-testid="button-cancel-edit">
                              <X className="h-3 w-3" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => startEdit(m)} data-testid={`button-edit-mapping-${m.id}`}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(m.id)} data-testid={`button-delete-mapping-${m.id}`}>
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      )}
    </Card>
  );
}
