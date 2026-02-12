import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Loader2, Search, Plus, Settings, Pencil, AlertTriangle, Info, Link as LinkIcon, Trash2 } from "lucide-react";

const supplyTypeLabels: Record<string, string> = {
  raw: "원물",
  semi: "반재료",
  subsidiary: "부자재",
  etc: "기타",
};

const paymentMethodLabels: Record<string, string> = {
  transfer: "계좌이체",
  cash: "현금",
  bill: "어음",
};

interface UnifiedVendor {
  id: string;
  source: "vendor" | "supplier" | "both";
  vendorId: number | null;
  supplierId: number | null;
  name: string;
  representative: string | null;
  phone: string | null;
  email: string | null;
  businessNumber: string | null;
  address: string | null;
  supplyType: string[];
  supplyItems: string | null;
  paymentMethod: string | null;
  bankName: string | null;
  accountNumber: string | null;
  accountHolder: string | null;
  memo: string | null;
  linkedVendorId: number | null;
  isEditable: boolean;
  totalPurchases: number;
  totalPayments: number;
  outstandingBalance: number;
}

interface UnlinkedVendor {
  id: number;
  companyName: string;
}

export default function VendorManagementTab() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("__all__");
  const [filterSource, setFilterSource] = useState("__all__");

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingVendor, setEditingVendor] = useState<UnifiedVendor | null>(null);
  const [settingsVendor, setSettingsVendor] = useState<UnifiedVendor | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UnifiedVendor | null>(null);

  const [formName, setFormName] = useState("");
  const [formRepresentative, setFormRepresentative] = useState("");
  const [formBusinessNumber, setFormBusinessNumber] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formSupplyType, setFormSupplyType] = useState<string[]>([]);
  const [formSupplyItems, setFormSupplyItems] = useState("");
  const [formPaymentMethod, setFormPaymentMethod] = useState("");
  const [formBankName, setFormBankName] = useState("");
  const [formAccountNumber, setFormAccountNumber] = useState("");
  const [formAccountHolder, setFormAccountHolder] = useState("");
  const [formMemo, setFormMemo] = useState("");
  const [formLinkVendor, setFormLinkVendor] = useState(false);
  const [formLinkedVendorId, setFormLinkedVendorId] = useState("");

  const [settingsSupplyType, setSettingsSupplyType] = useState<string[]>([]);
  const [settingsBusinessNumber, setSettingsBusinessNumber] = useState("");
  const [settingsAddress, setSettingsAddress] = useState("");

  const { data, isLoading } = useQuery<{ vendors: UnifiedVendor[]; totalOutstanding: number }>({
    queryKey: ["/api/admin/accounting/vendors"],
  });

  const { data: unlinkedVendors = [] } = useQuery<UnlinkedVendor[]>({
    queryKey: ["/api/admin/accounting/unlinked-vendors", editingVendor?.supplierId || "new"],
    queryFn: async () => {
      const excludeParam = editingVendor?.supplierId ? `?excludeSupplierId=${editingVendor.supplierId}` : "";
      const res = await fetch(`/api/admin/accounting/unlinked-vendors${excludeParam}`, { credentials: "include" });
      if (!res.ok) throw new Error("조회 실패");
      return res.json();
    },
    enabled: showAddDialog || !!editingVendor,
  });

  const createMutation = useMutation({
    mutationFn: async (body: any) => {
      const res = await apiRequest("POST", "/api/admin/accounting/suppliers", body);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "등록 완료", description: "공급업체가 등록되었습니다." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/accounting/vendors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/accounting/unlinked-vendors"] });
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "등록 실패", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: any }) => {
      const res = await apiRequest("PUT", `/api/admin/accounting/suppliers/${id}`, body);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "수정 완료", description: "공급업체 정보가 수정되었습니다." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/accounting/vendors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/accounting/unlinked-vendors"] });
      setEditingVendor(null);
    },
    onError: (error: any) => {
      toast({ title: "수정 실패", description: error.message, variant: "destructive" });
    },
  });

  const settingsMutation = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: any }) => {
      const res = await apiRequest("PUT", `/api/admin/accounting/vendors/${id}/settings`, body);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "저장 완료", description: "회계 정보가 업데이트되었습니다." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/accounting/vendors"] });
      setSettingsVendor(null);
    },
    onError: (error: any) => {
      toast({ title: "저장 실패", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/admin/accounting/suppliers/${id}`);
      return res.json();
    },
    onSuccess: (data) => {
      const msg = data.action === "deactivated" ? "거래이력이 있어 비활성화되었습니다." : "삭제되었습니다.";
      toast({ title: "처리 완료", description: msg });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/accounting/vendors"] });
      setDeleteTarget(null);
    },
    onError: (error: any) => {
      toast({ title: "삭제 실패", description: error.message, variant: "destructive" });
    },
  });

  const vendors = data?.vendors || [];

  const filtered = vendors.filter(v => {
    if (search) {
      const term = search.toLowerCase();
      if (!v.name.toLowerCase().includes(term) && !(v.representative || "").toLowerCase().includes(term)) return false;
    }
    if (filterType !== "__all__") {
      if (!(v.supplyType || []).includes(filterType)) return false;
    }
    if (filterSource !== "__all__" && v.source !== filterSource) return false;
    return true;
  });

  const totalOutstanding = filtered.reduce((s, v) => s + (v.outstandingBalance || 0), 0);

  const resetForm = () => {
    setShowAddDialog(false);
    setFormName("");
    setFormRepresentative("");
    setFormBusinessNumber("");
    setFormPhone("");
    setFormEmail("");
    setFormAddress("");
    setFormSupplyType([]);
    setFormSupplyItems("");
    setFormPaymentMethod("");
    setFormBankName("");
    setFormAccountNumber("");
    setFormAccountHolder("");
    setFormMemo("");
    setFormLinkVendor(false);
    setFormLinkedVendorId("");
  };

  const openEditDialog = (v: UnifiedVendor) => {
    setEditingVendor(v);
    setFormName(v.name);
    setFormRepresentative(v.representative || "");
    setFormBusinessNumber(v.businessNumber || "");
    setFormPhone(v.phone || "");
    setFormEmail(v.email || "");
    setFormAddress(v.address || "");
    setFormSupplyType(v.supplyType || []);
    setFormSupplyItems(v.supplyItems || "");
    setFormPaymentMethod(v.paymentMethod || "");
    setFormBankName(v.bankName || "");
    setFormAccountNumber(v.accountNumber || "");
    setFormAccountHolder(v.accountHolder || "");
    setFormMemo(v.memo || "");
    setFormLinkVendor(!!v.linkedVendorId);
    setFormLinkedVendorId(v.linkedVendorId ? String(v.linkedVendorId) : "");
  };

  const openSettings = (v: UnifiedVendor) => {
    setSettingsVendor(v);
    setSettingsSupplyType(v.supplyType || []);
    setSettingsBusinessNumber(v.businessNumber || "");
    setSettingsAddress(v.address || "");
  };

  const toggleSupplyType = (type: string, current: string[], setter: (v: string[]) => void) => {
    setter(current.includes(type) ? current.filter(t => t !== type) : [...current, type]);
  };

  const getFormBody = () => ({
    name: formName,
    representative: formRepresentative || null,
    businessNumber: formBusinessNumber || null,
    phone: formPhone || null,
    email: formEmail || null,
    address: formAddress || null,
    supplyType: formSupplyType,
    supplyItems: formSupplyItems || null,
    paymentMethod: formPaymentMethod || null,
    bankName: formBankName || null,
    accountNumber: formAccountNumber || null,
    accountHolder: formAccountHolder || null,
    memo: formMemo || null,
    linkedVendorId: formLinkVendor && formLinkedVendorId ? parseInt(formLinkedVendorId) : null,
  });

  const handleCreate = () => {
    if (!formName.trim()) { toast({ title: "업체명을 입력해주세요", variant: "destructive" }); return; }
    if (formSupplyType.length === 0) { toast({ title: "공급 유형을 1개 이상 선택해주세요", variant: "destructive" }); return; }
    createMutation.mutate(getFormBody());
  };

  const handleUpdate = () => {
    if (!editingVendor?.supplierId) return;
    if (!formName.trim()) { toast({ title: "업체명을 입력해주세요", variant: "destructive" }); return; }
    if (formSupplyType.length === 0) { toast({ title: "공급 유형을 1개 이상 선택해주세요", variant: "destructive" }); return; }
    updateMutation.mutate({ id: editingVendor.supplierId, body: getFormBody() });
  };

  const handleSettingsSave = () => {
    if (!settingsVendor?.vendorId) return;
    settingsMutation.mutate({ id: settingsVendor.vendorId, body: { supplyType: settingsSupplyType, businessNumber: settingsBusinessNumber, address: settingsAddress } });
  };

  const sourceBadge = (source: string) => {
    switch (source) {
      case "vendor": return <Badge variant="outline" className="no-default-active-elevate text-xs text-blue-600 border-blue-300"><LinkIcon className="h-3 w-3 mr-1" />외주</Badge>;
      case "supplier": return <Badge variant="outline" className="no-default-active-elevate text-xs text-emerald-600 border-emerald-300"><Pencil className="h-3 w-3 mr-1" />직접</Badge>;
      case "both": return <Badge variant="outline" className="no-default-active-elevate text-xs text-purple-600 border-purple-300"><LinkIcon className="h-3 w-3 mr-1" />외주+공급</Badge>;
      default: return null;
    }
  };

  const SupplierFormFields = ({ isEdit }: { isEdit?: boolean }) => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>업체명 <span className="text-red-500">*</span></Label>
          <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="업체명" data-testid="input-supplier-name" />
        </div>
        <div className="space-y-2">
          <Label>대표자명</Label>
          <Input value={formRepresentative} onChange={(e) => setFormRepresentative(e.target.value)} placeholder="대표자명" data-testid="input-supplier-rep" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>사업자번호</Label>
          <Input value={formBusinessNumber} onChange={(e) => setFormBusinessNumber(e.target.value)} placeholder="000-00-00000" data-testid="input-supplier-biz" />
        </div>
        <div className="space-y-2">
          <Label>연락처</Label>
          <Input value={formPhone} onChange={(e) => setFormPhone(e.target.value)} placeholder="전화번호" data-testid="input-supplier-phone" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>이메일</Label>
          <Input value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="이메일" data-testid="input-supplier-email" />
        </div>
        <div className="space-y-2">
          <Label>주소</Label>
          <Input value={formAddress} onChange={(e) => setFormAddress(e.target.value)} placeholder="주소" data-testid="input-supplier-address" />
        </div>
      </div>
      <div className="space-y-2">
        <Label>공급 유형 <span className="text-red-500">*</span></Label>
        <div className="flex flex-wrap gap-3">
          {Object.entries(supplyTypeLabels).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={formSupplyType.includes(key)} onCheckedChange={() => toggleSupplyType(key, formSupplyType, setFormSupplyType)} data-testid={`checkbox-form-supply-${key}`} />
              <span className="text-sm">{label}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label>취급 품목</Label>
        <Input value={formSupplyItems} onChange={(e) => setFormSupplyItems(e.target.value)} placeholder="사과, 배, 복숭아..." data-testid="input-supplier-items" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>결제 방식</Label>
          <Select value={formPaymentMethod || "__none__"} onValueChange={(v) => setFormPaymentMethod(v === "__none__" ? "" : v)}>
            <SelectTrigger data-testid="select-payment-method"><SelectValue placeholder="선택" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">미설정</SelectItem>
              <SelectItem value="transfer">계좌이체</SelectItem>
              <SelectItem value="cash">현금</SelectItem>
              <SelectItem value="bill">어음</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>은행명</Label>
          <Input value={formBankName} onChange={(e) => setFormBankName(e.target.value)} placeholder="은행명" data-testid="input-supplier-bank" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>계좌번호</Label>
          <Input value={formAccountNumber} onChange={(e) => setFormAccountNumber(e.target.value)} placeholder="계좌번호" data-testid="input-supplier-account" />
        </div>
        <div className="space-y-2">
          <Label>예금주</Label>
          <Input value={formAccountHolder} onChange={(e) => setFormAccountHolder(e.target.value)} placeholder="예금주" data-testid="input-supplier-holder" />
        </div>
      </div>

      <div className="space-y-3 border-t pt-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox checked={formLinkVendor} onCheckedChange={(checked) => {
            setFormLinkVendor(!!checked);
            if (!checked) setFormLinkedVendorId("");
          }} data-testid="checkbox-link-vendor" />
          <span className="text-sm font-medium">기존 외주업체와 동일한 업체입니다</span>
        </label>
        {formLinkVendor && (
          <div className="space-y-2 pl-6">
            <Select value={formLinkedVendorId || "__none__"} onValueChange={(v) => setFormLinkedVendorId(v === "__none__" ? "" : v)}>
              <SelectTrigger data-testid="select-linked-vendor"><SelectValue placeholder="외주업체 선택" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">선택 안함</SelectItem>
                {unlinkedVendors.map(v => (
                  <SelectItem key={v.id} value={String(v.id)}>{v.companyName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">연결하면 장부에서 하나의 업체로 통합 표시됩니다</p>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label>메모</Label>
        <Textarea value={formMemo} onChange={(e) => setFormMemo(e.target.value)} placeholder="특이사항" data-testid="input-supplier-memo" />
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-md p-3">
            <Info className="h-4 w-4 shrink-0" />
            <span>외주업체는 사이트 외주업체 관리에서 자동 연동됩니다. 직접 공급업체는 여기서 등록/수정합니다.</span>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-end gap-2 justify-between">
        <div className="flex flex-wrap items-end gap-2">
          <div className="relative min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="업체명 검색..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" data-testid="input-vendor-search" />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[130px]" data-testid="select-filter-type">
              <SelectValue placeholder="공급유형" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">전체</SelectItem>
              <SelectItem value="raw">원물</SelectItem>
              <SelectItem value="semi">반재료</SelectItem>
              <SelectItem value="subsidiary">부자재</SelectItem>
              <SelectItem value="etc">기타</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterSource} onValueChange={setFilterSource}>
            <SelectTrigger className="w-[140px]" data-testid="select-filter-source">
              <SelectValue placeholder="출처" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">전체</SelectItem>
              <SelectItem value="vendor">외주 연동</SelectItem>
              <SelectItem value="supplier">직접 등록</SelectItem>
              <SelectItem value="both">외주+공급</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setShowAddDialog(true)} data-testid="button-add-supplier">
          <Plus className="h-4 w-4 mr-1" />공급업체 등록
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <>
          <div className="border rounded-lg overflow-x-auto overflow-y-auto max-h-[600px]">
            <Table className="min-w-[1000px]">
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead>출처</TableHead>
                  <TableHead>업체명</TableHead>
                  <TableHead>대표자</TableHead>
                  <TableHead>연락처</TableHead>
                  <TableHead>공급유형</TableHead>
                  <TableHead className="text-right">외상잔액</TableHead>
                  <TableHead className="text-center">관리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">공급업체 데이터가 없습니다</TableCell>
                  </TableRow>
                ) : (
                  filtered.map((vendor) => (
                    <TableRow key={vendor.id} data-testid={`row-vendor-${vendor.id}`}>
                      <TableCell>{sourceBadge(vendor.source)}</TableCell>
                      <TableCell className="font-medium">{vendor.name}</TableCell>
                      <TableCell>{vendor.representative || "-"}</TableCell>
                      <TableCell>{vendor.phone || "-"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(vendor.supplyType || []).length > 0
                            ? vendor.supplyType.map(t => (
                                <Badge key={t} variant="outline" className="no-default-active-elevate text-xs">
                                  {supplyTypeLabels[t] || t}
                                </Badge>
                              ))
                            : <span className="text-muted-foreground text-xs">미설정</span>
                          }
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`font-medium ${(vendor.outstandingBalance || 0) >= 1000000 ? "text-red-600" : ""}`}>
                          {(vendor.outstandingBalance || 0) >= 1000000 && <AlertTriangle className="h-3 w-3 inline mr-1" />}
                          {(vendor.outstandingBalance || 0).toLocaleString()}원
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          {vendor.source === "vendor" ? (
                            <Button size="sm" variant="outline" onClick={() => openSettings(vendor)} data-testid={`button-vendor-settings-${vendor.id}`}>
                              <Settings className="h-3 w-3 mr-1" />설정
                            </Button>
                          ) : (
                            <>
                              <Button size="sm" variant="outline" onClick={() => openEditDialog(vendor)} data-testid={`button-vendor-edit-${vendor.id}`}>
                                <Pencil className="h-3 w-3 mr-1" />수정
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(vendor)} data-testid={`button-vendor-delete-${vendor.id}`}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="text-sm text-muted-foreground">
            총 {filtered.length}개 업체 | 외상 잔액 합계: <span className="font-semibold text-foreground">{totalOutstanding.toLocaleString()}원</span>
          </div>
        </>
      )}

      {/* 공급업체 등록 모달 */}
      <Dialog open={showAddDialog} onOpenChange={() => resetForm()}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>공급업체 등록</DialogTitle>
          </DialogHeader>
          <SupplierFormFields />
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={resetForm} data-testid="button-cancel-add">취소</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending} data-testid="button-submit-add">
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}등록
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 공급업체 수정 모달 */}
      <Dialog open={!!editingVendor} onOpenChange={() => setEditingVendor(null)}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingVendor?.name} — 수정</DialogTitle>
          </DialogHeader>
          <SupplierFormFields isEdit />
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setEditingVendor(null)} data-testid="button-cancel-edit">취소</Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending} data-testid="button-submit-edit">
              {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}저장
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 외주업체 회계 설정 모달 */}
      <Dialog open={!!settingsVendor} onOpenChange={() => setSettingsVendor(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{settingsVendor?.name} — 회계 설정</DialogTitle>
          </DialogHeader>
          {settingsVendor && (
            <div className="space-y-5">
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">기본 정보 (외주업체 관리 연동)</h4>
                <div className="bg-muted/50 rounded-md p-3 space-y-1 text-sm">
                  <div>업체명: <span className="font-medium">{settingsVendor.name}</span></div>
                  <div>담당자: {settingsVendor.representative || "-"} | 연락처: {settingsVendor.phone || "-"}</div>
                  <div>은행: {settingsVendor.bankName || "-"} | 계좌: {settingsVendor.accountNumber || "-"}</div>
                  <p className="text-xs text-muted-foreground mt-1">기본 정보 수정은 외주업체 관리에서 합니다</p>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-medium">회계 추가 정보</h4>
                <div className="space-y-2">
                  <Label>공급 유형</Label>
                  <div className="flex flex-wrap gap-3">
                    {Object.entries(supplyTypeLabels).map(([key, label]) => (
                      <label key={key} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox checked={settingsSupplyType.includes(key)} onCheckedChange={() => toggleSupplyType(key, settingsSupplyType, setSettingsSupplyType)} data-testid={`checkbox-settings-supply-${key}`} />
                        <span className="text-sm">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>사업자번호</Label>
                  <Input value={settingsBusinessNumber} onChange={(e) => setSettingsBusinessNumber(e.target.value)} placeholder="123-45-67890" data-testid="input-settings-biz" />
                </div>
                <div className="space-y-2">
                  <Label>주소</Label>
                  <Textarea value={settingsAddress} onChange={(e) => setSettingsAddress(e.target.value)} placeholder="사업장 주소" data-testid="input-settings-address" />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSettingsVendor(null)} data-testid="button-cancel-settings">취소</Button>
                <Button onClick={handleSettingsSave} disabled={settingsMutation.isPending} data-testid="button-save-settings">
                  {settingsMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}저장
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 모달 */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>공급업체 삭제</DialogTitle>
          </DialogHeader>
          {deleteTarget && (
            <div className="space-y-4">
              <p className="text-sm">
                <span className="font-medium">{deleteTarget.name}</span>을(를) 삭제하시겠습니까?
              </p>
              {(deleteTarget.totalPurchases > 0 || deleteTarget.totalPayments > 0) && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md p-3 text-sm text-amber-800 dark:text-amber-200">
                  <AlertTriangle className="h-4 w-4 inline mr-1" />
                  거래이력이 있어 비활성화됩니다. 목록에서 숨겨지지만 기존 거래 데이터는 유지됩니다.
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDeleteTarget(null)}>취소</Button>
                <Button variant="destructive" onClick={() => deleteTarget.supplierId && deleteMutation.mutate(deleteTarget.supplierId)} disabled={deleteMutation.isPending} data-testid="button-confirm-delete">
                  {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}삭제
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
