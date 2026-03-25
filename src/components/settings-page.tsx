"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Switch } from "~/components/ui/switch"
import { Save } from "lucide-react"

export function SettingsPage() {
  const [emailEnabled, setEmailEnabled] = useState(true)
  const [slackEnabled, setSlackEnabled] = useState(false)

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-600">Configure your load testing preferences</p>
      </div>

      <div className="space-y-6">
        <Card className="border-gray-200">
          <CardHeader>
            <CardTitle className="text-gray-900">Email Notifications</CardTitle>
            <CardDescription className="text-gray-600">Configure email alerts for test completion</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="email-enabled" className="text-gray-700">
                Enable email notifications
              </Label>
              <Switch id="email-enabled" checked={emailEnabled} onCheckedChange={setEmailEnabled} />
            </div>
            {emailEnabled && (
              <>
                <div>
                  <Label htmlFor="smtp-host" className="text-gray-700">
                    SMTP Host
                  </Label>
                  <Input id="smtp-host" placeholder="smtp.gmail.com" className="border-gray-300" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="smtp-port" className="text-gray-700">
                      SMTP Port
                    </Label>
                    <Input id="smtp-port" placeholder="587" type="number" className="border-gray-300" />
                  </div>
                  <div>
                    <Label htmlFor="smtp-user" className="text-gray-700">
                      SMTP Username
                    </Label>
                    <Input id="smtp-user" placeholder="your@email.com" className="border-gray-300" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="smtp-password" className="text-gray-700">
                    SMTP Password
                  </Label>
                  <Input id="smtp-password" type="password" className="border-gray-300" />
                </div>
                <div>
                  <Label htmlFor="recipient-email" className="text-gray-700">
                    Recipient Email
                  </Label>
                  <Input id="recipient-email" placeholder="admin@company.com" className="border-gray-300" />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-gray-200">
          <CardHeader>
            <CardTitle className="text-gray-900">AWS Configuration</CardTitle>
            <CardDescription className="text-gray-600">Set up AWS Lambda for distributed testing</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="aws-region" className="text-gray-700">
                AWS Region
              </Label>
              <Input id="aws-region" placeholder="us-east-1" className="border-gray-300" />
            </div>
            <div>
              <Label htmlFor="lambda-function" className="text-gray-700">
                Lambda Function Name
              </Label>
              <Input id="lambda-function" placeholder="loadtest-runner" className="border-gray-300" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-200">
          <CardHeader>
            <CardTitle className="text-gray-900">Test Defaults</CardTitle>
            <CardDescription className="text-gray-600">Default settings for new tests</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="default-concurrency" className="text-gray-700">
                Default Concurrency
              </Label>
              <Input id="default-concurrency" placeholder="10,20,30" className="border-gray-300" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="default-ramp" className="text-gray-700">
                  Default Ramp Duration (s)
                </Label>
                <Input id="default-ramp" placeholder="60" type="number" className="border-gray-300" />
              </div>
              <div>
                <Label htmlFor="default-hold" className="text-gray-700">
                  Default Hold Duration (s)
                </Label>
                <Input id="default-hold" placeholder="120" type="number" className="border-gray-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700">
            <Save className="mr-2 h-4 w-4" />
            Save Settings
          </Button>
        </div>
      </div>
    </main>
  )
}
