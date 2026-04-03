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

  // GetSongBPM docs: base URL https://api.getsongbpm.com, endpoint /search/
  // Auth can be passed via query param `api_key` or header `X-API-KEY`.
  // We'll do both for robustness.
  const lookup = `song:${title} artist:${artist}`;
  const url = `https://api.getsongbpm.com/search/?type=both&lookup=${encodeURIComponent(
    lookup
  )}&limit=1&api_key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "X-API-KEY": apiKey,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GetSongBPM failed (${res.status}): ${body}`);
  }

  const json: unknown = await res.json();

  const record = (() => {
    if (Array.isArray(json)) return json[0];
    if (typeof json === "object" && json !== null) {
      const obj = json as Record<string, unknown>;
      const arr = obj.data ?? obj.results ?? obj.items;
      if (Array.isArray(arr)) return arr[0];
    }
    return undefined;
  })();

  const rec = typeof record === "object" && record !== null
    ? (record as Record<string, unknown>)
    : undefined;

  const bpmRaw = rec?.tempo ?? rec?.bpm;
  const keyRaw = rec?.key_of ?? rec?.key;
  const modeRaw = rec?.mode ?? rec?.key_mode;

  const bpm = Number(bpmRaw);
  const key = clampInt(Number(keyRaw), 0, 11);
  const mode = parseMode(modeRaw);

  if (!Number.isFinite(bpm) || bpm <= 0 || key === undefined || mode === undefined) {
    throw new Error(
      `GetSongBPM response parse failed for "${title}" - "${artist}"`
    );
  }

  return { bpm, key, mode };
}

