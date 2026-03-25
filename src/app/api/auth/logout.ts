import { auth } from "~/lib/auth";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("better-auth.session_token");

    if (sessionToken) {
      await auth.api.signOut({
        headers: {
          cookie: `better-auth.session_token=${sessionToken.value}`,
        },
      });
    }

    // Clear cookies
    const response = NextResponse.json({ success: true });
    response.cookies.delete("better-auth.session_token");
    
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: "Logout failed" },
      { status: 500 }
    );
  }
}