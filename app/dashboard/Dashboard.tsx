"use client";

import React, { useEffect, useMemo, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type Column,
} from "@tanstack/react-table";
import { ArrowUpDown, Headphones, LogOut, Music2, Sparkles } from "lucide-react";
import { camelotKeyToSortIndex, keyModeToCamelot } from "@/lib/camelot";

type SpotifyPlaylist = {
  id: string;
  name: string;
  images?: { url: string }[];
};

type SpotifyArtist = { name: string };

type SpotifyImage = { url: string; width?: number; height?: number };

type SpotifyTrack = {
  id: string;
  name: string;
  artists: SpotifyArtist[];
  album?: { images?: SpotifyImage[] };
  external_ids?: { isrc?: string };
};

type PlaylistTracksResponse = {
  items: Array<{ track: SpotifyTrack | null }>;
};

type HarmonizedTrack = {
  id: string;
  albumArtUrl?: string;
  trackName: string;
  artistName: string;
  bpm: number;
  camelotKey: string;
  camelotSortIndex: number;
};

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

function pickSmallestAlbumArt(images?: SpotifyImage[]): string | undefined {
  if (!images || images.length === 0) return undefined;
  return images[2]?.url ?? images[1]?.url ?? images[0]?.url;
}

async function fetchBPMAndKey(isrc: string): Promise<{
  bpm: number;
  key: number;
  mode: 0 | 1;
}> {
  await new Promise((r) => setTimeout(r, 60));
  let hash = 0;
  for (let i = 0; i < isrc.length; i++) {
    hash = (hash * 31 + isrc.charCodeAt(i)) >>> 0;
  }
  const bpm = 90 + (hash % 71);
  const key = hash % 12;
  const mode = ((hash >> 3) % 2) as 0 | 1;
  return { bpm, key, mode };
}

function SortableHeader({
  label,
  column,
}: {
  label: string;
  column: Column<HarmonizedTrack, unknown>;
}) {
  const sortState = column.getIsSorted() as "asc" | "desc" | false;
  return (
    <button
      type="button"
      className="group inline-flex items-center gap-2 text-left font-semibold"
      onClick={column.getToggleSortingHandler()}
    >
      <span className="truncate">{label}</span>
      <ArrowUpDown
        className={[
          "h-4 w-4 transition-opacity",
          sortState ? "opacity-100" : "opacity-40 group-hover:opacity-70",
        ].join(" ")}
      />
      {sortState === "asc" ? <span className="text-xs">▲</span> : null}
      {sortState === "desc" ? <span className="text-xs">▼</span> : null}
    </button>
  );
}

