import { useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSSE } from "@/hooks/use-sse";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileDown, FileText, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { MemberOrderFilter, MemberOrderFilterState } from "@/components/member/MemberOrderFilter";
import { DateRangeFilter, useDateRange } from "@/components/common/DateRangeFilter";
import { useToast } from "@/hooks/use-toast";
import type { PendingOrder } from "@shared/schema";
import * as XLSX from "xlsx";

export default function MemberOrderInvoice() {
  useSSE();
  const { toast } = useToast();

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

  const readyToShipOrders = allOrders.filter(o => o.status === "배송준비중");

  const filteredOrders = useMemo(() => {
    if (!filters) return readyToShipOrders;

    return readyToShipOrders.filter(order => {
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
  }, [readyToShipOrders, filters]);

  const defaultOrders = useMemo(() =>
    filteredOrders.filter(o => (o.uploadFormat || "default") === "default"),
    [filteredOrders]
  );

  const postofficeOrders = useMemo(() =>
    filteredOrders.filter(o => o.uploadFormat === "postoffice"),
    [filteredOrders]
  );

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

  const getOrdersForDownload = useCallback((format: "default" | "postoffice") => {
    const formatOrders = format === "postoffice" ? postofficeOrders : defaultOrders;
    if (selectedOrders.length > 0) {
      return formatOrders.filter(o => selectedOrders.includes(o.id));
    }
    return formatOrders;
  }, [selectedOrders, defaultOrders, postofficeOrders]);

  const handleDownloadBasic = useCallback(() => {
    const orders = getOrdersForDownload("default");
    if (orders.length === 0) {
      if (selectedOrders.length > 0) {
        toast({ title: "선택한 주문 중 기본 양식 주문이 없습니다.", variant: "destructive" });
      }
      return;
    }

    setIsDownloading(true);
    try {
      const data = orders.map(order => ({
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
      XLSX.utils.book_append_sheet(wb, ws, "운송장-업로드-양식");
      const now = new Date();
      const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
      XLSX.writeFile(wb, `운송장_기본_${dateStr}.xlsx`);
    } finally {
      setIsDownloading(false);
    }
  }, [getOrdersForDownload, selectedOrders, toast]);

  const handleDownloadPostOffice = useCallback(() => {
    const orders = getOrdersForDownload("postoffice");
    if (orders.length === 0) {
      if (selectedOrders.length > 0) {
        toast({ title: "선택한 주문 중 우체국 양식 주문이 없습니다.", variant: "destructive" });
      }
      return;
    }

    setIsDownloading(true);
    try {
      const data = orders.map(order => ({
        "부피단위": order.volumeUnit || "",
        "주문자명": order.ordererName || "",
        "주문자 전화번호": order.ordererPhone || "",
        "주문자 우편번호": order.ordererZipCode || "",
        "주문자 주소": order.ordererAddress || "",
        "상품명": order.productName || "",
        "수취인명": order.recipientName || "",
        "수취인 전화번호": order.recipientMobile || "",
        "수취인 우편번호": order.recipientZipCode || "",
        "수취인 주소": order.recipientAddress || "",
        "배송메세지": order.deliveryMessage
          ? order.deliveryMessage.replace(/\s*\[주소확인필요:[^\]]*\]/g, "").trim()
          : "",
        "주문번호": order.customOrderNumber || "",
        "주문상세번호": order.orderDetailNumber || "",
        "상품코드": order.productCode || "",
        "수량": 1,
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "sheet1");
      const now = new Date();
      const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
      XLSX.writeFile(wb, `운송장_우체국_${dateStr}.xlsx`);
    } finally {
      setIsDownloading(false);
    }
  }, [getOrdersForDownload, selectedOrders, toast]);

  const getFormatBadge = (format: string | null | undefined) => {
    if (format === "postoffice") {
      return <Badge variant="outline" className="text-xs whitespace-nowrap">우체국</Badge>;
    }
    return <Badge variant="secondary" className="text-xs whitespace-nowrap">기본</Badge>;
  };

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">송장파일 다운로드</CardTitle>
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
                data-testid="select-invoice-page-size"
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
              <span className="text-muted-foreground">
                | 기본 {defaultOrders.length}건 / 우체국 {postofficeOrders.length}건
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={defaultOrders.length === 0 || isDownloading}
                onClick={handleDownloadBasic}
                data-testid="button-download-basic"
              >
                {isDownloading ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <FileDown className="h-4 w-4 mr-1" />
                )}
                기본 운송장 ({defaultOrders.length}건)
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={postofficeOrders.length === 0 || isDownloading}
                onClick={handleDownloadPostOffice}
                data-testid="button-download-postoffice"
              >
                {isDownloading ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <FileDown className="h-4 w-4 mr-1" />
                )}
                우체국 운송장 ({postofficeOrders.length}건)
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="border rounded-lg max-h-[600px] overflow-x-scroll">
              <div className="overflow-y-auto max-h-[583px] min-w-[1600px]">
              <Table className="w-full">
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-12">
                      <Checkbox
                        checked={displayedOrders.length > 0 && selectedOrders.length === displayedOrders.length}
                        onCheckedChange={(checked) => handleSelectAll(!!checked)}
                        data-testid="checkbox-invoice-all"
                      />
                    </TableHead>
                    <TableHead className="w-[70px]">양식</TableHead>
                    <TableHead className="w-[100px]">주문자명</TableHead>
                    <TableHead className="w-[140px]">주문자 전화번호</TableHead>
                    <TableHead className="min-w-[200px]">주문자 주소</TableHead>
                    <TableHead className="w-[100px]">수령자명</TableHead>
                    <TableHead className="w-[140px]">수령자휴대폰번호</TableHead>
                    <TableHead className="w-[140px]">수령자 전화번호</TableHead>
                    <TableHead className="min-w-[250px]">수령자 주소</TableHead>
                    <TableHead className="min-w-[150px]">배송메시지</TableHead>
                    <TableHead className="min-w-[200px]">상품명</TableHead>
                    <TableHead className="w-[80px]">수량</TableHead>
                    <TableHead className="w-[140px]">주문번호</TableHead>
                    <TableHead className="w-[140px]">운송장번호</TableHead>
                    <TableHead className="w-[100px]">택배사</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={15} className="text-center py-8 text-muted-foreground">
                        배송준비중 주문 내역이 없습니다.
                      </TableCell>
                    </TableRow>
                  ) : displayedOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedOrders.includes(order.id)}
                          onCheckedChange={(checked) => handleSelectOrder(order.id, !!checked)}
                          data-testid={`checkbox-invoice-${order.id}`}
                        />
                      </TableCell>
                      <TableCell data-testid={`text-format-${order.id}`}>
                        {getFormatBadge(order.uploadFormat)}
                      </TableCell>
                      <TableCell data-testid={`text-orderer-name-${order.id}`}>{order.ordererName || "-"}</TableCell>
                      <TableCell data-testid={`text-orderer-phone-${order.id}`}>{order.ordererPhone || "-"}</TableCell>
                      <TableCell className="max-w-[200px] truncate" title={order.ordererAddress || ""} data-testid={`text-orderer-address-${order.id}`}>
                        {order.ordererAddress || "-"}
                      </TableCell>
                      <TableCell data-testid={`text-recipient-name-${order.id}`}>{order.recipientName || "-"}</TableCell>
                      <TableCell data-testid={`text-recipient-mobile-${order.id}`}>{order.recipientMobile || "-"}</TableCell>
                      <TableCell data-testid={`text-recipient-phone-${order.id}`}>{order.recipientPhone || "-"}</TableCell>
                      <TableCell className="max-w-[250px] truncate" title={order.recipientAddress || ""} data-testid={`text-recipient-address-${order.id}`}>
                        {order.recipientAddress || "-"}
                      </TableCell>
                      <TableCell data-testid={`text-delivery-message-${order.id}`}>
                        {order.deliveryMessage
                          ? order.deliveryMessage.replace(/\s*\[주소확인필요:[^\]]*\]/g, "").trim() || "-"
                          : "-"}
                      </TableCell>
                      <TableCell data-testid={`text-product-name-${order.id}`}>{order.productName || "-"}</TableCell>
                      <TableCell data-testid={`text-quantity-${order.id}`}>1</TableCell>
                      <TableCell className="font-mono text-sm" data-testid={`text-order-number-${order.id}`}>{order.customOrderNumber || "-"}</TableCell>
                      <TableCell className="font-mono text-sm" data-testid={`text-tracking-number-${order.id}`}>
                        {order.trackingNumber || "-"}
                      </TableCell>
                      <TableCell data-testid={`text-courier-${order.id}`}>{order.courierCompany || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </div>
          )}

          {pageSize !== "all" && totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button
                size="sm"
                variant="outline"
                disabled={currentPage === 1}
                onClick={() => handlePageChange(currentPage - 1)}
                data-testid="button-invoice-prev"
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
                data-testid="button-invoice-next"
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
