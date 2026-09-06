import type { Metadata } from "next";
import { Cormorant_Garamond, Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";
import { LogOut } from "lucide-react";

import { auth } from "@/auth";
import { logoutAction } from "@/app/logout/actions";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

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
}: Readonly<{
  children: ReactNode;
}>) {
  const session = await auth();

  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} ${salonFlowDisplay.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {session?.user ? (
          <div className="fixed right-3 top-3 z-50 sm:right-5 sm:top-5">
            <form action={logoutAction}>
              <button
                type="submit"
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-violet-200 bg-white/90 px-3.5 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur-md transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-800"
              >
                <LogOut aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
                <span className="hidden sm:inline">Se déconnecter</span>
              </button>
            </form>
          </div>
        ) : null}
        {children}
      </body>
    </html>
  );
}
