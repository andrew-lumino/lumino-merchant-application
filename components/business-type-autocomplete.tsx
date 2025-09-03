import React, { useState, useRef, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ChevronDown, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { businessTypes } from "./utils/business-types"

interface BusinessTypeAutocompleteProps {
  value: string
  onChange: (value: string) => void
  error?: string
  className?: string
}

export function BusinessTypeAutocomplete({ 
  value, 
  onChange, 
  error,
  className 
}: BusinessTypeAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [filteredOptions, setFilteredOptions] = useState<string[]>([])
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [inputValue, setInputValue] = useState(value)
  
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Filter options based on input
  useEffect(() => {
    if (inputValue.trim() === "") {
      setFilteredOptions([])
      setIsOpen(false)
      return
    }

    const filtered = businessTypes.filter(option =>
      option.toLowerCase().includes(inputValue.toLowerCase())
    ).slice(0, 10) // Limit to 10 results for performance

    setFilteredOptions(filtered)
    setIsOpen(filtered.length > 0)
    setHighlightedIndex(-1)
  }, [inputValue])

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setInputValue(newValue)
    onChange(newValue)
  }

  // Handle option selection
  const handleOptionSelect = (option: string) => {
    setInputValue(option)
    onChange(option)
    setIsOpen(false)
    setHighlightedIndex(-1)
    inputRef.current?.focus()
  }

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' && filteredOptions.length > 0) {
        setIsOpen(true)
        setHighlightedIndex(0)
        e.preventDefault()
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex(prev => 
          prev < filteredOptions.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : -1)
        break
      case 'Enter':
        e.preventDefault()
        if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
          handleOptionSelect(filteredOptions[highlightedIndex])
        }
        break
      case 'Escape':
        setIsOpen(false)
        setHighlightedIndex(-1)
        inputRef.current?.blur()
        break
      case 'Tab':
        setIsOpen(false)
        setHighlightedIndex(-1)
        break
    }
  }

  // Scroll highlighted option into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const highlightedElement = listRef.current.children[highlightedIndex] as HTMLElement
      if (highlightedElement) {
        highlightedElement.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth'
        })
      }
    }
  }, [highlightedIndex])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setHighlightedIndex(-1)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Sync input value with prop value
  useEffect(() => {
    setInputValue(value)
  }, [value])

  const clearInput = () => {
    setInputValue("")
    onChange("")
    setIsOpen(false)
    inputRef.current?.focus()
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <Input
          ref={inputRef}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Type to search business types..."
          className={cn(
            "pr-20",
            error ? "border-red-500" : "",
            isOpen ? "rounded-b-none border-b-0" : ""
          )}
          autoComplete="off"
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          aria-haspopup="listbox"
        />
        
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {inputValue && (
            <button
              type="button"
              onClick={clearInput}
              className="p-1 hover:bg-gray-100 rounded"
              tabIndex={-1}
            >
              <X className="h-3 w-3 text-gray-400" />
            </button>
          )}
          <ChevronDown 
            className={cn(
              "h-4 w-4 text-gray-400 transition-transform",
              isOpen && "rotate-180"
            )} 
          />
        </div>
      </div>

      {isOpen && filteredOptions.length > 0 && (
        <ul
          ref={listRef}
          className="absolute z-50 w-full bg-white border border-t-0 border-gray-200 rounded-b-md shadow-lg max-h-60 overflow-auto"
          role="listbox"
        >
          {filteredOptions.map((option, index) => (
            <li
              key={option}
              role="option"
              aria-selected={index === highlightedIndex}
              className={cn(
                "px-3 py-2 cursor-pointer text-sm",
                index === highlightedIndex 
                  ? "bg-blue-100 text-blue-900" 
                  : "hover:bg-gray-50",
                "border-b border-gray-100 last:border-b-0"
              )}
              onMouseDown={(e) => {
                e.preventDefault() // Prevent input from losing focus
                handleOptionSelect(option)
              }}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              {option}
            </li>
          ))}
        </ul>
      )}

      {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
    </div>
  )
}
