import { defineCollection, reference } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

// One Markdown file per project. The file name is the project id (used in URLs and in posts' `proje` field).
const projeler = defineCollection({
  loader: glob({ base: "./src/content/projeler", pattern: "**/*.md" }),
  schema: z.object({
    title: z.string(),
    summary: z.string(), // one line, shown on the home page
    lead: z.string(), // longer intro, shown at the top of the project page
    year: z.number(),
    stack: z.array(z.string()),
    order: z.number(), // position on the home page, smallest first
    github: z.string().optional(), // leave out for private repos
    // Workflow diagram: each step is a label, or a list of labels drawn stacked (parallel steps).
    // A label starting with "*" is highlighted.
    flow: z.array(z.union([z.string(), z.array(z.string())])).optional(),
    flowCaption: z.string().optional(),
  }),
});

// One Markdown file per post. `proje` links the post to a project page.
const yazilar = defineCollection({
  loader: glob({ base: "./src/content/yazilar", pattern: "**/*.md" }),
  schema: z.object({
    title: z.string(),
    subtitle: z.string(),
    date: z.coerce.date(),
    proje: reference("projeler").optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { projeler, yazilar };
