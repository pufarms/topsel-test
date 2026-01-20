import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Filter, Search, RotateCcw } from "lucide-react";

interface FilterSectionProps {
  children: React.ReactNode;
  onSearch?: () => void;
  onReset?: () => void;
  showButtons?: boolean;
}

export function FilterSection({ children, onSearch, onReset, showButtons = true }: FilterSectionProps) {
  return (
    <Card>
      <CardHeader className="pb-2 pt-3 px-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-medium">검색 및 필터</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {children}
        </div>
        {showButtons && (
          <div className="flex gap-2 mt-3">
            <Button size="sm" onClick={onSearch} data-testid="button-search">
              <Search className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">검색</span>
            </Button>
            <Button variant="outline" size="sm" onClick={onReset} data-testid="button-reset">
              <RotateCcw className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">초기화</span>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface FilterFieldProps {
  label: string;
  children: React.ReactNode;
}

export function FilterField({ label, children }: FilterFieldProps) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
