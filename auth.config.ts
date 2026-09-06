import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: {
    signIn: "/login",
  },

  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60,
  },

  trustHost: true,

  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = Boolean(auth?.user?.id);
      const pathname = request.nextUrl.pathname;

      const isLoginPage = pathname === "/login";

      if (isLoginPage) {
        if (isLoggedIn) {
          return Response.redirect(new URL("/", request.nextUrl));
        }

        return true;
      }

      return isLoggedIn;
    },

    jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
      }

      return token;
    },

    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }

      return session;
    },
  },

  providers: [],
} satisfies NextAuthConfig;
