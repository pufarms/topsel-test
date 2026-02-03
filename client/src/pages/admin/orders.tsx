import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Download, ShoppingCart, Package, TrendingUp, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Order } from "@shared/schema";
import * as XLSX from "xlsx";
import {
  PageHeader,
  StatCard,
  StatCardsGrid,
  FilterSection,
  FilterField,
  DataTable,
  MobileCard,
  MobileCardField,
  MobileCardsList,
  type Column
} from "@/components/admin";

interface OrderWithUser extends Order {
  user?: { name: string; email: string };
}

export default function AdminOrders() {
  const { toast } = useToast();
  const [searchSeller, setSearchSeller] = useState("");
  const [searchProduct, setSearchProduct] = useState("");
  const [sortBy, setSortBy] = useState<string>("newest");

  const { data: orders = [], isLoading } = useQuery<OrderWithUser[]>({
    queryKey: ["/api/admin/orders"],
  });

  // Order stats from new API (real-time counts)
  const { data: orderStats } = useQuery<{
    total: number;
    pending: number;
    processing: number;
    completed: number;
    cancelled: number;
    today: number;
  }>({
    queryKey: ["/api/order-stats"],
  });

  const filteredOrders = orders
    .filter(o => {
      if (searchSeller && !o.user?.name.toLowerCase().includes(searchSeller.toLowerCase())) return false;
      if (searchProduct && !o.productName.toLowerCase().includes(searchProduct.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "newest": return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "oldest": return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "price": return b.price * b.quantity - a.price * a.quantity;
        default: return 0;
      }
    });

  const handleReset = () => {
    setSearchSeller("");
    setSearchProduct("");
    setSortBy("newest");
  };

  const handleExportExcel = () => {
    if (orders.length === 0) {
      toast({ variant: "destructive", title: "내보내기 실패", description: "내보낼 주문이 없습니다." });
      return;
    }
    const data = filteredOrders.map(order => ({
      주문ID: order.id,
      셀러: order.user?.name || "-",
      상품명: order.productName,
      수량: order.quantity,
      가격: order.price,
      합계: order.price * order.quantity,
      수령인: order.recipientName,
      연락처: order.recipientPhone,
      주소: order.recipientAddress,
      등록일: formatDate(order.createdAt),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "주문목록");
    XLSX.writeFile(wb, `orders_${new Date().toISOString().split("T")[0]}.xlsx`);
    toast({ title: "내보내기 완료", description: "엑셀 파일이 다운로드되었습니다." });
  };

  const formatDate = (date: Date | string) => new Date(date).toLocaleDateString("ko-KR");
  const formatPrice = (price: number) => price.toLocaleString("ko-KR") + "원";

  // Use real stats from API
  const totalOrders = orderStats?.total || 0;
  const todayOrders = orderStats?.today || 0;
  const totalRevenue = orders.reduce((sum, o) => sum + o.price * o.quantity, 0);
  const totalItems = orders.reduce((sum, o) => sum + o.quantity, 0);

  const columns: Column<OrderWithUser>[] = [
    { key: "seller", label: "셀러", render: (o) => o.user?.name || "-" },
    { key: "productName", label: "상품명", render: (o) => <span className="font-medium">{o.productName}</span> },
    { key: "quantity", label: "수량", className: "text-right" },
    { key: "price", label: "가격", className: "text-right", render: (o) => formatPrice(o.price) },
    { key: "total", label: "합계", className: "text-right", render: (o) => formatPrice(o.price * o.quantity) },
    { key: "recipientName", label: "수령인" },
    { key: "createdAt", label: "등록일", render: (o) => formatDate(o.createdAt) },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4">
      <PageHeader
        title="주문관리"
        description="시스템에 등록된 모든 주문을 관리합니다"
        icon={ShoppingCart}
        actions={
          <Button size="sm" variant="outline" onClick={handleExportExcel} data-testid="button-export-excel">
            <Download className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">엑셀</span>
          </Button>
        }
      />

      <StatCardsGrid columns={4}>
        <StatCard
          label="전체 주문"
          value={totalOrders}
          suffix="건"
          icon={ShoppingCart}
          iconColor="bg-primary text-primary-foreground"
          testId="stat-card-total"
        />
        <StatCard
          label="오늘 주문"
          value={todayOrders}
          suffix="건"
          icon={Calendar}
          iconColor="bg-blue-500 text-white"
          testId="stat-card-today"
        />
        <StatCard
          label="총 매출"
          value={formatPrice(totalRevenue)}
          icon={TrendingUp}
          iconColor="bg-green-500 text-white"
          testId="stat-card-revenue"
        />
        <StatCard
          label="총 상품수"
          value={totalItems}
          suffix="개"
          icon={Package}
          iconColor="bg-purple-500 text-white"
          testId="stat-card-items"
        />
      </StatCardsGrid>

      <FilterSection onReset={handleReset}>
        <FilterField label="셀러">
          <Input
            placeholder="셀러명 검색..."
            value={searchSeller}
            onChange={(e) => setSearchSeller(e.target.value)}
            className="h-9"
            data-testid="input-search-seller"
          />
        </FilterField>
        <FilterField label="상품명">
          <Input
            placeholder="상품명 검색..."
            value={searchProduct}
            onChange={(e) => setSearchProduct(e.target.value)}
            className="h-9"
            data-testid="input-search-product"
          />
        </FilterField>
        <FilterField label="정렬">
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="h-9" data-testid="select-sort">
              <SelectValue placeholder="정렬 기준" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">최신순</SelectItem>
              <SelectItem value="oldest">오래된순</SelectItem>
              <SelectItem value="price">금액순</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>
      </FilterSection>

      {/* Desktop Table */}
      <div className="hidden lg:block">
        <DataTable
          title={`총 ${filteredOrders.length}건`}
          columns={columns}
          data={filteredOrders}
          keyField="id"
          emptyMessage="등록된 주문이 없습니다"
        />
      </div>

      {/* Mobile Cards */}
      <MobileCardsList>
        {filteredOrders.map((order) => (
          <MobileCard key={order.id} testId={`card-order-${order.id}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium truncate">{order.productName}</span>
              <Badge variant="secondary">{order.quantity}개</Badge>
            </div>
            <p className="text-xs text-muted-foreground mb-2">{order.user?.name || "-"}</p>
            <div className="space-y-1">
              <MobileCardField label="수령인" value={order.recipientName} />
              <MobileCardField label="합계" value={formatPrice(order.price * order.quantity)} />
              <MobileCardField label="등록일" value={formatDate(order.createdAt)} />
            </div>
          </MobileCard>
        ))}
        {filteredOrders.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            등록된 주문이 없습니다
          </div>
        )}
      </MobileCardsList>
    </div>
  );
}
