import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

interface MobileCardProps {
  children: React.ReactNode;
  onClick?: () => void;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (checked: boolean) => void;
  testId?: string;
}

export function MobileCard({ 
  children, 
  onClick, 
  selectable = false, 
  selected = false, 
  onSelect,
  testId 
}: MobileCardProps) {
  return (
    <Card 
      className={cn(
        "cursor-pointer hover-elevate",
        selected && "ring-2 ring-primary"
      )}
      onClick={onClick}
      data-testid={testId}
    >
      <CardContent className="p-3">
        <div className="flex gap-3">
          {selectable && (
            <div className="pt-1" onClick={(e) => e.stopPropagation()}>
              <Checkbox
                checked={selected}
                onCheckedChange={onSelect}
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            {children}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface MobileCardFieldProps {
  label: string;
  value: React.ReactNode;
  className?: string;
}

export function MobileCardField({ label, value, className }: MobileCardFieldProps) {
  return (
    <div className={cn("flex justify-between items-center text-sm", className)}>
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

interface MobileCardsListProps {
  children: React.ReactNode;
}

export function MobileCardsList({ children }: MobileCardsListProps) {
  return (
    <div className="space-y-2 lg:hidden">
      {children}
    </div>
  );
}
