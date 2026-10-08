import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { FileText } from "lucide-react"
import { BRS_FIELD_LABELS, BRS_REPORT_FIELD_ORDER } from "~/lib/brs-fields"

/** On-screen counterpart to pdf-report.ts's brsContextSection — shows
 *  whatever BRS fields were captured for this test, right on the results
 *  page, not just buried in the PDF. Renders nothing if there's no BRS
 *  data attached to this test. */
export function BrsContextCard({ context }: { context: Record<string, string> | null | undefined }) {
  const entries = BRS_REPORT_FIELD_ORDER
    .filter((key) => context?.[key])
    .map((key) => [BRS_FIELD_LABELS[key] ?? key, context![key]!] as const)

  if (entries.length === 0) return null

  return (
    <Card className="border-gray-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-gray-900">
          <FileText className="h-5 w-5 text-gray-400" />
          Business Requirements Context
        </CardTitle>
        <CardDescription className="text-gray-600">
          Captured from the BRS document (or entered manually) when this test was created.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {entries.map(([label, value]) => (
          <div key={label}>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
            <p className="text-sm text-gray-800">{value}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
