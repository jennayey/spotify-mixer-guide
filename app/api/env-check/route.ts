import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    SPOTIFY_CLIENT_ID_present: Boolean(process.env.SPOTIFY_CLIENT_ID),
    SPOTIFY_CLIENT_SECRET_present: Boolean(process.env.SPOTIFY_CLIENT_SECRET),
    NEXTAUTH_SECRET_present: Boolean(process.env.NEXTAUTH_SECRET),
  });
}

