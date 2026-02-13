import { useState, useRef, useEffect, useMemo } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, Plus, Trash2, X, ChevronDown, CreditCard } from "lucide-react";
import { DateRangeFilter, useDateRange } from "@/components/common/DateRangeFilter";

const materialTypeLabels: Record<string, string> = {
  raw: "원물",
  semi: "반재료",
  subsidiary: "부자재",
  etc: "기타",
};

const paymentMethodLabels: Record<string, string> = {
  transfer: "계좌이체",
  product_offset: "상품상계",
  card: "카드결제",
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
  rowType: "purchase" | "payment";
  paymentMethod: string | null;
  createdAt: string | null;
}

interface PurchaseSummary {
  totalAmount: number;
  directAmount: number;
  siteAmount: number;
  directCount: number;
  siteCount: number;
  byType: { type: string; amount: number; percentage: number }[];
  totalPaymentAmount: number;
}

interface DropdownItem {
  value: string;
  label: string;
  vendorId: number | null;
  supplierId: number | null;
  supplyType: string[];
}

interface MaterialItem {
  id: string;
  materialType: string;
  materialCode: string;
  materialName: string;
}

interface NewItemRow {
  materialType: string;
  productName: string;
  materialCode: string;
  quantity: string;
  unit: string;
  unitPrice: string;
}

interface VendorBalance {
  id: string;
  source: "vendor" | "supplier" | "both";
  vendorId: number | null;
  supplierId: number | null;
  companyName: string;
  totalPurchases: number;
  totalPayments: number;
  outstandingBalance: number;
}

interface CumulativeData {
  cumulativeTotal: number;
  cumulativePayment: number;
  outstandingBalance: number;
}

