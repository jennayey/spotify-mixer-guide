"use server";

export type TrackFeatures = {
  bpm: number;
  key: number; // 0-11
  mode: 0 | 1; // 0 minor, 1 major
};

function clampInt(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return undefined;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

function parseMode(raw: unknown): 0 | 1 | undefined {
  if (raw === 0 || raw === 1) return raw;
  if (typeof raw === "number") return raw >= 1 ? 1 : 0;
  if (typeof raw === "string") {
    if (raw === "1" || raw.toLowerCase().includes("major")) return 1;
    if (raw === "0" || raw.toLowerCase().includes("minor")) return 0;
  }
  return undefined;
}

/**
 * Call GetSongBPM and return BPM + standard key/mode integers.
 *
 * Uses GETSONGBPM_API_KEY from environment.
 */
export async function fetchTrackFeatures(
  title: string,
  artist: string
): Promise<TrackFeatures> {
  const apiKey = process.env.GETSONGBPM_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing GETSONGBPM_API_KEY in environment. Set it in .env.local and restart `npm run dev`."
    );
  }

  // GetSongBPM search works best with a simple "Artist Title" or "Artist - Title" string.
  const lookup = `${artist} ${title}`;
  const url = `https://api.getsongbpm.com/search/?type=both&lookup=${encodeURIComponent(
    lookup
  )}&limit=1&api_key=${encodeURIComponent(apiKey)}`;

  console.log(`[GetSongBPM] Searching for: "${lookup}"`);

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "X-API-KEY": apiKey,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[GetSongBPM] API Error (${res.status}):`, body);
    throw new Error(`GetSongBPM failed (${res.status})`);
  }

  const json: any = await res.json();

  // The GetSongBPM search API typically returns: { search: [ { id, song_title, artist: { name }, tempo, key_of, ... } ] }
  // or sometimes { data: [...] } or { results: [...] }
  const record = json?.search?.[0] || json?.data?.[0] || json?.results?.[0] || (Array.isArray(json) ? json[0] : undefined);

  if (!record) {
    console.warn(`[GetSongBPM] No results found for: "${lookup}"`);
    throw new Error(`No results found for "${title}" by "${artist}"`);
  }

  const bpmRaw = record.tempo || record.bpm;
  const keyRaw = record.key_of || record.key;
  const modeRaw = record.mode || record.key_mode;

  const bpm = Number(bpmRaw);
  const key = clampInt(Number(keyRaw), 0, 11);
  const mode = parseMode(modeRaw);

  if (!Number.isFinite(bpm) || bpm <= 0 || key === undefined || mode === undefined) {
    console.error(`[GetSongBPM] Invalid data for "${lookup}":`, { bpmRaw, keyRaw, modeRaw });
    throw new Error(
      `GetSongBPM returned incomplete data for "${title}" - "${artist}"`
    );
  }

  console.log(`[GetSongBPM] Found: ${bpm} BPM, Key: ${key}, Mode: ${mode}`);
  return { bpm, key, mode };
}

