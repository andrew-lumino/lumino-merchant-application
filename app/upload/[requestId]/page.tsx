"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Upload, CheckCircle, XCircle, Loader2, FileText } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

const FILE_TYPE_LABELS: Record<string, string> = {
  voided_check: "Voided Check",
  business_license: "Business License",
  tax_id: "Tax ID Document",
  bank_statement: "Bank Statement",
  processing_statement: "Processing Statement",
  government_id: "Government ID",
  articles_of_incorporation: "Articles of Incorporation",
  other: "Other Document",
}

interface UploadRequest {
  id: string
  application_id: string
  is_active: boolean
  requested_files: string[]
  merchant_applications: {
    business_name: string
  }
}

interface FileUpload {
  documentType: string
  file: File | null
  uploadStatus: "idle" | "uploading" | "success" | "error"
  fileUrl?: string
}

export default function UploadPage() {
  const params = useParams()
  const requestId = params.requestId as string

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploadRequest, setUploadRequest] = useState<UploadRequest | null>(null)
  const [files, setFiles] = useState<Record<string, FileUpload>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    const fetchRequest = async () => {
      try {
        const response = await fetch(`/api/file-upload-request?id=${requestId}`)
        if (!response.ok) {
          if (response.status === 404) {
            setError("This upload link is invalid or has expired.")
          } else {
            setError("Failed to load upload request.")
          }
          return
        }

        const data = await response.json()

        if (!data.is_active) {
          setError("This upload link has already been used. The documents have been submitted.")
          return
        }

        setUploadRequest(data)

        // Initialize file upload state
        const initialFiles: Record<string, FileUpload> = {}
        data.requested_files.forEach((fileType: string) => {
          initialFiles[fileType] = {
            documentType: fileType,
            file: null,
            uploadStatus: "idle",
          }
        })
        setFiles(initialFiles)
      } catch (err) {
        setError("Failed to load upload request.")
      } finally {
        setLoading(false)
      }
    }

    fetchRequest()
  }, [requestId])

  const handleFileChange = (documentType: string, file: File | null) => {
    setFiles((prev) => ({
      ...prev,
      [documentType]: {
        ...prev[documentType],
        file,
        uploadStatus: "idle",
      },
    }))
  }

  const uploadFile = async (documentType: string, file: File): Promise<string> => {
    const supabase = createClient()
    const fileExt = file.name.split(".").pop()
    const fileName = `${uploadRequest?.application_id}/${documentType}_${Date.now()}.${fileExt}`

    const { error } = await supabase.storage.from("merchant-files").upload(fileName, file)

    if (error) {
      throw new Error(`Failed to upload ${FILE_TYPE_LABELS[documentType]}`)
    }

    const { data: urlData } = supabase.storage.from("merchant-files").getPublicUrl(fileName)

    return urlData.publicUrl
  }

  const handleSubmit = async () => {
    if (!uploadRequest) return

    // Check if at least one file is selected
    const hasFiles = Object.values(files).some((f) => f.file)
    if (!hasFiles) {
      setError("Please select at least one file to upload.")
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      // Upload all files to storage
      const uploadedFiles: Array<{
        documentType: string
        fileUrl: string
        fileName: string
      }> = []

      for (const [documentType, fileData] of Object.entries(files)) {
        if (fileData.file) {
          setFiles((prev) => ({
            ...prev,
            [documentType]: { ...prev[documentType], uploadStatus: "uploading" },
          }))

          try {
            const fileUrl = await uploadFile(documentType, fileData.file)
            uploadedFiles.push({
              documentType,
              fileUrl,
              fileName: fileData.file.name,
            })
            setFiles((prev) => ({
              ...prev,
              [documentType]: { ...prev[documentType], uploadStatus: "success", fileUrl },
            }))
          } catch (err) {
            setFiles((prev) => ({
              ...prev,
              [documentType]: { ...prev[documentType], uploadStatus: "error" },
            }))
            throw err
          }
        }
      }

      // Submit to API
      const formData = new FormData()
      formData.append("requestId", requestId)
      formData.append("applicationId", uploadRequest.application_id)
      formData.append("files", JSON.stringify(uploadedFiles))

      const response = await fetch("/api/file-upload-request/submit", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to submit files")
      }

      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload files")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error && !uploadRequest) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <XCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <p className="text-lg font-medium">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Documents Submitted!</h2>
            <p className="text-muted-foreground">Thank you for uploading your documents. You can close this page.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/30 p-4 py-8">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Upload Documents</CardTitle>
            <CardDescription>
              {uploadRequest?.merchant_applications?.business_name && (
                <span className="block">
                  For: <strong>{uploadRequest.merchant_applications.business_name}</strong>
                </span>
              )}
              Please upload the following requested documents.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {uploadRequest?.requested_files.map((fileType) => {
              const fileData = files[fileType]
              return (
                <div key={fileType} className="space-y-2">
                  <Label className="text-base font-medium">{FILE_TYPE_LABELS[fileType] || fileType}</Label>
                  <div className="border-2 border-dashed rounded-lg p-4 transition-colors hover:border-primary/50">
                    {fileData?.file ? (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText className="w-5 h-5 text-muted-foreground" />
                          <span className="text-sm">{fileData.file.name}</span>
                          {fileData.uploadStatus === "uploading" && <Loader2 className="w-4 h-4 animate-spin" />}
                          {fileData.uploadStatus === "success" && <CheckCircle className="w-4 h-4 text-green-600" />}
                          {fileData.uploadStatus === "error" && <XCircle className="w-4 h-4 text-destructive" />}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleFileChange(fileType, null)}
                          disabled={submitting}
                        >
                          Remove
                        </Button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center cursor-pointer py-4">
                        <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                        <span className="text-sm text-muted-foreground">Click to upload or drag and drop</span>
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) => handleFileChange(fileType, e.target.files?.[0] || null)}
                          accept="image/*,.pdf,.doc,.docx"
                        />
                      </label>
                    )}
                  </div>
                </div>
              )
            })}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button
              className="w-full"
              size="lg"
              onClick={handleSubmit}
              disabled={submitting || !Object.values(files).some((f) => f.file)}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                "Submit Documents"
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
