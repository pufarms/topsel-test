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
import { FileDown, Search, XCircle, Plus } from "lucide-react";
import { type Category } from "@shared/schema";

export default function MemberOrderCancel() {
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">취소건 등록</CardTitle>
            </div>
            <Button size="sm" data-testid="button-cancel-new">
              <Plus className="h-4 w-4 mr-1" />
              취소 등록
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 overflow-hidden">
          <div className="bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 rounded-lg p-4 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1">
                <Button size="sm" variant="outline" className="h-8" data-testid="button-cancel-today">오늘</Button>
                <Button size="sm" variant="outline" className="h-8" data-testid="button-cancel-week">1주일</Button>
                <Button size="sm" variant="outline" className="h-8" data-testid="button-cancel-month">1개월</Button>
              </div>
              <span className="text-sm text-muted-foreground">* 최대 1개월까지</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">조회 기간:</span>
                <input 
                  type="date" 
                  className="h-8 px-2 border rounded text-sm"
                  data-testid="input-cancel-date-start"
                />
                <span>~</span>
                <input 
                  type="date" 
                  className="h-8 px-2 border rounded text-sm"
                  data-testid="input-cancel-date-end"
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
                  data-testid="select-cancel-category-large"
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
                  data-testid="select-cancel-category-medium"
                >
                  <option value="all">-- 전체 중분류 --</option>
                  {filteredMediumCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="h-8 bg-sky-500 hover:bg-sky-600" data-testid="button-cancel-search">
                  <Search className="h-4 w-4 mr-1" />
                  조회
                </Button>
                <Button size="sm" variant="secondary" className="h-8" onClick={handleReset} data-testid="button-cancel-reset">
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
                data-testid="select-cancel-page-size"
              >
                <option value={10}>10개씩</option>
                <option value={30}>30개씩</option>
                <option value={100}>100개씩</option>
                <option value="all">전체</option>
              </select>
              <span className="text-muted-foreground">총 0건</span>
            </div>
            <Button size="sm" variant="outline" data-testid="button-cancel-download">
              <FileDown className="h-4 w-4 mr-1" />
              엑셀 다운로드
            </Button>
          </div>

          <div className="border rounded-lg overflow-x-auto overflow-y-auto max-h-[600px]">
            <Table className="w-max min-w-full">
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold whitespace-nowrap w-[50px]">
                    <input type="checkbox" className="w-4 h-4" data-testid="checkbox-cancel-all" />
                  </TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">No</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">취소요청일</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">주문번호</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">대분류</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">중분류</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">상품코드</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">상품명</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">수량</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">금액</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">취소사유</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">처리상태</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">처리일시</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell colSpan={13} className="text-center py-8 text-muted-foreground">
                    취소 요청된 주문이 없습니다.
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-center gap-2">
            <Button size="sm" variant="outline" disabled data-testid="button-cancel-prev">이전</Button>
            <Button size="sm" variant="outline" disabled data-testid="button-cancel-next">다음</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
