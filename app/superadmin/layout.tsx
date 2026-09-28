import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requirePlatformAdmin } from "@/server/platform/auth";
export default async function SuperadminLayout({
  children,
}: {
  children: ReactNode;
}) {
  try {
    await requirePlatformAdmin();
  } catch {
    redirect("/");
  }
  return children;
}
