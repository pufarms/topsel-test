import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Package, LogOut, Loader2, ShoppingCart, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { usePublicSiteSettings } from "@/hooks/use-site-settings";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { insertOrderSchema } from "@shared/schema";
import type { z } from "zod";
import type { Order } from "@shared/schema";

type OrderForm = z.infer<typeof insertOrderSchema>;

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { user, logout, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const { data: siteSettings } = usePublicSiteSettings();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const siteName = siteSettings?.site_name || "TOPSEL";

  const form = useForm<OrderForm>({
    resolver: zodResolver(insertOrderSchema),
    defaultValues: {
      productName: "",
      quantity: 1,
      price: 0,
      recipientName: "",
      recipientPhone: "",
      recipientAddress: "",
    },
  });

  const { data: orders = [], isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
    enabled: !!user,
  });

  const createOrderMutation = useMutation({
    mutationFn: async (data: OrderForm) => {
      await apiRequest("POST", "/api/orders", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      form.reset();
      toast({ title: "주문 등록 완료", description: "주문이 성공적으로 등록되었습니다." });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "주문 등록 실패",
        description: error.message || "다시 시도해주세요.",
      });
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

  const onSubmit = async (data: OrderForm) => {
    setIsSubmitting(true);
    try {
      await createOrderMutation.mutateAsync(data);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const totalOrders = orders.length;
  const totalValue = orders.reduce((sum, order) => sum + order.price * order.quantity, 0);

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
              {siteSettings?.header_logo_url ? (
                <img src={siteSettings.header_logo_url} alt={siteName} className="h-8" />
              ) : (
                <Package className="h-6 w-6 text-primary" />
              )}
              <span className="text-xl font-bold">{siteName}</span>
            </div>
          </Link>
          <div className="flex items-center gap-4">
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
        <h1 className="text-3xl font-bold mb-8">대시보드</h1>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
              <CardTitle className="text-sm font-medium">총 주문 수</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-orders">{totalOrders}건</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
              <CardTitle className="text-sm font-medium">총 주문 금액</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-value">{formatPrice(totalValue)}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <CardTitle>주문 등록</CardTitle>
              <CardDescription>새 주문을 등록하세요</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="productName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>상품명 *</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="상품명" 
                              data-testid="input-product-name"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="quantity"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>수량 *</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                min="1"
                                data-testid="input-quantity"
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="price"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>가격 *</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                min="0"
                                data-testid="input-price"
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                  <FormField
                    control={form.control}
                    name="recipientName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>수령인 *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="수령인 이름" 
                            data-testid="input-recipient-name"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="recipientPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>연락처 *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="010-1234-5678" 
                            data-testid="input-recipient-phone"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="recipientAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>주소 *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="배송지 주소" 
                            data-testid="input-recipient-address"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={isSubmitting}
                    data-testid="button-create-order"
                  >
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    주문 등록
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>내 주문 목록</CardTitle>
              <CardDescription>등록한 주문을 확인하세요</CardDescription>
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
                        <TableHead>상품명</TableHead>
                        <TableHead className="text-right">수량</TableHead>
                        <TableHead className="text-right">가격</TableHead>
                        <TableHead>수령인</TableHead>
                        <TableHead>등록일</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.map((order) => (
                        <TableRow key={order.id} data-testid={`row-order-${order.id}`}>
                          <TableCell className="font-medium">{order.productName}</TableCell>
                          <TableCell className="text-right">{order.quantity}</TableCell>
                          <TableCell className="text-right">{formatPrice(order.price)}</TableCell>
                          <TableCell>{order.recipientName}</TableCell>
                          <TableCell>{formatDate(order.createdAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
