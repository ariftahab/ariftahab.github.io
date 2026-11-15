// Two languages: Turkish at the site root, English under /en/. Each section has its own slug per language.
export const LANGS = ["tr", "en"] as const;
export type Lang = (typeof LANGS)[number];
export type Page = "home" | "projects" | "posts" | "contact";

const PREFIX: Record<Lang, string> = { tr: "", en: "en/" };
const SLUG: Record<Lang, Record<Exclude<Page, "home">, string>> = {
  tr: { projects: "projeler", posts: "yazilar", contact: "iletisim" },
  en: { projects: "projects", posts: "posts", contact: "contact" },
};

const base = () => import.meta.env.BASE_URL.replace(/\/$/, "");

/** URL of a page in a language, e.g. href("en", "projects", "cyclar") -> "/en/projects/cyclar/". */
export function href(lang: Lang, page: Page, id?: string): string {
  const parts = [PREFIX[lang] + (page === "home" ? "" : SLUG[lang][page] + "/")];
  if (id) parts.push(`${id}/`);
  return `${base()}/${parts.join("")}`;
}

/** Splits a pathname into language, page and id. Unknown paths fall back to the home page. */
export function parsePath(pathname: string): { lang: Lang; page: Page; id?: string } {
  let rest = pathname.slice(base().length).replace(/^\/+/, "");
  let lang: Lang = "tr";
  if (rest === "en" || rest.startsWith("en/")) {
    lang = "en";
    rest = rest.slice(2).replace(/^\/+/, "");
  }
  const [seg, id] = rest.split("/").filter(Boolean);
  const page = (Object.keys(SLUG[lang]) as Exclude<Page, "home">[]).find((k) => SLUG[lang][k] === seg);
  return { lang, page: page ?? "home", id: page ? id : undefined };
}

export const other = (lang: Lang): Lang => (lang === "tr" ? "en" : "tr");

/** UI strings. Content (projects, posts) lives in Markdown, one copy per language. */
export const t = {
  tr: {
    description: "RAG, agent'lar ve yerel modeller üzerine projeler ve yazılar.",
    intro: "RAG, agent'lar ve yerel modeller üzerine çalışıyorum. Burada yaptığım projeleri ve onlardan öğrendiklerimi yazıyorum.",
    projects: "projeler",
    posts: "yazılar",
    contact: "iletişim",
    projectsTitle: "Projeler",
    postsTitle: "Yazılar",
    contactTitle: "İletişim",
    viewOnGithub: "GitHub'da incele →",
    relatedPosts: "bu projeyle ilgili yazılar",
    noRelatedPosts: "Bu proje hakkında henüz yazı yok.",
    noPosts: "Henüz yazı yok.",
    draft: "taslak",
    backHome: "← ana sayfaya dön",
    email: "e-posta",
    diagram: "sistem şeması",
  },
  en: {
    description: "Projects and writing on RAG, agents and local models.",
    intro: "I work on RAG, agents and local models. This is where I keep the projects I build and write about what I learn from them.",
    projects: "projects",
    posts: "posts",
    contact: "contact",
    projectsTitle: "Projects",
    postsTitle: "Posts",
    contactTitle: "Contact",
    viewOnGithub: "View on GitHub →",
    relatedPosts: "posts about this project",
    noRelatedPosts: "No posts about this project yet.",
    noPosts: "No posts yet.",
    draft: "draft",
    backHome: "← back to home",
    email: "email",
    diagram: "system diagram",
  },
} satisfies Record<Lang, Record<string, string>>;
