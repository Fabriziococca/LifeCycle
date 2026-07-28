# LifeCycle 🧼🧔👁️🚗

> **A private, cloud-first Progressive Web App (PWA) designed for unified tracking of daily habits, personal care cycles, health controls, vehicle maintenance, tasks, and financial projects.**

LifeCycle is a showcase of full-stack architecture built to optimize personal workflows, replacing notification fatigue and easily ignored calendar reminders with an adaptive, color-coded visual dashboard and a centralized, floating **Notifications Center** with background push alerts.

---

## 🛠️ Architecture & Technology Stack

```mermaid
graph TD
    Client[Client PWA: HTML5 / CSS3 / ES6+] -->|Authenticated reads and per-key writes| Supabase{Supabase Database}
    Supabase -->|Row-Level Security / Realtime| Client
    Client -->|Runtime cache only| LS[(LocalStorage)]
    Server[Backend: Node.js Express / Render] -->|Scheduler check every 5m| Supabase
    Server -->|Web Push Protocol| Client
```

*   **Frontend Client:** HTML5, Vanilla CSS3 (custom glassmorphism style, dark-mode first design), and ES6+ JavaScript.
*   **Data Persistence:** Cloud-first architecture with **Supabase** as the source of truth. `LocalStorage` is only a runtime cache and is cleared when the session closes.
*   **Database Cloud Sync:** Authenticated per-key updates avoid replacing unrelated module data, while Realtime and foreground refreshes keep devices aligned.
*   **Backend Notification Server:** Node.js Express server hosted on **Render**, performing periodic database checks and dispatching secure Web Push Notifications.
*   **PWA Features:** Installable manifest and a Service Worker dedicated to Push notifications. The application intentionally requires connectivity and does not cache application data for offline use.

---

## 🔒 Security & Data Integrity Best Practices

*   **Zero Credentials Exposed:** All sensitive data (database connection strings, service role keys, VAPID private keys) are stored as encrypted environment variables in Render and never checked into the code.
*   **Row-Level Security (RLS):** Supabase database tables enforce strict RLS policies ensuring that users can only read and write their own data, even when utilizing public anon keys.
*   **Private Medical Attachments:** Blood-test files are stored in a private Supabase bucket, restricted to the authenticated user's folder and opened through short-lived signed URLs.
*   **Database-Level Constraints:** Implemented custom check constraints (`check_no_object_string`) at the Postgres level to reject malformed serialization attempts, safeguarding data integrity.
*   **Safe Client Parsing:** The application features robust cache parsers with isolated try/catch boundaries, ensuring that parsing anomalies in one module never disrupt the main application loop.

---

## 🚀 Key Modules

### 1. 🧼 Hygiene & Textile Tracker
Monitor time elapsed since washing or changing key home textiles (African sponges, hand towels, body towels, bed sheets, pillowcases) and schedule robotic vacuum cleaner warnings.

### 2. 🧔 Grooming & Care
Custom counters for personal care logs (beard shaves, haircuts, axillary grooming) with a predictive algorithm estimating the next optimal beard shave day based on average historical frequency.

### 3. 👁️ Contact Lenses Manager
Real-time day counters for contact lenses wear time, solutions, lens cases, Systane drops, and microfiber cloth usage, with automated low-stock safety threshold warnings.

### 4. 🚗 Vehicle Maintenance Log
Smart odometer tracking flagging services for oil changes, alignment, tire rotations, and replacements, shifting colors (green/yellow/red) based on km or days remaining.

### 5. 💼 Financial Projects (ProjectPulse)
Track active contracts in USD, manage Workana subscriptions, and display visual deadline warnings as the subscription renewal approaches.

### 6. 🩺 Health & Medicine (Salud)
Track annual/periodical visits for Dentists, Ophthalmologists, Clinical Blood Tests, and generic custom health controls.

### 7. 🔔 Centralized Notifications Panel
Float notification center displaying overdue items across all sections, permitting immediate checklist completion (`✓ Listo`) from any screen. Supports custom background push notification schedules.

### 8. ⚙️ Configurable Trackers
Manage personal trackers from the centralized **Profile → Configurable Trackers** screen, then place each one in a specific Hygiene, Care, Lenses, or Health subsection without modifying code. The compact manager lists names and counts per section and supports create, edit, reorder, archive, restore, and protected deletion. Each runtime card supports a user-defined action, an overdue interval that restarts only after a recorded action, automatic visual states, optional instructions, history, date correction, and an optional daily backend Push alert while overdue. Specialized timers, inventory, and medical attachments remain owned by their dedicated modules.

---

## ✅ Verification

```bash
npm ci
npm test
node --check server.js
```

The repository also runs these checks through GitHub Actions. Product findings are documented in [`docs/AUDITORIA_PRODUCTO_UX_2026-07-28.md`](docs/AUDITORIA_PRODUCTO_UX_2026-07-28.md), and deployment, Push, backup, Render, and Supabase verification steps are documented in [`docs/OPERACION_Y_VERIFICACION.md`](docs/OPERACION_Y_VERIFICACION.md).
