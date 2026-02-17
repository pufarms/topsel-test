import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getTodayKST,
  getDateRangeFromPreset,
  formatDateToYYYYMMDD,
  type DatePreset,
} from "@/lib/date-utils";

export interface DateRangeState {
  startDate: string;
  endDate: string;
}

interface DateRangeFilterProps {
  onChange: (range: DateRangeState) => void;
  defaultPreset?: DatePreset;
  controlledPreset?: DatePreset;
  onPresetChange?: (preset: DatePreset) => void;
  showAllOption?: boolean;
  showLabel?: boolean;
  className?: string;
}

export function DateRangeFilter({
  onChange,
  defaultPreset = "today",
  controlledPreset,
  onPresetChange,
  showAllOption = false,
  showLabel = true,
  className,
}: DateRangeFilterProps) {
  const [localPreset, setLocalPreset] = useState<DatePreset>(defaultPreset);
  const [customStart, setCustomStart] = useState<Date | undefined>(undefined);
  const [customEnd, setCustomEnd] = useState<Date | undefined>(undefined);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const isControlled = controlledPreset !== undefined;
  const activePreset = isControlled ? controlledPreset : localPreset;
  const setActivePreset = useCallback((preset: DatePreset) => {
    if (!isControlled) {
      setLocalPreset(preset);
    }
    onPresetChange?.(preset);
  }, [onPresetChange, isControlled]);

  useEffect(() => {
    if (controlledPreset !== undefined) return;
    if (defaultPreset !== "custom") {
      const range = getDateRangeFromPreset(defaultPreset);
      if (range) {
        onChange(range);
      } else if (defaultPreset === "all") {
        onChange({ startDate: "", endDate: "" });
      }
    }
  }, []);

  const handlePresetClick = (preset: DatePreset) => {
    setActivePreset(preset);
    if (preset === "custom") {
      return;
    }
    const range = getDateRangeFromPreset(preset);
    if (range) {
      onChange(range);
    } else if (preset === "all") {
      onChange({ startDate: "", endDate: "" });
    }
  };

  const handleCustomStartSelect = (date: Date | undefined) => {
    setCustomStart(date);
    setShowStartPicker(false);
    if (date && customEnd) {
      const startStr = formatDateToYYYYMMDD(date);
      const endStr = formatDateToYYYYMMDD(customEnd);
      onChange({ startDate: startStr, endDate: endStr });
    }
  };

  const handleCustomEndSelect = (date: Date | undefined) => {
    setCustomEnd(date);
    setShowEndPicker(false);
    if (customStart && date) {
      const startStr = formatDateToYYYYMMDD(customStart);
      const endStr = formatDateToYYYYMMDD(date);
      onChange({ startDate: startStr, endDate: endStr });
    }
  };

  const presetLabel = (preset: DatePreset) => {
    switch (preset) {
      case "today": return "오늘";
      case "yesterday": return "어제";
      case "week": return "이번 주";
      case "lastWeek": return "지난주";
      case "month": return "이번 달";
      case "lastMonth": return "지난달";
      case "3months": return "최근 3개월";
      case "all": return "전체";
      case "custom": return "직접 선택";
    }
  };

  const getCurrentLabel = (): string => {
    if (activePreset === "custom" && customStart && customEnd) {
      return `${formatDateToYYYYMMDD(customStart)} ~ ${formatDateToYYYYMMDD(customEnd)}`;
    }
    if (activePreset === "today") {
      return `${getTodayKST()} (오늘)`;
    }
    if (activePreset !== "custom" && activePreset !== "all") {
      const range = getDateRangeFromPreset(activePreset);
      if (range) return `${range.startDate} ~ ${range.endDate}`;
    }
    if (activePreset === "all") return "전체 기간";
    return "";
  };

  const presets: DatePreset[] = showAllOption
    ? ["today", "yesterday", "week", "lastWeek", "month", "lastMonth", "all", "custom"]
    : ["today", "yesterday", "week", "lastWeek", "month", "lastMonth", "custom"];

  return (
    <div className={cn("flex flex-col gap-2", className)} data-testid="date-range-filter">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">기간:</span>
        <div className="flex flex-wrap items-center gap-1.5">
          {presets.map((preset) => (
            <Button
              key={preset}
              size="sm"
              variant={activePreset === preset ? "default" : "outline"}
              onClick={() => handlePresetClick(preset)}
              data-testid={`date-preset-${preset}`}
            >
              {presetLabel(preset)}
            </Button>
          ))}
        </div>
      </div>

      {(activePreset === "custom" || (showLabel && getCurrentLabel())) && (
        <div className="flex flex-wrap items-center gap-2 pl-0.5">
          {activePreset === "custom" && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <Popover open={showStartPicker} onOpenChange={setShowStartPicker}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn("justify-start text-left font-normal min-w-[130px]",
                      !customStart && "text-muted-foreground"
                    )}
                    data-testid="date-custom-start"
                  >
                    <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                    {customStart ? formatDateToYYYYMMDD(customStart) : "시작일"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={customStart}
                    onSelect={handleCustomStartSelect}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <span className="text-sm text-muted-foreground">~</span>
              <Popover open={showEndPicker} onOpenChange={setShowEndPicker}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn("justify-start text-left font-normal min-w-[130px]",
                      !customEnd && "text-muted-foreground"
                    )}
                    data-testid="date-custom-end"
                  >
                    <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                    {customEnd ? formatDateToYYYYMMDD(customEnd) : "종료일"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={customEnd}
                    onSelect={handleCustomEndSelect}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}
          {showLabel && getCurrentLabel() && (
            <Badge variant="secondary" className="text-sm py-1 px-3" data-testid="date-range-label">
              <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
              {getCurrentLabel()}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

export function useDateRange(defaultPreset: DatePreset = "today") {
  const range = getDateRangeFromPreset(defaultPreset);
  const [dateRange, setDateRange] = useState<DateRangeState>(
    range || { startDate: "", endDate: "" }
  );
  const [activePreset, setActivePreset] = useState<DatePreset>(defaultPreset);
  return { dateRange, setDateRange, activePreset, setActivePreset };
}
