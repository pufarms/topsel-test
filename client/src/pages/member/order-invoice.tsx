import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { FileDown, Search, FileText } from "lucide-react";
import { type Category } from "@shared/schema";

export default function MemberOrderInvoice() {
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const [categoryLargeFilter, setCategoryLargeFilter] = useState<string>("all");
  const [categoryMediumFilter, setCategoryMediumFilter] = useState<string>("all");
  const [pageSize, setPageSize] = useState<number | "all">(30);

  const largeCategories = categories.filter(c => c.level === "large");
  const mediumCategories = categories.filter(c => c.level === "medium");

  const filteredMediumCategories = categoryLargeFilter === "all"
    ? mediumCategories
    : mediumCategories.filter(c => c.parentId === categoryLargeFilter);

  const handleLargeFilterChange = (value: string) => {
    setCategoryLargeFilter(value);
    setCategoryMediumFilter("all");
  };

  const handleReset = () => {
    setCategoryLargeFilter("all");
    setCategoryMediumFilter("all");
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
          <div className="bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 rounded-lg p-4 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1">
                <Button size="sm" variant="outline" className="h-8" data-testid="button-invoice-today">오늘</Button>
                <Button size="sm" variant="outline" className="h-8" data-testid="button-invoice-week">1주일</Button>
                <Button size="sm" variant="outline" className="h-8" data-testid="button-invoice-month">1개월</Button>
              </div>
              <span className="text-sm text-muted-foreground">* 최대 1개월까지</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">조회 기간:</span>
                <input 
                  type="date" 
                  className="h-8 px-2 border rounded text-sm"
                  data-testid="input-invoice-date-start"
                />
                <span>~</span>
                <input 
                  type="date" 
                  className="h-8 px-2 border rounded text-sm"
                  data-testid="input-invoice-date-end"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium w-12">대분류</label>
                <select 
                  className="h-8 px-2 border rounded text-sm min-w-[160px]"
                  value={categoryLargeFilter}
                  onChange={(e) => handleLargeFilterChange(e.target.value)}
                  data-testid="select-invoice-category-large"
                >
                  <option value="all">-- 전체 대분류 --</option>
                  {largeCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">중분류</label>
                <select 
                  className="h-8 px-2 border rounded text-sm min-w-[160px]"
                  value={categoryMediumFilter}
                  onChange={(e) => setCategoryMediumFilter(e.target.value)}
                  data-testid="select-invoice-category-medium"
                >
                  <option value="all">-- 전체 중분류 --</option>
                  {filteredMediumCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="h-8 bg-sky-500 hover:bg-sky-600" data-testid="button-invoice-search">
                  <Search className="h-4 w-4 mr-1" />
                  조회
                </Button>
                <Button size="sm" variant="secondary" className="h-8" onClick={handleReset} data-testid="button-invoice-reset">
                  초기화
                </Button>
              </div>
            </div>
          </div>

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
