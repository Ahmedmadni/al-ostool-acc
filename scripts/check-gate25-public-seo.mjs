import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const files = {
  home: read("src/routes/index.tsx"),
  root: read("src/routes/__root.tsx"),
  seo: read("src/lib/public-seo.ts"),
  header: read("src/components/public/public-site-header.tsx"),
  authenticated: read("src/routes/_authenticated.tsx"),
  sitemap: read("src/routes/sitemap[.]xml.ts"),
  robots: read("public/robots.txt"),
  login: read("src/routes/log.tsx"),
};

const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };

expect(files.seo.includes('rel: "canonical"'), "Public pages must emit canonical URLs.");
expect(files.seo.includes('property: "og:url"'), "Public pages must emit og:url.");
expect(files.seo.includes("max-image-preview:large"), "Public pages must expose rich preview directives.");
expect(files.seo.includes("/onexa-og.png"), "ONEXA social preview is required.");
expect(files.root.includes('"@type": "Organization"'), "Organization JSON-LD is required.");
expect(files.root.includes('"@type": "SoftwareApplication"'), "SoftwareApplication JSON-LD is required.");
expect(files.root.includes("ONEXA ERP"), "ONEXA metadata is required.");
expect(files.header.includes("<details") && files.header.includes("<summary"), "Accessible mobile navigation is required.");
expect(files.header.includes('/log?mode=signup'), "Public account creation entry point is required.");
expect(files.home.includes("CONNECTED CLOUD ERP") && files.home.includes("نظام ERP سحابي مترابط"), "Bilingual ERP positioning is required.");
expect(files.authenticated.includes("noindex, nofollow, noarchive"), "ERP routes must be excluded from indexing.");
expect(files.login.includes("noindex, nofollow, noarchive"), "Authentication routes must be excluded from indexing.");
expect(files.robots.includes("Sitemap:"), "robots.txt must advertise the sitemap.");
expect(!files.sitemap.includes('/companies/al-ostool'), "Legacy customer company pages must not remain in the public sitemap.");
expect(files.sitemap.includes('path: "/"'), "ONEXA home must be present in the sitemap.");

for (const [name, source] of Object.entries(files)) {
  expect(!source.includes("bg-gradient-to-"), `${name} reintroduced a prohibited generated-style gradient utility.`);
}

if (failures.length) {
  console.error("Gate 25 failed:\n- " + failures.join("\n- "));
  process.exit(1);
}

console.log("Gate 25 passed: ONEXA crawl controls, structured data, authentication indexing rules, and public SEO are present.");
