import { useState, useCallback, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { FileDown, XCircle, Upload, FileSpreadsheet, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { MemberOrderFilter, MemberOrderFilterState } from "@/components/member/MemberOrderFilter";
import { useToast } from "@/hooks/use-toast";
import type { PendingOrder } from "@shared/schema";
import * as XLSX from "xlsx";

export default function MemberOrderCancel() {
  useSSE();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [filters, setFilters] = useState<MemberOrderFilterState | null>(null);
  const [pageSize, setPageSize] = useState<number | "all">(30);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);

  const { data: allOrders = [], isLoading } = useQuery<PendingOrder[]>({
    queryKey: ["/api/member/pending-orders"],
  });

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

  const handleCancelRegister = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

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

      const requiredCols = ["수령자명", "주문번호"];
      const headers = Object.keys(rows[0]);
      const missing = requiredCols.filter(col => !headers.includes(col));
      if (missing.length > 0) {
        toast({ title: `필수 컬럼이 없습니다: ${missing.join(", ")}`, variant: "destructive" });
        return;
      }

      toast({
        title: `${rows.length}건의 취소 요청이 접수되었습니다.`,
        description: "관리자 확인 후 처리됩니다.",
      });
    } catch {
      toast({ title: "파일을 읽을 수 없습니다.", variant: "destructive" });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [toast]);

  return (
    <div className="space-y-4">
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
                variant="default"
                onClick={handleCancelRegister}
                data-testid="button-cancel-register"
              >
                <Upload className="h-4 w-4 mr-1" />
                취소건 등록
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleDownloadTemplate}
                data-testid="button-cancel-template"
              >
                <FileSpreadsheet className="h-4 w-4 mr-1" />
                양식 다운로드
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={filteredOrders.length === 0 || isDownloading}
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
            <div className="border rounded-lg overflow-x-auto overflow-y-auto max-h-[600px]">
              <Table className="w-max min-w-full">
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-12">
                      <Checkbox
                        checked={displayedOrders.length > 0 && selectedOrders.length === displayedOrders.length}
                        onCheckedChange={(checked) => handleSelectAll(!!checked)}
                        data-testid="checkbox-cancel-all"
                      />
                    </TableHead>
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
                      <TableCell colSpan={14} className="text-center py-8 text-muted-foreground">
                        취소 등록된 주문이 없습니다.
                      </TableCell>
                    </TableRow>
                  ) : displayedOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedOrders.includes(order.id)}
                          onCheckedChange={(checked) => handleSelectOrder(order.id, !!checked)}
                          data-testid={`checkbox-cancel-${order.id}`}
                        />
                      </TableCell>
                      <TableCell data-testid={`text-cancel-orderer-name-${order.id}`}>{order.ordererName || "-"}</TableCell>
                      <TableCell data-testid={`text-cancel-orderer-phone-${order.id}`}>{order.ordererPhone || "-"}</TableCell>
                      <TableCell className="max-w-[200px] truncate" title={order.ordererAddress || ""} data-testid={`text-cancel-orderer-address-${order.id}`}>
                        {order.ordererAddress || "-"}
                      </TableCell>
                      <TableCell data-testid={`text-cancel-recipient-name-${order.id}`}>{order.recipientName || "-"}</TableCell>
                      <TableCell data-testid={`text-cancel-recipient-mobile-${order.id}`}>{order.recipientMobile || "-"}</TableCell>
                      <TableCell data-testid={`text-cancel-recipient-phone-${order.id}`}>{order.recipientPhone || "-"}</TableCell>
                      <TableCell className="max-w-[250px] truncate" title={order.recipientAddress || ""} data-testid={`text-cancel-recipient-address-${order.id}`}>
                        {order.recipientAddress || "-"}
                      </TableCell>
                      <TableCell data-testid={`text-cancel-delivery-message-${order.id}`}>
                        {order.deliveryMessage
                          ? order.deliveryMessage.replace(/\s*\[주소확인필요:[^\]]*\]/g, "").trim() || "-"
                          : "-"}
                      </TableCell>
                      <TableCell data-testid={`text-cancel-product-name-${order.id}`}>{order.productName || "-"}</TableCell>
                      <TableCell data-testid={`text-cancel-quantity-${order.id}`}>1</TableCell>
                      <TableCell className="font-mono text-sm" data-testid={`text-cancel-order-number-${order.id}`}>{order.customOrderNumber || "-"}</TableCell>
                      <TableCell className="font-mono text-sm" data-testid={`text-cancel-tracking-number-${order.id}`}>
                        {order.trackingNumber || "-"}
                      </TableCell>
                      <TableCell data-testid={`text-cancel-courier-${order.id}`}>{order.courierCompany || "-"}</TableCell>
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
