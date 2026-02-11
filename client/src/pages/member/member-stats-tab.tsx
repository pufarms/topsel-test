import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DateRangeFilter,
  useDateRange,
} from "@/components/common/DateRangeFilter";
import {
  TrendingUp,
  TrendingDown,
  Search,
  Loader2,
  CalendarIcon,
  BarChart3,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  ShoppingCart,
  Package,
  Download,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  Line,
} from "recharts";

const CHART_COLORS = ["#5D7AF2", "#FF6B00", "#10B981", "#8B5CF6", "#F59E0B", "#94A3B8"];

function formatRevenue(n: number): string {
  return n.toLocaleString() + "원";
}

function formatCount(n: number): string {
  return n.toLocaleString() + "건";
}

function formatPercent(n: number): string {
  return (n >= 0 ? "+" : "") + n.toFixed(1) + "%";
}

function GrowthBadge({ value }: { value: number | undefined }) {
  if (value === undefined || value === null) return null;
  const isPositive = value >= 0;
  return (
    <span
      className={`flex items-center gap-0.5 text-xs font-medium ${isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
      data-testid="member-growth-badge"
    >
      {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {formatPercent(value)}
    </span>
  );
}

function SummaryCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
        <Skeleton className="h-4 w-20" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-7 w-32 mb-1" />
        <Skeleton className="h-3 w-16" />
      </CardContent>
    </Card>
  );
}

function MemberOverviewTab({ startDate, endDate }: { startDate: string; endDate: string }) {
  const { data, isLoading } = useQuery<any>({
    queryKey: [`/api/member/statistics/overview?startDate=${startDate}&endDate=${endDate}`],
    enabled: !!startDate && !!endDate,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <SummaryCardSkeleton key={i} />
          ))}
        </div>
        <Card>
          <CardContent className="pt-6">
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data?.summary) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground" data-testid="member-empty-overview">
          해당 기간에 매출 데이터가 없습니다
        </CardContent>
      </Card>
    );
  }

  const { summary, trend, topProducts } = data;

  const summaryCards = [
    { label: "총 매입액", value: formatRevenue(summary.totalRevenue || 0), growth: summary.revenueGrowth },
    { label: "총 주문 건수", value: formatCount(summary.totalOrders || 0), growth: summary.ordersGrowth },
    { label: "평균 주문금액", value: formatRevenue(summary.avgOrderAmount || 0), growth: undefined },
    { label: "주문 상품수", value: (summary.productCount || 0).toLocaleString() + "종", growth: undefined },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="member-summary-cards">
        {summaryCards.map((card, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold" data-testid={`member-summary-value-${i}`}>{card.value}</div>
              <GrowthBadge value={card.growth} />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">매입 추이</CardTitle>
        </CardHeader>
        <CardContent>
          {trend?.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id="memberRevenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#5D7AF2" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#5D7AF2" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v: number) => v >= 10000 ? `${(v / 10000).toLocaleString()}만` : v.toLocaleString()}
                  className="text-muted-foreground"
                />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    if (name === "revenue") return [formatRevenue(value), "매입액"];
                    if (name === "orders") return [formatCount(value), "주문수"];
                    return [value, name];
                  }}
                  labelFormatter={(label) => `${label}`}
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "6px" }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#5D7AF2" strokeWidth={2} fill="url(#memberRevenueGradient)" />
                <Line type="monotone" dataKey="orders" stroke="#FF6B00" strokeWidth={1.5} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              데이터가 없습니다
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">상품별 매입 순위 (Top 10)</CardTitle>
        </CardHeader>
        <CardContent>
          {topProducts?.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topProducts} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: number) => v >= 10000 ? `${(v / 10000).toLocaleString()}만` : v.toLocaleString()}
                  className="text-muted-foreground"
                />
                <YAxis type="category" dataKey="productName" tick={{ fontSize: 11 }} width={80} className="text-muted-foreground" />
                <Tooltip
                  formatter={(value: number) => [formatRevenue(value), "매입액"]}
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "6px" }}
                />
                <Bar dataKey="revenue" fill="#5D7AF2" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              데이터가 없습니다
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ProductDrillDown({ productCode, startDate, endDate }: { productCode: string; startDate: string; endDate: string }) {
  const { data, isLoading } = useQuery<any>({
    queryKey: [`/api/member/statistics/by-product/${productCode}?startDate=${startDate}&endDate=${endDate}`],
    enabled: !!productCode,
  });

  if (isLoading) {
    return (
      <div className="p-4 flex justify-center">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!data?.trend?.length) return null;

  return (
    <div className="p-4 space-y-4 bg-muted/30 rounded-md">
      <p className="text-sm font-medium mb-2">일별 매입 추이</p>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data.trend}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} className="text-muted-foreground" />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => v >= 10000 ? `${(v / 10000).toLocaleString()}만` : v.toLocaleString()} className="text-muted-foreground" />
          <Tooltip
            formatter={(value: number) => [formatRevenue(value), "매입액"]}
            contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "6px" }}
          />
          <Area type="monotone" dataKey="revenue" stroke="#5D7AF2" fill="#5D7AF2" fillOpacity={0.15} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

type ProductSortField = "revenue" | "quantity";
type SortDir = "asc" | "desc";

function ByProductTab({ startDate, endDate }: { startDate: string; endDate: string }) {
  const [search, setSearch] = useState("");
  const [catLarge, setCatLarge] = useState("");
  const [catMedium, setCatMedium] = useState("");
  const [catSmall, setCatSmall] = useState("");
  const [sortField, setSortField] = useState<ProductSortField>("revenue");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expandedCode, setExpandedCode] = useState<string | null>(null);
  const [orderDialogProduct, setOrderDialogProduct] = useState<{ code: string; name: string } | null>(null);

  const queryParams = new URLSearchParams();
  queryParams.set("startDate", startDate);
  queryParams.set("endDate", endDate);
  if (search) queryParams.set("search", search);
  if (catLarge) queryParams.set("categoryLarge", catLarge);
  if (catMedium) queryParams.set("categoryMedium", catMedium);
  if (catSmall) queryParams.set("categorySmall", catSmall);

  const { data, isLoading } = useQuery<any>({
    queryKey: [`/api/member/statistics/by-product?${queryParams.toString()}`],
    enabled: !!startDate && !!endDate,
  });

  const sorted = [...(data?.products || [])].sort((a: any, b: any) => {
    const m = sortDir === "asc" ? 1 : -1;
    return (a[sortField] - b[sortField]) * m;
  });

  function toggleSort(field: ProductSortField) {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }

  function SortIcon({ field }: { field: ProductSortField }) {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 inline" />;
    return sortDir === "asc" ? <ChevronUp className="h-3 w-3 ml-1 inline" /> : <ChevronDown className="h-3 w-3 ml-1 inline" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground invisible">검색</label>
          <div className="relative min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="상품명 또는 상품코드 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="member-product-search"
          />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">대분류</label>
          <Select value={catLarge || "__all__"} onValueChange={(v) => { setCatLarge(v === "__all__" ? "" : v); setCatMedium(""); setCatSmall(""); }}>
            <SelectTrigger className="w-[140px]" data-testid="member-cat-large">
              <SelectValue placeholder="전체" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">전체</SelectItem>
              {data?.categories?.large?.map((c: string) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">중분류</label>
          <Select value={catMedium || "__all__"} onValueChange={(v) => { setCatMedium(v === "__all__" ? "" : v); setCatSmall(""); }}>
            <SelectTrigger className="w-[140px]" data-testid="member-cat-medium">
              <SelectValue placeholder="전체" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">전체</SelectItem>
              {data?.categories?.medium?.map((c: string) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">소분류</label>
          <Select value={catSmall || "__all__"} onValueChange={(v) => setCatSmall(v === "__all__" ? "" : v)}>
            <SelectTrigger className="w-[140px]" data-testid="member-cat-small">
              <SelectValue placeholder="전체" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">전체</SelectItem>
              {data?.categories?.small?.map((c: string) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground invisible">다운</label>
          <a href={`/api/member/statistics/by-product/export?${queryParams.toString()}`} download>
            <Button size="sm" variant="outline" data-testid="button-export-member-products">
              <Download className="h-4 w-4 mr-1" />
              엑셀 다운로드
            </Button>
          </a>
        </div>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="pt-6">
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
      ) : sorted.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground" data-testid="member-empty-products">
            해당 기간에 상품 데이터가 없습니다
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">
              총 {sorted.length}개 상품 / 합계 {formatRevenue(data?.totalRevenue || 0)}
            </span>
          </div>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[200px]">상품명</TableHead>
                      <TableHead>상품코드</TableHead>
                      <TableHead>대분류</TableHead>
                      <TableHead>중분류</TableHead>
                      <TableHead>소분류</TableHead>
                      <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("quantity")}>
                        수량 <SortIcon field="quantity" />
                      </TableHead>
                      <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("revenue")}>
                        매입액 <SortIcon field="revenue" />
                      </TableHead>
                      <TableHead className="text-center">주문내역</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sorted.map((p: any) => (
                      <>
                        <TableRow
                          key={p.productCode}
                          className="cursor-pointer"
                          onClick={() => setExpandedCode(expandedCode === p.productCode ? null : p.productCode)}
                          data-testid={`member-product-row-${p.productCode}`}
                        >
                          <TableCell className="font-medium">{p.productName}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{p.productCode}</Badge>
                          </TableCell>
                          <TableCell>{p.categoryLarge || "-"}</TableCell>
                          <TableCell>{p.categoryMedium || "-"}</TableCell>
                          <TableCell>{p.categorySmall || "-"}</TableCell>
                          <TableCell className="text-right">{(p.quantity || 0).toLocaleString()}</TableCell>
                          <TableCell className="text-right font-medium">{formatRevenue(p.revenue || 0)}</TableCell>
                          <TableCell className="text-center">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => { e.stopPropagation(); setOrderDialogProduct({ code: p.productCode, name: p.productName }); }}
                              data-testid={`member-btn-orders-${p.productCode}`}
                            >
                              <ShoppingCart className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                        {expandedCode === p.productCode && (
                          <TableRow key={`${p.productCode}-drill`}>
                            <TableCell colSpan={8} className="p-0">
                              <ProductDrillDown productCode={p.productCode} startDate={startDate} endDate={endDate} />
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {orderDialogProduct && (
        <OrderListDialog
          productCode={orderDialogProduct.code}
          productName={orderDialogProduct.name}
          startDate={startDate}
          endDate={endDate}
          onClose={() => setOrderDialogProduct(null)}
        />
      )}
    </div>
  );
}

function OrderListDialog({
  productCode,
  productName,
  startDate,
  endDate,
  onClose,
}: {
  productCode: string;
  productName: string;
  startDate: string;
  endDate: string;
  onClose: () => void;
}) {
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading } = useQuery<any>({
    queryKey: [`/api/member/statistics/orders?startDate=${startDate}&endDate=${endDate}&productCode=${productCode}&page=${page}&limit=${limit}`],
  });

  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4" />
            {productName} 주문내역
          </DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : !data?.orders?.length ? (
          <div className="py-8 text-center text-muted-foreground">주문내역이 없습니다</div>
        ) : (
          <>
            <div className="text-sm text-muted-foreground mb-2">
              총 {total}건
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>주문번호</TableHead>
                    <TableHead>상품명</TableHead>
                    <TableHead className="text-right">공급가</TableHead>
                    <TableHead>수령인</TableHead>
                    <TableHead>운송장</TableHead>
                    <TableHead>배송일</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.orders.map((o: any) => (
                    <TableRow key={o.id} data-testid={`member-order-row-${o.id}`}>
                      <TableCell className="font-mono text-xs">{o.orderNumber}</TableCell>
                      <TableCell>{o.productName}</TableCell>
                      <TableCell className="text-right">{formatRevenue(o.supplyPrice || 0)}</TableCell>
                      <TableCell>{o.recipientName || "-"}</TableCell>
                      <TableCell>
                        {o.trackingNumber ? (
                          <span className="text-xs">
                            {o.courierCompany && <span className="text-muted-foreground">{o.courierCompany} </span>}
                            {o.trackingNumber}
                          </span>
                        ) : "-"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {o.updatedAt ? new Date(o.updatedAt).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" }) : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-4">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)} data-testid="member-orders-prev">
                  이전
                </Button>
                <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
                <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)} data-testid="member-orders-next">
                  다음
                </Button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function MemberStatsTab() {
  const { dateRange, setDateRange } = useDateRange("month");
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <BarChart3 className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold">통계관리</h2>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <TabsList data-testid="member-stats-tabs">
            <TabsTrigger value="overview" data-testid="member-tab-overview">매입 개요</TabsTrigger>
            <TabsTrigger value="by-product" data-testid="member-tab-by-product">상품별 매입</TabsTrigger>
          </TabsList>
          <DateRangeFilter
            onChange={setDateRange}
            defaultPreset="month"
            showLabel={false}
          />
        </div>

        <TabsContent value="overview" className="mt-4">
          <MemberOverviewTab startDate={dateRange.startDate} endDate={dateRange.endDate} />
        </TabsContent>

        <TabsContent value="by-product" className="mt-4">
          <ByProductTab startDate={dateRange.startDate} endDate={dateRange.endDate} />
        </TabsContent>
      </Tabs>
    </div>
  );
}