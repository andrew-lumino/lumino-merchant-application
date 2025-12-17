"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Copy, Mail, Link, Check, Send } from "lucide-react"

const AVAILABLE_FILE_TYPES = [
  { id: "voided_check", label: "Voided Check" },
  { id: "business_license", label: "Business License" },
  { id: "tax_id", label: "Tax ID Document" },
  { id: "bank_statement", label: "Bank Statement" },
  { id: "processing_statement", label: "Processing Statement" },
  { id: "government_id", label: "Government ID" },
  { id: "articles_of_incorporation", label: "Articles of Incorporation" },
  { id: "other", label: "Other Document" },
]

interface RequestFilesButtonProps {
  applicationId: string
  applicationEmail?: string
  businessName?: string
}

export function RequestFilesButton({ applicationId, applicationEmail, businessName }: RequestFilesButtonProps) {
  const [open, setOpen] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<string[]>([])
  const [generatedLink, setGeneratedLink] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFileToggle = (fileId: string) => {
    setSelectedFiles((prev) => (prev.includes(fileId) ? prev.filter((id) => id !== fileId) : [...prev, fileId]))
  }

  const handleGenerateLink = async () => {
    if (selectedFiles.length === 0) {
      setError("Please select at least one file type to request")
      return
    }

    setIsGenerating(true)
    setError(null)

    try {
      const response = await fetch("/api/file-upload-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId,
          requestedFiles: selectedFiles,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to create upload request")
      }

      const data = await response.json()
      const link = `${window.location.origin}/upload/${data.id}`
      setGeneratedLink(link)
    } catch (err) {
      setError("Failed to generate link. Please try again.")
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCopyLink = async () => {
    if (!generatedLink) return
    await navigator.clipboard.writeText(generatedLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSendEmail = () => {
    if (!generatedLink || !applicationEmail) return
    const subject = encodeURIComponent(`Document Upload Request - ${businessName || "Your Application"}`)
    const body = encodeURIComponent(
      `Hello,\n\nPlease upload the requested documents using the following link:\n\n${generatedLink}\n\nThis link will expire after the documents are submitted.\n\nThank you.`,
    )
    window.open(`mailto:${applicationEmail}?subject=${subject}&body=${body}`)
  }

  const handleClose = () => {
    setOpen(false)
    // Reset state after close animation
    setTimeout(() => {
      setSelectedFiles([])
      setGeneratedLink(null)
      setError(null)
      setCopied(false)
    }, 200)
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => (isOpen ? setOpen(true) : handleClose())}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Send className="w-4 h-4 mr-2" />
          Request Files
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request Files from Client</DialogTitle>
          <DialogDescription>Select the documents you need and generate a secure upload link.</DialogDescription>
        </DialogHeader>

        {!generatedLink ? (
          <>
            <div className="space-y-3 py-4 max-h-64 overflow-y-auto">
              {AVAILABLE_FILE_TYPES.map((fileType) => (
                <div key={fileType.id} className="flex items-center space-x-3">
                  <Checkbox
                    id={fileType.id}
                    checked={selectedFiles.includes(fileType.id)}
                    onCheckedChange={() => handleFileToggle(fileType.id)}
                  />
                  <Label htmlFor={fileType.id} className="text-sm font-normal cursor-pointer">
                    {fileType.label}
                  </Label>
                </div>
              ))}
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter>
              <Button onClick={handleGenerateLink} disabled={isGenerating || selectedFiles.length === 0}>
                {isGenerating ? (
                  "Generating..."
                ) : (
                  <>
                    <Link className="w-4 h-4 mr-2" />
                    Generate Link
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Upload Link</Label>
              <div className="flex gap-2">
                <Input value={generatedLink} readOnly className="text-sm" />
                <Button variant="outline" size="icon" onClick={handleCopyLink}>
                  {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-1">Requested documents:</p>
              <ul className="list-disc list-inside">
                {selectedFiles.map((fileId) => (
                  <li key={fileId}>{AVAILABLE_FILE_TYPES.find((f) => f.id === fileId)?.label}</li>
                ))}
              </ul>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              {applicationEmail && (
                <Button variant="outline" onClick={handleSendEmail}>
                  <Mail className="w-4 h-4 mr-2" />
                  Send via Email
                </Button>
              )}
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
