import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp } from "lucide-react";
import { LucideIcon } from "lucide-react";
import { useState } from "react";

interface ActionSectionProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  selectedCount?: number;
  children: React.ReactNode;
  onApply?: () => void;
  applyLabel?: string;
  applyDisabled?: boolean;
  collapsible?: boolean;
  defaultExpanded?: boolean;
}

export function ActionSection({
  title,
  description,
  icon: Icon,
  selectedCount = 0,
  children,
  onApply,
  applyLabel = "적용",
  applyDisabled = false,
  collapsible = true,
  defaultExpanded = false
}: ActionSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <Card>
      <CardHeader className="pb-2 pt-3 px-3">
        <div
          className={collapsible ? "flex items-center justify-between cursor-pointer" : "flex items-center justify-between"}
          onClick={collapsible ? () => setIsExpanded(!isExpanded) : undefined}
        >
          <div className="flex items-center gap-2">
            {Icon && (
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                <Icon className="h-3.5 w-3.5 text-primary" />
              </div>
            )}
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            {selectedCount > 0 && (
              <Badge variant="secondary" className="text-xs">{selectedCount}명 선택</Badge>
            )}
          </div>
          {collapsible && (
            isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
          )}
        </div>
        {description && <CardDescription className="text-xs">{description}</CardDescription>}
      </CardHeader>
      {(!collapsible || isExpanded) && (
        <CardContent className="p-3 pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {children}
          </div>
          {onApply && (
            <div className="mt-3">
              <Button 
                size="sm" 
                onClick={onApply} 
                disabled={applyDisabled}
                data-testid="button-bulk-apply"
              >
                {applyLabel}
              </Button>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
