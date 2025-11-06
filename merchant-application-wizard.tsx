"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { useUser, UserButton } from "@clerk/nextjs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import {
  Check,
  AlertTriangle,
  Upload,
  FileText,
  X,
  Plus,
  Trash2,
  LinkIcon,
  Loader2,
  Copy,
  Send,
  Clock,
  FileCheck,
  Terminal,
  Mail,
} from "lucide-react"
import { cn } from "@/lib/utils"
import jsPDF from "jspdf"
import { BusinessTypeAutocomplete } from "@/components/business-type-autocomplete"
import { TerminalSelector } from "@/components/terminal-selector"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"
import { CheckCircle, XCircle, AlertCircle } from "lucide-react"
import { MerchantQuickActions } from "@/components/quick-actions"

const snakeToCamel = (str: string) =>
  str.replace(/([-_][a-z])/g, (group) => group.toUpperCase().replace("-", "").replace("_", ""))

const convertKeysToCamelCase = (obj: any): any => {
  if (Array.isArray(obj)) {
    return obj.map((v) => convertKeysToCamelCase(v))
  } else if (obj !== null && typeof obj === "object") {
    return Object.keys(obj).reduce((acc: Record<string, any>, key: string) => {
      // Special handling for known problematic fields
      const fieldMappings: Record<string, string> = {
        date_of_birth: "dob",
        first_name: "firstName",
        last_name: "lastName",
        middle_name: "middleName",
        gov_id_type: "govIdType",
        govId_number: "govIdNumber",
        gov_id_expiration: "govIdExpiration",
        gov_id_state: "govIdState",
        address_line_1: "addressLine1",
        address_line_2: "addressLine2",
        zip_extended: "zipExtended",
        dba_address_line_1: "dbaAddressLine1",
        dba_address_line_2: "dbaAddressLine2",
        dba_zip_extended: "dbaZipExtended",
        legal_address_line_1: "legalAddressLine1",
        legal_address_line_2: "legalAddressLine2",
        legal_zip_extended: "legalZipExtended",
      }

      const camelKey = fieldMappings[key] || snakeToCamel(key)
      acc[camelKey] = convertKeysToCamelCase(obj[key])
      return acc
    }, {})
  }
  return obj
}

type StepStatus = "not_visited" | "visited" | "completed" | "error"

interface Step {
  id: string
  label: string
  status: StepStatus
}

interface Principal {
  id: string
  firstName: string
  lastName: string
  middleName: string
  dob: string
  ssn: string
  email: string
  phone: string
  position: string
  equity: string
  govIdType: string
  govIdNumber: string
  govIdExpiration: string
  govIdState: string
  addressLine1: string
  addressLine2: string
  city: string
  state: string
  zip: string
  zipExtended: string
}

interface FileUpload {
  file: File | null
  url: string
  uploadType: "file" | "url"
  preview: string | null
  uploadStatus: "idle" | "uploading" | "success" | "error" | "warning"
  uploadedUrl?: string
  fileName?: string
  errorMessage?: string
}

interface SelectedTerminal {
  name: string
  price: number
  originalPrice: number
  quantity: number
}

interface FormData {
  // Agent Info
  agentEmail: string

  // Merchant Information
  dbaName: string
  dbaEmail: string
  ownershipType: string
  legalName: string
  federalTaxId: string
  dbaPhone: string
  websiteUrl: string
  paperlessStatements: boolean

  // DBA Address
  dbaAddressLine1: string
  dbaAddressLine2: string
  dbaCity: string
  dbaState: string
  dbaZip: string
  dbaZipExtended: string

  // Legal Address
  legalDiffers: boolean
  legalAddressLine1: string
  legalAddressLine2: string
  legalCity: string
  legalState: string
  legalZip: string
  legalZipExtended: string

  // Merchant Profile
  monthlyVolume: string
  averageTicket: string
  highestTicket: string
  pctCardSwiped: string
  pctManualImprint: string
  pctManualNoImprint: string
  businessType: string
  refundPolicy: string
  previousProcessor: string
  reasonForTermination: string
  seasonalBusiness: boolean
  seasonalMonths: string[]
  usesFulfillmentHouse: boolean
  usesThirdParties: boolean
  thirdPartiesList: string
  terminals: SelectedTerminal[]

  // Accepted Optional Card Types
  acceptAmex: string
  acceptDebit: string
  acceptEbt: string

  // Rate Programs
  rateProgram: string
  rateProgramValue: string

  // Managing Member
  managingMemberSameAs: boolean
  managingMemberReference: string
  managingMemberFirstName: string
  managingMemberLastName: string
  managingMemberEmail: string
  managingMemberPhone: string
  managingMemberPosition: string

  // Authorized Contact
  authorizedContactSameAs: boolean
  authorizedContactName: string
  authorizedContactEmail: string
  authorizedContactPhone: string

  // Banking
  bankName: string
  routingNumber: string
  accountNumber: string

  // Batching
  batchTime: string

  // Technical Contact
  technicalContactSameAs: boolean
  technicalContactName: string
  technicalContactEmail: string
  technicalContactPhone: string

  // Signature
  agreementScrolled: boolean
  signatureFullName: string
  signatureDate: string
  certificationAck: boolean
}

type PctField = keyof Pick<FormData, "pctCardSwiped" | "pctManualImprint" | "pctManualNoImprint">

const SUPPORTED_FILE_TYPES = ["JPG", "JPEG", "GIF", "PNG", "HEIC", "WEBP", "XLS", "XLSX", "CSV", "XML", "DOC", "PDF"]
const MAX_FILE_SIZE_MB = 20

const US_STATES = [
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
]

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

