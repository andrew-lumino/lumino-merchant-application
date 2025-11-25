"use client"

import { useState } from "react"
import { Mail, Download, Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import jsPDF from "jspdf"

interface MerchantQuickActionsProps {
  formData?: any
  principals?: any[]
  uploads?: Record<string, any>
  isAgentMode?: boolean
  show?: boolean
}

interface DownloadOptions {
  applicationInfo: boolean
  fileUploads: boolean
  compressed: boolean
}

export const MerchantQuickActions = ({
  formData,
  principals = [],
  uploads = {},
  isAgentMode = false,
  show = false,
}: MerchantQuickActionsProps) => {
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false)
  const [printDialogOpen, setPrintDialogOpen] = useState(false)
  const [downloadOptions, setDownloadOptions] = useState<DownloadOptions>({
    applicationInfo: true,
    fileUploads: false,
    compressed: false,
  })
  const [printOptions, setPrintOptions] = useState<DownloadOptions>({
    applicationInfo: true,
    fileUploads: false,
    compressed: false,
  })

  const handleEmailSupport = () => {
    const subject = encodeURIComponent("Merchant Application Support Request")
    const body = encodeURIComponent(
      `Hello Lumino Support Team,\n\nI need assistance with my merchant application.\n\n` +
        (formData?.dbaName ? `Business Name: ${formData.dbaName}\n` : "") +
        (formData?.dbaEmail ? `Business Email: ${formData.dbaEmail}\n` : "") +
        (isAgentMode ? `Note: This is an agent-submitted inquiry.\n` : "") +
        `\nPlease describe your issue below:\n\n\nBest regards`,
    )
    window.open(`mailto:support@golumino.com?subject=${subject}&body=${body}`)
  }

  const generateApplicationInfoPDF = () => {
    const doc = new jsPDF("p", "mm", "a4")
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    let yPosition = 20

    // Helper function to check if we need a new page
    const checkPageBreak = (requiredSpace: number) => {
      if (yPosition + requiredSpace > pageHeight - 20) {
        doc.addPage()
        yPosition = 20
      }
    }

    // Header
    doc.setFontSize(18)
    doc.setFont("helvetica", "bold")
    doc.text("Merchant Application Summary", pageWidth / 2, yPosition, { align: "center" })
    yPosition += 15

    // Date generated
    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth / 2, yPosition, { align: "center" })
    yPosition += 20

    const addSection = (title: string, data: Record<string, any>) => {
      checkPageBreak(30)

      doc.setFontSize(14)
      doc.setFont("helvetica", "bold")
      doc.text(title, 20, yPosition)
      yPosition += 10

      doc.setFontSize(10)
      doc.setFont("helvetica", "normal")

      Object.entries(data).forEach(([key, value]) => {
        if (value && value !== "" && value !== null && value !== undefined) {
          checkPageBreak(8)

          // Format currency values
          let displayValue = value
          if (key.includes("Volume") || key.includes("Ticket") || key.includes("Price")) {
            const numValue = Number.parseFloat(value.toString().replace(/[^0-9.-]+/g, ""))
            if (!isNaN(numValue)) {
              displayValue = `$${numValue.toLocaleString()}`
            }
          }

          doc.text(`${key}: ${displayValue}`, 25, yPosition)
          yPosition += 5
        }
      })
      yPosition += 8
    }

    if (!formData) {
      doc.setFontSize(12)
      doc.text("No application data available", 20, yPosition)
      return doc
    }

    // Merchant Information
    addSection("Merchant Information", {
      "DBA Name": formData.dbaName,
      "Legal Name": formData.legalName,
      Email: formData.dbaEmail,
      Phone: formData.dbaPhone,
      "Federal Tax ID": formData.federalTaxId,
      "Ownership Type": formData.ownershipType,
      "Business Type": formData.businessType,
      Website: formData.websiteUrl,
    })

    // Address Information
    const dbaAddress = [
      formData.dbaAddressLine1,
      formData.dbaAddressLine2,
      `${formData.dbaCity}, ${formData.dbaState} ${formData.dbaZip}`,
    ]
      .filter(Boolean)
      .join(", ")

    if (dbaAddress) {
      addSection("Business Address", {
        "DBA Address": dbaAddress,
      })
    }

    // Legal Address if different
    if (formData.legalDiffers) {
      const legalAddress = [
        formData.legalAddressLine1,
        formData.legalAddressLine2,
        `${formData.legalCity}, ${formData.legalState} ${formData.legalZip}`,
      ]
        .filter(Boolean)
        .join(", ")

      if (legalAddress) {
        addSection("Legal Address", {
          "Legal Address": legalAddress,
        })
      }
    }

    // Business Profile
    addSection("Business Profile", {
      "Monthly Volume": formData.monthlyVolume,
      "Average Ticket": formData.averageTicket,
      "Highest Ticket": formData.highestTicket,
      "Card Swiped %": formData.pctCardSwiped ? `${formData.pctCardSwiped}%` : "",
      "Manual Imprint %": formData.pctManualImprint ? `${formData.pctManualImprint}%` : "",
      "Manual No Imprint %": formData.pctManualNoImprint ? `${formData.pctManualNoImprint}%` : "",
      "Refund Policy": formData.refundPolicy,
      "Previous Processor": formData.previousProcessor,
      "Seasonal Business": formData.seasonalBusiness ? "Yes" : "No",
      "Seasonal Months": Array.isArray(formData.seasonalMonths)
        ? formData.seasonalMonths.join(", ")
        : typeof formData.seasonalMonths === "string"
          ? formData.seasonalMonths
          : "",
    })

    // Terminal Information
    if (formData.terminals && formData.terminals.length > 0) {
      checkPageBreak(40)

      doc.setFontSize(14)
      doc.setFont("helvetica", "bold")
      doc.text("Selected Terminals", 20, yPosition)
      yPosition += 10

      doc.setFontSize(10)
      doc.setFont("helvetica", "normal")

      formData.terminals.forEach((terminal: any, index: number) => {
        checkPageBreak(15)

        const originalPrice = terminal.originalPrice || terminal.price || 0
        const finalPrice = terminal.price || 0
        const discount =
          originalPrice > finalPrice
            ? ` (${(((originalPrice - finalPrice) / originalPrice) * 100).toFixed(1)}% discount)`
            : ""

        doc.text(`${index + 1}. ${terminal.name}`, 25, yPosition)
        yPosition += 5
        doc.text(`   Final Price: $${finalPrice.toFixed(2)}${discount}`, 25, yPosition)
        if (originalPrice !== finalPrice) {
          yPosition += 5
          doc.text(`   Original Price: $${originalPrice.toFixed(2)}`, 25, yPosition)
        }
        yPosition += 8
      })
      yPosition += 5
    }

    // Banking Information (redacted for security)
    if (formData.bankName) {
      addSection("Banking Information", {
        "Bank Name": formData.bankName,
        "Routing Number": formData.routingNumber ? "***REDACTED***" : "",
        "Account Number": formData.accountNumber ? "***REDACTED***" : "",
        "Batch Time": formData.batchTime,
      })
    }

    // Principals Summary
    if (principals && principals.length > 0) {
      checkPageBreak(30)

      doc.setFontSize(14)
      doc.setFont("helvetica", "bold")
      doc.text("Business Principals", 20, yPosition)
      yPosition += 10

      doc.setFontSize(10)
      doc.setFont("helvetica", "normal")

      principals.forEach((principal: any, index: number) => {
        if (principal.firstName || principal.lastName) {
          checkPageBreak(12)

          const name = `${principal.firstName || ""} ${principal.lastName || ""}`.trim()
          doc.text(`${index + 1}. ${name}`, 25, yPosition)
          yPosition += 5

          if (principal.position) {
            doc.text(`   Position: ${principal.position}`, 25, yPosition)
            yPosition += 5
          }

          if (principal.equity) {
            doc.text(`   Equity: ${principal.equity}%`, 25, yPosition)
            yPosition += 5
          }

          yPosition += 3
        }
      })
      yPosition += 5
    }

    // Signature Section
    checkPageBreak(30)

    doc.setFontSize(12)
    doc.setFont("helvetica", "bold")
    doc.text("Application Signature", 20, yPosition)
    yPosition += 10

    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    doc.text(`Signed by: ${formData.signatureFullName || "Not signed"}`, 25, yPosition)
    yPosition += 5
    doc.text(`Date: ${formData.signatureDate || "Not dated"}`, 25, yPosition)
    yPosition += 5
    doc.text(`Status: Draft`, 25, yPosition)

    // Footer
    const totalPages = doc.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setFont("helvetica", "normal")
      doc.text(`Page ${i} of ${totalPages} - Lumino Merchant Application`, pageWidth / 2, pageHeight - 10, {
        align: "center",
      })
    }

    return doc
  }

  const downloadFiles = async (options: DownloadOptions) => {
    const files: { name: string; content: Blob }[] = []

    // Generate Application Info PDF
    if (options.applicationInfo) {
      const appDoc = generateApplicationInfoPDF()
      const appBlob = new Blob([appDoc.output("blob")], { type: "application/pdf" })
      const businessName = formData?.dbaName ? formData.dbaName.replace(/[^a-zA-Z0-9]/g, "-") : "merchant"
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-")
      files.push({
        name: `${businessName}-application-${timestamp}.pdf`,
        content: appBlob,
      })
    }

    // Add file uploads if requested and available
    if (options.fileUploads && uploads) {
      try {
        for (const [key, upload] of Object.entries(uploads)) {
          if (upload.uploadedUrl || upload.url) {
            const fileUrl = upload.uploadedUrl || upload.url

            if (fileUrl.startsWith("data:")) {
              // Convert data URL to blob
              const response = await fetch(fileUrl)
              const blob = await response.blob()
              const extension = blob.type.split("/")[1] || "jpg"
              files.push({
                name: `${key}.${extension}`,
                content: blob,
              })
            } else {
              // Remote URL
              try {
                const response = await fetch(fileUrl)
                if (response.ok) {
                  const blob = await response.blob()
                  const extension = blob.type.split("/")[1] || "jpg"
                  files.push({
                    name: `${key}.${extension}`,
                    content: blob,
                  })
                }
              } catch (error) {
                console.warn(`Failed to download file: ${key}`, error)
              }
            }
          }
        }
      } catch (error) {
        console.error("Error downloading files:", error)
      }
    }

    if (files.length === 0) return

    if (options.compressed && files.length > 1) {
      // Download files individually with staggered timing
      files.forEach((file, index) => {
        setTimeout(() => {
          const link = document.createElement("a")
          link.href = URL.createObjectURL(file.content)
          link.download = file.name
          link.click()
        }, index * 500)
      })
    } else {
      // Download individual files
      files.forEach((file) => {
        const link = document.createElement("a")
        link.href = URL.createObjectURL(file.content)
        link.download = file.name
        link.click()
      })
    }
  }

  const printDocuments = (options: DownloadOptions) => {
    if (!options.applicationInfo) return

    const printContent = `
      <div style="page-break-after: always;">
        <h1 style="text-align: center; margin-bottom: 20px;">MERCHANT APPLICATION SUMMARY</h1>
        ${formData?.dbaName ? `<p><strong>Business Name:</strong> ${formData.dbaName}</p>` : ""}
        ${formData?.dbaEmail ? `<p><strong>Email:</strong> ${formData.dbaEmail}</p>` : ""}
        ${formData?.dbaPhone ? `<p><strong>Phone:</strong> ${formData.dbaPhone}</p>` : ""}
        ${formData?.ownershipType ? `<p><strong>Ownership Type:</strong> ${formData.ownershipType}</p>` : ""}
        ${formData?.businessType ? `<p><strong>Business Type:</strong> ${formData.businessType}</p>` : ""}
        
        <h2>Business Profile</h2>
        ${formData?.monthlyVolume ? `<p><strong>Monthly Volume:</strong> ${formData.monthlyVolume}</p>` : ""}
        ${formData?.averageTicket ? `<p><strong>Average Ticket:</strong> ${formData.averageTicket}</p>` : ""}
        ${formData?.highestTicket ? `<p><strong>Highest Ticket:</strong> ${formData.highestTicket}</p>` : ""}
        
        ${
          principals?.length > 0
            ? `
          <h2>Business Principals</h2>
          ${principals
            .map(
              (p, i) => `
            <p><strong>Principal ${i + 1}:</strong> ${p.firstName || ""} ${p.lastName || ""} ${p.position ? `- ${p.position}` : ""}</p>
          `,
            )
            .join("")}
        `
            : ""
        }
        
        <p style="margin-top: 20px;"><em>Generated: ${new Date().toLocaleDateString()}</em></p>
      </div>
    `

    const printWindow = window.open("", "_blank")
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Lumino Merchant Application</title>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.4; margin: 20px; }
              h1 { color: #333; }
              h2 { color: #666; margin-top: 20px; }
              p { margin: 5px 0; }
              @media print { 
                body { margin: 0; }
                .page-break { page-break-after: always; }
              }
            </style>
          </head>
          <body>
            ${printContent}
          </body>
        </html>
      `)
      printWindow.document.close()
      printWindow.print()
    }
  }

  const handleSelectAll = (type: "download" | "print", checked: boolean) => {
    const hasFileUploads = uploads && Object.values(uploads).some((upload) => upload.uploadedUrl || upload.url)

    const options = {
      applicationInfo: checked,
      fileUploads: checked && hasFileUploads,
      compressed: type === "download" ? downloadOptions.compressed : false,
    }

    if (type === "download") {
      setDownloadOptions(options)
    } else {
      setPrintOptions(options)
    }
  }

  const hasFileUploads = uploads && Object.values(uploads).some((upload) => upload.uploadedUrl || upload.url)

  return (
    <>
      {show && (
        <div className="mt-8 pt-6 border-t">
          <div className="flex flex-wrap items-center justify-center gap-2 md:justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleEmailSupport}
              className="flex items-center gap-2 bg-transparent"
            >
              <Mail className="h-4 w-4" />
              Email Support
            </Button>

            <Dialog open={downloadDialogOpen} onOpenChange={setDownloadDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="flex items-center gap-2 bg-transparent">
                  <Download className="h-4 w-4" />
                  Download
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Download Documents</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="select-all-download"
                      checked={downloadOptions.applicationInfo && downloadOptions.fileUploads}
                      onCheckedChange={(checked) => handleSelectAll("download", !!checked)}
                    />
                    <label htmlFor="select-all-download" className="text-sm font-medium">
                      Select All
                    </label>
                  </div>
                  <Separator />
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="app-info"
                        checked={downloadOptions.applicationInfo}
                        onCheckedChange={(checked) =>
                          setDownloadOptions((prev) => ({ ...prev, applicationInfo: !!checked }))
                        }
                      />
                      <label htmlFor="app-info" className="text-sm">
                        Application Summary (PDF)
                      </label>
                    </div>

                    {hasFileUploads && (
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="file-uploads"
                          checked={downloadOptions.fileUploads}
                          onCheckedChange={(checked) =>
                            setDownloadOptions((prev) => ({ ...prev, fileUploads: !!checked }))
                          }
                        />
                        <label htmlFor="file-uploads" className="text-sm">
                          Uploaded Documents
                        </label>
                      </div>
                    )}

                    {downloadOptions.applicationInfo && downloadOptions.fileUploads && (
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="compressed"
                          checked={downloadOptions.compressed}
                          onCheckedChange={(checked) =>
                            setDownloadOptions((prev) => ({ ...prev, compressed: !!checked }))
                          }
                        />
                        <label htmlFor="compressed" className="text-sm">
                          Download multiple files (staggered)
                        </label>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setDownloadDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      onClick={() => {
                        downloadFiles(downloadOptions)
                        setDownloadDialogOpen(false)
                      }}
                      disabled={!downloadOptions.applicationInfo && !downloadOptions.fileUploads}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={printDialogOpen} onOpenChange={setPrintDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="flex items-center gap-2 bg-transparent">
                  <Printer className="h-4 w-4" />
                  Print
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Print Documents</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="print-app-info"
                        checked={printOptions.applicationInfo}
                        onCheckedChange={(checked) =>
                          setPrintOptions((prev) => ({ ...prev, applicationInfo: !!checked }))
                        }
                      />
                      <label htmlFor="print-app-info" className="text-sm">
                        Application Summary (Simplified)
                      </label>
                    </div>
                  </div>

                  <p className="text-xs text-gray-500">
                    Note: File uploads cannot be printed directly. Use download option for files.
                  </p>

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setPrintDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      onClick={() => {
                        printDocuments(printOptions)
                        setPrintDialogOpen(false)
                      }}
                      disabled={!printOptions.applicationInfo}
                    >
                      <Printer className="h-4 w-4 mr-2" />
                      Print
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      )}
    </>
  )
}
