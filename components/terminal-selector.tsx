"use client"

import { useState, useEffect, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, Search, Plus, Minus } from "lucide-react"

interface Terminal {
  id: string
  name: string
  vendor: string
  industryCategories: string[]
  deviceCategory: string
  price: number
  imageUrl: string | null
}

interface SelectedTerminal {
  name: string
  price: number
  quantity: number
}

interface TerminalSelectorProps {
  onChange: (terminals: SelectedTerminal[]) => void
  selectedTerminals: SelectedTerminal[]
}

export function TerminalSelector({ onChange, selectedTerminals = [] }: TerminalSelectorProps) {
  const [terminals, setTerminals] = useState<Terminal[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filters, setFilters] = useState({
    industry: "all",
    category: "all",
    vendor: "all",
  })

  useEffect(() => {
    const fetchTerminals = async () => {
      try {
        const response = await fetch("/api/get-terminals")
        const data = await response.json()
        if (data.success) {
          setTerminals(data.terminals)
        }
      } catch (error) {
        console.error("Failed to fetch terminals:", error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchTerminals()
  }, [])

  const unique = (arr: string[]) => [...new Set(arr)].filter(Boolean)

  const filterOptions = useMemo(() => {
    const allIndustries = unique(terminals.flatMap((t) => t.industryCategories))
    const allCategories = unique(terminals.map((t) => t.deviceCategory))
    const allVendors = unique(terminals.map((t) => t.vendor))
    return {
      industries: allIndustries,
      categories: allCategories,
      vendors: allVendors,
    }
  }, [terminals])

  const filteredTerminals = useMemo(() => {
    return terminals.filter((terminal) => {
      const searchMatch = terminal.name.toLowerCase().includes(searchTerm.toLowerCase())
      const industryMatch = filters.industry === "all" || terminal.industryCategories.includes(filters.industry)
      const categoryMatch = filters.category === "all" || terminal.deviceCategory === filters.category
      const vendorMatch = filters.vendor === "all" || terminal.vendor === filters.vendor
      return searchMatch && industryMatch && categoryMatch && vendorMatch
    })
  }, [terminals, searchTerm, filters])

  const handleFilterChange = (filterName: keyof typeof filters, value: string) => {
    setFilters((prev) => ({ ...prev, [filterName]: value }))
  }

  const handleSelect = (terminal: { name: string; price: number }) => {
    const existingTerminal = selectedTerminals.find((t) => t.name === terminal.name)
    let newSelectedTerminals

    if (existingTerminal) {
      // Remove terminal if it exists
      newSelectedTerminals = selectedTerminals.filter((t) => t.name !== terminal.name)
    } else {
      // Add terminal with quantity 1
      newSelectedTerminals = [...selectedTerminals, { ...terminal, quantity: 1 }]
    }
    onChange(newSelectedTerminals)
  }

  const handleQuantityChange = (terminalName: string, newQuantity: number) => {
    if (newQuantity < 1) return // Minimum quantity is 1

    const newSelectedTerminals = selectedTerminals.map((terminal) =>
      terminal.name === terminalName ? { ...terminal, quantity: newQuantity } : terminal,
    )
    onChange(newSelectedTerminals)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        <span className="ml-2">Loading Terminals...</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid md:grid-cols-4 gap-4">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search terminal name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filters.industry} onValueChange={(value) => handleFilterChange("industry", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by Industry" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Industries</SelectItem>
                {filterOptions.industries.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filters.category} onValueChange={(value) => handleFilterChange("category", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {filterOptions.categories.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filters.vendor} onValueChange={(value) => handleFilterChange("vendor", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by Brand" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Brands</SelectItem>
                {filterOptions.vendors.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {selectedTerminals.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h4 className="font-medium mb-3">Selected Terminals</h4>
            <div className="space-y-3">
              {selectedTerminals.map((terminal) => (
                <div key={terminal.name} className="flex items-center justify-between p-3 border rounded-lg bg-gray-50">
                  <div className="flex-grow">
                    <p className="font-semibold">{terminal.name}</p>
                    <p className="text-sm text-gray-600">${terminal.price.toFixed(2)} each</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 bg-transparent"
                      onClick={() => handleQuantityChange(terminal.name, terminal.quantity - 1)}
                      disabled={terminal.quantity <= 1}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-12 text-center font-medium">{terminal.quantity}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 bg-transparent"
                      onClick={() => handleQuantityChange(terminal.name, terminal.quantity + 1)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSelect({ name: terminal.name, price: terminal.price })}
                      className="ml-2 text-red-600 hover:text-red-700"
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[500px] overflow-y-auto p-2">
        {filteredTerminals.length > 0 ? (
          filteredTerminals.map((terminal) => {
            const isSelected = selectedTerminals.some((t) => t.name === terminal.name)
            return (
              <Card
                key={terminal.id}
                className={`overflow-hidden transition-all ${isSelected ? "border-2 border-blue-500 shadow-lg" : ""}`}
              >
                <CardContent className="p-4 flex flex-col h-full">
                  <img
                    src={
                      terminal.imageUrl ||
                      "/placeholder.svg?width=300&height=200&query=payment+terminal" ||
                      "/placeholder.svg"
                    }
                    alt={terminal.name}
                    className="w-full h-40 object-contain mb-4 rounded"
                  />
                  <h4 className="font-semibold text-lg flex-grow">{terminal.name}</h4>
                  <p className="text-gray-600 text-xl font-bold my-2">${terminal.price.toFixed(2)}</p>
                  <Button
                    onClick={() => handleSelect({ name: terminal.name, price: terminal.price })}
                    variant={isSelected ? "default" : "outline"}
                    className="w-full mt-auto"
                  >
                    {isSelected ? "Selected" : "Select"}
                  </Button>
                </CardContent>
              </Card>
            )
          })
        ) : (
          <p className="text-gray-500 col-span-full text-center py-8">No terminals match your criteria.</p>
        )}
      </div>
    </div>
  )
}
