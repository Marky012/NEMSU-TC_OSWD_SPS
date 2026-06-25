import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export function toUpperDisplay(val) {
  if (val == null || val === '') return val
  const str = String(val)
  if (str.includes('@')) return str
  return str.toUpperCase()
}