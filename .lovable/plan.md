# PWA Transformation Plan — Al Ostool Accounting

Goal: turn the existing TanStack Start app into a premium, installable PWA with offline app-shell, install prompt, mobile bottom navigation, and full icon/splash coverage — while preserving all current SEO and routing behavior.

This follows the project's PWA skill: `vite-plugin-pwa` (generateSW) with a guarded registration wrapper that NEVER runs in dev or Lovable preview.

---

## 1. Manifest & Icons

Create `public/manifest.webmanifest` with:
- `name`: "Al Ostool Accounting Platform"
- `short_name`: "Al Ostool"
- `description`: Cloud Accounting, Financial Management, Reports, Dashboards, Cost Control, Asset Management, Fleet Management, and Business Intelligence Platform.
- `display`: standalone, `orientation`: portrait
- `theme_color`: #0F172A, `background_color`: #FFFFFF
- `start_url`: /, `scope`: /, `lang`: ar, `dir`: rtl
- `categories`: ["business", "finance", "productivity"]

Generate icons from existing `src/assets/logo.ico` at: 72, 96, 128, 144, 152, 192, 384, 512 (plus 192 & 512 maskable variants). Stored in `public/icons/` and uploaded as Lovable assets if large.

Add Apple touch icon + iOS splash links and `theme-color` meta in `src/routes/__root.tsx` head() — additive only, no SEO meta removed.

## 2. Service Worker (vite-plugin-pwa)

Install `vite-plugin-pwa`. Configure in `vite.config.ts`:
- `registerType: "autoUpdate"`
- `injectRegister: null` (we register manually from a guarded wrapper)
- `devOptions: { enabled: false }`
- `filename: "sw.js"`
- Workbox runtime caching:
  - HTML navigations → `NetworkFirst` (offline fallback `/offline.html`)
  - Same-origin hashed JS/CSS → `CacheFirst`
  - Images / fonts → `StaleWhileRevalidate`
  - Google Fonts (Cairo) → `CacheFirst` with expiration
- `navigateFallbackDenylist`: `/api/`, `/~oauth`, `/__l5e/`
- Exclude Supabase API calls from caching

## 3. Guarded Registration Wrapper

`src/lib/pwa/register-sw.ts` — registers `/sw.js` only when ALL true:
- `import.meta.env.PROD`
- not in iframe
- hostname is not `id-preview--*`, `preview--*`, `*.lovableproject.com`, `*.lovableproject-dev.com`, `*.beta.lovable.dev`
- URL does not contain `?sw=off`

Otherwise: actively `unregister()` any existing `/sw.js` registration (kill switch). Called once from `RootComponent` in `src/routes/__root.tsx` inside a `useEffect`.

## 4. Offline Page

Static `public/offline.html` — RTL Arabic, app-branded:
- Title: "غير متصل بالإنترنت"
- Body: "أنت غير متصل بالإنترنت حالياً. بعض الميزات قد لا تكون متاحة حتى استعادة الاتصال."
- Retry button → `location.reload()`

Used as Workbox `navigateFallback`.

## 5. Install Prompt UI

New component `src/components/pwa/install-prompt.tsx`:
- Listens for `beforeinstallprompt`, stashes the event
- Renders a dismissible bottom sheet (shadcn `Sheet` / `Card`) with:
  - Title: "تثبيت تطبيق الأسطول"
  - Description: "ثبّت الأسطول على جهازك للوصول الأسرع وتجربة استخدام أفضل."
  - Buttons: "تثبيت" / "لاحقاً"
- Stores dismissal in `localStorage` (`pwa-install-dismissed-at`) — re-shows after 14 days
- iOS Safari fallback card: short instructions to use "إضافة إلى الشاشة الرئيسية" (since `beforeinstallprompt` is unavailable)
- Hidden when `display-mode: standalone`
- Mounted inside `_authenticated` layout so it never blocks `/login`

## 6. Mobile Bottom Navigation

New component `src/components/layout/mobile-bottom-nav.tsx` — visible only on `< md` breakpoint, hidden on print and when keyboard is open.

Tabs (mapped to existing routes):
- لوحة التحكم → `/dashboard`
- المحاسبة → `/financials`
- التقارير → `/reports`
- الأصول → `/fixed-assets`
- الأسطول → `/projects` (closest fleet-related section in current app)
- الإعدادات → `/settings/regional`

Integrated into `AppShell`:
- Existing sidebar hidden on mobile (already partially handled — will add `hidden md:flex`)
- Add bottom safe-area padding to `<main>` on mobile to avoid content under the nav
- Hamburger button in header opens sidebar as a `Sheet` on mobile

## 7. Page Transitions & Touch Polish

- Add subtle route fade/slide via existing Tailwind utilities (no new animation lib)
- Ensure tap targets ≥ 44px on bottom nav and header buttons
- `-webkit-tap-highlight-color: transparent` and `overscroll-behavior: contain` on body in `src/styles.css`

## 8. Performance

Already covered by TanStack auto code-splitting + Vite. Additions:
- Preconnect to Supabase URL in root head()
- `loading="lazy"` audit on large `<img>` tags (logo and dashboard charts only — quick pass)
- Cairo font already has `display=swap` — keep as-is

## 9. Push Notification Infrastructure (prepared, not activated)

- Add `src/lib/pwa/push.ts` with helpers: `isPushSupported()`, `requestPermission()`, `subscribe(vapidKey)` — wired but not called anywhere
- No backend wiring, no VAPID keys committed
- Documented as opt-in for a future turn

## 10. Security & Versioning

- Service worker only registered on HTTPS production hostnames (guard handles this)
- Workbox cache names auto-versioned via `vite-plugin-pwa` build hash
- No auth tokens/localStorage data ever cached by SW (Supabase requests are network-only)
- Kill-switch via `?sw=off` documented in code comment

## 11. SEO Preservation

No changes to existing `head()` meta, OG tags, JSON-LD, or route structure. Only additive `<link rel="manifest">`, apple-touch-icon links, and `theme-color` meta.

## 12. Verification (manual, post-build)

After implementation, verify in published preview:
- Chrome DevTools → Application → Manifest: all icons + fields valid
- Lighthouse PWA audit passes (installable + PWA-optimized)
- Install button appears in Chrome address bar
- iOS Safari "Add to Home Screen" yields standalone launch
- Offline: navigate then kill network → `/offline.html` shows
- `?sw=off` unregisters the worker

---

## Files to add
- `public/manifest.webmanifest`
- `public/offline.html`
- `public/icons/icon-{72,96,128,144,152,192,384,512}.png` (+ maskable 192/512)
- `src/lib/pwa/register-sw.ts`
- `src/lib/pwa/push.ts`
- `src/components/pwa/install-prompt.tsx`
- `src/components/layout/mobile-bottom-nav.tsx`

## Files to edit
- `vite.config.ts` — add `VitePWA` plugin
- `package.json` — add `vite-plugin-pwa` (+ `workbox-window` if needed)
- `src/routes/__root.tsx` — manifest link, theme-color, apple icons, SW register hook
- `src/routes/_authenticated.tsx` — mount `<InstallPrompt />` and `<MobileBottomNav />`
- `src/components/layout/app-shell.tsx` — responsive sidebar (hidden on mobile, sheet drawer), bottom padding for mobile nav
- `src/styles.css` — tap highlight, safe-area, overscroll tweaks

## Out of scope (explicit)
- APK / native wrappers
- App Store submission
- Activating push notifications (infrastructure only)
- Backend/database changes
- Changes to existing business logic, financial routes, or auth flow

---

Ready to implement on approval.