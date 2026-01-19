import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2, Plus, Pencil, Trash2, Building2, CheckCircle, XCircle, Package, Search, X, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { shippingCompanies, type Partner, type Product } from "@shared/schema";
import * as XLSX from "xlsx";

const partnerFormSchema = z.object({
  username: z.string().min(4, "아이디는 4자 이상이어야 합니다"),
  password: z.string().optional().or(z.literal("")),
  companyName: z.string().min(1, "업체명을 입력해주세요"),
  businessNumber: z.string().regex(/^\d{3}-\d{2}-\d{5}$/, "사업자번호 형식: 000-00-00000"),
  representative: z.string().min(1, "대표자명을 입력해주세요"),
  address: z.string().min(1, "주소를 입력해주세요"),
  phone1: z.string().min(1, "연락처-1을 입력해주세요"),
  phone2: z.string().optional().or(z.literal("")),
  shippingCompany: z.string().optional().or(z.literal("")),
  status: z.enum(["활성", "비활성"]),
});

type PartnerForm = z.infer<typeof partnerFormSchema>;

interface PartnerWithProductCount extends Omit<Partner, "password"> {
  productCount: number;
}

interface PartnerWithProducts extends Omit<Partner, "password"> {
  products: { id: string; productId: string; product: Product }[];
}

