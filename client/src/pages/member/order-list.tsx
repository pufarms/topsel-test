import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileDown, ClipboardList } from "lucide-react";
import { MemberOrderFilter, MemberOrderFilterState } from "@/components/member/MemberOrderFilter";

export default function MemberOrderList() {
  const [filters, setFilters] = useState<MemberOrderFilterState | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [pageSize, setPageSize] = useState<number | "all">(30);

  const handleFilterChange = (newFilters: MemberOrderFilterState) => {
    setFilters(newFilters);
  };

  const orderStatuses = [
    { value: "all", label: "전체" },
    { value: "pending", label: "주문대기" },
    { value: "preparing", label: "상품준비중" },
    { value: "ready", label: "배송준비완료" },
    { value: "shipping", label: "배송중" },
    { value: "completed", label: "배송완료" },
    { value: "cancelled", label: "취소" },
  ];

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">주문건 조회</CardTitle>
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

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">주문상태</label>
              <select 
                className="h-8 px-2 border rounded text-sm min-w-[120px]"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                data-testid="select-list-status"
              >
                {orderStatuses.map((status) => (
                  <option key={status.value} value={status.value}>{status.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm">
              <span>표시 개수:</span>
              <select 
                className="h-8 px-2 border rounded text-sm"
                value={pageSize === "all" ? "all" : pageSize}
                onChange={(e) => setPageSize(e.target.value === "all" ? "all" : Number(e.target.value))}
                data-testid="select-list-page-size"
              >
                <option value={10}>10개씩</option>
                <option value={30}>30개씩</option>
                <option value={100}>100개씩</option>
                <option value="all">전체</option>
              </select>
              <span className="text-muted-foreground">총 0건</span>
            </div>
            <Button size="sm" variant="outline" data-testid="button-list-download">
              <FileDown className="h-4 w-4 mr-1" />
              엑셀 다운로드
            </Button>
          </div>

          <div className="border rounded-lg overflow-x-auto overflow-y-auto max-h-[600px]">
            <Table className="w-max min-w-full">
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold whitespace-nowrap">No</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">주문일시</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">주문번호</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">대분류</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">중분류</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">소분류</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">상품코드</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">상품명</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">수량</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">공급가</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">합계</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">수령자</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">연락처</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">배송지</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">주문상태</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">송장번호</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell colSpan={16} className="text-center py-8 text-muted-foreground">
                    조회된 주문이 없습니다.
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-center gap-2">
            <Button size="sm" variant="outline" disabled data-testid="button-list-prev">이전</Button>
            <Button size="sm" variant="outline" disabled data-testid="button-list-next">다음</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
