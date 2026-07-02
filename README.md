# LifeCycle 🧼🧔👁️🚗

> **Unified PWA for Personal Hygiene, Grooming, Health Tracking, and Vehicle Maintenance.**

LifeCycle is an offline-first Progressive Web App (PWA) designed to automate, monitor, and manage the life cycles of daily habits, personal care schedules, vehicle maintenance logs, contact lenses usage, financial projects, and medical visits. 

It replaces standard notification fatigue and easily ignored calendar reminders with an adaptive, color-coded visual dashboard and a centralized, floating **Notifications Center**.

---

## 🚀 Key Modules & Features

### 1. 🧼 Hygiene & Home Textiles (Higiene)
*   **Washing Cycles:** Track time elapsed since washing or changing key items (African sponges, hand towels, body towels, bed sheets, pillowcases, and toothbrush replacements).
*   **Interactive History Logs:** Keep up to 10 entries of previous washes/replacements, with the ability to delete entries.
*   **Robot Vacuum Cleaner:** Log and track custom cleaning warnings for robotic vacuum sweepers.

### 2. 🧔 Grooming & Care (Cuidado)
*   **Body & Hair Care:** Custom counters for Beard Shaving, Haircuts, Axillary Grooming, and Gillette Blade usage.
*   **Shaving Prediction:** Smart algorithm predicting the next optimal beard shave day based on average interval logs.
*   **History Logs:** Delete and manage individual logs to clean up mistaken entries.

### 3. 👁️ Contact Lenses Manager (Lentes)
*   **Usage Timer & Stock:** Real-time day counter for lens wear time, solution, lens case, Systane drops, and microfiber cloth wash/change cycles.
*   **Stock alerts:** Triggers low-stock warnings when contact lenses pairs fall below a safety threshold.

### 4. 🚗 Vehicle Maintenance (Vehículo)
*   **Smart Odometer tracking:** Automatically tracks and flags services for Oil & Filters, Alignment & Balancing, Tire Rotation, and Tire Replacements.
*   **Status Alert:** Shifts card colors (Green/Yellow/Red) based on km or days remaining.

### 5. 💼 Financial Projects Tracker (ProjectPulse)
*   **Workana Client & Subscriptions:** Track financial progress (active contracts in USD) and manage Workana subscription plans.
*   **Visual Deadline Alert:** Color-coded warnings as the subscription renewal deadline approaches.

### 6. 🩺 Health & Medicine (Salud)
*   Track annual/periodical visits for Dentists, Ophthalmologists, Clinical Blood Tests, and generic custom health controls.

### 7. 🔔 Notifications & Alerts (Alertas)
*   **Push Notifications:** Configure exact times and recurring days for system alerts.
*   **Centralized Panel:** Active notification controls for all sections.
*   **Floating Notifications Center:** A quick-action bell icon dropdown showing overdue (red) items across all sections, allowing immediate checklist completion (`✓ Listo`) from any screen.

---

## 🛠️ Architecture & Tech Stack

*   **Frontend:** HTML5, Vanilla CSS3 (custom glassmorphism style, dark-mode first design), and ES6+ JavaScript.
*   **Data Persistence:** Offline-first architecture utilizing LocalStorage.
*   **Cloud Sync:** Bidirectional real-time database sync with **Supabase**, featuring conflict resolution and automatic merge.
*   **Backend Server:** Node.js Express server hosted on **Render**, performing catch-up checks every 5 minutes and dispatching Web Push Notifications.
*   **PWA Assets:** Service Workers (caching assets & offline capabilities) and standard web manifest file.

---

## 📦 Local Installation & Running

Ensure you have [Node.js](https://nodejs.org/) installed:

1. Clone the repository:
   ```bash
   git clone https://github.com/Fabriziococca/HygieneTracker.git
   cd HygieneTracker
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the backend server:
   ```bash
   node server.js
   ```
4. Access the client PWA by opening `index.html` in your browser.
