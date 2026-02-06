export function getKSTDate(date?: Date): Date {
  const d = date ? new Date(date) : new Date();
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  return new Date(utc + 9 * 3600000);
}

export function formatDateToYYYYMMDD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getTodayKST(): string {
  return formatDateToYYYYMMDD(getKSTDate());
}

export function getYesterdayKST(): string {
  const kst = getKSTDate();
  kst.setDate(kst.getDate() - 1);
  return formatDateToYYYYMMDD(kst);
}

export function getThisWeekRange(): { start: string; end: string } {
  const kst = getKSTDate();
  const day = kst.getDay();
  const monday = new Date(kst);
  monday.setDate(kst.getDate() - (day === 0 ? 6 : day - 1));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: formatDateToYYYYMMDD(monday), end: formatDateToYYYYMMDD(sunday) };
}

export function getThisMonthRange(): { start: string; end: string } {
  const kst = getKSTDate();
  const start = new Date(kst.getFullYear(), kst.getMonth(), 1);
  const end = new Date(kst.getFullYear(), kst.getMonth() + 1, 0);
  return { start: formatDateToYYYYMMDD(start), end: formatDateToYYYYMMDD(end) };
}

export type DatePreset = "today" | "yesterday" | "week" | "month" | "all" | "custom";

export function getDateRangeFromPreset(preset: DatePreset): { startDate: string; endDate: string } | null {
  switch (preset) {
    case "today": {
      const today = getTodayKST();
      return { startDate: today, endDate: today };
    }
    case "yesterday": {
      const yesterday = getYesterdayKST();
      return { startDate: yesterday, endDate: yesterday };
    }
    case "week": {
      const range = getThisWeekRange();
      return { startDate: range.start, endDate: range.end };
    }
    case "month": {
      const range = getThisMonthRange();
      return { startDate: range.start, endDate: range.end };
    }
    case "all":
      return null;
    case "custom":
      return null;
    default:
      return null;
  }
}
