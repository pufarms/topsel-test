import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

export interface Column<T> {
  key: string;
  label: string;
  className?: string;
  render?: (item: T) => React.ReactNode;
}

interface DataTableProps<T> {
  title?: string;
  icon?: LucideIcon;
  columns: Column<T>[];
  data: T[];
  keyField: keyof T;
  onRowClick?: (item: T) => void;
  selectable?: boolean;
  selectedIds?: string[];
  onSelectAll?: (checked: boolean) => void;
  onSelectItem?: (id: string, checked: boolean) => void;
  emptyMessage?: string;
  actions?: React.ReactNode;
}

export function DataTable<T extends Record<string, any>>({
  title,
  icon: Icon,
  columns,
  data,
  keyField,
  onRowClick,
  selectable = false,
  selectedIds = [],
  onSelectAll,
  onSelectItem,
  emptyMessage = "데이터가 없습니다",
  actions
}: DataTableProps<T>) {
  const allSelected = data.length > 0 && selectedIds.length === data.length;

  return (
    <Card>
      {(title || actions) && (
        <CardHeader className="pb-2 pt-3 px-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {Icon && <Icon className="h-4 w-4 text-primary" />}
              {title && <CardTitle className="text-sm font-medium">{title}</CardTitle>}
            </div>
            {actions}
          </div>
        </CardHeader>
      )}
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                {selectable && (
                  <TableHead className="w-10 px-3 py-2">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={onSelectAll}
                      data-testid="checkbox-select-all"
                    />
                  </TableHead>
                )}
                {columns.map((col) => (
                  <TableHead 
                    key={col.key} 
                    className={cn("px-3 py-2 text-xs font-medium", col.className)}
                  >
                    {col.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 ? (
                <TableRow>
                  <TableCell 
                    colSpan={columns.length + (selectable ? 1 : 0)} 
                    className="text-center py-8 text-muted-foreground"
                  >
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              ) : (
                data.map((item) => {
                  const id = String(item[keyField]);
                  const isSelected = selectedIds.includes(id);
                  
                  return (
                    <TableRow
                      key={id}
                      className={cn(
                        "hover:bg-muted/50 cursor-pointer",
                        isSelected && "bg-primary/5"
                      )}
                      data-testid={`row-${id}`}
                    >
                      {selectable && (
                        <TableCell className="px-3 py-2">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => onSelectItem?.(id, !!checked)}
                            onClick={(e) => e.stopPropagation()}
                            data-testid={`checkbox-${id}`}
                          />
                        </TableCell>
                      )}
                      {columns.map((col) => (
                        <TableCell
                          key={col.key}
                          className={cn("px-3 py-2 text-sm", col.className)}
                          onClick={() => onRowClick?.(item)}
                        >
                          {col.render ? col.render(item) : item[col.key]}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
