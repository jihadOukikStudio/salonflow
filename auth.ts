import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

import { authConfig } from "@/auth.config";
import { verifyCredentials } from "@/server/auth/verify-credentials";

const credentialsSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(1).max(512),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,

  providers: [
    Credentials({
      name: "Email et mot de passe",

      credentials: {
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

        return verifyCredentials(parsed.data.email, parsed.data.password);
      },
    }),
  ],
});
