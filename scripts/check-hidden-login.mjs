import fs from 'node:fs';

const home = fs.readFileSync('src/routes/index.tsx', 'utf8');
const publicShell = fs.readFileSync('src/components/public/company-service-page.tsx', 'utf8');
const authLayout = fs.readFileSync('src/routes/_authenticated.tsx', 'utf8');
const logRoute = fs.readFileSync('src/routes/log.tsx', 'utf8');
const legacyLogin = fs.readFileSync('src/routes/login.tsx', 'utf8');
const robots = fs.readFileSync('public/robots.txt', 'utf8');

const checks = [
  ['canonical employee login is /log', logRoute.includes('createFileRoute("/log")')],
  ['employee login is noindex', logRoute.includes('noindex, nofollow, noarchive')],
  ['legacy /login redirects to /log', legacyLogin.includes('redirect({ to: "/log", replace: true })')],
  ['public home contains no employee login link', !home.includes('href="/login"') && !home.includes('href="/log"')],
  ['public company shell contains no employee login link', !publicShell.includes('href="/login"') && !publicShell.includes('href="/log"')],
  ['protected routes redirect to /log', authLayout.includes('navigate({ to: "/log" })')],
  ['robots disallows /log', /Disallow: \/log(?:\n|$)/.test(robots)],
  ['robots disallows /login', /Disallow: \/login(?:\n|$)/.test(robots)],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
if (failed.length) process.exit(1);
console.log(`Hidden employee login verification passed (${checks.length} checks).`);
