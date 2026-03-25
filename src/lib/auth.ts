import {betterAuth} from 'better-auth'
import { db } from '../server/db'
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import * as schema from '../server/db/schema'
import{nextCookies} from 'better-auth/next-js';
import { env } from '~/env'

export const auth = betterAuth({
//   socialProviders: {
//     google: {
//       clientId: process.env.GOOGLE_CLIENT_ID as string,
//       clientSecret: process.env.GOOGLE_CLIENT_SECRET as string
//     }
//   },
  database: drizzleAdapter(db, {
    provider: "pg",
    schema : {
        ...schema,
        user: schema.users,
        session: schema.session,
        account: schema.account,  
        verification: schema.verification
    }
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false
  },
  plugins: [nextCookies()],
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,

  
})