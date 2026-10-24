"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Textarea } from "~/components/ui/textarea"
import { Badge } from "~/components/ui/badge"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "~/components/ui/select"
import { CheckCircle2, AlertTriangle, XCircle, MinusCircle, ClipboardCheck, Pencil, Trash2, Plus } from "lucide-react"
import { api } from "~/trpc/react"

export interface TestClaim {
  id: string
  requirement: string
  claim: string
  verdict: "met" | "partially_met" | "not_met" | "n_a"
  createdAt: string
  updatedAt: string
  userName: string
  userEmail: string
}

const VERDICTS: Array<{ value: TestClaim["verdict"]; label: string; icon: typeof CheckCircle2; badgeClass: string }> = [
  { value: "met", label: "Met", icon: CheckCircle2, badgeClass: "bg-green-100 text-green-700" },
  { value: "partially_met", label: "Partially met", icon: AlertTriangle, badgeClass: "bg-amber-100 text-amber-700" },
  { value: "not_met", label: "Not met", icon: XCircle, badgeClass: "bg-red-100 text-red-700" },
  { value: "n_a", label: "N/A", icon: MinusCircle, badgeClass: "bg-gray-100 text-gray-500" },
]

const EMPTY_FORM = { requirement: "", claim: "", verdict: "met" as TestClaim["verdict"] }

/**
 * A manual claim — "the process owner confirms this test demonstrates
 * requirement X was met" — recorded after the test completes, before the
 * report is generated. Unlike sign-off, these are editable/deletable:
 * they're drafted report content, not a decision of record, so fixing a
 * typo doesn't need a whole new entry.
 */
export function TestClaimsPanel({ testId }: { testId: string | null }) {
  const utils = api.useUtils()
  const { data: claims } = api.claims.list.useQuery({ testId: testId ?? "" }, { enabled: !!testId })
  const [adding, setAdding] = useState(false)
  const [addForm, setAddForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState(EMPTY_FORM)

  const invalidate = () => void utils.claims.list.invalidate({ testId: testId ?? "" })
  const create = api.claims.create.useMutation({
    onSuccess: () => { setAdding(false); setAddForm(EMPTY_FORM); invalidate() },
  })
  const update = api.claims.update.useMutation({
    onSuccess: () => { setEditingId(null); invalidate() },
  })
  const remove = api.claims.delete.useMutation({ onSuccess: invalidate })

  if (!testId) return null

  const startEdit = (c: TestClaim) => {
    setEditingId(c.id)
    setEditForm({ requirement: c.requirement, claim: c.claim, verdict: c.verdict })
  }

  return (
    <Card className="border-gray-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-gray-900">
          <ClipboardCheck className="h-5 w-5 text-purple-600" />
          Test Claims
        </CardTitle>
        <CardDescription className="text-gray-600">
          Manual confirmation that a specific BRS requirement was (or wasn't) demonstrated by this run — written by a tester or process owner, separate from the system's own automated readiness verdict below.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {(claims ?? []).length === 0 && !adding && (
          <p className="text-sm text-gray-500">No requirement claims have been recorded for this test yet.</p>
        )}

        {(claims ?? []).map((c) => {
          const meta = VERDICTS.find((v) => v.value === c.verdict)!
          const Icon = meta.icon
          if (editingId === c.id) {
            return (
              <ClaimForm
                key={c.id}
                form={editForm}
                setForm={setEditForm}
                onCancel={() => setEditingId(null)}
                onSubmit={() => update.mutate({ id: c.id, ...editForm })}
                pending={update.isPending}
                error={update.error?.message}
                submitLabel="Save changes"
              />
            )
          }
          return (
            <div key={c.id} className="rounded-lg border border-gray-200 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900">{c.requirement}</p>
                  <p className="mt-1 text-sm text-gray-700">{c.claim}</p>
                  <p className="mt-2 text-xs text-gray-500">
                    {c.userName} ({c.userEmail}) · {new Date(c.updatedAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Badge className={meta.badgeClass}>
                    <Icon className="mr-1 h-3 w-3" />
                    {meta.label}
                  </Badge>
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-gray-400 hover:text-gray-700" onClick={() => startEdit(c)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    disabled={remove.isPending}
                    onClick={() => remove.mutate({ id: c.id })}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          )
        })}

        {adding ? (
          <ClaimForm
            form={addForm}
            setForm={setAddForm}
            onCancel={() => { setAdding(false); setAddForm(EMPTY_FORM) }}
            onSubmit={() => create.mutate({ testId, ...addForm })}
            pending={create.isPending}
            error={create.error?.message}
            submitLabel="Add claim"
          />
        ) : (
          <Button size="sm" variant="outline" className="border-gray-300 text-gray-600" onClick={() => setAdding(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add claim
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

function ClaimForm({
  form, setForm, onCancel, onSubmit, pending, error, submitLabel,
}: {
  form: typeof EMPTY_FORM
  setForm: (f: typeof EMPTY_FORM) => void
  onCancel: () => void
  onSubmit: () => void
  pending: boolean
  error?: string
  submitLabel: string
}) {
  return (
    <div className="space-y-2 rounded-lg border border-purple-200 bg-purple-50/30 p-3">
      <Input
        placeholder="Requirement — e.g. “Support 200 concurrent users with <2s response time”"
        value={form.requirement}
        onChange={(e) => setForm({ ...form, requirement: e.target.value })}
        className="border-gray-300 bg-white"
      />
      <Textarea
        placeholder="Claim — what in this test's results demonstrates (or doesn't demonstrate) that requirement, e.g. “Phase 3 ran 200 concurrent users at 97% success, avg 1.4s response time.”"
        value={form.claim}
        onChange={(e) => setForm({ ...form, claim: e.target.value })}
        className="border-gray-300 bg-white"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Select value={form.verdict} onValueChange={(v) => setForm({ ...form, verdict: v as TestClaim["verdict"] })}>
          <SelectTrigger className="h-9 w-44 border-gray-300 bg-white text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VERDICTS.map((v) => (
              <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          disabled={pending || !form.requirement.trim() || !form.claim.trim()}
          onClick={onSubmit}
          className="bg-purple-600 hover:bg-purple-700"
        >
          {pending ? "Saving…" : submitLabel}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  )
}
