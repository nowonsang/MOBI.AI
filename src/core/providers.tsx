"use client";

import type { ReactNode } from "react";
import { QueryProvider } from "./query/query-provider";
import { StoreProvider } from "./store/store-provider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <StoreProvider>
      <QueryProvider>{children}</QueryProvider>
    </StoreProvider>
  );
}
