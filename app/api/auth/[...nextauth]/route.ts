import NextAuth from "next-auth";
import SpotifyProvider from "next-auth/providers/spotify";
import type { Account, Session } from "next-auth";
import type { JWT } from "next-auth/jwt";

const spotifyClientId = process.env.SPOTIFY_CLIENT_ID;
const spotifyClientSecret = process.env.SPOTIFY_CLIENT_SECRET;

// TEMPORARY - remove after debugging
console.log("ENV CHECK:", {
  clientId: spotifyClientId ? "✅ loaded" : "❌ missing",
  clientSecret: spotifyClientSecret ? "✅ loaded" : "❌ missing",
  secret: process.env.NEXTAUTH_SECRET ? "✅ loaded" : "❌ missing",
  url: process.env.NEXTAUTH_URL,
});

const authOptions = {
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

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };

