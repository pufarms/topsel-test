import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Order } from "@shared/schema";
import * as XLSX from "xlsx";

interface OrderWithUser extends Order {
  user?: { name: string; email: string };
}

export default function AdminOrders() {
  const { toast } = useToast();

  const { data: orders = [], isLoading } = useQuery<OrderWithUser[]>({
    queryKey: ["/api/admin/orders"],
  });

  const handleExportExcel = () => {
    if (orders.length === 0) {
      toast({ variant: "destructive", title: "내보내기 실패", description: "내보낼 주문이 없습니다." });
      return;
    }

    const data = orders.map(order => ({
      주문ID: order.id,
      셀러: order.user?.name || "-",
      상품명: order.productName,
      수량: order.quantity,
      가격: order.price,
      합계: order.price * order.quantity,
      수령인: order.recipientName,
      연락처: order.recipientPhone,
      주소: order.recipientAddress,
      등록일: new Date(order.createdAt).toLocaleDateString("ko-KR"),
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "주문목록");
    XLSX.writeFile(wb, `orders_${new Date().toISOString().split("T")[0]}.xlsx`);
    toast({ title: "내보내기 완료", description: "엑셀 파일이 다운로드되었습니다." });
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 md:mb-6">
        <h1 className="text-xl md:text-2xl font-bold">주문관리</h1>
        <Button onClick={handleExportExcel} size="sm" data-testid="button-export-excel">
          <Download className="h-4 w-4 mr-2" />
          <span className="hidden sm:inline">엑셀 내보내기</span>
          <span className="sm:hidden">내보내기</span>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>전체 주문 목록</CardTitle>
          <CardDescription>시스템에 등록된 모든 주문을 확인합니다</CardDescription>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              등록된 주문이 없습니다
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>셀러</TableHead>
                      <TableHead>상품명</TableHead>
                      <TableHead className="text-right">수량</TableHead>
                      <TableHead className="text-right">가격</TableHead>
                      <TableHead className="text-right">합계</TableHead>
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
                        <TableCell className="text-right font-medium">{formatPrice(order.price * order.quantity)}</TableCell>
                        <TableCell>{order.recipientName}</TableCell>
                        <TableCell>{order.recipientPhone}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{order.recipientAddress}</TableCell>
                        <TableCell>{formatDate(order.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile/Tablet Cards */}
              <div className="lg:hidden space-y-3">
                {orders.map((order) => (
                  <Card key={order.id} className="p-4" data-testid={`card-order-${order.id}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold">{order.productName}</p>
                        <p className="text-sm text-muted-foreground">{order.user?.name || "-"}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-primary">{formatPrice(order.price * order.quantity)}</p>
                        <p className="text-xs text-muted-foreground">{order.quantity}개</p>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">수령인</span>
                        <p className="font-medium">{order.recipientName}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">연락처</span>
                        <p className="font-medium">{order.recipientPhone}</p>
                      </div>
                      <div className="col-span-2">
                        <span className="text-muted-foreground">주소</span>
                        <p className="font-medium truncate">{order.recipientAddress}</p>
                      </div>
                      <div className="col-span-2 flex justify-between pt-2 border-t">
                        <span className="text-muted-foreground">등록일</span>
                        <span>{formatDate(order.createdAt)}</span>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
