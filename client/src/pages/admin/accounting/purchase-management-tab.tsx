import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, Plus, Trash2, Link as LinkIcon, Pencil } from "lucide-react";
import { DateRangeFilter, useDateRange } from "@/components/common/DateRangeFilter";

const materialTypeLabels: Record<string, string> = {
  raw: "원물",
  semi: "반재료",
  subsidiary: "부자재",
  etc: "기타",
};

const unitOptions = ["박스", "kg", "팩", "송이", "개", "롤", "건"];

interface PurchaseItem {
  id: number;
  purchaseDate: string;
  vendorId: number | null;
  supplierId: number | null;
  vendorName?: string;
  materialType: string;
  productName: string;
  quantity: string;
  unit: string;
  unitPrice: number;
  totalAmount: number;
  memo: string | null;
  source: "direct" | "site";
}

interface PurchaseSummary {
  totalAmount: number;
  directAmount: number;
  siteAmount: number;
  directCount: number;
  siteCount: number;
  byType: { type: string; amount: number; percentage: number }[];
}

interface DropdownItem {
  value: string;
  label: string;
  vendorId: number | null;
  supplierId: number | null;
  supplyType: string[];
}

interface NewItemRow {
  materialType: string;
  productName: string;
  quantity: string;
  unit: string;
  unitPrice: string;
}

