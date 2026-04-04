"use server";

import {
  loadPlaylistTracksFromSpotify,
  type SpotifyPlaylistTrack,
} from "@/lib/spotify-playlist-tracks";

export type { SpotifyPlaylistTrack };

/**
 * Server-side Spotify fetch using the NextAuth access token.
 * Prefer calling `GET /api/spotify/playlists/[playlistId]/tracks` from the client
 * so errors surface as JSON instead of opaque Server Action failures.
 */
export async function fetchPlaylistTracks(
  playlistId: string,
  accessToken: string
): Promise<SpotifyPlaylistTrack[]> {
  return loadPlaylistTracksFromSpotify(playlistId, accessToken);
}
