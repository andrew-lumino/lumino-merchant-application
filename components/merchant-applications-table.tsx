"use client"

import type React from "react"

import { useState, useEffect, useCallback, useRef } from "react"
import { useUser } from "@clerk/nextjs"
import { useToast } from "@/hooks/use-toast"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  MoreHorizontal,
  Download,
  FileText,
  Search,
  ExternalLink,
  Trash2,
  RotateCcw,
  Info,
  ClipboardCopy,
  MessageSquare,
  Edit,
  Save,
  Mail,
  FolderDown,
} from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SensitiveField } from "@/components/sensitive-field"
import { autoTitleCase, evaluateDateQuery, evaluateNumericQuery, getPrincipalData, searchAllAddresses } from "./utils"
import { PhoneNumber } from "./phone-number"

type Note = { id: string; text: string; userEmail: string; userName: string; timestamp: string }
type Application = Record<string, any> & { notes?: Note[] }

const SEARCH_PREFIXES = [
  { prefix: "name:", description: "DBA Name" },
  { prefix: "legal_name:", description: "Legal Name" },
  { prefix: "email:", description: "DBA Email" },
  { prefix: "phone:", description: "DBA Phone" },
  { prefix: "address:", description: "Any address (DBA, Legal, Principal)" },
  { prefix: "status:", description: "e.g., submitted, pending" },
  { prefix: "agent:", description: "Account Manager username" },
  { prefix: "id:", description: "Application UUID" },
  { prefix: "notes:", description: "Content of internal notes" },
  { prefix: "principals:", description: "Principal names" },
  { prefix: "terminal:", description: "Terminal Name" },
  { prefix: "volume:", description: "Monthly volume (e.g., >10000, 5k-10k)" },
  { prefix: "avg_ticket:", description: "Average ticket size" },
  { prefix: "high_ticket:", description: "Highest ticket size" },
  { prefix: "equity:", description: "Principal equity %" },
  { prefix: "created:", description: "Date (e.g., today, last7days, 2023-12-25)" },
  { prefix: "has:", description: "e.g., has:notes, has:uploads" },
  { prefix: "missing:", description: "e.g., missing:email, missing:phone" },
]

