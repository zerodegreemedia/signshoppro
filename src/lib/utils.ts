import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Format a date string using native Intl.DateTimeFormat (no date-fns needed). */
export function formatDate(
  date: string | Date,
  style: "short" | "medium" | "long" | "datetime" = "medium"
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  switch (style) {
    case "short":
      // "Mar 5"
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    case "medium":
      // "Mar 5, 2026"
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    case "long":
      // "March 5, 2026"
      return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    case "datetime":
      // "Mar 5, 2026 3:30 PM"
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
  }
}
