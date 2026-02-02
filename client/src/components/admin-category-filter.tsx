import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";
import type { Category } from "@shared/schema";

interface Member {
  id: string;
  memberId: string;
  companyName: string;
  ceoName?: string;
}

export interface AdminCategoryFilterState {
  memberId: string;
  categoryLarge: string;
  categoryMedium: string;
  categorySmall: string;
  searchFilter: string;
  searchTerm: string;
}

interface AdminCategoryFilterProps {
  onFilterChange: (filters: AdminCategoryFilterState) => void;
  searchPlaceholder?: string;
  searchOptions?: { value: string; label: string }[];
  showMemberFilter?: boolean;
  additionalFilters?: React.ReactNode;
}

const defaultSearchOptions = [
  { value: "선택 없음", label: "선택 없음" },
  { value: "주문자명", label: "주문자명" },
  { value: "수령자명", label: "수령자명" },
  { value: "상품명", label: "상품명" },
  { value: "상품코드", label: "상품코드" },
];

export function AdminCategoryFilter({
  onFilterChange,
  searchPlaceholder = "검색어를 입력하세요",
  searchOptions = defaultSearchOptions,
  showMemberFilter = true,
  additionalFilters,
}: AdminCategoryFilterProps) {
  const [memberId, setMemberId] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const [categoryLarge, setCategoryLarge] = useState("");
  const [categoryMedium, setCategoryMedium] = useState("");
  const [categorySmall, setCategorySmall] = useState("");
  const [searchFilter, setSearchFilter] = useState("선택 없음");
  const [searchTerm, setSearchTerm] = useState("");

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: members = [] } = useQuery<Member[]>({
    queryKey: ["/api/admin/members"],
    enabled: showMemberFilter,
  });

  const largeCategories = useMemo(() => 
    categories.filter(c => c.level === "large"), 
    [categories]
  );

  const mediumCategories = useMemo(() => {
    if (!categoryLarge) return categories.filter(c => c.level === "medium");
    const parent = categories.find(c => c.id === categoryLarge);
    return categories.filter(c => c.level === "medium" && c.parentId === parent?.id);
  }, [categories, categoryLarge]);

  const smallCategories = useMemo(() => {
    if (!categoryMedium) return categories.filter(c => c.level === "small");
    const parent = categories.find(c => c.id === categoryMedium);
    return categories.filter(c => c.level === "small" && c.parentId === parent?.id);
  }, [categories, categoryMedium]);

  const filteredMembers = useMemo(() => {
    if (!memberSearch.trim()) return members;
    const search = memberSearch.toLowerCase();
    return members.filter(m => 
      m.companyName?.toLowerCase().includes(search) ||
      m.memberId?.toLowerCase().includes(search) ||
      m.ceoName?.toLowerCase().includes(search)
    );
  }, [members, memberSearch]);

  const selectedMember = useMemo(() => 
    members.find(m => m.id === memberId),
    [members, memberId]
  );

  const getCategoryNameById = useCallback((id: string) => {
    const cat = categories.find(c => c.id === id);
    return cat?.name || "";
  }, [categories]);

  useEffect(() => {
    onFilterChange({
      memberId,
      categoryLarge: getCategoryNameById(categoryLarge),
      categoryMedium: getCategoryNameById(categoryMedium),
      categorySmall: getCategoryNameById(categorySmall),
      searchFilter,
      searchTerm,
    });
  }, [memberId, categoryLarge, categoryMedium, categorySmall, searchFilter, searchTerm, getCategoryNameById, onFilterChange]);

  const handleReset = () => {
    setMemberId("");
    setMemberSearch("");
    setCategoryLarge("");
    setCategoryMedium("");
    setCategorySmall("");
    setSearchFilter("선택 없음");
    setSearchTerm("");
  };

  const handleCategoryLargeChange = (value: string) => {
    setCategoryLarge(value === "all" ? "" : value);
    setCategoryMedium("");
    setCategorySmall("");
  };

  const handleCategoryMediumChange = (value: string) => {
    setCategoryMedium(value === "all" ? "" : value);
    setCategorySmall("");
  };

  const handleMemberSelect = (member: Member) => {
    setMemberId(member.id);
    setMemberSearch(member.companyName);
    setShowMemberDropdown(false);
  };

  return (
    <div className="space-y-3">
      {/* 1행: 회원 필터 (관리자 전용) */}
      {showMemberFilter && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium whitespace-nowrap min-w-[50px]">회원</label>
            <div className="relative">
              <div className="flex items-center gap-1">
                <Input
                  placeholder="상호명 검색"
                  value={memberSearch}
                  onChange={(e) => {
                    setMemberSearch(e.target.value);
                    setShowMemberDropdown(true);
                    if (!e.target.value) setMemberId("");
                  }}
                  onFocus={() => setShowMemberDropdown(true)}
                  className="h-8 w-[180px] text-sm"
                  data-testid="input-member-search"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setShowMemberDropdown(!showMemberDropdown)}
                >
                  {showMemberDropdown ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </div>
              {showMemberDropdown && filteredMembers.length > 0 && (
                <div className="absolute z-50 mt-1 w-[250px] max-h-[200px] overflow-y-auto bg-background border rounded-md shadow-lg">
                  <div 
                    className="px-3 py-2 hover:bg-muted cursor-pointer text-sm border-b"
                    onClick={() => {
                      setMemberId("");
                      setMemberSearch("");
                      setShowMemberDropdown(false);
                    }}
                  >
                    전체 회원
                  </div>
                  {filteredMembers.map((member) => (
                    <div
                      key={member.id}
                      className={`px-3 py-2 hover:bg-muted cursor-pointer text-sm ${memberId === member.id ? 'bg-muted' : ''}`}
                      onClick={() => handleMemberSelect(member)}
                    >
                      <div className="font-medium">{member.companyName}</div>
                      <div className="text-xs text-muted-foreground">
                        {member.memberId} {member.ceoName && `| ${member.ceoName}`}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {selectedMember && (
              <span className="text-sm text-muted-foreground">
                ({selectedMember.memberId})
              </span>
            )}
          </div>
        </div>
      )}

      {/* 2행: 카테고리 필터 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium whitespace-nowrap min-w-[50px]">대분류</label>
          <Select value={categoryLarge || "all"} onValueChange={handleCategoryLargeChange}>
            <SelectTrigger className="h-8 w-[140px]" data-testid="select-category-large">
              <SelectValue placeholder="전체" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              {largeCategories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium whitespace-nowrap">중분류</label>
          <Select value={categoryMedium || "all"} onValueChange={handleCategoryMediumChange}>
            <SelectTrigger className="h-8 w-[140px]" data-testid="select-category-medium">
              <SelectValue placeholder="전체" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              {mediumCategories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium whitespace-nowrap">소분류</label>
          <Select value={categorySmall || "all"} onValueChange={(v) => setCategorySmall(v === "all" ? "" : v)}>
            <SelectTrigger className="h-8 w-[140px]" data-testid="select-category-small">
              <SelectValue placeholder="전체" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              {smallCategories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 3행: 검색 필터 + 추가 필터 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium whitespace-nowrap min-w-[50px]">검색</label>
          <Select value={searchFilter} onValueChange={setSearchFilter}>
            <SelectTrigger className="h-8 w-[120px]" data-testid="select-search-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {searchOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-8 w-[180px]"
            data-testid="input-search-term"
          />
        </div>

        {additionalFilters}

        <div className="flex items-center gap-2 ml-auto">
          <Button size="sm" className="h-8" data-testid="button-search">
            <Search className="h-4 w-4 mr-1" />
            조회
          </Button>
          <Button size="sm" variant="outline" className="h-8" onClick={handleReset} data-testid="button-reset">
            <RotateCcw className="h-4 w-4 mr-1" />
            초기화
          </Button>
        </div>
      </div>
    </div>
  );
}

export function useAdminCategoryFilter<T>(
  data: T[],
  filters: AdminCategoryFilterState,
  getFields: (item: T) => {
    memberId?: string;
    categoryLarge?: string;
    categoryMedium?: string;
    categorySmall?: string;
    ordererName?: string;
    recipientName?: string;
    productName?: string;
    productCode?: string;
  }
): T[] {
  return useMemo(() => {
    let result = [...data];

    if (filters.memberId) {
      result = result.filter(item => getFields(item).memberId === filters.memberId);
    }

    if (filters.categoryLarge) {
      result = result.filter(item => getFields(item).categoryLarge === filters.categoryLarge);
    }

    if (filters.categoryMedium) {
      result = result.filter(item => getFields(item).categoryMedium === filters.categoryMedium);
    }

    if (filters.categorySmall) {
      result = result.filter(item => getFields(item).categorySmall === filters.categorySmall);
    }

    if (filters.searchFilter !== "선택 없음" && filters.searchTerm.trim()) {
      const term = filters.searchTerm.toLowerCase();
      result = result.filter(item => {
        const fields = getFields(item);
        switch (filters.searchFilter) {
          case "주문자명":
            return fields.ordererName?.toLowerCase().includes(term);
          case "수령자명":
            return fields.recipientName?.toLowerCase().includes(term);
          case "상품명":
            return fields.productName?.toLowerCase().includes(term);
          case "상품코드":
            return fields.productCode?.toLowerCase().includes(term);
          default:
            return true;
        }
      });
    }

    return result;
  }, [data, filters, getFields]);
}

export type { AdminCategoryFilterState as AdminFilterState };