export default function MerchantApplicationsTable({
  applications: initialApplications,
}: {
  applications: Application[]
}) {
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(1)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [appToDelete, setAppToDelete] = useState<Application | null>(null)
  const [startDate, setStartDate] = useState<string>("")
  const [endDate, setEndDate] = useState<string>("")
  const { toast } = useToast()
  const { user } = useUser()
  const [notes, setNotes] = useState<Note[]>([])
  const [newNote, setNewNote] = useState("")
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState("")
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestions, setSuggestions] = useState<typeof SEARCH_PREFIXES>([])
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0)
  const searchContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (selectedApplication) setNotes(selectedApplication.notes || [])
  }, [selectedApplication])

  const handleUpdateNotes = async (updatedNotes: Note[]) => {
    if (!selectedApplication) return
    try {
      const response = await fetch("/api/update-application-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId: selectedApplication.id, notes: updatedNotes }),
      })
      const result = await response.json()
      if (!result.success) throw new Error(result.error || "Failed to update notes")
      setNotes(result.notes)
      setApplications((prev) =>
        prev.map((app) => (app.id === selectedApplication.id ? { ...app, notes: result.notes } : app)),
      )
      return true
    } catch (error) {
      toast({ title: "Error", description: "Failed to save note. Please try again.", variant: "destructive" })
      return false
    }
  }

  const handleAddNote = async () => {
    if (!newNote.trim() || !user) return
    const noteToAdd: Note = {
      id: crypto.randomUUID(),
      text: newNote.trim(),
      userEmail: user.primaryEmailAddress?.emailAddress || "unknown",
      userName: user.fullName || "Unknown User",
      timestamp: new Date().toISOString(),
    }
    const updatedNotes = [...notes, noteToAdd]
    const success = await handleUpdateNotes(updatedNotes)
    if (success) {
      setNewNote("")
      toast({ title: "Success", description: "Note added." })
    }
  }

  const handleEditNote = (note: Note) => {
    setEditingNoteId(note.id)
    setEditingText(note.text)
  }

  const handleSaveEdit = async () => {
    if (!editingNoteId || !editingText.trim()) return
    const updatedNotes = notes.map((note) =>
      note.id === editingNoteId ? { ...note, text: editingText.trim(), timestamp: new Date().toISOString() } : note,
    )
    const success = await handleUpdateNotes(updatedNotes)
    if (success) {
      setEditingNoteId(null)
      setEditingText("")
      toast({ title: "Success", description: "Note updated." })
    }
  }

  const handleDeleteNote = async (noteId: string) => {
    if (!window.confirm("Are you sure you want to delete this note?")) return
    const updatedNotes = notes.filter((note) => note.id !== noteId)
    const success = await handleUpdateNotes(updatedNotes)
    if (success) toast({ title: "Success", description: "Note deleted." })
  }

  const ITEMS_PER_PAGE = 20

  useEffect(() => {
    setApplications(initialApplications.slice(0, ITEMS_PER_PAGE))
    setHasMore(initialApplications.length > ITEMS_PER_PAGE)
  }, [initialApplications])

  const loadMoreApplications = useCallback(async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      const res = await fetch(`/api/merchant-applications?page=${page + 1}&limit=${ITEMS_PER_PAGE}`)
      const data = await res.json()
      if (data.length < ITEMS_PER_PAGE) setHasMore(false)
      setApplications((prev) => [...prev, ...data])
      setPage((prev) => prev + 1)
    } catch (error) {
      console.error("Error loading more applications:", error)
    } finally {
      setLoadingMore(false)
    }
  }, [page, loadingMore, hasMore])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) loadMoreApplications()
      },
      { threshold: 1.0 },
    )
    const sentinel = document.getElementById("scroll-sentinel")
    if (sentinel) observer.observe(sentinel)
    return () => {
      if (sentinel) observer.unobserve(sentinel)
    }
  }, [loadMoreApplications, hasMore, loadingMore])

  const sanitize = (str: string) => str.replace(/[/\\?%*:|"<>]/g, "-")

  const getFileExtension = (url: string) => {
    const match = url.match(/\.\w+$/)
    return match ? match[0] : ""
  }

  const exportToCsv = () => {
    if (filteredApplications.length === 0) return

    const headers = Object.keys(filteredApplications[0])
    const csvRows = [
      headers.join(","),
      ...filteredApplications.map((row) =>
        headers
          .map((fieldName) => {
            const value = row[fieldName]
            const escaped = ("" + (value === null || value === undefined ? "" : value)).replace(/"/g, '""')
            return `"${escaped}"`
          })
          .join(","),
      ),
    ]

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", "lumino-merchant-applications.csv")
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const deleteApplication = async (id: string) => {
    try {
      const res = await fetch(`/api/delete-merchant-application`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })

      if (!res.ok) throw new Error("Failed to delete")

      // Remove from local state instead of full reload
      setApplications((prev) => prev.filter((app) => app.id !== id))
    } catch (error) {
      console.error("Error deleting application:", error)
      alert("An error occurred while deleting.")
    }
  }

  const refreshApplications = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/merchant-applications")
      const data = await res.json()
      setApplications(data.slice(0, ITEMS_PER_PAGE))
      setPage(1)
      setHasMore(data.length > ITEMS_PER_PAGE)
    } catch (error) {
      console.error("Error refreshing applications:", error)
      alert("Failed to refresh applications.")
    } finally {
      setTimeout(() => setLoading(false), 500)
    }
  }

  const handleCopyLink = (app: Application) => {
    if (!app.id) return

    const link = `https://apply.golumino.com/?id=${app.id}`
    navigator.clipboard
      .writeText(link)
      .then(() => {
        toast({
          title: "Copied!",
          description: "Invite link copied to clipboard",
        })
      })
      .catch(() => {
        toast({
          title: "Error",
          description: "Failed to copy link",
          variant: "destructive",
        })
      })
  }

  const downloadAllFiles = async (app: Application) => {
    const files = []

    // Collect all file URLs from uploads
    if (app.uploads && typeof app.uploads === "object") {
      Object.entries(app.uploads).forEach(([key, upload]: [string, any]) => {
        if (upload?.file_url) {
          files.push({
            url: upload.file_url,
            name: `${sanitize(app.dba_name || "Unknown")} - ${key}${getFileExtension(upload.file_url)}`,
          })
        }
      })
    }

    if (files.length === 0) {
      toast({
        title: "No Files",
        description: "No files found for this application",
        variant: "destructive",
      })
      return
    }

    // Download each file
    for (const file of files) {
      try {
        const response = await fetch(
          `/api/download?url=${encodeURIComponent(file.url)}&filename=${encodeURIComponent(file.name)}`,
        )
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = file.name
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } catch (error) {
        console.error(`Failed to download ${file.name}:`, error)
      }
    }
  }

  const handleResendInvitation = async (app: Application) => {
    if (!app.id || !app.merchant_email) return

    try {
      const response = await fetch("/api/send-merchant-invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          applicationId: app.id,
          merchantEmail: app.merchant_email,
          agentEmail: app.agent_email,
          dbaNme: app.dba_name,
        }),
      })

      if (response.ok) {
        toast({
          title: "Invitation Resent",
          description: `Invitation email sent to ${app.merchant_email}`,
        })
      } else {
        throw new Error("Failed to resend invitation")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to resend invitation email",
        variant: "destructive",
      })
    }
  }

  const filteredApplications = applications.filter((app) => {
    const query = searchTerm.toLowerCase().trim()
    if (!query) return true

    // Date range filter from dedicated inputs
    const appDate = new Date(app.created_at).toISOString().split("T")[0]
    if (startDate && appDate < startDate) return false
    if (endDate && appDate > endDate) return false

    const tokens = query.match(/(?:[^\s"]+|"[^"]*")+/g) || []

    return tokens.every((token) => {
      let isNegated = false
      if (token.startsWith("!")) {
        isNegated = true
        token = token.substring(1)
      }

      const match = token.match(/^([\w_]+):(.*)/)
      let result = false

      if (match) {
        const key = match[1]
        const value = match[2].replace(/"/g, "")

        switch (key) {
          case "name":
            result = (app.dba_name || "").toLowerCase().includes(value)
            break
          case "terminal":
            result = (app.terminals || []).some((t: any) => (t.name || "").toLowerCase().includes(value))
            break
          case "legal_name":
            result = (app.legal_name || "").toLowerCase().includes(value)
            break
          case "email":
            result = (app.dba_email || "").toLowerCase().includes(value)
            break
          case "phone":
            result = (app.dba_phone || "").toLowerCase().includes(value)
            break
          case "address":
            result = searchAllAddresses(app, value)
            break
          case "status":
            result = (app.status || "").toLowerCase().includes(value)
            break
          case "agent":
            const agentIdentifier = app.agent_name || extractUsername(app.agent_email) || "direct"
            result = agentIdentifier.toLowerCase().includes(value)
            break
          case "id":
            result = (app.id || "").toLowerCase() === value
            break
          case "notes":
            result = (app.notes || []).some((note: Note) => note.text.toLowerCase().includes(value))
            break
          case "principals":
            result = getPrincipalData(app.principals, "name").includes(value)
            break
          case "volume":
            result = evaluateNumericQuery(app.monthly_volume, value)
            break
          case "avg_ticket":
            result = evaluateNumericQuery(app.average_ticket, value)
            break
          case "high_ticket":
            result = evaluateNumericQuery(app.highest_ticket, value)
            break
          case "equity":
            try {
              const principals = typeof app.principals === "string" ? JSON.parse(app.principals) : app.principals
              result = (principals || []).some((p: any) => evaluateNumericQuery(p.equity, value))
            } catch {
              result = false
            }
            break
          case "created":
            result = evaluateDateQuery(app.created_at, value)
            break
          case "has":
            if (value === "notes") result = (app.notes || []).length > 0
            if (value === "uploads") result = Object.keys(app.uploads || {}).length > 0
            break
          case "missing":
            const aliases: Record<string, string> = {
              name: "dba_name",
              legal_name: "legal_name",
              business: "business_type",
              email: "dba_email",
              phone: "dba_phone",
              notes: "notes",
              agent: "agent_email",
            }

            const field = aliases[value] || value

            if (value === "notes") {
              result = !(app.notes || []).length
            } else if (value === "agent") {
              result = !app.agent_name && !app.agent_email
            } else {
              result = !(app as Record<string, unknown>)[field]
            }
            break
          default:
            result = false
        }
      } else {
        // General search across multiple fields
        const generalValue = token.replace(/"/g, "")
        result = [
          app.dba_name,
          app.legal_name,
          app.dba_email,
          app.business_type,
          app.agent_name || extractUsername(app.agent_email) || "direct",
          getPrincipalData(app.principals, "name"),
          (app.terminals || []).map((t: any) => t.name).join(" "),
        ].some((field) => (field || "").toLowerCase().includes(generalValue))
      }

      return isNegated ? !result : result
    })
  })

  const AreYouSure = () => (
    <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Are you sure?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-700">
          This will permanently delete the application for <strong>{appToDelete?.dba_name}</strong>. This action cannot
          be undone.
        </p>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" onClick={() => setDeleteDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={async () => {
              if (!appToDelete) return
              await deleteApplication(appToDelete.id)
              setDeleteDialogOpen(false)
              setAppToDelete(null)
            }}
          >
            Delete
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )

  // Add status badge helper
  const getStatusBadge = (status: string) => {
    const statusColors = {
      invited: "bg-blue-100 text-blue-800",
      submitted: "bg-green-100 text-green-800",
      pending: "bg-yellow-100 text-yellow-800",
      approved: "bg-green-100 text-green-800",
      rejected: "bg-red-100 text-red-800",
    }

    return (
      <span
        className={`px-2 py-1 text-xs font-medium rounded-full ${
          statusColors[status as keyof typeof statusColors] || "bg-gray-100 text-gray-800"
        }`}
      >
        {status || "Unknown"}
      </span>
    )
  }

  function extractUsername(email: string | null) {
    if (!email || typeof email !== "string") return ""
    const atIndex = email.trim().indexOf("@")
    return atIndex === -1 ? "" : email.substring(0, atIndex)
  }

  // Search suggestion logic
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchTerm(value)

    const lastChar = value.slice(-1)
    const lastWord = value.split(" ").pop() || ""

    if (lastChar === "/" || lastWord.startsWith("/")) {
      const query = lastWord.startsWith("/") ? lastWord.substring(1) : ""
      setSuggestions(SEARCH_PREFIXES.filter((p) => p.prefix.toLowerCase().includes(query.toLowerCase())))
      setShowSuggestions(true)
      setActiveSuggestionIndex(0)
    } else {
      setShowSuggestions(false)
    }
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showSuggestions) {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setActiveSuggestionIndex((prev) => (prev + 1) % suggestions.length)
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setActiveSuggestionIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length)
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault()
        if (suggestions[activeSuggestionIndex]) {
          handleSelectSuggestion(suggestions[activeSuggestionIndex].prefix)
        }
      } else if (e.key === "Escape") {
        setShowSuggestions(false)
      }
    }
  }

  const handleSelectSuggestion = (prefix: string) => {
    const terms = searchTerm.split(" ")
    terms.pop() // remove the current term being typed
    terms.push(prefix)
    setSearchTerm(terms.join(" "))
    setShowSuggestions(false)
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  return (
    <>
      <div className="bg-white p-6 rounded-lg shadow">
        {/* Mobile-responsive header */}
        <div className="space-y-4 mb-4">
          {/* Search bar - full width on mobile */}
          <div className="w-full">
            <div className="relative" ref={searchContainerRef}>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Input
                      placeholder="Search or type / for commands..."
                      value={searchTerm}
                      onChange={handleSearchChange}
                      onKeyDown={handleSearchKeyDown}
                      className="pl-10 w-full"
                    />
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-lg text-sm leading-relaxed">
                    {/* Your existing tooltip content */}
                    <p>
                      <b>Pro Tip 💡:</b> Use smart search to filter by any field (Name, Email, Status, Business Type, or
                      Account Manager).
                    </p>
                    <ul className="mt-2 space-y-1">
                      <li className="flex items-start gap-2">
                        <span className="inline-flex px-2 py-0.5 rounded text-xs font-bold bg-yellow-100 text-slate-800">
                          john
                        </span>
                        <span>→ matches anything with "john"</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="inline-flex px-2 py-0.5 rounded text-xs font-bold bg-yellow-100 text-slate-800">
                          !john
                        </span>
                        <span>→ excludes anything with "john"</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="inline-flex px-2 py-0.5 rounded text-xs font-bold bg-yellow-100 text-slate-800">
                          agent:bond
                        </span>
                        <span>→ filter by Account Manager username (from email prefix)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="inline-flex px-2 py-0.5 rounded text-xs font-bold bg-yellow-100 text-slate-800">
                          email:test
                        </span>
                        <span>→ searches in the Email field only</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="inline-flex px-2 py-0.5 rounded text-xs font-bold bg-yellow-100 text-slate-800">
                          status:pending
                        </span>
                        <span>→ filters by application status</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="inline-flex px-2 py-0.5 rounded text-xs font-bold bg-yellow-100 text-slate-800">
                          missing:email
                        </span>
                        <span>→ finds apps missing Email</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="inline-flex px-2 py-0.5 rounded text-xs font-bold bg-yellow-100 text-slate-800">
                          has:uploads
                        </span>
                        <span>→ finds apps with uploaded files</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="inline-flex px-2 py-0.5 rounded text-xs font-bold bg-yellow-100 text-slate-800">
                          volume:&gt;10000
                        </span>
                        <span>→ filter by Monthly Volume (supports &gt;, &lt;, =)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="inline-flex px-2 py-0.5 rounded text-xs font-bold bg-yellow-100 text-slate-800">
                          created:&gt;2025-01-01
                        </span>
                        <span>→ filter by Created Date (supports &gt;, &lt;, exact date)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="inline-flex px-2 py-0.5 rounded text-xs font-bold bg-yellow-100 text-slate-800">
                          missing:business & !test
                        </span>
                        <span>→ combine filters with "&" (ampersand)</span>
                      </li>
                    </ul>
                    <p className="mt-3 text-xs text-gray-500">
                      Tip: Type <b>/</b> for quick shortcuts like <b>/name</b>, <b>/status</b>, <b>/agent</b>, etc.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-y-auto">
                  <ul className="py-1">
                    {suggestions.map((s, index) => (
                      <li
                        key={s.prefix}
                        className={`px-3 py-2 cursor-pointer text-sm ${
                          index === activeSuggestionIndex ? "bg-gray-100" : "hover:bg-gray-50"
                        }`}
                        onMouseDown={(e) => {
                          e.preventDefault()
                          handleSelectSuggestion(s.prefix)
                        }}
                      >
                        <span className="font-medium">{s.prefix}</span>
                        <span className="text-gray-500 ml-2">{s.description}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Date filters and action buttons - responsive layout */}
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            {/* Date filters with info tooltip */}
            <div className="flex items-center gap-2 flex-wrap">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-[140px] text-sm"
                placeholder="Start Date"
              />
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-[140px] text-sm"
                placeholder="End Date"
              />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-gray-500 flex-shrink-0" />
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Filter results by creation date range.</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                onClick={refreshApplications}
                disabled={loading}
                className="flex-shrink-0 bg-transparent"
              >
                <RotateCcw className={`mr-2 h-4 w-4 ${loading ? "animate-reverse-spin" : ""}`} />
                <span className="hidden sm:inline">Refresh</span>
                <span className="sm:hidden">Refresh</span>
              </Button>
              <Button onClick={exportToCsv} disabled={filteredApplications.length === 0} className="flex-shrink-0">
                <Download className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Export CSV</span>
                <span className="sm:hidden">Export</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Results count */}
        <div className="text-sm text-gray-500 mb-4">
          Showing {filteredApplications.length} of {initialApplications.length} applications
          {hasMore && " (loading more as you scroll)"}
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>DBA Name</TableHead>
                <TableHead>DBA Email</TableHead>
                <TableHead>Account Manager</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredApplications.map((app) => (
                <TableRow key={app.id}>
                  <TableCell>{new Date(app.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>{app.dba_name || "-"}</TableCell>
                  <TableCell>{app.dba_email || "-"}</TableCell>
                  <TableCell>
                    {app.agent_name || extractUsername(app.agent_email) || app.agent_email || "Unknown"}
                  </TableCell>
                  <TableCell>{getStatusBadge(app.status)}</TableCell>
                  <TableCell className="text-right">
                    <Dialog
                      onOpenChange={(open) => {
                        if (!open) {
                          setSelectedApplication(null)
                          setEditingNoteId(null) // Reset editing state on close
                        }
                      }}
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DialogTrigger asChild>
                            <DropdownMenuItem onSelect={() => setSelectedApplication(app)}>
                              <FileText className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                          </DialogTrigger>
                          <DropdownMenuItem onSelect={() => handleResendInvitation(app)}>
                            <Mail className="mr-2 h-4 w-4" />
                            Resend Invitation Email
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => handleCopyLink(app)}>
                            <ClipboardCopy className="mr-2 h-4 w-4" />
                            Copy Invite Link
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => downloadAllFiles(app)}>
                            <FolderDown className="mr-2 h-4 w-4" />
                            Download All Files
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => {
                              setAppToDelete(app)
                              setDeleteDialogOpen(true)
                            }}
                            className="text-red-600"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Remove Application
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      {selectedApplication && (
                        <DialogContent className="max-w-4xl">
                          <div className="flex flex-col gap-2">
                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center">
                              <DialogHeader className="p-0">
                                <DialogTitle className="text-xl font-semibold">
                                  Application Details: {selectedApplication.dba_name || "Unknown"}
                                </DialogTitle>
                              </DialogHeader>
                            </div>

                            {/* Submission Info */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-600">
                              <div>
                                <span className="block">
                                  Submitted on: {new Date(selectedApplication.created_at).toLocaleString()}
                                </span>
                                <span className="block">
                                  Account Manager:{" "}
                                  {selectedApplication.agent_name ||
                                    extractUsername(selectedApplication.agent_email) ||
                                    "DIRECT"}
                                </span>
                              </div>
                            </div>
                          </div>
                          <Tabs defaultValue="details" className="w-full">
                            <TabsList className="grid w-full grid-cols-3">
                              <TabsTrigger value="details">Application Details</TabsTrigger>
                              <TabsTrigger value="files">Files</TabsTrigger>
                              <TabsTrigger value="notes">Notes</TabsTrigger>
                            </TabsList>

                            <TabsContent value="details" className="max-h-[70vh] overflow-y-auto p-4">
                              <div className="space-y-6">
                                {/* Merchant Information */}
                                <div>
                                  <h3 className="text-lg font-semibold mb-3">Merchant Information</h3>
                                  <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                      <strong>DBA Name:</strong> {selectedApplication.dba_name || "-"}
                                    </div>
                                    <div>
                                      <strong>DBA Email:</strong> {selectedApplication.dba_email || "-"}
                                    </div>
                                    <div>
                                      <strong>Legal Name:</strong> {selectedApplication.legal_name || "-"}
                                    </div>
                                    <div>
                                      <strong>Federal Tax ID:</strong>
                                      <SensitiveField value={selectedApplication.federal_tax_id} maskPattern="ssn" />
                                    </div>
                                    <div>
                                      <strong>Phone:</strong>{" "}
                                      <PhoneNumber value={selectedApplication.dba_phone || null} />
                                    </div>
                                    <div>
                                      <strong>Website:</strong> {selectedApplication.website_url || "-"}
                                    </div>
                                    <div>
                                      <strong>Business Type:</strong> {selectedApplication.business_type || "-"}
                                    </div>
                                    <div>
                                      <strong>Ownership Type:</strong>{" "}
                                      {autoTitleCase(selectedApplication.ownership_type) || "-"}
                                    </div>
                                    <div>
                                      <strong>Paperless Statements:</strong>{" "}
                                      {selectedApplication.paperless_statements ? "Yes" : "No"}
                                    </div>
                                  </div>
                                </div>

                                {/* Terminals */}
                                <div>
                                  <h3 className="text-lg font-semibold mb-3">Terminals</h3>
                                  <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div className="col-span-2">
                                      {selectedApplication.terminals && selectedApplication.terminals.length > 0 ? (
                                        <ul className="list-disc list-inside">
                                          {selectedApplication.terminals.map((t: any, i: number) => (
                                            <li key={i}>
                                              {t.name}{" "}
                                              {t.price === 0
                                                ? "(FREE)"
                                                : t.price > 0
                                                  ? `($${Number(t.price).toFixed(2)})`
                                                  : ""}
                                              {t.quantity && t.quantity > 1 && (
                                                <span className="ml-1 font-medium text-blue-600">x {t.quantity}</span>
                                              )}
                                            </li>
                                          ))}
                                        </ul>
                                      ) : (
                                        "-"
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* DBA Address */}
                                <div>
                                  <h3 className="text-lg font-semibold mb-3">DBA Address</h3>
                                  <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                      <strong>Address Line 1:</strong> {selectedApplication.dba_address_line1 || "-"}
                                    </div>
                                    <div>
                                      <strong>Address Line 2:</strong> {selectedApplication.dba_address_line2 || "-"}
                                    </div>
                                    <div>
                                      <strong>City:</strong> {selectedApplication.dba_city || "-"}
                                    </div>
                                    <div>
                                      <strong>State:</strong> {selectedApplication.dba_state || "-"}
                                    </div>
                                    <div>
                                      <strong>ZIP Code:</strong> {selectedApplication.dba_zip || "-"}
                                    </div>
                                    <div>
                                      <strong>ZIP Extended:</strong> {selectedApplication.dba_zip_extended || "-"}
                                    </div>
                                  </div>
                                </div>

                                {/* Legal Address (if different) */}
                                {selectedApplication.legal_differs && (
                                  <div>
                                    <h3 className="text-lg font-semibold mb-3">Legal Address</h3>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                      <div>
                                        <strong>Address Line 1:</strong>{" "}
                                        {selectedApplication.legal_address_line1 || "-"}
                                      </div>
                                      <div>
                                        <strong>Address Line 2:</strong>{" "}
                                        {selectedApplication.legal_address_line2 || "-"}
                                      </div>
                                      <div>
                                        <strong>City:</strong> {selectedApplication.legal_city || "-"}
                                      </div>
                                      <div>
                                        <strong>State:</strong> {selectedApplication.legal_state || "-"}
                                      </div>
                                      <div>
                                        <strong>ZIP Code:</strong> {selectedApplication.legal_zip || "-"}
                                      </div>
                                      <div>
                                        <strong>ZIP Extended:</strong> {selectedApplication.legal_zip_extended || "-"}
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Business Profile */}
                                <div>
                                  <h3 className="text-lg font-semibold mb-3">Business Profile</h3>
                                  <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                      <strong>Monthly Volume:</strong> $
                                      {selectedApplication.monthly_volume?.toLocaleString() || "-"}
                                    </div>
                                    <div>
                                      <strong>Average Ticket:</strong> $
                                      {selectedApplication.average_ticket?.toLocaleString() || "-"}
                                    </div>
                                    <div>
                                      <strong>Highest Ticket:</strong> $
                                      {selectedApplication.highest_ticket?.toLocaleString() || "-"}
                                    </div>
                                    <div>
                                      <strong>Card Swiped %:</strong> {selectedApplication.pct_card_swiped || "-"}%
                                    </div>
                                    <div>
                                      <strong>Manual Imprint %:</strong> {selectedApplication.pct_manual_imprint || "-"}
                                      %
                                    </div>
                                    <div>
                                      <strong>Manual No Imprint %:</strong>{" "}
                                      {selectedApplication.pct_manual_no_imprint || "-"}%
                                    </div>
                                    <div>
                                      <strong>Refund Policy:</strong> {selectedApplication.refund_policy || "-"}
                                    </div>
                                    <div>
                                      <strong>Previous Processor:</strong>{" "}
                                      {selectedApplication.previous_processor || "-"}
                                    </div>
                                    <div className="col-span-2">
                                      <strong>Reason for Termination:</strong>{" "}
                                      {selectedApplication.reason_for_termination || "-"}
                                    </div>
                                  </div>
                                </div>

                                {/* Seasonal & Third Party Information */}
                                <div>
                                  <h3 className="text-lg font-semibold mb-3">Additional Business Information</h3>
                                  <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                      <strong>Seasonal Business:</strong>{" "}
                                      {selectedApplication.seasonal_business ? "Yes" : "No"}
                                    </div>
                                    {selectedApplication.seasonal_business && (
                                      <div>
                                        <strong>Seasonal Months:</strong> {(() => {
                                          const months = selectedApplication.seasonal_months
                                          if (!months) return "-"
                                          if (typeof months === "string") {
                                            if (months.startsWith("[") && months.endsWith("]")) {
                                              try {
                                                const parsed = JSON.parse(months)
                                                return Array.isArray(parsed) ? parsed.join(", ") : months
                                              } catch {
                                                return months
                                              }
                                            }
                                            if (months.length > 3 && !months.includes(" ") && !months.includes(",")) {
                                              const monthAbbrevs = [
                                                "Jan",
                                                "Feb",
                                                "Mar",
                                                "Apr",
                                                "May",
                                                "Jun",
                                                "Jul",
                                                "Aug",
                                                "Sep",
                                                "Oct",
                                                "Nov",
                                                "Dec",
                                              ]
                                              let result = months
                                              monthAbbrevs.forEach((month) => {
                                                result = result.replace(new RegExp(month, "g"), `, ${month}`)
                                              })
                                              return result.replace(/^,\s*/, "").replace(/,\s*,/g, ",")
                                            }
                                            return months
                                          }
                                          if (Array.isArray(months)) {
                                            return months.join(", ")
                                          }
                                          return String(months)
                                        })()}
                                      </div>
                                    )}
                                    <div>
                                      <strong>Uses Fulfillment House:</strong>{" "}
                                      {selectedApplication.uses_fulfillment_house ? "Yes" : "No"}
                                    </div>
                                    <div>
                                      <strong>Uses Third Parties:</strong>{" "}
                                      {selectedApplication.uses_third_parties ? "Yes" : "No"}
                                    </div>
                                    {selectedApplication.uses_third_parties && (
                                      <div className="col-span-2">
                                        <strong>Third Parties List:</strong>{" "}
                                        {selectedApplication.third_parties_list || "-"}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Banking Information */}
                                <div>
                                  <h3 className="text-lg font-semibold mb-3">Banking Information</h3>
                                  <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                      <strong>Bank Name:</strong> {selectedApplication.bank_name || "-"}
                                    </div>
                                    <div>
                                      <strong>Routing Number:</strong>
                                      <SensitiveField
                                        value={selectedApplication.routing_number}
                                        maskPattern="routing"
                                      />
                                    </div>
                                    <div>
                                      <strong>Account Number:</strong>
                                      <SensitiveField
                                        value={selectedApplication.account_number}
                                        maskPattern="account"
                                      />
                                    </div>
                                    <div>
                                      <strong>Batch Time:</strong> {selectedApplication.batch_time || "-"}
                                    </div>
                                  </div>
                                </div>

                                {/* Principals */}
                                {selectedApplication.principals && (
                                  <div>
                                    <h3 className="text-lg font-semibold mb-3">Principals</h3>
                                    {(() => {
                                      try {
                                        const principals =
                                          typeof selectedApplication.principals === "string"
                                            ? JSON.parse(selectedApplication.principals)
                                            : selectedApplication.principals

                                        if (Array.isArray(principals)) {
                                          return principals.map((principal: any, index: number) => (
                                            <div key={index} className="border rounded p-3 mb-3">
                                              <h4 className="font-medium mb-2">Principal {index + 1}</h4>
                                              <div className="grid grid-cols-2 gap-4 text-sm">
                                                <div>
                                                  <strong>Name:</strong> {principal.firstName} {principal.lastName}
                                                </div>
                                                <div>
                                                  <strong>Email:</strong> {principal.email || "-"}
                                                </div>
                                                <div>
                                                  <strong>Position:</strong> {principal.position || "-"}
                                                </div>
                                                <div>
                                                  <strong>Equity:</strong> {principal.equity || "-"}%
                                                </div>
                                                <div>
                                                  <strong>Phone:</strong>{" "}
                                                  <PhoneNumber value={principal.phone || null} />
                                                </div>
                                                <div>
                                                  <strong>Address:</strong> {(() => {
                                                    const addressParts = [
                                                      principal.addressLine1,
                                                      principal.addressLine2,
                                                      [principal.city, principal.state, principal.zip]
                                                        .filter(Boolean)
                                                        .join(", "),
                                                    ].filter(Boolean)
                                                    return addressParts.length > 0 ? addressParts.join(", ") : "-"
                                                  })()}
                                                </div>
                                                <div>
                                                  <strong>City:</strong> {principal.city || "-"}
                                                </div>
                                                <div>
                                                  <strong>State:</strong> {principal.state || "-"}
                                                </div>
                                                <div>
                                                  <strong>ZIP:</strong> {principal.zip || "-"}
                                                </div>
                                                <div>
                                                  <strong>SSN:</strong>
                                                  <SensitiveField value={principal.ssn} maskPattern="ssn" />
                                                </div>
                                                <div>
                                                  <strong>Date of Birth:</strong> {principal.dob || "-"}
                                                </div>
                                              </div>
                                            </div>
                                          ))
                                        }
                                      } catch (error) {
                                        console.error("Error parsing principals:", error)
                                        return <p className="text-gray-500">Error loading principals data</p>
                                      }
                                      return <p className="text-gray-500">No principals data available</p>
                                    })()}
                                  </div>
                                )}
                              </div>
                            </TabsContent>

                            <TabsContent value="files" className="max-h-[70vh] overflow-y-auto p-4">
                              <div className="space-y-4">
                                <h3 className="text-lg font-semibold sticky top-0 bg-white pb-2">Uploaded Documents</h3>
                                {selectedApplication.uploads && typeof selectedApplication.uploads === "object" ? (
                                  <div className="grid gap-4">
                                    {Object.entries(selectedApplication.uploads).map(([key, upload]: [string, any]) => (
                                      <div key={key} className="flex items-center justify-between p-3 border rounded">
                                        <div>
                                          <p className="font-medium">
                                            {key.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase())}
                                          </p>
                                          <p className="text-sm text-gray-500">
                                            {upload?.uploadType === "url" ? "URL Link" : "File Upload"}
                                          </p>
                                        </div>
                                        {upload?.file_url && (
                                          <Button asChild variant="outline" size="sm">
                                            <a href={upload.file_url} target="_blank" rel="noopener noreferrer">
                                              <ExternalLink className="h-4 w-4 mr-2" />
                                              View
                                            </a>
                                          </Button>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-gray-500">No files uploaded</p>
                                )}
                              </div>
                            </TabsContent>

                            <TabsContent value="notes" className="max-h-[70vh] overflow-y-auto p-4">
                              <div className="space-y-6">
                                <div>
                                  <h3 className="text-lg font-semibold mb-3">Internal Notes</h3>
                                  <div className="space-y-2">
                                    <Textarea
                                      placeholder="Add a new note..."
                                      value={newNote}
                                      onChange={(e) => setNewNote(e.target.value)}
                                      rows={3}
                                    />
                                    <Button onClick={handleAddNote} disabled={!newNote.trim()}>
                                      Add Note
                                    </Button>
                                  </div>
                                </div>

                                <div className="space-y-4">
                                  {notes.length > 0 ? (
                                    notes
                                      .slice()
                                      .reverse()
                                      .map((note) => (
                                        <div key={note.id} className="border rounded-lg p-3 bg-gray-50">
                                          {editingNoteId === note.id ? (
                                            <div className="space-y-2">
                                              <Textarea
                                                value={editingText}
                                                onChange={(e) => setEditingText(e.target.value)}
                                                rows={3}
                                              />
                                              <div className="flex gap-2">
                                                <Button size="sm" onClick={handleSaveEdit}>
                                                  <Save className="h-4 w-4 mr-2" />
                                                  Save
                                                </Button>
                                                <Button
                                                  size="sm"
                                                  variant="ghost"
                                                  onClick={() => setEditingNoteId(null)}
                                                >
                                                  Cancel
                                                </Button>
                                              </div>
                                            </div>
                                          ) : (
                                            <>
                                              <p className="text-sm text-gray-800 whitespace-pre-wrap">{note.text}</p>
                                              <div className="flex justify-between items-center mt-2 pt-2 border-t">
                                                <p className="text-xs text-gray-500">
                                                  <strong>{note.userName}</strong> on{" "}
                                                  {new Date(note.timestamp).toLocaleString()}
                                                </p>
                                                <div className="flex gap-2">
                                                  {user?.primaryEmailAddress?.emailAddress === note.userEmail && (
                                                    <Button
                                                      variant="ghost"
                                                      size="sm"
                                                      onClick={() => handleEditNote(note)}
                                                    >
                                                      <Edit className="h-3 w-3 mr-1" />
                                                      Edit
                                                    </Button>
                                                  )}
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-red-500 hover:text-red-600"
                                                    onClick={() => handleDeleteNote(note.id)}
                                                  >
                                                    <Trash2 className="h-3 w-3 mr-1" />
                                                    Delete
                                                  </Button>
                                                </div>
                                              </div>
                                            </>
                                          )}
                                        </div>
                                      ))
                                  ) : (
                                    <div className="text-center text-gray-500 py-8">
                                      <MessageSquare className="mx-auto h-8 w-8 mb-2" />
                                      <p>No notes yet.</p>
                                      <p className="text-sm">Be the first to add one!</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </TabsContent>
                          </Tabs>
                        </DialogContent>
                      )}
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Infinite scroll sentinel */}
          <div id="scroll-sentinel" className="h-10 flex items-center justify-center">
            {loadingMore && (
              <div className="flex items-center gap-2 text-gray-500">
                <RotateCcw className="h-4 w-4 animate-spin" />
                Loading more applications...
              </div>
            )}
            {!hasMore && applications.length > ITEMS_PER_PAGE && (
              <div className="text-gray-500 text-sm">All applications loaded ({applications.length} total)</div>
            )}
          </div>
        </div>
      </div>
      <AreYouSure />
    </>
  )
}