export default function Dashboard() {
  const { data: session, status } = useSession();
  const accessToken = session?.accessToken;

  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);

  const {
    data: playlistsData,
    isLoading: playlistsLoading,
    isError: playlistsError,
    error: playlistsErr,
  } = useQuery({
    queryKey: ["spotifyPlaylists"],
    enabled: Boolean(accessToken),
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      if (!accessToken) throw new Error("Missing Spotify access token");
      const res = await fetch("https://api.spotify.com/v1/me/playlists?limit=50", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      return json as { items: SpotifyPlaylist[] };
    },
  });

  useEffect(() => {
    const first = playlistsData?.items?.[0]?.id;
    if (!selectedPlaylistId && first) setSelectedPlaylistId(first);
  }, [playlistsData, selectedPlaylistId]);

  const selectedPlaylist = useMemo(() => {
    if (!selectedPlaylistId || !playlistsData?.items) return null;
    return playlistsData.items.find((p) => p.id === selectedPlaylistId) ?? null;
  }, [playlistsData, selectedPlaylistId]);

  const {
    data: harmonizedTracks,
    isLoading: tracksLoading,
    isError: tracksError,
    error: tracksErr,
    isFetching: tracksFetching,
  } = useQuery({
    queryKey: ["harmonizedTracks", selectedPlaylistId],
    enabled: Boolean(accessToken && selectedPlaylistId),
    staleTime: 1000 * 60 * 10,
    queryFn: async () => {
      if (!selectedPlaylistId || !accessToken) return [];
      const tracksLimit = 50;
      const res = await fetch(
        `https://api.spotify.com/v1/playlists/${selectedPlaylistId}/tracks?limit=${tracksLimit}&fields=items(track(id,name,artists(name),album(images),external_ids))`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as PlaylistTracksResponse;
      const tracks: SpotifyTrack[] = json.items
        .map((it) => it.track)
        .filter(Boolean) as SpotifyTrack[];

      const harmonized = await Promise.all(
        tracks.map(async (t) => {
          const isrc = t.external_ids?.isrc ?? t.id;
          const { bpm, key, mode } = await fetchBPMAndKey(isrc);
          const camelotKey = keyModeToCamelot(key, mode);
          const camelotSortIndex = camelotKeyToSortIndex(camelotKey);
          return {
            id: t.id,
            albumArtUrl: pickSmallestAlbumArt(t.album?.images),
            trackName: t.name,
            artistName: (t.artists ?? []).map((a) => a.name).join(", "),
            bpm,
            camelotKey,
            camelotSortIndex,
          } satisfies HarmonizedTrack;
        })
      );

      return harmonized;
    },
  });

  const [sorting, setSorting] = useState<SortingState>([{ id: "bpm", desc: false }]);

  const columns = useMemo<ColumnDef<HarmonizedTrack>[]>(() => {
    return [
      {
        id: "albumArt",
        header: () => <span className="font-semibold">Album</span>,
        enableSorting: false,
        cell: ({ row }) => {
          const url = row.original.albumArtUrl;
          return url ? (
            <img
              src={url}
              alt={row.original.trackName}
              className="h-10 w-10 rounded border border-white/10 object-cover"
            />
          ) : (
            <div className="h-10 w-10 rounded border border-white/10 bg-white/5" />
          );
        },
      },
      {
        id: "trackName",
        header: () => <span className="font-semibold">Track</span>,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="min-w-[220px]">
            <div className="font-medium text-zinc-100 truncate">
              {row.original.trackName}
            </div>
            <div className="text-xs text-zinc-400 truncate">
              {row.original.artistName}
            </div>
          </div>
        ),
      },
      {
        id: "bpm",
        accessorFn: (row) => row.bpm,
        header: ({ column }) => <SortableHeader label="BPM" column={column} />,
        enableSorting: true,
        cell: ({ row }) => (
          <span className="font-semibold text-zinc-100">{row.original.bpm}</span>
        ),
      },
      {
        id: "camelotKey",
        accessorFn: (row) => row.camelotKey,
        header: ({ column }) => <SortableHeader label="Camelot Key" column={column} />,
        enableSorting: true,
        sortingFn: (rowA, rowB) =>
          rowA.original.camelotSortIndex - rowB.original.camelotSortIndex,
        cell: ({ row }) => (
          <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-200 border border-emerald-500/20">
            {row.original.camelotKey}
          </span>
        ),
      },
    ];
  }, []);

  const table = useReactTable({
    data: harmonizedTracks ?? [],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
        <div className="animate-pulse text-zinc-400">Loading Spotify connection...</div>
      </div>
    );
  }

  const connected = Boolean(accessToken);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_10%,rgba(34,197,94,0.20),transparent_50%),radial-gradient(circle_at_70%_20%,rgba(16,185,255,0.18),transparent_45%),radial-gradient(circle_at_40%_80%,rgba(168,85,247,0.18),transparent_55%)]" />
      <div className="mx-auto max-w-7xl px-6 py-10">
        {!connected ? (
          <section className="relative">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-white/5 border border-white/10 p-3">
                <Music2 className="h-6 w-6 text-emerald-200" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">
                  Spotify Playlist Harmonizer
                </h1>
                <p className="text-zinc-400">
                  DJ-friendly BPM + Camelot labeling (mock GetSongBPM).
                </p>
              </div>
            </div>

            <div className="mt-8 grid grid-cols-12 gap-6 items-stretch">
              <div className="col-span-12 lg:col-span-7 rounded-2xl bg-white/5 border border-white/10 p-7">
                <div className="flex items-center gap-3">
                  <Headphones className="h-5 w-5 text-sky-300" />
                  <h2 className="text-lg font-semibold">
                    Connect, pick a playlist, mix in sync.
                  </h2>
                </div>

                <ul className="mt-5 space-y-3 text-sm text-zinc-300">
                  <li className="flex gap-3">
                    <span className="text-emerald-300 font-semibold">1.</span>
                    <span>Spotify sign-in with private playlists + public modification.</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-emerald-300 font-semibold">2.</span>
                    <span>
                      Track harmonization: BPM + Camelot via{" "}
                      <code className="rounded bg-black/40 px-1 py-0.5 text-xs">
                        fetchBPMAndKey(isrc)
                      </code>{" "}
                      mock.
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-emerald-300 font-semibold">3.</span>
                    <span>Sortable DataTable by BPM and Camelot Key.</span>
                  </li>
                </ul>

                <div className="mt-6 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => signIn("spotify", { callbackUrl: "/" })}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 font-semibold text-zinc-950 hover:bg-emerald-400 transition"
                  >
                    <Sparkles className="h-5 w-5" />
                    Connect Spotify
                  </button>
                  <div className="text-xs text-zinc-400">
                    Spotify Premium + Development mode assumed.
                  </div>
                </div>
              </div>

              <div className="col-span-12 lg:col-span-5 rounded-2xl bg-white/5 border border-white/10 p-7">
                <div className="text-zinc-300 text-sm">
                  <div className="font-semibold text-zinc-100">Dark DJ Aesthetic</div>
                  <div className="mt-2">
                    Dark, clean dashboard layout optimized for desktop. Lucide icons + high
                    contrast table styling.
                  </div>
                </div>
                <div className="mt-6 rounded-xl border border-white/10 bg-black/20 p-4">
                  <div className="text-xs text-zinc-400">
                    Preview of the harmonized track table
                  </div>
                  <div className="mt-2 font-semibold">Album art + Track + BPM + Camelot</div>
                  <div className="mt-2 text-xs text-zinc-400">
                    Sort by BPM or Camelot Key for harmonic mixing.
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : (
          <section>
            <header className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                    <Music2 className="h-5 w-5 text-emerald-200" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm text-zinc-400">Dashboard</div>
                    <div className="truncate text-xl font-bold">
                      {selectedPlaylist?.name ?? "Select a playlist"}
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/" })}
                className="inline-flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/10 transition"
              >
                <LogOut className="h-4 w-4" />
                Disconnect
              </button>
            </header>

            <div className="mt-6 grid grid-cols-12 gap-6">
              <aside className="col-span-12 lg:col-span-3">
                <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">Your Playlists</div>
                      <div className="text-xs text-zinc-400">
                        Choose one to harmonize tracks
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    {playlistsLoading ? (
                      <div className="text-sm text-zinc-400">Loading playlists...</div>
                    ) : playlistsError ? (
                      <div className="text-sm text-red-300">
                        Failed to load playlists: {getErrorMessage(playlistsErr)}
                      </div>
                    ) : (
                      (playlistsData?.items ?? []).map((p) => {
                        const isActive = p.id === selectedPlaylistId;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setSelectedPlaylistId(p.id)}
                            className={[
                              "w-full rounded-xl px-3 py-2 text-left transition border",
                              isActive
                                ? "bg-emerald-500/15 border-emerald-500/25"
                                : "bg-white/0 border-white/10 hover:bg-white/5",
                            ].join(" ")}
                          >
                            <div className="text-sm font-semibold truncate">{p.name}</div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </aside>

              <main className="col-span-12 lg:col-span-9">
                <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">Harmonized Tracks</div>
                      <div className="text-xs text-zinc-400">
                        Sortable by BPM and Camelot Key
                      </div>
                    </div>
                    {tracksFetching ? (
                      <div className="text-xs text-zinc-400">Harmonizing...</div>
                    ) : null}
                  </div>

                  <div className="mt-4 overflow-x-auto">
                    {tracksLoading ? (
                      <div className="py-10 text-center text-zinc-400 text-sm">
                        Harmonizing tracks (mock GetSongBPM)...
                      </div>
                    ) : tracksError ? (
                      <div className="py-10 text-center text-red-300 text-sm">
                        Failed to load tracks: {getErrorMessage(tracksErr)}
                      </div>
                    ) : (
                      <table className="min-w-[720px] w-full border-separate border-spacing-0">
                        <thead>
                          {table.getHeaderGroups().map((hg) => (
                            <tr key={hg.id}>
                              {hg.headers.map((header) => (
                                <th
                                  key={header.id}
                                  className="sticky top-0 z-10 bg-zinc-950/60 backdrop-blur border-b border-white/10 px-3 py-3 text-xs text-zinc-400"
                                >
                                  {header.isPlaceholder
                                    ? null
                                    : flexRender(
                                        header.column.columnDef.header,
                                        header.getContext()
                                      )}
                                </th>
                              ))}
                            </tr>
                          ))}
                        </thead>
                        <tbody>
                          {table.getRowModel().rows.length === 0 ? (
                            <tr>
                              <td
                                colSpan={4}
                                className="px-3 py-6 text-center text-zinc-400 text-sm"
                              >
                                No tracks found.
                              </td>
                            </tr>
                          ) : (
                            table.getRowModel().rows.map((row) => (
                              <tr
                                key={row.id}
                                className="hover:bg-white/5 transition border-b border-white/5"
                              >
                                {row.getVisibleCells().map((cell) => (
                                  <td key={cell.id} className="px-3 py-3 align-middle">
                                    {flexRender(
                                      cell.column.columnDef.cell,
                                      cell.getContext()
                                    )}
                                  </td>
                                ))}
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </main>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

