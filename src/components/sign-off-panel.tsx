"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card"
import { Button } from "~/components/ui/button"
import { Textarea } from "~/components/ui/textarea"
import { Badge } from "~/components/ui/badge"
import { CheckCircle2, AlertTriangle, XCircle, ShieldCheck } from "lucide-react"
import { api } from "~/trpc/react"

export interface SignOffEntry {
  id: string
  decision: "approved" | "approved_with_reservations" | "rejected"
  comment: string | null
  createdAt: string
  userName: string
  userEmail: string
}

const DECISIONS: Array<{
  value: SignOffEntry["decision"]
  label: string
  icon: typeof CheckCircle2
  badgeClass: string
  buttonClass: string
}> = [
  {
    value: "approved",
    label: "Approve",
    icon: CheckCircle2,
    badgeClass: "bg-green-100 text-green-700",
    buttonClass: "bg-green-600 hover:bg-green-700",
  },
  {
    value: "approved_with_reservations",
    label: "Approve with reservations",
    icon: AlertTriangle,
    badgeClass: "bg-amber-100 text-amber-700",
    buttonClass: "bg-amber-600 hover:bg-amber-700",
  },
  {
    value: "rejected",
    label: "Reject",
    icon: XCircle,
    badgeClass: "bg-red-100 text-red-700",
    buttonClass: "bg-red-600 hover:bg-red-700",
  },
]

/**
 * Sign-off is the audit trail a government submission needs on top of the
 * system's own automated readiness verdict: a named person's decision,
 * with a timestamp, that a human can point to later. Entries are
 * append-only — there's no edit/delete, which is what makes the trail
 * trustworthy as an audit record.
 */
export function SignOffPanel({ testId, signOffs }: { testId: string | null; signOffs: SignOffEntry[] }) {
  const [decision, setDecision] = useState<SignOffEntry["decision"] | null>(null)
  const [comment, setComment] = useState("")
  const utils = api.useUtils()

  const create = api.signoff.create.useMutation({
    onSuccess: () => {
      setDecision(null)
      setComment("")
      void utils.signoff.list.invalidate({ testId: testId ?? "" })
    },
  })

  if (!testId) return null

  return (
    <Card className="border-gray-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-gray-900">
          <ShieldCheck className="h-5 w-5 text-purple-600" />
          Sign-Off / Audit Trail
        </CardTitle>
        <CardDescription className="text-gray-600">
          Recorded decisions travel with this result, in the app and in the PDF — this is the record a reviewer or auditor can point to later.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {signOffs.length === 0 ? (
          <p className="text-sm text-gray-500">No sign-off has been recorded for this test yet.</p>
        ) : (
          <div className="space-y-2">
            {signOffs.map((entry) => {
              const meta = DECISIONS.find((d) => d.value === entry.decision)!
              const Icon = meta.icon
              return (
                <div key={entry.id} className="rounded-lg border border-gray-200 p-3">
                  <div className="flex items-center justify-between">
                    <Badge className={meta.badgeClass}>
                      <Icon className="mr-1 h-3 w-3" />
                      {meta.label.replace(/^Approve$/, "Approved").replace(/^Reject$/, "Rejected")}
                    </Badge>
                    <span className="text-xs text-gray-500">
                      {entry.userName} ({entry.userEmail}) · {new Date(entry.createdAt).toLocaleString()}
                    </span>
                  </div>
                  {entry.comment && <p className="mt-2 text-sm text-gray-700">{entry.comment}</p>}
                </div>
              )
            })}
          </div>
        )}

        <div className="border-t border-gray-100 pt-4">
          <p className="mb-2 text-sm font-medium text-gray-700">Record a sign-off decision</p>
          <div className="mb-3 flex flex-wrap gap-2">
            {DECISIONS.map((d) => (
              <Button
                key={d.value}
                size="sm"
                variant={decision === d.value ? "default" : "outline"}
                className={decision === d.value ? d.buttonClass : "border-gray-200 text-gray-600"}
                onClick={() => setDecision(d.value)}
              >
                <d.icon className="mr-1 h-3.5 w-3.5" />
                {d.label}
              </Button>
            ))}
          </div>
          {decision && (
            <div className="space-y-2">
              <Textarea
                placeholder="Optional comment — e.g. conditions for approval, or why this was rejected."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="border-gray-300"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={create.isPending}
                  onClick={() => create.mutate({ testId, decision, comment: comment.trim() || undefined })}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  {create.isPending ? "Recording…" : "Submit sign-off"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setDecision(null); setComment("") }}>
                  Cancel
                </Button>
              </div>
              {create.error && <p className="text-sm text-red-500">{create.error.message}</p>}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
