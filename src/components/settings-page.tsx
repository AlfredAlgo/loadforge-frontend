"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Switch } from "~/components/ui/switch"
import { Badge } from "~/components/ui/badge"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "~/components/ui/select"
import { Save, Building2, Users, Globe, Plus, Trash2, ShieldCheck } from "lucide-react"
import { api } from "~/trpc/react"

export function SettingsPage() {
  const { data: whoAmI } = api.team.whoAmI.useQuery()
  const isAdmin = whoAmI?.role === "admin"

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-600">Configure your load testing preferences</p>
      </div>

      <div className="space-y-6">
        <GeneralSettings />
        <SingleSignOnSettings isAdmin={isAdmin} />
        {isAdmin ? <TeamManagement /> : <MyTeam />}
        <SavedEnvironments />
      </div>
    </main>
  )
}

// ── General ────────────────────────────────────────────────────────────────
function GeneralSettings() {
  const { data, isLoading } = api.settings.getGeneral.useQuery()
  const update = api.settings.updateGeneral.useMutation()
  const [form, setForm] = useState({
    emailEnabled: false,
    emailRecipient: "",
    notificationsEnabled: true,
    defaultDuration: 300,
    defaultRampUp: 60,
    defaultRampDown: 60,
  })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (data) setForm(data)
  }, [data])

  const save = () => {
    update.mutate(form, {
      onSuccess: () => {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      },
    })
  }

  return (
    <Card className="border-gray-200">
      <CardHeader>
        <CardTitle className="text-gray-900">Email Notifications</CardTitle>
        <CardDescription className="text-gray-600">
          Your preference is saved now — actually sending the email needs an SMTP/email-provider integration that isn't wired up yet.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <Label htmlFor="email-enabled" className="text-gray-700">
                Email me when a test completes
              </Label>
              <Switch
                id="email-enabled"
                checked={form.emailEnabled}
                onCheckedChange={(v) => setForm({ ...form, emailEnabled: v })}
              />
            </div>
            {form.emailEnabled && (
              <div>
                <Label htmlFor="recipient-email" className="text-gray-700">
                  Recipient Email
                </Label>
                <Input
                  id="recipient-email"
                  placeholder="admin@company.com"
                  value={form.emailRecipient}
                  onChange={(e) => setForm({ ...form, emailRecipient: e.target.value })}
                  className="border-gray-300"
                />
              </div>
            )}

            <div className="border-t border-gray-100 pt-4">
              <p className="mb-3 text-sm font-medium text-gray-700">Test Defaults</p>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label htmlFor="default-duration" className="text-gray-700">
                    Duration (s)
                  </Label>
                  <Input
                    id="default-duration"
                    type="number"
                    value={form.defaultDuration}
                    onChange={(e) => setForm({ ...form, defaultDuration: Number(e.target.value) })}
                    className="border-gray-300"
                  />
                </div>
                <div>
                  <Label htmlFor="default-ramp" className="text-gray-700">
                    Ramp-up (s)
                  </Label>
                  <Input
                    id="default-ramp"
                    type="number"
                    value={form.defaultRampUp}
                    onChange={(e) => setForm({ ...form, defaultRampUp: Number(e.target.value) })}
                    className="border-gray-300"
                  />
                </div>
                <div>
                  <Label htmlFor="default-rampdown" className="text-gray-700">
                    Ramp-down (s)
                  </Label>
                  <Input
                    id="default-rampdown"
                    type="number"
                    value={form.defaultRampDown}
                    onChange={(e) => setForm({ ...form, defaultRampDown: Number(e.target.value) })}
                    className="border-gray-300"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              {saved && <span className="text-sm text-green-600">Saved.</span>}
              <Button
                onClick={save}
                disabled={update.isPending}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
              >
                <Save className="mr-2 h-4 w-4" />
                {update.isPending ? "Saving…" : "Save Settings"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

// ── Single Sign-On (not wired to a provider yet) ────────────────────────────
function SingleSignOnSettings({ isAdmin }: { isAdmin: boolean }) {
  const { data, isLoading } = api.settings.getSso.useQuery()
  const update = api.settings.updateSso.useMutation()
  const [form, setForm] = useState({
    provider: "azure_ad" as "azure_ad" | "okta" | "generic_oidc",
    clientId: "",
    clientSecret: "",
    issuerUrl: "",
  })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (data) setForm(data)
  }, [data])

  const save = () => {
    update.mutate(form, {
      onSuccess: () => {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      },
    })
  }

  return (
    <Card className="border-gray-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-gray-900">
          <Building2 className="h-5 w-5 text-gray-400" />
          Single Sign-On
          <Badge variant="outline" className="border-amber-300 text-amber-700">Coming soon</Badge>
        </CardTitle>
        <CardDescription className="text-gray-600">
          Configure the identity provider here now — logging in with it isn't wired up yet, but the config will be ready the moment it is.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : (
          <>
            <div>
              <Label className="text-gray-700">Provider</Label>
              <Select
                disabled={!isAdmin}
                value={form.provider}
                onValueChange={(v) => setForm({ ...form, provider: v as typeof form.provider })}
              >
                <SelectTrigger className="border-gray-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="azure_ad">Azure AD / Entra ID</SelectItem>
                  <SelectItem value="okta">Okta</SelectItem>
                  <SelectItem value="generic_oidc">Generic OIDC</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="sso-client-id" className="text-gray-700">Client ID</Label>
                <Input
                  id="sso-client-id"
                  disabled={!isAdmin}
                  value={form.clientId}
                  onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                  className="border-gray-300"
                />
              </div>
              <div>
                <Label htmlFor="sso-client-secret" className="text-gray-700">Client Secret</Label>
                <Input
                  id="sso-client-secret"
                  type="password"
                  disabled={!isAdmin}
                  value={form.clientSecret}
                  onChange={(e) => setForm({ ...form, clientSecret: e.target.value })}
                  className="border-gray-300"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="sso-issuer" className="text-gray-700">Issuer URL</Label>
              <Input
                id="sso-issuer"
                disabled={!isAdmin}
                placeholder="https://login.microsoftonline.com/<tenant>/v2.0"
                value={form.issuerUrl}
                onChange={(e) => setForm({ ...form, issuerUrl: e.target.value })}
                className="border-gray-300"
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-3">
              <Label className="text-gray-500">Enable single sign-on for login</Label>
              <Switch checked={false} disabled title="Coming soon" />
            </div>

            {isAdmin ? (
              <div className="flex items-center justify-end gap-3">
                {saved && <span className="text-sm text-green-600">Saved.</span>}
                <Button onClick={save} disabled={update.isPending} variant="outline">
                  <Save className="mr-2 h-4 w-4" />
                  {update.isPending ? "Saving…" : "Save SSO Config"}
                </Button>
              </div>
            ) : (
              <p className="text-xs text-gray-500">Only an admin can change these settings.</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

// ── My Team (non-admin view) ────────────────────────────────────────────────
function MyTeam() {
  const { data: whoAmI } = api.team.whoAmI.useQuery()
  const { data: teammates } = api.team.getMyTeammates.useQuery()

  return (
    <Card className="border-gray-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-gray-900">
          <Users className="h-5 w-5 text-gray-400" />
          My Team
        </CardTitle>
        <CardDescription className="text-gray-600">
          Teammates can see and sign off on each other's tests and results.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!whoAmI?.team ? (
          <p className="text-sm text-gray-500">
            You're not part of a team yet — ask an admin to add you to one from Team Management.
          </p>
        ) : (
          <>
            <p className="mb-3 text-sm text-gray-700">
              Team: <span className="font-medium">{whoAmI.team.name}</span>
            </p>
            <div className="space-y-2">
              {(teammates ?? []).map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded-lg border border-gray-200 p-2.5">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{m.name}</p>
                    <p className="text-xs text-gray-500">{m.email}</p>
                  </div>
                  {m.role === "admin" && (
                    <Badge className="bg-purple-100 text-purple-700">
                      <ShieldCheck className="mr-1 h-3 w-3" /> Admin
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

// ── Team Management (admin view) ────────────────────────────────────────────
function TeamManagement() {
  const utils = api.useUtils()
  const { data: teams } = api.team.listTeams.useQuery()
  const { data: allUsers } = api.team.listAllUsers.useQuery()
  const createTeam = api.team.createTeam.useMutation({ onSuccess: () => void utils.team.listTeams.invalidate() })
  const deleteTeam = api.team.deleteTeam.useMutation({
    onSuccess: () => {
      void utils.team.listTeams.invalidate()
      void utils.team.listAllUsers.invalidate()
    },
  })
  const setUserTeam = api.team.setUserTeam.useMutation({
    onSuccess: () => {
      void utils.team.listTeams.invalidate()
      void utils.team.listAllUsers.invalidate()
    },
  })
  const setUserRole = api.team.setUserRole.useMutation({ onSuccess: () => void utils.team.listAllUsers.invalidate() })
  const [newTeamName, setNewTeamName] = useState("")

  return (
    <Card className="border-gray-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-gray-900">
          <ShieldCheck className="h-5 w-5 text-purple-600" />
          Team Management
          <Badge className="bg-purple-100 text-purple-700">Admin</Badge>
        </CardTitle>
        <CardDescription className="text-gray-600">
          Create teams and assign colleagues so they can see each other's tests. You, as admin, always see every team's tests and results.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex gap-2">
          <Input
            placeholder="New team name"
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            className="border-gray-300"
          />
          <Button
            disabled={!newTeamName.trim() || createTeam.isPending}
            onClick={() => {
              createTeam.mutate({ name: newTeamName.trim() })
              setNewTeamName("")
            }}
          >
            <Plus className="mr-1 h-4 w-4" /> Create Team
          </Button>
        </div>

        <div className="space-y-4">
          {(teams ?? []).map((team) => (
            <div key={team.id} className="rounded-lg border border-gray-200 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-medium text-gray-900">{team.name}</p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-500 hover:bg-red-50 hover:text-red-600"
                  onClick={() => deleteTeam.mutate({ teamId: team.id })}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              {team.members.length === 0 ? (
                <p className="text-xs text-gray-500">No members yet.</p>
              ) : (
                <div className="space-y-1">
                  {team.members.map((m) => (
                    <div key={m.id} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">{m.name} <span className="text-gray-400">({m.email})</span></span>
                      <Button size="sm" variant="ghost" onClick={() => setUserTeam.mutate({ userId: m.id, teamId: null })}>
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="border-t border-gray-100 pt-4">
          <p className="mb-3 text-sm font-medium text-gray-700">All Users — role & team</p>
          <div className="space-y-2">
            {(allUsers ?? []).map((u) => (
              <div key={u.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 p-2.5">
                <div>
                  <p className="text-sm font-medium text-gray-900">{u.name}</p>
                  <p className="text-xs text-gray-500">{u.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={u.teamId ?? "none"}
                    onValueChange={(v) => setUserTeam.mutate({ userId: u.id, teamId: v === "none" ? null : v })}
                  >
                    <SelectTrigger className="h-8 w-36 border-gray-300 text-xs">
                      <SelectValue placeholder="No team" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No team</SelectItem>
                      {(teams ?? []).map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={u.role}
                    onValueChange={(v) => setUserRole.mutate({ userId: u.id, role: v as "admin" | "tester" })}
                  >
                    <SelectTrigger className="h-8 w-28 border-gray-300 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tester">Tester</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Saved Environments ──────────────────────────────────────────────────────
function SavedEnvironments() {
  const utils = api.useUtils()
  const { data: environments, isLoading } = api.environments.list.useQuery()
  const create = api.environments.create.useMutation({ onSuccess: () => void utils.environments.list.invalidate() })
  const remove = api.environments.delete.useMutation({ onSuccess: () => void utils.environments.list.invalidate() })
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: "", baseUrl: "", headerKey: "", headerValue: "" })

  const submit = () => {
    create.mutate(
      {
        name: form.name,
        baseUrl: form.baseUrl,
        headers: form.headerKey ? { [form.headerKey]: form.headerValue } : undefined,
      },
      {
        onSuccess: () => {
          setForm({ name: "", baseUrl: "", headerKey: "", headerValue: "" })
          setShowForm(false)
        },
      },
    )
  }

  return (
    <Card className="border-gray-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-gray-900">
          <Globe className="h-5 w-5 text-gray-400" />
          Saved Environments
        </CardTitle>
        <CardDescription className="text-gray-600">
          Reusable target URLs (e.g. Staging, Production) so you don't retype them for every new test. Shared with your team if you're on one.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : (environments ?? []).length === 0 && !showForm ? (
          <p className="text-sm text-gray-500">No saved environments yet.</p>
        ) : (
          <div className="space-y-2">
            {(environments ?? []).map((env) => (
              <div key={env.id} className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{env.name}</p>
                  <p className="text-xs text-gray-500">{env.baseUrl}</p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-500 hover:bg-red-50 hover:text-red-600"
                  onClick={() => remove.mutate({ id: env.id })}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {showForm ? (
          <div className="space-y-3 rounded-lg border border-gray-200 p-3">
            <div>
              <Label className="text-gray-700">Name</Label>
              <Input
                placeholder="Staging"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="border-gray-300"
              />
            </div>
            <div>
              <Label className="text-gray-700">Base URL</Label>
              <Input
                placeholder="https://staging.example.gov.za"
                value={form.baseUrl}
                onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
                className="border-gray-300"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-gray-700">Header name (optional)</Label>
                <Input
                  placeholder="Authorization"
                  value={form.headerKey}
                  onChange={(e) => setForm({ ...form, headerKey: e.target.value })}
                  className="border-gray-300"
                />
              </div>
              <div>
                <Label className="text-gray-700">Header value</Label>
                <Input
                  placeholder="Bearer ..."
                  value={form.headerValue}
                  onChange={(e) => setForm({ ...form, headerValue: e.target.value })}
                  className="border-gray-300"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button disabled={!form.name || !form.baseUrl || create.isPending} onClick={submit}>
                {create.isPending ? "Saving…" : "Save Environment"}
              </Button>
            </div>
            {create.error && <p className="text-sm text-red-500">{create.error.message}</p>}
          </div>
        ) : (
          <Button variant="outline" onClick={() => setShowForm(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add Environment
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
