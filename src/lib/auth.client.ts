import { createAuthClient } from "better-auth/react"


export const authClient = createAuthClient({
    /** The base URL of the server (optional if you're using the same domain) */
    // baseURL: env.NEXT_PUBLIC_BETTER_AUTH_CALLBACK
})

export type Session = typeof authClient.$Infer.Session