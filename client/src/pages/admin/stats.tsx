import { useState, useMemo } from "react";
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
  Download,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  BarChart3,
  FileText,
  X,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
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
      data-testid="growth-badge"
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

function OverviewTab({ startDate, endDate }: { startDate: string; endDate: string }) {
  const { data, isLoading } = useQuery<any>({
    queryKey: [`/api/admin/statistics/overview?startDate=${startDate}&endDate=${endDate}`],
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
        <CardContent className="py-12 text-center text-muted-foreground" data-testid="empty-overview">
          해당 기간에 매출 데이터가 없습니다
        </CardContent>
      </Card>
    );
  }

  const { summary, trend, topMembers, topProducts } = data;

  const summaryCards = [
    { label: "총 매출액", value: formatRevenue(summary.totalRevenue || 0), growth: summary.revenueGrowth },
    { label: "총 주문 건수", value: formatCount(summary.totalOrders || 0), growth: summary.ordersGrowth },
    { label: "평균 주문금액", value: formatRevenue(summary.avgOrderAmount || 0), growth: undefined },
    { label: "활성 회원 수", value: (summary.activeMemberCount || 0).toLocaleString() + "명", growth: undefined },
  ];

  const pieData = topMembers?.length
    ? topMembers.map((m: any) => ({ name: m.companyName || m.memberName, value: m.revenue }))
    : [];

  const totalPieRevenue = pieData.reduce((s: number, d: any) => s + d.value, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="summary-cards">
        {summaryCards.map((card, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold" data-testid={`summary-value-${i}`}>{card.value}</div>
              <GrowthBadge value={card.growth} />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">매출 추이</CardTitle>
        </CardHeader>
        <CardContent>
          {trend?.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
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
                    if (name === "revenue") return [formatRevenue(value), "매출액"];
                    if (name === "orders") return [formatCount(value), "주문수"];
                    return [value, name];
                  }}
                  labelFormatter={(label) => `${label}`}
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "6px" }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#5D7AF2" strokeWidth={2} fill="url(#revenueGradient)" />
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">회원별 매출 비중</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    dataKey="value"
                    label={({ name, value }: any) =>
                      `${name} ${totalPieRevenue > 0 ? ((value / totalPieRevenue) * 100).toFixed(1) : 0}%`
                    }
                    labelLine={false}
                  >
                    {pieData.map((_: any, idx: number) => (
                      <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [formatRevenue(value), "매출액"]}
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "6px" }}
                  />
                </PieChart>
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
            <CardTitle className="text-base">상품별 매출 순위</CardTitle>
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
                    formatter={(value: number) => [formatRevenue(value), "매출액"]}
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
    </div>
  );
}

type SortField = "revenue" | "orderCount" | "avgOrderAmount";
type SortDir = "asc" | "desc";

function MemberDrillDown({
  memberId,
  startDate,
  endDate,
}: {
  memberId: string;
  startDate: string;
  endDate: string;
}) {
  const { data, isLoading } = useQuery<any>({
    queryKey: [`/api/admin/statistics/by-member/${memberId}?startDate=${startDate}&endDate=${endDate}`],
    enabled: !!memberId,
  });

  if (isLoading) {
    return (
      <div className="p-4 flex justify-center">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="p-4 space-y-4 bg-muted/30 rounded-md">
      {data.trend?.length > 0 && (
        <div>
          <p className="text-sm font-medium mb-2">일별 매출 추이</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data.trend}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} className="text-muted-foreground" />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => v >= 10000 ? `${(v / 10000).toLocaleString()}만` : v.toLocaleString()} className="text-muted-foreground" />
              <Tooltip
                formatter={(value: number) => [formatRevenue(value), "매출액"]}
                contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "6px" }}
              />
              <Area type="monotone" dataKey="revenue" stroke="#5D7AF2" fill="#5D7AF2" fillOpacity={0.15} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
      {data.products?.length > 0 && (
        <div>
          <p className="text-sm font-medium mb-2">상품별 매출</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>상품명</TableHead>
                <TableHead className="text-right">수량</TableHead>
                <TableHead className="text-right">매출액</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.products.map((p: any, i: number) => (
                <TableRow key={i}>
                  <TableCell>{p.productName}</TableCell>
                  <TableCell className="text-right">{(p.quantity || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-right">{formatRevenue(p.revenue || 0)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function ByMemberTab({ startDate, endDate }: { startDate: string; endDate: string }) {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("revenue");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<any>({
    queryKey: [`/api/admin/statistics/by-member?startDate=${startDate}&endDate=${endDate}&search=${search}`],
    enabled: !!startDate && !!endDate,
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const members = useMemo(() => {
    if (!data?.members) return [];
    const list = data.members.map((m: any) => ({
      ...m,
      avgOrderAmount: m.orderCount > 0 ? m.revenue / m.orderCount : 0,
    }));
    list.sort((a: any, b: any) => {
      const mul = sortDir === "asc" ? 1 : -1;
      return (a[sortField] - b[sortField]) * mul;
    });
    return list;
  }, [data?.members, sortField, sortDir]);

  const totalRevenue = data?.totalRevenue || 0;

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 inline" />;
    return sortDir === "asc" ? <ChevronUp className="h-3 w-3 ml-1 inline" /> : <ChevronDown className="h-3 w-3 ml-1 inline" />;
  };

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="회원명 / 업체명 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
          data-testid="input-member-search"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : members.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground" data-testid="empty-members">
            해당 기간에 매출 데이터가 없습니다
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">순위</TableHead>
                    <TableHead>회원명(업체명)</TableHead>
                    <TableHead className="text-center">거래 기간</TableHead>
                    <TableHead
                      className="text-right cursor-pointer select-none"
                      onClick={() => handleSort("orderCount")}
                      data-testid="sort-orderCount"
                    >
                      주문 건수 <SortIcon field="orderCount" />
                    </TableHead>
                    <TableHead
                      className="text-right cursor-pointer select-none"
                      onClick={() => handleSort("revenue")}
                      data-testid="sort-revenue"
                    >
                      매출액 <SortIcon field="revenue" />
                    </TableHead>
                    <TableHead
                      className="text-right cursor-pointer select-none"
                      onClick={() => handleSort("avgOrderAmount")}
                      data-testid="sort-avgOrderAmount"
                    >
                      평균 주문금액 <SortIcon field="avgOrderAmount" />
                    </TableHead>
                    <TableHead className="text-right">매출 비중</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((m: any, idx: number) => {
                    const share = totalRevenue > 0 ? ((m.revenue / totalRevenue) * 100).toFixed(1) + "%" : "0%";
                    const isExpanded = expandedId === m.memberId;
                    const dateRange = m.firstOrderDate === m.lastOrderDate
                      ? m.firstOrderDate || "-"
                      : `${m.firstOrderDate || ""} ~ ${m.lastOrderDate || ""}`;
                    return (
                      <>
                        <TableRow
                          key={m.memberId}
                          className="cursor-pointer hover-elevate"
                          onClick={() => setExpandedId(isExpanded ? null : m.memberId)}
                          data-testid={`row-member-${m.memberId}`}
                        >
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell className="font-medium">
                            {m.companyName || m.memberName}
                            {m.companyName && m.memberName && m.companyName !== m.memberName && (
                              <span className="text-muted-foreground text-xs ml-1">({m.memberName})</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center text-sm text-muted-foreground whitespace-nowrap" data-testid={`date-range-${m.memberId}`}>{dateRange}</TableCell>
                          <TableCell className="text-right">{formatCount(m.orderCount || 0)}</TableCell>
                          <TableCell className="text-right font-medium">{formatRevenue(m.revenue || 0)}</TableCell>
                          <TableCell className="text-right">{formatRevenue(Math.round(m.avgOrderAmount || 0))}</TableCell>
                          <TableCell className="text-right">{share}</TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow key={`detail-${m.memberId}`}>
                            <TableCell colSpan={7} className="p-0">
                              <MemberDrillDown memberId={m.memberId} startDate={startDate} endDate={endDate} />
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ProductDrillDown({
  productCode,
  startDate,
  endDate,
}: {
  productCode: string;
  startDate: string;
  endDate: string;
}) {
  const { data, isLoading } = useQuery<any>({
    queryKey: [`/api/admin/statistics/by-product/${productCode}?startDate=${startDate}&endDate=${endDate}`],
    enabled: !!productCode,
  });

  if (isLoading) {
    return (
      <div className="p-4 flex justify-center">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="p-4 space-y-4 bg-muted/30 rounded-md">
      {data.trend?.length > 0 && (
        <div>
          <p className="text-sm font-medium mb-2">일별 매출 추이</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data.trend}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} className="text-muted-foreground" />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => v >= 10000 ? `${(v / 10000).toLocaleString()}만` : v.toLocaleString()} className="text-muted-foreground" />
              <Tooltip
                formatter={(value: number) => [formatRevenue(value), "매출액"]}
                contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "6px" }}
              />
              <Area type="monotone" dataKey="revenue" stroke="#10B981" fill="#10B981" fillOpacity={0.15} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
      {data.members?.length > 0 && (
        <div>
          <p className="text-sm font-medium mb-2">회원별 매출</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>업체명</TableHead>
                <TableHead className="text-right">수량</TableHead>
                <TableHead className="text-right">매출액</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.members.map((m: any, i: number) => (
                <TableRow key={i}>
                  <TableCell>{m.companyName || m.memberName}</TableCell>
                  <TableCell className="text-right">{(m.quantity || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-right">{formatRevenue(m.revenue || 0)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function ByProductTab({ startDate, endDate }: { startDate: string; endDate: string }) {
  const [search, setSearch] = useState("");
  const [categoryLarge, setCategoryLarge] = useState("");
  const [categoryMedium, setCategoryMedium] = useState("");
  const [categorySmall, setCategorySmall] = useState("");
  const [expandedCode, setExpandedCode] = useState<string | null>(null);

  const params = new URLSearchParams({
    startDate,
    endDate,
    ...(search && { search }),
    ...(categoryLarge && { categoryLarge }),
    ...(categoryMedium && { categoryMedium }),
    ...(categorySmall && { categorySmall }),
  });

  const { data, isLoading } = useQuery<any>({
    queryKey: [`/api/admin/statistics/by-product?${params.toString()}`],
    enabled: !!startDate && !!endDate,
  });

  const products = data?.products || [];
  const totalRevenue = data?.totalRevenue || 0;
  const categories = data?.categories || { large: [], medium: [], small: [] };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">대분류</label>
          <Select
            value={categoryLarge || "__all__"}
            onValueChange={(v) => {
              setCategoryLarge(v === "__all__" ? "" : v);
              setCategoryMedium("");
              setCategorySmall("");
            }}
          >
            <SelectTrigger className="w-[140px]" data-testid="select-category-large">
              <SelectValue placeholder="전체" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">전체</SelectItem>
              {(categories.large || []).map((c: string) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">중분류</label>
          <Select
            value={categoryMedium || "__all__"}
            onValueChange={(v) => {
              setCategoryMedium(v === "__all__" ? "" : v);
              setCategorySmall("");
            }}
          >
            <SelectTrigger className="w-[140px]" data-testid="select-category-medium">
              <SelectValue placeholder="전체" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">전체</SelectItem>
              {(categories.medium || []).map((c: string) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">소분류</label>
          <Select
            value={categorySmall || "__all__"}
            onValueChange={(v) => setCategorySmall(v === "__all__" ? "" : v)}
          >
            <SelectTrigger className="w-[140px]" data-testid="select-category-small">
              <SelectValue placeholder="전체" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">전체</SelectItem>
              {(categories.small || []).map((c: string) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="상품명 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 w-[200px]"
            data-testid="input-product-search"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : products.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground" data-testid="empty-products">
            해당 기간에 매출 데이터가 없습니다
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">순위</TableHead>
                    <TableHead>상품명</TableHead>
                    <TableHead>분류</TableHead>
                    <TableHead className="text-right">판매 수량</TableHead>
                    <TableHead className="text-right">매출액</TableHead>
                    <TableHead className="text-right">매출 비중</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((p: any, idx: number) => {
                    const share = totalRevenue > 0 ? ((p.revenue / totalRevenue) * 100).toFixed(1) + "%" : "0%";
                    const categoryStr = [p.categoryLarge, p.categoryMedium, p.categorySmall].filter(Boolean).join(" > ");
                    const isExpanded = expandedCode === p.productCode;
                    return (
                      <>
                        <TableRow
                          key={p.productCode}
                          className="cursor-pointer hover-elevate"
                          onClick={() => setExpandedCode(isExpanded ? null : p.productCode)}
                          data-testid={`row-product-${p.productCode}`}
                        >
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell className="font-medium">{p.productName}</TableCell>
                          <TableCell className="text-muted-foreground text-xs max-w-[200px] truncate">{categoryStr}</TableCell>
                          <TableCell className="text-right">{(p.quantity || 0).toLocaleString()}</TableCell>
                          <TableCell className="text-right font-medium">{formatRevenue(p.revenue || 0)}</TableCell>
                          <TableCell className="text-right">{share}</TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow key={`detail-${p.productCode}`}>
                            <TableCell colSpan={6} className="p-0">
                              <ProductDrillDown productCode={p.productCode} startDate={startDate} endDate={endDate} />
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function OrderListDialog({
  open,
  onOpenChange,
  startDate,
  endDate,
  memberId,
  productCode,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  startDate: string;
  endDate: string;
  memberId?: number;
  productCode?: string;
}) {
  const [page, setPage] = useState(1);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);

  const params = new URLSearchParams({
    startDate,
    endDate,
    page: String(page),
    limit: "20",
    ...(memberId && { memberId: String(memberId) }),
    ...(productCode && { productCode }),
  });

  const { data, isLoading } = useQuery<any>({
    queryKey: [`/api/admin/statistics/orders?${params.toString()}`],
    enabled: open,
  });

  const exportUrl = `/api/admin/statistics/orders/export?${params.toString()}`;

  const orders = data?.orders || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <>
      <Dialog open={open && !selectedOrderId} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2 flex-wrap">
              <span>주문 상세 목록</span>
              <a href={exportUrl} download>
                <Button size="sm" variant="outline" data-testid="button-export-orders">
                  <Download className="h-4 w-4 mr-1" />
                  엑셀 다운로드
                </Button>
              </a>
            </DialogTitle>
          </DialogHeader>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : orders.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">주문 데이터가 없습니다</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>주문번호</TableHead>
                      <TableHead>주문일시</TableHead>
                      <TableHead>회원명</TableHead>
                      <TableHead>상품명</TableHead>
                      <TableHead className="text-right">주문금액</TableHead>
                      <TableHead>상태</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((o: any) => (
                      <TableRow key={o.orderId} data-testid={`row-order-${o.orderId}`}>
                        <TableCell>
                          <Button
                            variant="ghost"
                            className="text-foreground underline"
                            onClick={() => setSelectedOrderId(o.orderId)}
                            data-testid={`link-order-${o.orderId}`}
                          >
                            {o.orderNumber || o.orderId}
                          </Button>
                        </TableCell>
                        <TableCell className="text-sm">{o.orderDate}</TableCell>
                        <TableCell>{o.memberName}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{o.productName}</TableCell>
                        <TableCell className="text-right">{formatRevenue(o.orderAmount || 0)}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{o.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                    data-testid="button-prev-page"
                  >
                    이전
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {page} / {totalPages}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page >= totalPages}
                    onClick={() => setPage(page + 1)}
                    data-testid="button-next-page"
                  >
                    다음
                  </Button>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {selectedOrderId && (
        <OrderDetailDialog
          orderId={selectedOrderId}
          open={!!selectedOrderId}
          onOpenChange={(v) => { if (!v) setSelectedOrderId(null); }}
        />
      )}
    </>
  );
}

function OrderDetailDialog({
  orderId,
  open,
  onOpenChange,
}: {
  orderId: number;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { data, isLoading } = useQuery<any>({
    queryKey: [`/api/admin/statistics/orders/${orderId}`],
    enabled: open && !!orderId,
  });

  const order = data?.order;
  const settlement = data?.settlement;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>주문 상세 정보</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : !order ? (
          <div className="py-8 text-center text-muted-foreground">주문 정보를 불러올 수 없습니다</div>
        ) : (
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold mb-2">주문 정보</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-muted-foreground">주문번호</div>
                <div>{order.orderNumber || order.orderId}</div>
                <div className="text-muted-foreground">주문일시</div>
                <div>{order.orderDate}</div>
                <div className="text-muted-foreground">상태</div>
                <div><Badge variant="secondary">{order.status}</Badge></div>
                <div className="text-muted-foreground">주문금액</div>
                <div className="font-medium">{formatRevenue(order.orderAmount || 0)}</div>
              </div>
            </div>

            {order.memberName && (
              <div>
                <h4 className="text-sm font-semibold mb-2">회원 정보</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-muted-foreground">회원명</div>
                  <div>{order.memberName}</div>
                  {order.companyName && (
                    <>
                      <div className="text-muted-foreground">업체명</div>
                      <div>{order.companyName}</div>
                    </>
                  )}
                </div>
              </div>
            )}

            {order.productName && (
              <div>
                <h4 className="text-sm font-semibold mb-2">상품 정보</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-muted-foreground">상품명</div>
                  <div>{order.productName}</div>
                  {order.quantity && (
                    <>
                      <div className="text-muted-foreground">수량</div>
                      <div>{order.quantity.toLocaleString()}</div>
                    </>
                  )}
                </div>
              </div>
            )}

            {order.shippingAddress && (
              <div>
                <h4 className="text-sm font-semibold mb-2">배송 정보</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-muted-foreground">배송지</div>
                  <div>{order.shippingAddress}</div>
                  {order.trackingNumber && (
                    <>
                      <div className="text-muted-foreground">운송장번호</div>
                      <div>{order.trackingNumber}</div>
                    </>
                  )}
                </div>
              </div>
            )}

            {settlement && (
              <div>
                <h4 className="text-sm font-semibold mb-2">정산 정보</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {settlement.settlementAmount !== undefined && (
                    <>
                      <div className="text-muted-foreground">정산금액</div>
                      <div>{formatRevenue(settlement.settlementAmount)}</div>
                    </>
                  )}
                  {settlement.status && (
                    <>
                      <div className="text-muted-foreground">정산상태</div>
                      <div><Badge variant="secondary">{settlement.status}</Badge></div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function AdminStatsPage() {
  const { dateRange, setDateRange } = useDateRange("month");
  const [activeTab, setActiveTab] = useState("overview");
  const [orderDialog, setOrderDialog] = useState<{
    open: boolean;
    memberId?: number;
    productCode?: string;
  }>({ open: false });

  return (
    <div className="space-y-6" data-testid="admin-stats-page">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <BarChart3 className="h-6 w-6" />
          <h1 className="text-2xl font-bold">매출 통계</h1>
        </div>
        <div className="mr-4">
          <DateRangeFilter onChange={setDateRange} defaultPreset="month" />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList data-testid="stats-tabs">
          <TabsTrigger value="overview" data-testid="tab-overview">매출 개요</TabsTrigger>
          <TabsTrigger value="by-member" data-testid="tab-by-member">회원별 매출</TabsTrigger>
          <TabsTrigger value="by-product" data-testid="tab-by-product">상품별 매출</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <OverviewTab startDate={dateRange.startDate} endDate={dateRange.endDate} />
        </TabsContent>

        <TabsContent value="by-member" className="mt-4">
          <ByMemberTab startDate={dateRange.startDate} endDate={dateRange.endDate} />
        </TabsContent>

        <TabsContent value="by-product" className="mt-4">
          <ByProductTab startDate={dateRange.startDate} endDate={dateRange.endDate} />
        </TabsContent>
      </Tabs>

      <OrderListDialog
        open={orderDialog.open}
        onOpenChange={(v) => setOrderDialog((prev) => ({ ...prev, open: v }))}
        startDate={dateRange.startDate}
        endDate={dateRange.endDate}
        memberId={orderDialog.memberId}
        productCode={orderDialog.productCode}
      />
    </div>
  );
}
