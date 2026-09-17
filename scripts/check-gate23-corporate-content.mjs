import { readFileSync, statSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const failures = [];
const requireText = (source, needle, label) => {
  if (!source.includes(needle)) failures.push(label);
};

const styles = read("src/styles.css");
requireText(styles, "--primary: #e8a312", "profile yellow is missing from the light identity");
requireText(styles, "--primary: #f1b12b", "profile yellow is missing from the dark identity");
for (const legacyOrange of ["#f05a28", "#ff6a35", "#ff7547", "#ff8157"]) {
  if (styles.toLowerCase().includes(legacyOrange)) failures.push(`legacy orange remains: ${legacyOrange}`);
}

for (const asset of ["public/images/brand/al-ostool-logo.png", "public/images/brand/al-ostool-mark.png"]) {
  const bytes = readFileSync(asset);
  if (bytes.subarray(1, 4).toString("ascii") !== "PNG") failures.push(`${asset} is not a PNG asset`);
  if (statSync(asset).size > 350_000) failures.push(`${asset} exceeds the 350 KB brand-asset budget`);
}

const brand = read("src/components/public/brand-logo.tsx");
requireText(brand, "/images/brand/al-ostool-mark.png", "shared brand mark is missing");

for (const path of [
  "src/routes/index.tsx",
  "src/routes/app.tsx",
  "src/components/public/company-service-page.tsx",
]) {
  requireText(read(path), "BrandLogo", `shared brand header is missing from ${path}`);
}
requireText(read("src/components/layout/app-shell.tsx"), "/images/brand/al-ostool-mark.png", "ERP brand mark is missing");

const home = read("src/routes/index.tsx");
for (const marker of [
  'id="about"',
  'id="partners"',
  "Since 2008",
  "منذ 2008",
  "Diriyah",
  "King Salman Park",
  "Princess Nourah University",
  "Project values are intentionally not published",
]) {
  requireText(home, marker, `corporate-content marker is missing: ${marker}`);
}

for (const asset of [
  "public/images/partners/diriyah.svg",
  "public/images/partners/rcrc.svg",
  "public/images/partners/princess-nourah-university.svg",
  "public/images/partners/dallah-hospital.png",
  "public/images/partners/al-hilal.webp",
]) {
  if (statSync(asset).size < 1_000) failures.push(`${asset} is missing or unexpectedly small`);
}
for (const marker of ["Al-Hilal Saudi Club", "National Guard Housing", "Dammam Reformatory", "Qadisiyah Exhibition Complex", "20+ projects"]) {
  requireText(home, marker, `expanded portfolio marker is missing: ${marker}`);
}

const contracting = read("src/routes/companies.al-ostool.tsx");
for (const marker of ["Roads & infrastructure", "Demolition & site clearance", "Crushers & construction materials", "Heavy equipment & transport"]) {
  requireText(contracting, marker, `contracting capability is missing: ${marker}`);
}

const manifest = JSON.parse(read("public/manifest.webmanifest"));
if (manifest.name !== "Al-Ostool Al-Ali Group") failures.push("public manifest still uses the ERP product identity");
if (manifest.theme_color !== "#F1B12B") failures.push("public manifest theme does not match the approved profile yellow");
if (manifest.lang !== "en" || manifest.dir !== "ltr") failures.push("public manifest does not match the English-first public website");

if (failures.length) {
  console.error("Gate 23 corporate content checks failed:\n- " + failures.join("\n- "));
  process.exit(1);
}

console.log("Gate 23 corporate content checks passed.");
