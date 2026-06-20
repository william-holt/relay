"use client";

import { BusinessProvider } from "@/components/business-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return <BusinessProvider>{children}</BusinessProvider>;
}
