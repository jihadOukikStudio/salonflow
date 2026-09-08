import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

import { authConfig } from "@/auth.config";
import { prisma } from "@/server/db/prisma";
import { verifyCredentials } from "@/server/auth/verify-credentials";

const credentialsSchema = z.object({
  identifier: z.string().trim().min(1).max(320).optional(),
  // Compatibilité transitoire avec d'éventuels appels existants utilisant email.
  email: z.string().trim().max(320).optional(),
  password: z.string().min(1).max(512),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,

  callbacks: {
    authorized: authConfig.callbacks.authorized,

    async jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
        token.sessionVersion = user.sessionVersion ?? 0;
      }

      if (!token.sub) return token;

      // Vérification volontaire à chaque lecture de session : un reset de mot
      // de passe doit invalider une session JWT déjà émise, sans attendre 8 h.
      const current = await prisma.user.findUnique({
        where: { id: token.sub },
        select: {
          sessionVersion: true,
          isActive: true,
          salon: { select: { isActive: true } },
        },
      });

      const tokenSessionVersion =
        typeof token.sessionVersion === "number" ? token.sessionVersion : 0;
      if (
        !current ||
        !current.isActive ||
        !current.salon.isActive ||
        current.sessionVersion !== tokenSessionVersion
      ) {
        delete token.sub;
      }

      return token;
    },

    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.sessionVersion =
          typeof token.sessionVersion === "number" ? token.sessionVersion : 0;
      }

      return session;
    },
  },

  providers: [
    Credentials({
      name: "Téléphone ou email et mot de passe",

      credentials: {
        identifier: {
          label: "Téléphone ou email",
          type: "text",
        },

        // Champ conservé pour compatibilité avec d'anciens appels credentials.
        email: {
          label: "Email",
          type: "email",
        },

        password: {
          label: "Mot de passe",
          type: "password",
        },
      },

      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);

        if (!parsed.success) {
          return null;
        }

        const identifier = parsed.data.identifier ?? parsed.data.email;
        if (!identifier) return null;

        return verifyCredentials(identifier, parsed.data.password);
      },
    }),
  ],
});