export default function MerchantApplicationWizard() {
  const [currentStep, setCurrentStep] = useState(0)
  const [steps, setSteps] = useState<Step[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isExpired, setIsExpired] = useState(false)
  const [isAlreadySubmitted, setIsAlreadySubmitted] = useState(false)
  const [isUnauthorized, setIsUnauthorized] = useState(false)
  const [applicationData, setApplicationData] = useState<any>(null)
  const [merchantEmail, setMerchantEmail] = useState("")
  const [isAgentMode, setIsAgentMode] = useState(false)
  const [isSkipMode, setIsSkipMode] = useState(false)
  const [generatedLink, setGeneratedLink] = useState("")

  const [agentName, setAgentName] = useState("")
  const [isSubmittingAgentAction, setIsSubmittingAgentAction] = useState(false) // Renamed from isSubmittingAgentAction to avoid confusion with submit button
  const [isAgent, setIsAgent] = useState(false) // This state seems unused, keeping for now
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedTerminals, setSelectedTerminals] = useState<any>([]) // This state seems unused, keeping for now
  const [manuallySetFields, setManuallySetFields] = useState<Set<string>>(new Set()) // This state seems unused, keeping for now

  const [formData, setFormData] = useState<FormData>({
    agentEmail: "",
    dbaName: "",
    dbaEmail: "",
    ownershipType: "",
    legalName: "",
    federalTaxId: "",
    dbaPhone: "",
    websiteUrl: "",
    paperlessStatements: false,
    dbaAddressLine1: "",
    dbaAddressLine2: "",
    dbaCity: "",
    dbaState: "",
    dbaZip: "",
    dbaZipExtended: "",
    legalDiffers: true,
    legalAddressLine1: "",
    legalAddressLine2: "",
    legalCity: "",
    legalState: "",
    legalZip: "",
    legalZipExtended: "",
    monthlyVolume: "",
    averageTicket: "",
    highestTicket: "",
    pctCardSwiped: "",
    pctManualImprint: "",
    pctManualNoImprint: "",
    businessType: "",
    refundPolicy: "",
    previousProcessor: "",
    reasonForTermination: "",
    seasonalBusiness: false,
    seasonalMonths: [],
    usesFulfillmentHouse: false,
    usesThirdParties: false,
    thirdPartiesList: "",
    terminals: [],

    // Initialize new fields
    acceptAmex: "no",
    acceptDebit: "yes",
    acceptEbt: "no",
    rateProgram: "",
    rateProgramValue: "",

    managingMemberSameAs: false,
    managingMemberReference: "",
    managingMemberFirstName: "",
    managingMemberLastName: "",
    managingMemberEmail: "",
    managingMemberPhone: "",
    managingMemberPosition: "",

    authorizedContactSameAs: false,
    authorizedContactName: "",
    authorizedContactEmail: "",
    authorizedContactPhone: "",

    bankName: "",
    routingNumber: "",
    accountNumber: "",

    batchTime: "",

    technicalContactSameAs: false,
    technicalContactName: "",
    technicalContactEmail: "",
    technicalContactPhone: "",

    agreementScrolled: false,
    signatureFullName: "",
    signatureDate: "",
    certificationAck: false,
  })

  const [principals, setPrincipals] = useState<Principal[]>([
    {
      id: "1",
      firstName: "",
      lastName: "",
      middleName: "",
      dob: "",
      ssn: "",
      email: "",
      phone: "",
      position: "",
      equity: "",
      govIdType: "",
      govIdNumber: "",
      govIdExpiration: "",
      govIdState: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      state: "",
      zip: "",
      zipExtended: "",
    },
  ])

  const [uploads, setUploads] = useState<Record<string, FileUpload>>({})

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitted, setIsSubmitted] = useState(false)
  const agreementScrollRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()

  const { user, isLoaded } = useUser()
  const { email } = user || {} // Moved email declaration here for clarity
  const normalizedEmail = (email || "").toLowerCase()

  const getLocalStorageKey = () => {
    const urlParams = new URLSearchParams(window.location.search)
    const inviteId = urlParams.get("id") || applicationData?.id
    return inviteId ? `lumino_draft_${inviteId}` : null
  }

  useEffect(() => {
    const key = getLocalStorageKey()
    if (!key) return

    try {
      const saved = localStorage.getItem(key)
      if (!saved) return

      const parsed = JSON.parse(saved)

      // Check if expired (72 hours)
      const savedTime = new Date(parsed.timestamp).getTime()
      const now = new Date().getTime()
      const hoursOld = (now - savedTime) / (1000 * 60 * 60)

      if (hoursOld > 72) {
        localStorage.removeItem(key)
        return
      }

      // Restore data
      if (parsed.formData) setFormData((prev) => ({ ...prev, ...parsed.formData }))
      if (parsed.principals) setPrincipals(parsed.principals)
      if (parsed.uploads) setUploads(parsed.uploads)
      if (parsed.currentStep !== undefined) setCurrentStep(parsed.currentStep)

      console.log("[v0] Restored draft from localStorage")
    } catch (error) {
      console.error("[v0] Failed to load draft:", error)
      if (key) localStorage.removeItem(key)
    }
  }, []) // Only run once on mount

  useEffect(() => {
    const key = getLocalStorageKey()
    if (!key || !isAgentMode) return // Only save for agents

    try {
      const dataToSave = {
        timestamp: new Date().toISOString(),
        formData,
        principals,
        uploads,
        currentStep,
      }
      localStorage.setItem(key, JSON.stringify(dataToSave))
      console.log("[v0] Saved draft to localStorage")
    } catch (error) {
      console.error("[v0] Failed to save draft:", error)
    }
  }, [formData, principals, uploads, currentStep, isAgentMode])

  useEffect(() => {
    if (!isLoaded) return

    const urlParams = new URLSearchParams(window.location.search)
    const inviteId = urlParams.get("id")
    const skipEnabled = ["skip", "agent"].some((k) => (urlParams.get(k) ?? "").toLowerCase() === "true")

    if (skipEnabled) {
      setIsSkipMode(true)
    }

    const isLuminoStaff = normalizedEmail.endsWith("@golumino.com")

    // Define the main logic that runs after we determine agent status
    const handleAgentStatusDetermined = (finalIsAgentMode: boolean) => {
      setIsAgentMode(finalIsAgentMode)

      if (finalIsAgentMode || isLuminoStaff) {
        const savedName = localStorage.getItem("lumino_agent_name")
        if (savedName) {
          setAgentName(savedName)
        } else {
          // Auto-generate from email
          const emailUsername = normalizedEmail.split("@")[0] || ""
          const autoName = emailUsername.toUpperCase().replace(/[._-]/g, " ")
          setAgentName(autoName)
        }
      }

      // Update steps with agent status
      const agentCheck = isLuminoStaff || finalIsAgentMode
      const updatedSteps: Step[] = [
        { id: "welcome", label: agentCheck ? "Instructions" : "Welcome", status: "visited" },
        { id: "merchant-info", label: "Merchant Info", status: "not_visited" },
        { id: "merchant-profile", label: "Merchant Profile", status: "not_visited" },
        { id: "account-rates", label: "Account Rates", status: "not_visited" },
        { id: "owners", label: "Owners & Officers", status: "not_visited" },
        { id: "banking", label: "Banking Info", status: "not_visited" },
        { id: "uploads", label: "Document Uploads", status: "not_visited" },
        { id: "review", label: "Review & Sign", status: "not_visited" },
        { id: "confirmation", label: "Confirmation", status: "not_visited" },
      ]
      setSteps(updatedSteps)

      if (inviteId) {
        fetch(`/api/get-application-data?id=${inviteId}`)
          .then((res) => res.json())
          .then((result) => {
            if (result.success) {
              const appData = result.data
              setApplicationData(appData)

              const createdAt = new Date(appData.created_at)
              const now = new Date()
              const ageInDays = (now.getTime() - createdAt.getTime()) / (1000 * 3600 * 24)

              if (!agentCheck && ageInDays > 30 && appData.status !== "submitted") {
                setIsExpired(true)
                setIsLoading(false)
                return
              }

              if (appData.status === "submitted" || appData.status === "resent") {
                setIsAlreadySubmitted(true)
                setIsLoading(false)
                return
              }

              const camelCaseData = convertKeysToCamelCase(appData)
              const prefillData = {
                ...camelCaseData,
                terminals: camelCaseData.terminals || [],
                // Pre-fill new fields from API data if available
                acceptAmex: camelCaseData.acceptAmex ?? "no",
                acceptDebit: camelCaseData.acceptDebit ?? "yes",
                acceptEbt: camelCaseData.acceptEbt ?? "no",
                rateProgram: camelCaseData.rateProgram ?? "",
                rateProgramValue: camelCaseData.rateProgramValue ?? "",
              }

              const cleanedData = Object.keys(prefillData).reduce((acc, key) => {
                acc[key] = prefillData[key] ?? (key === "terminals" ? [] : "")
                return acc
              }, {} as any)

              setFormData((prev) => ({ ...prev, ...cleanedData }))

              if (camelCaseData.principals) {
                const cleanedPrincipals = camelCaseData.principals.map((principal: any) =>
                  Object.keys(principal).reduce((acc, key) => {
                    acc[key] = principal[key] ?? ""
                    return acc
                  }, {} as any),
                )
                setPrincipals(cleanedPrincipals)
              }
              setMerchantEmail(appData.dba_email || "")

              if (appData.status === "opened") {
                // If already opened, no need to update status to opened
              } else if (appData.status === "invited") {
                fetch("/api/update-application-status", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ applicationId: inviteId, status: "opened" }),
                })
              }
            } else {
              // If no application data found, and not in agent mode, show unauthorized or expired
              if (!agentCheck) {
                if (result.error === "Application expired") {
                  setIsExpired(true)
                } else {
                  setIsUnauthorized(true) // Assume invalid or unauthorized if not expired
                }
              }
            }
            setIsLoading(false)
          })
          .catch(() => {
            // If fetch fails, treat as unauthorized or expired
            if (!agentCheck) setIsUnauthorized(true) // Default to unauthorized on fetch error
            setIsLoading(false)
          })
      } else {
        // If no inviteId and not in agent mode, it's unauthorized
        if (!agentCheck) setIsUnauthorized(true)
        setIsLoading(false)
      }
    }

    // Fast path for staff - handle immediately
    if (isLuminoStaff) {
      handleAgentStatusDetermined(true)
      return
    }

    // Otherwise check the partner allow-list API
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
          handleAgentStatusDetermined(false)
          return
        }
        const data: { success: boolean; emails?: string[] } = await res.json()

        // Check if email is in the list (case-insensitive)
        const isEmailInList = data.emails?.some((listEmail) => listEmail.toLowerCase() === normalizedEmail) ?? false

        handleAgentStatusDetermined(isEmailInList)
      } catch (err) {
        if ((err as any)?.name !== "AbortError") {
          console.error("get-partner-emails error:", err)
        }
        handleAgentStatusDetermined(false)
      }
    })()

    return () => ac.abort()
  }, [isLoaded, user, normalizedEmail])

  // Remove the duplicate agent name effect, it's now handled within handleAgentStatusDetermined
  // useEffect(() => {
  //   if (isAgentMode) {
  //     const savedName = localStorage.getItem("lumino_agent_name")
  //     if (savedName) {
  //       setAgentName(savedName)
  //     } else if (normalizedEmail) {
  //       // Auto-generate from email
  //       const username = normalizedEmail.split("@")[0].toUpperCase().replace(/[._-]/g, " ")
  //       setAgentName(username)
  //     }
  //   }
  // }, [isAgentMode, normalizedEmail])

  const handleAgentAction = async (action: "send" | "copy") => {
    if (!agentName || agentName.trim() === "") {
      toast({
        title: "Agent Name Required",
        description: "Please enter your agent name before performing this action.",
        variant: "destructive",
      })
      return
    }

    if (action === "send" && !merchantEmail) {
      toast({
        title: "Merchant Email Required",
        description: "Please enter the merchant's email address to send the invitation.",
        variant: "destructive",
      })
      return
    }

    setIsSubmittingAgentAction(true)
    setGeneratedLink("")

    try {
      let appId = applicationData?.id

      if (!appId) {
        const createRes = await fetch("/api/generate-merchant-invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agent_email: user?.primaryEmailAddress?.emailAddress,
            merchant_email: merchantEmail || null,
            agent_name: agentName.trim(), // Include agent name here
          }),
        })
        const createResult = await createRes.json()
        if (!createResult.success) throw new Error(createResult.error || "Failed to create application.")
        appId = createResult.inviteId
        setApplicationData({
          id: appId,
          agent_email: user?.primaryEmailAddress?.emailAddress,
          dba_email: merchantEmail || "",
          status: "draft", // Set initial status
          created_at: new Date().toISOString(),
        })
      }

      const response = await fetch("/api/save-prefill-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId: appId,
          formData,
          principals,
          merchantEmail,
          action,
          uploads,
          agentName: agentName.trim(), // Include agent name in request
        }),
      })
      const result = await response.json()
      if (!result.success) throw new Error(result.error || "Failed to process request.")

      setGeneratedLink(result.link)
      toast({
        title: "Success!",
        description: action === "send" ? "Invitation sent successfully." : "Link copied to clipboard.",
      })
      if (action === "copy") {
        await navigator.clipboard.writeText(result.link)
        // Redirect to invite page after successful copy
        setTimeout(() => {
          window.location.href = "/invite"
        }, 1500)
      } else {
        // Redirect to invite page after successful send
        setTimeout(() => {
          window.location.href = "/invite"
        }, 1500)
      }
    } catch (error) {
      console.error("Agent action error:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "An unknown error occurred.",
        variant: "destructive",
      })
    } finally {
      setIsSubmittingAgentAction(false)
    }
  }

  const updateFormData = (field: keyof FormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }))
  }

  const percentageTotal =
    (Number(formData.pctCardSwiped) || 0) +
    (Number(formData.pctManualImprint) || 0) +
    (Number(formData.pctManualNoImprint) || 0)

  /** Constant list for quick lookups. */
  const PCT_FIELDS = ["pctCardSwiped", "pctManualImprint", "pctManualNoImprint"] as const satisfies Readonly<PctField[]>

  /**
   * Tracks the last two fields the user *typed in* (order matters).
   * We always auto-balance the field that's *not* in this list.
   */
  const lastTwoPctTouchedRef = useRef<PctField[]>([])

  /** Clamp a number to [min, max]. */
  const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

  /** Safe numeric parse for our string inputs. Empty → 0. Non-number → 0. */
  const asNum = (s: string): number => (s.trim() === "" ? 0 : Number.isFinite(Number(s)) ? Number(s) : 0)

  /**
   * Update one of the three percentage fields and auto-balance the third so
   * that the trio always sums to 100 (when two fields have values).
   *
   * @param field - Which percentage field is being edited by the user.
   * @param raw   - The raw input string from the <Input />.
   *
   * @example
   * // User flow:
   * // 1) Type "50" in pctCardSwiped
   * // 2) Type "25" in pctManualImprint
   * // -> pctManualNoImprint becomes "25" automatically (100 - 50 - 25).
   */
  const updatePercentageField = (field: PctField, raw: string) => {
    // Allow empty string during typing; otherwise clamp 0..100.
    const normalized = raw === "" ? "" : String(clamp(Number(raw.replace(/[^\d.-]/g, "")) || 0, 0, 100))

    // Record typing order: keep only the last two fields typed.
    lastTwoPctTouchedRef.current = [...lastTwoPctTouchedRef.current.filter((f) => f !== field), field].slice(-2)

    setFormData((prev) => {
      const next: FormData = { ...prev, [field]: normalized }

      const locked = lastTwoPctTouchedRef.current
      // Only auto-balance when we actually have two "locked" fields with values.
      if (locked.length === 2 && locked.every((f) => next[f] !== "")) {
        const [aField, bField] = locked
        const autoField = PCT_FIELDS.find((f) => f !== aField && f !== bField) as PctField

        const a = asNum(next[aField])
        const b = asNum(next[bField])
        const remainder = clamp(100 - a - b, 0, 100)

        next[autoField] = String(remainder)
      }

      return next
    })

    // Clear inline error if present for the field being edited.
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }))
  }

  // Handle input focus to select all text
  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select()
  }

  // Reset function if needed
  const resetPercentages = () => {
    lastTwoPctTouchedRef.current = []
    setFormData((prev) => ({
      ...prev,
      pctCardSwiped: "",
      pctManualImprint: "",
      pctManualNoImprint: "",
    }))
  }

  const addPrincipal = () => {
    const newPrincipal: Principal = {
      id: Date.now().toString(), // Use timestamp for more unique IDs
      firstName: "",
      lastName: "",
      middleName: "",
      dob: "",
      ssn: "",
      email: "",
      phone: "",
      position: "",
      equity: "",
      govIdType: "",
      govIdNumber: "",
      govIdExpiration: "",
      govIdState: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      state: "",
      zip: "",
      zipExtended: "",
    }
    setPrincipals([...principals, newPrincipal])
  }

  const removePrincipal = (id: string) => {
    if (principals.length > 1) setPrincipals(principals.filter((p) => p.id !== id))
  }

  const updatePrincipal = (id: string, field: keyof Principal, value: string) => {
    setPrincipals(principals.map((p) => (p.id === id ? { ...p, [field]: value } : p)))
    // clear dynamic error for this principal field
    const index = principals.findIndex((p) => p.id === id)
    const key = `principal${index}${field[0].toUpperCase()}${field.slice(1)}` // This key generation might be fragile if order changes
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: "" }))
  }

  const sanitizeFileName = (fileName: string): string => {
    return (
      fileName
        // Remove or replace special characters that cause URL issues
        .replace(/[^a-zA-Z0-9.-]/g, "_") // Replace any non-alphanumeric chars with underscore
        .replace(/_{2,}/g, "_") // Replace multiple underscores with single
        .replace(/^_|_$/g, "") // Remove leading/trailing underscores
        .toLowerCase()
    ) // Convert to lowercase for consistency
  }

  const handleFileUpload = async (key: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // File size validation
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setUploads((prev) => ({
        ...prev,
        [key]: {
          ...(prev[key] || {}), // Ensure prev[key] exists
          file,
          preview: null,
          uploadType: "file",
          uploadStatus: "error",
          errorMessage: `File size exceeds ${MAX_FILE_SIZE_MB}MB. Please upload a smaller file.`,
          fileName: file.name,
        },
      }))
      return
    }

    // Set uploading state
    setUploads((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] || {}), // Ensure prev[key] exists
        file,
        uploadType: "file",
        uploadStatus: "uploading",
        fileName: file.name,
        errorMessage: undefined,
      },
    }))

    try {
      const supabase = createClient()

      // Generate unique filename
      const timestamp = Date.now()
      const sanitizedOriginalName = sanitizeFileName(file.name)
      const fileName = `${formData.dbaEmail?.replace(/[@.]/g, "_") || "temp"}/${timestamp}_${key}_${sanitizedOriginalName}`

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage.from("merchant-uploads").upload(fileName, file, {
        cacheControl: "3600",
        upsert: false,
      })

      if (uploadError) {
        throw uploadError
      }

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("merchant-uploads").getPublicUrl(fileName)

      // Generate preview for images
      const preview = null
      if (file.type.startsWith("image/")) {
        const reader = new FileReader()
        reader.onloadend = () => {
          setUploads((prev) => ({
            ...prev,
            [key]: {
              ...(prev[key] || {}),
              preview: reader.result as string,
            },
          }))
        }
        reader.readAsDataURL(file)
      }

      // Update with success
      setUploads((prev) => ({
        ...prev,
        [key]: {
          ...(prev[key] || {}),
          file,
          preview,
          uploadType: "file",
          uploadStatus: "success",
          uploadedUrl: publicUrl,
          fileName: file.name,
          errorMessage: undefined,
        },
      }))
    } catch (error: any) {
      console.error("Upload error:", error)

      // Determine error type for appropriate color coding
      let errorMessage = "Upload failed. Please try again."
      let status: "error" | "warning" = "error"

      if (error.message?.includes("413") || error.message?.includes("too large")) {
        errorMessage = "File too large. Please upload a smaller file."
        status = "warning"
      } else if (error.message?.includes("network") || error.message?.includes("fetch")) {
        errorMessage = "Network error. Please check your connection and retry."
        status = "error"
      }

      setUploads((prev) => ({
        ...prev,
        [key]: {
          ...(prev[key] || {}),
          file,
          preview: null,
          uploadType: "file",
          uploadStatus: status,
          errorMessage,
          fileName: file.name,
        },
      }))
    }
  }

  /** Try to load the URL as an image (no CORS header required to test display). */
  function probeImage(url: string, timeoutMs = 5000): Promise<boolean> {
    return new Promise((resolve) => {
      const img = new Image()
      let done = false
      const finish = (ok: boolean) => {
        if (!done) {
          done = true
          resolve(ok)
        }
      }

      const t = setTimeout(() => finish(false), timeoutMs)
      img.onload = () => {
        clearTimeout(t)
        finish(true)
      }
      img.onerror = () => {
        clearTimeout(t)
        finish(false)
      }
      img.src = url
    })
  }

  const validateUrl = async (
    url: string,
  ): Promise<{ isValid: boolean; isAcceptedFile: boolean; warning?: string; contentType?: string }> => {
    // First check if it's a valid URL
    try {
      new URL(url)
    } catch {
      return { isValid: false, isAcceptedFile: false }
    }

    // Accepted content types
    const acceptedTypes = {
      images: ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp", "image/bmp", "image/svg+xml"],
      documents: [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "text/csv",
        "text/plain",
      ],
    }

    const allAcceptedTypes = [...acceptedTypes.images, ...acceptedTypes.documents]

    // Check file extensions as fallback - fix the logic here
    const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg"]
    const docExtensions = [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".csv", ".txt"]
    const allExtensions = [...imageExtensions, ...docExtensions]

    const lowerUrl = url.toLowerCase()
    // Fix: Check if URL ends with extension, not just contains it
    const hasAcceptedExtension = allExtensions.some((ext) => {
      // Check both ending with extension and having extension followed by query params
      return lowerUrl.endsWith(ext) || lowerUrl.includes(ext + "?") || lowerUrl.includes(ext + "#")
    })

    // Try to check content type with fetch
    let contentType: string | undefined
    let fetchSucceeded = false

    try {
      console.log("Attempting to fetch URL:", url)

      // Try HEAD request first
      const response = await fetch(url, {
        method: "HEAD",
        mode: "cors",
        // Add no-cache headers to avoid cached responses
        headers: {
          "Cache-Control": "no-cache",
        },
      })

      console.log("HEAD response status:", response.status)
      contentType = response.headers.get("content-type")?.toLowerCase().split(";")[0]
      console.log("Content-Type from HEAD:", contentType)
      fetchSucceeded = true
    } catch (headError) {
      console.log("HEAD request failed:", headError.message)

      // If HEAD fails, try GET request (some servers don't support HEAD)
      try {
        const response = await fetch(url, {
          method: "GET",
          mode: "cors",
          headers: {
            "Cache-Control": "no-cache",
            Range: "bytes=0-0", // Only fetch first byte
          },
        })

        console.log("GET response status:", response.status)
        contentType = response.headers.get("content-type")?.toLowerCase().split(";")[0]
        console.log("Content-Type from GET:", contentType)
        fetchSucceeded = true
      } catch (getError) {
        console.log("GET request also failed:", getError.message)
        fetchSucceeded = false
      }
    }

    // If we got a content type and it's accepted
    if (fetchSucceeded && contentType && allAcceptedTypes.includes(contentType)) {
      return {
        isValid: true,
        isAcceptedFile: true,
        contentType,
      }
    }

    // If fetch succeeded but content type not recognized, but has good extension
    if (fetchSucceeded && hasAcceptedExtension) {
      return {
        isValid: true,
        isAcceptedFile: true,
        warning: `Could not verify file type (got: ${contentType || "unknown"}), but URL appears to have a valid file extension.`,
        contentType,
      }
    }

    // If fetch failed but has good extension (common case due to CORS)
    if (!fetchSucceeded && hasAcceptedExtension) {
      return {
        isValid: true,
        isAcceptedFile: true,
        warning:
          "Could not verify file type due to network restrictions, but URL appears to have a valid file extension.",
      }
    }

    // If fetch succeeded but no good content type and no good extension
    if (fetchSucceeded) {
      return {
        isValid: true,
        isAcceptedFile: false,
        warning: `File type not supported (got: ${contentType || "unknown"}). Please ensure this is an image, PDF, or document.`,
        contentType,
      }
    }

    // If fetch failed and no good extension, try probing as image
    if (!fetchSucceeded && !hasAcceptedExtension) {
      try {
        const isImg = await probeImage(url)
        if (isImg) {
          return {
            isValid: true,
            isAcceptedFile: true,
            warning: "Verified by loading as image (no Content-Type header exposed).",
            contentType: "image/*",
          }
        }
      } catch (probeError) {
        console.log("Image probe failed:", probeError)
      }
    }

    // For URLs without extensions that we can't verify (like your CloudFront URL)
    // Let's be more permissive and give a warning instead of failing
    return {
      isValid: true,
      isAcceptedFile: true, // Changed from false to true
      warning:
        "Could not verify file type and no file extension found. Please ensure this link points to an image, PDF, or document file.",
    }
  }

  const validatePercentages = () => {
    const total =
      (Number(formData.pctCardSwiped) || 0) +
      (Number(formData.pctManualImprint) || 0) +
      (Number(formData.pctManualNoImprint) || 0)

    // Allow 99-101% (within 1% tolerance)
    if (Math.abs(total - 100) > 1 && total !== 0) {
      // added total !== 0 to avoid error on initial load
      setErrors((prev) => ({
        ...prev,
        pctCardSwiped: `Transaction percentages must total approximately 100% (currently ${total}%)`,
      }))
      return false
    }

    return true
  }

  const handleUrlUpload = async (key: string, url: string) => {
    // Resetting the upload state completely when the URL is cleared
    if (!url.trim()) {
      setUploads((prev) => ({
        ...prev,
        [key]: {
          file: null,
          url: "",
          uploadType: "url",
          preview: null,
          uploadStatus: "idle",
          errorMessage: undefined,
          fileName: undefined,
          uploadedUrl: undefined,
        },
      }))
      return
    }

    // Set loading state while validating
    setUploads((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] || {}),
        url,
        preview: null,
        uploadType: "url",
        uploadStatus: "uploading",
        errorMessage: "Validating URL...",
      },
    }))

    try {
      const validation = await validateUrl(url)
      console.log("Validation result:", validation)

      if (!validation.isValid) {
        setUploads((prev) => ({
          ...prev,
          [key]: {
            ...(prev[key] || {}),
            url,
            preview: null,
            uploadType: "url",
            uploadStatus: "error",
            errorMessage: "Please enter a valid URL",
          },
        }))
        return
      }

      if (!validation.isAcceptedFile) {
        setUploads((prev) => ({
          ...prev,
          [key]: {
            ...(prev[key] || {}),
            url,
            preview: null,
            uploadType: "url",
            uploadStatus: "error",
            errorMessage: "This URL does not appear to be an accepted file type (images, PDFs, or documents).",
          },
        }))
        return
      }

      const status = validation.warning ? "warning" : "success"

      setUploads((prev) => ({
        ...prev,
        [key]: {
          ...(prev[key] || {}),
          url,
          preview: null,
          uploadType: "url",
          uploadStatus: status,
          errorMessage: validation.warning,
        },
      }))
    } catch (error) {
      console.error("URL validation failed:", error)
      setUploads((prev) => ({
        ...prev,
        [key]: {
          ...(prev[key] || {}),
          url,
          preview: null,
          uploadType: "url",
          uploadStatus: "error",
          errorMessage: "Failed to validate URL. Please try again.",
        },
      }))
    }
  }

  const toggleUploadType = (key: string, type: "file" | "url") => {
    setUploads((prev) => ({
      ...prev,
      [key]: {
        file: null,
        url: "",
        uploadType: type,
        preview: null,
        uploadStatus: "idle",
        errorMessage: undefined,
        fileName: undefined,
        uploadedUrl: undefined,
      },
    }))
  }

  // 1) change validateStep to *return* errors, and only set state when called in Next
  const validateStep = (stepIndex: number, isFinalSubmission = false): Record<string, string> => {
    const newErrors: Record<string, string> = {}
    const stepId = steps[stepIndex]?.id
    const shouldEnforce = (!isAgentMode && !isSkipMode) || isFinalSubmission

    switch (stepId) {
      case "merchant-info":
        if (!formData.dbaName) newErrors.dbaName = "DBA Name is required"
        if (!formData.dbaEmail) newErrors.dbaEmail = "DBA Email is required"
        if (!formData.ownershipType) newErrors.ownershipType = "Ownership Type is required"
        if (!formData.legalName) newErrors.legalName = "Legal Name is required"
        if (shouldEnforce && !formData.federalTaxId) newErrors.federalTaxId = "Federal Tax ID is required"
        if (!formData.dbaAddressLine1) newErrors.dbaAddressLine1 = "Address is required"
        if (!formData.dbaCity) newErrors.dbaCity = "City is required"
        if (!formData.dbaState) newErrors.dbaState = "State is required"
        if (!formData.dbaZip) newErrors.dbaZip = "ZIP is required"

        // ➕ NEW: Legal Address required if legalDiffers
        if (formData.legalDiffers) {
          if (!formData.legalAddressLine1) newErrors.legalAddressLine1 = "Legal Address Line 1 is required"
          if (!formData.legalCity) newErrors.legalCity = "City is required"
          if (!formData.legalState) newErrors.legalState = "State is required"
          if (!formData.legalZip) newErrors.legalZip = "ZIP is required"
        }
        break

      case "merchant-profile":
        if (!formData.monthlyVolume) newErrors.monthlyVolume = "Monthly Volume is required"
        if (!formData.averageTicket) newErrors.averageTicket = "Average Ticket is required"
        if (!formData.highestTicket) newErrors.highestTicket = "Highest Ticket is required"
        if (!formData.businessType) newErrors.businessType = "Business Type is required"
        const totalPct =
          (Number(formData.pctCardSwiped) || 0) +
          (Number(formData.pctManualImprint) || 0) +
          (Number(formData.pctManualNoImprint) || 0)

        // Allow 99-101% (within 1% tolerance)
        if (Math.abs(totalPct - 100) > 1 && totalPct !== 0) {
          // Added totalPct !== 0 to avoid error on initial load
          newErrors.pctCardSwiped = `Transaction percentages must total approximately 100% (currently ${totalPct}%)`
        }
        break

      // Added validation for Account Rates step
      case "account-rates":
        // Validation for optional card types is informational, not strictly required
        // if (shouldEnforce) {
        //   // Add specific validation if needed for rate programs
        // }
        break

      case "owners":
        principals.forEach((p, index) => {
          if (!p.firstName) newErrors[`principal${index}FirstName`] = "First Name is required"
          if (!p.lastName) newErrors[`principal${index}LastName`] = "Last Name is required"
          if (!p.dob) newErrors[`principal${index}Dob`] = "Date of Birth is required"
          // ➕ NEW: Driver's License required: number, issuing state, expiration
          if (shouldEnforce && !p.govIdNumber)
            newErrors[`principal${index}GovIdNumber`] = "Driver's License Number is required"
          if (shouldEnforce && !p.govIdState) newErrors[`principal${index}GovIdState`] = "Issuing State is required"
          if (shouldEnforce && !p.govIdExpiration)
            newErrors[`principal${index}GovIdExpiration`] = "Expiration is required"

          if (!p.email) newErrors[`principal${index}Email`] = "Email is required"
          if (!p.position) newErrors[`principal${index}Position`] = "Position is required"
        })

        if (!formData.managingMemberSameAs) {
          if (!formData.managingMemberFirstName) newErrors.managingMemberFirstName = "First Name is required"
          if (!formData.managingMemberLastName) newErrors.managingMemberLastName = "Last Name is required"
          if (!formData.managingMemberEmail) newErrors.managingMemberEmail = "Email is required"
          if (!formData.managingMemberPosition) newErrors.managingMemberPosition = "Position is required"
        }
        break

      case "banking":
        if (shouldEnforce && !formData.bankName) newErrors.bankName = "Bank Name is required"
        if (shouldEnforce && !formData.routingNumber) newErrors.routingNumber = "Routing Number is required"
        if (shouldEnforce && !formData.accountNumber) newErrors.accountNumber = "Account Number is required"
        break

      case "review":
        if (!formData.agreementScrolled) newErrors.agreement = "You must read the agreement"
        if (!formData.signatureFullName) newErrors.signature = "Signature is required"
        if (!formData.certificationAck) newErrors.certification = "You must acknowledge the certification"
        break
    }

    return newErrors
  }

  const updateStepStatus = (stepIndex: number, status: StepStatus) => {
    setSteps((prev) => prev.map((step, index) => (index === stepIndex ? { ...step, status } : step)))
  }

  // 2) update Next to set errors only for current step (so fields turn red immediately)
  const handleNext = () => {
    // If we are not in Agent Mode or Skip Mode, then perform validation
    if (!isAgentMode && !isSkipMode) {
      const errs = validateStep(currentStep)
      setErrors(errs)
      if (Object.keys(errs).length === 0) {
        updateStepStatus(currentStep, "completed")
        if (currentStep < steps.length - 2) {
          const nextStep = currentStep + 1
          setCurrentStep(nextStep)
          if (steps[nextStep].status === "not_visited") updateStepStatus(nextStep, "visited")
        }
      } else {
        updateStepStatus(currentStep, "error")
      }
    } else {
      // Skip validation in skip mode or agent mode
      if (currentStep < steps.length - 2) {
        const nextStep = currentStep + 1
        setCurrentStep(nextStep)
        if (steps[nextStep].status === "not_visited") updateStepStatus(nextStep, "visited")
      }
    }
  }

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1)
  }

  const handleStepClick = (stepIndex: number) => {
    if (isAgentMode || isSkipMode) {
      setCurrentStep(stepIndex)
      if (steps[stepIndex].status === "not_visited") updateStepStatus(stepIndex, "visited")
      return
    }
    if (stepIndex <= currentStep || steps[stepIndex - 1]?.status === "completed") {
      setCurrentStep(stepIndex)
      if (steps[stepIndex].status === "not_visited") updateStepStatus(stepIndex, "visited")
    }
  }

  const handleSubmit = async () => {
    const reviewStepIndex = steps.findIndex((s) => s.id === "review")
    let mergedErrors: Record<string, string> = {}

    // Validate all steps up to and including the review step
    for (let i = 1; i <= reviewStepIndex; i++) {
      const errs = validateStep(i, true) // Pass true for isFinalSubmission
      if (Object.keys(errs).length) {
        mergedErrors = { ...mergedErrors, ...errs }
        updateStepStatus(i, "error")
      } else {
        // If the step was previously marked as error, reset it to visited if no errors now
        if (steps[i].status === "error") updateStepStatus(i, "visited")
      }
    }

    setErrors(mergedErrors)

    if (Object.keys(mergedErrors).length > 0) {
      toast({
        title: "Validation Failed",
        description: "Please correct the errors on the highlighted steps before submitting.",
        variant: "destructive",
      })
      // Scroll to the first step with an error
      const firstErrorStepIndex = steps.findIndex((_, index) => Object.keys(validateStep(index, true)).length > 0)
      if (firstErrorStepIndex !== -1) {
        handleStepClick(firstErrorStepIndex)
      }
      return
    }
    console.log("Starting form submission...")
    setIsSubmitting(true)

    try {
      const formDataToSubmit = new FormData()

      // Add JSON data
      const jsonData = {
        ...formData,
        id: applicationData?.id,
        principals,
        terminals: formData.terminals,
        // Filter out undefined uploads and correctly format URLs/files
        uploads: Object.entries(uploads)
          .filter(([_, upload]) => upload && (upload.uploadedUrl || upload.url)) // Only include uploads with a URL
          .reduce(
            (acc, [key, upload]) => {
              if (upload.uploadType === "url") {
                acc[key] = { uploadType: "url", url: upload.url }
              } else if (upload.uploadedUrl) {
                acc[key] = { uploadType: "file", url: upload.uploadedUrl }
              }
              return acc
            },
            {} as Record<string, { uploadType: "file" | "url"; url: string }>,
          ),
      }

      formDataToSubmit.append("data", JSON.stringify(jsonData))

      // Files are already uploaded to Supabase, so we don't need to append them again
      // The uploadedUrl from each successful upload will be used

      const response = await fetch("/api/submit-merchant-application", {
        method: "POST",
        body: formDataToSubmit,
      })

      const result = await response.json()

      if (result.success) {
        console.log("Application submitted successfully:", result.applicationId)
        updateStepStatus(reviewStepIndex, "completed")
        const confirmationStepIndex = steps.findIndex((s) => s.id === "confirmation")
        setCurrentStep(confirmationStepIndex)
        updateStepStatus(confirmationStepIndex, "visited") // Mark confirmation as visited

        const key = getLocalStorageKey()
        if (key) {
          localStorage.removeItem(key)
          console.log("[v0] Cleared draft from localStorage after submission")
        }

        setIsSubmitted(true)
      } else {
        throw new Error(result.error || "Submission failed")
      }
    } catch (error) {
      console.error("Submission error:", error)
      toast({
        title: "Submission Error",
        description: error instanceof Error ? error.message : "An unknown error occurred.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const generatePDF = async () => {
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
      checkPageBreak(30) // Check if we have space for section header

      doc.setFontSize(14)
      doc.setFont("helvetica", "bold")
      doc.text(title, 20, yPosition)
      yPosition += 10

      doc.setFontSize(10)
      doc.setFont("helvetica", "normal")

      Object.entries(data).forEach(([key, value]) => {
        if (value && value !== "" && value !== null && value !== undefined) {
          checkPageBreak(8) // Check space for each line

          // Format currency values
          let displayValue = value
          if (
            key.toLowerCase().includes("volume") ||
            key.toLowerCase().includes("ticket") ||
            key.toLowerCase().includes("price") ||
            key.toLowerCase().includes("amount")
          ) {
            const numValue = Number.parseFloat(value.toString().replace(/[^0-9.-]+/g, ""))
            if (!isNaN(numValue)) {
              displayValue = `$${numValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            }
          }

          // Handle special fields like percentages
          if (key.toLowerCase().includes("%")) {
            displayValue = `${Number.parseFloat(value).toFixed(2)}%`
          }

          // Handle email and phone number redaction if not agent mode
          const isSensitiveField =
            key.toLowerCase().includes("email") ||
            key.toLowerCase().includes("phone") ||
            key.toLowerCase().includes("ssn") ||
            key.toLowerCase().includes("routing") ||
            key.toLowerCase().includes("account") ||
            key.toLowerCase().includes("tax id")
          if (isSensitiveField && !isAgentMode && value !== "***REDACTED***") {
            displayValue = "***REDACTED***"
          }

          doc.text(`${key}: ${displayValue}`, 25, yPosition)
          yPosition += 5
        }
      })
      yPosition += 8
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
      `${formData.dbaCity}, ${formData.dbaState} ${formData.dbaZip}${formData.dbaZipExtended ? "-" + formData.dbaZipExtended : ""}`,
    ]
      .filter(Boolean)
      .join(", ")

    if (dbaAddress) {
      addSection("Business Address", {
        "DBA Address": dbaAddress,
      })
    }

    if (formData.legalDiffers) {
      const legalAddress = [
        formData.legalAddressLine1,
        formData.legalAddressLine2,
        `${formData.legalCity}, ${formData.legalState} ${formData.legalZip}${formData.legalZipExtended ? "-" + formData.legalZipExtended : ""}`,
      ]
        .filter(Boolean)
        .join(", ")
      if (legalAddress) {
        addSection("Legal Address", { "Legal Address": legalAddress })
      }
    }

    // Business Profile
    addSection("Business Profile", {
      "Monthly Volume": formData.monthlyVolume,
      "Average Ticket": formData.averageTicket,
      "Highest Ticket": formData.highestTicket,
      "Card Swiped %": formData.pctCardSwiped ? `${Number.parseFloat(formData.pctCardSwiped).toFixed(2)}%` : "",
      "Manual Imprint %": formData.pctManualImprint
        ? `${Number.parseFloat(formData.pctManualImprint).toFixed(2)}%`
        : "",
      "Manual No Imprint %": formData.pctManualNoImprint
        ? `${Number.parseFloat(formData.pctManualNoImprint).toFixed(2)}%`
        : "",
      "Refund Policy": formData.refundPolicy,
      "Previous Processor": formData.previousProcessor,
      "Reason for Termination": formData.reasonForTermination,
      "Seasonal Business": formData.seasonalBusiness ? "Yes" : "No",
      "Seasonal Months": formData.seasonalBusiness ? formData.seasonalMonths.join(", ") : "",
      "Uses Fulfillment House": formData.usesFulfillmentHouse ? "Yes" : "No",
      "Uses Third Parties": formData.usesThirdParties ? "Yes" : "No",
      "Third Parties List": formData.usesThirdParties ? formData.thirdPartiesList : "",
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
          originalPrice > 0 && originalPrice > finalPrice
            ? ` (${(((originalPrice - finalPrice) / originalPrice) * 100).toFixed(1)}% discount)`
            : ""

        doc.text(`${index + 1}. ${terminal.name}`, 25, yPosition)
        yPosition += 5
        doc.text(`   Final Price: ${formatDiscountedPrice(finalPrice, originalPrice)}`, 25, yPosition)
        if (originalPrice !== finalPrice) {
          yPosition += 5
          doc.text(`   Original Price: $${originalPrice.toFixed(2)}`, 25, yPosition)
        }
        if (terminal.quantity && terminal.quantity > 1) {
          yPosition += 5
          doc.text(`   Quantity: ${terminal.quantity}`, 25, yPosition)
        }
        yPosition += 8
      })
      yPosition += 5
    }

    // Banking Information (be careful with sensitive data)
    if (formData.bankName) {
      addSection("Banking Information", {
        "Bank Name": formData.bankName,
        "Routing Number": formData.routingNumber, // Will be redacted if not agent
        "Account Number": formData.accountNumber, // Will be redacted if not agent
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
        if (principal.firstName || principal.lastName || principal.position || principal.email) {
          checkPageBreak(12)

          const name = `${principal.firstName || ""} ${principal.lastName || ""}`.trim()
          doc.text(`${index + 1}. ${name}`, 25, yPosition)
          yPosition += 5

          if (principal.position) {
            doc.text(`   Position: ${principal.position}`, 25, yPosition)
            yPosition += 5
          }
          if (principal.email && !isAgentMode) {
            doc.text(`   Email: ***REDACTED***`, 25, yPosition)
            yPosition += 5
          } else if (principal.email) {
            doc.text(`   Email: ${principal.email}`, 25, yPosition)
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
    doc.text(`Status: ${applicationData?.status || "Draft"}`, 25, yPosition)

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

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-")
    const merchantName = formData.dbaName ? formData.dbaName.replace(/[^a-zA-Z0-9]/g, "-") : "merchant"

    doc.save(`${merchantName}-application-${timestamp}.pdf`)
  }

  const handleAgreementScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget
    // Add a small buffer to account for potential scroll inaccuracies
    const isAtBottom = element.scrollHeight - element.scrollTop <= element.clientHeight + 5
    if (isAtBottom && !formData.agreementScrolled) updateFormData("agreementScrolled", true)
  }

  const renderUnauthorizedAccess = () => {
    const subject = "Request for Merchant Application Invitation"
    const body = `Hello Lumino Support Team,

I would like to request a merchant application invitation to be sent to this email so I can complete my merchant onboarding.

Thank you!`

    const mailtoLink = `mailto:support@golumino.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`

    return (
      <div className="max-w-2xl mx-auto p-6">
        <Card className="text-center">
          <CardHeader>
            <CardTitle className="text-2xl font-medium">Invitation Required</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <p className="text-lg text-gray-700">
                You need a valid application ID to access this merchant application.
              </p>
              <p className="text-gray-600">
                Please use the URL provided to you with your application ID, or contact us for an invitation.
              </p>
            </div>

            <div className="space-y-4">
              <Button asChild className="w-full bg-blue-600 hover:bg-blue-700">
                <a href={mailtoLink}>
                  <Mail className="mr-2 h-4 w-4" /> Request Application Invitation
                </a>
              </Button>

              <p className="text-sm text-gray-500">
                This will open your email client with a pre-filled message to our support team.
              </p>
            </div>

            <div className="border-t pt-6 mt-6">
              <p className="text-sm text-gray-600 mb-3">Are you a Lumino account manager?</p>
              <Button asChild variant="outline" className="w-full bg-transparent">
                <a href="/sign-in">Account Manager Sign-In</a>
              </Button>
              <UserButton />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const renderStepIndicator = () => (
    <div className="mb-8 overflow-x-auto">
      <div className="flex justify-between min-w-max px-4 py-1">
        {steps.map((step, index) => {
          if (step.id === "confirmation") return null // Skip confirmation step in indicator
          const isActive = index === currentStep
          let statusClass = "bg-white border-gray-300 text-gray-500"
          let icon = <span className="text-sm font-medium">{index + 1}</span>
          if (step.status === "completed") {
            statusClass = "bg-green-500 border-green-500 text-white"
            icon = <Check className="w-4 h-4" />
          } else if (step.status === "error") {
            statusClass = "bg-red-500 border-red-500 text-white"
            icon = <AlertTriangle className="w-4 h-4" />
          } else if (isActive) {
            statusClass = "bg-blue-500 border-blue-500 text-white"
          }
          const canNavigate =
            isAgentMode || isSkipMode || index <= currentStep || steps[index - 1]?.status === "completed"
          return (
            <div key={step.id} className="flex flex-col items-center min-w-0 flex-1 mx-2">
              <button
                onClick={() => handleStepClick(index)}
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors",
                  statusClass,
                  canNavigate ? "cursor-pointer hover:scale-105" : "cursor-not-allowed opacity-50",
                )}
                disabled={!canNavigate}
              >
                {icon}
              </button>
              <p
                className={`mt-2 text-center text-xs whitespace-nowrap ${isActive ? "text-blue-600 font-semibold" : "text-gray-600"}`}
              >
                {step.label}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )

  const FileUploadComponent = ({
    uploadKey,
    label,
    description,
  }: { uploadKey: string; label: string; description: string }) => {
    const upload = uploads[uploadKey] || {
      file: null,
      url: "",
      uploadType: "file", // Default to file upload
      preview: null,
      uploadStatus: "idle",
      errorMessage: undefined,
      fileName: undefined,
      uploadedUrl: undefined,
    }

    // Create a consistent reset function
    const resetUpload = () => {
      setUploads((prev) => ({
        ...prev,
        [uploadKey]: {
          file: null,
          url: "",
          uploadType: upload.uploadType, // Keep the current upload type
          preview: null,
          uploadStatus: "idle",
          errorMessage: undefined,
          fileName: undefined,
          uploadedUrl: undefined,
        },
      }))
    }

    const StatusIcon = () => {
      switch (upload.uploadStatus) {
        case "uploading":
          return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
        case "success":
          return <CheckCircle className="w-4 h-4 text-green-500" />
        case "warning":
          return <AlertCircle className="w-4 h-4 text-yellow-500" />
        case "error":
          return <XCircle className="w-4 h-4 text-red-500" />
        default:
          return null
      }
    }

    const getStatusColor = () => {
      switch (upload.uploadStatus) {
        case "success":
          return "text-green-600"
        case "warning":
          return "text-yellow-600"
        case "error":
          return "text-red-600"
        case "uploading":
          return "text-blue-600"
        default:
          return "text-gray-600"
      }
    }

    return (
      <div className="space-y-4">
        <div className="mb-6">
          <Label className="text-sm font-medium">{label}</Label>
          <p className="text-xs text-gray-500">{description}</p>
        </div>
        <div className="relative border border-gray-200 rounded-lg">
          <div className="flex justify-center pt-4 pb-2">
            <div className="inline-flex bg-gray-100 rounded-lg p-1 border border-gray-200">
              <button
                type="button"
                className={`flex items-center px-3 py-2 text-xs font-medium rounded-md transition-all ${upload.uploadType === "file" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                onClick={() => toggleUploadType(uploadKey, "file")}
              >
                <Upload className="w-3 h-3 mr-2" />
                File Upload
              </button>
              <button
                type="button"
                className={`flex items-center px-3 py-2 text-xs font-medium rounded-md transition-all ${upload.uploadType === "url" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                onClick={() => toggleUploadType(uploadKey, "url")}
              >
                <LinkIcon className="w-3 h-3 mr-2" />
                Link URL
              </button>
            </div>
          </div>
          <div className="px-4 pb-4">
            {upload.uploadType === "file" ? (
              <div className="space-y-3">
                <div className="relative border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                  {upload.preview ? (
                    <div className="relative">
                      <img src={upload.preview || "/placeholder.svg"} alt="Preview" className="max-h-32 mx-auto" />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={resetUpload} // Use the consistent reset function
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Upload className="mx-auto h-8 w-8 text-gray-400" />
                      <p className="mt-2 text-sm text-gray-600">Click to upload or drag and drop</p>
                      <p className="text-xs text-gray-500">
                        Supported: {SUPPORTED_FILE_TYPES.join(", ")} (Max {MAX_FILE_SIZE_MB}MB)
                      </p>
                    </>
                  )}
                  <Input
                    type="file"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onChange={(e) => handleFileUpload(uploadKey, e)}
                    accept={SUPPORTED_FILE_TYPES.map((type) => `.${type.toLowerCase()}`).join(",")}
                    disabled={upload.uploadStatus === "uploading"}
                  />
                </div>

                {upload.fileName && (
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <StatusIcon />
                      <span className={`text-sm font-medium ${getStatusColor()}`}>{upload.fileName}</span>
                    </div>
                    {/* Show X button for success, error, and warning states */}
                    {(upload.uploadStatus === "success" ||
                      upload.uploadStatus === "error" ||
                      upload.uploadStatus === "warning") && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={resetUpload} // Use the consistent reset function
                        title="Remove file"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                )}

                {upload.errorMessage && (
                  <div
                    className={`text-xs p-2 rounded ${
                      upload.uploadStatus === "error"
                        ? "bg-red-50 text-red-600"
                        : upload.uploadStatus === "warning"
                          ? "bg-yellow-50 text-yellow-600"
                          : "bg-gray-50 text-gray-600"
                    }`}
                  >
                    {upload.errorMessage}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative">
                  <Input
                    placeholder="Add image URL (e.g., Google Drive link)"
                    value={upload.url}
                    onChange={(e) => handleUrlUpload(uploadKey, e.target.value)}
                    className="pr-20"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      try {
                        const text = await navigator.clipboard.readText()
                        if (text.trim()) handleUrlUpload(uploadKey, text.trim())
                      } catch (error) {
                        console.error("Failed to read clipboard:", error)
                      }
                    }}
                    className="absolute right-1 top-1/2 -translate-y-1/2 px-2 py-1 h-auto text-xs font-medium text-blue-600 hover:bg-blue-50 border border-blue-300 rounded"
                  >
                    PASTE
                  </Button>
                </div>

                {upload.url && (
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <StatusIcon />
                      <span className={`text-xs ${getStatusColor()}`}>
                        {upload.uploadStatus === "success"
                          ? "✓ URL added successfully"
                          : upload.uploadStatus === "warning"
                            ? "⚠ URL added with warning"
                            : upload.uploadStatus === "error"
                              ? "✗ Invalid URL"
                              : "URL added"}
                      </span>
                    </div>
                    {/* Add X button for URL clearing */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={resetUpload} // Use the consistent reset function
                      title="Clear URL"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}

                {upload.errorMessage && (
                  <div
                    className={`text-xs p-2 rounded ${
                      upload.uploadStatus === "error"
                        ? "bg-red-50 text-red-600"
                        : upload.uploadStatus === "warning"
                          ? "bg-yellow-50 text-yellow-600"
                          : "bg-gray-50 text-gray-600"
                    }`}
                  >
                    {upload.errorMessage}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  const formatDiscountedPrice = (price: number, originalPrice: number) => {
    if (price === originalPrice) {
      return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }
    if (price === 0) {
      return (
        <span className="inline-flex items-center gap-2">
          <span className="font-bold text-green-600">FREE</span>
          <s className="text-gray-500">
            ${originalPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </s>
        </span>
      )
    }
    const discount = originalPrice > 0 ? ((originalPrice - price) / originalPrice) * 100 : 0
    return (
      <span className="inline-flex items-center gap-2 flex-wrap">
        <span className="font-bold">
          ${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        <s className="text-gray-500">
          ${originalPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </s>
        <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-0.5 rounded-full">
          {discount.toFixed(0)}% OFF
        </span>
      </span>
    )
  }

  const renderWelcomeStep = () => (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto mb-4">
          <img src="/images/design-mode/Asset%201(1).png" alt="LUMINO" className="h-12 mx-auto" />
          <p className="text-sm text-gray-600 mt-2">
            4201 Main St Suite 201, Houston, TX 77002 | 1-866-488-4168 | support@golumino.com | www.golumino.com
          </p>
        </div>
        <CardTitle className="text-2xl">Welcome to Lumino - Payments with Purpose</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {formData.terminals && formData.terminals.length > 0 && (
          <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-md">
            <div className="flex">
              <div className="flex-shrink-0">
                <Terminal className="h-5 w-5 text-blue-500" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">Your Selected Terminal(s)</h3>
                <div className="mt-2 text-sm text-blue-700">
                  <p>Your account manager has pre-selected the following terminal(s) for you:</p>
                  <ul className="list-none mt-2 space-y-2">
                    {formData.terminals.map((t, i) => (
                      <li key={i}>
                        <span className="font-semibold">{t.name}</span>:{" "}
                        {formatDiscountedPrice(t.price, t.originalPrice)}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
        <div className="prose max-w-none">
          <p>
            <strong>Dear Merchants,</strong>
          </p>
          <p>
            Thank you for choosing to partner with Lumino. Our founding team was forged in the Gamified Fullstack
            Fintech space and we are excited to bring our expertise to help grow your business through innovative
            payment solutions.
          </p>
          <p>
            This application will take approximately <strong>10-15 minutes</strong> to complete. Please have the
            following information ready:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Business information and ownership details</li>
            <li>Banking information and voided check</li>
            <li>Government-issued ID for all principals</li>
            <li>Business license and tax documentation</li>
            <li>Processing statements (if currently processing)</li>
          </ul>
          <p>Our team will review your application and contact you within 24-48 hours with next steps.</p>
        </div>
      </CardContent>
    </Card>
  )

  const renderAgentWelcomeStep = () => (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-4">
          <UserButton />
          <div>
            <CardTitle>Agent Pre-fill Instructions</CardTitle>
            <CardDescription>How to prepare and send an application to a merchant.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 prose max-w-none">
        <div className="not-prose mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <label htmlFor="agentName" className="block text-sm font-medium text-gray-700 mb-2">
            Your Agent Name (Required)
          </label>
          <input
            id="agentName"
            type="text"
            value={agentName}
            onChange={(e) => {
              const value = e.target.value.toUpperCase()
              setAgentName(value)
              localStorage.setItem("lumino_agent_name", value) // Save to localStorage
            }}
            placeholder="Enter your name (e.g., JOHN SMITH)"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            required
          />
          <p className="text-xs text-gray-600 mt-1">
            This name will be saved and used for all future applications you create.
          </p>
        </div>

        <p>
          You are in <strong>Agent Mode</strong>. This allows you to pre-fill an application on behalf of a merchant.
          Follow these steps:
        </p>
        <ol>
          <li>Navigate through the steps and fill in any information you have for the merchant.</li>
          <li>
            <strong>Important:</strong> For security reasons, do <strong>NOT enter any sensitive information</strong>{" "}
            such as Social Security Numbers (SSN), bank account numbers, or government ID numbers. These fields must be
            completed by the merchant.
          </li>
          <li>
            Once you have filled out the available information, use the actions at the bottom of the page to send the
            application link to the merchant.
          </li>
          <li>
            The link you send will be valid for <strong>30 days</strong>. After that, it will expire, and a new one will
            need to be generated from the Invite Manager.
          </li>
        </ol>
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-yellow-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                <strong>Security Warning:</strong> You are responsible for the data you enter. Never ask for or enter
                sensitive personal information on behalf of the merchant.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="justify-end">
        <Button asChild className="bg-slate-700" aria-label="View the invitations you've sent">
          <a href="/invite">View Sent Invitations</a>
        </Button>
      </CardFooter>
    </Card>
  )

  const renderMerchantInfoStep = () => (
    <Card>
      <CardHeader>
        <CardTitle>Merchant Information</CardTitle>
        <CardDescription>Basic business information and contact details</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="dbaName">
              DBA Name <span className={!errors.dbaName ? "text-slate-500" : "text-red-500"}>*</span>
            </Label>
            <Input
              id="dbaName"
              value={formData.dbaName}
              onChange={(e) => updateFormData("dbaName", e.target.value)}
              className={errors.dbaName ? "border-red-500" : ""}
            />
            {errors.dbaName && <p className="text-red-500 text-sm">{errors.dbaName}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="dbaEmail">
              DBA Email <span className={!errors.dbaEmail ? "text-slate-500" : "text-red-500"}>*</span>
            </Label>
            <Input
              id="dbaEmail"
              type="email"
              value={formData.dbaEmail}
              onChange={(e) => updateFormData("dbaEmail", e.target.value)}
              className={errors.dbaEmail ? "border-red-500" : ""}
            />
            {errors.dbaEmail && <p className="text-red-500 text-sm">{errors.dbaEmail}</p>}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="ownershipType">
              Ownership Type <span className={!errors.ownershipType ? "text-slate-500" : "text-red-500"}>*</span>
            </Label>
            <Select value={formData.ownershipType} onValueChange={(value) => updateFormData("ownershipType", value)}>
              <SelectTrigger className={errors.ownershipType ? "border-red-500" : ""}>
                <SelectValue placeholder="Select Type of Ownership" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sole-proprietor">Sole Proprietor</SelectItem>
                <SelectItem value="llc">LLC</SelectItem>
                <SelectItem value="partnership">Partnership</SelectItem>
                <SelectItem value="ltd-liability-partnership">Ltd Liability Partnership</SelectItem>
                <SelectItem value="government-entity">Government Entity</SelectItem>
                <SelectItem value="corporation">Corporation</SelectItem>
                <SelectItem value="non-profit-corporation">Non-Profit Corporation</SelectItem>
              </SelectContent>
            </Select>
            {errors.ownershipType && <p className="text-red-500 text-sm">{errors.ownershipType}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="legalName">
              Legal Name <span className={!errors.legalName ? "text-slate-500" : "text-red-500"}>*</span>
            </Label>
            <Input
              id="legalName"
              placeholder="Exact Legal Name"
              value={formData.legalName}
              onChange={(e) => updateFormData("legalName", e.target.value)}
              className={errors.legalName ? "border-red-500" : ""}
            />
            {errors.legalName && <p className="text-red-500 text-sm">{errors.legalName}</p>}
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="federalTaxId">
              Federal Tax ID <span className={!errors.federalTaxId ? "text-slate-500" : "text-red-500"}>*</span>
            </Label>
            <Input
              id="federalTaxId"
              placeholder="Federal Tax ID Number"
              value={formData.federalTaxId}
              onChange={(e) => updateFormData("federalTaxId", e.target.value)}
              className={errors.federalTaxId ? "border-red-500" : ""}
            />
            {errors.federalTaxId && <p className="text-red-500 text-sm">{errors.federalTaxId}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="dbaPhone">DBA Phone Number</Label>
            <Input
              id="dbaPhone"
              placeholder="DBA Phone Number"
              value={formData.dbaPhone}
              onChange={(e) => updateFormData("dbaPhone", e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="websiteUrl">Website Address</Label>
          <Input
            id="websiteUrl"
            placeholder="Website URL (optional)"
            value={formData.websiteUrl}
            onChange={(e) => updateFormData("websiteUrl", e.target.value)}
          />
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="paperlessStatements"
            checked={formData.paperlessStatements}
            onCheckedChange={(checked) => updateFormData("paperlessStatements", checked)}
          />
          <Label htmlFor="paperlessStatements">Would you like to opt in for paperless statements?</Label>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-medium">DBA Address</h3>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="dbaAddressLine1">
                Address Line 1 <span className={!errors.dbaAddressLine1 ? "text-slate-500" : "text-red-500"}>*</span>
              </Label>
              <Input
                id="dbaAddressLine1"
                placeholder="House Number and Street"
                value={formData.dbaAddressLine1}
                onChange={(e) => updateFormData("dbaAddressLine1", e.target.value)}
                className={errors.dbaAddressLine1 ? "border-red-500" : ""}
              />
              {errors.dbaAddressLine1 && <p className="text-red-500 text-sm">{errors.dbaAddressLine1}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="dbaAddressLine2">Address Line 2</Label>
              <Input
                id="dbaAddressLine2"
                placeholder="Apartment, Building and etc. (optional)"
                value={formData.dbaAddressLine2}
                onChange={(e) => updateFormData("dbaAddressLine2", e.target.value)}
              />
            </div>
            <div className="grid md:grid-cols-4 gap-3">
              <div className="space-y-2">
                <Label htmlFor="dbaCity">
                  City <span className={!errors.dbaCity ? "text-slate-500" : "text-red-500"}>*</span>
                </Label>
                <Input
                  id="dbaCity"
                  placeholder="City"
                  value={formData.dbaCity}
                  onChange={(e) => updateFormData("dbaCity", e.target.value)}
                  className={errors.dbaCity ? "border-red-500" : ""}
                />
                {errors.dbaCity && <p className="text-red-500 text-sm">{errors.dbaCity}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="dbaState">
                  State <span className={!errors.dbaState ? "text-slate-500" : "text-red-500"}>*</span>
                </Label>
                <Select
                  value={formData.dbaState || ""} // Add fallback for initial state
                  onValueChange={(value) => updateFormData("dbaState", value)}
                >
                  <SelectTrigger className={errors.dbaState ? "border-red-500" : ""}>
                    <SelectValue placeholder="Select State" />
                  </SelectTrigger>
                  <SelectContent>
                    {US_STATES.map((state) => (
                      <SelectItem key={state} value={state}>
                        {state}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.dbaState && <p className="text-red-500 text-sm">{errors.dbaState}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="dbaZip">
                  ZIP <span className={!errors.dbaZip ? "text-slate-500" : "text-red-500"}>*</span>
                </Label>
                <Input
                  id="dbaZip"
                  placeholder="ZIP"
                  value={formData.dbaZip}
                  onChange={(e) => updateFormData("dbaZip", e.target.value)}
                  className={errors.dbaZip ? "border-red-500" : ""}
                />
                {errors.dbaZip && <p className="text-red-500 text-sm">{errors.dbaZip}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="dbaZipExtended">ZIP Extended</Label>
                <Input
                  id="dbaZipExtended"
                  placeholder="ZIP Extended (optional)"
                  value={formData.dbaZipExtended}
                  onChange={(e) => updateFormData("dbaZipExtended", e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="legalDiffers"
              checked={formData.legalDiffers}
              onCheckedChange={(checked) => updateFormData("legalDiffers", checked)}
            />
            <Label htmlFor="legalDiffers">Does the legal information differ from the DBA information?</Label>
          </div>

          {formData.legalDiffers && (
            <div className="space-y-3 pl-6">
              <h4 className="font-medium">Legal Address</h4>
              <div className="space-y-2">
                <Label htmlFor="legalAddressLine1">Address Line 1</Label>
                <Input
                  id="legalAddressLine1"
                  placeholder="House Number and Street"
                  value={formData.legalAddressLine1}
                  onChange={(e) => updateFormData("legalAddressLine1", e.target.value)}
                  className={errors.legalAddressLine1 ? "border-red-500" : ""}
                />
                {errors.legalAddressLine1 && <p className="text-red-500 text-sm">{errors.legalAddressLine1}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="legalAddressLine2">Address Line 2</Label>
                <Input
                  id="legalAddressLine2"
                  placeholder="Apartment, Building and etc. (optional)"
                  value={formData.legalAddressLine2}
                  onChange={(e) => updateFormData("legalAddressLine2", e.target.value)}
                />
              </div>
              <div className="grid md:grid-cols-4 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="legalCity">City</Label>
                  <Input
                    id="legalCity"
                    placeholder="City"
                    value={formData.legalCity}
                    onChange={(e) => updateFormData("legalCity", e.target.value)}
                    className={errors.legalCity ? "border-red-500" : ""}
                  />
                  {errors.legalCity && <p className="text-red-500 text-sm">{errors.legalCity}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="legalState">State</Label>
                  <Select
                    value={formData.legalState || ""} // Add fallback
                    onValueChange={(value) => updateFormData("legalState", value)}
                  >
                    <SelectTrigger className={errors.legalState ? "border-red-500" : ""}>
                      <SelectValue placeholder="Select State" />
                    </SelectTrigger>
                    <SelectContent>
                      {US_STATES.map((state) => (
                        <SelectItem key={state} value={state}>
                          {state}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.legalState && <p className="text-red-500 text-sm">{errors.legalState}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="legalZip">ZIP</Label>
                  <Input
                    id="legalZip"
                    placeholder="ZIP"
                    value={formData.legalZip}
                    onChange={(e) => updateFormData("legalZip", e.target.value)}
                    className={errors.legalZip ? "border-red-500" : ""}
                  />
                  {errors.legalZip && <p className="text-red-500 text-sm">{errors.legalZip}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="legalZipExtended">ZIP Extended</Label>
                  <Input
                    id="legalZipExtended"
                    placeholder="ZIP Extended (optional)"
                    value={formData.legalZipExtended}
                    onChange={(e) => updateFormData("legalZipExtended", e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )

  const handleTerminalSelectionChange = (selectedFromSelector: { name: string; price: number; quantity: number }[]) => {
    const newTerminalsState = selectedFromSelector.map((t) => {
      const existingTerminal = formData.terminals.find((ft) => ft.name === t.name)
      if (existingTerminal) {
        // If terminal exists, update quantity but keep originalPrice and current price
        return {
          ...existingTerminal,
          quantity: t.quantity,
        }
      }
      // If new terminal, add it with originalPrice set to its price
      return {
        name: t.name,
        price: t.price, // Current price
        originalPrice: t.price, // Store original price for discount calculation
        quantity: t.quantity,
      }
    })
    updateFormData("terminals", newTerminalsState)
  }

  const handleTerminalPriceChange = (index: number, newPrice: string) => {
    const updatedTerminals = [...formData.terminals]
    const price = Number.parseFloat(newPrice) || 0

    updatedTerminals[index] = {
      ...updatedTerminals[index],
      price,
    }
    updateFormData("terminals", updatedTerminals)
  }

  // Add this new function for discount changes
  const handleTerminalDiscountChange = (index: number, discountPercent: string) => {
    const updatedTerminals = [...formData.terminals]
    const discount = Number.parseFloat(discountPercent) || 0
    const originalPrice = updatedTerminals[index].originalPrice || 0
    const newPrice = originalPrice * (1 - Math.max(0, Math.min(100, discount)) / 100) // Clamp discount between 0 and 100

    updatedTerminals[index] = {
      ...updatedTerminals[index],
      price: newPrice,
    }
    updateFormData("terminals", updatedTerminals)
  }

  const handleRemoveTerminal = (index: number) => {
    const updatedTerminals = formData.terminals.filter((_, i) => i !== index)
    updateFormData("terminals", updatedTerminals)
  }

  const renderMerchantProfileStep = () => (
    <Card>
      <CardHeader>
        <CardTitle>Merchant Profile</CardTitle>
        <CardDescription>Business processing information and transaction details</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="monthlyVolume">
              Monthly Volume ($) <span className={!errors.monthlyVolume ? "text-slate-500" : "text-red-500"}>*</span>
            </Label>
            <Input
              id="monthlyVolume"
              placeholder="Amount of Monthly Volume"
              value={formData.monthlyVolume}
              onChange={(e) => updateFormData("monthlyVolume", e.target.value)}
              className={errors.monthlyVolume ? "border-red-500" : ""}
            />
            {errors.monthlyVolume && <p className="text-red-500 text-sm">{errors.monthlyVolume}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="averageTicket">
              Average Ticket ($) <span className={!errors.averageTicket ? "text-slate-500" : "text-red-500"}>*</span>
            </Label>
            <Input
              id="averageTicket"
              placeholder="Amount of Average Ticket"
              value={formData.averageTicket}
              onChange={(e) => updateFormData("averageTicket", e.target.value)}
              className={errors.averageTicket ? "border-red-500" : ""}
            />
            {errors.averageTicket && <p className="text-red-500 text-sm">{errors.averageTicket}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="highestTicket">
              Highest Ticket ($) <span className={!errors.highestTicket ? "text-slate-500" : "text-red-500"}>*</span>
            </Label>
            <Input
              id="highestTicket"
              placeholder="Amount of Highest Ticket"
              value={formData.highestTicket}
              onChange={(e) => updateFormData("highestTicket", e.target.value)}
              className={errors.highestTicket ? "border-red-500" : ""}
            />
            {errors.highestTicket && <p className="text-red-500 text-sm">{errors.highestTicket}</p>}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <Label className="text-base font-medium">Transaction Percentages</Label>
            <p className="text-sm text-gray-600 mb-3">
              Enter percentages for any two fields and the third will auto-complete to total 100%.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pctCardSwiped" className="whitespace-nowrap">
                Card Swiped (%)
              </Label>
              <Input
                id="pctCardSwiped"
                type="number"
                min="0"
                max="100"
                placeholder="0"
                value={formData.pctCardSwiped}
                onChange={(e) => updatePercentageField("pctCardSwiped", e.target.value)}
                onFocus={handleInputFocus}
                className={errors.pctCardSwiped ? "border-red-500" : ""}
              />
              {errors.pctCardSwiped && <p className="text-red-500 text-sm">{errors.pctCardSwiped}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="pctManualImprint" className="whitespace-nowrap">
                Manual with Imprint (%)
              </Label>
              <Input
                id="pctManualImprint"
                type="number"
                min="0"
                max="100"
                placeholder="0"
                value={formData.pctManualImprint}
                onChange={(e) => updatePercentageField("pctManualImprint", e.target.value)}
                onFocus={handleInputFocus}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pctManualNoImprint" className="whitespace-nowrap">
                Manual without Imprint (%)
              </Label>
              <Input
                id="pctManualNoImprint"
                type="number"
                min="0"
                max="100"
                placeholder="0"
                value={formData.pctManualNoImprint}
                onChange={(e) => updatePercentageField("pctManualNoImprint", e.target.value)}
                onFocus={handleInputFocus}
              />
            </div>
          </div>

          {/* Total indicator - simplified small text below inputs */}
          {percentageTotal > 0 && (
            <div className="mt-3 text-right">
              <span className="text-sm">
                Total:
                <span
                  className={`font-semibold ml-1 ${
                    Math.abs(percentageTotal - 100) <= 1 ? "text-green-600" : "text-yellow-600"
                  }`}
                >
                  {percentageTotal.toFixed(2)}%
                </span>
              </span>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="businessType">
            What is the business type of the Merchant?{" "}
            <span className={!errors.businessType ? "text-slate-500" : "text-red-500"}>*</span>
          </Label>
          <BusinessTypeAutocomplete
            value={formData.businessType}
            onChange={(value) => updateFormData("businessType", value)}
            error={errors.businessType}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="refundPolicy">Refund Policy</Label>
          <Input
            id="refundPolicy"
            placeholder="E.g. Full Refund (optional)"
            value={formData.refundPolicy}
            onChange={(e) => updateFormData("refundPolicy", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="previousProcessor">Credit Processor</Label>
          <Input
            id="previousProcessor"
            placeholder="Enter Previous Card Processor Company (optional)"
            value={formData.previousProcessor}
            onChange={(e) => updateFormData("previousProcessor", e.target.value)}
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="seasonalBusiness"
              checked={formData.seasonalBusiness}
              onCheckedChange={(checked) => updateFormData("seasonalBusiness", checked)}
            />
            <Label htmlFor="seasonalBusiness">Do you conduct business seasonally?</Label>
          </div>

          {formData.seasonalBusiness && (
            <div className="pl-6 space-y-2">
              <Label>Operational Months</Label>
              <div className="grid grid-cols-6 gap-2">
                {MONTHS.map((month) => (
                  <div key={month} className="flex items-center space-x-2">
                    <Checkbox
                      id={month}
                      checked={formData.seasonalMonths.includes(month)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          updateFormData("seasonalMonths", [...formData.seasonalMonths, month])
                        } else {
                          updateFormData(
                            "seasonalMonths",
                            formData.seasonalMonths.filter((m) => m !== month),
                          )
                        }
                      }}
                    />
                    <Label htmlFor={month} className="text-sm">
                      {month}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="usesFulfillmentHouse"
            checked={formData.usesFulfillmentHouse}
            onCheckedChange={(checked) => updateFormData("usesFulfillmentHouse", checked)}
          />
          <Label htmlFor="usesFulfillmentHouse">Do you use a Fulfillment House?</Label>
        </div>

        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="usesThirdParties"
              checked={formData.usesThirdParties}
              onCheckedChange={(checked) => updateFormData("usesThirdParties", checked)}
            />
            <Label htmlFor="usesThirdParties">Do you use any third parties in the payment process?</Label>
          </div>

          {formData.usesThirdParties && (
            <div className="pl-6 space-y-2">
              <Label htmlFor="thirdPartiesList">Third Parties</Label>
              <Textarea
                id="thirdPartiesList"
                placeholder="Enter third parties that are used in the payment process (optional)"
                value={formData.thirdPartiesList}
                onChange={(e) => updateFormData("thirdPartiesList", e.target.value)}
              />
            </div>
          )}
        </div>
        <div className="space-y-4 border-t pt-6">
          <h3 className="text-lg font-medium">Terminal Selection</h3>
          {isAgentMode ? (
            <>
              <p className="text-sm text-gray-600">
                Select terminal(s) for the merchant. You can adjust the final price for each selected terminal.
              </p>
              {formData.terminals.length > 0 && (
                <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
                  <h4 className="text-md font-medium">Selected Terminals</h4>
                  {formData.terminals.map((terminal, index) => (
                    <div
                      key={index}
                      className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-3 border rounded-lg bg-white"
                    >
                      <div className="flex-grow">
                        <p className="font-semibold">{terminal.name}</p>
                        <p className="text-sm text-gray-500">
                          Original Price: ${(terminal.originalPrice || terminal.price || 0).toFixed(2)}
                          {terminal.quantity && terminal.quantity > 1 && (
                            <span className="ml-2 font-medium text-blue-600">× {terminal.quantity}</span>
                          )}
                        </p>
                      </div>

                      {/* Discount Percentage Input */}
                      <div className="w-full sm:w-32">
                        <Label htmlFor={`terminal-discount-${index}`} className="text-xs text-left block">
                          Discount (%)
                        </Label>
                        <Input
                          id={`terminal-discount-${index}`}
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={
                            terminal.originalPrice > 0
                              ? (((terminal.originalPrice - terminal.price) / terminal.originalPrice) * 100).toFixed(2)
                              : "0.00"
                          }
                          onChange={(e) => handleTerminalDiscountChange(index, e.target.value)}
                          className="text-right"
                          placeholder="0.00"
                        />
                      </div>

                      {/* Final Price Input */}
                      <div className="w-full sm:w-32">
                        <Label htmlFor={`terminal-price-${index}`} className="text-xs text-left block">
                          Final Price ($)
                        </Label>
                        <Input
                          id={`terminal-price-${index}`}
                          type="number"
                          min="0"
                          step="0.01"
                          value={(terminal.price || 0).toFixed(2)}
                          onChange={(e) => handleTerminalPriceChange(index, e.target.value)}
                          className="text-right"
                          placeholder="0.00"
                        />
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveTerminal(index)}
                        className="mt-4 sm:mt-0"
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <TerminalSelector selectedTerminals={formData.terminals} onChange={handleTerminalSelectionChange} />
            </>
          ) : formData.terminals.length > 0 ? (
            <div>
              <Label>Selected Terminal(s)</Label>
              <ul className="list-none mt-2 space-y-2">
                {formData.terminals.map((t, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="font-semibold">{t.name}:</span>
                    <span>{formatDiscountedPrice(t.price, t.originalPrice)}</span>
                    {t.quantity && t.quantity > 1 && (
                      <span className="text-sm text-blue-600 font-medium">(Qty: {t.quantity})</span>
                    )}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-gray-500 mt-2">These terminals were selected by your account manager.</p>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )

  const renderAccountRatesStep = () => (
    <Card>
      <CardHeader>
        <CardTitle>Account Rates</CardTitle>
        <CardDescription>Configure accepted card types and rate programs</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Accepted Optional Card Types */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium border-b pb-2">Accepted Optional Card Types</h3>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="acceptAmex">AMEX</Label>
              <Select value={formData.acceptAmex} onValueChange={(value) => updateFormData("acceptAmex", value)}>
                <SelectTrigger id="acceptAmex">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="acceptDebit">DEBIT</Label>
              <Select value={formData.acceptDebit} onValueChange={(value) => updateFormData("acceptDebit", value)}>
                <SelectTrigger id="acceptDebit">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="acceptEbt">EBT</Label>
              <Select value={formData.acceptEbt} onValueChange={(value) => updateFormData("acceptEbt", value)}>
                <SelectTrigger id="acceptEbt">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Conditional AMEX information */}
          {formData.acceptAmex === "yes" && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-900">
                AMEX processing will be configured for your account. Additional AMEX-specific rates and terms will
                apply.
              </p>
            </div>
          )}

          {/* Conditional DEBIT pricing options */}
          {formData.acceptDebit === "yes" && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-900">DEBIT card processing will be enabled with standard rates.</p>
            </div>
          )}

          {/* Conditional EBT pricing options */}
          {formData.acceptEbt === "yes" && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-900">EBT processing will be enabled with standard rates.</p>
            </div>
          )}
        </div>

        {/* Rate Programs */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium border-b pb-2">Rate Programs</h3>

          <div className="space-y-2">
            <Label htmlFor="rateProgram">Select Rate Program</Label>
            <Select
              value={formData.rateProgram}
              onValueChange={(value) => {
                updateFormData("rateProgram", value)
                updateFormData("rateProgramValue", "") // Reset value when program changes
              }}
            >
              <SelectTrigger id="rateProgram">
                <SelectValue placeholder="Select a rate program..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dual-pricing">Dual Pricing or Cash Discounting</SelectItem>
                <SelectItem value="flat-rate">Flat Rate</SelectItem>
                <SelectItem value="interchange-plus">Interchange + Pricing</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Conditional dropdown based on rate program selection */}
          {formData.rateProgram === "dual-pricing" && (
            <div className="space-y-2">
              <Label htmlFor="rateProgramValue">Dual Pricing / Cash Discounting Options</Label>
              <Select
                value={formData.rateProgramValue}
                onValueChange={(value) => updateFormData("rateProgramValue", value)}
              >
                <SelectTrigger id="rateProgramValue">
                  <SelectValue placeholder="Select an option..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dual-pricing-standard">Standard Dual Pricing</SelectItem>
                  <SelectItem value="cash-discount-program">Cash Discount Program</SelectItem>
                  <SelectItem value="custom-dual-pricing">Custom Dual Pricing</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {formData.rateProgram === "flat-rate" && (
            <div className="space-y-2">
              <Label htmlFor="rateProgramValue">Flat Rate Options</Label>
              <Select
                value={formData.rateProgramValue}
                onValueChange={(value) => updateFormData("rateProgramValue", value)}
              >
                <SelectTrigger id="rateProgramValue">
                  <SelectValue placeholder="Select an option..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="flat1">2.6% + $0.10 per transaction</SelectItem>
                  <SelectItem value="flat2">2.9% + $0.15 per transaction</SelectItem>
                  <SelectItem value="flat3">3.5% + $0.15 per transaction</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {formData.rateProgram === "interchange-plus" && (
            <div className="space-y-2">
              <Label htmlFor="rateProgramValue">Interchange + Pricing Options</Label>
              <Select
                value={formData.rateProgramValue}
                onValueChange={(value) => updateFormData("rateProgramValue", value)}
              >
                <SelectTrigger id="rateProgramValue">
                  <SelectValue placeholder="Select an option..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ic1">Interchange + 0.25% + $0.10</SelectItem>
                  <SelectItem value="ic2">Interchange + 0.50% + $0.15</SelectItem>
                  <SelectItem value="ic3">Interchange + 0.75% + $0.20</SelectItem>
                  <SelectItem value="ic4">Interchange + 1.00% + $0.25</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )

  const renderOwnersStep = () => (
    <Card>
      <CardHeader>
        <CardTitle>Owners and Officers</CardTitle>
        <CardDescription>Information about business principals, owners, and key contacts</CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="space-y-6">
          <h3 className="text-lg font-medium border-b pb-2">Business Principals</h3>
          {principals.map((principal, index) => (
            <div key={principal.id} className="border rounded-lg p-4 space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-md font-medium">Principal {index + 1}</h4>
                {principals.length > 1 && (
                  <Button type="button" variant="destructive" size="sm" onClick={() => removePrincipal(principal.id)}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Remove
                  </Button>
                )}
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>
                    First Name{" "}
                    <span className={errors[`principal${index}FirstName`] ? "text-red-500" : "text-slate-500"}>*</span>
                  </Label>
                  <Input
                    value={principal.firstName}
                    onChange={(e) => updatePrincipal(principal.id, "firstName", e.target.value)}
                    className={errors[`principal${index}FirstName`] ? "border-red-500" : ""}
                  />
                  {errors[`principal${index}FirstName`] && (
                    <p className="text-red-500 text-sm">{errors[`principal${index}FirstName`]}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>
                    Last Name{" "}
                    <span className={errors[`principal${index}LastName`] ? "text-red-500" : "text-slate-500"}>*</span>
                  </Label>
                  <Input
                    value={principal.lastName}
                    onChange={(e) => updatePrincipal(principal.id, "lastName", e.target.value)}
                    className={errors[`principal${index}LastName`] ? "border-red-500" : ""}
                  />
                  {errors[`principal${index}LastName`] && (
                    <p className="text-red-500 text-sm">{errors[`principal${index}LastName`]}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Middle Name</Label>
                  <Input
                    placeholder="Middle Name (optional)"
                    value={principal.middleName}
                    onChange={(e) => updatePrincipal(principal.id, "middleName", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>
                    Date of Birth{" "}
                    <span className={errors[`principal${index}Dob`] ? "text-red-500" : "text-slate-500"}>*</span>
                  </Label>
                  <Input
                    type="date"
                    value={principal.dob || ""} // Add the || "" fallback for empty date
                    onChange={(e) => updatePrincipal(principal.id, "dob", e.target.value)}
                    className={errors[`principal${index}Dob`] ? "border-red-500" : ""}
                  />
                  {errors[`principal${index}Dob`] && (
                    <p className="text-red-500 text-sm">{errors[`principal${index}Dob`]}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>
                    SSN <span className={errors[`principal${index}Ssn`] ? "text-red-500" : "text-slate-500"}>*</span>
                  </Label>
                  <Input
                    value={principal.ssn}
                    onChange={(e) => updatePrincipal(principal.id, "ssn", e.target.value)}
                    className={errors[`principal${index}Ssn`] ? "border-red-500" : ""}
                  />
                  {errors[`principal${index}Ssn`] && (
                    <p className="text-red-500 text-sm">{errors[`principal${index}Ssn`]}</p>
                  )}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>
                    Email Address{" "}
                    <span className={errors[`principal${index}Email`] ? "text-red-500" : "text-slate-500"}>*</span>
                  </Label>
                  <Input
                    type="email"
                    value={principal.email}
                    onChange={(e) => updatePrincipal(principal.id, "email", e.target.value)}
                    className={errors[`principal${index}Email`] ? "border-red-500" : ""}
                  />
                  {errors[`principal${index}Email`] && (
                    <p className="text-red-500 text-sm">{errors[`principal${index}Email`]}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Phone Number</Label>
                  <Input
                    value={principal.phone}
                    onChange={(e) => updatePrincipal(principal.id, "phone", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>
                    Position in the Organization{" "}
                    <span className={errors[`principal${index}Position`] ? "text-red-500" : "text-slate-500"}>*</span>
                  </Label>
                  <Input
                    value={principal.position}
                    onChange={(e) => updatePrincipal(principal.id, "position", e.target.value)}
                    className={errors[`principal${index}Position`] ? "border-red-500" : ""}
                  />
                  {errors[`principal${index}Position`] && (
                    <p className="text-red-500 text-sm">{errors[`principal${index}Position`]}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Equity (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={principal.equity}
                    onChange={(e) => updatePrincipal(principal.id, "equity", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Government ID Type</Label>
                  <Input
                    placeholder="Government ID Type (optional)"
                    value={principal.govIdType}
                    onChange={(e) => updatePrincipal(principal.id, "govIdType", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>
                    ID Number{" "}
                    <span className={errors[`principal${index}GovIdNumber`] ? "text-red-500" : "text-slate-500"}>
                      *
                    </span>
                  </Label>
                  <Input
                    value={principal.govIdNumber}
                    onChange={(e) => updatePrincipal(principal.id, "govIdNumber", e.target.value)}
                    className={errors[`principal${index}GovIdNumber`] ? "border-red-500" : ""}
                  />
                  {errors[`principal${index}GovIdNumber`] && (
                    <p className="text-red-500 text-sm">{errors[`principal${index}GovIdNumber`]}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>
                    ID Expiration{" "}
                    <span className={errors[`principal${index}GovIdExpiration`] ? "text-red-500" : "text-slate-500"}>
                      *
                    </span>
                  </Label>
                  <Input
                    type="date"
                    value={principal.govIdExpiration}
                    onChange={(e) => updatePrincipal(principal.id, "govIdExpiration", e.target.value)}
                    className={errors[`principal${index}GovIdExpiration`] ? "border-red-500" : ""}
                  />
                  {errors[`principal${index}GovIdExpiration`] && (
                    <p className="text-red-500 text-sm">{errors[`principal${index}GovIdExpiration`]}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>
                    Issuing State{" "}
                    <span className={errors[`principal${index}GovIdState`] ? "text-red-500" : "text-slate-500"}>*</span>
                  </Label>
                  <Select
                    value={principal.govIdState || ""} // Add fallback
                    onValueChange={(v) => updatePrincipal(principal.id, "govIdState", v)}
                  >
                    <SelectTrigger className={errors[`principal${index}GovIdState`] ? "border-red-500" : ""}>
                      <SelectValue placeholder="Select State (required)" />
                    </SelectTrigger>
                    <SelectContent>
                      {US_STATES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors[`principal${index}GovIdState`] && (
                    <p className="text-red-500 text-sm">{errors[`principal${index}GovIdState`]}</p>
                  )}
                </div>
              </div>

              <FileUploadComponent
                uploadKey={`principal${principal.id}GovId`}
                label="Copy of Signatory's Government ID"
                description="This attachment is required - Upload from your computer or phone"
              />

              <div className="space-y-4">
                <h5 className="font-medium">Address</h5>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Address Line 1</Label>
                    <Input
                      placeholder="House Number and Street"
                      value={principal.addressLine1}
                      onChange={(e) => updatePrincipal(principal.id, "addressLine1", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Address Line 2</Label>
                    <Input
                      placeholder="Apartment, Building and etc. (optional)"
                      value={principal.addressLine2}
                      onChange={(e) => updatePrincipal(principal.id, "addressLine2", e.target.value)}
                    />
                  </div>
                  <div className="grid md:grid-cols-4 gap-3">
                    <div className="space-y-2">
                      <Label>City</Label>
                      <Input
                        placeholder="City"
                        value={principal.city}
                        onChange={(e) => updatePrincipal(principal.id, "city", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>State</Label>
                      <Select
                        value={principal.state}
                        onValueChange={(value) => updatePrincipal(principal.id, "state", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select State" />
                        </SelectTrigger>
                        <SelectContent>
                          {US_STATES.map((state) => (
                            <SelectItem key={state} value={state}>
                              {state}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>ZIP</Label>
                      <Input
                        placeholder="ZIP"
                        value={principal.zip}
                        onChange={(e) => updatePrincipal(principal.id, "zip", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>ZIP Extended</Label>
                      <Input
                        placeholder="ZIP Extended (optional)"
                        value={principal.zipExtended}
                        onChange={(e) => updatePrincipal(principal.id, "zipExtended", e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}

          <Button type="button" onClick={addPrincipal} className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            Add Principal
          </Button>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-medium border-b pb-2">Managing Member</h3>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="managingMemberSameAs"
              checked={formData.managingMemberSameAs}
              onCheckedChange={(checked) => {
                updateFormData("managingMemberSameAs", checked)
                if (checked && principals.length > 0) {
                  // default to Principal 1
                  const value = "Principal 1"
                  const p = principals[0]
                  updateFormData("managingMemberReference", value)
                  updateFormData("managingMemberFirstName", p?.firstName || "")
                  updateFormData("managingMemberLastName", p?.lastName || "")
                  updateFormData("managingMemberEmail", p?.email || "")
                  updateFormData("managingMemberPhone", p?.phone || "")
                  updateFormData("managingMemberPosition", p?.position || "")
                } else {
                  // Clear fields if checkbox is unchecked
                  updateFormData("managingMemberReference", "")
                  updateFormData("managingMemberFirstName", "")
                  updateFormData("managingMemberLastName", "")
                  updateFormData("managingMemberEmail", "")
                  updateFormData("managingMemberPhone", "")
                  updateFormData("managingMemberPosition", "")
                }
              }}
            />
            <Label htmlFor="managingMemberSameAs">
              Is your Managing Member the same as any of the Owners listed above?
            </Label>
          </div>

          {formData.managingMemberSameAs ? (
            <div className="pl-6 space-y-2">
              <Label>Which Owner is also the Managing Member?</Label>
              <Select
                value={formData.managingMemberReference}
                onValueChange={(value) => {
                  updateFormData("managingMemberReference", value)
                  // Find the index from the value (e.g., "Principal 1" -> index 0)
                  const idx = Number.parseInt(value.replace("Principal ", ""), 10) - 1
                  const p = principals[idx]
                  if (p) {
                    updateFormData("managingMemberFirstName", p.firstName || "")
                    updateFormData("managingMemberLastName", p.lastName || "")
                    updateFormData("managingMemberEmail", p.email || "")
                    updateFormData("managingMemberPhone", p.phone || "")
                    updateFormData("managingMemberPosition", p.position || "")
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Principal" />
                </SelectTrigger>
                <SelectContent>
                  {principals.map((principal, index) => (
                    <SelectItem key={principal.id} value={`Principal ${index + 1}`}>
                      Principal {index + 1} - {principal.firstName} {principal.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="pl-6 space-y-4">
              <p className="text-sm text-gray-600">Please provide the managing member's information:</p>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="managingMemberFirstName">
                    First Name{" "}
                    <span className={!errors.managingMemberFirstName ? "text-slate-500" : "text-red-500"}>*</span>
                  </Label>
                  <Input
                    id="managingMemberFirstName"
                    value={formData.managingMemberFirstName}
                    onChange={(e) => updateFormData("managingMemberFirstName", e.target.value)}
                    className={errors.managingMemberFirstName ? "border-red-500" : ""}
                  />
                  {errors.managingMemberFirstName && (
                    <p className="text-red-500 text-sm">{errors.managingMemberFirstName}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="managingMemberLastName">
                    Last Name{" "}
                    <span className={!errors.managingMemberLastName ? "text-slate-500" : "text-red-500"}>*</span>
                  </Label>
                  <Input
                    id="managingMemberLastName"
                    value={formData.managingMemberLastName}
                    onChange={(e) => updateFormData("managingMemberLastName", e.target.value)}
                    className={errors.managingMemberLastName ? "border-red-500" : ""}
                  />
                  {errors.managingMemberLastName && (
                    <p className="text-red-500 text-sm">{errors.managingMemberLastName}</p>
                  )}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="managingMemberEmail">
                    Email Address{" "}
                    <span className={!errors.managingMemberEmail ? "text-slate-500" : "text-red-500"}>*</span>
                  </Label>
                  <Input
                    id="managingMemberEmail"
                    type="email"
                    value={formData.managingMemberEmail}
                    onChange={(e) => updateFormData("managingMemberEmail", e.target.value)}
                    className={errors.managingMemberEmail ? "border-red-500" : ""}
                  />
                  {errors.managingMemberEmail && <p className="text-red-500 text-sm">{errors.managingMemberEmail}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="managingMemberPhone">Phone Number</Label>
                  <Input
                    id="managingMemberPhone"
                    value={formData.managingMemberPhone}
                    onChange={(e) => updateFormData("managingMemberPhone", e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="managingMemberPosition">
                  Position in the Organization{" "}
                  <span className={!errors.managingMemberPosition ? "text-slate-500" : "text-red-500"}>*</span>
                </Label>
                <Input
                  id="managingMemberPosition"
                  value={formData.managingMemberPosition}
                  onChange={(e) => updateFormData("managingMemberPosition", e.target.value)}
                  className={errors.managingMemberPosition ? "border-red-500" : ""}
                />
                {errors.managingMemberPosition && (
                  <p className="text-red-500 text-sm">{errors.managingMemberPosition}</p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-medium border-b pb-2">Authorized Contact</h3>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="authorizedContactSameAs"
              checked={formData.authorizedContactSameAs}
              onCheckedChange={(checked) => updateFormData("authorizedContactSameAs", checked)}
            />
            <Label htmlFor="authorizedContactSameAs">
              Is the Authorized Contact the same as the owner or Managing Member?
            </Label>
          </div>

          {!formData.authorizedContactSameAs && (
            <div className="pl-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="authorizedContactName">Authorized Contact Name</Label>
                <Input
                  id="authorizedContactName"
                  value={formData.authorizedContactName}
                  onChange={(e) => updateFormData("authorizedContactName", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="authorizedContactEmail">Authorized Contact Email</Label>
                <Input
                  id="authorizedContactEmail"
                  type="email"
                  value={formData.authorizedContactEmail}
                  onChange={(e) => updateFormData("authorizedContactEmail", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="authorizedContactPhone">Authorized Contact Phone Number</Label>
                <Input
                  id="authorizedContactPhone"
                  value={formData.authorizedContactPhone}
                  onChange={(e) => updateFormData("authorizedContactPhone", e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-medium border-b pb-2">Technical Contact</h3>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="technicalContactSameAs"
              checked={formData.technicalContactSameAs}
              onCheckedChange={(checked) => updateFormData("technicalContactSameAs", checked)}
            />
            <Label htmlFor="technicalContactSameAs">
              Is your Technical Contact the same as the Owner, Managing Member or Authorized Contact listed above?
            </Label>
          </div>

          {!formData.technicalContactSameAs && (
            <div className="pl-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="technicalContactName">Technical Contact Name</Label>
                <Input
                  id="technicalContactName"
                  value={formData.technicalContactName}
                  onChange={(e) => updateFormData("technicalContactName", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="technicalContactEmail">Technical Contact Email</Label>
                <Input
                  id="technicalContactEmail"
                  type="email"
                  value={formData.technicalContactEmail}
                  onChange={(e) => updateFormData("technicalContactEmail", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="technicalContactPhone">Technical Contact Phone Number</Label>
                <Input
                  id="technicalContactPhone"
                  value={formData.technicalContactPhone}
                  onChange={(e) => updateFormData("technicalContactPhone", e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )

  const renderBankingStep = () => (
    <Card>
      <CardHeader>
        <CardTitle>Banking Info</CardTitle>
        <CardDescription>Bank account information for fund deposits and processing configuration</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <h3 className="text-lg font-medium border-b pb-2">Banking Information</h3>
          <div className="space-y-2">
            <Label htmlFor="bankName">
              Bank Name <span className={!errors.bankName ? "text-slate-500" : "text-red-500"}>*</span>
            </Label>
            <Input
              id="bankName"
              placeholder="Bank Name where you want your funds deposited"
              value={formData.bankName}
              onChange={(e) => updateFormData("bankName", e.target.value)}
              className={errors.bankName ? "border-red-500" : ""}
            />
            {errors.bankName && <p className="text-red-500 text-sm">{errors.bankName}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="routingNumber">
              Routing / ABA # <span className={!errors.routingNumber ? "text-slate-500" : "text-red-500"}>*</span>
            </Label>
            <Input
              id="routingNumber"
              placeholder="Routing / ABA #"
              value={formData.routingNumber}
              onChange={(e) => updateFormData("routingNumber", e.target.value)}
              className={errors.routingNumber ? "border-red-500" : ""}
            />
            {errors.routingNumber && <p className="text-red-500 text-sm">{errors.routingNumber}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="accountNumber">
              Checking / Saving Account #{" "}
              <span className={!errors.accountNumber ? "text-slate-500" : "text-red-500"}>*</span>
            </Label>
            <Input
              id="accountNumber"
              placeholder="Checking / Saving Account #"
              value={formData.accountNumber}
              onChange={(e) => updateFormData("accountNumber", e.target.value)}
              className={errors.accountNumber ? "border-red-500" : ""}
            />
            {errors.accountNumber && <p className="text-red-500 text-sm">{errors.accountNumber}</p>}
          </div>

          <FileUploadComponent
            uploadKey="voidedCheck"
            label="Voided Check or Bank Letter"
            description="This attachment is required - Upload from your computer or phone"
          />
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-medium border-b pb-2">Batching</h3>
          <p className="text-sm text-gray-600">
            By default, the Terminal will batch by 10:45 PM EST. To use an alternate time, enter it here. Alternative
            time must be at least 1 hour later than End of Business Day if entered.
          </p>

          <div className="space-y-2">
            <Label htmlFor="batchTime">Batch Time</Label>
            <Input
              id="batchTime"
              value={formData.batchTime}
              onChange={(e) => updateFormData("batchTime", e.target.value)}
              placeholder="e.g., 4:00 AM CST"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )

  const renderUploadsStep = () => (
    <Card>
      <CardHeader>
        <CardTitle>Document Uploads</CardTitle>
        <CardDescription>Upload required business documents and supporting materials</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <FileUploadComponent
          uploadKey="businessLicense"
          label="Business License"
          description="This attachment is required - Upload from your computer or phone"
        />

        <FileUploadComponent
          uploadKey="taxId"
          label="Tax ID"
          description="This attachment is required - Upload from your computer or phone"
        />

        <FileUploadComponent
          uploadKey="articlesOfIncorporation"
          label="Articles of Incorporation"
          description="This attachment is required - Upload from your computer or phone"
        />

        <FileUploadComponent
          uploadKey="interiorExteriorPhotos"
          label="Interior/Exterior Photos"
          description="This attachment is required - Upload from your computer or phone"
        />

        <FileUploadComponent
          uploadKey="otherSupportingPapers"
          label="Other Supporting Papers (picture of signage, pricing sheet, etc.)"
          description="This attachment is optional - Upload from your computer or phone"
        />

        <FileUploadComponent
          uploadKey="twoConsecutiveStatements"
          label="Copies of Two (2) Consecutive Recent Statements (if currently processing)"
          description="This attachment is required - Upload from your computer or phone"
        />
      </CardContent>
    </Card>
  )

  const renderReviewStep = () => (
    <Card>
      <CardHeader>
        <CardTitle>Review & Sign</CardTitle>
        <CardDescription>Review the merchant agreement and provide your signature</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <ScrollArea
          className="h-96 w-full border rounded p-4"
          onScrollCapture={handleAgreementScroll}
          ref={agreementScrollRef}
        >
          <div className="space-y-4 text-sm">
            <h3 className="font-bold text-lg">MERCHANT PROCESSING AGREEMENT</h3>
            <p>
              This Merchant Processing Agreement ("Agreement") is entered into between Lumino Technologies ("Processor")
              and the merchant identified in this application ("Merchant").
            </p>
            <h4 className="font-semibold">1. PROCESSING SERVICES</h4>
            <p>
              Processor agrees to provide credit and debit card processing services to Merchant in accordance with the
              terms and conditions set forth herein and in accordance with the rules and regulations of Visa,
              MasterCard, and other applicable card associations.
            </p>
            <h4 className="font-semibold">2. FEES AND CHARGES</h4>
            <p>
              Merchant agrees to pay all applicable processing fees, monthly fees, transaction fees, and any other
              charges as outlined in the fee schedule provided separately. All fees are subject to change with 30 days
              written notice.
            </p>
            <h4 className="font-semibold">3. COMPLIANCE</h4>
            <p>
              Merchant agrees to comply with all applicable laws, regulations, and card association rules, including but
              not limited to PCI DSS compliance requirements. Merchant is responsible for maintaining the security of
              cardholder data.
            </p>
            <h4 className="font-semibold">4. CHARGEBACKS AND DISPUTES</h4>
            <p>
              Merchant is liable for all chargebacks, retrievals, and associated fees resulting from transactions
              processed under this agreement. Processor may establish and maintain a reserve account to cover potential
              chargeback liability.
            </p>
            <h4 className="font-semibold">5. TERMINATION</h4>
            <p>
              Either party may terminate this agreement with 30 days written notice. Upon termination, all outstanding
              obligations shall remain in effect until satisfied.
            </p>
            <h4 className="font-semibold">6. LIMITATION OF LIABILITY</h4>
            <p>
              Processor's liability under this agreement is limited to the amount of processing fees paid by Merchant in
              the 12 months preceding any claim.
            </p>
            <h4 className="font-semibold">7. INDEMNIFICATION</h4>
            <p>
              Merchant agrees to indemnify and hold harmless Processor from any claims, damages, or losses arising from
              Merchant's use of the processing services or breach of this agreement.
            </p>
            <p className="mt-8">
              By signing below, Merchant acknowledges that they have read, understood, and agree to be bound by all
              terms and conditions of this agreement.
            </p>
          </div>
        </ScrollArea>
        {errors.agreement && <p className="text-red-500 text-sm">{errors.agreement}</p>}

        <div
          className={cn(
            "space-y-4 transition-opacity",
            !formData.agreementScrolled && "opacity-50 pointer-events-none",
          )}
        >
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="signatureFullName">Full Name (Typed Signature) *</Label>
              <Input
                id="signatureFullName"
                value={formData.signatureFullName}
                onChange={(e) => updateFormData("signatureFullName", e.target.value)}
                className={errors.signature ? "border-red-500" : ""}
                disabled={!formData.agreementScrolled}
              />
              {errors.signature && <p className="text-red-500 text-sm">{errors.signature}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="signatureDate">Date *</Label>
              <Input
                id="signatureDate"
                type="date"
                value={formData.signatureDate}
                onChange={(e) => updateFormData("signatureDate", e.target.value)}
                disabled={!formData.agreementScrolled}
              />
            </div>
          </div>

          <div className="flex items-start space-x-2">
            <Checkbox
              id="certificationAck"
              checked={formData.certificationAck}
              onCheckedChange={(checked) => updateFormData("certificationAck", checked)}
              disabled={!formData.agreementScrolled}
            />
            <div className="space-y-1">
              <Label htmlFor="certificationAck" className="text-sm font-medium">
                Certification and Acknowledgment *
              </Label>
              <p className="text-sm text-gray-600">
                I certify that the information provided in this application is true and accurate. I understand that any
                false information may result in the decline of this application or termination of processing services. I
                authorize Lumino Technologies to verify the information provided and to obtain credit reports as
                necessary.
              </p>
              {errors.certification && <p className="text-red-500 text-sm">{errors.certification}</p>}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )

  const renderConfirmationStep = () => (
    <Card className="text-center">
      <CardHeader>
        <div className="mx-auto bg-green-100 rounded-full h-20 w-20 flex items-center justify-center">
          <Check className="h-12 w-12 text-green-600" />
        </div>
        <CardTitle className="mt-4 text-2xl">Application Submitted Successfully!</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-gray-600">
          Thank you for submitting your merchant application. We have received your information and will begin
          processing your application immediately.
        </p>
        <p className="text-gray-600">
          Our underwriting team will review your application and contact you within 24-48 hours with next steps. You
          will receive a confirmation email shortly with your application details.
        </p>
        <div className="flex justify-center gap-4 mt-6">
          <Button onClick={generatePDF} variant="outline">
            <FileText className="mr-2 h-4 w-4" />
            Download Application PDF
          </Button>
        </div>
        <p className="text-sm text-gray-500 mt-4">
          If you have any questions, please contact us at{" "}
          <a href="mailto:apps@golumino.com" className="text-blue-600 hover:underline">
            apps@golumino.com
          </a>
        </p>
      </CardContent>
    </Card>
  )

  const renderLoadingScreen = () => (
    <div className="flex flex-col items-center justify-center text-center p-10">
      <Loader2 className="h-12 w-12 animate-spin text-gray-500" />
      <h2 className="mt-4 text-xl font-semibold text-gray-700">Loading Application...</h2>
      <p className="mt-2 text-gray-500">Please wait while we retrieve the details.</p>
    </div>
  )

  const renderExpiredScreen = () => (
    <Card className="text-center">
      <CardHeader>
        <div className="mx-auto bg-red-100 rounded-full h-20 w-20 flex items-center justify-center">
          <Clock className="h-12 w-12 text-red-600" />
        </div>
        <CardTitle className="mt-4 text-2xl">Application Link Expired</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-gray-600">
          This invitation link is more than 30 days old and has expired for security reasons, or it is invalid.
        </p>
        <p className="text-sm text-gray-500 mt-4">
          Please request a new invitation link from your account manager or contact our support team at{" "}
          <a href="mailto:support@golumino.com" className="text-blue-600 hover:underline">
            support@golumino.com
          </a>
          .
        </p>
      </CardContent>
    </Card>
  )

  const renderSubmittedScreen = () => (
    <Card className="text-center">
      <CardHeader>
        <div className="mx-auto bg-blue-100 rounded-full h-20 w-20 flex items-center justify-center">
          <FileCheck className="h-12 w-12 text-blue-600" />
        </div>
        <CardTitle className="mt-4 text-2xl">Application Already Processed</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-gray-600">
          This application has already been completed and submitted for review, or a new link has been sent.
        </p>
        <p className="text-sm text-gray-500 mt-4">
          If you believe this is a mistake, please contact our support team at{" "}
          <a href="mailto:support@golumino.com" className="text-blue-600 hover:underline">
            support@golumino.com
          </a>
          .
        </p>
      </CardContent>
    </Card>
  )

  const renderCurrentStep = () => {
    if (isLoading) return renderLoadingScreen()
    if (isExpired) return renderExpiredScreen()
    if (isAlreadySubmitted) return renderSubmittedScreen()
    const stepId = steps[currentStep]?.id
    switch (stepId) {
      case "welcome":
        return isAgentMode ? renderAgentWelcomeStep() : renderWelcomeStep()
      case "merchant-info":
        return renderMerchantInfoStep()
      case "merchant-profile":
        return renderMerchantProfileStep()
      case "account-rates":
        return renderAccountRatesStep()
      case "owners":
        return renderOwnersStep()
      case "banking":
        return renderBankingStep()
      case "uploads":
        return renderUploadsStep()
      case "review":
        return renderReviewStep()
      case "confirmation":
        return renderConfirmationStep()
      default:
        // Fallback to welcome step if unknown stepId
        return isAgentMode ? renderAgentWelcomeStep() : renderWelcomeStep()
    }
  }

  const mainContentVisible = !isLoading && !isExpired && !isAlreadySubmitted && !isUnauthorized

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }, [currentStep])

  // Renamed from handleAgentAction to more specific functions
  const handleSendToMerchant = async () => {
    if (!agentName || agentName.trim() === "") {
      toast({
        title: "Agent Name Required",
        description: "Please enter your agent name before sending the application.",
        variant: "destructive",
      })
      return
    }

    if (merchantEmail === "") {
      // Check for empty string, not just falsy
      toast({
        title: "Merchant Email Required",
        description: "Please enter the merchant's email address to send the invitation.",
        variant: "destructive",
      })
      return
    }

    setIsSubmittingAgentAction(true)
    setGeneratedLink("") // Clear previous link

    try {
      let appId = applicationData?.id

      if (!appId) {
        const createRes = await fetch("/api/generate-merchant-invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agent_email: user?.primaryEmailAddress?.emailAddress,
            merchant_email: merchantEmail, // Use validated merchantEmail
            agent_name: agentName.trim(),
          }),
        })
        const createResult = await createRes.json()
        if (!createResult.success) throw new Error(createResult.error || "Failed to create application.")
        appId = createResult.inviteId
        setApplicationData({
          // Update applicationData to include the new ID
          id: appId,
          agent_email: user?.primaryEmailAddress?.emailAddress,
          dba_email: merchantEmail,
          status: "draft",
          created_at: new Date().toISOString(),
        })
      }

      const response = await fetch("/api/save-prefill-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId: appId,
          formData,
          principals,
          merchantEmail,
          action: "send",
          uploads,
          agentName: agentName.trim(),
        }),
      })

      const result = await response.json()
      if (!result.success) throw new Error(result.error || "Failed to send invitation.")

      setGeneratedLink(result.link)
      toast({
        title: "Success!",
        description: "Invitation sent successfully.",
      })

      // Redirect after a short delay
      setTimeout(() => {
        window.location.href = "/invite"
      }, 1500)
    } catch (error) {
      console.error("Send to merchant error:", error)
      toast({
        title: "Error sending invitation",
        description: error instanceof Error ? error.message : "An unknown error occurred.",
        variant: "destructive",
      })
    } finally {
      setIsSubmittingAgentAction(false)
    }
  }

  const handleCopyLink = async () => {
    if (!agentName || agentName.trim() === "") {
      toast({
        title: "Agent Name Required",
        description: "Please enter your agent name before generating a link.",
        variant: "destructive",
      })
      return
    }

    setIsSubmittingAgentAction(true)
    setGeneratedLink("") // Clear previous link

    try {
      let appId = applicationData?.id

      if (!appId) {
        // Create an invite if one doesn't exist yet
        const createRes = await fetch("/api/generate-merchant-invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agent_email: user?.primaryEmailAddress?.emailAddress,
            merchant_email: null, // No merchant email needed for link generation
            agent_name: agentName.trim(),
          }),
        })
        const createResult = await createRes.json()
        if (!createResult.success) throw new Error(createResult.error || "Failed to create application.")
        appId = createResult.inviteId
        setApplicationData({
          id: appId,
          agent_email: user?.primaryEmailAddress?.emailAddress,
          dba_email: "", // No merchant email yet
          status: "draft",
          created_at: new Date().toISOString(),
        })
      }

      const response = await fetch("/api/save-prefill-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId: appId,
          formData,
          principals,
          merchantEmail, // Still needed for potential future use even if not sending directly
          action: "copy",
          uploads,
          agentName: agentName.trim(),
        }),
      })

      const result = await response.json()
      if (!result.success) throw new Error(result.error || "Failed to generate link.")

      setGeneratedLink(result.link)
      toast({
        title: "Success!",
        description: "Link copied to clipboard.",
      })
      await navigator.clipboard.writeText(result.link)

      // Redirect to invite page after a short delay
      setTimeout(() => {
        window.location.href = "/invite"
      }, 1500)
    } catch (error) {
      console.error("Copy link error:", error)
      toast({
        title: "Error copying link",
        description: error instanceof Error ? error.message : "An unknown error occurred.",
        variant: "destructive",
      })
    } finally {
      setIsSubmittingAgentAction(false)
    }
  }

  return (
    <div className="w-full max-w-none md:max-w-4xl mx-auto px-4 sm:px-6 md:p-6 overflow-x-hidden overflow-y-auto">
      {isUnauthorized && renderUnauthorizedAccess()}
      {mainContentVisible && !isSubmitted && (
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">New Merchant Application</h1>
          <p className="text-lg text-gray-600 mt-2">
            {isAgentMode
              ? "Pre-fill the application for the merchant"
              : "Complete all steps to submit your application"}
          </p>
        </div>
      )}
      {mainContentVisible && !isSubmitted && renderStepIndicator()}
      {!isUnauthorized && <div className="mt-8">{renderCurrentStep()}</div>}
      {mainContentVisible && !isSubmitted && currentStep < steps.length - 2 && (
        <div className="flex justify-between mt-8">
          <Button variant="outline" onClick={handleBack} disabled={currentStep === 0}>
            Back
          </Button>
          <Button onClick={handleNext}>Next</Button>
        </div>
      )}
      {mainContentVisible && !isSubmitted && currentStep === steps.length - 2 && (
        <div className="flex justify-between mt-8">
          <Button variant="outline" onClick={handleBack} disabled={currentStep === 0}>
            Back
          </Button>
          <Button onClick={handleSubmit} className="bg-green-600 hover:bg-green-700">
            Submit Application
          </Button>
        </div>
      )}
      <MerchantQuickActions
        formData={formData}
        principals={principals}
        uploads={uploads}
        isAgentMode={isAgentMode}
        show={mainContentVisible && !isSubmitted && currentStep > 0}
      />
      {isAgentMode &&
        !isSubmitted &&
        !isExpired &&
        !isAlreadySubmitted &&
        steps[currentStep]?.id !== "welcome" &&
        steps[currentStep]?.id !== "confirmation" && (
          <div className="mt-8 border-t pt-6">
            <h3 className="text-lg font-semibold mb-4">Agent Actions</h3>
            <div className="p-4 border rounded-lg bg-blue-50 space-y-4">
              <div className="bg-blue-100 border-l-4 border-blue-400 p-3 mb-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <AlertTriangle className="h-5 w-5 text-blue-400" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-blue-700">
                      <strong>Agent Mode:</strong> You can pre-fill this application and send it to the merchant.
                      Sensitive fields (SSN, bank details, etc.) and file uploads may be left blank for the merchant to
                      complete.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="merchantEmail" className="text-sm font-medium">
                  Merchant Email Address
                </Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    id="merchantEmail"
                    type="email"
                    placeholder="merchant@example.com"
                    value={merchantEmail}
                    onChange={(e) => {
                      setMerchantEmail(e.target.value)
                      if (errors.merchantEmail) setErrors((prev) => ({ ...prev, merchantEmail: "" })) // Clear error on change
                    }}
                    className={`flex-1 ${errors.merchantEmail ? "border-red-500" : ""}`}
                  />
                  <Button
                    onClick={handleSendToMerchant} // Use the dedicated send function
                    disabled={isSubmittingAgentAction || merchantEmail === ""}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {isSubmittingAgentAction ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-2 h-4 w-4" />
                    )}
                    Send Invite
                  </Button>
                </div>
                {merchantEmail === "" && ( // Show message only if email is empty
                  <p className="text-sm text-gray-500 mt-1">
                    Enter the merchant's email address to send the pre-filled application
                  </p>
                )}
                {errors.merchantEmail && <p className="text-red-500 text-sm mt-1">{errors.merchantEmail}</p>}
              </div>

              <div className="flex items-center">
                <div className="flex-1 border-t border-gray-300"></div>
                <div className="px-3 text-sm text-gray-500 bg-blue-50">OR</div>
                <div className="flex-1 border-t border-gray-300"></div>
              </div>

              <div>
                <Label className="text-sm font-medium">Copy Application Link</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    value={generatedLink || "Click 'Copy Link' to generate"}
                    readOnly
                    className="flex-1 bg-gray-50"
                  />
                  <Button
                    onClick={handleCopyLink} // Use the dedicated copy link function
                    variant="outline"
                    disabled={isSubmittingAgentAction}
                    className="border-blue-300 text-blue-600 hover:bg-blue-50 bg-transparent"
                  >
                    {isSubmittingAgentAction ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Copy className="mr-2 h-4 w-4" />
                    )}
                    Copy Link
                  </Button>
                </div>
                <p className="text-sm text-gray-500 mt-1">Generate a link you can share manually with the merchant</p>
              </div>

              {isSubmittingAgentAction && (
                <div className="flex items-center gap-2 text-sm text-blue-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing your request...
                </div>
              )}

              {generatedLink && !isSubmittingAgentAction && (
                <div className="bg-green-50 border border-green-200 rounded p-3">
                  <div className="flex items-center gap-2 text-sm text-green-700">
                    <Check className="h-4 w-4" />
                    Link generated successfully! The application will be valid for 30 days.
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
    </div>
  )
}
