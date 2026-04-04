import SpotifyProvider from "next-auth/providers/spotify";
import type { Account, Session } from "next-auth";
import type { JWT } from "next-auth/jwt";

const spotifyClientId = process.env.SPOTIFY_CLIENT_ID;
const spotifyClientSecret = process.env.SPOTIFY_CLIENT_SECRET;

export const authOptions = {
  debug: process.env.NODE_ENV === "development",
  session: {
    strategy: "jwt" as const,
  },
  providers: [
    SpotifyProvider({
      clientId: spotifyClientId ?? "",
      clientSecret: spotifyClientSecret ?? "",
      authorization: {
        params: {
          scope: "playlist-read-private playlist-modify-public",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({
      token,
      account,
    }: {
      token: JWT;
      account?: Account | null;
    }) {
      if (account?.access_token) token.accessToken = account.access_token;
      return token;
    },
    async session({
      session,
      token,
    }: {
      session: Session;
      token: JWT;
    }) {
      session.accessToken = token.accessToken;
      return session;
    },
  },
};
