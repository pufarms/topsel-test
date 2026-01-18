import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Package, LogOut, Loader2, Download, Users, ShoppingCart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { userTiers, type User, type Order } from "@shared/schema";

interface OrderWithUser extends Order {
  user?: { name: string; email: string };
}

export default function Admin() {
  const [, navigate] = useLocation();
  const { user, logout, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    enabled: !!user && user.role === "admin",
  });

  const { data: orders = [], isLoading: ordersLoading } = useQuery<OrderWithUser[]>({
    queryKey: ["/api/admin/orders"],
    enabled: !!user && user.role === "admin",
  });

  const updateTierMutation = useMutation({
    mutationFn: async ({ userId, tier }: { userId: string; tier: string }) => {
      await apiRequest("PATCH", `/api/admin/users/${userId}/tier`, { tier });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "등급 변경", description: "회원 등급이 변경되었습니다." });
    },
    onError: () => {
      toast({ variant: "destructive", title: "오류", description: "등급 변경에 실패했습니다." });
    },
  });

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    navigate("/login");
    return null;
  }

  if (user.role !== "admin") {
    navigate("/dashboard");
    return null;
  }

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const handleExportCSV = () => {
    if (orders.length === 0) {
      toast({
        variant: "destructive",
        title: "내보내기 실패",
        description: "내보낼 주문이 없습니다.",
      });
      return;
    }

    const headers = ["주문ID", "셀러", "상품명", "수량", "가격", "수령인", "연락처", "주소", "등록일"];
    const csvContent = [
      headers.join(","),
      ...orders.map((order) =>
        [
          order.id,
          order.user?.name || "-",
          `"${order.productName}"`,
          order.quantity,
          order.price,
          `"${order.recipientName}"`,
          `"${order.recipientPhone}"`,
          `"${order.recipientAddress}"`,
          formatDate(order.createdAt),
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `orders_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast({ title: "내보내기 완료", description: "CSV 파일이 다운로드되었습니다." });
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  const formatPrice = (price: number) => {
    return price.toLocaleString("ko-KR") + "원";
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer">
              <Package className="h-6 w-6 text-primary" />
              <span className="text-xl font-bold">주문관리</span>
            </div>
          </Link>
          <div className="flex items-center gap-4">
            <Badge variant="secondary" className="text-xs">관리자</Badge>
            <span className="text-sm text-muted-foreground">
              {user.name}님
            </span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleLogout}
              data-testid="button-logout"
            >
              <LogOut className="h-4 w-4 mr-2" />
              로그아웃
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="flex items-center justify-between gap-4 mb-8 flex-wrap">
          <h1 className="text-3xl font-bold">관리자 페이지</h1>
          <Button onClick={handleExportCSV} data-testid="button-export-csv">
            <Download className="h-4 w-4 mr-2" />
            CSV 내보내기
          </Button>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
              <CardTitle className="text-sm font-medium">총 회원 수</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-users">{users.length}명</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
              <CardTitle className="text-sm font-medium">총 주문 수</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-orders">{orders.length}건</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="users" className="space-y-4">
          <TabsList>
            <TabsTrigger value="users" data-testid="tab-users">
              <Users className="h-4 w-4 mr-2" />
              회원 목록
            </TabsTrigger>
            <TabsTrigger value="orders" data-testid="tab-orders">
              <ShoppingCart className="h-4 w-4 mr-2" />
              주문 목록
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>전체 회원 목록</CardTitle>
                <CardDescription>시스템에 등록된 모든 회원을 확인하세요</CardDescription>
              </CardHeader>
              <CardContent>
                {usersLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : users.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground" data-testid="text-empty-users">
                    등록된 회원이 없습니다
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>이메일</TableHead>
                          <TableHead>이름</TableHead>
                          <TableHead>역할</TableHead>
                          <TableHead>등급</TableHead>
                          <TableHead>가입일</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users.map((u) => (
                          <TableRow key={u.id} data-testid={`row-user-${u.id}`}>
                            <TableCell>{u.email}</TableCell>
                            <TableCell className="font-medium">{u.name}</TableCell>
                            <TableCell>
                              <Badge 
                                variant={u.role === "admin" ? "default" : "secondary"}
                                className="text-xs"
                              >
                                {u.role === "admin" ? "관리자" : "셀러"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Select
                                value={u.tier}
                                onValueChange={(value) => updateTierMutation.mutate({ userId: u.id, tier: value })}
                                disabled={updateTierMutation.isPending}
                              >
                                <SelectTrigger className="w-32" data-testid={`select-tier-${u.id}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {userTiers.map((tier) => (
                                    <SelectItem key={tier} value={tier} data-testid={`option-tier-${tier}`}>
                                      {tier}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>{formatDate(u.createdAt)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="orders">
            <Card>
              <CardHeader>
                <CardTitle>전체 주문 목록</CardTitle>
                <CardDescription>시스템에 등록된 모든 주문을 확인하세요</CardDescription>
              </CardHeader>
              <CardContent>
                {ordersLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : orders.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground" data-testid="text-empty-orders">
                    등록된 주문이 없습니다
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>셀러</TableHead>
                          <TableHead>상품명</TableHead>
                          <TableHead className="text-right">수량</TableHead>
                          <TableHead className="text-right">가격</TableHead>
                          <TableHead>수령인</TableHead>
                          <TableHead>연락처</TableHead>
                          <TableHead>주소</TableHead>
                          <TableHead>등록일</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orders.map((order) => (
                          <TableRow key={order.id} data-testid={`row-order-${order.id}`}>
                            <TableCell>{order.user?.name || "-"}</TableCell>
                            <TableCell className="font-medium">{order.productName}</TableCell>
                            <TableCell className="text-right">{order.quantity}</TableCell>
                            <TableCell className="text-right">{formatPrice(order.price)}</TableCell>
                            <TableCell>{order.recipientName}</TableCell>
                            <TableCell>{order.recipientPhone}</TableCell>
                            <TableCell className="max-w-[200px] truncate">{order.recipientAddress}</TableCell>
                            <TableCell>{formatDate(order.createdAt)}</TableCell>
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
      </main>
    </div>
  );
}
