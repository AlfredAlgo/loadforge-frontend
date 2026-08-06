"use client";

import type React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { Upload, Play, Loader2 } from "lucide-react";
import { api } from "~/trpc/react";

type Mode = "functional" | "load";

export function ScenarioConfiguration() {
  const router = useRouter();
  const [testName, setTestName] = useState("");
  const [mode, setMode] = useState<Mode>("functional");
  const [users, setUsers] = useState("5");
  const [rampup, setRampup] = useState("5");
  const [duration, setDuration] = useState("60");

  const [fileId, setFileId] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = api.test.startScenario.useMutation({
    onSuccess() {
      setError(null);
      router.push("/live");
    },
    onError(err) {
      setError(err.message || "Failed to start scenario");
    },
  });

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const lower = file.name.toLowerCase();
    const accepted = [".jmx", ".yaml", ".yml"];
    if (!accepted.some((ext) => lower.endsWith(ext))) {
      setError(
        "Please upload a .jmx (JMeter), .yaml, or .yml (Taurus / BlazeMeter) scenario file.",
      );
      e.target.value = "";
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/scenario/upload", {
        method: "POST",
        body: form,
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || "Upload failed");
        if (Array.isArray(body.elements) && body.elements.length > 0) {
          setError(
            `Scenario rejected — contains script-execution elements: ${body.elements.join(", ")}`,
          );
        }
        setFileId(null);
        setFilename(null);
        setFileSize(null);
        return;
      }
      setFileId(body.file_id);
      setFilename(body.filename ?? file.name);
      setFileSize(body.size_bytes ?? file.size);
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "Upload error");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleStart = () => {
    if (!testName.trim()) {
      setError("Please provide a name for the scenario.");
      return;
    }
    if (!fileId) {
      setError("Please upload a scenario file first.");
      return;
    }

    if (mode === "load") {
      const u = Number.parseInt(users);
      const r = Number.parseInt(rampup);
      const d = Number.parseInt(duration);
      if ([u, r, d].some((n) => Number.isNaN(n))) {
        setError("Users, ramp-up, and duration must be numbers.");
        return;
      }
      if (u <= 0 || d <= 0) {
        setError("Users and duration must be greater than 0.");
        return;
      }

      setError(null);
      start.mutate({
        name: testName,
        file_id: fileId,
        jmx_filename: filename ?? undefined,
        mode,
        users: u,
        rampup: r,
        duration: d,
      });
      return;
    }

    setError(null);
    start.mutate({
      name: testName,
      file_id: fileId,
      jmx_filename: filename ?? undefined,
      mode,
    });
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Scenario Test</h1>
        <p className="mt-1 text-sm text-gray-600">
          Upload a recorded scenario — JMeter <code>.jmx</code> or Taurus / BlazeMeter <code>.yaml</code> — and run it as a functional test or a load test.
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Scenario file</CardTitle>
          <CardDescription>
            Record your user flow with the BlazeMeter Chrome extension or JMeter's HTTP(S) Test Script Recorder, then upload either the exported <code>.jmx</code> or <code>.yaml</code>. Selenium-only YAML blocks are stripped automatically (we don't run browsers server-side).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="scenario-name">Test name</Label>
            <Input
              id="scenario-name"
              value={testName}
              onChange={(e) => setTestName(e.target.value)}
              placeholder="e.g. checkout flow smoke"
            />
          </div>

          <div>
            <Label htmlFor="jmx-file">Scenario file (.jmx, .yaml, or .yml)</Label>
            <div className="mt-1 flex items-center gap-3">
              <Input
                id="jmx-file"
                type="file"
                accept=".jmx,.yaml,.yml,application/xml,application/x-yaml,text/yaml"
                onChange={handleFile}
                disabled={uploading}
              />
              {uploading && <Loader2 className="h-4 w-4 animate-spin text-gray-500" />}
            </div>
            {filename && fileId && !uploading && (
              <p className="mt-2 text-xs text-gray-600">
                <Upload className="mr-1 inline h-3 w-3" />
                {filename}
                {fileSize !== null ? ` · ${(fileSize / 1024).toFixed(1)} KB` : ""} ·
                <span className="ml-1 font-mono text-gray-400">{fileId}</span>
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Mode</CardTitle>
          <CardDescription>
            Functional mode runs the scenario once with a single virtual user. Load mode replays it concurrently.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button
              type="button"
              variant={mode === "functional" ? "default" : "outline"}
              onClick={() => setMode("functional")}
            >
              Functional
            </Button>
            <Button
              type="button"
              variant={mode === "load" ? "default" : "outline"}
              onClick={() => setMode("load")}
            >
              Load
            </Button>
          </div>

          {mode === "load" && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="users">Virtual users</Label>
                <Input
                  id="users"
                  type="number"
                  min={1}
                  value={users}
                  onChange={(e) => setUsers(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="rampup">Ramp-up (s)</Label>
                <Input
                  id="rampup"
                  type="number"
                  min={0}
                  value={rampup}
                  onChange={(e) => setRampup(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="duration">Duration (s)</Label>
                <Input
                  id="duration"
                  type="number"
                  min={1}
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <Button
        onClick={handleStart}
        disabled={start.isPending || uploading || !fileId}
        className="w-full sm:w-auto"
      >
        {start.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Starting…
          </>
        ) : (
          <>
            <Play className="mr-2 h-4 w-4" />
            Start scenario
          </>
        )}
      </Button>
    </main>
  );
}
