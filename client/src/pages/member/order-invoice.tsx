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
import { FileDown, FileText } from "lucide-react";
import { MemberOrderFilter, MemberOrderFilterState } from "@/components/member/MemberOrderFilter";

export default function MemberOrderInvoice() {
  const [filters, setFilters] = useState<MemberOrderFilterState | null>(null);
  const [pageSize, setPageSize] = useState<number | "all">(30);

  const handleFilterChange = (newFilters: MemberOrderFilterState) => {
    setFilters(newFilters);
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
          <MemberOrderFilter onFilterChange={handleFilterChange} />

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm">
              <span>표시 개수:</span>
              <select 
                className="h-8 px-2 border rounded text-sm"
                value={pageSize === "all" ? "all" : pageSize}
                onChange={(e) => setPageSize(e.target.value === "all" ? "all" : Number(e.target.value))}
                data-testid="select-invoice-page-size"
              >
                <option value={10}>10개씩</option>
                <option value={30}>30개씩</option>
                <option value={100}>100개씩</option>
                <option value="all">전체</option>
              </select>
              <span className="text-muted-foreground">총 0건</span>
            </div>
            <Button size="sm" variant="outline" data-testid="button-invoice-download">
              <FileDown className="h-4 w-4 mr-1" />
              송장파일 다운로드
            </Button>
          </div>

          <div className="border rounded-lg overflow-x-auto overflow-y-auto max-h-[600px]">
            <Table className="w-max min-w-full">
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold whitespace-nowrap w-[50px]">
                    <input type="checkbox" className="w-4 h-4" data-testid="checkbox-invoice-all" />
                  </TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">No</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">생성일시</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">파일명</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">주문건수</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">택배사</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">파일크기</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">상태</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">다운로드</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    다운로드 가능한 송장파일이 없습니다.
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-center gap-2">
            <Button size="sm" variant="outline" disabled data-testid="button-invoice-prev">이전</Button>
            <Button size="sm" variant="outline" disabled data-testid="button-invoice-next">다음</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
