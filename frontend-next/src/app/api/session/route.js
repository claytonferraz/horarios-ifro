import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { token, action } = await request.json();

    const response = NextResponse.json({ success: true });

    if (action === "logout") {
      response.cookies.set({
        name: "admin_token",
        value: "",
        maxAge: -1,
        path: "/",
      });
    } else if (token) {
      // Setup the HttpOnly cookie for 24 hours
      response.cookies.set({
        name: "admin_token",
        value: token,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 60 * 60 * 24, // 24 hours
      });
    }

    return response;
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
