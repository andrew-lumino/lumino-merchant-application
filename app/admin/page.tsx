"use client"

import { useState, useEffect } from "react"
import MerchantApplicationsTable from "@/components/merchant-applications-table"
import ApplicationCardsManager from "@/components/application-cards-manager"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type Application = Record<string, any>

export default function AdminPage() {
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchApplications = async () => {
      try {
        const response = await fetch("/api/merchant-applications")
        const data = await response.json()
        setApplications(data)
      } catch (error) {
        console.error("Error fetching applications:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchApplications()
  }, [])

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Merchant Applications</h1>
          <p>Loading applications...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Merchant Applications</h1>
        <p className="text-lg text-gray-600 mt-2">Manage and review merchant applications</p>
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