export default function PurchaseManagementTab() {
  const { toast } = useToast();
  const dateRange = useDateRange("month");
  const [filterType, setFilterType] = useState("__all__");
  const [filterVendorName, setFilterVendorName] = useState("__all__");
  const [filterVendorSearchText, setFilterVendorSearchText] = useState("");
  const [filterVendorDropdownOpen, setFilterVendorDropdownOpen] = useState(false);
  const filterVendorRef = useRef<HTMLDivElement>(null);
  const [searchText, setSearchText] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addDate, setAddDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [addVendorValue, setAddVendorValue] = useState("");
  const [vendorSearchText, setVendorSearchText] = useState("");
  const [vendorDropdownOpen, setVendorDropdownOpen] = useState(false);
  const vendorSearchRef = useRef<HTMLDivElement>(null);
  const [addMemo, setAddMemo] = useState("");
  const [addItems, setAddItems] = useState<NewItemRow[]>([{ materialType: "__all__", productName: "", materialCode: "", quantity: "", unit: "박스", unitPrice: "" }]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [productSuggestionIdx, setProductSuggestionIdx] = useState<number | null>(null);

  const [showSettlementDialog, setShowSettlementDialog] = useState(false);
  const [selectedSettlementVendor, setSelectedSettlementVendor] = useState<VendorBalance | null>(null);
  const [settlementVendorSearch, setSettlementVendorSearch] = useState("");
  const [settlementVendorDropdownOpen, setSettlementVendorDropdownOpen] = useState(false);
  const settlementVendorRef = useRef<HTMLDivElement>(null);
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState("transfer");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMemo, setPaymentMemo] = useState("");

  const queryParams = new URLSearchParams();
  if (dateRange.dateRange.startDate) queryParams.set("startDate", dateRange.dateRange.startDate);
  if (dateRange.dateRange.endDate) queryParams.set("endDate", dateRange.dateRange.endDate);

  const { data, isLoading } = useQuery<{ purchases: PurchaseItem[]; payments: PurchaseItem[]; summary: PurchaseSummary }>({
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

  const { data: materialsData } = useQuery<MaterialItem[]>({
    queryKey: ["/api/materials"],
    queryFn: async () => {
      const res = await fetch("/api/materials", { credentials: "include" });
      if (!res.ok) throw new Error("원재료 목록 조회 실패");
      return res.json();
    },
  });

  const allMaterials = materialsData || [];

  const { data: vendorBalances = [], isLoading: isLoadingBalances } = useQuery<VendorBalance[]>({
    queryKey: ["/api/admin/accounting/vendor-balances"],
    enabled: showSettlementDialog,
  });

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
      queryClient.invalidateQueries({ queryKey: ["/api/admin/purchases/cumulative-total"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/admin/purchases/cumulative-total"] });
      setSelectedIds(new Set());
    },
    onError: (error: any) => {
      toast({ title: "삭제 실패", description: error.message, variant: "destructive" });
    },
  });

  const paymentMutation = useMutation({
    mutationFn: async (body: any) => {
      const res = await apiRequest("POST", "/api/admin/vendor-payments", body);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "결제 등록 완료" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/purchases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/accounting/vendor-balances"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/accounting/vendors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/purchases/cumulative-total"] });
      setPaymentDate(new Date().toISOString().slice(0, 10));
      setPaymentMethod("transfer");
      setPaymentAmount("");
      setPaymentMemo("");
      setSelectedSettlementVendor(null);
    },
    onError: (error: any) => {
      toast({ title: "등록 실패", description: error.message, variant: "destructive" });
    },
  });

  const resetAddForm = () => {
    setShowAddDialog(false);
    setAddDate(new Date().toISOString().slice(0, 10));
    setAddVendorValue("");
    setVendorSearchText("");
    setVendorDropdownOpen(false);
    setAddMemo("");
    setAddItems([{ materialType: "__all__", productName: "", materialCode: "", quantity: "", unit: "박스", unitPrice: "" }]);
    setProductSuggestionIdx(null);
  };

  const filteredVendors = useMemo(() => {
    if (!vendorSearchText.trim()) return dropdownItems;
    const term = vendorSearchText.toLowerCase();
    return dropdownItems.filter(d => d.label.toLowerCase().includes(term));
  }, [dropdownItems, vendorSearchText]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (vendorSearchRef.current && !vendorSearchRef.current.contains(e.target as Node)) {
        setVendorDropdownOpen(false);
      }
      if (filterVendorRef.current && !filterVendorRef.current.contains(e.target as Node)) {
        setFilterVendorDropdownOpen(false);
      }
      if (settlementVendorRef.current && !settlementVendorRef.current.contains(e.target as Node)) {
        setSettlementVendorDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleAddItem = () => {
    setAddItems(prev => [...prev, { materialType: "__all__", productName: "", materialCode: "", quantity: "", unit: "박스", unitPrice: "" }]);
  };

  const handleRemoveItem = (idx: number) => {
    setAddItems(prev => prev.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, field: keyof NewItemRow, value: string) => {
    setAddItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const handleSubmit = () => {
    if (!addVendorValue) { toast({ title: "업체를 선택해주세요", variant: "destructive" }); return; }
    const itemsWithInput = addItems.filter(item => item.productName || item.quantity || item.unitPrice);
    const invalidItems = itemsWithInput.filter(item => !item.materialCode);
    if (invalidItems.length > 0) { toast({ title: "품목을 원재료 목록에서 선택해주세요", description: "재료명을 검색하여 목록에서 선택해야 합니다.", variant: "destructive" }); return; }
    const validItems = itemsWithInput.filter(item => item.materialCode && item.quantity && item.unitPrice);
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
        materialCode: item.materialCode,
        quantity: parseFloat(item.quantity),
        unit: item.unit,
        unitPrice: parseInt(item.unitPrice),
        totalAmount: Math.round(parseFloat(item.quantity) * parseInt(item.unitPrice)),
      })),
    });
  };

  const handlePaymentSubmit = () => {
    if (!selectedSettlementVendor) return;
    const amount = parseInt(paymentAmount);
    if (!amount || amount <= 0) { toast({ title: "올바른 금액을 입력해주세요", variant: "destructive" }); return; }

    const body: any = { paymentDate, paymentMethod, amount, memo: paymentMemo || null };
    if (selectedSettlementVendor.vendorId) body.vendorId = selectedSettlementVendor.vendorId;
    if (selectedSettlementVendor.supplierId) body.supplierId = selectedSettlementVendor.supplierId;

    paymentMutation.mutate(body);
  };

  const purchases = data?.purchases || [];
  const payments = data?.payments || [];
  const summary = data?.summary;

  const materialTypeMap: Record<string, string> = { raw: "raw", semi: "semi", sub: "subsidiary", subsidiary: "subsidiary", etc: "etc" };

  const getMaterialSuggestions = (text: string, typeFilter: string) => {
    let filtered = allMaterials;
    if (typeFilter && typeFilter !== "__all__") {
      filtered = filtered.filter(m => m.materialType === typeFilter);
    }
    if (!text.trim()) return filtered.slice(0, 20);
    const term = text.toLowerCase();
    return filtered.filter(m =>
      m.materialName.toLowerCase().includes(term) || m.materialCode.toLowerCase().includes(term)
    );
  };

  const selectMaterial = (idx: number, material: MaterialItem) => {
    setAddItems(prev => prev.map((item, i) => i === idx ? {
      ...item,
      productName: material.materialName,
      materialCode: material.materialCode,
      materialType: materialTypeMap[material.materialType] || material.materialType,
    } : item));
    setProductSuggestionIdx(null);
  };

  const allRows = useMemo(() => {
    const combined: PurchaseItem[] = [...purchases, ...payments];
    combined.sort((a, b) => {
      if (a.purchaseDate < b.purchaseDate) return -1;
      if (a.purchaseDate > b.purchaseDate) return 1;
      const aTime = a.createdAt || "";
      const bTime = b.createdAt || "";
      if (aTime < bTime) return -1;
      if (aTime > bTime) return 1;
      return 0;
    });
    return combined;
  }, [purchases, payments]);

  const vendorNames = useMemo(() => {
    const names = new Set<string>();
    allRows.forEach(p => { if (p.vendorName) names.add(p.vendorName); });
    return Array.from(names).sort();
  }, [allRows]);

  const filteredFilterVendors = useMemo(() => {
    if (!filterVendorSearchText.trim()) return vendorNames;
    const term = filterVendorSearchText.toLowerCase();
    return vendorNames.filter(name => name.toLowerCase().includes(term));
  }, [vendorNames, filterVendorSearchText]);

  const { data: cumulativeData } = useQuery<CumulativeData>({
    queryKey: ["/api/admin/purchases/cumulative-total", filterVendorName],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterVendorName !== "__all__") params.set("vendorName", filterVendorName);
      const res = await fetch(`/api/admin/purchases/cumulative-total?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("누적합계 조회 실패");
      return res.json();
    },
  });

  const filtered = allRows.filter(p => {
    if (filterVendorName !== "__all__" && p.vendorName !== filterVendorName) return false;
    if (filterType !== "__all__") {
      if (p.rowType === "payment") return false;
      if (p.materialType !== filterType) return false;
    }
    if (searchText) {
      const term = searchText.toLowerCase();
      if (!p.productName.toLowerCase().includes(term)) return false;
    }
    return true;
  });

  const filteredWithCumulative = useMemo(() => {
    let cumulative = 0;
    return filtered.map(p => {
      if (p.rowType === "purchase") {
        cumulative += p.totalAmount;
      } else {
        cumulative -= p.totalAmount;
      }
      return { ...p, cumulativeAmount: cumulative };
    });
  }, [filtered]);

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

  const periodPurchaseTotal = filtered.filter(p => p.rowType === "purchase").reduce((s, p) => s + p.totalAmount, 0);
  const periodPaymentTotal = filtered.filter(p => p.rowType === "payment").reduce((s, p) => s + p.totalAmount, 0);

  return (
    <div className="space-y-5">
      <Card className="bg-muted/30 dark:bg-muted/10">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-end gap-2 justify-between">
            <div className="flex flex-wrap items-end gap-2">
              <DateRangeFilter onChange={dateRange.setDateRange} defaultPreset="month" />
              <div className="relative w-[200px]" ref={filterVendorRef}>
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
                <Input
                  value={filterVendorName !== "__all__" ? (filterVendorDropdownOpen ? filterVendorSearchText : filterVendorName) : filterVendorSearchText}
                  onChange={(e) => {
                    if (filterVendorName !== "__all__") {
                      setFilterVendorName("__all__");
                    }
                    setFilterVendorSearchText(e.target.value);
                    setFilterVendorDropdownOpen(true);
                  }}
                  onFocus={() => {
                    if (filterVendorName !== "__all__") {
                      setFilterVendorSearchText(filterVendorName);
                      setFilterVendorName("__all__");
                    }
                    setFilterVendorDropdownOpen(true);
                  }}
                  placeholder="업체 검색"
                  className="pl-8 pr-8"
                  data-testid="input-filter-vendor"
                />
                {(filterVendorName !== "__all__" || filterVendorSearchText) ? (
                  <button
                    type="button"
                    onClick={() => { setFilterVendorName("__all__"); setFilterVendorSearchText(""); setFilterVendorDropdownOpen(false); }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    data-testid="button-clear-filter-vendor"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : (
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                )}
                {filterVendorDropdownOpen && filterVendorName === "__all__" && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-md max-h-[200px] overflow-y-auto">
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover-elevate cursor-pointer text-muted-foreground"
                      onMouseDown={(e) => { e.preventDefault(); setFilterVendorName("__all__"); setFilterVendorSearchText(""); setFilterVendorDropdownOpen(false); }}
                      data-testid="option-filter-vendor-all"
                    >
                      업체 전체
                    </button>
                    {filteredFilterVendors.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">검색 결과가 없습니다</div>
                    ) : (
                      filteredFilterVendors.map(name => (
                        <button
                          key={name}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover-elevate cursor-pointer"
                          onMouseDown={(e) => { e.preventDefault(); setFilterVendorName(name); setFilterVendorSearchText(""); setFilterVendorDropdownOpen(false); }}
                          data-testid={`option-filter-vendor-${name}`}
                        >
                          {name}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[120px]" data-testid="select-filter-material"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">타입 전체</SelectItem>
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
            <div className="flex items-center gap-2">
              <Button className="bg-orange-500 border-orange-600 text-white" onClick={() => setShowSettlementDialog(true)} data-testid="button-settlement">
                <CreditCard className="h-4 w-4 mr-1" />정산/결제
              </Button>
              <Button onClick={() => setShowAddDialog(true)} data-testid="button-add-purchase">
                <Plus className="h-4 w-4 mr-1" />매입 등록
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <div className="text-xs text-muted-foreground mb-1">매입 합계</div>
              <div className="text-lg font-bold">{(summary.totalAmount || 0).toLocaleString()}원</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <div className="text-xs text-muted-foreground mb-1">결제 합계</div>
              <div className="text-lg font-bold text-blue-600">{(summary.totalPaymentAmount || 0).toLocaleString()}원</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <div className="text-xs text-muted-foreground mb-1">외상 잔액 (선택기간)</div>
              <div className="text-lg font-bold text-amber-600">{((summary.totalAmount || 0) - (summary.totalPaymentAmount || 0)).toLocaleString()}원</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <div className="text-xs text-muted-foreground mb-1">매입 건수</div>
              <div className="text-lg font-bold">{(summary.directCount || 0)}건</div>
            </CardContent>
          </Card>
          {summary.byType?.length > 0 && (
            <div className="col-span-2 sm:col-span-4 flex flex-wrap gap-4 text-xs text-muted-foreground px-1">
              {summary.byType.map(t => (
                <span key={t.type}>{materialTypeLabels[t.type] || t.type}: {t.amount.toLocaleString()}원 ({t.percentage}%)</span>
              ))}
            </div>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <>
          <div>
            <div className="border rounded-lg overflow-x-auto overflow-y-auto max-h-[600px]">
              <Table className="min-w-[1100px]">
                <TableHeader className="sticky top-0 z-10 bg-muted/70 dark:bg-muted/40">
                  <TableRow>
                    <TableHead className="w-[40px]"></TableHead>
                    <TableHead>날짜</TableHead>
                    <TableHead>구분</TableHead>
                    <TableHead>업체명</TableHead>
                    <TableHead>품목/내용</TableHead>
                    <TableHead className="text-right">수량</TableHead>
                    <TableHead className="text-right">단가</TableHead>
                    <TableHead className="text-right">금액</TableHead>
                    <TableHead className="text-right">누적합계</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredWithCumulative.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">데이터가 없습니다</TableCell>
                    </TableRow>
                  ) : (
                    filteredWithCumulative.map((p) => (
                      <TableRow
                        key={`${p.rowType}-${p.id}`}
                        className={p.rowType === "payment" ? "bg-blue-50/60 dark:bg-blue-950/30" : ""}
                        data-testid={`row-${p.rowType}-${p.id}`}
                      >
                        <TableCell>
                          {p.rowType === "purchase" && p.source === "direct" && (
                            <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelect(p.id)} className="rounded" />
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{p.purchaseDate}</TableCell>
                        <TableCell>
                          {p.rowType === "purchase" ? (
                            <Badge variant="outline" className="no-default-active-elevate text-xs">{materialTypeLabels[p.materialType] || p.materialType}</Badge>
                          ) : (
                            <Badge variant="default" className="no-default-active-elevate text-xs">
                              {paymentMethodLabels[p.paymentMethod || "transfer"] || "결제"}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{p.vendorName || "-"}</TableCell>
                        <TableCell>{p.rowType === "purchase" ? p.productName : (p.memo || "결제")}</TableCell>
                        <TableCell className="text-right">
                          {p.rowType === "purchase" ? `${Number(p.quantity).toLocaleString()} ${p.unit}` : ""}
                        </TableCell>
                        <TableCell className="text-right">
                          {p.rowType === "purchase" ? `${p.unitPrice.toLocaleString()}원` : ""}
                        </TableCell>
                        <TableCell className={`text-right font-medium ${p.rowType === "payment" ? "text-blue-600" : ""}`}>
                          {p.rowType === "purchase" ? `+${p.totalAmount.toLocaleString()}원` : `-${p.totalAmount.toLocaleString()}원`}
                        </TableCell>
                        <TableCell className="text-right font-medium text-primary">{p.cumulativeAmount.toLocaleString()}원</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm mt-2 px-1">
              <div className="flex items-center gap-2">
                {selectedIds.size > 0 && (
                  <Button size="sm" variant="destructive" onClick={() => deleteMutation.mutate(Array.from(selectedIds))} disabled={deleteMutation.isPending} data-testid="button-batch-delete">
                    <Trash2 className="h-3 w-3 mr-1" />선택 삭제 ({selectedIds.size}건)
                  </Button>
                )}
                <span className="text-muted-foreground">(직접 매입만 삭제 가능)</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-muted-foreground">매입: <span className="font-semibold text-foreground">+{periodPurchaseTotal.toLocaleString()}원</span></span>
                <span className="text-muted-foreground">결제: <span className="font-semibold text-blue-600">-{periodPaymentTotal.toLocaleString()}원</span></span>
                <span className="text-muted-foreground">잔액: <span className="font-semibold text-foreground">{(periodPurchaseTotal - periodPaymentTotal).toLocaleString()}원</span></span>
              </div>
            </div>
          </div>

          <Card className="bg-slate-50 dark:bg-slate-900/50 border-2 border-slate-200 dark:border-slate-700">
            <CardContent className="pt-4 pb-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm font-bold">
                  현재시점 누적합계액{filterVendorName !== "__all__" ? ` (${filterVendorName})` : " (전체)"}
                </span>
                <div className="flex items-center gap-6 text-sm">
                  <div>
                    <span className="text-muted-foreground">총 매입: </span>
                    <span className="font-bold" data-testid="text-cumulative-purchase">{(cumulativeData?.cumulativeTotal || 0).toLocaleString()}원</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">총 결제: </span>
                    <span className="font-bold text-blue-600" data-testid="text-cumulative-payment">{(cumulativeData?.cumulativePayment || 0).toLocaleString()}원</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">외상 잔액: </span>
                    <span className="text-lg font-bold text-primary" data-testid="text-cumulative-total">{(cumulativeData?.outstandingBalance || 0).toLocaleString()}원</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={showSettlementDialog} onOpenChange={(open) => {
        setShowSettlementDialog(open);
        if (!open) {
          setSelectedSettlementVendor(null);
          setSettlementVendorSearch("");
          setSettlementVendorDropdownOpen(false);
          setPaymentDate(new Date().toISOString().slice(0, 10));
          setPaymentMethod("transfer");
          setPaymentAmount("");
          setPaymentMemo("");
        }
      }}>
        <DialogContent className="max-w-[480px]">
          <DialogHeader>
            <DialogTitle>정산/결제</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>업체 선택</Label>
              {isLoadingBalances ? (
                <div className="flex items-center justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
              ) : (
                <div className="relative" ref={settlementVendorRef}>
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
                  <Input
                    value={selectedSettlementVendor ? (settlementVendorDropdownOpen ? settlementVendorSearch : selectedSettlementVendor.companyName) : settlementVendorSearch}
                    onChange={(e) => {
                      if (selectedSettlementVendor) {
                        setSelectedSettlementVendor(null);
                      }
                      setSettlementVendorSearch(e.target.value);
                      setSettlementVendorDropdownOpen(true);
                    }}
                    onFocus={() => {
                      if (selectedSettlementVendor) {
                        setSettlementVendorSearch(selectedSettlementVendor.companyName);
                        setSelectedSettlementVendor(null);
                      }
                      setSettlementVendorDropdownOpen(true);
                    }}
                    placeholder="업체명을 검색하세요"
                    className="pl-8 pr-8"
                    data-testid="input-settlement-vendor-search"
                  />
                  {(selectedSettlementVendor || settlementVendorSearch) ? (
                    <button
                      type="button"
                      onClick={() => { setSelectedSettlementVendor(null); setSettlementVendorSearch(""); setSettlementVendorDropdownOpen(false); }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      data-testid="button-clear-settlement-vendor"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : (
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  )}
                  {settlementVendorDropdownOpen && !selectedSettlementVendor && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-md max-h-[200px] overflow-y-auto">
                      {(() => {
                        const term = settlementVendorSearch.toLowerCase().trim();
                        const list = term ? vendorBalances.filter(v => v.companyName.toLowerCase().includes(term)) : vendorBalances;
                        if (list.length === 0) return (
                          <div className="px-3 py-2 text-sm text-muted-foreground">검색 결과가 없습니다</div>
                        );
                        return list.map(v => (
                          <button
                            key={v.id}
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm hover-elevate cursor-pointer flex items-center justify-between gap-2"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setSelectedSettlementVendor(v);
                              setSettlementVendorSearch("");
                              setSettlementVendorDropdownOpen(false);
                            }}
                            data-testid={`option-settlement-vendor-${v.id}`}
                          >
                            <span>{v.companyName}</span>
                            <span className="text-xs text-muted-foreground shrink-0">{(v.outstandingBalance || 0).toLocaleString()}원</span>
                          </button>
                        ));
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>

            {selectedSettlementVendor && (
              <>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <div className="text-sm text-muted-foreground mb-1">현재 외상 잔액</div>
                      <div className="text-2xl font-bold" data-testid="text-settlement-balance">
                        {(selectedSettlementVendor.outstandingBalance || 0).toLocaleString()}원
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>결제일</Label>
                    <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} data-testid="input-payment-date" />
                  </div>
                  <div className="space-y-2">
                    <Label>결제 구분</Label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger data-testid="select-payment-method"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="transfer">계좌이체</SelectItem>
                        <SelectItem value="product_offset">상품상계</SelectItem>
                        <SelectItem value="card">카드결제</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>결제액</Label>
                  <Input type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder="금액을 입력하세요" data-testid="input-payment-amount" />
                </div>
                <div className="space-y-2">
                  <Label>메모 (선택)</Label>
                  <Input value={paymentMemo} onChange={(e) => setPaymentMemo(e.target.value)} placeholder="메모" data-testid="input-payment-memo" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setShowSettlementDialog(false)}>취소</Button>
                  <Button onClick={handlePaymentSubmit} disabled={paymentMutation.isPending} data-testid="button-submit-payment">
                    {paymentMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}결제 등록
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddDialog} onOpenChange={() => resetAddForm()}>
        <DialogContent className="w-[80vw] max-w-[80vw] h-[80vh] max-h-[80vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>매입 등록</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>매입일</Label>
                <Input type="date" value={addDate} onChange={(e) => setAddDate(e.target.value)} data-testid="input-purchase-date" />
              </div>
              <div className="space-y-2" ref={vendorSearchRef}>
                <Label>공급업체</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
                  <Input
                    value={addVendorValue ? (dropdownItems.find(d => d.value === addVendorValue)?.label || "") : vendorSearchText}
                    onChange={(e) => {
                      if (addVendorValue) {
                        setAddVendorValue("");
                      }
                      setVendorSearchText(e.target.value);
                      setVendorDropdownOpen(true);
                    }}
                    onFocus={() => {
                      if (addVendorValue) {
                        const label = dropdownItems.find(d => d.value === addVendorValue)?.label || "";
                        setVendorSearchText(label);
                        setAddVendorValue("");
                      }
                      setVendorDropdownOpen(true);
                    }}
                    placeholder="업체명 검색"
                    className="pl-8 pr-8"
                    data-testid="input-vendor-search"
                  />
                  {(addVendorValue || vendorSearchText) ? (
                    <button
                      type="button"
                      onClick={() => { setAddVendorValue(""); setVendorSearchText(""); setVendorDropdownOpen(false); }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      data-testid="button-clear-vendor"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : (
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  )}
                  {vendorDropdownOpen && !addVendorValue && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-md max-h-[200px] overflow-y-auto">
                      {filteredVendors.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">검색 결과가 없습니다</div>
                      ) : (
                        filteredVendors.map(d => (
                          <button
                            key={d.value}
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm hover-elevate cursor-pointer"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setAddVendorValue(d.value);
                              setVendorSearchText("");
                              setVendorDropdownOpen(false);
                            }}
                            data-testid={`option-vendor-${d.value}`}
                          >
                            {d.label}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label>메모 (선택)</Label>
                <Input value={addMemo} onChange={(e) => setAddMemo(e.target.value)} placeholder="메모" data-testid="input-purchase-memo" />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>품목 목록</Label>
                <Button size="sm" variant="outline" onClick={handleAddItem} data-testid="button-add-item">
                  <Plus className="h-3 w-3 mr-1" />품목 추가
                </Button>
              </div>
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]">#</TableHead>
                      <TableHead className="w-[120px]">타입</TableHead>
                      <TableHead>품목명</TableHead>
                      <TableHead className="w-[100px]">수량</TableHead>
                      <TableHead className="w-[90px]">단위</TableHead>
                      <TableHead className="w-[120px]">단가</TableHead>
                      <TableHead className="w-[120px] text-right">금액</TableHead>
                      <TableHead className="w-[130px] text-right">누적합계</TableHead>
                      <TableHead className="w-[40px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {addItems.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell>
                          {item.materialCode ? (
                            <Badge variant="outline" className="no-default-active-elevate text-xs whitespace-nowrap">
                              {materialTypeLabels[item.materialType] || item.materialType || "-"}
                            </Badge>
                          ) : (
                            <Select
                              value={item.materialType}
                              onValueChange={(v) => {
                                setAddItems(prev => prev.map((it, i) => i === idx ? { ...it, materialType: v, productName: "", materialCode: "" } : it));
                              }}
                            >
                              <SelectTrigger className="h-9 text-xs" data-testid={`select-item-type-${idx}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__all__">전체</SelectItem>
                                <SelectItem value="raw">원물</SelectItem>
                                <SelectItem value="semi">반재료</SelectItem>
                                <SelectItem value="sub">부자재</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="relative">
                            {item.materialCode ? (
                              <div className="flex items-center gap-1 border rounded-md px-3 h-9 bg-background">
                                <span className="flex-1 text-sm truncate">{item.productName}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAddItems(prev => prev.map((it, i) => i === idx ? { ...it, productName: "", materialCode: "", materialType: "__all__" } : it));
                                  }}
                                  className="shrink-0 text-muted-foreground hover:text-foreground"
                                  data-testid={`button-clear-material-${idx}`}
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ) : (
                              <>
                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none z-10" />
                                <Input
                                  value={item.productName}
                                  onChange={(e) => { updateItem(idx, "productName", e.target.value); setProductSuggestionIdx(idx); }}
                                  onFocus={() => setProductSuggestionIdx(idx)}
                                  onBlur={() => setTimeout(() => setProductSuggestionIdx(null), 150)}
                                  placeholder="재료명 검색"
                                  className="pl-7"
                                  data-testid={`input-item-name-${idx}`}
                                />
                              </>
                            )}
                            {productSuggestionIdx === idx && !item.materialCode && (
                              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-md max-h-[200px] overflow-y-auto">
                                {getMaterialSuggestions(item.productName, item.materialType).length === 0 ? (
                                  <div className="px-3 py-2 text-sm text-muted-foreground">검색 결과가 없습니다</div>
                                ) : (
                                  getMaterialSuggestions(item.productName, item.materialType).map(m => (
                                    <button
                                      key={m.id}
                                      type="button"
                                      className="w-full text-left px-3 py-1.5 text-sm hover-elevate cursor-pointer flex items-center gap-2"
                                      onMouseDown={(e) => { e.preventDefault(); selectMaterial(idx, m); }}
                                      data-testid={`suggestion-material-${idx}-${m.materialCode}`}
                                    >
                                      <Badge variant="outline" className="no-default-active-elevate text-[10px] shrink-0">
                                        {materialTypeLabels[materialTypeMap[m.materialType] || m.materialType] || m.materialType}
                                      </Badge>
                                      <span className="truncate">{m.materialName}</span>
                                      <span className="text-muted-foreground text-xs shrink-0">({m.materialCode})</span>
                                    </button>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input type="number" value={item.quantity} onChange={(e) => updateItem(idx, "quantity", e.target.value)} placeholder="수량" data-testid={`input-item-qty-${idx}`} />
                        </TableCell>
                        <TableCell>
                          <Select value={item.unit} onValueChange={(v) => updateItem(idx, "unit", v)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {unitOptions.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input type="number" value={item.unitPrice} onChange={(e) => updateItem(idx, "unitPrice", e.target.value)} placeholder="단가" data-testid={`input-item-price-${idx}`} />
                        </TableCell>
                        <TableCell className="text-right font-medium whitespace-nowrap">{itemTotal(item).toLocaleString()}원</TableCell>
                        <TableCell className="text-right font-semibold whitespace-nowrap text-primary" data-testid={`text-cumulative-${idx}`}>
                          {addItems.slice(0, idx + 1).reduce((sum, it) => sum + itemTotal(it), 0).toLocaleString()}원
                        </TableCell>
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
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t shrink-0">
            <Button variant="outline" onClick={resetAddForm} data-testid="button-cancel-purchase">취소</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending} data-testid="button-submit-purchase">
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}등록
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
