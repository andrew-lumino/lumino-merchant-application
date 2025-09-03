import { useState, useEffect } from "react"

interface PhoneFormatterProps {
  value: string | null | undefined
  className?: string
}

export function PhoneNumber({ value, className = "" }: PhoneFormatterProps) {
  const [formattedPhone, setFormattedPhone] = useState("")

  useEffect(() => {
    if (!value) {
      setFormattedPhone("-")
      return
    }

    const stringValue = String(value).trim()
    
    // If empty after trim, show dash
    if (!stringValue) {
      setFormattedPhone("-")
      return
    }

    // Extract only digits
    const digitsOnly = stringValue.replace(/\D/g, "")
    
    // Check if it starts with country code
    const hasCountryCode = stringValue.startsWith("+1") || stringValue.startsWith("1")
    
    // Determine if we should include +1
    let shouldShowCountryCode = false
    let phoneDigits = digitsOnly

    if (hasCountryCode && digitsOnly.length >= 11 && digitsOnly.startsWith("1")) {
      shouldShowCountryCode = true
      phoneDigits = digitsOnly.substring(1) // Remove the leading 1
    }

    // Format based on phone number length
    const formatPhone = (digits: string, includeCountryCode: boolean) => {
      if (digits.length === 10) {
        // Perfect 10-digit US number: (555) 555-5555
        const formatted = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`
        return includeCountryCode ? `+1 ${formatted}` : formatted
      } else if (digits.length === 7) {
        // 7-digit local number: 555-5555
        const formatted = `${digits.slice(0, 3)}-${digits.slice(3, 7)}`
        return includeCountryCode ? `+1 ${formatted}` : formatted
      } else if (digits.length > 10) {
        // Too many digits - format first 10 and show the rest
        const mainPart = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`
        const extra = digits.slice(10)
        const formatted = `${mainPart} ext ${extra}`
        return includeCountryCode ? `+1 ${formatted}` : formatted
      } else if (digits.length > 3 && digits.length < 7) {
        // Partial number with area code: (555) 55...
        const formatted = `(${digits.slice(0, 3)}) ${digits.slice(3)}`
        return includeCountryCode ? `+1 ${formatted}` : formatted
      } else if (digits.length > 0 && digits.length <= 3) {
        // Just area code: (555
        const formatted = `(${digits}`
        return includeCountryCode ? `+1 ${formatted}` : formatted
      }
      
      // Fallback: couldn't format properly, return original
      return stringValue
    }

    const result = formatPhone(phoneDigits, shouldShowCountryCode)
    setFormattedPhone(result)
    
  }, [value])

  return formattedPhone
}
