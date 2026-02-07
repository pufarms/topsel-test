import { useState, useCallback, useMemo, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSSE } from "@/hooks/use-sse";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileDown, XCircle, Upload, FileSpreadsheet, ChevronLeft, ChevronRight, Loader2, BanIcon, AlertCircle } from "lucide-react";
import { MemberOrderFilter, MemberOrderFilterState } from "@/components/member/MemberOrderFilter";
import { DateRangeFilter, useDateRange } from "@/components/common/DateRangeFilter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { PendingOrder } from "@shared/schema";
import * as XLSX from "xlsx";

interface MemberOrderCancelProps {
  canOrder?: boolean;
}

export default function MemberOrderCancel({ canOrder = true }: MemberOrderCancelProps) {
  useSSE();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { dateRange, setDateRange } = useDateRange("today");
  const [filters, setFilters] = useState<MemberOrderFilterState | null>(null);
  const [pageSize, setPageSize] = useState<number | "all">(30);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);

  const { data: allOrders = [], isLoading } = useQuery<PendingOrder[]>({
    queryKey: ["/api/member/pending-orders", dateRange.startDate, dateRange.endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateRange.startDate) params.set("startDate", dateRange.startDate);
      if (dateRange.endDate) params.set("endDate", dateRange.endDate);
      const res = await fetch(`/api/member/pending-orders?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: cancelDeadlineStatus } = useQuery<{ cancelDeadlineClosed: boolean }>({
    queryKey: ["/api/member/cancel-deadline-status"],
  });

  const cancelDeadlineClosed = cancelDeadlineStatus?.cancelDeadlineClosed ?? false;

  const cancelledOrders = allOrders.filter(o => o.status === "회원취소" || o.status === "취소");

  const filteredOrders = useMemo(() => {
    if (!filters) return cancelledOrders;

    return cancelledOrders.filter(order => {
      if (filters.categoryLarge && order.categoryLarge !== filters.categoryLarge) return false;
      if (filters.categoryMedium && order.categoryMedium !== filters.categoryMedium) return false;
      if (filters.categorySmall && order.categorySmall !== filters.categorySmall) return false;

      if (filters.searchTerm && filters.searchTerm.trim()) {
        const term = filters.searchTerm.trim().toLowerCase();
        const searchable = [
          order.ordererName,
          order.recipientName,
          order.productName,
          order.customOrderNumber,
          order.trackingNumber,
        ].filter(Boolean).join(" ").toLowerCase();
        if (!searchable.includes(term)) return false;
      }

      return true;
    });
  }, [cancelledOrders, filters]);

  const totalPages = pageSize === "all" ? 1 : Math.ceil(filteredOrders.length / pageSize);
  const displayedOrders = pageSize === "all"
    ? filteredOrders
    : filteredOrders.slice((currentPage - 1) * (pageSize as number), currentPage * (pageSize as number));

  const handlePageChange = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedOrders(displayedOrders.map(o => o.id));
    } else {
      setSelectedOrders([]);
    }
  };

  const handleSelectOrder = (orderId: string, checked: boolean) => {
    if (checked) {
      setSelectedOrders(prev => [...prev, orderId]);
    } else {
      setSelectedOrders(prev => prev.filter(id => id !== orderId));
    }
  };

  const handleFilterChange = (newFilters: MemberOrderFilterState) => {
    setFilters(newFilters);
    setCurrentPage(1);
    setSelectedOrders([]);
  };

  const getDownloadOrders = useCallback(() => {
    if (selectedOrders.length > 0) {
      return filteredOrders.filter(o => selectedOrders.includes(o.id));
    }
    return filteredOrders;
  }, [selectedOrders, filteredOrders]);

  const handleDownloadTemplate = useCallback(() => {
    const headers = ["수령자명", "수령자휴대폰번호", "수령자 전화번호", "수령자 주소", "배송메시지", "상품명", "수량", "주문번호", "운송장번호", "택배사"];
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "운송장-업로드-양식");
    XLSX.writeFile(wb, "회원취소_등록양식.xlsx");
  }, []);

  const handleDownloadCancel = useCallback(() => {
    const orders = getDownloadOrders();
    if (orders.length === 0) {
      toast({ title: "다운로드할 주문이 없습니다.", variant: "destructive" });
      return;
    }

    setIsDownloading(true);
    try {
      const data = orders.map(order => ({
        "상태": "취소",
        "주문자명": order.ordererName || "",
        "주문자 전화번호": order.ordererPhone || "",
        "주문자 주소": order.ordererAddress || "",
        "수령자명": order.recipientName || "",
        "수령자휴대폰번호": order.recipientMobile || "",
        "수령자 전화번호": order.recipientPhone || "",
        "수령자 주소": order.recipientAddress || "",
        "배송메시지": order.deliveryMessage
          ? order.deliveryMessage.replace(/\s*\[주소확인필요:[^\]]*\]/g, "").trim()
          : "",
        "상품명": order.productName || "",
        "수량": 1,
        "주문번호": order.customOrderNumber || "",
        "운송장번호": order.trackingNumber || "",
        "택배사": order.courierCompany || "",
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "취소건");
      const now = new Date();
      const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
      XLSX.writeFile(wb, `취소건_다운로드_${dateStr}.xlsx`);
    } finally {
      setIsDownloading(false);
    }
  }, [getDownloadOrders, toast]);

  const cancelMutation = useMutation({
    mutationFn: async (orderNumbers: string[]) => {
      const res = await apiRequest("POST", "/api/member/cancel-orders", { orderNumbers });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: `${data.cancelledCount}건의 주문이 즉시 취소 처리되었습니다.`,
        description: data.errors && data.errors.length > 0
          ? `오류: ${data.errors.join(", ")}`
          : "재고가 복구되었습니다.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/member/pending-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/order-stats"] });
    },
    onError: (error: any) => {
      toast({ title: "취소 처리 실패", description: error.message, variant: "destructive" });
    },
  });

  const handleCancelRegister = useCallback(() => {
    if (cancelDeadlineClosed) {
      toast({ title: "취소마감 상태입니다.", description: "더 이상 취소 등록이 불가합니다.", variant: "destructive" });
      return;
    }
    fileInputRef.current?.click();
  }, [cancelDeadlineClosed, toast]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

      if (rows.length === 0) {
        toast({ title: "파일에 데이터가 없습니다.", variant: "destructive" });
        return;
      }

      const requiredCols = ["주문번호"];
      const headers = Object.keys(rows[0]);
      const missing = requiredCols.filter(col => !headers.includes(col));
      if (missing.length > 0) {
        toast({ title: `필수 컬럼이 없습니다: ${missing.join(", ")}`, variant: "destructive" });
        return;
      }

      const orderNumbers = rows
        .map(row => String(row["주문번호"] || "").trim())
        .filter(Boolean);

      if (orderNumbers.length === 0) {
        toast({ title: "유효한 주문번호가 없습니다.", variant: "destructive" });
        return;
      }

      cancelMutation.mutate(orderNumbers);
    } catch {
      toast({ title: "파일을 읽을 수 없습니다.", variant: "destructive" });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [toast, cancelMutation]);

  return (
    <div className="space-y-4">
      {!canOrder && (
        <Card className="bg-amber-50 dark:bg-amber-950/30">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-6 w-6 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-lg font-bold text-amber-700 dark:text-amber-400 mb-2">기능 제한</h3>
                <p className="text-sm text-muted-foreground">
                  스타트(START) 등급 이상 회원만 취소건 등록 및 다운로드가 가능합니다.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={handleFileUpload}
        data-testid="input-cancel-file"
      />
      <Card className="overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">취소건 등록</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 overflow-hidden">
          <DateRangeFilter onChange={setDateRange} defaultPreset="today" />
          <MemberOrderFilter
            onFilterChange={handleFilterChange}
            showSearchField={true}
            searchOptions={[
              { value: "orderId", label: "주문번호" },
              { value: "productName", label: "상품명" },
              { value: "recipientName", label: "수령자명" },
            ]}
          />

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm">
              <span>표시 개수:</span>
              <select
                className="h-8 px-2 border rounded text-sm"
                value={pageSize === "all" ? "all" : pageSize}
                onChange={(e) => {
                  setPageSize(e.target.value === "all" ? "all" : Number(e.target.value));
                  setCurrentPage(1);
                }}
                data-testid="select-cancel-page-size"
              >
                <option value={10}>10개씩</option>
                <option value={30}>30개씩</option>
                <option value={100}>100개씩</option>
                <option value="all">전체</option>
              </select>
              <span className="text-muted-foreground">
                총 {filteredOrders.length}건
                {selectedOrders.length > 0 && ` (${selectedOrders.length}건 선택)`}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant={cancelDeadlineClosed ? "outline" : "default"}
                onClick={handleCancelRegister}
                disabled={!canOrder || cancelDeadlineClosed || cancelMutation.isPending}
                data-testid="button-cancel-register"
              >
                {cancelMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : cancelDeadlineClosed ? (
                  <BanIcon className="h-4 w-4 mr-1" />
                ) : (
                  <Upload className="h-4 w-4 mr-1" />
                )}
                {cancelDeadlineClosed ? "취소마감" : "취소건 등록"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleDownloadTemplate}
                disabled={!canOrder}
                data-testid="button-cancel-template"
              >
                <FileSpreadsheet className="h-4 w-4 mr-1" />
                양식 다운로드
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!canOrder || filteredOrders.length === 0 || isDownloading}
                onClick={handleDownloadCancel}
                data-testid="button-cancel-download"
              >
                {isDownloading ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <FileDown className="h-4 w-4 mr-1" />
                )}
                취소건 다운로드
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="border rounded-lg table-scroll-container">
              <Table className="min-w-[1600px]">
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow className="bg-muted/50">
                    <TableHead className="whitespace-nowrap px-3">
                      <Checkbox
                        checked={displayedOrders.length > 0 && selectedOrders.length === displayedOrders.length}
                        onCheckedChange={(checked) => handleSelectAll(!!checked)}
                        data-testid="checkbox-cancel-all"
                      />
                    </TableHead>
                    <TableHead className="whitespace-nowrap px-3">상태</TableHead>
                    <TableHead className="whitespace-nowrap px-3">주문자명</TableHead>
                    <TableHead className="whitespace-nowrap px-3">주문자 전화번호</TableHead>
                    <TableHead className="whitespace-nowrap px-3">주문자 주소</TableHead>
                    <TableHead className="whitespace-nowrap px-3">수령자명</TableHead>
                    <TableHead className="whitespace-nowrap px-3">수령자 휴대폰번호</TableHead>
                    <TableHead className="whitespace-nowrap px-3">수령자 전화번호</TableHead>
                    <TableHead className="whitespace-nowrap px-3">수령자 주소</TableHead>
                    <TableHead className="whitespace-nowrap px-3">배송메시지</TableHead>
                    <TableHead className="whitespace-nowrap px-3">상품명</TableHead>
                    <TableHead className="whitespace-nowrap px-3">수량</TableHead>
                    <TableHead className="whitespace-nowrap px-3">주문번호</TableHead>
                    <TableHead className="whitespace-nowrap px-3">운송장번호</TableHead>
                    <TableHead className="whitespace-nowrap px-3">택배사</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={15} className="text-center py-8 text-muted-foreground">
                        취소 등록된 주문이 없습니다.
                      </TableCell>
                    </TableRow>
                  ) : displayedOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="px-3">
                        <Checkbox
                          checked={selectedOrders.includes(order.id)}
                          onCheckedChange={(checked) => handleSelectOrder(order.id, !!checked)}
                          data-testid={`checkbox-cancel-${order.id}`}
                        />
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-3">
                        <Badge variant="destructive">{order.status === "회원취소" ? "회원취소" : "취소"}</Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-3" data-testid={`text-cancel-orderer-name-${order.id}`}>{order.ordererName || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap px-3" data-testid={`text-cancel-orderer-phone-${order.id}`}>{order.ordererPhone || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap px-3 max-w-[300px] truncate" title={order.ordererAddress || ""} data-testid={`text-cancel-orderer-address-${order.id}`}>
                        {order.ordererAddress || "-"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-3" data-testid={`text-cancel-recipient-name-${order.id}`}>{order.recipientName || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap px-3" data-testid={`text-cancel-recipient-mobile-${order.id}`}>{order.recipientMobile || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap px-3" data-testid={`text-cancel-recipient-phone-${order.id}`}>{order.recipientPhone || "-"}</TableCell>
                      <TableCell className="px-3 max-w-[400px] truncate" title={order.recipientAddress || ""} data-testid={`text-cancel-recipient-address-${order.id}`}>
                        {order.recipientAddress || "-"}
                      </TableCell>
                      <TableCell className="px-3 max-w-[200px] truncate" data-testid={`text-cancel-delivery-message-${order.id}`}>
                        {order.deliveryMessage
                          ? order.deliveryMessage.replace(/\s*\[주소확인필요:[^\]]*\]/g, "").trim() || "-"
                          : "-"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-3" data-testid={`text-cancel-product-name-${order.id}`}>{order.productName || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap px-3 text-center" data-testid={`text-cancel-quantity-${order.id}`}>1</TableCell>
                      <TableCell className="whitespace-nowrap px-3 font-mono text-sm" data-testid={`text-cancel-order-number-${order.id}`}>{order.customOrderNumber || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap px-3 font-mono text-sm" data-testid={`text-cancel-tracking-number-${order.id}`}>
                        {order.trackingNumber || "-"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-3" data-testid={`text-cancel-courier-${order.id}`}>{order.courierCompany || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {pageSize !== "all" && totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button
                size="sm"
                variant="outline"
                disabled={currentPage === 1}
                onClick={() => handlePageChange(currentPage - 1)}
                data-testid="button-cancel-prev"
              >
                <ChevronLeft className="h-4 w-4" />
                이전
              </Button>
              <span className="text-sm text-muted-foreground px-2">
                {currentPage} / {totalPages} 페이지
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={currentPage === totalPages}
                onClick={() => handlePageChange(currentPage + 1)}
                data-testid="button-cancel-next"
              >
                다음
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
