import { getCollection } from "astro:content";

export const NAME = "Arif Taha Bülbül";
export const EMAIL = "ariftahabulbul@gmail.com";
export const GITHUB = "https://github.com/ariftahab";
export const LINKEDIN = "https://www.linkedin.com/in/arif-taha-b%C3%BClb%C3%BCl-824a451b4/";
export const LINKEDIN_LABEL = "linkedin.com/in/arif-taha-bülbül";

/** Prefixes a site path with the configured base (e.g. "/blog"). */
export function u(path = ""): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return `${base}/${path.replace(/^\//, "")}`;
}

/** Published posts, newest first. Drafts are visible only in `astro dev`. */
export async function getPosts() {
  const posts = await getCollection("yazilar", (p) => import.meta.env.DEV || !p.data.draft);
  return posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

export async function getProjects() {
  const projects = await getCollection("projeler");
  return projects.sort((a, b) => a.data.order - b.data.order);
}

/** 2026-10-05 -> "2026.10" */
export function shortDate(d: Date): string {
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}`;
}
