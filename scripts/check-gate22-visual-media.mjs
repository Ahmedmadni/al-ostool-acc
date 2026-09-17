import { readFileSync, statSync } from "node:fs";

const assets = [
  "public/images/group/holding-hero-v1.webp",
  "public/images/group/contracting-infrastructure-v1.webp",
  "public/images/group/operations-maintenance-v1.webp",
  "public/images/group/real-estate-assets-v1.webp",
  "public/images/group/digital-technology-v1.webp",
];

const portfolio = readFileSync("src/data/group-portfolio.ts", "utf8");
const home = readFileSync("src/routes/index.tsx", "utf8");
const companyPage = readFileSync("src/components/public/company-service-page.tsx", "utf8");

const failures = [];
const requireText = (source, needle, label) => {
  if (!source.includes(needle)) failures.push(label);
};

for (const asset of assets) {
  const bytes = readFileSync(asset);
  const header = bytes.subarray(0, 12).toString("ascii");
  if (!header.startsWith("RIFF") || !header.endsWith("WEBP")) {
    failures.push(`${asset} is not a valid WebP asset`);
  }
  if (statSync(asset).size > 220_000) {
    failures.push(`${asset} exceeds the 220 KB performance budget`);
  }
}

for (const field of ["imageUrl", "imageAltAr", "imageAltEn"]) {
  requireText(portfolio, `${field}: string`, `portfolio media contract is missing ${field}`);
}

for (const asset of assets.slice(1)) {
  requireText(portfolio, asset.replace("public", ""), `portfolio is missing ${asset}`);
}

requireText(home, "/images/group/holding-hero-v1.webp", "holding hero image is missing");
requireText(home, 'fetchPriority="high"', "holding hero priority hint is missing");
requireText(home, 'loading="lazy"', "portfolio lazy loading is missing");
requireText(home, "company.imageAltAr", "Arabic portfolio alternative text is missing");
requireText(home, "company.imageAltEn", "English portfolio alternative text is missing");
requireText(companyPage, "src={company.imageUrl}", "company hero image is missing");
requireText(companyPage, "company.imageAltAr", "Arabic company alternative text is missing");
requireText(companyPage, "company.imageAltEn", "English company alternative text is missing");

if (failures.length) {
  console.error("Gate 22 visual media checks failed:\n- " + failures.join("\n- "));
  process.exit(1);
}

console.log("Gate 22 visual media checks passed.");
