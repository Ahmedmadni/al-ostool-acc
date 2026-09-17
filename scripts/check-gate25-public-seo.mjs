import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const files = {
  home: read("src/routes/index.tsx"),
  root: read("src/routes/__root.tsx"),
  seo: read("src/lib/public-seo.ts"),
  header: read("src/components/public/public-site-header.tsx"),
  companyPage: read("src/components/public/company-service-page.tsx"),
  authenticated: read("src/routes/_authenticated.tsx"),
  sitemap: read("src/routes/sitemap[.]xml.ts"),
  robots: read("public/robots.txt"),
};

const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };

expect(files.seo.includes('rel: "canonical"'), "Public pages must emit canonical URLs.");
expect(files.seo.includes('property: "og:url"'), "Public pages must emit og:url.");
expect(files.seo.includes("max-image-preview:large"), "Public pages must expose rich preview directives.");
expect(files.root.includes('"@type": "Organization"'), "Organization JSON-LD is required.");
expect(files.root.includes('contactPoint'), "Organization contact JSON-LD is required.");
expect(files.root.includes('foundingDate: "2008"'), "Organization founding date is required.");
expect(files.header.includes("<details") && files.header.includes("<summary"), "Accessible mobile navigation is required.");
expect(files.companyPage.includes("PublicSiteHeader"), "Company pages must share the responsive public header.");
expect(files.home.includes("info@alostool.com.sa"), "Published business email is required.");
expect(files.home.includes("+966 50 833 1111"), "Published business phone is required.");
expect(files.home.includes("Diriyah Gate — Contract 148"), "Expanded documented project record is required.");
expect(files.authenticated.includes("noindex, nofollow, noarchive"), "ERP routes must be excluded from indexing.");
expect(files.robots.includes("Sitemap: https://al-ostool-acc.lovable.app/sitemap.xml"), "robots.txt must advertise the sitemap.");
expect(files.sitemap.includes('/companies/al-ostool'), "Sitemap must include public company pages.");

for (const [name, source] of Object.entries(files)) {
  expect(!source.includes("bg-gradient-to-"), `${name} reintroduced a prohibited AI-style gradient utility.`);
}

if (failures.length) {
  console.error("Gate 25 failed:\n- " + failures.join("\n- "));
  process.exit(1);
}

console.log("Gate 25 passed: responsive navigation, contact content, crawl controls, and public SEO are present.");
