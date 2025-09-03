import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"

interface SensitiveFieldProps {
  value: string | number | null | undefined
  maskPattern?: "account" | "ssn" | "routing" | "custom"
  customMask?: string
  label?: string
  className?: string
}

export function SensitiveField({ 
  value, 
  maskPattern = "account", 
  customMask,
  label,
  className = ""
}: SensitiveFieldProps) {
  const [isVisible, setIsVisible] = useState(false)

  // Return dash if no value
  if (!value) return <span className={className}>-</span>

  const stringValue = String(value).replace(/\D/g, '') // Remove non-digits for formatting

  // Format SSN/TIN with proper dashes
  const formatSSN = (ssn: string) => {
    // Handle edge cases - if not 9 digits, don't format
    if (ssn.length !== 9) {
      return ssn // Return as-is if wrong length
    }
    return `${ssn.slice(0, 3)}-${ssn.slice(3, 5)}-${ssn.slice(5, 9)}`
  }

  // Format routing number with dashes
  const formatRouting = (routing: string) => {
    // Routing numbers are 9 digits, format as XXX-XXX-XXX
    if (routing.length !== 9) {
      return routing // Return as-is if wrong length
    }
    return `${routing.slice(0, 3)}-${routing.slice(3, 6)}-${routing.slice(6, 9)}`
  }

  // Format account number with dashes
  const formatAccount = (account: string) => {
    // For account numbers, show in groups but don't enforce length
    if (account.length <= 4) return account
    if (account.length <= 8) {
      return `${account.slice(0, 4)}-${account.slice(4)}`
    }
    return `${account.slice(0, 4)}-${account.slice(4, 8)}-${account.slice(8)}`
  }

  // Generate masked version based on pattern
  const getMaskedValue = () => {
    if (customMask) return customMask
    
    switch (maskPattern) {
      case "account":
        // Show last 4 digits: ***-****-1234
        if (stringValue.length <= 4) return "****"
        const formatted = formatAccount(stringValue)
        const parts = formatted.split('-')
        if (parts.length === 1) return "****"
        if (parts.length === 2) return `****-${parts[1]}`
        return `****-****-${parts[parts.length - 1]}`
      
      case "ssn":
        // Show last 4 digits: ***-**-1234
        if (stringValue.length <= 4) return "***-**-****"
        if (stringValue.length !== 9) {
          // If wrong length, just mask most of it
          return "*".repeat(Math.max(1, stringValue.length - 4)) + stringValue.slice(-4)
        }
        return `***-**-${stringValue.slice(-4)}`
      
      case "routing":
        // Show last 3 digits: ***-***-123
        if (stringValue.length <= 3) return "***-***-***"
        if (stringValue.length !== 9) {
          // If wrong length, just mask most of it
          return "*".repeat(Math.max(1, stringValue.length - 3)) + stringValue.slice(-3)
        }
        return `***-***-${stringValue.slice(-3)}`
      
      default:
        return "****"
    }
  }

  const maskedValue = getMaskedValue()
  
  // Get the properly formatted visible value
  const getFormattedValue = () => {
    switch (maskPattern) {
      case "ssn":
        return formatSSN(stringValue)
      case "routing":
        return formatRouting(stringValue)
      case "account":
        return formatAccount(stringValue)
      default:
        return stringValue
    }
  }

  const displayValue = isVisible ? getFormattedValue() : maskedValue

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="font-mono text-sm">
        {displayValue}
      </span>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0 hover:bg-gray-100"
        onClick={() => setIsVisible(!isVisible)}
        type="button"
        aria-label={isVisible ? "Hide sensitive information" : "Show sensitive information"}
      >
        {isVisible ? (
          <EyeOff className="h-3 w-3 text-gray-500" />
        ) : (
          <Eye className="h-3 w-3 text-gray-500" />
        )}
      </Button>
    </div>
  )
}
