import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Loader2, Search, Building2, Settings, AlertTriangle, Info } from "lucide-react";

const supplyTypeLabels: Record<string, string> = {
  raw: "원물",
  semi: "반재료",
  subsidiary: "부자재",
  etc: "기타",
};

interface VendorWithBalance {
  id: number;
  companyName: string;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  bankName: string | null;
  bankAccount: string | null;
  bankHolder: string | null;
  isActive: boolean;
  memo: string | null;
  supplyType: string[];
  businessNumber: string | null;
  address: string | null;
  outstandingBalance: number;
  totalPurchases: number;
  totalPayments: number;
}

export default function VendorManagementTab() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("__all__");
  const [filterStatus, setFilterStatus] = useState("__all__");
  const [settingsVendor, setSettingsVendor] = useState<VendorWithBalance | null>(null);
  const [formSupplyType, setFormSupplyType] = useState<string[]>([]);
  const [formBusinessNumber, setFormBusinessNumber] = useState("");
  const [formAddress, setFormAddress] = useState("");

  const { data: vendors = [], isLoading } = useQuery<VendorWithBalance[]>({
    queryKey: ["/api/admin/accounting/vendors"],
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PUT", `/api/admin/accounting/vendors/${id}`, data);
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

  const filtered = vendors.filter(v => {
    if (search) {
      const term = search.toLowerCase();
      if (!v.companyName.toLowerCase().includes(term) && !(v.contactName || "").toLowerCase().includes(term)) return false;
    }
    if (filterType !== "__all__") {
      if (!v.supplyType?.includes(filterType)) return false;
    }
    if (filterStatus !== "__all__") {
      if (filterStatus === "active" && !v.isActive) return false;
      if (filterStatus === "inactive" && v.isActive) return false;
    }
    return true;
  });

  const totalOutstanding = filtered.reduce((s, v) => s + (v.outstandingBalance || 0), 0);

  const openSettings = (vendor: VendorWithBalance) => {
    setSettingsVendor(vendor);
    setFormSupplyType(vendor.supplyType || []);
    setFormBusinessNumber(vendor.businessNumber || "");
    setFormAddress(vendor.address || "");
  };

  const handleSave = () => {
    if (!settingsVendor) return;
    updateMutation.mutate({
      id: settingsVendor.id,
      data: { supplyType: formSupplyType, businessNumber: formBusinessNumber, address: formAddress },
    });
  };

  const toggleSupplyType = (type: string) => {
    setFormSupplyType(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-md p-3">
            <Info className="h-4 w-4 shrink-0" />
            <span>사이트 외주업체 관리와 자동 연동됩니다. 업체 등록/수정은 <strong>외주업체 관리</strong> 메뉴에서 합니다.</span>
          </div>
        </CardContent>
      </Card>

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
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[120px]" data-testid="select-filter-status">
            <SelectValue placeholder="상태" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">전체</SelectItem>
            <SelectItem value="active">활성</SelectItem>
            <SelectItem value="inactive">비활성</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <>
          <div className="border rounded-lg overflow-x-auto overflow-y-auto max-h-[600px]">
            <Table className="min-w-[900px]">
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead>업체명</TableHead>
                  <TableHead>담당자</TableHead>
                  <TableHead>연락처</TableHead>
                  <TableHead>공급유형</TableHead>
                  <TableHead className="text-right">총 매입액</TableHead>
                  <TableHead className="text-right">총 입금액</TableHead>
                  <TableHead className="text-right">외상잔액</TableHead>
                  <TableHead className="text-center">설정</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">공급업체 데이터가 없습니다</TableCell>
                  </TableRow>
                ) : (
                  filtered.map((vendor) => (
                    <TableRow key={vendor.id} data-testid={`row-vendor-${vendor.id}`}>
                      <TableCell className="font-medium">{vendor.companyName}</TableCell>
                      <TableCell>{vendor.contactName || "-"}</TableCell>
                      <TableCell>{vendor.contactPhone || "-"}</TableCell>
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
                      <TableCell className="text-right">{(vendor.totalPurchases || 0).toLocaleString()}원</TableCell>
                      <TableCell className="text-right">{(vendor.totalPayments || 0).toLocaleString()}원</TableCell>
                      <TableCell className="text-right">
                        <span className={`font-medium ${(vendor.outstandingBalance || 0) >= 1000000 ? "text-red-600" : ""}`}>
                          {(vendor.outstandingBalance || 0) >= 1000000 && <AlertTriangle className="h-3 w-3 inline mr-1" />}
                          {(vendor.outstandingBalance || 0).toLocaleString()}원
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button size="sm" variant="outline" onClick={() => openSettings(vendor)} data-testid={`button-vendor-settings-${vendor.id}`}>
                          <Settings className="h-3 w-3 mr-1" />설정
                        </Button>
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

      <Dialog open={!!settingsVendor} onOpenChange={() => setSettingsVendor(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{settingsVendor?.companyName} — 회계 설정</DialogTitle>
          </DialogHeader>
          {settingsVendor && (
            <div className="space-y-5">
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">기본 정보 (외주업체 관리 연동)</h4>
                <div className="bg-muted/50 rounded-md p-3 space-y-1 text-sm">
                  <div>업체명: <span className="font-medium">{settingsVendor.companyName}</span></div>
                  <div>담당자: {settingsVendor.contactName || "-"} | 연락처: {settingsVendor.contactPhone || "-"}</div>
                  <div>은행: {settingsVendor.bankName || "-"} | 계좌: {settingsVendor.bankAccount || "-"}</div>
                  <p className="text-xs text-muted-foreground mt-1">수정은 외주업체 관리에서 합니다</p>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-medium">회계 추가 정보</h4>
                <div className="space-y-2">
                  <Label>공급 유형</Label>
                  <div className="flex flex-wrap gap-3">
                    {Object.entries(supplyTypeLabels).map(([key, label]) => (
                      <label key={key} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox checked={formSupplyType.includes(key)} onCheckedChange={() => toggleSupplyType(key)} data-testid={`checkbox-supply-${key}`} />
                        <span className="text-sm">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>사업자번호</Label>
                  <Input value={formBusinessNumber} onChange={(e) => setFormBusinessNumber(e.target.value)} placeholder="123-45-67890" data-testid="input-business-number" />
                </div>
                <div className="space-y-2">
                  <Label>주소</Label>
                  <Textarea value={formAddress} onChange={(e) => setFormAddress(e.target.value)} placeholder="사업장 주소" data-testid="input-vendor-address" />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSettingsVendor(null)} data-testid="button-cancel-settings">취소</Button>
                <Button onClick={handleSave} disabled={updateMutation.isPending} data-testid="button-save-settings">
                  {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}저장
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
