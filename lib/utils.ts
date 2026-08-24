import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getInitials(name: string): string {
  if (!name || name.trim() === "") return "??"

  const words = name
    .trim()
    .split(" ")
    .filter((word) => word.length > 0)

  if (words.length === 0) return "??"
  if (words.length === 1) return words[0].substring(0, 2).toUpperCase()

  // Get first letter of first name and first letter of last name
  return (words[0][0] + words[words.length - 1][0]).toUpperCase()
}
