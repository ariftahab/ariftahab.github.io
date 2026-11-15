import { getCollection } from "astro:content";
import type { Lang } from "./i18n";

export const NAME = "Arif Taha Bülbül";
export const EMAIL = "ariftahabulbul@gmail.com";
export const GITHUB = "https://github.com/ariftahab";
export const LINKEDIN = "https://www.linkedin.com/in/arif-taha-b%C3%BClb%C3%BCl-824a451b4/";
export const LINKEDIN_LABEL = "linkedin.com/in/arif-taha-bülbül";

/** Prefixes a site path with the configured base (e.g. "/" or "/blog"). */
export function u(path = ""): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return `${base}/${path.replace(/^\//, "")}`;
}

/** Content collections per language: Turkish in src/content/{projeler,yazilar}, English in src/content/en/. */
const COLLECTIONS = {
  tr: { projects: "projeler", posts: "yazilar" },
  en: { projects: "projects", posts: "posts" },
} as const;

/** Published posts, newest first. Drafts are visible only in `astro dev`. */
export async function getPosts(lang: Lang) {
  const posts = await getCollection(COLLECTIONS[lang].posts, (p) => import.meta.env.DEV || !p.data.draft);
  return posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

export async function getProjects(lang: Lang) {
  const projects = await getCollection(COLLECTIONS[lang].projects);
  return projects.sort((a, b) => a.data.order - b.data.order);
}

export type Post = Awaited<ReturnType<typeof getPosts>>[number];
export type Project = Awaited<ReturnType<typeof getProjects>>[number];

/** 2026-10-05 -> "2026.10" */
export function shortDate(d: Date): string {
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}`;
}
