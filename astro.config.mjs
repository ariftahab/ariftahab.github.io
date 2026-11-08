import { defineConfig } from "astro/config";

// GitHub Pages: the site is served from https://ariftahab.github.io/blog/
// If the repo is renamed to "ariftahab.github.io", set base to "/".
export default defineConfig({
  site: "https://ariftahab.github.io",
  base: "/blog",
});
