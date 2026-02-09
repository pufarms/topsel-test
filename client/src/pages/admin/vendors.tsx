import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Loader2,
  Plus,
  Pencil,
  ToggleLeft,
  ToggleRight,
  Search,
  Building2,
  CheckCircle,
  XCircle,
  Download,
  Eye,
  EyeOff,
} from "lucide-react";
import * as XLSX from "xlsx";

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
    confirmPassword: "",
    settlementCycle: "monthly",
    bankName: "",
    bankAccount: "",
    bankHolder: "",
    memo: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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
    mutationFn: async (data: Omit<typeof form, "confirmPassword">) => {
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
    mutationFn: async ({ id, data }: { id: number; data: Omit<typeof form, "confirmPassword"> }) => {
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
    setShowPassword(false);
    setShowConfirmPassword(false);
    setForm({
      companyName: "", contactName: "", contactPhone: "", contactEmail: "",
      loginId: "", loginPassword: "", confirmPassword: "", settlementCycle: "monthly",
      bankName: "", bankAccount: "", bankHolder: "", memo: "",
    });
  }

  function openCreate() {
    setEditingVendor(null);
    setShowPassword(false);
    setShowConfirmPassword(false);
    setForm({
      companyName: "", contactName: "", contactPhone: "", contactEmail: "",
      loginId: "", loginPassword: "", confirmPassword: "", settlementCycle: "monthly",
      bankName: "", bankAccount: "", bankHolder: "", memo: "",
    });
    setDialogOpen(true);
  }

  function openEdit(v: Vendor) {
    setEditingVendor(v);
    setShowPassword(false);
    setShowConfirmPassword(false);
    setForm({
      companyName: v.companyName,
      contactName: v.contactName || "",
      contactPhone: v.contactPhone || "",
      contactEmail: v.contactEmail || "",
      loginId: v.loginId || "",
      loginPassword: "",
      confirmPassword: "",
      settlementCycle: v.settlementCycle || "monthly",
      bankName: v.bankName || "",
      bankAccount: v.bankAccount || "",
      bankHolder: v.bankHolder || "",
      memo: v.memo || "",
    });
    setDialogOpen(true);
  }

  function handleSubmit() {
    if (form.loginPassword && form.loginPassword !== form.confirmPassword) {
      toast({ title: "비밀번호 불일치", description: "비밀번호와 비밀번호 확인이 일치하지 않습니다.", variant: "destructive" });
      return;
    }
    if (!editingVendor && !form.loginPassword) {
      toast({ title: "비밀번호 필수", description: "신규 등록 시 비밀번호를 입력해주세요.", variant: "destructive" });
      return;
    }
    const { confirmPassword: _, ...submitData } = form;
    if (editingVendor) {
      updateMutation.mutate({ id: editingVendor.id, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  }

  const activeCount = vendors.filter(v => v.isActive).length;
  const inactiveCount = vendors.filter(v => !v.isActive).length;

  const recentVendors = [...vendors].sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  ).slice(0, 5);

  const settlementStats = Object.entries(settlementCycleLabels).map(([key, label]) => ({
    label,
    count: vendors.filter(v => v.settlementCycle === key).length,
  })).filter(s => s.count > 0);

  const formatDate = (date: Date | string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  const exportToExcel = () => {
    const data = vendors.map(v => ({
      "업체명": v.companyName,
      "담당자명": v.contactName || "",
      "연락처": v.contactPhone || "",
      "이메일": v.contactEmail || "",
      "로그인ID": v.loginId || "",
      "정산주기": settlementCycleLabels[v.settlementCycle || "monthly"] || v.settlementCycle || "",
      "은행명": v.bankName || "",
      "계좌번호": v.bankAccount || "",
      "예금주": v.bankHolder || "",
      "상태": v.isActive ? "활성" : "비활성",
      "등록일": formatDate(v.createdAt),
      "메모": v.memo || "",
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "외주업체");
    XLSX.writeFile(wb, `외주업체_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-xl md:text-2xl font-bold">외주(공급)업체 관리</h1>
        <Button onClick={openCreate} data-testid="button-add-vendor">
          <Plus className="h-4 w-4 mr-2" />
          외주업체 등록
        </Button>
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList>
          <TabsTrigger value="dashboard" data-testid="tab-dashboard">대시보드</TabsTrigger>
          <TabsTrigger value="list" data-testid="tab-list">외주업체 목록</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium">전체 외주업체</CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-total-count">{vendors.length}개</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium">활성 업체</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-active-count">{activeCount}개</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium">비활성 업체</CardTitle>
                <XCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-inactive-count">{inactiveCount}개</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  최근 등록된 외주업체
                </CardTitle>
              </CardHeader>
              <CardContent>
                {recentVendors.length === 0 ? (
                  <p className="text-sm text-muted-foreground">등록된 외주업체가 없습니다</p>
                ) : (
                  <div className="space-y-3">
                    {recentVendors.map((vendor) => (
                      <div key={vendor.id} className="flex items-center justify-between text-sm">
                        <div>
                          <span className="font-medium">{vendor.companyName}</span>
                          <Badge variant={vendor.isActive ? "default" : "secondary"} className="ml-2 text-xs">
                            {vendor.isActive ? "활성" : "비활성"}
                          </Badge>
                        </div>
                        <span className="text-muted-foreground">{formatDate(vendor.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  정산주기별 업체 현황
                </CardTitle>
              </CardHeader>
              <CardContent>
                {settlementStats.length === 0 ? (
                  <p className="text-sm text-muted-foreground">정산주기 정보가 없습니다</p>
                ) : (
                  <div className="space-y-3">
                    {settlementStats.map((stat) => (
                      <div key={stat.label} className="flex items-center justify-between text-sm">
                        <span className="font-medium">{stat.label}</span>
                        <span className="text-muted-foreground">{stat.count}개 업체</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="list">
          <Card>
            <CardHeader>
              <CardTitle>외주업체 목록</CardTitle>
              <CardDescription>상품을 공급하는 외주업체 목록</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="업체명, 담당자명 검색..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    className="pl-8"
                    data-testid="input-search-vendor"
                  />
                </div>
                <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
                  <SelectTrigger className="w-28" data-testid="select-status-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 상태</SelectItem>
                    <SelectItem value="active">활성</SelectItem>
                    <SelectItem value="inactive">비활성</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={exportToExcel} data-testid="button-export">
                  <Download className="h-4 w-4 mr-2" />
                  엑셀 다운로드
                </Button>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : vendors.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  검색 결과가 없습니다
                </div>
              ) : (
                <>
                  <div className="hidden lg:block table-scroll-container">
                    <Table>
                      <TableHeader className="sticky top-0 z-10 bg-background">
                        <TableRow>
                          <TableHead>업체명</TableHead>
                          <TableHead>담당자</TableHead>
                          <TableHead>연락처</TableHead>
                          <TableHead>정산주기</TableHead>
                          <TableHead>로그인ID</TableHead>
                          <TableHead className="text-center">상태</TableHead>
                          <TableHead>등록일</TableHead>
                          <TableHead className="w-20 text-center">관리</TableHead>
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
                            <TableCell>{formatDate(v.createdAt)}</TableCell>
                            <TableCell>
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openEdit(v)}
                                  data-testid={`button-edit-vendor-${v.id}`}
                                  title="수정"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => toggleMutation.mutate(v.id)}
                                  data-testid={`button-toggle-vendor-${v.id}`}
                                  title={v.isActive ? "비활성화" : "활성화"}
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

                  <div className="lg:hidden space-y-3">
                    {vendors.map((v) => (
                      <Card key={v.id} className="p-4" data-testid={`card-vendor-${v.id}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold">{v.companyName}</span>
                              <Badge variant={v.isActive ? "default" : "secondary"} className="text-xs">
                                {v.isActive ? "활성" : "비활성"}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">{v.contactName || "-"}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => openEdit(v)}
                              data-testid={`button-edit-mobile-${v.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => toggleMutation.mutate(v.id)}
                              data-testid={`button-toggle-mobile-${v.id}`}
                            >
                              {v.isActive ? (
                                <ToggleRight className="h-4 w-4 text-green-500" />
                              ) : (
                                <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                              )}
                            </Button>
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">연락처</span>
                            <p className="font-medium">{v.contactPhone || "-"}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">정산주기</span>
                            <p className="font-medium">{settlementCycleLabels[v.settlementCycle || "monthly"] || "-"}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">로그인ID</span>
                            <p className="font-medium">{v.loginId || "-"}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">등록일</span>
                            <p className="font-medium">{formatDate(v.createdAt)}</p>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={form.loginPassword}
                      onChange={(e) => setForm({ ...form, loginPassword: e.target.value })}
                      placeholder={editingVendor ? "변경할 경우 입력" : "비밀번호"}
                      className="pr-12"
                      data-testid="input-login-password"
                    />
                    <button
                      type="button"
                      className="absolute right-3 inset-y-0 flex items-center justify-center"
                      onClick={() => setShowPassword(!showPassword)}
                      data-testid="button-toggle-password"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{editingVendor ? "비밀번호 확인" : "비밀번호 확인 *"}</Label>
                  <div className="relative">
                    <Input
                      type={showConfirmPassword ? "text" : "password"}
                      value={form.confirmPassword}
                      onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                      placeholder="비밀번호를 다시 입력하세요"
                      className="pr-12"
                      data-testid="input-confirm-password"
                    />
                    <button
                      type="button"
                      className="absolute right-3 inset-y-0 flex items-center justify-center"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      data-testid="button-toggle-confirm-password"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                  </div>
                  {form.loginPassword && form.confirmPassword && form.loginPassword !== form.confirmPassword && (
                    <p className="text-xs text-destructive" data-testid="text-password-mismatch">비밀번호가 일치하지 않습니다</p>
                  )}
                  {form.loginPassword && form.confirmPassword && form.loginPassword === form.confirmPassword && (
                    <p className="text-xs text-green-600 dark:text-green-400" data-testid="text-password-match">비밀번호가 일치합니다</p>
                  )}
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
