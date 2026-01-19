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
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Plus, Pencil, Trash2, Users, ShieldCheck, UserCheck, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { adminRoles, menuPermissions, type User } from "@shared/schema";

const permissionLabels: Record<string, string> = {
  dashboard: "대시보드",
  admin_management: "관리자 관리",
  partner_management: "협력업체 관리",
  user_management: "사용자 관리",
  order_management: "주문관리",
  product_management: "상품관리",
  settlement_management: "정산관리",
  stats_management: "통계관리",
  coupon_management: "쿠폰관리",
  page_management: "페이지관리",
  site_settings: "사이트 설정",
  gallery_management: "이미지 갤러리",
};

const adminFormSchema = z.object({
  username: z.string().min(4, "아이디는 4자 이상이어야 합니다"),
  password: z.string().min(6, "비밀번호는 6자 이상이어야 합니다").optional().or(z.literal("")),
  name: z.string().min(2, "이름은 2자 이상이어야 합니다"),
  phone: z.string().optional(),
  email: z.string().email("유효한 이메일을 입력해주세요").optional().or(z.literal("")),
  role: z.enum(adminRoles),
  permissions: z.array(z.string()).optional(),
});

type AdminForm = z.infer<typeof adminFormSchema>;

export default function AdminManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [showDialog, setShowDialog] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<User | null>(null);
  const [deleteAdminId, setDeleteAdminId] = useState<string | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);

  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  const { data: admins = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/admins"],
  });

  const form = useForm<AdminForm>({
    resolver: zodResolver(adminFormSchema),
    defaultValues: {
      username: "",
      password: "",
      name: "",
      phone: "",
      email: "",
      role: "ADMIN",
      permissions: [],
    },
  });

  const watchedRole = form.watch("role");

  const createMutation = useMutation({
    mutationFn: async (data: AdminForm) => {
      await apiRequest("POST", "/api/admin/admins", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/admins"] });
      toast({ title: "등록 완료", description: "관리자가 등록되었습니다." });
      setShowDialog(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "오류", description: error.message || "등록에 실패했습니다." });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<AdminForm> }) => {
      await apiRequest("PATCH", `/api/admin/admins/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/admins"] });
      toast({ title: "수정 완료", description: "관리자 정보가 수정되었습니다." });
      setShowDialog(false);
      setEditingAdmin(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "오류", description: error.message || "수정에 실패했습니다." });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/admins/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/admins"] });
      toast({ title: "삭제 완료", description: "관리자가 삭제되었습니다." });
      setDeleteAdminId(null);
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
      const res = await fetch(`/api/auth/check-username/${username}`);
      const data = await res.json();
      setUsernameAvailable(data.available);
    } catch {
      setUsernameAvailable(null);
    } finally {
      setCheckingUsername(false);
    }
  };

  const openCreateDialog = () => {
    setEditingAdmin(null);
    form.reset({
      username: "",
      password: "",
      name: "",
      phone: "",
      email: "",
      role: "ADMIN",
      permissions: [],
    });
    setUsernameAvailable(null);
    setShowDialog(true);
  };

  const openEditDialog = (admin: User) => {
    setEditingAdmin(admin);
    form.reset({
      username: admin.username,
      password: "",
      name: admin.name,
      phone: admin.phone || "",
      email: admin.email || "",
      role: admin.role as "SUPER_ADMIN" | "ADMIN",
      permissions: (admin.permissions as string[]) || [],
    });
    setUsernameAvailable(null);
    setShowDialog(true);
  };

  const onSubmit = (data: AdminForm) => {
    if (editingAdmin) {
      const updateData: Partial<AdminForm> = {
        name: data.name,
        phone: data.phone,
        email: data.email,
        role: data.role,
        permissions: data.role === "SUPER_ADMIN" ? [] : data.permissions,
      };
      if (data.password && data.password.length >= 6) {
        updateData.password = data.password;
      }
      updateMutation.mutate({ id: editingAdmin.id, data: updateData });
    } else {
      createMutation.mutate(data);
    }
  };

  const filteredAdmins = admins.filter((admin) => {
    const matchesSearch = 
      admin.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      admin.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === "all" || admin.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const superAdminCount = admins.filter(a => a.role === "SUPER_ADMIN").length;
  const adminCount = admins.filter(a => a.role === "ADMIN").length;
  const recentAdmins = [...admins].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  ).slice(0, 5);
  const recentLogins = [...admins].filter(a => a.lastLoginAt).sort((a, b) => 
    new Date(b.lastLoginAt!).getTime() - new Date(a.lastLoginAt!).getTime()
  ).slice(0, 5);

  const formatDate = (date: Date | string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold">관리자 관리</h1>
        {isSuperAdmin && (
          <Button onClick={openCreateDialog} data-testid="button-add-admin">
            <Plus className="h-4 w-4 mr-2" />
            관리자 등록
          </Button>
        )}
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList>
          <TabsTrigger value="dashboard" data-testid="tab-dashboard">대시보드</TabsTrigger>
          <TabsTrigger value="list" data-testid="tab-list">관리자 목록</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium">전체 관리자</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{admins.length}명</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium">최고관리자</CardTitle>
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{superAdminCount}명</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium">관리자</CardTitle>
                <UserCheck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{adminCount}명</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  최근 로그인
                </CardTitle>
              </CardHeader>
              <CardContent>
                {recentLogins.length === 0 ? (
                  <p className="text-sm text-muted-foreground">로그인 기록이 없습니다</p>
                ) : (
                  <div className="space-y-3">
                    {recentLogins.map((admin) => (
                      <div key={admin.id} className="flex items-center justify-between text-sm">
                        <span className="font-medium">{admin.name} ({admin.username})</span>
                        <span className="text-muted-foreground">{formatDate(admin.lastLoginAt)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  최근 등록된 관리자
                </CardTitle>
              </CardHeader>
              <CardContent>
                {recentAdmins.length === 0 ? (
                  <p className="text-sm text-muted-foreground">등록된 관리자가 없습니다</p>
                ) : (
                  <div className="space-y-3">
                    {recentAdmins.map((admin) => (
                      <div key={admin.id} className="flex items-center justify-between text-sm">
                        <div>
                          <span className="font-medium">{admin.name}</span>
                          <Badge variant={admin.role === "SUPER_ADMIN" ? "default" : "secondary"} className="ml-2 text-xs">
                            {admin.role === "SUPER_ADMIN" ? "최고관리자" : "관리자"}
                          </Badge>
                        </div>
                        <span className="text-muted-foreground">{formatDate(admin.createdAt)}</span>
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
              <CardTitle>관리자 목록</CardTitle>
              <CardDescription>시스템에 등록된 모든 관리자</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <Input
                  placeholder="아이디 또는 이름 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-64"
                  data-testid="input-search"
                />
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="w-32" data-testid="select-role-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체</SelectItem>
                    <SelectItem value="SUPER_ADMIN">최고관리자</SelectItem>
                    <SelectItem value="ADMIN">관리자</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : filteredAdmins.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  검색 결과가 없습니다
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>아이디</TableHead>
                        <TableHead>이름</TableHead>
                        <TableHead>등급</TableHead>
                        <TableHead>연락처</TableHead>
                        <TableHead>최근 로그인</TableHead>
                        {isSuperAdmin && <TableHead className="w-20">관리</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAdmins.map((admin) => (
                        <TableRow key={admin.id} data-testid={`row-admin-${admin.id}`}>
                          <TableCell className="font-medium">{admin.username}</TableCell>
                          <TableCell>{admin.name}</TableCell>
                          <TableCell>
                            <Badge variant={admin.role === "SUPER_ADMIN" ? "default" : "secondary"}>
                              {admin.role === "SUPER_ADMIN" ? "최고관리자" : "관리자"}
                            </Badge>
                          </TableCell>
                          <TableCell>{admin.phone || "-"}</TableCell>
                          <TableCell>{formatDate(admin.lastLoginAt)}</TableCell>
                          {isSuperAdmin && (
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => openEditDialog(admin)}
                                  data-testid={`button-edit-${admin.id}`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                {admin.role !== "SUPER_ADMIN" && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setDeleteAdminId(admin.id)}
                                    data-testid={`button-delete-${admin.id}`}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          )}
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

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingAdmin ? "관리자 수정" : "관리자 등록"}</DialogTitle>
            <DialogDescription>
              {editingAdmin ? "관리자 정보를 수정합니다." : "새로운 관리자를 등록합니다."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                          disabled={!!editingAdmin}
                          placeholder="아이디 (4자 이상)"
                          data-testid="input-admin-username"
                        />
                      </FormControl>
                      {!editingAdmin && (
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
                    <FormLabel>{editingAdmin ? "비밀번호 (변경 시 입력)" : "비밀번호"}</FormLabel>
                    <FormControl>
                      <Input 
                        type="password" 
                        {...field} 
                        placeholder={editingAdmin ? "변경 시에만 입력" : "비밀번호 (6자 이상)"}
                        data-testid="input-admin-password"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>이름</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="이름" data-testid="input-admin-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>연락처</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="010-0000-0000" data-testid="input-admin-phone" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>이메일</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} placeholder="example@email.com" data-testid="input-admin-email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>등급</FormLabel>
                    <Select 
                      value={field.value} 
                      onValueChange={field.onChange}
                      disabled={editingAdmin?.role === "SUPER_ADMIN"}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-admin-role">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="SUPER_ADMIN">최고관리자</SelectItem>
                        <SelectItem value="ADMIN">관리자</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {watchedRole === "ADMIN" && (
                <FormField
                  control={form.control}
                  name="permissions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>권한 설정</FormLabel>
                      <div className="grid grid-cols-2 gap-2 border rounded-md p-3">
                        {menuPermissions.map((permission) => (
                          <div key={permission} className="flex items-center space-x-2">
                            <Checkbox
                              id={permission}
                              checked={field.value?.includes(permission)}
                              onCheckedChange={(checked) => {
                                const current = field.value || [];
                                if (checked) {
                                  field.onChange([...current, permission]);
                                } else {
                                  field.onChange(current.filter((p) => p !== permission));
                                }
                              }}
                              data-testid={`checkbox-permission-${permission}`}
                            />
                            <label htmlFor={permission} className="text-sm cursor-pointer">
                              {permissionLabels[permission] || permission}
                            </label>
                          </div>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                  취소
                </Button>
                <Button 
                  type="submit" 
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-submit-admin"
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  )}
                  {editingAdmin ? "수정" : "등록"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteAdminId} onOpenChange={() => setDeleteAdminId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>관리자 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              이 관리자를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteAdminId && deleteMutation.mutate(deleteAdminId)}
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
