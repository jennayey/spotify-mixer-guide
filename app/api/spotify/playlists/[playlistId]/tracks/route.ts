import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth-options";
import { loadPlaylistTracksFromSpotify } from "@/lib/spotify-playlist-tracks";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ playlistId: string }> }
) {
  const session = await getServerSession(authOptions);
  const headerToken = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();
  const accessToken = session?.accessToken ?? headerToken;

  if (!accessToken) {
    return NextResponse.json(
      {
        error:
          "Not signed in or Spotify access token missing. Sign out and sign in again.",
      },
      { status: 401 }
    );
  }

  const { playlistId } = await context.params;
  if (!playlistId) {
    return NextResponse.json({ error: "Missing playlist id" }, { status: 400 });
  }

  try {
    const tracks = await loadPlaylistTracksFromSpotify(playlistId, accessToken);
    return NextResponse.json({ tracks });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load playlist tracks";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
