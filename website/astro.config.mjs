import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

export default defineConfig({
  site: "https://emseepea.github.io",
  base: "/emseepea",
  output: "static",
  publicDir: "../docs/brand/assets",
  integrations: [starlight({
    title: "Em See Pea",
    description: "Build MCP tools and test whether AI understands their results.",
    // Run Pagefind's CLI after Astro; the Node service can close before files flush.
    pagefind: false,
    favicon: "/emseepea-mark-colour-on-light.svg",
    logo: {
      light: "../docs/brand/assets/emseepea-signature-horizontal-colour-on-light.svg",
      dark: "../docs/brand/assets/emseepea-signature-horizontal-colour-on-dark.svg",
      alt: "",
      replacesTitle: true,
    },
    social: [{ icon: "github", label: "Em See Pea on GitHub", href: "https://github.com/emseepea/emseepea" }],
    editLink: { baseUrl: "https://github.com/emseepea/emseepea/edit/main/website/" },
    customCss: ["./src/styles/brand.css"],
    components: {
      MobileMenuToggle: "./src/components/MobileMenuToggle.astro",
      Search: "./src/components/Search.astro",
    },
    sidebar: [
      { label: "Start here", items: ["index", "getting-started", "ai-tests", "less-server-code"] },
      { label: "Explore", items: ["examples"] },
    ],
  })],
});
