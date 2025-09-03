import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { currentUser } from "@clerk/nextjs/server"

/**
 * Combines multiple class names into a single string.
 *
 * @param inputs - The class names to combine.
 * @returns - The combined class names.
 *
 * @example
 * cn("text-red-500", "bg-blue-500"); // Returns "text-red-500 bg-blue-500"
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Converts a string to title case, respecting small words and ignoring specified indexes.
 *
 * @param input - The string to convert.
 * @param ignoreIndexes - Array of word indexes to ignore (keep lowercase).
 * @returns - The title-cased string.
 *
 * @example
 * autoTitleCase("the quick brown fox jumps over the lazy dog"); // Returns "The Quick Brown Fox Jumps Over the Lazy Dog"
 * @example
 * autoTitleCase("the quick brown fox jumps over the lazy dog", [0, 4]); // Returns "the Quick Brown Fox jumps Over the Lazy Dog"
 */

export function autoTitleCase(input: string, ignoreIndexes: number[] = []): string {
  if (!input) return ""

  // Common short words (lowercase in titles, except first word)
  const smallWords = new Set([
    "a",
    "an",
    "and",
    "as",
    "at",
    "but",
    "by",
    "for",
    "in",
    "nor",
    "of",
    "on",
    "or",
    "per",
    "the",
    "to",
    "vs",
    "via",
  ])

  // Normalize string: remove extra spaces, replace _ and - with space
  const words = input.replace(/[_-]+/g, " ").trim().split(/\s+/)

  return words
    .map((word, index) => {
      if (ignoreIndexes.includes(index)) return word // Respect ignored indexes

      const lower = word.toLowerCase()

      // Always capitalize first word, otherwise lowercase small words
      if (index !== 0 && smallWords.has(lower)) {
        return lower
      }

      // Capitalize first letter, leave rest lowercase
      return lower.charAt(0).toUpperCase() + lower.slice(1)
    })
    .join(" ")
}

export const formatDateTime = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleString("en-US", {
    month: "long", // Full month name
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

// Enhanced Search Helper Functions

export function getPrincipalData(principals: any, field: "name" | "address"): string {
  if (!principals) return ""
  try {
    const principalArray = typeof principals === "string" ? JSON.parse(principals) : principals
    if (Array.isArray(principalArray)) {
      if (field === "name") {
        return principalArray
          .map((p) => `${p.firstName || ""} ${p.lastName || ""}`.trim())
          .join(" ")
          .toLowerCase()
      }
      if (field === "address") {
        return principalArray
          .map((p) => `${p.address || ""} ${p.city || ""} ${p.state || ""} ${p.zip || ""}`.trim())
          .join(" ")
          .toLowerCase()
      }
    }
  } catch {
    // Ignore parsing errors
  }
  return ""
}

export function evaluateNumericQuery(value: number | null | undefined, query: string): boolean {
  if (value === null || value === undefined) return false

  // Handle range like [1000-5000] or 1000-5000
  const rangeMatch = query.match(/\[?([\d.]+)-([\d.]+)\]?/)
  if (rangeMatch) {
    const [, min, max] = rangeMatch.map(Number.parseFloat)
    return value >= min && value <= max
  }

  const operatorMatch = query.match(/^([<>]=?|=)([\d.]+)/)
  if (operatorMatch) {
    const [, operator, num] = operatorMatch
    const queryValue = Number.parseFloat(num)
    if (operator === ">") return value > queryValue
    if (operator === ">=") return value >= queryValue
    if (operator === "<") return value < queryValue
    if (operator === "<=") return value <= queryValue
    if (operator === "=") return value === queryValue
  }

  // Default: exact match
  return value.toString() === query
}

export function evaluateDateQuery(dateString: string | null | undefined, query: string): boolean {
  if (!dateString) return false
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return false

  const now = new Date()
  now.setHours(0, 0, 0, 0) // Start of today

  if (query === "today") {
    const targetDate = new Date(date)
    targetDate.setHours(0, 0, 0, 0)
    return targetDate.getTime() === now.getTime()
  }
  if (query === "yesterday") {
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const targetDate = new Date(date)
    targetDate.setHours(0, 0, 0, 0)
    return targetDate.getTime() === yesterday.getTime()
  }
  if (query.match(/^last\d+days$/)) {
    const days = Number.parseInt(query.replace("last", "").replace("days", ""))
    const pastDate = new Date(now)
    pastDate.setDate(pastDate.getDate() - days)
    return date >= pastDate
  }
  if (query === "thisweek") {
    const dayOfWeek = now.getDay()
    const firstDayOfWeek = new Date(now)
    firstDayOfWeek.setDate(now.getDate() - dayOfWeek)
    return date >= firstDayOfWeek
  }
  if (query === "thismonth") {
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
  }

  // Handle specific dates or years like "2023" or "2023-12-25"
  return dateString.toLowerCase().includes(query)
}

export function searchAllAddresses(app: Record<string, any>, query: string): boolean {
  const lowerQuery = query.toLowerCase()
  const dbaAddress =
    `${app.dba_address_line1 || ""} ${app.dba_address_line2 || ""} ${app.dba_city || ""} ${app.dba_state || ""} ${app.dba_zip || ""}`.toLowerCase()
  const legalAddress = app.legal_differs
    ? `${app.legal_address_line1 || ""} ${app.legal_address_line2 || ""} ${app.legal_city || ""} ${app.legal_state || ""} ${app.legal_zip || ""}`.toLowerCase()
    : ""
  const principalAddresses = getPrincipalData(app.principals, "address")

  return (
    dbaAddress.includes(lowerQuery) ||
    (app.legal_differs && legalAddress.includes(lowerQuery)) ||
    principalAddresses.includes(lowerQuery)
  )
}
