"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Plus,
  MoreVertical,
  ExternalLink,
  Mail,
  Download,
  Trash2,
  Search,
  AlertCircle,
  CheckCircle,
  Clock,
  FileText,
  XCircle,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

type Application = {
  id: string
  dba_name: string | null
  legal_name: string | null
  status: string | null
  agent_name: string | null
  agent_email: string | null
  merchant_email: string | null
  created_at: string
  updated_at: string | null
  federal_tax_id: string | null
  uploads?: Record<string, any>
  [key: string]: any
}

type StatusFilter = "all" | "drafted" | "invited" | "submitted" | "approved" | "rejected" | "on_hold"

export default function ApplicationCardsManager({ applications }: { applications: Application[] }) {
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [selectedApp, setSelectedApp] = useState<Application | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [appToDelete, setAppToDelete] = useState<Application | null>(null)
  const { toast } = useToast()
  const { user } = useUser()
  const router = useRouter()

  const getStatusColor = (status: string | null): string => {
    const statusLower = (status || "draft").toLowerCase()

    if (statusLower.includes("approved")) return "bg-green-500"
    if (statusLower.includes("draft") || statusLower.includes("invited")) return "bg-orange-500"
    if (statusLower.includes("submitted") || statusLower.includes("signing") || statusLower.includes("pending"))
      return "bg-blue-500"
    if (statusLower.includes("rejected")) return "bg-red-500"
    if (statusLower.includes("hold")) return "bg-red-600"

    return "bg-gray-500"
  }

  const getStatusIcon = (status: string | null) => {
    const statusLower = (status || "draft").toLowerCase()

    if (statusLower.includes("approved")) return <CheckCircle className="h-4 w-4" />
    if (statusLower.includes("draft") || statusLower.includes("invited")) return <FileText className="h-4 w-4" />
    if (statusLower.includes("submitted") || statusLower.includes("signing") || statusLower.includes("pending"))
      return <Clock className="h-4 w-4" />
    if (statusLower.includes("rejected")) return <XCircle className="h-4 w-4" />
    if (statusLower.includes("hold")) return <AlertCircle className="h-4 w-4" />

    return <FileText className="h-4 w-4" />
  }

  const formatStatus = (status: string | null): string => {
    if (!status) return "DRAFTED"
    return status.toUpperCase().replace(/_/g, " ")
  }

  const filteredApplications = applications.filter((app) => {
    // Status filter
    if (statusFilter !== "all") {
      const appStatus = (app.status || "draft").toLowerCase()
      if (statusFilter === "drafted" && !appStatus.includes("draft") && !appStatus.includes("invited")) return false
      if (statusFilter === "invited" && !appStatus.includes("invited")) return false
      if (statusFilter === "submitted" && !appStatus.includes("submitted") && !appStatus.includes("pending"))
        return false
      if (statusFilter === "approved" && !appStatus.includes("approved")) return false
      if (statusFilter === "rejected" && !appStatus.includes("rejected")) return false
      if (statusFilter === "on_hold" && !appStatus.includes("hold")) return false
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        app.dba_name?.toLowerCase().includes(query) ||
        app.legal_name?.toLowerCase().includes(query) ||
        app.id?.toLowerCase().includes(query) ||
        app.agent_name?.toLowerCase().includes(query) ||
        app.merchant_email?.toLowerCase().includes(query) ||
        app.federal_tax_id?.toLowerCase().includes(query)
      )
    }

    return true
  })

  const handleCreateNew = async () => {
    try {
      const response = await fetch("/api/generate-merchant-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_email: user?.primaryEmailAddress?.emailAddress,
          agent_name: user?.fullName || "Agent",
          merchant_email: null,
        }),
      })

      const result = await response.json()
      if (!result.success) throw new Error(result.error || "Failed to create application")

      const inviteLink = `${window.location.origin}/?id=${result.inviteId}`

      toast({
        title: "Application Created",
        description: "Opening new application form...",
      })

      // Open in new tab
      window.open(inviteLink, "_blank")

      // Refresh the list
      setTimeout(() => window.location.reload(), 1000)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create new application",
        variant: "destructive",
      })
    }
  }

  const handleOpenApplication = (app: Application) => {
    const link = `${window.location.origin}/?id=${app.id}`
    window.open(link, "_blank")
  }

  const handleCopyLink = (app: Application) => {
    const link = `${window.location.origin}/?id=${app.id}`
    navigator.clipboard.writeText(link).then(() => {
      toast({
        title: "Link Copied",
        description: "Application link copied to clipboard",
      })
    })
  }

  const handleResendInvite = async (app: Application) => {
    if (!app.merchant_email) {
      toast({
        title: "No Email",
        description: "This application doesn't have a merchant email",
        variant: "destructive",
      })
      return
    }

    try {
      const response = await fetch("/api/send-merchant-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId: app.id,
          merchantEmail: app.merchant_email,
          agentEmail: app.agent_email,
          dbaName: app.dba_name,
        }),
      })

      if (response.ok) {
        toast({
          title: "Invitation Sent",
          description: `Email sent to ${app.merchant_email}`,
        })
      } else {
        throw new Error("Failed to send invitation")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send invitation",
        variant: "destructive",
      })
    }
  }

  const handleDownloadFiles = async (app: Application) => {
    if (!app.uploads || Object.keys(app.uploads).length === 0) {
      toast({
        title: "No Files",
        description: "This application has no uploaded files",
        variant: "destructive",
      })
      return
    }

    for (const [key, upload] of Object.entries(app.uploads)) {
      if (upload?.file_url) {
        try {
          const fileName = `${app.dba_name || "Application"} - ${key}`
          const response = await fetch(
            `/api/download?url=${encodeURIComponent(upload.file_url)}&filename=${encodeURIComponent(fileName)}`,
          )
          const blob = await response.blob()
          const url = window.URL.createObjectURL(blob)
          const a = document.createElement("a")
          a.href = url
          a.download = fileName
          document.body.appendChild(a)
          a.click()
          window.URL.revokeObjectURL(url)
          document.body.removeChild(a)
        } catch (error) {
          console.error(`Failed to download ${key}:`, error)
        }
      }
    }

    toast({
      title: "Download Complete",
      description: "Files downloaded successfully",
    })
  }

  const handleDelete = async () => {
    if (!appToDelete) return

    try {
      const response = await fetch("/api/delete-merchant-application", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: appToDelete.id }),
      })

      if (!response.ok) throw new Error("Failed to delete")

      toast({
        title: "Deleted",
        description: "Application deleted successfully",
      })

      setShowDeleteDialog(false)
      setAppToDelete(null)

      // Refresh
      setTimeout(() => window.location.reload(), 500)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete application",
        variant: "destructive",
      })
    }
  }

  const getFileCount = (app: Application): number => {
    if (!app.uploads) return 0
    return Object.values(app.uploads).filter((u: any) => u?.file_url).length
  }

  return (
    <div className="space-y-6">
      {/* Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search by name, email, ID, or Tax ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <Tabs
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as StatusFilter)}
          className="w-full sm:w-auto"
        >
          <TabsList className="grid w-full grid-cols-3 sm:grid-cols-7">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="drafted">Drafted</TabsTrigger>
            <TabsTrigger value="invited">Invited</TabsTrigger>
            <TabsTrigger value="submitted">Submitted</TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="on_hold">On Hold</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Results Count */}
      <div className="text-sm text-gray-600">
        Showing {filteredApplications.length} of {applications.length} applications
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {/* Create New Card */}
        <Card
          className="border-2 border-dashed border-gray-300 hover:border-gray-400 transition-colors cursor-pointer bg-gray-50 hover:bg-gray-100 flex items-center justify-center min-h-[200px]"
          onClick={handleCreateNew}
        >
          <div className="flex flex-col items-center gap-3 p-6 text-center">
            <div className="rounded-full bg-gray-200 p-4">
              <Plus className="h-8 w-8 text-gray-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Create New</h3>
              <p className="text-sm text-gray-600">Merchant Application</p>
            </div>
          </div>
        </Card>

        {/* Application Cards */}
        {filteredApplications.map((app) => (
          <Card
            key={app.id}
            className="relative hover:shadow-lg transition-shadow cursor-pointer group bg-white"
            onClick={() => handleOpenApplication(app)}
          >
            {/* Status Badge */}
            <div className="absolute top-3 right-3 z-10">
              <Badge className={`${getStatusColor(app.status)} text-white flex items-center gap-1`}>
                {getStatusIcon(app.status)}
                {formatStatus(app.status)}
              </Badge>
            </div>

            {/* Actions Menu */}
            <div className="absolute top-3 left-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button variant="outline" size="icon" className="h-8 w-8 bg-white">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation()
                      handleOpenApplication(app)
                    }}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open Application
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation()
                      handleCopyLink(app)
                    }}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Copy Link
                  </DropdownMenuItem>
                  {app.merchant_email && (
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation()
                        handleResendInvite(app)
                      }}
                    >
                      <Mail className="mr-2 h-4 w-4" />
                      Resend Invite
                    </DropdownMenuItem>
                  )}
                  {getFileCount(app) > 0 && (
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDownloadFiles(app)
                      }}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download Files ({getFileCount(app)})
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    className="text-red-600"
                    onClick={(e) => {
                      e.stopPropagation()
                      setAppToDelete(app)
                      setShowDeleteDialog(true)
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Card Content */}
            <div className="p-6 pt-12">
              <h3 className="font-bold text-lg text-gray-900 mb-2 line-clamp-2">
                {app.dba_name || "Untitled Application"}
              </h3>

              <div className="space-y-2 text-sm text-gray-600">
                {app.legal_name && app.legal_name !== app.dba_name && (
                  <div className="flex items-start gap-2">
                    <span className="font-medium text-gray-500 min-w-[60px]">Legal:</span>
                    <span className="line-clamp-1">{app.legal_name}</span>
                  </div>
                )}

                {app.federal_tax_id && (
                  <div className="flex items-start gap-2">
                    <span className="font-medium text-gray-500 min-w-[60px]">Tax ID:</span>
                    <span>{app.federal_tax_id}</span>
                  </div>
                )}

                <div className="flex items-start gap-2">
                  <span className="font-medium text-gray-500 min-w-[60px]">App ID:</span>
                  <span className="font-mono text-xs line-clamp-1">{app.id.slice(0, 8)}...</span>
                </div>

                {app.agent_name && (
                  <div className="flex items-start gap-2">
                    <span className="font-medium text-gray-500 min-w-[60px]">Agent:</span>
                    <span className="line-clamp-1">{app.agent_name}</span>
                  </div>
                )}

                <div className="flex items-start gap-2">
                  <span className="font-medium text-gray-500 min-w-[60px]">Created:</span>
                  <span>{new Date(app.created_at).toLocaleDateString()}</span>
                </div>

                {getFileCount(app) > 0 && (
                  <div className="flex items-center gap-2 text-blue-600">
                    <Download className="h-3 w-3" />
                    <span>
                      {getFileCount(app)} file{getFileCount(app) !== 1 ? "s" : ""}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {filteredApplications.length === 0 && (
        <div className="text-center py-12">
          <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Applications Found</h3>
          <p className="text-gray-600 mb-4">
            {searchQuery || statusFilter !== "all"
              ? "Try adjusting your search or filters"
              : "Get started by creating your first application"}
          </p>
          {!searchQuery && statusFilter === "all" && (
            <Button onClick={handleCreateNew}>
              <Plus className="mr-2 h-4 w-4" />
              Create New Application
            </Button>
          )}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Application</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the application for{" "}
              <strong>{appToDelete?.dba_name || "this merchant"}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
