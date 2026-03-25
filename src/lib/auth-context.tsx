"use client"

import React, { createContext, useContext } from "react"
import { useRouter } from "next/navigation"
import { authClient } from "./auth.client"

interface AuthContextType {
  signIn: typeof authClient.signIn.email
  signUp: typeof authClient.signUp.email
  signOut: typeof authClient.signOut
  useSession: typeof authClient.useSession
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <AuthContext.Provider
      value={{
        signIn: authClient.signIn.email,
        signUp: authClient.signUp.email,
        signOut: authClient.signOut,
        useSession: authClient.useSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}