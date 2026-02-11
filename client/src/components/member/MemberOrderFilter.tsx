import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { type Category } from "@shared/schema";

export interface MemberOrderFilterState {
  categoryLarge: string;
  categoryMedium: string;
  categorySmall: string;
  dateStart: string;
  dateEnd: string;
  searchType: string;
  searchTerm: string;
}

interface MemberOrderFilterProps {
  onFilterChange?: (filters: MemberOrderFilterState) => void;
  showSearchField?: boolean;
  searchOptions?: { value: string; label: string }[];
}

export function MemberOrderFilter({ 
  onFilterChange, 
  showSearchField = false,
  searchOptions = [
    { value: "orderId", label: "주문번호" },
    { value: "productName", label: "상품명" },
    { value: "recipientName", label: "수령자명" },
  ]
}: MemberOrderFilterProps) {
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const [categoryLargeFilter, setCategoryLargeFilter] = useState<string>("all");
  const [categoryMediumFilter, setCategoryMediumFilter] = useState<string>("all");
  const [categorySmallFilter, setCategorySmallFilter] = useState<string>("all");
  const [dateStart, setDateStart] = useState<string>("");
  const [dateEnd, setDateEnd] = useState<string>("");
  const [searchType, setSearchType] = useState<string>(searchOptions[0]?.value || "");
  const [searchTerm, setSearchTerm] = useState<string>("");

  const largeCategories = categories.filter(c => c.level === "large");
  const mediumCategories = categories.filter(c => c.level === "medium");
  const smallCategories = categories.filter(c => c.level === "small");

  const filteredMediumCategories = categoryLargeFilter === "all"
    ? mediumCategories
    : mediumCategories.filter(c => c.parentId === categoryLargeFilter);

  const filteredSmallCategories = categoryMediumFilter === "all"
    ? smallCategories
    : smallCategories.filter(c => c.parentId === categoryMediumFilter);

  const handleLargeFilterChange = (value: string) => {
    setCategoryLargeFilter(value);
    setCategoryMediumFilter("all");
    setCategorySmallFilter("all");
  };

  const handleMediumFilterChange = (value: string) => {
    setCategoryMediumFilter(value);
    setCategorySmallFilter("all");
  };

  const handleReset = () => {
    setCategoryLargeFilter("all");
    setCategoryMediumFilter("all");
    setCategorySmallFilter("all");
    setDateStart("");
    setDateEnd("");
    setSearchType(searchOptions[0]?.value || "");
    setSearchTerm("");
    onFilterChange?.({
      categoryLarge: "all",
      categoryMedium: "all",
      categorySmall: "all",
      dateStart: "",
      dateEnd: "",
      searchType: searchOptions[0]?.value || "",
      searchTerm: "",
    });
  };

  const handleSearch = () => {
    onFilterChange?.({
      categoryLarge: categoryLargeFilter,
      categoryMedium: categoryMediumFilter,
      categorySmall: categorySmallFilter,
      dateStart,
      dateEnd,
      searchType,
      searchTerm,
    });
  };

  const setDateRange = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    setDateStart(start.toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }));
    setDateEnd(end.toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }));
  };

  return (
    <div className="bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 rounded-lg p-4 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" className="h-8" onClick={() => setDateRange(0)} data-testid="button-filter-today">오늘</Button>
          <Button size="sm" variant="outline" className="h-8" onClick={() => setDateRange(7)} data-testid="button-filter-week">1주일</Button>
          <Button size="sm" variant="outline" className="h-8" onClick={() => setDateRange(30)} data-testid="button-filter-month">1개월</Button>
        </div>
        <span className="text-sm text-muted-foreground">* 최대 1개월까지</span>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">조회 기간:</span>
          <input 
            type="date" 
            className="h-8 px-2 border rounded text-sm"
            value={dateStart}
            onChange={(e) => setDateStart(e.target.value)}
            data-testid="input-filter-date-start"
          />
          <span>~</span>
          <input 
            type="date" 
            className="h-8 px-2 border rounded text-sm"
            value={dateEnd}
            onChange={(e) => setDateEnd(e.target.value)}
            data-testid="input-filter-date-end"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium w-12">대분류</label>
          <select 
            className="h-8 px-2 border rounded text-sm min-w-[140px]"
            value={categoryLargeFilter}
            onChange={(e) => handleLargeFilterChange(e.target.value)}
            data-testid="select-filter-category-large"
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
            className="h-8 px-2 border rounded text-sm min-w-[140px]"
            value={categoryMediumFilter}
            onChange={(e) => handleMediumFilterChange(e.target.value)}
            data-testid="select-filter-category-medium"
          >
            <option value="all">-- 전체 중분류 --</option>
            {filteredMediumCategories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">소분류</label>
          <select 
            className="h-8 px-2 border rounded text-sm min-w-[140px]"
            value={categorySmallFilter}
            onChange={(e) => setCategorySmallFilter(e.target.value)}
            data-testid="select-filter-category-small"
          >
            <option value="all">-- 전체 소분류 --</option>
            {filteredSmallCategories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>
      </div>

      {showSearchField && (
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">검색어</label>
            <select 
              className="h-8 px-2 border rounded text-sm min-w-[120px]"
              value={searchType}
              onChange={(e) => setSearchType(e.target.value)}
              data-testid="select-filter-search-type"
            >
              {searchOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <input 
              type="text" 
              className="h-8 px-2 border rounded text-sm min-w-[200px]"
              placeholder="검색어를 입력하세요"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              data-testid="input-filter-search"
            />
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Button size="sm" className="h-8 bg-sky-500 hover:bg-sky-600" onClick={handleSearch} data-testid="button-filter-search">
          <Search className="h-4 w-4 mr-1" />
          조회
        </Button>
        <Button size="sm" variant="secondary" className="h-8" onClick={handleReset} data-testid="button-filter-reset">
          초기화
        </Button>
      </div>
    </div>
  );
}
