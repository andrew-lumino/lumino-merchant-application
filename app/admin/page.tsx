"use client"

import { useState, useEffect } from "react"
import { useUser } from "@clerk/nextjs"
import MerchantApplicationsTable from "@/components/merchant-applications-table"
import ApplicationCardsManager from "@/components/application-cards-manager"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const ADMIN_USERS = ["andrew", "giorgio", "zachry", "david", "garrett", "priscilla", "wesley"]

type Application = Record<string, any>

export default function AdminPage() {
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [meta, setMeta] = useState<{ isAdmin: boolean; userEmail: string; total: number; filtered: boolean } | null>(
    null,
  )
  const { user, isLoaded } = useUser()
  const userEmail = user?.emailAddresses?.[0]?.emailAddress ?? ""

  const emailPrefix = userEmail.toLowerCase().split("@")[0]
  const isAdmin = userEmail.toLowerCase().endsWith("@golumino.com") && ADMIN_USERS.includes(emailPrefix)

  useEffect(() => {
    if (!isLoaded) return

    const fetchApplications = async () => {
      try {
        const response = await fetch("/api/merchant-applications?loadAll=true")
        const data = await response.json()

        if (data.applications) {
          setApplications(data.applications)
          setMeta(data.meta)
        } else if (Array.isArray(data)) {
          // Backwards compatibility
          setApplications(data)
        }
      } catch (error) {
        console.error("Error fetching applications:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchApplications()
  }, [isLoaded])

  if (loading || !isLoaded) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            {isAdmin ? "Applications Manager" : "My Applications"}
          </h1>
          <p>Loading applications...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {isAdmin ? "Applications Manager" : "My Applications"}
        </h1>
        <p className="text-gray-600">
          {isAdmin ? "Manage all merchant applications across your team" : "View and manage your merchant applications"}
        </p>
        <p className="text-sm text-gray-500 mt-2">
          Logged in as: {userEmail}{" "}
          {isAdmin ? (
            <span className="text-blue-600 font-medium">(Admin - viewing all applications)</span>
          ) : (
            <span className="text-orange-600 font-medium">(Agent - viewing your applications only)</span>
          )}
        </p>
      </div>

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="grid w-full max-w-md mx-auto grid-cols-2">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="table">Detailed Table</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6">
          <ApplicationCardsManager applications={applications} />
        </TabsContent>

        <TabsContent value="table" className="mt-6">
          <MerchantApplicationsTable applications={applications} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
