"use client";

import { useEffect, useState } from "react";

export interface UseMediaQueryOptions {
  readonly defaultValue?: boolean;
}

export function useMediaQuery(
  query: string,
  { defaultValue = false }: Readonly<UseMediaQueryOptions> = {},
) {
  const [matches, setMatches] = useState(defaultValue);

  useEffect(() => {
    const mediaQuery = window.matchMedia?.(query);
    if (!mediaQuery) return;

    const updateMatches = () => setMatches(mediaQuery.matches);

    updateMatches();
    mediaQuery.addEventListener("change", updateMatches);

    return () => mediaQuery.removeEventListener("change", updateMatches);
  }, [query]);

  return matches;
}
