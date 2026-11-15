import { defineCollection, reference } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";
import { diagramSchema } from "./lib/diagram";

// Every piece of content exists twice: Turkish in src/content/{projeler,yazilar}, English in src/content/en/{projeler,yazilar}.
// Keep the file names the same in both languages; the language switcher matches pages by file name.

// One Markdown file per project. The file name is the project id (used in URLs and in posts' `proje` field).
const projectSchema = z.object({
  title: z.string(),
  summary: z.string(), // one line, shown on the home page
  lead: z.string(), // longer intro, shown at the top of the project page
  year: z.number(),
  stack: z.array(z.string()),
  order: z.number(), // position on the home page, smallest first
  github: z.string().optional(), // leave out for private repos
  diagram: diagramSchema.optional(), // system diagram; leave out when a diagram would add nothing
  // Screenshots shown as a horizontally scrolling strip. src is relative to public/ (e.g. img/cyclar/harita.png).
  gallery: z.array(z.object({ src: z.string(), alt: z.string() })).optional(),
});

// One Markdown file per post. `proje` links the post to a project page.
const postSchema = (projects: "projeler" | "projects") =>
  z.object({
    title: z.string(),
    subtitle: z.string(),
    date: z.coerce.date(),
    proje: reference(projects).optional(),
    draft: z.boolean().default(false),
  });

const projeler = defineCollection({
  loader: glob({ base: "./src/content/projeler", pattern: "**/*.md" }),
  schema: projectSchema,
});
const yazilar = defineCollection({
  loader: glob({ base: "./src/content/yazilar", pattern: "**/*.md" }),
  schema: postSchema("projeler"),
});
const projects = defineCollection({
  loader: glob({ base: "./src/content/en/projeler", pattern: "**/*.md" }),
  schema: projectSchema,
});
const posts = defineCollection({
  loader: glob({ base: "./src/content/en/yazilar", pattern: "**/*.md" }),
  schema: postSchema("projects"),
});

export const collections = { projeler, yazilar, projects, posts };
