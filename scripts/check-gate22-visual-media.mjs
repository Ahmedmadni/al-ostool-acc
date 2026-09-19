import { readFileSync, statSync } from "node:fs";

const preservedTenantAssets = [
  "public/images/group/holding-hero-v1.webp",
  "public/images/group/contracting-infrastructure-v1.webp",
  "public/images/group/operations-maintenance-v1.webp",
  "public/images/group/real-estate-assets-v1.webp",
  "public/images/group/digital-technology-v1.webp",
];

const failures = [];
for (const asset of preservedTenantAssets) {
  const bytes = readFileSync(asset);
  const header = bytes.subarray(0, 12).toString("ascii");
  if (!header.startsWith("RIFF") || !header.endsWith("WEBP")) failures.push(`${asset} is not a valid WebP asset`);
  if (statSync(asset).size > 220_000) failures.push(`${asset} exceeds the 220 KB performance budget`);
}

for (const asset of ["public/onexa-mark-192.png", "public/onexa-mark-512.png", "public/onexa-og.png"]) {
  const bytes = readFileSync(asset);
  if (bytes.subarray(1, 4).toString("ascii") !== "PNG") failures.push(`${asset} is not a PNG asset`);
}
if (statSync("public/onexa-og.png").size > 350_000) failures.push("ONEXA social preview exceeds the 350 KB performance budget");

const root = readFileSync("src/routes/__root.tsx", "utf8");
const seo = readFileSync("src/lib/public-seo.ts", "utf8");
const manifest = readFileSync("public/manifest.webmanifest", "utf8");
if (!root.includes("/onexa-mark.svg")) failures.push("ONEXA favicon is not registered");
if (!seo.includes("/onexa-og.png")) failures.push("ONEXA social preview is not registered");
if (!manifest.includes("/onexa-mark-192.png") || !manifest.includes("/onexa-mark-512.png")) failures.push("ONEXA install icons are not registered");

if (failures.length) {
  console.error("Gate 22 visual media checks failed:\n- " + failures.join("\n- "));
  process.exit(1);
}

console.log("Gate 22 ONEXA visual media checks passed.");
