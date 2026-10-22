"use client";

import { createContext, useCallback, useContext } from "react";

const OrgSlugContext = createContext<string | null>(null);

export function OrgSlugProvider({ slug, children }: { slug: string; children: React.ReactNode }) {
  return <OrgSlugContext.Provider value={slug}>{children}</OrgSlugContext.Provider>;
}

/** 法人専用ページ内のリンクを作る（例: "/reviews" → "/o/hokkai-food/reviews"） */
export function useOrgHref() {
  const slug = useContext(OrgSlugContext);
  if (!slug) throw new Error("useOrgHref must be used inside an organization page");
  return useCallback((path: string) => `/o/${slug}${path}`, [slug]);
}
