"use client";

import type React from "react";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { TestProgress, TestEvent } from "~/hooks/useLiveTestTracking";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Plus, X, Upload, Download, Play, Loader2, Pencil } from "lucide-react";
import { api } from "~/trpc/react";
import { formatTRPCError } from "~/lib/format-error";

const BRS_FIELD_LABELS: Record<string, string> = {
  title: "Title of system",
  requestedBy: "Requested by",
  purpose: "Purpose / Reason",
  rootCause: "Root cause",
  currentProcess: "Current process",
  requirementDescription: "Requirement description",
  targetOutcome: "Target outcome",
  priority: "Priority level",
};

export function TestConfiguration() {
  const [urls, setUrls] = useState([{ id: 1, url: "" }]);
  const [concurrency, setConcurrency] = useState("10,20,30");
  const [rampDuration, setRampDuration] = useState("60");
  const [holdDuration, setHoldDuration] = useState("120");
  const [isConnected, setIsConnected] = useState(false);
  const [testName, setTestName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [brsMode, setBrsMode] = useState<"upload" | "manual">("upload");
  const [brsUploading, setBrsUploading] = useState(false);
  const [brsSummary, setBrsSummary] = useState<{ source: string; lines: string[] } | null>(null);
  const [brsManual, setBrsManual] = useState({
    title: "",
    requestedBy: "",
    purpose: "",
    rootCause: "",
    currentProcess: "",
    requirementDescription: "",
    targetOutcome: "",
    priority: "",
  });

  const router = useRouter();

  api.test.onProgress.useSubscription(undefined, {
    onStarted() {
      console.log("🔌 [CLIENT] Subscription started");
      setIsConnected(true);
    },
    onData(trackedData) {
      // We only care about connection status here
      setIsConnected(true);
    },
    onError(err) {
      console.error("❌ [CLIENT] Subscription error:", err);
      setIsConnected(false);
      setError(formatTRPCError(err));
    },
  });

  const start = api.test.startTest.useMutation({
    onSuccess() {
      setError(null);
      router.push("/live"); // Navigate to live tracking page on test start
    },
    onError(err) {
      setError(formatTRPCError(err));
    },
  });

  const { data: savedEnvironments } = api.environments.list.useQuery();
  // Headers from the most recently picked saved environment. The engine
  // applies one flat header set to every request in a run, so picking a
  // second environment replaces rather than merges with the first.
  const [activeEnvironment, setActiveEnvironment] = useState<{
    name: string;
    headers: Record<string, string>;
  } | null>(null);

  const addUrl = () => {
    setUrls([...urls, { id: Date.now(), url: "" }]);
  };

  const addUrlFromEnvironment = (baseUrl: string) => {
    // Fill the first still-empty URL field if there is one, otherwise
    // append a new one — avoids leaving a stray blank row when the form
    // is untouched.
    setUrls((prev) => {
      const emptyIndex = prev.findIndex((u) => !u.url.trim());
      if (emptyIndex !== -1) {
        return prev.map((u, i) => (i === emptyIndex ? { ...u, url: baseUrl } : u));
      }
      return [...prev, { id: Date.now(), url: baseUrl }];
    });
  };

  const removeUrl = (id: number) => {
    setUrls(urls.filter((u) => u.id !== id));
  };

  const updateUrl = (id: number, value: string) => {
    setUrls(urls.map((u) => (u.id === id ? { ...u, url: value } : u)));
  };

  const handleStartTest = () => {
    const validUrls = urls.map((u) => u.url).filter((u) => u.trim());
    if (validUrls.length === 0) {
      setError("Please add at least one URL");
      return;
    }
     if (!testName.trim()) {
      setError("Please provide a name for the test.");
      return;
    }
    const concurrencyArray = concurrency
      .split(",")
      .map((c) => Number.parseInt(c.trim()))
      .filter((c) => !isNaN(c) && c > 0);

    if (concurrencyArray.length === 0) {
      setError("please provide at least one concurrency level");
      return;
    }
    const rampDurationNum = Number.parseInt(rampDuration);
    const holdDurationNum = Number.parseFloat(holdDuration);

    if (Number.isNaN(rampDurationNum) || Number.isNaN(holdDurationNum)) {
      setError("please provide valid duration values");
      return;
    }
    if (rampDurationNum <= 0 || holdDurationNum <= 0) {
      setError("duration values must be greater than 0");
      return;
    }

    setError(null);

    const totalDuration = rampDurationNum + holdDurationNum + rampDurationNum;

    start.mutate({
      name: testName,
      urls: validUrls,
      concurrency: concurrencyArray,
      ramp_up_time: rampDurationNum,
      ramp_down_time: holdDurationNum,
      total_duration: totalDuration,
      phase_length: rampDurationNum,
      hold_duration: holdDurationNum,
      headers:
        activeEnvironment && Object.keys(activeEnvironment.headers).length > 0
          ? activeEnvironment.headers
          : undefined,
    });
  };

  const handleBrsUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".pdf") && !lower.endsWith(".docx") && !lower.endsWith(".txt")) {
      setError("Please upload a .pdf, .docx, or .txt BRS document.");
      e.target.value = "";
      return;
    }
    setError(null);
    setBrsSummary(null);
    setBrsUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/brs/parse", { method: "POST", body: form });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || "Failed to parse BRS document.");
        return;
      }

      const data = body as { test_name: string; urls: string[]; summary: string };

      if (data.test_name && !testName.trim()) setTestName(data.test_name);
      if (data.urls.length > 0) {
        setUrls(data.urls.map((url, i) => ({ id: Date.now() + i, url })));
      }

      setBrsSummary({ source: file.name, lines: [data.summary] });
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "Failed to parse BRS document.");
    } finally {
      setBrsUploading(false);
      e.target.value = "";
    }
  };

  const applyBrsManual = () => {
    const title = brsManual.title.trim();
    if (!title) {
      setError("Please provide at least the title of the system.");
      return;
    }
    setError(null);
    if (!testName.trim()) setTestName(title);

    const lines = Object.entries(brsManual)
      .filter(([, value]) => value.trim().length > 0)
      .map(([key, value]) => {
        const label = BRS_FIELD_LABELS[key] ?? key;
        const trimmed = value.trim();
        return `${label}: ${trimmed.length > 140 ? trimmed.slice(0, 140) + "…" : trimmed}`;
      });

    setBrsSummary({ source: "manual entry", lines });
  };

  const exportConfig = () => {
    const config = {
      name: testName,
      urls: urls.map((u) => u.url).filter((u) => u),
      concurrency: concurrency.split(",").map((c) => Number.parseInt(c.trim())),
      rampDuration: Number.parseInt(rampDuration),
      holdDuration: Number.parseInt(holdDuration),
    };
    const blob = new Blob([JSON.stringify(config, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "loadtest-config.json";
    a.click();
  };

  const importUrlsCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isCsv =
      file.type === "text/csv" || file.name.toLowerCase().endsWith(".csv");
    if (!isCsv) {
      setError("Please upload a .csv file containing URLs");
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = (event.target?.result as string) ?? "";
      const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);

      const parsed: string[] = [];
      const invalid: string[] = [];

      for (const line of lines) {
        const cells = line
          .split(",")
          .map((c) => c.trim().replace(/^"|"$/g, ""))
          .filter(Boolean);

        if (cells.length === 0) continue;
        if (cells.length > 1) {
          invalid.push(line);
          continue;
        }

        const cell = cells[0]!;
        if (parsed.length === 0 && /^(url|urls|link|links)$/i.test(cell)) {
          continue;
        }

        try {
          const u = new URL(cell);
          if (u.protocol !== "http:" && u.protocol !== "https:") {
            invalid.push(line);
            continue;
          }
          parsed.push(cell);
        } catch {
          invalid.push(line);
        }
      }

      if (invalid.length > 0) {
        const preview = invalid.slice(0, 3).join(", ");
        setError(
          `CSV must contain only URLs (one per row). Invalid: ${preview}${
            invalid.length > 3 ? `, +${invalid.length - 3} more` : ""
          }`
        );
        e.target.value = "";
        return;
      }
      if (parsed.length === 0) {
        setError("No valid URLs found in the CSV");
        e.target.value = "";
        return;
      }

      setUrls(parsed.map((url, i) => ({ id: Date.now() + i, url })));
      setError(null);
      e.target.value = "";
    };
    reader.onerror = () => setError("Failed to read CSV file");
    reader.readAsText(file);
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">New Load Test</h1>
        <p className="mt-1 text-sm text-gray-600">
          Configure and run a new performance test
        </p>
      </div>

      {/* Connection Status */}
      <div className="mb-4">
        <div
          className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm ${
            isConnected
              ? "bg-green-50 text-green-700"
              : "bg-yellow-50 text-yellow-700"
          }`}
        >
          <div
            className={`h-2 w-2 rounded-full ${
              isConnected ? "bg-green-500" : "bg-yellow-500"
            }`}
          />
          {isConnected
            ? "Connected to Testing Server"
            : "Connecting to Testing Server..."}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-6">
        <Card className="border-gray-200">
          <CardHeader>
            <CardTitle className="text-gray-900">Test Name</CardTitle>
            <CardDescription className="text-gray-600">
              Give your load test a descriptive name
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div>
              <Label htmlFor="test-name" className="text-gray-700">
                Name
              </Label>
              <Input
                id="test-name"
                placeholder="My API Performance Test"
                value={testName}
                onChange={(e) => setTestName(e.target.value)}
                className="border-gray-300"
                disabled={start.isPending}
              />
            </div>
          </CardContent>
        </Card>
        <Card className="border-gray-200">
          <CardHeader>
            <CardTitle className="text-gray-900">BRS Document (optional)</CardTitle>
            <CardDescription className="text-gray-600">
              {brsMode === "upload"
                ? "Upload a Business Requirements Specification to pre-fill the test name and any referenced URLs. Concurrency and duration aren't part of the standard BRS template, so you'll still set those yourself."
                : "Enter the relevant BRS details yourself — useful when the document is a scanned image the parser can't read."}
            </CardDescription>
            <div className="mt-3 flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={brsMode === "upload" ? "default" : "outline"}
                className={brsMode === "upload" ? "" : "border-gray-300 bg-transparent"}
                onClick={() => setBrsMode("upload")}
                disabled={start.isPending}
              >
                Upload document
              </Button>
              <Button
                type="button"
                size="sm"
                variant={brsMode === "manual" ? "default" : "outline"}
                className={brsMode === "manual" ? "" : "border-gray-300 bg-transparent"}
                onClick={() => setBrsMode("manual")}
                disabled={start.isPending}
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
                  disabled={brsUploading || start.isPending}
                />
                <Button
                  variant="outline"
                  className="border-gray-300 bg-transparent"
                  asChild
                  disabled={brsUploading || start.isPending}
                >
                  <span>
                    {brsUploading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="mr-2 h-4 w-4" />
                    )}
                    {brsUploading ? "Reading document…" : "Upload BRS (.pdf, .docx, or .txt)"}
                  </span>
                </Button>
              </label>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="brs-title" className="text-gray-700">
                      Title of system
                    </Label>
                    <Input
                      id="brs-title"
                      placeholder="e.g. Property Rates and Taxes Payment System"
                      value={brsManual.title}
                      onChange={(e) => setBrsManual((prev) => ({ ...prev, title: e.target.value }))}
                      className="border-gray-300"
                      disabled={start.isPending}
                    />
                  </div>
                  <div>
                    <Label htmlFor="brs-requested-by" className="text-gray-700">
                      Requested by
                    </Label>
                    <Input
                      id="brs-requested-by"
                      placeholder="e.g. Department of Infrastructure Development"
                      value={brsManual.requestedBy}
                      onChange={(e) => setBrsManual((prev) => ({ ...prev, requestedBy: e.target.value }))}
                      className="border-gray-300"
                      disabled={start.isPending}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="brs-purpose" className="text-gray-700">
                    Purpose / Reason
                  </Label>
                  <Textarea
                    id="brs-purpose"
                    placeholder="Why this system or change is needed"
                    value={brsManual.purpose}
                    onChange={(e) => setBrsManual((prev) => ({ ...prev, purpose: e.target.value }))}
                    className="border-gray-300"
                    disabled={start.isPending}
                  />
                </div>
                <div>
                  <Label htmlFor="brs-root-cause" className="text-gray-700">
                    Root cause
                  </Label>
                  <Textarea
                    id="brs-root-cause"
                    placeholder="What problem this addresses"
                    value={brsManual.rootCause}
                    onChange={(e) => setBrsManual((prev) => ({ ...prev, rootCause: e.target.value }))}
                    className="border-gray-300"
                    disabled={start.isPending}
                  />
                </div>
                <div>
                  <Label htmlFor="brs-current-process" className="text-gray-700">
                    Current process
                  </Label>
                  <Textarea
                    id="brs-current-process"
                    placeholder="How this is handled today"
                    value={brsManual.currentProcess}
                    onChange={(e) => setBrsManual((prev) => ({ ...prev, currentProcess: e.target.value }))}
                    className="border-gray-300"
                    disabled={start.isPending}
                  />
                </div>
                <div>
                  <Label htmlFor="brs-requirement-description" className="text-gray-700">
                    Requirement description
                  </Label>
                  <Textarea
                    id="brs-requirement-description"
                    placeholder="What the system should do"
                    value={brsManual.requirementDescription}
                    onChange={(e) =>
                      setBrsManual((prev) => ({ ...prev, requirementDescription: e.target.value }))
                    }
                    className="border-gray-300"
                    disabled={start.isPending}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="brs-target-outcome" className="text-gray-700">
                      Target outcome
                    </Label>
                    <Textarea
                      id="brs-target-outcome"
                      placeholder="What success looks like"
                      value={brsManual.targetOutcome}
                      onChange={(e) => setBrsManual((prev) => ({ ...prev, targetOutcome: e.target.value }))}
                      className="border-gray-300"
                      disabled={start.isPending}
                    />
                  </div>
                  <div>
                    <Label htmlFor="brs-priority" className="text-gray-700">
                      Priority level
                    </Label>
                    <Select
                      value={brsManual.priority}
                      onValueChange={(value) => setBrsManual((prev) => ({ ...prev, priority: value }))}
                      disabled={start.isPending}
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
                <Button
                  type="button"
                  variant="outline"
                  className="border-gray-300 bg-transparent"
                  onClick={applyBrsManual}
                  disabled={start.isPending}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Use these details
                </Button>
              </div>
            )}
            {brsSummary && (
              <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm">
                <p className="font-medium text-blue-800">Pre-filled from {brsSummary.source}</p>
                <ul className="mt-1 list-inside list-disc space-y-0.5 text-blue-700">
                  {brsSummary.lines.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
                <p className="mt-1 text-xs text-blue-600">Review the fields below before starting the test.</p>
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="border-gray-200">
          <CardHeader>
            <CardTitle className="text-gray-900">Test URLs</CardTitle>
            <CardDescription className="text-gray-600">
              Add the endpoints you want to test
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {urls.map((urlObj, index) => (
              <div key={urlObj.id} className="flex gap-2">
                <div className="flex-1">
                  <Label htmlFor={`url-${urlObj.id}`} className="text-gray-700">
                    URL {index + 1}
                  </Label>
                  <Input
                    id={`url-${urlObj.id}`}
                    placeholder="https://api.example.com/endpoint"
                    value={urlObj.url}
                    onChange={(e) => updateUrl(urlObj.id, e.target.value)}
                    className="border-gray-300"
                    disabled={start.isPending}
                  />
                </div>
                {urls.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeUrl(urlObj.id)}
                    className="mt-7 text-red-600 hover:bg-red-50 hover:text-red-700"
                    disabled={start.isPending}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            {savedEnvironments && savedEnvironments.length > 0 && (
              <div className="flex items-center gap-2">
                <Label className="shrink-0 text-xs text-gray-500">Load from saved environment</Label>
                <Select onValueChange={(v) => {
                  const env = savedEnvironments.find((e) => e.id === v);
                  if (env) {
                    addUrlFromEnvironment(env.baseUrl);
                    setActiveEnvironment({ name: env.name, headers: env.headers });
                  }
                }}>
                  <SelectTrigger className="h-8 w-56 border-gray-300 text-xs">
                    <SelectValue placeholder="Choose an environment…" />
                  </SelectTrigger>
                  <SelectContent>
                    {savedEnvironments.map((env) => (
                      <SelectItem key={env.id} value={env.id}>{env.name} — {env.baseUrl}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {activeEnvironment && Object.keys(activeEnvironment.headers).length > 0 && (
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    Headers from &ldquo;{activeEnvironment.name}&rdquo; will be sent with every request
                    <button
                      type="button"
                      onClick={() => setActiveEnvironment(null)}
                      className="text-gray-400 hover:text-gray-700"
                      aria-label="Clear environment headers"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
              </div>
            )}
            <div className="flex gap-2">
              <Button
                onClick={addUrl}
                variant="outline"
                className="border-purple-300 text-purple-700 hover:bg-purple-50 bg-transparent"
                disabled={start.isPending}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add URL
              </Button>
              <label>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={importUrlsCsv}
                  className="hidden"
                  disabled={start.isPending}
                />
                <Button
                  variant="outline"
                  className="border-gray-300 bg-transparent"
                  asChild
                  disabled={start.isPending}
                >
                  <span>
                    <Upload className="mr-2 h-4 w-4" />
                    Import CSV
                  </span>
                </Button>
              </label>
              <Button
                onClick={exportConfig}
                variant="outline"
                className="border-gray-300 bg-transparent"
                disabled={start.isPending}
              >
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-200">
          <CardHeader>
            <CardTitle className="text-gray-900">Concurrency Pattern</CardTitle>
            <CardDescription className="text-gray-600">
              Define how load will ramp up during the test
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="concurrency" className="text-gray-700">
                Concurrency Levels (comma-separated)
              </Label>
              <Input
                id="concurrency"
                placeholder="10,20,30,40"
                value={concurrency}
                onChange={(e) => setConcurrency(e.target.value)}
                className="border-gray-300"
                disabled={start.isPending}
              />
              <p className="mt-1 text-xs text-gray-600">
                Number of concurrent requests at each phase
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="ramp-duration" className="text-gray-700">
                  Ramp Duration (seconds)
                </Label>
                <Input
                  id="ramp-duration"
                  type="number"
                  value={rampDuration}
                  onChange={(e) => setRampDuration(e.target.value)}
                  className="border-gray-300"
                  disabled={start.isPending}
                />
              </div>
              <div>
                <Label htmlFor="hold-duration" className="text-gray-700">
                  Hold Duration (seconds)
                </Label>
                <Input
                  id="hold-duration"
                  type="number"
                  value={holdDuration}
                  onChange={(e) => setHoldDuration(e.target.value)}
                  className="border-gray-300"
                  disabled={start.isPending}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            className="border-gray-300 bg-transparent"
                disabled={start.isPending}
          >
            Save as Template
          </Button>
            <Button
            onClick={handleStartTest}
            className="bg-linear-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
            disabled={start.isPending}
          >
              <Play className="mr-2 h-4 w-4" />
              Run Test
          </Button>
        </div>
      </div>
    </main>
  );
}
