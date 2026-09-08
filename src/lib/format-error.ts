// Friendly labels for tRPC error codes so the UI can show *what kind* of
// error happened, not just a generic message. Applies to both the load-test
// and functional-test (scenario) flows, which share the same tRPC router.
const TRPC_ERROR_LABELS: Record<string, string> = {
  INTERNAL_SERVER_ERROR: "Server error",
  BAD_REQUEST: "Invalid input",
  UNAUTHORIZED: "Authentication error",
  FORBIDDEN: "Permission error",
  NOT_FOUND: "Not found",
  TIMEOUT: "Timeout",
  CONFLICT: "Conflict",
  TOO_MANY_REQUESTS: "Rate limited",
  PARSE_ERROR: "Invalid input",
  CLIENT_CLOSED_REQUEST: "Connection closed",
};

interface TRPCLikeError {
  message?: string;
  data?: { code?: string | null } | null;
}

/**
 * Prefixes a tRPC error's message with a human-readable category derived
 * from its error code, e.g. "Server error: Failed to start test...".
 * Falls back to the raw message (or a generic label) when there's no code.
 */
export function formatTRPCError(err: TRPCLikeError | null | undefined): string {
  const message = err?.message || "An unknown error occurred";
  const code = err?.data?.code;
  const label = code ? (TRPC_ERROR_LABELS[code] ?? code) : null;
  return label ? `${label}: ${message}` : message;
}

/**
 * Classifies an error reported over the socket/eventbus (backend-originated
 * test/scenario failures), which arrive as free-form { error | reason }
 * strings rather than typed tRPC codes.
 */
export function classifyBackendError(message: string | null | undefined): string {
  const text = (message || "").toLowerCase();
  if (!text) return "Backend error: An unknown error occurred";
  if (text.includes("timeout") || text.includes("timed out")) {
    return `Timeout: ${message}`;
  }
  if (text.includes("connect") || text.includes("econnrefused") || text.includes("enotfound")) {
    return `Connection error: ${message}`;
  }
  if (text.includes("dns")) {
    return `DNS error: ${message}`;
  }
  return `Backend error: ${message}`;
}
