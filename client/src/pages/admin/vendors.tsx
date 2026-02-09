import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { PageHeader } from "@/components/admin/page-header";
import {
  Loader2,
  Plus,
  Pencil,
  ToggleLeft,
  ToggleRight,
  Search,
  Building2,
} from "lucide-react";

interface Vendor {
  id: number;
  companyName: string;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  loginId: string | null;
  settlementCycle: string | null;
  bankName: string | null;
  bankAccount: string | null;
  bankHolder: string | null;
  isActive: boolean | null;
  memo: string | null;
  createdAt: string;
  updatedAt: string;
}

const settlementCycleLabels: Record<string, string> = {
  monthly: "월 1회",
  weekly: "주 1회",
  per_order: "건별",
};

export default function VendorManagement() {
  const { toast } = useToast();
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [searchText, setSearchText] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);

  const [form, setForm] = useState({
    companyName: "",
    contactName: "",
    contactPhone: "",
    contactEmail: "",
    loginId: "",
    loginPassword: "",
    settlementCycle: "monthly",
    bankName: "",
    bankAccount: "",
    bankHolder: "",
    memo: "",
  });

  const queryParams = new URLSearchParams();
  if (filter === "active") queryParams.set("isActive", "true");
  if (filter === "inactive") queryParams.set("isActive", "false");
  if (searchText) queryParams.set("search", searchText);

  const { data: vendors = [], isLoading } = useQuery<Vendor[]>({
    queryKey: ["/api/admin/vendors", filter, searchText],
    queryFn: async () => {
      const res = await fetch(`/api/admin/vendors?${queryParams.toString()}`);
      if (!res.ok) throw new Error("조회 실패");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      await apiRequest("POST", "/api/admin/vendors", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/vendors"] });
      toast({ title: "업체 등록 완료" });
      closeDialog();
    },
    onError: (error: any) => {
      toast({ title: "등록 실패", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof form }) => {
      await apiRequest("PUT", `/api/admin/vendors/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/vendors"] });
      toast({ title: "업체 수정 완료" });
      closeDialog();
    },
    onError: (error: any) => {
      toast({ title: "수정 실패", description: error.message, variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("PUT", `/api/admin/vendors/${id}/toggle-active`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/vendors"] });
      toast({ title: "상태 변경 완료" });
    },
    onError: (error: any) => {
      toast({ title: "변경 실패", description: error.message, variant: "destructive" });
    },
  });

  function closeDialog() {
    setDialogOpen(false);
    setEditingVendor(null);
    setForm({
      companyName: "", contactName: "", contactPhone: "", contactEmail: "",
      loginId: "", loginPassword: "", settlementCycle: "monthly",
      bankName: "", bankAccount: "", bankHolder: "", memo: "",
    });
  }

  function openCreate() {
    setEditingVendor(null);
    setForm({
      companyName: "", contactName: "", contactPhone: "", contactEmail: "",
      loginId: "", loginPassword: "", settlementCycle: "monthly",
      bankName: "", bankAccount: "", bankHolder: "", memo: "",
    });
    setDialogOpen(true);
  }

  function openEdit(v: Vendor) {
    setEditingVendor(v);
    setForm({
      companyName: v.companyName,
      contactName: v.contactName || "",
      contactPhone: v.contactPhone || "",
      contactEmail: v.contactEmail || "",
      loginId: v.loginId || "",
      loginPassword: "",
      settlementCycle: v.settlementCycle || "monthly",
      bankName: v.bankName || "",
      bankAccount: v.bankAccount || "",
      bankHolder: v.bankHolder || "",
      memo: v.memo || "",
    });
    setDialogOpen(true);
  }

  function handleSubmit() {
    if (editingVendor) {
      updateMutation.mutate({ id: editingVendor.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  }

  const activeCount = vendors.filter(v => v.isActive).length;
  const inactiveCount = vendors.filter(v => !v.isActive).length;

  return (
    <div className="space-y-4">
      <PageHeader
        title="외주업체 관리"
        description="외주 협력업체를 등록하고 관리합니다"
        icon={Building2}
        actions={
          <Button onClick={openCreate} data-testid="button-add-vendor">
            <Plus className="h-4 w-4 mr-1" /> 업체 등록
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("all")}
            data-testid="filter-all"
          >
            전체 ({vendors.length})
          </Button>
          <Button
            variant={filter === "active" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("active")}
            data-testid="filter-active"
          >
            활성 ({activeCount})
          </Button>
          <Button
            variant={filter === "inactive" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("inactive")}
            data-testid="filter-inactive"
          >
            비활성 ({inactiveCount})
          </Button>
        </div>
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="업체명, 담당자명 검색"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="pl-8"
            data-testid="input-search-vendor"
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : vendors.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              등록된 업체가 없습니다
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>업체명</TableHead>
                    <TableHead>담당자</TableHead>
                    <TableHead>연락처</TableHead>
                    <TableHead>정산주기</TableHead>
                    <TableHead>로그인ID</TableHead>
                    <TableHead className="text-center">상태</TableHead>
                    <TableHead>등록일</TableHead>
                    <TableHead className="text-center">액션</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendors.map((v) => (
                    <TableRow key={v.id} data-testid={`row-vendor-${v.id}`}>
                      <TableCell className="font-medium" data-testid={`text-vendor-name-${v.id}`}>{v.companyName}</TableCell>
                      <TableCell>{v.contactName || "-"}</TableCell>
                      <TableCell>{v.contactPhone || "-"}</TableCell>
                      <TableCell>{settlementCycleLabels[v.settlementCycle || "monthly"] || v.settlementCycle}</TableCell>
                      <TableCell>{v.loginId || "-"}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={v.isActive ? "default" : "secondary"} data-testid={`badge-status-${v.id}`}>
                          {v.isActive ? "활성" : "비활성"}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(v.createdAt).toLocaleDateString("ko-KR")}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(v)}
                            data-testid={`button-edit-vendor-${v.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleMutation.mutate(v.id)}
                            data-testid={`button-toggle-vendor-${v.id}`}
                          >
                            {v.isActive ? (
                              <ToggleRight className="h-4 w-4 text-green-500" />
                            ) : (
                              <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingVendor ? "업체 수정" : "업체 등록"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>업체명 *</Label>
              <Input
                value={form.companyName}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                placeholder="업체명 입력"
                data-testid="input-company-name"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>담당자명</Label>
                <Input
                  value={form.contactName}
                  onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                  placeholder="담당자명"
                  data-testid="input-contact-name"
                />
              </div>
              <div className="space-y-2">
                <Label>연락처</Label>
                <Input
                  value={form.contactPhone}
                  onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                  placeholder="010-1234-5678"
                  data-testid="input-contact-phone"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>이메일</Label>
              <Input
                value={form.contactEmail}
                onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                placeholder="email@example.com"
                data-testid="input-contact-email"
              />
            </div>

            <div className="border-t pt-4 space-y-2">
              <p className="text-sm font-medium text-muted-foreground">로그인 정보</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>로그인ID *</Label>
                  <Input
                    value={form.loginId}
                    onChange={(e) => setForm({ ...form, loginId: e.target.value })}
                    placeholder="로그인 ID"
                    disabled={!!editingVendor}
                    data-testid="input-login-id"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{editingVendor ? "비밀번호 (변경 시만)" : "비밀번호 *"}</Label>
                  <Input
                    type="password"
                    value={form.loginPassword}
                    onChange={(e) => setForm({ ...form, loginPassword: e.target.value })}
                    placeholder={editingVendor ? "변경할 경우 입력" : "비밀번호"}
                    data-testid="input-login-password"
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-4 space-y-2">
              <p className="text-sm font-medium text-muted-foreground">정산 정보</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>정산주기</Label>
                  <Select
                    value={form.settlementCycle}
                    onValueChange={(value) => setForm({ ...form, settlementCycle: value })}
                  >
                    <SelectTrigger data-testid="select-settlement-cycle">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">월 1회</SelectItem>
                      <SelectItem value="weekly">주 1회</SelectItem>
                      <SelectItem value="per_order">건별</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>은행명</Label>
                  <Input
                    value={form.bankName}
                    onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                    placeholder="은행명"
                    data-testid="input-bank-name"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>계좌번호</Label>
                  <Input
                    value={form.bankAccount}
                    onChange={(e) => setForm({ ...form, bankAccount: e.target.value })}
                    placeholder="계좌번호"
                    data-testid="input-bank-account"
                  />
                </div>
                <div className="space-y-2">
                  <Label>예금주</Label>
                  <Input
                    value={form.bankHolder}
                    onChange={(e) => setForm({ ...form, bankHolder: e.target.value })}
                    placeholder="예금주"
                    data-testid="input-bank-holder"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>메모</Label>
              <Textarea
                value={form.memo}
                onChange={(e) => setForm({ ...form, memo: e.target.value })}
                placeholder="메모 입력"
                data-testid="input-vendor-memo"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={closeDialog} data-testid="button-cancel">
              취소
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-submit-vendor"
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              )}
              {editingVendor ? "수정" : "등록"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