export default function PurchaseManagementTab() {
  const { toast } = useToast();
  const dateRange = useDateRange("month");
  const [filterSource, setFilterSource] = useState("__all__");
  const [filterType, setFilterType] = useState("__all__");
  const [filterVendor, setFilterVendor] = useState("__all__");
  const [searchText, setSearchText] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addDate, setAddDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [addVendorValue, setAddVendorValue] = useState("");
  const [addMemo, setAddMemo] = useState("");
  const [addItems, setAddItems] = useState<NewItemRow[]>([{ materialType: "raw", productName: "", quantity: "", unit: "박스", unitPrice: "" }]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const queryParams = new URLSearchParams();
  if (dateRange.dateRange.startDate) queryParams.set("startDate", dateRange.dateRange.startDate);
  if (dateRange.dateRange.endDate) queryParams.set("endDate", dateRange.dateRange.endDate);

  const { data, isLoading } = useQuery<{ purchases: PurchaseItem[]; summary: PurchaseSummary }>({
    queryKey: ["/api/admin/purchases", dateRange.dateRange.startDate, dateRange.dateRange.endDate],
    queryFn: async () => {
      const res = await fetch(`/api/admin/purchases?${queryParams.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("조회 실패");
      return res.json();
    },
  });

  const { data: dropdownData } = useQuery<{ items: DropdownItem[] }>({
    queryKey: ["/api/admin/accounting/vendors/dropdown"],
  });

  const dropdownItems = dropdownData?.items || [];

  const createMutation = useMutation({
    mutationFn: async (body: any) => {
      const res = await apiRequest("POST", "/api/admin/purchases", body);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "등록 완료", description: `${data.count}건 매입이 등록되었습니다.` });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/purchases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/accounting/vendors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/accounting/vendor-balances"] });
      resetAddForm();
    },
    onError: (error: any) => {
      toast({ title: "등록 실패", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const res = await apiRequest("POST", "/api/admin/purchases/batch-delete", { ids });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "삭제 완료" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/purchases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/accounting/vendors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/accounting/vendor-balances"] });
      setSelectedIds(new Set());
    },
    onError: (error: any) => {
      toast({ title: "삭제 실패", description: error.message, variant: "destructive" });
    },
  });

  const resetAddForm = () => {
    setShowAddDialog(false);
    setAddDate(new Date().toISOString().slice(0, 10));
    setAddVendorValue("");
    setAddMemo("");
    setAddItems([{ materialType: "raw", productName: "", quantity: "", unit: "박스", unitPrice: "" }]);
  };

  const handleAddItem = () => {
    setAddItems(prev => [...prev, { materialType: "raw", productName: "", quantity: "", unit: "박스", unitPrice: "" }]);
  };

  const handleRemoveItem = (idx: number) => {
    setAddItems(prev => prev.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, field: keyof NewItemRow, value: string) => {
    setAddItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const handleSubmit = () => {
    if (!addVendorValue) { toast({ title: "업체를 선택해주세요", variant: "destructive" }); return; }
    const validItems = addItems.filter(item => item.productName && item.quantity && item.unitPrice);
    if (validItems.length === 0) { toast({ title: "품목을 입력해주세요", variant: "destructive" }); return; }

    const selectedVendor = dropdownItems.find(d => d.value === addVendorValue);
    if (!selectedVendor) { toast({ title: "업체 정보를 찾을 수 없습니다", variant: "destructive" }); return; }

    createMutation.mutate({
      purchaseDate: addDate,
      vendorId: selectedVendor.vendorId || null,
      supplierId: selectedVendor.supplierId || null,
      memo: addMemo || null,
      items: validItems.map(item => ({
        materialType: item.materialType,
        productName: item.productName,
        quantity: parseFloat(item.quantity),
        unit: item.unit,
        unitPrice: parseInt(item.unitPrice),
        totalAmount: Math.round(parseFloat(item.quantity) * parseInt(item.unitPrice)),
      })),
    });
  };

  const purchases = data?.purchases || [];
  const summary = data?.summary;

  const filtered = purchases.filter(p => {
    if (filterSource !== "__all__") {
      if (filterSource === "direct" && p.source !== "direct") return false;
      if (filterSource === "site" && p.source !== "site") return false;
    }
    if (filterType !== "__all__" && p.materialType !== filterType) return false;
    if (searchText) {
      const term = searchText.toLowerCase();
      if (!p.productName.toLowerCase().includes(term)) return false;
    }
    return true;
  });

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const itemTotal = (item: NewItemRow) => {
    const q = parseFloat(item.quantity) || 0;
    const p = parseInt(item.unitPrice) || 0;
    return Math.round(q * p);
  };

  const selectedDropdown = dropdownItems.find(v => v.value === addVendorValue);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2 justify-between">
        <div className="flex flex-wrap items-end gap-2">
          <DateRangeFilter onChange={dateRange.setDateRange} defaultPreset="month" />
          <Select value={filterSource} onValueChange={setFilterSource}>
            <SelectTrigger className="w-[130px]" data-testid="select-filter-source"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">전체</SelectItem>
              <SelectItem value="site">사이트 매입</SelectItem>
              <SelectItem value="direct">직접 매입</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[120px]" data-testid="select-filter-material"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">분류 전체</SelectItem>
              <SelectItem value="raw">원물</SelectItem>
              <SelectItem value="semi">반재료</SelectItem>
              <SelectItem value="subsidiary">부자재</SelectItem>
              <SelectItem value="etc">기타</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="품목 검색..." value={searchText} onChange={(e) => setSearchText(e.target.value)} className="pl-9" data-testid="input-purchase-search" />
          </div>
        </div>
        <Button onClick={() => setShowAddDialog(true)} data-testid="button-add-purchase">
          <Plus className="h-4 w-4 mr-1" />매입 등록
        </Button>
      </div>

      {summary && (
        <Card>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">총 매입</div>
                <div className="text-lg font-bold">{(summary.totalAmount || 0).toLocaleString()}원</div>
              </div>
              <div>
                <div className="text-muted-foreground">사이트 매입</div>
                <div className="font-semibold">{(summary.siteAmount || 0).toLocaleString()}원 <span className="text-xs text-muted-foreground">({summary.siteCount || 0}건)</span></div>
              </div>
              <div>
                <div className="text-muted-foreground">직접 매입</div>
                <div className="font-semibold">{(summary.directAmount || 0).toLocaleString()}원 <span className="text-xs text-muted-foreground">({summary.directCount || 0}건)</span></div>
              </div>
            </div>
            {summary.byType?.length > 0 && (
              <div className="mt-3 pt-3 border-t flex flex-wrap gap-4 text-sm">
                {summary.byType.map(t => (
                  <span key={t.type}>{materialTypeLabels[t.type] || t.type}: {t.amount.toLocaleString()}원 ({t.percentage}%)</span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <>
          <div className="border rounded-lg overflow-x-auto overflow-y-auto max-h-[600px]">
            <Table className="min-w-[1000px]">
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead>날짜</TableHead>
                  <TableHead>구분</TableHead>
                  <TableHead>분류</TableHead>
                  <TableHead>업체명</TableHead>
                  <TableHead>품목명</TableHead>
                  <TableHead className="text-right">수량</TableHead>
                  <TableHead className="text-right">단가</TableHead>
                  <TableHead className="text-right">금액</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">매입 데이터가 없습니다</TableCell>
                  </TableRow>
                ) : (
                  filtered.map((p) => (
                    <TableRow key={`${p.source}-${p.id}`} data-testid={`row-purchase-${p.id}`}>
                      <TableCell>
                        {p.source === "direct" && (
                          <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelect(p.id)} className="rounded" />
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{p.purchaseDate}</TableCell>
                      <TableCell>
                        {p.source === "site"
                          ? <Badge variant="outline" className="no-default-active-elevate text-xs"><LinkIcon className="h-3 w-3 mr-1" />사이트</Badge>
                          : <Badge variant="secondary" className="no-default-active-elevate text-xs"><Pencil className="h-3 w-3 mr-1" />직접</Badge>
                        }
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="no-default-active-elevate text-xs">{materialTypeLabels[p.materialType] || p.materialType}</Badge>
                      </TableCell>
                      <TableCell>{p.vendorName || "-"}</TableCell>
                      <TableCell>{p.productName}</TableCell>
                      <TableCell className="text-right">{Number(p.quantity).toLocaleString()} {p.unit}</TableCell>
                      <TableCell className="text-right">{p.unitPrice.toLocaleString()}원</TableCell>
                      <TableCell className="text-right font-medium">{p.totalAmount.toLocaleString()}원</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <div className="flex items-center gap-2">
              {selectedIds.size > 0 && (
                <Button size="sm" variant="destructive" onClick={() => deleteMutation.mutate(Array.from(selectedIds))} disabled={deleteMutation.isPending} data-testid="button-batch-delete">
                  <Trash2 className="h-3 w-3 mr-1" />선택 삭제 ({selectedIds.size}건)
                </Button>
              )}
              <span className="text-muted-foreground">(직접 매입만 삭제 가능)</span>
            </div>
            <span className="text-muted-foreground">합계: <span className="font-semibold text-foreground">{filtered.reduce((s, p) => s + p.totalAmount, 0).toLocaleString()}원</span></span>
          </div>
        </>
      )}

      <Dialog open={showAddDialog} onOpenChange={() => resetAddForm()}>
        <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>매입 등록</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>매입일</Label>
                <Input type="date" value={addDate} onChange={(e) => setAddDate(e.target.value)} data-testid="input-purchase-date" />
              </div>
              <div className="space-y-2">
                <Label>공급업체</Label>
                <Select value={addVendorValue} onValueChange={(v) => {
                  setAddVendorValue(v);
                  const selected = dropdownItems.find(d => d.value === v);
                  if (selected?.supplyType?.length) {
                    setAddItems(prev => prev.map(item => ({ ...item, materialType: selected.supplyType[0] })));
                  }
                }}>
                  <SelectTrigger data-testid="select-purchase-vendor"><SelectValue placeholder="업체 선택" /></SelectTrigger>
                  <SelectContent>
                    {dropdownItems.map(d => (
                      <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>품목 목록</Label>
                <Button size="sm" variant="outline" onClick={handleAddItem} data-testid="button-add-item">
                  <Plus className="h-3 w-3 mr-1" />품목 추가
                </Button>
              </div>
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]">#</TableHead>
                      <TableHead>분류</TableHead>
                      <TableHead>품목명</TableHead>
                      <TableHead>수량</TableHead>
                      <TableHead>단위</TableHead>
                      <TableHead>단가</TableHead>
                      <TableHead className="text-right">금액</TableHead>
                      <TableHead className="w-[40px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {addItems.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell>
                          <Select value={item.materialType} onValueChange={(v) => updateItem(idx, "materialType", v)}>
                            <SelectTrigger className="w-[90px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="raw">원물</SelectItem>
                              <SelectItem value="semi">반재료</SelectItem>
                              <SelectItem value="subsidiary">부자재</SelectItem>
                              <SelectItem value="etc">기타</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input value={item.productName} onChange={(e) => updateItem(idx, "productName", e.target.value)} placeholder="품목명" className="min-w-[120px]" data-testid={`input-item-name-${idx}`} />
                        </TableCell>
                        <TableCell>
                          <Input type="number" value={item.quantity} onChange={(e) => updateItem(idx, "quantity", e.target.value)} placeholder="수량" className="w-[80px]" data-testid={`input-item-qty-${idx}`} />
                        </TableCell>
                        <TableCell>
                          <Select value={item.unit} onValueChange={(v) => updateItem(idx, "unit", v)}>
                            <SelectTrigger className="w-[80px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {unitOptions.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input type="number" value={item.unitPrice} onChange={(e) => updateItem(idx, "unitPrice", e.target.value)} placeholder="단가" className="w-[100px]" data-testid={`input-item-price-${idx}`} />
                        </TableCell>
                        <TableCell className="text-right font-medium whitespace-nowrap">{itemTotal(item).toLocaleString()}원</TableCell>
                        <TableCell>
                          {addItems.length > 1 && (
                            <Button size="icon" variant="ghost" onClick={() => handleRemoveItem(idx)}><Trash2 className="h-3 w-3" /></Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="text-right text-sm font-semibold">
                합계: {addItems.reduce((s, item) => s + itemTotal(item), 0).toLocaleString()}원
              </div>
            </div>

            <div className="space-y-2">
              <Label>메모 (선택)</Label>
              <Textarea value={addMemo} onChange={(e) => setAddMemo(e.target.value)} placeholder="메모" data-testid="input-purchase-memo" />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={resetAddForm} data-testid="button-cancel-purchase">취소</Button>
              <Button onClick={handleSubmit} disabled={createMutation.isPending} data-testid="button-submit-purchase">
                {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}등록
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
