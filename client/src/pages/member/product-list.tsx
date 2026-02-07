import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { FileDown, Package, Loader2, ChevronLeft, ChevronRight, Search, AlertCircle } from "lucide-react";
import { MemberOrderFilter, type MemberOrderFilterState } from "@/components/member/MemberOrderFilter";
import { useAuth } from "@/lib/auth";
import type { Category } from "@shared/schema";

interface MemberProduct {
  productCode: string;
  productName: string;
  categoryLarge: string | null;
  categoryMedium: string | null;
  categorySmall: string | null;
  weight: string;
  supplyPrice: number;
  supplyStatus?: string;
}

const memberGradeLabels: Record<string, string> = {
  PENDING: "승인대기",
  ASSOCIATE: "준회원",
  START: "스타트",
  DRIVING: "드라이빙",
  TOP: "탑셀러",
};

export default function MemberProductList() {
  const { user } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<"current" | "next-week">("current");
  const [tablePageSize, setTablePageSize] = useState<number | "all">(30);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryLargeFilter, setCategoryLargeFilter] = useState("all");
  const [categoryMediumFilter, setCategoryMediumFilter] = useState("all");
  const [categorySmallFilter, setCategorySmallFilter] = useState("all");

  const { data: memberProfile } = useQuery<{ grade: string } | null>({
    queryKey: ["/api/member/profile"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!user,
  });

  const { data: currentProducts = [], isLoading: currentLoading } = useQuery<MemberProduct[]>({
    queryKey: ["/api/member/product-list/current"],
    enabled: !!user && memberProfile?.grade !== 'PENDING',
  });

  const { data: nextWeekProducts = [], isLoading: nextWeekLoading } = useQuery<MemberProduct[]>({
    queryKey: ["/api/member/product-list/next-week"],
    enabled: !!user && memberProfile?.grade !== 'PENDING',
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const isPending = memberProfile?.grade === 'PENDING';

  const applyFilters = useCallback((products: MemberProduct[]) => {
    let result = [...products];

    if (categoryLargeFilter && categoryLargeFilter !== "all") {
      const cat = categories.find(c => c.id === categoryLargeFilter);
      if (cat) result = result.filter(p => p.categoryLarge === cat.name);
    }
    if (categoryMediumFilter && categoryMediumFilter !== "all") {
      const cat = categories.find(c => c.id === categoryMediumFilter);
      if (cat) result = result.filter(p => p.categoryMedium === cat.name);
    }
    if (categorySmallFilter && categorySmallFilter !== "all") {
      const cat = categories.find(c => c.id === categorySmallFilter);
      if (cat) result = result.filter(p => p.categorySmall === cat.name);
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(p =>
        p.productCode.toLowerCase().includes(term) ||
        p.productName.toLowerCase().includes(term)
      );
    }

    return result;
  }, [categoryLargeFilter, categoryMediumFilter, categorySmallFilter, searchTerm, categories]);

  const products = activeSubTab === "current" ? currentProducts : nextWeekProducts;
  const isLoading = activeSubTab === "current" ? currentLoading : nextWeekLoading;
  const filteredProducts = applyFilters(products);

  const totalPages = tablePageSize === "all"
    ? 1
    : Math.ceil(filteredProducts.length / tablePageSize);

  const displayedProducts = tablePageSize === "all"
    ? filteredProducts
    : filteredProducts.slice(
        (currentPage - 1) * (tablePageSize as number),
        currentPage * (tablePageSize as number)
      );

  const handleExcelDownload = async () => {
    const XLSX = await import("xlsx");
    const data = filteredProducts.map(p => ({
      '상품코드': p.productCode,
      '상품명': p.productName,
      '대분류': p.categoryLarge || '',
      '중분류': p.categoryMedium || '',
      '소분류': p.categorySmall || '',
      '중량': p.weight,
      '공급가': p.supplyPrice,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [
      { wch: 15 },
      { wch: 30 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 10 },
      { wch: 12 },
    ];
    const wb = XLSX.utils.book_new();
    const sheetName = activeSubTab === "current" ? "현재공급가" : "차주예상공급가";
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    const fileName = activeSubTab === "current"
      ? `현재공급가_${new Date().toISOString().slice(0, 10)}.xlsx`
      : `차주예상공급가_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  if (isPending) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-6 w-6 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-lg font-bold text-amber-700 dark:text-amber-400 mb-2">접근 불가</h3>
              <p className="text-sm text-muted-foreground">
                승인대기 회원은 상품리스트를 조회할 수 없습니다. 승인 완료 후 이용 가능합니다.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-foreground" />
              <CardTitle className="text-base">상품리스트</CardTitle>
              {memberProfile && (
                <Badge variant="secondary" className="text-xs">
                  {memberGradeLabels[memberProfile.grade] || memberProfile.grade} 등급 공급가
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={activeSubTab} onValueChange={(v) => { setActiveSubTab(v as "current" | "next-week"); setCurrentPage(1); }}>
            <TabsList className="grid w-full grid-cols-2" data-testid="tabs-product-type">
              <TabsTrigger value="current" data-testid="tab-current-products">현재공급가</TabsTrigger>
              <TabsTrigger value="next-week" data-testid="tab-next-week-products">차주예상공급가</TabsTrigger>
            </TabsList>
          </Tabs>

          <MemberOrderFilter
            onFilterChange={(filters) => {
              setCategoryLargeFilter(filters.categoryLarge);
              setCategoryMediumFilter(filters.categoryMedium);
              setCategorySmallFilter(filters.categorySmall);
              setSearchTerm(filters.searchTerm);
              setCurrentPage(1);
            }}
            showSearchField={true}
            searchOptions={[
              { value: "productCode", label: "상품코드" },
              { value: "productName", label: "상품명" },
            ]}
          />

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleExcelDownload}
                disabled={filteredProducts.length === 0}
                data-testid="button-download-product-list"
              >
                <FileDown className="h-4 w-4 mr-1" />
                엑셀 다운로드
              </Button>
              <Badge variant="secondary" className="text-xs">
                총 {filteredProducts.length}개 상품
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">표시:</span>
              <Select
                value={String(tablePageSize)}
                onValueChange={(v) => { setTablePageSize(v === "all" ? "all" : Number(v)); setCurrentPage(1); }}
              >
                <SelectTrigger className="w-[100px]" data-testid="select-page-size">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10개씩</SelectItem>
                  <SelectItem value="30">30개씩</SelectItem>
                  <SelectItem value="100">100개씩</SelectItem>
                  <SelectItem value="all">전체</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="border rounded-lg overflow-x-auto overflow-y-auto max-h-[600px]">
            <Table className="min-w-[900px]">
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold whitespace-nowrap w-[50px]">No.</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">상품코드</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">상품명</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">대분류</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">중분류</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">소분류</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">중량</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap text-right">공급가</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : displayedProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                      {searchTerm ? "검색 결과가 없습니다" : "등록된 상품이 없습니다"}
                    </TableCell>
                  </TableRow>
                ) : (
                  displayedProducts.map((product, index) => {
                    const rowNum = tablePageSize === "all"
                      ? index + 1
                      : (currentPage - 1) * (tablePageSize as number) + index + 1;
                    return (
                      <TableRow key={product.productCode} data-testid={`row-product-${product.productCode}`}>
                        <TableCell className="text-sm text-muted-foreground">{rowNum}</TableCell>
                        <TableCell className="text-sm font-mono">{product.productCode}</TableCell>
                        <TableCell className="text-sm">{product.productName}</TableCell>
                        <TableCell className="text-sm">{product.categoryLarge || "-"}</TableCell>
                        <TableCell className="text-sm">{product.categoryMedium || "-"}</TableCell>
                        <TableCell className="text-sm">{product.categorySmall || "-"}</TableCell>
                        <TableCell className="text-sm">{product.weight}</TableCell>
                        <TableCell className="text-sm text-right font-medium">
                          {product.supplyPrice?.toLocaleString("ko-KR")}원
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {tablePageSize !== "all" && totalPages > 1 && (
            <div className="flex justify-center items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                data-testid="button-prev-page"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                이전
              </Button>
              <span className="text-sm text-muted-foreground">
                {currentPage} / {totalPages} 페이지
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                data-testid="button-next-page"
              >
                다음
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
