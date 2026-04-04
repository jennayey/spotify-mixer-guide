import "dotenv/config";
import { fetchPlaylistTracks } from "../app/actions/spotify.js";
import { getCamelotKey } from "../lib/camelot.js";

/**
 * This script harmonizes a Spotify playlist by fetching BPM and Key data
 * from the GetSongKey API and outputting a formatted table.
 */

const API_KEY = process.env.GETSONGBPM_API_KEY || process.env.GETSONGKEY_API_KEY;
const PLAYLIST_ID = process.argv[2];
const SPOTIFY_TOKEN = process.env.SPOTIFY_ACCESS_TOKEN;

if (!API_KEY) {
  console.error("❌ Error: GETSONGBPM_API_KEY or GETSONGKEY_API_KEY is missing in .env.local");
  process.exit(1);
}

if (!PLAYLIST_ID) {
  console.error("❌ Error: Please provide a Spotify Playlist ID as an argument.");
  console.log("Usage: npx tsx scripts/harmonize.ts <playlist_id>");
  process.exit(1);
}

if (!SPOTIFY_TOKEN) {
  console.error("❌ Error: SPOTIFY_ACCESS_TOKEN is missing. Please provide a valid token.");
  process.exit(1);
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchGetSongKeyData(title: string, artist: string) {
  // Requirement: GET https://api.getsong.co/search/?api_key=YOUR_API_KEY&type=both&lookup=song:{title} artist:{artist}
  const lookup = `song:${title} artist:${artist}`;
  const url = `https://api.getsong.co/search/?api_key=${encodeURIComponent(
    API_KEY!
  )}&type=both&lookup=${encodeURIComponent(lookup)}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;

    const json: any = await res.json();
    const record = json?.search?.[0] || json?.data?.[0] || (Array.isArray(json) ? json[0] : null);

    if (!record) return null;

    return {
      bpm: Number(record.tempo || record.bpm),
      key: Number(record.key_of || record.key),
      mode: record.mode === "1" || record.mode === 1 || String(record.mode).toLowerCase().includes("major") ? 1 : 0,
    };
  } catch (error) {
    return null;
  }
}

async function main() {
  console.log(`\n🎵 Fetching tracks for playlist: ${PLAYLIST_ID}...\n`);

  try {
    const tracks = await fetchPlaylistTracks(PLAYLIST_ID, SPOTIFY_TOKEN!);
    console.log(`✅ Found ${tracks.length} tracks. Starting harmonization...\n`);

    const results = [];

    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      process.stdout.write(`⏳ [${i + 1}/${tracks.length}] Processing: ${track.trackName} - ${track.artistName}... `);

      const data = await fetchGetSongKeyData(track.trackName, track.artistName);

      if (data) {
        const camelot = getCamelotKey(data.key, data.mode as 0 | 1);
        results.push({
          Artist: track.artistName.substring(0, 25),
          Title: track.trackName.substring(0, 30),
          BPM: data.bpm || "N/A",
          Key: camelot || "N/A",
        });
        console.log(`✅ ${data.bpm} BPM | ${camelot}`);
      } else {
        results.push({
          Artist: track.artistName.substring(0, 25),
          Title: track.trackName.substring(0, 30),
          BPM: "N/A",
          Key: "N/A",
        });
        console.log(`❌ Not found`);
      }

      // Requirement: Rate limiting (slight delay)
      // 3000 requests/hour is ~1 request every 1.2 seconds. We'll use 500ms for safety and speed.
      await sleep(500);
    }

    console.log("\n📊 HARMONIZED PLAYLIST DATA:\n");
    console.table(results);
    
    // Also output as JSON for convenience
    // console.log(JSON.stringify(results, null, 2));

  } catch (error) {
    console.error("\n❌ Fatal Error:", error instanceof Error ? error.message : error);
  }
}

main();
