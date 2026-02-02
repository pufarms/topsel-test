import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import type { Category } from "@shared/schema";

interface CategoryFilterProps {
  onFilterChange: (filters: CategoryFilterState) => void;
  searchPlaceholder?: string;
  showSearchFilter?: boolean;
  searchFilterOptions?: string[];
}

export interface CategoryFilterState {
  categoryLarge: string;
  categoryMedium: string;
  categorySmall: string;
  searchFilter: string;
  searchTerm: string;
}

export function CategoryFilter({
  onFilterChange,
  searchPlaceholder = "검색어 입력",
  showSearchFilter = true,
  searchFilterOptions = ["선택 없음", "주문자명", "수령자명", "상품명", "상품코드"],
}: CategoryFilterProps) {
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const [categoryLargeFilter, setCategoryLargeFilter] = useState<string>("all");
  const [categoryMediumFilter, setCategoryMediumFilter] = useState<string>("all");
  const [categorySmallFilter, setCategorySmallFilter] = useState<string>("all");
  const [searchFilter, setSearchFilter] = useState<string>("선택 없음");
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

  const getCategoryNameById = (id: string) => categories.find(c => c.id === id)?.name || "";

  useEffect(() => {
    onFilterChange({
      categoryLarge: categoryLargeFilter === "all" ? "" : getCategoryNameById(categoryLargeFilter),
      categoryMedium: categoryMediumFilter === "all" ? "" : getCategoryNameById(categoryMediumFilter),
      categorySmall: categorySmallFilter === "all" ? "" : getCategoryNameById(categorySmallFilter),
      searchFilter,
      searchTerm,
    });
  }, [categoryLargeFilter, categoryMediumFilter, categorySmallFilter, searchFilter, searchTerm, categories]);

  const handleReset = () => {
    setCategoryLargeFilter("all");
    setCategoryMediumFilter("all");
    setCategorySmallFilter("all");
    setSearchFilter("선택 없음");
    setSearchTerm("");
  };

  return (
    <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium w-12 shrink-0">대분류</label>
          <select
            className="h-9 px-3 border rounded-md text-sm min-w-[140px] bg-background"
            value={categoryLargeFilter}
            onChange={(e) => {
              setCategoryLargeFilter(e.target.value);
              setCategoryMediumFilter("all");
              setCategorySmallFilter("all");
            }}
            data-testid="select-filter-category-large"
          >
            <option value="all">-- 전체 대분류 --</option>
            {largeCategories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium shrink-0">중분류</label>
          <select
            className="h-9 px-3 border rounded-md text-sm min-w-[140px] bg-background"
            value={categoryMediumFilter}
            onChange={(e) => {
              setCategoryMediumFilter(e.target.value);
              setCategorySmallFilter("all");
            }}
            data-testid="select-filter-category-medium"
          >
            <option value="all">-- 전체 중분류 --</option>
            {filteredMediumCategories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium shrink-0">소분류</label>
          <select
            className="h-9 px-3 border rounded-md text-sm min-w-[140px] bg-background"
            value={categorySmallFilter}
            onChange={(e) => setCategorySmallFilter(e.target.value)}
            data-testid="select-filter-category-small"
          >
            <option value="all">-- 전체 소분류 --</option>
            {filteredSmallCategories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>
      </div>

      {showSearchFilter && (
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium w-12 shrink-0">검색</label>
            <select
              className="h-9 px-3 border rounded-md text-sm min-w-[120px] bg-background"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              data-testid="select-search-filter"
            >
              {searchFilterOptions.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9"
                data-testid="input-search-term"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="h-9 bg-sky-500 hover:bg-sky-600"
              data-testid="button-filter-search"
            >
              조회
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="h-9"
              onClick={handleReset}
              data-testid="button-filter-reset"
            >
              초기화
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function useCategoryFilter<T>(
  data: T[],
  filters: CategoryFilterState,
  getItemFields: (item: T) => {
    categoryLarge?: string;
    categoryMedium?: string;
    categorySmall?: string;
    ordererName?: string;
    recipientName?: string;
    productName?: string;
    productCode?: string;
  }
): T[] {
  return data.filter(item => {
    const fields = getItemFields(item);

    if (filters.categoryLarge && fields.categoryLarge !== filters.categoryLarge) return false;
    if (filters.categoryMedium && fields.categoryMedium !== filters.categoryMedium) return false;
    if (filters.categorySmall && fields.categorySmall !== filters.categorySmall) return false;

    if (filters.searchFilter !== "선택 없음" && filters.searchTerm.trim()) {
      const term = filters.searchTerm.toLowerCase();
      switch (filters.searchFilter) {
        case "주문자명":
          if (!fields.ordererName?.toLowerCase().includes(term)) return false;
          break;
        case "수령자명":
          if (!fields.recipientName?.toLowerCase().includes(term)) return false;
          break;
        case "상품명":
          if (!fields.productName?.toLowerCase().includes(term)) return false;
          break;
        case "상품코드":
          if (!fields.productCode?.toLowerCase().includes(term)) return false;
          break;
      }
    }

    return true;
  });
}

export default CategoryFilter;