export default function PartnerManagement() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [shippingFilter, setShippingFilter] = useState<string>("all");
  const [showDialog, setShowDialog] = useState(false);
  const [editingPartner, setEditingPartner] = useState<PartnerWithProducts | null>(null);
  const [deletePartnerId, setDeletePartnerId] = useState<string | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);

  const { data: partners = [], isLoading } = useQuery<PartnerWithProductCount[]>({
    queryKey: ["/api/admin/partners"],
  });

  const { data: searchedProducts = [], isLoading: searchingProducts } = useQuery<Product[]>({
    queryKey: ["/api/admin/products/search", productSearch],
    queryFn: async () => {
      if (!productSearch.trim()) return [];
      const res = await fetch(`/api/admin/products/search?q=${encodeURIComponent(productSearch)}`);
      return res.json();
    },
    enabled: productSearch.trim().length > 0,
  });

  const form = useForm<PartnerForm>({
    resolver: zodResolver(partnerFormSchema),
    defaultValues: {
      username: "",
      password: "",
      companyName: "",
      businessNumber: "",
      representative: "",
      address: "",
      phone1: "",
      phone2: "",
      shippingCompany: "",
      status: "활성",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: PartnerForm & { productIds: string[] }) => {
      await apiRequest("POST", "/api/admin/partners", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/partners"] });
      toast({ title: "등록 완료", description: "협력업체가 등록되었습니다." });
      closeDialog();
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "오류", description: error.message || "등록에 실패했습니다." });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<PartnerForm> & { productIds: string[] } }) => {
      await apiRequest("PATCH", `/api/admin/partners/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/partners"] });
      toast({ title: "수정 완료", description: "협력업체 정보가 수정되었습니다." });
      closeDialog();
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "오류", description: error.message || "수정에 실패했습니다." });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/partners/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/partners"] });
      toast({ title: "삭제 완료", description: "협력업체가 삭제되었습니다." });
      setDeletePartnerId(null);
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "오류", description: error.message || "삭제에 실패했습니다." });
    },
  });

  const checkUsername = async (username: string) => {
    if (username.length < 4) {
      setUsernameAvailable(null);
      return;
    }
    setCheckingUsername(true);
    try {
      const res = await fetch(`/api/auth/check-partner-username/${username}`);
      const data = await res.json();
      setUsernameAvailable(data.available);
    } catch {
      setUsernameAvailable(null);
    } finally {
      setCheckingUsername(false);
    }
  };

  const closeDialog = () => {
    setShowDialog(false);
    setEditingPartner(null);
    form.reset();
    setSelectedProducts([]);
    setProductSearch("");
    setUsernameAvailable(null);
  };

  const openCreateDialog = () => {
    setEditingPartner(null);
    form.reset({
      username: "",
      password: "",
      companyName: "",
      businessNumber: "",
      representative: "",
      address: "",
      phone1: "",
      phone2: "",
      shippingCompany: "",
      status: "활성",
    });
    setSelectedProducts([]);
    setUsernameAvailable(null);
    setShowDialog(true);
  };

  const openEditDialog = async (partnerId: string) => {
    try {
      const res = await fetch(`/api/admin/partners/${partnerId}`);
      const partner: PartnerWithProducts = await res.json();
      setEditingPartner(partner);
      form.reset({
        username: partner.username,
        password: "",
        companyName: partner.companyName,
        businessNumber: partner.businessNumber,
        representative: partner.representative,
        address: partner.address,
        phone1: partner.phone1,
        phone2: partner.phone2 || "",
        shippingCompany: partner.shippingCompany || "",
        status: partner.status as "활성" | "비활성",
      });
      setSelectedProducts(partner.products.map(p => p.product));
      setUsernameAvailable(null);
      setShowDialog(true);
    } catch (error) {
      toast({ variant: "destructive", title: "오류", description: "협력업체 정보를 불러올 수 없습니다." });
    }
  };

  const formatBusinessNumber = (value: string) => {
    const digits = value.replace(/\D/g, "");
    if (digits.length <= 3) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5, 10)}`;
  };

  const onSubmit = (data: PartnerForm) => {
    const productIds = selectedProducts.map(p => p.id);
    if (editingPartner) {
      updateMutation.mutate({ 
        id: editingPartner.id, 
        data: { ...data, productIds } 
      });
    } else {
      if (!data.password || data.password.length < 6) {
        toast({ variant: "destructive", title: "오류", description: "비밀번호는 6자 이상이어야 합니다." });
        return;
      }
      createMutation.mutate({ ...data, productIds });
    }
  };

  const addProduct = (product: Product) => {
    if (!selectedProducts.find(p => p.id === product.id)) {
      setSelectedProducts([...selectedProducts, product]);
    }
    setProductSearch("");
  };

  const removeProduct = (productId: string) => {
    setSelectedProducts(selectedProducts.filter(p => p.id !== productId));
  };

  const filteredPartners = partners.filter((partner) => {
    const matchesSearch =
      partner.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      partner.representative.toLowerCase().includes(searchTerm.toLowerCase()) ||
      partner.businessNumber.includes(searchTerm);
    const matchesStatus = statusFilter === "all" || partner.status === statusFilter;
    const matchesShipping = shippingFilter === "all" || partner.shippingCompany === shippingFilter;
    return matchesSearch && matchesStatus && matchesShipping;
  });

  const activeCount = partners.filter(p => p.status === "활성").length;
  const inactiveCount = partners.filter(p => p.status === "비활성").length;
  const recentPartners = [...partners].sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  ).slice(0, 5);

  const shippingStats = shippingCompanies.map(company => ({
    company,
    count: partners.filter(p => p.shippingCompany === company).length,
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
    const data = filteredPartners.map(p => ({
      "업체명": p.companyName,
      "대표자명": p.representative,
      "사업자번호": p.businessNumber,
      "연락처-1": p.phone1,
      "연락처-2": p.phone2 || "",
      "택배사": p.shippingCompany || "",
      "취급품목 수": p.productCount,
      "상태": p.status,
      "등록일": formatDate(p.createdAt),
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "협력업체");
    XLSX.writeFile(wb, `협력업체_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold">협력업체 관리</h1>
        <Button onClick={openCreateDialog} data-testid="button-add-partner">
          <Plus className="h-4 w-4 mr-2" />
          협력업체 등록
        </Button>
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList>
          <TabsTrigger value="dashboard" data-testid="tab-dashboard">대시보드</TabsTrigger>
          <TabsTrigger value="list" data-testid="tab-list">협력업체 목록</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium">전체 협력업체</CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{partners.length}개</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium">활성 업체</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{activeCount}개</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium">비활성 업체</CardTitle>
                <XCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{inactiveCount}개</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  최근 등록된 협력업체
                </CardTitle>
              </CardHeader>
              <CardContent>
                {recentPartners.length === 0 ? (
                  <p className="text-sm text-muted-foreground">등록된 협력업체가 없습니다</p>
                ) : (
                  <div className="space-y-3">
                    {recentPartners.map((partner) => (
                      <div key={partner.id} className="flex items-center justify-between text-sm">
                        <div>
                          <span className="font-medium">{partner.companyName}</span>
                          <Badge variant={partner.status === "활성" ? "default" : "secondary"} className="ml-2 text-xs">
                            {partner.status}
                          </Badge>
                        </div>
                        <span className="text-muted-foreground">{formatDate(partner.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  택배사별 업체 현황
                </CardTitle>
              </CardHeader>
              <CardContent>
                {shippingStats.length === 0 ? (
                  <p className="text-sm text-muted-foreground">택배사 정보가 없습니다</p>
                ) : (
                  <div className="space-y-3">
                    {shippingStats.map((stat) => (
                      <div key={stat.company} className="flex items-center justify-between text-sm">
                        <span className="font-medium">{stat.company}</span>
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
              <CardTitle>협력업체 목록</CardTitle>
              <CardDescription>상품을 공급하는 매입처 목록</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <Input
                  placeholder="업체명, 대표자명, 사업자번호 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-64"
                  data-testid="input-search"
                />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-28" data-testid="select-status-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 상태</SelectItem>
                    <SelectItem value="활성">활성</SelectItem>
                    <SelectItem value="비활성">비활성</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={shippingFilter} onValueChange={setShippingFilter}>
                  <SelectTrigger className="w-32" data-testid="select-shipping-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 택배사</SelectItem>
                    {shippingCompanies.map((company) => (
                      <SelectItem key={company} value={company}>{company}</SelectItem>
                    ))}
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
              ) : filteredPartners.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  검색 결과가 없습니다
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>업체명</TableHead>
                        <TableHead>대표자명</TableHead>
                        <TableHead>사업자번호</TableHead>
                        <TableHead>연락처</TableHead>
                        <TableHead>택배사</TableHead>
                        <TableHead>취급품목</TableHead>
                        <TableHead>상태</TableHead>
                        <TableHead className="w-20">관리</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPartners.map((partner) => (
                        <TableRow key={partner.id} data-testid={`row-partner-${partner.id}`}>
                          <TableCell className="font-medium">{partner.companyName}</TableCell>
                          <TableCell>{partner.representative}</TableCell>
                          <TableCell>{partner.businessNumber}</TableCell>
                          <TableCell>{partner.phone1}</TableCell>
                          <TableCell>{partner.shippingCompany || "-"}</TableCell>
                          <TableCell>{partner.productCount}개</TableCell>
                          <TableCell>
                            <Badge variant={partner.status === "활성" ? "default" : "secondary"}>
                              {partner.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => openEditDialog(partner.id)}
                                data-testid={`button-edit-${partner.id}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setDeletePartnerId(partner.id)}
                                data-testid={`button-delete-${partner.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
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
        </TabsContent>
      </Tabs>

      <Dialog open={showDialog} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPartner ? "협력업체 수정" : "협력업체 등록"}</DialogTitle>
            <DialogDescription>
              {editingPartner ? "협력업체 정보를 수정합니다." : "새로운 협력업체를 등록합니다."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>아이디</FormLabel>
                      <div className="flex gap-2">
                        <FormControl>
                          <Input
                            {...field}
                            disabled={!!editingPartner}
                            placeholder="아이디 (4자 이상)"
                            data-testid="input-partner-username"
                          />
                        </FormControl>
                        {!editingPartner && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={field.value.length < 4 || checkingUsername}
                            onClick={() => checkUsername(field.value)}
                            data-testid="button-check-username"
                          >
                            {checkingUsername ? <Loader2 className="h-4 w-4 animate-spin" /> : "중복확인"}
                          </Button>
                        )}
                      </div>
                      {usernameAvailable !== null && (
                        <p className={`text-sm ${usernameAvailable ? "text-green-600" : "text-destructive"}`}>
                          {usernameAvailable ? "사용 가능한 아이디입니다" : "이미 사용 중인 아이디입니다"}
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{editingPartner ? "비밀번호 (변경 시 입력)" : "비밀번호"}</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          {...field}
                          placeholder={editingPartner ? "변경 시에만 입력" : "비밀번호 (6자 이상)"}
                          data-testid="input-partner-password"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="companyName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>업체명</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="업체명" data-testid="input-company-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="businessNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>사업자번호</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="000-00-00000"
                          onChange={(e) => field.onChange(formatBusinessNumber(e.target.value))}
                          maxLength={12}
                          data-testid="input-business-number"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="representative"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>대표자명</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="대표자명" data-testid="input-representative" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="shippingCompany"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>발송 택배사</FormLabel>
                      <Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}>
                        <FormControl>
                          <SelectTrigger data-testid="select-shipping-company">
                            <SelectValue placeholder="택배사 선택" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">선택 안함</SelectItem>
                          {shippingCompanies.map((company) => (
                            <SelectItem key={company} value={company}>{company}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>주소</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="주소" data-testid="input-address" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="phone1"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>연락처-1</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="010-0000-0000" data-testid="input-phone1" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone2"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>연락처-2 (선택)</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="010-0000-0000" data-testid="input-phone2" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>상태</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-status">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="활성">활성</SelectItem>
                        <SelectItem value="비활성">비활성</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="border rounded-md p-4 space-y-3">
                <h4 className="font-medium">취급품목</h4>
                <div className="flex gap-2">
                  <Input
                    placeholder="상품코드 또는 상품명 검색..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    data-testid="input-product-search"
                  />
                  <Button type="button" variant="outline" disabled={!productSearch.trim()}>
                    <Search className="h-4 w-4" />
                  </Button>
                </div>

                {searchingProducts && (
                  <div className="flex items-center justify-center py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                )}

                {productSearch.trim() && searchedProducts.length > 0 && (
                  <div className="border rounded-md max-h-40 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>상품코드</TableHead>
                          <TableHead>상품명</TableHead>
                          <TableHead className="w-16"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {searchedProducts.map((product) => (
                          <TableRow key={product.id}>
                            <TableCell>{product.productCode}</TableCell>
                            <TableCell>{product.productName}</TableCell>
                            <TableCell>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => addProduct(product)}
                                disabled={selectedProducts.some(p => p.id === product.id)}
                                data-testid={`button-add-product-${product.id}`}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {productSearch.trim() && searchedProducts.length === 0 && !searchingProducts && (
                  <p className="text-sm text-muted-foreground py-2">검색 결과가 없습니다</p>
                )}

                {selectedProducts.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {selectedProducts.map((product) => (
                      <Badge
                        key={product.id}
                        variant="secondary"
                        className="flex items-center gap-1 px-2 py-1"
                      >
                        {product.productCode}-{product.productName}
                        <button
                          type="button"
                          onClick={() => removeProduct(product.id)}
                          className="ml-1 hover:text-destructive"
                          data-testid={`button-remove-product-${product.id}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}

                {selectedProducts.length === 0 && (
                  <p className="text-sm text-muted-foreground">선택된 취급품목이 없습니다</p>
                )}
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeDialog}>
                  취소
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-submit-partner"
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  )}
                  {editingPartner ? "수정" : "등록"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletePartnerId} onOpenChange={() => setDeletePartnerId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>협력업체 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              이 협력업체를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletePartnerId && deleteMutation.mutate(deletePartnerId)}
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
