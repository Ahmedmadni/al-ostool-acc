## Mobile PWA Navigation Redesign

Transform the current limited mobile bottom nav (6 fixed items) and the small "additional menus" popup into a complete mobile app launcher exposing every module already present in the desktop sidebar.

### 1. New Bottom Navigation Bar (`src/components/layout/mobile-bottom-nav.tsx`)

Replace the existing 6 tabs with exactly 5:

- الرئيسية → `/dashboard`
- المشاريع → `/projects`
- العملاء → `/customers`
- التقارير → `/reports`
- المزيد → opens the new Launcher sheet (not a route)

The "More" button toggles a full-screen launcher overlay.

### 2. New Mobile App Launcher (`src/components/layout/mobile-app-launcher.tsx`)

Full-screen sheet (using existing `ui/sheet`) opened from "More". Contents:

**Header**
- Title: "جميع الوحدات"
- Search input (filters modules live by Arabic label)
- Close button

**Favorites strip** (only when user has pinned modules)
- Horizontal scroll row of pinned module icons
- Long-press / star icon on any tile toggles favorite
- Stored in `localStorage` under `mobile-launcher-favorites` (array of `to` paths)

**Categorized sections** (collapsible headers), each rendering a 4-column responsive icon grid (3 cols on very narrow widths):

1. **المالية (Financial)** — Invoices, Aging (Customers/Vendors), Banks, Treasury, Treasury Forecast, Cash Flow Matrix, Financial Statements hub + Balance Sheet, Income Statement, Cash Flow, Equity, KPIs, Trial Balance, Financial Indicators
2. **المشاريع (Projects)** — Projects, Contracts, Progress, Project Control
3. **التكاليف (Costs)** — Cost Intelligence, Cost Control, HR Costs (vendors top), Fixed Assets
4. **الذكاء (Intelligence)** — Executive CFO, Customer Intelligence, Vendor Intelligence, AI Insights, Forecasting, Scenarios, Board Reports, Alerts, Copilot
5. **العمليات (Operations)** — Customers, Vendors, Suppliers, Tasks, Team Performance, Reports Center, Import Center, Templates, Tax Tools, Notes, Notifications
6. **الإدارة (Administration)** — Regional Settings, User Approvals (admin), Users (admin), Account

Each tile: icon + label, tap navigates and closes the sheet. A small star button in the corner toggles favorite.

**Module catalog** lives in one shared file `src/lib/mobile-modules.ts` exporting `MODULES: { to, label, icon, category }[]` so the launcher, search, and favorites all read from a single source. The catalog mirrors the existing desktop `GROUPS` from `app-shell.tsx` plus the missing routes (`/copilot`, `/notes`, `/notifications`, `/account`, `/imports/upload`, etc.).

### 3. Wire into `_authenticated.tsx`

Add launcher state at layout level: `const [launcherOpen, setLauncherOpen] = useState(false)`, pass setter to `MobileBottomNav`, render `<MobileAppLauncher open={launcherOpen} onOpenChange={setLauncherOpen} />`.

### 4. Mobile Header search hookup

The existing top header is hidden behind the desktop sidebar layout on mobile. Ensure the launcher's own search box is the primary discovery surface on mobile. No change to desktop.

### 5. Audit Report

After implementation, produce an in-chat report listing every desktop route from `GROUPS` + `settingsGroup` mapped to:
- Mobile visibility: ✅ Bottom nav / ✅ Launcher category / ❌ Missing
- Navigation path (e.g. "More → الذكاء → ذكاء العملاء")

Goal: 0 missing modules.

### Out of scope

- No backend / DB changes
- No desktop sidebar changes
- No new icons (reuse lucide-react already imported)
- No changes to routing or auth
