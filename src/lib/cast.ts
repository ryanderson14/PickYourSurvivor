import type { Contestant } from "./types";

/**
 * Name-to-slug overrides for contestants whose file name doesn't follow
 * the simple "firstname-lastname" pattern derived from their full name.
 */
const SLUG_OVERRIDES: Record<string, string> = {
  'Benjamin "Coach" Wade': "coach-wade",
  "Jenna Lewis-Dougherty": "jenna-lewis",
  "Stephenie LaGrossa Kendrick": "stephenie-lagrossa",
  'Quintavius "Q" Burdette': "q-burdette",
  "Q Burdette": "q-burdette",
};

function nameToSlug(name: string): string {
  if (SLUG_OVERRIDES[name]) return SLUG_OVERRIDES[name];
  return name
    .toLowerCase()
    .replace(/[^a-z\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

export function getContestantPhotoUrl(contestant: Pick<Contestant, "name" | "image_url">): string {
  if (contestant.image_url) return contestant.image_url;
  return `/cast/${nameToSlug(contestant.name)}.jpg`;
}
