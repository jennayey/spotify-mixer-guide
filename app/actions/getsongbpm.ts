"use server";

/**
 * Enrichment from GetSong.co (search → song detail).
 * BPM from `tempo`, key from `key_of`, time signature from `time_sig`.
 */
export type TrackFeatures = {
  bpm: number | null;
  keyOf: string | number | null;
  timeSig: string | number | null;
  /** When present, used for Camelot column */
  key?: number;
  mode?: 0 | 1;
};

function getApiKey(): string {
  const apiKey = process.env.GETSONGBPM_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing GETSONGBPM_API_KEY. Set it in .env.local and restart the dev server."
    );
  }
  return apiKey;
}

function firstRecordFromSearch(json: unknown): Record<string, unknown> | undefined {
  if (Array.isArray(json) && json[0] && typeof json[0] === "object") {
    return json[0] as Record<string, unknown>;
  }
  if (typeof json !== "object" || json === null) return undefined;
  const o = json as Record<string, unknown>;
  const arr = o.search ?? o.data ?? o.results ?? o.items;
  if (!Array.isArray(arr) || arr.length === 0) return undefined;
  const first = arr[0];
  if (first && typeof first === "object") return first as Record<string, unknown>;
  return undefined;
}

function extractSongId(rec: Record<string, unknown>): string | undefined {
  const id = rec.id ?? rec.song_id ?? rec.songId;
  if (typeof id === "string" || typeof id === "number") return String(id);
  return undefined;
}

function parseDetail(json: unknown): Partial<TrackFeatures> & {
  tempo?: unknown;
  key_of?: unknown;
  time_sig?: unknown;
  mode?: unknown;
} {
  let root: Record<string, unknown> | undefined;
  if (typeof json === "object" && json !== null) {
    const o = json as Record<string, unknown>;
    root = (o.song ?? o.data ?? o) as Record<string, unknown>;
  }
  if (!root) return {};

  const tempo = root.tempo ?? root.bpm;
  const keyOf = root.key_of ?? root.key;
  const timeSig = root.time_sig ?? root.timeSig;
  const modeRaw = root.mode ?? root.key_mode;

  const bpm =
    tempo !== undefined && tempo !== null && Number.isFinite(Number(tempo))
      ? Number(tempo)
      : null;

  const keyOfVal =
    keyOf === undefined || keyOf === null
      ? null
      : typeof keyOf === "number" || typeof keyOf === "string"
        ? keyOf
        : String(keyOf);

  let timeSigVal: string | number | null = null;
  if (timeSig !== undefined && timeSig !== null) {
    timeSigVal =
      typeof timeSig === "number" || typeof timeSig === "string"
        ? timeSig
        : String(timeSig);
  }

  let key: number | undefined;
  let mode: 0 | 1 | undefined;
  if (typeof keyOf === "number" && Number.isInteger(keyOf) && keyOf >= 0 && keyOf <= 11) {
    key = keyOf;
  } else if (typeof keyOf === "string" && /^\d+$/.test(keyOf)) {
    const n = Number(keyOf);
    if (n >= 0 && n <= 11) key = n;
  }
  if (modeRaw === 0 || modeRaw === 1) mode = modeRaw;
  else if (typeof modeRaw === "number") mode = modeRaw >= 1 ? 1 : 0;
  else if (typeof modeRaw === "string") {
    const s = modeRaw.toLowerCase();
    if (s.includes("major") || s === "1") mode = 1;
    else if (s.includes("minor") || s === "0") mode = 0;
  }

  return {
    bpm: bpm && bpm > 0 ? bpm : null,
    keyOf: keyOfVal,
    timeSig: timeSigVal,
    key,
    mode,
  };
}

/** Use when search/detail fails or returns nothing (client shows "N/A"). */
export const EMPTY_TRACK_FEATURES: TrackFeatures = {
  bpm: null,
  keyOf: null,
  timeSig: null,
};

/**
 * Two-step GetSong.co lookup:
 * 1) Search: type=song, lookup + artist
 * 2) Song detail by id (tempo, key_of, time_sig)
 */
export async function fetchTrackFeatures(
  title: string,
  artist: string
): Promise<TrackFeatures> {
  const apiKey = getApiKey();

  const searchUrl = new URL("https://api.getsong.co/search/");
  searchUrl.searchParams.set("api_key", apiKey);
  searchUrl.searchParams.set("type", "song");
  searchUrl.searchParams.set("lookup", title);
  searchUrl.searchParams.set("artist", artist);

  const searchRes = await fetch(searchUrl.toString(), {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!searchRes.ok) {
    return EMPTY_TRACK_FEATURES;
  }

  const searchJson: unknown = await searchRes.json();
  const first = firstRecordFromSearch(searchJson);
  if (!first) return EMPTY_TRACK_FEATURES;

  const songId = extractSongId(first);
  if (!songId) return EMPTY_TRACK_FEATURES;

  const songUrl = new URL("https://api.getsong.co/song/");
  songUrl.searchParams.set("api_key", apiKey);
  songUrl.searchParams.set("id", songId);

  const songRes = await fetch(songUrl.toString(), {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!songRes.ok) {
    return EMPTY_TRACK_FEATURES;
  }

  const songJson: unknown = await songRes.json();
  const parsed = parseDetail(songJson);

  return {
    bpm: parsed.bpm ?? null,
    keyOf: parsed.keyOf ?? null,
    timeSig: parsed.timeSig ?? null,
    key: parsed.key,
    mode: parsed.mode,
  };
}
