// src/trpc/react.tsx
"use client";

import React, { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTRPCReact } from "@trpc/react-query";
import {
  loggerLink,
  splitLink,
  httpBatchLink,
  wsLink,
  createWSClient,
} from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "~/server/api/root";

export const api = createTRPCReact<AppRouter>();

const createQueryClient = () => new QueryClient();

let clientQueryClientSingleton: QueryClient | undefined = undefined;
const getQueryClient = () => {
  if (typeof window === "undefined") {
    return createQueryClient();
  }
  return (clientQueryClientSingleton ??= createQueryClient());
};

function getBaseUrl() {
  if (typeof window !== "undefined") return window.location.origin;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

function getWSUrl() {
  if (typeof window === "undefined") return ""; // No WS on server

  // For combined server (Option 1)
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/api/trpc-ws`;

  // For separate server (Option 2) - uncomment this instead:
  // return process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001"
}

export function TRPCReactProvider(props: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  const [trpcClient] = useState(() => {
    // Only create WebSocket client in browser
    const wsClient =
      typeof window !== "undefined"
        ? createWSClient({ url: getWSUrl() })
        : null;

    return api.createClient({
      links: [
        loggerLink({
          enabled: (op) =>
            process.env.NODE_ENV === "development" ||
            (op.direction === "down" && op.result instanceof Error),
        }),
        splitLink({
          condition(op) {
            return op.type === "subscription";
          },
          true: wsClient
            ? wsLink({ client: wsClient, transformer: superjson })
            : httpBatchLink({
                url: getBaseUrl() + "/api/trpc",
                transformer: superjson,
              }),
          false: httpBatchLink({
            url: getBaseUrl() + "/api/trpc",
            transformer: superjson,
            headers: () => {
              const headers = new Headers();
              headers.set("x-trpc-source", "nextjs-react");
              return headers;
            },
            fetch(url, options) {
              return fetch(url, {
                ...options,
                credentials: "include",
              });
            },
          }),
        }),
      ],
    });
  });

  return (
    <QueryClientProvider client={queryClient}>
      <api.Provider client={trpcClient} queryClient={queryClient}>
        {props.children}
      </api.Provider>
    </QueryClientProvider>
  );
}
