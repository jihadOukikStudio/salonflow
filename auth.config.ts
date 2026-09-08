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
      const isPasswordRecoveryPage =
        pathname === "/forgot-password" ||
        pathname.startsWith("/reset-password/");

      if (isLoginPage) {
        if (isLoggedIn) {
          return Response.redirect(new URL("/", request.nextUrl));
        }

        return true;
      }

      if (isPasswordRecoveryPage) {
        return true;
      }

      return isLoggedIn;
    },
  },

  providers: [],
} satisfies NextAuthConfig;
