import { defineConfig } from "astro/config";

// GitHub Pages: the repo is named "ariftahab.github.io", so the site is served from the root.
export default defineConfig({
  site: "https://ariftahab.github.io",
  base: "/",
});
