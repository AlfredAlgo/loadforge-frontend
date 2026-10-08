"use client";

import { useState } from "react";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "~/components/ui/select";
import { Upload, Loader2, Pencil } from "lucide-react";
import { BRS_FIELD_LABELS } from "~/lib/brs-fields";

export interface BrsApplyPayload {
  testName: string;
  urls: string[];
  brsContext: Record<string, string>;
}

/**
 * BRS upload + manual-entry, shared between the load-test and functional-
 * test creation pages. Beyond pre-filling the test name, every captured
 * field is handed back via onApply so it can be stored with the test and
 * actually inform the generated report — not just used once and discarded.
 */
export function BrsUploadPanel({
  onApply,
  disabled = false,
  supportsUrls = true,
}: {
  onApply: (payload: BrsApplyPayload) => void;
  disabled?: boolean;
  supportsUrls?: boolean;
}) {
  const [brsMode, setBrsMode] = useState<"upload" | "manual">("upload");
  const [brsUploading, setBrsUploading] = useState(false);
  const [brsError, setBrsError] = useState<string | null>(null);
  const [brsSummary, setBrsSummary] = useState<{ source: string; lines: string[] } | null>(null);
  const [brsManual, setBrsManual] = useState({
    title: "", requestedBy: "", purpose: "", rootCause: "",
    currentProcess: "", requirementDescription: "", targetOutcome: "", priority: "",
  });

  const handleBrsUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".pdf") && !lower.endsWith(".docx") && !lower.endsWith(".txt")) {
      setBrsError("Please upload a .pdf, .docx, or .txt BRS document.");
      e.target.value = "";
      return;
    }
    setBrsError(null);
    setBrsSummary(null);
    setBrsUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/brs/parse", { method: "POST", body: form });
      const body = await res.json();
      if (!res.ok) {
        setBrsError(body.error || "Failed to parse BRS document.");
        return;
      }

      const data = body as {
        test_name: string;
        urls: string[];
        summary: string;
        brs_context: Record<string, string>;
      };

      const lines = Object.entries(data.brs_context)
        .map(([key, value]) => `${BRS_FIELD_LABELS[key] ?? key}: ${value.length > 140 ? value.slice(0, 140) + "…" : value}`);
      setBrsSummary({ source: file.name, lines: lines.length > 0 ? lines : [data.summary] });

      onApply({ testName: data.test_name, urls: data.urls, brsContext: data.brs_context });
    } catch (exc) {
      setBrsError(exc instanceof Error ? exc.message : "Failed to parse BRS document.");
    } finally {
      setBrsUploading(false);
      e.target.value = "";
    }
  };

  const applyBrsManual = () => {
    const title = brsManual.title.trim();
    if (!title) {
      setBrsError("Please provide at least the title of the system.");
      return;
    }
    setBrsError(null);

    const context: Record<string, string> = {};
    const lines: string[] = [];
    for (const [key, value] of Object.entries(brsManual)) {
      const trimmed = value.trim();
      if (!trimmed) continue;
      if (key !== "title") context[key] = trimmed;
      const label = BRS_FIELD_LABELS[key] ?? key;
      lines.push(`${label}: ${trimmed.length > 140 ? trimmed.slice(0, 140) + "…" : trimmed}`);
    }
    setBrsSummary({ source: "manual entry", lines });

    onApply({ testName: title, urls: [], brsContext: context });
  };

  return (
    <Card className="border-gray-200">
      <CardHeader>
        <CardTitle className="text-gray-900">BRS Document (optional)</CardTitle>
        <CardDescription className="text-gray-600">
          {brsMode === "upload"
            ? `Upload a Business Requirements Specification to pre-fill the test name${supportsUrls ? ", any referenced URLs," : ""} and the requirement fields used in the generated report. Scanned/image-only PDFs are read with OCR automatically.`
            : "Enter the relevant BRS details yourself — useful when the document is a scanned image OCR can't read cleanly, or when there's no document at all."}
        </CardDescription>
        <div className="mt-3 flex gap-2">
          <Button
            type="button" size="sm"
            variant={brsMode === "upload" ? "default" : "outline"}
            className={brsMode === "upload" ? "" : "border-gray-300 bg-transparent"}
            onClick={() => setBrsMode("upload")}
            disabled={disabled}
          >
            Upload document
          </Button>
          <Button
            type="button" size="sm"
            variant={brsMode === "manual" ? "default" : "outline"}
            className={brsMode === "manual" ? "" : "border-gray-300 bg-transparent"}
            onClick={() => setBrsMode("manual")}
            disabled={disabled}
          >
            Enter manually
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {brsMode === "upload" ? (
          <label>
            <input
              type="file"
              accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              onChange={handleBrsUpload}
              className="hidden"
              disabled={brsUploading || disabled}
            />
            <Button variant="outline" className="border-gray-300 bg-transparent" asChild disabled={brsUploading || disabled}>
              <span>
                {brsUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                {brsUploading ? "Reading document…" : "Upload BRS (.pdf, .docx, or .txt)"}
              </span>
            </Button>
          </label>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="brs-title" className="text-gray-700">Title of system</Label>
                <Input
                  id="brs-title"
                  placeholder="e.g. Property Rates and Taxes Payment System"
                  value={brsManual.title}
                  onChange={(e) => setBrsManual((prev) => ({ ...prev, title: e.target.value }))}
                  className="border-gray-300"
                  disabled={disabled}
                />
              </div>
              <div>
                <Label htmlFor="brs-requested-by" className="text-gray-700">Requested by</Label>
                <Input
                  id="brs-requested-by"
                  placeholder="e.g. Department of Infrastructure Development"
                  value={brsManual.requestedBy}
                  onChange={(e) => setBrsManual((prev) => ({ ...prev, requestedBy: e.target.value }))}
                  className="border-gray-300"
                  disabled={disabled}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="brs-purpose" className="text-gray-700">Purpose / Reason</Label>
              <Textarea
                id="brs-purpose"
                placeholder="Why this system or change is needed"
                value={brsManual.purpose}
                onChange={(e) => setBrsManual((prev) => ({ ...prev, purpose: e.target.value }))}
                className="border-gray-300"
                disabled={disabled}
              />
            </div>
            <div>
              <Label htmlFor="brs-root-cause" className="text-gray-700">Root cause</Label>
              <Textarea
                id="brs-root-cause"
                placeholder="What problem this addresses"
                value={brsManual.rootCause}
                onChange={(e) => setBrsManual((prev) => ({ ...prev, rootCause: e.target.value }))}
                className="border-gray-300"
                disabled={disabled}
              />
            </div>
            <div>
              <Label htmlFor="brs-current-process" className="text-gray-700">Current process</Label>
              <Textarea
                id="brs-current-process"
                placeholder="How this is handled today"
                value={brsManual.currentProcess}
                onChange={(e) => setBrsManual((prev) => ({ ...prev, currentProcess: e.target.value }))}
                className="border-gray-300"
                disabled={disabled}
              />
            </div>
            <div>
              <Label htmlFor="brs-requirement-description" className="text-gray-700">Requirement description</Label>
              <Textarea
                id="brs-requirement-description"
                placeholder="What the system should do"
                value={brsManual.requirementDescription}
                onChange={(e) => setBrsManual((prev) => ({ ...prev, requirementDescription: e.target.value }))}
                className="border-gray-300"
                disabled={disabled}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="brs-target-outcome" className="text-gray-700">Target outcome</Label>
                <Textarea
                  id="brs-target-outcome"
                  placeholder="What success looks like"
                  value={brsManual.targetOutcome}
                  onChange={(e) => setBrsManual((prev) => ({ ...prev, targetOutcome: e.target.value }))}
                  className="border-gray-300"
                  disabled={disabled}
                />
              </div>
              <div>
                <Label htmlFor="brs-priority" className="text-gray-700">Priority level</Label>
                <Select
                  value={brsManual.priority}
                  onValueChange={(value) => setBrsManual((prev) => ({ ...prev, priority: value }))}
                  disabled={disabled}
                >
                  <SelectTrigger id="brs-priority" className="border-gray-300">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Low">Low</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button type="button" variant="outline" className="border-gray-300 bg-transparent" onClick={applyBrsManual} disabled={disabled}>
              <Pencil className="mr-2 h-4 w-4" />
              Use these details
            </Button>
          </div>
        )}
        {brsError && <p className="text-sm text-red-600">{brsError}</p>}
        {brsSummary && (
          <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm">
            <p className="font-medium text-blue-800">Captured from {brsSummary.source}</p>
            <ul className="mt-1 list-inside list-disc space-y-0.5 text-blue-700">
              {brsSummary.lines.map((line, i) => <li key={i}>{line}</li>)}
            </ul>
            <p className="mt-1 text-xs text-blue-600">
              These fields will be included in the generated report. Review them before starting the test.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
