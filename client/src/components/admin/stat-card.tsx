import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  iconColor?: string;
  suffix?: string;
  isActive?: boolean;
  onClick?: () => void;
  testId?: string;
}

export function StatCard({ 
  label, 
  value, 
  icon: Icon, 
  iconColor = "bg-primary/10 text-primary",
  suffix = "",
  isActive = false,
  onClick,
  testId
}: StatCardProps) {
  return (
    <Card 
      className={cn(
        "cursor-pointer hover-elevate",
        isActive && "ring-2 ring-primary"
      )}
      onClick={onClick}
      data-testid={testId}
    >
      <CardContent className="p-3">
        <div className={cn("inline-flex items-center justify-center w-8 h-8 rounded-lg mb-2", iconColor)}>
          <Icon className="h-4 w-4" />
        </div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold">
          {typeof value === 'number' ? value.toLocaleString('ko-KR') : value}
          {suffix && <span className="text-sm font-normal">{suffix}</span>}
        </p>
      </CardContent>
    </Card>
  );
}

interface StatCardsGridProps {
  children: React.ReactNode;
  columns?: number;
}

export function StatCardsGrid({ children, columns = 6 }: StatCardsGridProps) {
  const gridCols = {
    3: "grid-cols-3",
    4: "grid-cols-2 sm:grid-cols-4",
    5: "grid-cols-3 sm:grid-cols-5",
    6: "grid-cols-3 sm:grid-cols-6",
  };
  
  return (
    <div className={cn("grid gap-3", gridCols[columns as keyof typeof gridCols] || "grid-cols-3 sm:grid-cols-6")}>
      {children}
    </div>
  );
}
