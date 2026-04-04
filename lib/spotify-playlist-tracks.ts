export type SpotifyPlaylistTrack = {
  spotifyId: string;
  trackName: string;
  artistName: string;
  albumArtUrl?: string;
};

function pickSmallestAlbumArt(images?: { url: string }[]) {
  if (!images || images.length === 0) return undefined;
  return images[2]?.url ?? images[1]?.url ?? images[0]?.url;
}

/**
 * Fetch playlist tracks from Spotify Web API (server-side only — pass OAuth access token).
 */
export async function loadPlaylistTracksFromSpotify(
  playlistId: string,
  accessToken: string
): Promise<SpotifyPlaylistTrack[]> {
  const tracksLimit = 100;

  try {
    const res = await fetch(
      `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=${tracksLimit}&fields=items(track(id,name,artists(name),album(images)))`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      }
    );

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[Spotify API] Request failed (${res.status}):`, body);
      throw new Error(`Spotify tracks fetch failed (${res.status}): ${body.slice(0, 500)}`);
    }

    const json: unknown = await res.json();

    if (typeof json !== "object" || json === null) return [];

    const obj = json as Record<string, unknown>;
    const items = obj.items;
    if (!Array.isArray(items)) return [];

    const tracks: SpotifyPlaylistTrack[] = [];

    for (const it of items) {
      if (!it || typeof it !== "object") continue;
      const itObj = it as Record<string, unknown>;
      const track = itObj.track;
      if (!track || typeof track !== "object") continue;

      const trackObj = track as Record<string, unknown>;
      const id = trackObj.id;
      const name = trackObj.name;
      if (typeof id !== "string" || typeof name !== "string") continue;

      const artistsRaw = trackObj.artists;
      const artistsArr = Array.isArray(artistsRaw) ? artistsRaw : [];
      const artistNames = artistsArr
        .map((a) =>
          a && typeof a === "object" ? (a as Record<string, unknown>).name : undefined
        )
        .filter((n): n is string => typeof n === "string");

      const album = trackObj.album;
      const albumObj =
        album && typeof album === "object" ? (album as Record<string, unknown>) : undefined;
      const imagesRaw = albumObj?.images;
      const imagesArr = Array.isArray(imagesRaw) ? imagesRaw : [];

      const images = imagesArr
        .map((img) =>
          img && typeof img === "object"
            ? (img as Record<string, unknown>).url
            : undefined
        )
        .filter((u): u is string => typeof u === "string")
        .map((url) => ({ url }));

      tracks.push({
        spotifyId: id,
        trackName: name,
        artistName: artistNames.join(", "),
        albumArtUrl: pickSmallestAlbumArt(images),
      });
    }

    return tracks;
  } catch (error: any) {
    console.error("[Spotify Action Error]:", {
      message: error.message,
      stack: error.stack,
    });
    throw error;
  }
}
