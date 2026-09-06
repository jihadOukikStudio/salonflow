import type { Metadata } from "next";
import { Cormorant_Garamond, Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";

import { auth } from "@/auth";
import { AppShell } from "@/features/shell/components/app-shell";
import { getAuthoritativeCurrentUser } from "@/server/auth/get-authoritative-current-user";
import { getCurrentUser } from "@/server/auth/get-current-user";

import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
const salonFlowDisplay = Cormorant_Garamond({
  variable: "--font-salonflow-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "SalonFlow",
  description: "Planning et organisation du salon",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const session = await auth();

  let shellUser: {
    role: "ADMIN" | "EMPLOYEE";
    canManageSalon: boolean;
  } | null = null;

  if (session?.user) {
    const currentUser = await getCurrentUser();
    const user = await getAuthoritativeCurrentUser(currentUser);
    shellUser = { role: user.role, canManageSalon: user.canManageSalon };
  }

  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} ${salonFlowDisplay.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        {shellUser ? (
          <AppShell user={shellUser}>{children}</AppShell>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
