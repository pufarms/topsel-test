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
import { FileDown, ClipboardList, AlertCircle } from "lucide-react";
import { MemberOrderFilter, MemberOrderFilterState } from "@/components/member/MemberOrderFilter";

interface MemberOrderAdjustProps {
  canOrder?: boolean;
}

export default function MemberOrderAdjust({ canOrder = true }: MemberOrderAdjustProps) {
  const [filters, setFilters] = useState<MemberOrderFilterState | null>(null);
  const [pageSize, setPageSize] = useState<number | "all">(30);

  const handleFilterChange = (newFilters: MemberOrderFilterState) => {
    setFilters(newFilters);
  };

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
                  스타트(START) 등급 이상 회원만 엑셀 다운로드가 가능합니다.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      <Card className="overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">주문조정건 확인</CardTitle>
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
                onChange={(e) => setPageSize(e.target.value === "all" ? "all" : Number(e.target.value))}
                data-testid="select-adjust-page-size"
              >
                <option value={10}>10개씩</option>
                <option value={30}>30개씩</option>
                <option value={100}>100개씩</option>
                <option value="all">전체</option>
              </select>
              <span className="text-muted-foreground">총 0건</span>
            </div>
            <Button size="sm" variant="outline" disabled={!canOrder} data-testid="button-adjust-download">
              <FileDown className="h-4 w-4 mr-1" />
              엑셀 다운로드
            </Button>
          </div>

          <div className="border rounded-lg table-scroll-container">
            <Table className="min-w-[1600px]">
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold whitespace-nowrap w-[50px]">
                    <input type="checkbox" className="w-4 h-4" data-testid="checkbox-adjust-all" />
                  </TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">No</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">조정일시</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">주문번호</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">대분류</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">중분류</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">소분류</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">상품코드</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">상품명</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">조정사유</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">조정전 수량</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">조정후 수량</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">조정전 금액</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">조정후 금액</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">확인상태</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell colSpan={15} className="text-center py-8 text-muted-foreground">
                    조정된 주문이 없습니다.
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-center gap-2">
            <Button size="sm" variant="outline" disabled data-testid="button-adjust-prev">이전</Button>
            <Button size="sm" variant="outline" disabled data-testid="button-adjust-next">다음</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
