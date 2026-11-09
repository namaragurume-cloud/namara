import "server-only";
import { absoluteUrl } from "@/lib/utils";
import type { Assignment, Campaign, Creator } from "./types";

export const creatorPortalUrl = (c: Pick<Creator, "token">) => absoluteUrl(`/m/${c.token}`);
export const assignmentUrl = (c: Pick<Creator, "token">, a: Pick<Assignment, "id">) =>
  absoluteUrl(`/m/${c.token}/${a.id}`);
export const restaurantPortalUrl = (c: Pick<Campaign, "shareToken">) => absoluteUrl(`/p/${c.shareToken}`);
