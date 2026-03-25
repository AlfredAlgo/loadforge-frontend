
import { auth } from "~/lib/auth"; // path to your auth file
import { toNextJsHandler } from "better-auth/next-js";

export const runtime = 'nodejs'; // Add this line
export const dynamic = 'force-dynamic'; // Add this too

export const { POST, GET } = toNextJsHandler(auth);