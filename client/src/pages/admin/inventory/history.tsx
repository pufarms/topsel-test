import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Loader2, Search, RotateCcw, History, ArrowUp, ArrowDown, RefreshCw, FileSpreadsheet } from "lucide-react";
import type { StockHistory } from "@shared/schema";

export default function InventoryHistoryPage() {
  const [stockType, setStockType] = useState("all");
  const [actionType, setActionType] = useState("all");
  const [source, setSource] = useState("all");
  const [adminId, setAdminId] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [keyword, setKeyword] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);

  const buildQueryParams = () => {
    const params = new URLSearchParams();
    if (stockType !== "all") params.append("stockType", stockType);
    if (actionType !== "all") params.append("actionType", actionType);
    if (source !== "all") params.append("source", source);
    if (adminId !== "all") params.append("adminId", adminId);
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);
    if (searchKeyword) params.append("keyword", searchKeyword);
    return params.toString();
  };

  const { data: historyData = [], isLoading, refetch } = useQuery<StockHistory[]>({
    queryKey: ["/api/stock-history", stockType, actionType, source, adminId, startDate, endDate, searchKeyword],
    queryFn: async () => {
      const queryString = buildQueryParams();
      const url = `/api/stock-history${queryString ? `?${queryString}` : ""}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch history");
      return res.json();
    },
  });

  const { data: admins = [] } = useQuery<string[]>({
    queryKey: ["/api/stock-history/admins"],
  });

  const handleSearch = () => {
    setSearchKeyword(keyword);
    setCurrentPage(1);
  };

  const handleReset = () => {
    setStockType("all");
    setActionType("all");
    setSource("all");
    setAdminId("all");
    setStartDate("");
    setEndDate("");
    setKeyword("");
    setSearchKeyword("");
    setCurrentPage(1);
  };

  const handleDownload = async () => {
    const queryString = buildQueryParams();
    const url = `/api/stock-history/download${queryString ? `?${queryString}` : ""}`;
    window.location.href = url;
  };

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return historyData.slice(start, end);
  }, [historyData, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(historyData.length / itemsPerPage);

  const getStockTypeBadge = (type: string) => {
    switch (type) {
      case "product":
        return <Badge variant="default">공급상품</Badge>;
      case "material":
        return <Badge variant="secondary">원재료</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const getActionTypeBadge = (action: string) => {
    switch (action) {
      case "in":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"><ArrowUp className="w-3 h-3 mr-1" />입고</Badge>;
      case "out":
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100"><ArrowDown className="w-3 h-3 mr-1" />출고</Badge>;
      case "adjust":
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100"><RefreshCw className="w-3 h-3 mr-1" />조정</Badge>;
      default:
        return <Badge variant="outline">{action}</Badge>;
    }
  };

  const getSourceBadge = (src: string) => {
    switch (src) {
      case "manual":
        return <Badge variant="outline">수동</Badge>;
      case "order":
        return <Badge variant="secondary">주문연동</Badge>;
      default:
        return <Badge variant="outline">{src}</Badge>;
    }
  };

  const formatQuantity = (qty: number) => {
    if (qty > 0) return <span className="text-green-600 font-medium">+{qty}</span>;
    if (qty < 0) return <span className="text-red-600 font-medium">{qty}</span>;
    return <span className="text-muted-foreground">0</span>;
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2">
          <History className="h-6 w-6 text-primary" />
          <h1 className="text-xl md:text-2xl font-bold">재고 이력</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading} data-testid="button-refresh">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
            <span className="hidden sm:inline ml-2">새로고침</span>
          </Button>
          <Button onClick={handleDownload} variant="default" data-testid="button-download">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline ml-2">엑셀 다운로드</span>
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>재고 구분</Label>
              <Select value={stockType} onValueChange={(v) => { setStockType(v); setCurrentPage(1); }}>
                <SelectTrigger data-testid="select-stock-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="product">공급상품</SelectItem>
                  <SelectItem value="material">원재료</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>유형</Label>
              <Select value={actionType} onValueChange={(v) => { setActionType(v); setCurrentPage(1); }}>
                <SelectTrigger data-testid="select-action-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="in">입고</SelectItem>
                  <SelectItem value="out">출고</SelectItem>
                  <SelectItem value="adjust">조정</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>출처</Label>
              <Select value={source} onValueChange={(v) => { setSource(v); setCurrentPage(1); }}>
                <SelectTrigger data-testid="select-source">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="manual">수동</SelectItem>
                  <SelectItem value="order">주문연동</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>담당자</Label>
              <Select value={adminId} onValueChange={(v) => { setAdminId(v); setCurrentPage(1); }}>
                <SelectTrigger data-testid="select-admin">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  {admins.map((admin) => (
                    <SelectItem key={admin} value={admin}>{admin}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>시작일</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }}
                data-testid="input-start-date"
              />
            </div>

            <div className="space-y-2">
              <Label>종료일</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }}
                data-testid="input-end-date"
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>검색 (코드/상품명/주문ID)</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="검색어 입력"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  data-testid="input-keyword"
                />
                <Button variant="outline" onClick={handleSearch} data-testid="button-search">
                  <Search className="h-4 w-4" />
                </Button>
                <Button variant="ghost" onClick={handleReset} data-testid="button-reset">
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : historyData.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <FileSpreadsheet className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium text-muted-foreground">재고 이력이 없습니다</p>
              <p className="text-sm text-muted-foreground">입고/출고/조정 내역이 기록되면 여기에 표시됩니다.</p>
            </div>
          ) : (
            <>
              <div className="hidden lg:block table-scroll-container">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-background">
                    <TableRow>
                      <TableHead className="w-16">번호</TableHead>
                      <TableHead className="w-24">구분</TableHead>
                      <TableHead className="w-24">유형</TableHead>
                      <TableHead className="w-32">코드</TableHead>
                      <TableHead>상품/재료명</TableHead>
                      <TableHead className="w-20 text-right">수량</TableHead>
                      <TableHead className="w-24 text-right">변경전</TableHead>
                      <TableHead className="w-24 text-right">변경후</TableHead>
                      <TableHead className="w-24">사유</TableHead>
                      <TableHead className="w-24">출처</TableHead>
                      <TableHead className="w-28">담당자</TableHead>
                      <TableHead className="w-36">일시</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedData.map((item, index) => (
                      <TableRow key={item.id} data-testid={`row-history-${item.id}`}>
                        <TableCell className="text-muted-foreground">{(currentPage - 1) * itemsPerPage + index + 1}</TableCell>
                        <TableCell>{getStockTypeBadge(item.stockType)}</TableCell>
                        <TableCell>{getActionTypeBadge(item.actionType)}</TableCell>
                        <TableCell className="font-mono text-sm">{item.itemCode}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{item.itemName}</TableCell>
                        <TableCell className="text-right font-mono">{formatQuantity(item.quantity)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{item.beforeStock}</TableCell>
                        <TableCell className="text-right font-medium">{item.afterStock}</TableCell>
                        <TableCell className="text-muted-foreground">{item.reason || "-"}</TableCell>
                        <TableCell>{getSourceBadge(item.source)}</TableCell>
                        <TableCell className="text-muted-foreground">{item.adminId}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatDate(item.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="lg:hidden p-4 space-y-3">
                {paginatedData.map((item, index) => (
                  <Card key={item.id} data-testid={`card-history-${item.id}`}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">#{(currentPage - 1) * itemsPerPage + index + 1}</span>
                          {getStockTypeBadge(item.stockType)}
                          {getActionTypeBadge(item.actionType)}
                        </div>
                        {getSourceBadge(item.source)}
                      </div>
                      <div className="font-medium">{item.itemName}</div>
                      <div className="text-sm text-muted-foreground font-mono">{item.itemCode}</div>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">수량: </span>
                          {formatQuantity(item.quantity)}
                        </div>
                        <div>
                          <span className="text-muted-foreground">이전: </span>
                          {item.beforeStock}
                        </div>
                        <div>
                          <span className="text-muted-foreground">이후: </span>
                          <span className="font-medium">{item.afterStock}</span>
                        </div>
                      </div>
                      {item.reason && (
                        <div className="text-sm">
                          <span className="text-muted-foreground">사유: </span>{item.reason}
                        </div>
                      )}
                      <div className="flex justify-between text-xs text-muted-foreground pt-2 border-t">
                        <span>담당자: {item.adminId}</span>
                        <span>{formatDate(item.createdAt)}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 p-4 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    data-testid="button-first-page"
                  >
                    처음
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    data-testid="button-prev-page"
                  >
                    이전
                  </Button>
                  <span className="px-4 text-sm text-muted-foreground">
                    {currentPage} / {totalPages} 페이지 (총 {historyData.length}건)
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    data-testid="button-next-page"
                  >
                    다음
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    data-testid="button-last-page"
                  >
                    마지막
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
