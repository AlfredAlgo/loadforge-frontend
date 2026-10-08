/**
 * Single source of truth for the structured BRS fields, shared by the
 * manual-entry form, the BRS upload API route's extraction, and the PDF/
 * Excel report rendering — so a field captured any of those ways is always
 * labeled and ordered the same way wherever it shows up.
 */
export const BRS_FIELD_LABELS: Record<string, string> = {
  title: "Title of system",
  requestedBy: "Requested by",
  purpose: "Purpose / Reason",
  rootCause: "Root cause",
  currentProcess: "Current process",
  requirementDescription: "Requirement description",
  targetOutcome: "Target outcome",
  priority: "Priority level",
};

// Display order for the report. "title" is excluded — it's already shown
// as the test's own name in every report, so repeating it here would be
// redundant.
export const BRS_REPORT_FIELD_ORDER = [
  "requestedBy",
  "purpose",
  "rootCause",
  "currentProcess",
  "requirementDescription",
  "targetOutcome",
  "priority",
] as const;
