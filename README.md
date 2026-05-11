# FinanceOS 💰
> Personal Finance Dashboard — Bento Grid + Glassmorphism  
> Stack: HTML5 · Vanilla JS (ES Modules) · CSS3 · Firebase · Chart.js · Lucide Icons  
> Deploy: **GitHub Pages** (zero build step required)

---

## Project Structure

```
financeos/
├── index.html              ← single entry point
├── firestore.rules         ← security rules (deploy to Firebase)
├── css/
│   └── style.css           ← all styles
└── js/
    ├── firebase-config.js  ← 🔑 fill in your credentials here
    ├── auth.js             ← Firebase Auth helpers
    ├── db.js               ← Firestore CRUD layer
    ├── state.js            ← reactive state manager
    ├── categories.js       ← category definitions
    ├── charts.js           ← Chart.js donut + liquidity line
    ├── ui.js               ← DOM rendering helpers
    ├── modal.js            ← modal open/close + form wiring
    └── app.js              ← main orchestrator (entry point)
```

---

## Setup (5 minutes)

### 1 · Create a Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. **Add project** → give it a name → disable Google Analytics if you prefer
3. **Build → Authentication → Get started → Email/Password → Enable**
4. **Build → Firestore Database → Create database → Start in production mode**
   - Pick a region close to you (e.g. `southamerica-east1` for Brazil)

### 2 · Get your SDK credentials

Firebase Console → **Project Settings** (gear icon) → **General** → scroll to "Your apps" → **Web app** → copy the `firebaseConfig` object.

### 3 · Paste credentials into `js/firebase-config.js`

```js
const firebaseConfig = {
  apiKey:            "AIza...",
  authDomain:        "my-project.firebaseapp.com",
  projectId:         "my-project",
  storageBucket:     "my-project.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123...",
};
```

### 4 · Deploy Firestore security rules

Option A — Firebase CLI (recommended):
```bash
npm install -g firebase-tools
firebase login
firebase init firestore   # select your project
firebase deploy --only firestore:rules
```

Option B — Firebase Console:  
**Firestore → Rules** tab → paste the contents of `firestore.rules` → **Publish**.

### 5 · Deploy to GitHub Pages

```bash
# Push to GitHub
git init && git add . && git commit -m "init"
git remote add origin https://github.com/YOUR_USERNAME/financeos.git
git push -u origin main

# Enable Pages: GitHub repo → Settings → Pages → Source: main branch → / (root)
```

Your app will be live at `https://YOUR_USERNAME.github.io/financeos/`

> **Important:** Add your GitHub Pages domain to Firebase Auth's authorised domains:  
> Firebase Console → Authentication → Settings → Authorised domains → Add domain

---

## Features

| Feature | Details |
|---|---|
| 🔐 Auth | Email/Password via Firebase Auth |
| 🗓 Month navigation | Scoped by month/year; data reloads on change |
| 📋 Fixed Bills | Stored as templates; auto-instantiated per month |
| ✅ Mark as paid | Toggle per bill; visual dimming on paid |
| ➕ Add transaction | FAB → modal; supports Fixed/Variable/Income |
| 🍩 Donut chart | Fixed vs Variable split (Chart.js) |
| 〰 Liquidity chart | Day-by-day running balance with pay-day spikes |
| 👁 Hide amounts | Toggle to mask all monetary values |
| 🔔 Toast feedback | Lightweight notifications for every action |
| 📱 Mobile-first | Responsive down to 320 px |
| 🔒 RLS | Firestore rules: users see only their own data |

---

## Local Development

No build step needed — just open with any static server:

```bash
# Python
python3 -m http.server 5500

# Node
npx serve .

# VS Code
# Install "Live Server" extension → right-click index.html → Open with Live Server
```

Then open `http://localhost:5500`.

---

## Firestore Indexes

If you see a "requires an index" error in the console, Firestore will provide a direct link to create it automatically. The query that needs it:

```
Collection: users/{uid}/transactions
Fields:     month ASC, year ASC, createdAt ASC
```

---

## Customisation

- **Add a new category**: edit `js/categories.js` and add an entry to `VARIABLE_CATS` or `INCOME_CATS`.
- **Change colors**: edit CSS variables in `css/style.css` (`:root` block).
- **Extend the schema**: update `db.js → addTransaction()` payload and `ui.js` render functions.

---

## License

MIT — feel free to use, fork, and adapt.
