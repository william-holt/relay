"use client";

import { SessionProvider } from "next-auth/react";
import { BusinessProvider } from "@/components/business-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <BusinessProvider>{children}</BusinessProvider>
    </SessionProvider>
  );
}
