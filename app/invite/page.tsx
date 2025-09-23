"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Copy,
  Mail,
  Upload,
  Send,
  LinkIcon,
  CheckCircle,
  User,
  RefreshCw,
  Clock,
  FileCheck,
  Paperclip,
  Loader2,
  Eye,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useUser, SignInButton } from "@clerk/nextjs"

type Invite = {
  id: string
  dba_name: string | null
  dba_email: string | null
  status: string
  created_at: string
}

export default function InvitePage() {
  const [singleEmail, setSingleEmail] = useState("")
  const [multipleEmails, setMultipleEmails] = useState("")
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [generatedLink, setGeneratedLink] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [sendingMultiple, setSendingMultiple] = useState(false)
  const [linkEmail, setLinkEmail] = useState("")
  const { toast } = useToast()
  const { user, isLoaded } = useUser()

  // New state for invitation history
  const [invites, setInvites] = useState<Invite[]>([])
  const [loadingInvites, setLoadingInvites] = useState(true)
  const [resendingId, setResendingId] = useState<string | null>(null)

  // Authorization states
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)

  // Single email validation
  const [singleEmailError, setSingleEmailError] = useState("")
  const [linkEmailError, setLinkEmailError] = useState("")

  const userEmail = user?.primaryEmailAddress?.emailAddress ?? ""

  // Email validation function
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
    return emailRegex.test(email)
  }
  
  // Character filtering function - only allows valid email characters
  const isValidEmailChar = (char: string): boolean => {
    const validChars = /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~@-]/
    return validChars.test(char)
  }

  // Authorization check useEffect
  useEffect(() => {
    if (!isLoaded) return

    const email = user?.email ||
      user?.primaryEmailAddress?.emailAddress ||
      user?.emailAddresses?.[0]?.emailAddress ||
      null

    if (!email) {
      setAuthLoading(false)
      setIsAuthorized(false)
      return
    }

    const normalized = email.toLowerCase()
    const isLuminoStaff = normalized.endsWith("@golumino.com")

    // Fast path for staff
    if (isLuminoStaff) {
      setIsAuthorized(true)
      setAuthLoading(false)
      return
    }

    // Check the partner allow-list API
    const ac = new AbortController()
    ;(async () => {
      try {
        const res = await fetch("/api/get-partner-emails", {
          method: "GET",
          cache: "no-store",
          signal: ac.signal,
        })
        if (!res.ok) {
          console.error("get-partner-emails failed:", res.status)
          setIsAuthorized(false)
          setAuthLoading(false)
          return
        }
        const data: { success: boolean; emails?: string[] } = await res.json()
        
        // Check if email is in the list (case-insensitive)
        const isEmailInList = data.emails?.some(listEmail => 
          listEmail.toLowerCase() === normalized
        ) ?? false
        
        setIsAuthorized(isEmailInList)
        setAuthLoading(false)
      } catch (err) {
        if ((err as any)?.name !== "AbortError") {
          console.error("get-partner-emails error:", err)
        }
        setIsAuthorized(false)
        setAuthLoading(false)
      }
    })()

    return () => ac.abort()
  }, [isLoaded, user])

  // Fetch invites useEffect (only runs if authorized)
  useEffect(() => {
    if (authLoading || !isAuthorized || !userEmail) return
    
    fetchAgentInvites()
  }, [authLoading, isAuthorized, userEmail])

  const fetchAgentInvites = async () => {
    setLoadingInvites(true)
    try {
      
      const response = await fetch("/api/get-agent-invites", {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Error response:', errorText)
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }
      
      const data = await response.json()
      
      if (data.success) {
        setInvites(data.invites)
      } else {
        throw new Error(data.error || "Failed to fetch invites")
      }
    } catch (error) {
      console.error("Error fetching invites:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Could not load invitation history.",
        variant: "destructive",
      })
    } finally {
      setLoadingInvites(false)
    }
  }

  const handleResendInvite = async (expiredApplicationId: string) => {
    setResendingId(expiredApplicationId)
    try {
      const response = await fetch("/api/resend-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expiredApplicationId }),
      })
      const data = await response.json()
      if (data.success) {
        toast({
          title: "Success!",
          description: "A new invitation has been created and sent.",
        })
        fetchAgentInvites() // Refresh the list
      } else {
        throw new Error(data.error || "Failed to resend invite")
      }
    } catch (error) {
      console.error("Error resending invite:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Could not resend invitation.",
        variant: "destructive",
      })
    } finally {
      setResendingId(null)
    }
  }

  const handleCopyApplicationLink = (inviteId: string) => {
    const link = `https://apply.golumino.com/?id=${inviteId}`
    navigator.clipboard.writeText(link)
    toast({
      title: "Copied!",
      description: "Application link copied to clipboard",
    })
  }

  const handleEmailMerchant = (invite: Invite) => {
    const merchantEmail = invite.dba_email
    if (!merchantEmail) {
      toast({
        title: "No Email",
        description: "This application doesn't have a merchant email address.",
        variant: "destructive",
      })
      return
    }

    const link = `https://apply.golumino.com/?id=${invite.id}`
    const subject = encodeURIComponent("Your Lumino Merchant Application")
    const body = encodeURIComponent(`Hello,

    Your merchant application for Lumino is ready for completion. Please click the link below:

    ${link}

    If you have any questions, please don't hesitate to reach out.

    Best regards,
    Lumino Team`)

    const mailtoLink = `mailto:${merchantEmail}?subject=${subject}&body=${body}`
    window.open(mailtoLink, '_blank')
    
    toast({
      title: "Email Client Opened",
      description: `Email draft created for ${merchantEmail}`,
    })
  }

  const handleViewApplication = (inviteId: string) => {
    const link = `https://apply.golumino.com/?id=${inviteId}`
    window.open(link, '_blank', 'noopener,noreferrer')
  }

  const getInviteStatus = (invite: Invite) => {
    const now = new Date()
    const createdAt = new Date(invite.created_at)
    const ageInDays = (now.getTime() - createdAt.getTime()) / (1000 * 3600 * 24)

    if (invite.status !== "submitted" && invite.status !== "resent" && ageInDays > 30) {
      return { text: "Expired", color: "text-red-600", icon: <Clock className="h-3 w-3" />, isExpired: true }
    }

    switch (invite.status) {
      case "invited":
        return { text: "Invited", color: "text-blue-600", icon: <Send className="h-3 w-3" />, isExpired: false }
      case "opened":
        return { text: "Opened", color: "text-yellow-600", icon: <Mail className="h-3 w-3" />, isExpired: false }
      case "submitted":
        return { text: "Submitted", color: "text-green-600", icon: <FileCheck className="h-3 w-3" />, isExpired: false }
      case "resent":
        return { text: "Resent", color: "text-gray-500", icon: <RefreshCw className="h-3 w-3" />, isExpired: false }
      case "draft":
        return { text: "Draft", color: "text-purple-600", icon: <Paperclip className="h-3 w-3" />, isExpired: false }
      default:
        return { text: "Unknown", color: "text-gray-500", icon: <Paperclip className="h-3 w-3" />, isExpired: false }
    }
  }

  const generateInviteId = async (email?: string) => {
    try {
      const response = await fetch("/api/generate-merchant-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_email: userEmail,
          merchant_email: email || null,
        }),
      })

      const data = await response.json()

      if (data.success) {
        fetchAgentInvites() // Refresh history after creating a new one
        return data.inviteId
      }
      throw new Error(data.error || "Failed to generate invite")
    } catch (error) {
      console.error("Error generating invite:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate invite ID",
        variant: "destructive",
      })
      return null
    }
  }

  const handleGenerateSingleLink = async (email?: string) => {
    // If email is provided, validate it first
    if (email && !validateEmail(email)) {
      setLinkEmailError("Please enter a valid email address")
      return
    }

    setIsLoading(true)
    setLinkEmailError("") // Clear any previous errors
    
    try {
      const inviteId = await generateInviteId(email)
      if (inviteId) {
        const link = `https://apply.golumino.com/?id=${inviteId}`
        setGeneratedLink(link)
        toast({
          title: "Success!",
          description: "Invite link generated successfully",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate invite link",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(generatedLink)
    toast({
      title: "Copied!",
      description: "Link copied to clipboard",
    })
  }

  const handleSendSingleEmail = async () => {
    if (!singleEmail) {
      setSingleEmailError("Please enter an email address")
      return
    }

    if (!validateEmail(singleEmail)) {
      setSingleEmailError("Please enter a valid email address")
      return
    }

    setSendingEmail(true)
    setSingleEmailError("") // Clear any previous errors
    
    try {
      const inviteId = await generateInviteId(singleEmail)
      if (!inviteId) {
        throw new Error("Failed to generate invite ID")
      }

      const response = await fetch("/api/send-merchant-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emails: [singleEmail],
          inviteId,
          agent_email: userEmail,
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: "Success!",
          description: data.message || "Invite sent successfully",
        })
        setSingleEmail("")
        setSingleEmailError("")
      } else {
        throw new Error(data.message || data.error || "Failed to send invite")
      }
    } catch (error) {
      console.error("Error sending invite:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send invite",
        variant: "destructive",
      })
    } finally {
      setSendingEmail(false)
    }
  }

  // Handle link email input changes with validation
  const handleLinkEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    
    // Filter out invalid characters
    const filteredValue = value.split('').filter(char => isValidEmailChar(char)).join('')
    
    // Check for multiple @ symbols (only one allowed)
    const atCount = (filteredValue.match(/@/g) || []).length
    if (atCount > 1) {
      return // Don't update if trying to add multiple @ symbols
    }
    
    setLinkEmail(filteredValue)
    
    // Clear error when user starts typing
    if (linkEmailError) {
      setLinkEmailError("")
    }
    
    // Validate on blur or when email looks complete
    if (filteredValue && filteredValue.includes('@') && filteredValue.length > 5) {
      if (!validateEmail(filteredValue)) {
        setLinkEmailError("Please enter a valid email address")
      }
    }
  }

  // Handle paste for link email
  const handleLinkEmailPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pastedText = e.clipboardData.getData('text')
    
    // Take only the first email if multiple are pasted
    const firstEmail = pastedText.split(/[,;\s\n]/)[0].trim()
    const filteredEmail = firstEmail.split('').filter(char => isValidEmailChar(char)).join('')
    
    setLinkEmail(filteredEmail)
    
    if (filteredEmail && !validateEmail(filteredEmail)) {
      setLinkEmailError("Please enter a valid email address")
    } else {
      setLinkEmailError("")
    }
  }

  // Handle key press for link email
  const handleLinkEmailKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const char = e.key
    
    // Prevent spaces, commas, semicolons, and other separators
    if (char === ' ' || char === ',' || char === ';' || char === '\n' || char === '\t') {
      e.preventDefault()
      return
    }
    
    // Allow backspace, delete, arrow keys, etc.
    if (char.length > 1) return
    
    // Prevent invalid characters
    if (!isValidEmailChar(char)) {
      e.preventDefault()
    }
  }

  const parseEmails = (text: string): string[] => {
    return text
      .split(/[,;\n]/) // Add semicolon to the regex
      .map((email) => email.trim())
      .filter((email) => email && email.includes("@"))
  }

  // Handle input changes with validation
  const handleSingleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    
    // Filter out invalid characters
    const filteredValue = value.split('').filter(char => isValidEmailChar(char)).join('')
    
    // Check for multiple @ symbols (only one allowed)
    const atCount = (filteredValue.match(/@/g) || []).length
    if (atCount > 1) {
      return // Don't update if trying to add multiple @ symbols
    }
    
    setSingleEmail(filteredValue)
    
    // Clear error when user starts typing
    if (singleEmailError) {
      setSingleEmailError("")
    }
    
    // Validate on blur or when email looks complete
    if (filteredValue && filteredValue.includes('@') && filteredValue.length > 5) {
      if (!validateEmail(filteredValue)) {
        setSingleEmailError("Please enter a valid email address")
      }
    }
  }

  // Handle paste to clean up pasted content
  const handleSingleEmailPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pastedText = e.clipboardData.getData('text')
    
    // Take only the first email if multiple are pasted
    const firstEmail = pastedText.split(/[,;\s\n]/)[0].trim()
    const filteredEmail = firstEmail.split('').filter(char => isValidEmailChar(char)).join('')
    
    setSingleEmail(filteredEmail)
    
    if (filteredEmail && !validateEmail(filteredEmail)) {
      setSingleEmailError("Please enter a valid email address")
    } else {
      setSingleEmailError("")
    }
  }

  // Handle key press to prevent invalid characters
  const handleSingleEmailKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const char = e.key
    
    // Prevent spaces, commas, semicolons, and other separators
    if (char === ' ' || char === ',' || char === ';' || char === '\n' || char === '\t') {
      e.preventDefault()
      return
    }
    
    // Allow backspace, delete, arrow keys, etc.
    if (char.length > 1) return
    
    // Prevent invalid characters
    if (!isValidEmailChar(char)) {
      e.preventDefault()
    }
  }

  const handleSendMultipleEmails = async () => {
    const emails = multipleEmails
      .split(/[,;\n]/) // Split on comma, semicolon, or newline
      .map((email) => email.trim())
      .filter((email) => email && email.includes("@"))
      .filter((email) => {
        // More thorough email validation
        const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
        return emailRegex.test(email)
      })

    if (emails.length === 0) {
      toast({
        title: "Error",
        description: "Please enter valid email addresses",
        variant: "destructive",
      })
      return
    }

    setSendingMultiple(true)
    try {
      const response = await fetch("/api/send-multiple-merchant-invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emails,
          agent_email: userEmail,
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: "Success!",
          description: data.message || `${emails.length} invites sent successfully`,
        })
        setMultipleEmails("")
        setCsvFile(null)
        fetchAgentInvites() // Refresh history
      } else {
        throw new Error(data.message || data.error || "Failed to send invites")
      }
    } catch (error) {
      console.error("Error sending invites:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send invites",
        variant: "destructive",
      })
    } finally {
      setSendingMultiple(false)
    }
  }

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setCsvFile(file)

    try {
      const text = await file.text()
      const lines = text.split("\n")
      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase())

      const emailColumnIndex = headers.findIndex((h) => h.includes("email") || h.includes("mail"))

      if (emailColumnIndex === -1) {
        toast({
          title: "Error",
          description: "No email column found in CSV",
          variant: "destructive",
        })
        setCsvFile(null)
        return
      }

      const emails = lines
        .slice(1)
        .map((line) => line.split(",")[emailColumnIndex]?.trim())
        .filter((email) => email && email.includes("@"))
        .join(", ")

      setMultipleEmails(emails)

      toast({
        title: "Success!",
        description: `Found ${emails.split(", ").length} email addresses in CSV`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to parse CSV file",
        variant: "destructive",
      })
      setCsvFile(null)
    }
  }

  // Loading state
  if (!isLoaded || authLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
        <p>Loading...</p>
      </div>
    )
  }

  // Unauthorized state
  if (!isAuthorized) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <Card className="text-center">
          <CardHeader>
            <CardTitle className="text-2xl font-medium">Access Denied</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-lg text-gray-700">
              You don't have permission to access this page.
            </p>
            <p className="text-gray-600">
              This page is only accessible to Lumino team members and authorized partners.
            </p>
            
            <div className="space-y-3">
              <SignInButton mode="modal" redirectUrl="/invite">
                <Button className="w-full bg-blue-600 hover:bg-blue-700">
                  <User className="mr-2 h-4 w-4" />
                  Partner Sign-In
                </Button>
              </SignInButton>
              
              <Button asChild variant="outline" className="w-full">
                <a href="mailto:support@golumino.com">
                  <Mail className="mr-2 h-4 w-4" />
                  Contact Support
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center mb-8">
        <h1 className="sm:text-3xl text-md font-bold text-gray-900">Merchant Application Invites</h1>
        <p className="sm:text-lg text-sm text-gray-600 mt-2">Generate and send merchant application invitations</p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-center gap-2 text-blue-800">
          <User className="h-4 w-4" />
          <span className="font-medium">Account Manager:</span>
          <span>{userEmail}</span>
        </div>
        <p className="text-xs text-blue-600 mt-1">
          All invites will be automatically associated with this account manager for commission tracking.
        </p>
      </div>

      <Tabs defaultValue="single" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="single">Single Invite</TabsTrigger>
          <TabsTrigger value="multiple">Multiple Invites</TabsTrigger>
        </TabsList>

        <TabsContent value="single">
          <Card>
            <CardHeader>
              <CardTitle>Generate Single Invite</CardTitle>
              <CardDescription>Create a single invite link or send it directly to an email address</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* <div className="space-y-2">
                <Label htmlFor="linkEmail">Optional: Associate with Email</Label>
                <div className="space-y-2">
                  <Input
                    id="linkEmail"
                    type="email"
                    placeholder="merchant@example.com"
                    value={linkEmail}
                    onChange={handleLinkEmailChange}
                    onKeyPress={handleLinkEmailKeyPress}
                    onPaste={handleLinkEmailPaste}
                    className={linkEmailError ? "border-red-500 focus:ring-red-500" : ""}
                  />
                  {linkEmailError && (
                    <p className="text-sm text-red-600">{linkEmailError}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button 
                    onClick={() => handleGenerateSingleLink(linkEmail)} 
                    disabled={isLoading || (linkEmail && !!linkEmailError)} 
                    className="flex-1"
                  >
                    <LinkIcon className="mr-2 h-4 w-4" />
                    {isLoading ? "Generating..." : "Generate Link"}
                  </Button>
                </div>
              </div>

              {generatedLink && (
                <div className="space-y-2">
                  <Label>Generated Link</Label>
                  <div className="flex gap-2">
                    <Input value={generatedLink} readOnly />
                    <Button onClick={handleCopyLink} variant="outline">
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Link generated successfully! Share this with your merchant prospect.
                  </p>
                </div>
              )} */}

              <div className="border-t pt-4">
                <div className="space-y-2">
                  {/* <Label htmlFor="singleEmail">Or send directly to email</Label> */}
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Input
                        id="singleEmail"
                        type="email"
                        placeholder="merchant@example.com"
                        value={singleEmail}
                        onChange={handleSingleEmailChange}
                        onKeyPress={handleSingleEmailKeyPress}
                        onPaste={handleSingleEmailPaste}
                        className={singleEmailError ? "border-red-500 focus:ring-red-500" : ""}
                      />
                      {singleEmailError && (
                        <p className="text-sm text-red-600 mt-1">{singleEmailError}</p>
                      )}
                    </div>
                    <Button 
                      onClick={handleSendSingleEmail} 
                      disabled={sendingEmail || !singleEmail || !!singleEmailError}
                    >
                      <Mail className="mr-2 h-4 w-4" />
                      {sendingEmail ? "Sending..." : "Send"}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="multiple">
          <Card>
            <CardHeader>
              <CardTitle>Send Multiple Invites</CardTitle>
              <CardDescription>Send unique invite links to multiple email addresses</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="csvUpload">Upload CSV File</Label>
                <div className="flex items-center gap-2">
                  <Input id="csvUpload" type="file" accept=".csv" onChange={handleCsvUpload} />
                  <Upload className="h-4 w-4 text-gray-400" />
                </div>
                <p className="text-xs text-gray-500">CSV should contain an email column</p>
                {csvFile && (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    CSV uploaded: {csvFile.name}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="multipleEmails">Email Addresses (comma or line separated)</Label>
                <Textarea
                  id="multipleEmails"
                  placeholder="merchant1@example.com, merchant2@example.com&#10;merchant3@example.com"
                  value={multipleEmails}
                  onChange={(e) => setMultipleEmails(e.target.value)}
                  rows={6}
                />
                {multipleEmails && (
                  <p className="text-xs text-blue-600">
                    Ready to send to {parseEmails(multipleEmails).length} email addresses
                  </p>
                )}
              </div>

              <Button
                onClick={handleSendMultipleEmails}
                disabled={sendingMultiple || !multipleEmails.trim()}
                className="w-full"
              >
                <Send className="mr-2 h-4 w-4" />
                {sendingMultiple ? "Sending Invites..." : "Send All Invites"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="mt-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Invitation History</h2>
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-3 font-medium">Merchant</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Date Sent</th>
                    <th className="text-right p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingInvites ? (
                    <tr>
                      <td colSpan={4} className="text-center p-6 text-gray-500">
                        <Loader2 className="h-5 w-5 animate-spin inline-block mr-2" />
                        Loading history...
                      </td>
                    </tr>
                  ) : invites.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center p-6 text-gray-500">
                        You haven't sent any invitations yet.
                      </td>
                    </tr>
                  ) : (
                    invites.map((invite) => {
                      const statusInfo = getInviteStatus(invite)
                      return (
                        <tr key={invite.id} className="border-b last:border-0">
                          <td className="p-3">
                            <div className="font-medium">{invite.dba_name || "N/A"}</div>
                            <div className="text-gray-500">{invite.dba_email || "No Email"}</div>
                          </td>
                          <td className="p-3">
                            <div className={`flex items-center gap-2 ${statusInfo.color}`}>
                              {statusInfo.icon}
                              <span>{statusInfo.text}</span>
                            </div>
                          </td>
                          <td className="p-3 text-gray-500">{new Date(invite.created_at).toLocaleDateString()}</td>
                          <td className="p-3 text-right">
                            {statusInfo.isExpired ? (
                              <Button
                                size="sm"
                                onClick={() => handleResendInvite(invite.id)}
                                disabled={resendingId === invite.id}
                              >
                                {resendingId === invite.id ? (
                                  <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                                ) : (
                                  <RefreshCw className="h-3 w-3 mr-2" />
                                )}
                                Resend
                              </Button>
                            ) : (
                              <div className="flex gap-1 justify-end">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleEmailMerchant(invite)}
                                  disabled={!invite.dba_email}
                                  title={invite.dba_email ? `Email "${invite.dba_email}"` : "No email address found"}
                                >
                                  <Mail className="h-3 w-3" />
                                </Button>
                                
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleCopyApplicationLink(invite.id)}
                                  title="Copy application link"
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                                
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleViewApplication(invite.id)}
                                  title="View application in new window"
                                >
                                  <Eye className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
