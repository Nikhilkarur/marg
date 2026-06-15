# Marg — Complete Frontend Build Prompt
> Give this entire file to Claude Opus 4.8. Also attach MARG_PLAN.md as additional context.
> Reference screenshots to attach: Uber web (web.uber.com) + Chennai One app store screenshots

---

## Your Task

Build the complete, production-quality frontend for **Marg** — a smart urban transit planner for Chennai, India. Read MARG_PLAN.md for full product context and feature specs.

**Design reference:** Copy Uber's web app layout (web.uber.com) exactly — left panel + full-height map on right. Apply Chennai One's Indian transit UI patterns for the content inside. Use Marg's custom color system below.

This is a website that works perfectly on mobile browsers too. No phone frames. No fixed-width containers. Full responsive.

---

## Tech Stack

```
React + Vite
Tailwind CSS (custom config)
shadcn/ui (all components)
lucide-react (all icons)
react-router-dom v6
Inter font (Google Fonts)
```

Install everything before starting:
```bash
npm create vite@latest marg -- --template react
cd marg
npm install
npm install react-router-dom lucide-react @radix-ui/react-slot class-variance-authority clsx tailwind-merge
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
npx shadcn-ui@latest init
npm install @radix-ui/react-toggle @radix-ui/react-dialog @radix-ui/react-avatar
```

---

## Color System

```js
// tailwind.config.js — extend these exactly
colors: {
  emerald: {
    50:  '#ECFDF5',
    100: '#D1FAE5',
    400: '#34D399',
    500: '#10B981',
    600: '#059669',
    700: '#047857',
  },
  gold: {
    100: '#FEF3C7',
    400: '#FBBF24',
    500: '#F59E0B',
    600: '#D97706',
  },
  marg: {
    bg:       '#FAFAFA',      // page background
    panel:    '#FFFFFF',      // left panel bg
    border:   '#E5E7EB',      // dividers
    text:     '#111827',      // primary text
    muted:    '#6B7280',      // secondary text
    safe:     '#10B981',      // emerald — safe routes, positive
    primary:  '#059669',      // emerald dark — buttons, links
    accent:   '#F59E0B',      // gold — safe mode ON, warnings
    danger:   '#EF4444',      // SOS, danger
    safemode: '#FFFBEB',      // warm yellow bg when safe mode ON
  }
}
```

**Safe Mode color shift:** When Women Safety Mode is ON, the left panel background shifts from `#FFFFFF` to `#FFFBEB` (warm amber). Accent color shifts from emerald to gold. This signals the mode change visually without being alarming.

---

## Layout (Copy Uber Web Exactly)

```
┌─────────────────────────────────────────────────────────┐
│  TOP NAV (full width, white, border-bottom, h-16)        │
│  [Marg logo]    [Plan] [Trips] [Profile]    [SafeMode][Avatar] │
├──────────────────────┬──────────────────────────────────┤
│                      │                                  │
│   LEFT PANEL         │         MAP (right side)         │
│   w-[420px]          │         flex-1                   │
│   fixed height       │         full viewport height     │
│   overflow-y-auto    │         sticky                   │
│   border-right       │                                  │
│                      │                                  │
│   All search,        │   Leaflet map / placeholder      │
│   results, steps     │   Route drawn here               │
│   go here            │   Crime heatmap here             │
│                      │                                  │
└──────────────────────┴──────────────────────────────────┘

Mobile (<768px): Stack vertically
- TopNav hidden, BottomNav shown instead
- Left panel = full width, normal scroll
- Map = fixed 280px height below search
- Single column all the way down
```

---

## Global Components (Build These First)

### TopNav
```
Full width, white bg, border-b border-marg-border, h-16, px-6
flex items-center justify-between

Left: Marg logo — Navigation icon (lucide, emerald-600) + "Marg" text-xl font-bold text-marg-text

Center: Three nav tabs — Plan, Trips, Profile
  Each: text-sm font-medium, active = text-emerald-600 border-b-2 border-emerald-600
  Inactive = text-marg-muted hover:text-marg-text

Right: 
  SafeMode toggle — shield icon + "Safe Mode" label + shadcn Toggle
  When ON: label turns gold-500, shield fills gold
  Avatar circle — 36px, bg-emerald-600, white initials "KN", text-sm font-semibold

Hidden on mobile (md:flex, hidden on small)
```

### BottomNav (mobile only)
```
Fixed bottom-0, full width, white bg, border-t, h-16
flex items-center justify-around
Hidden on desktop (flex md:hidden)

3 tabs: Home (MapPin), Trips (Clock), Profile (User)
Active: text-emerald-600, inactive: text-marg-muted
Each tab: icon (20px) + label text-xs below
```

### SOSButton
```
Fixed bottom-6 right-6 (above bottom nav on mobile: bottom-20)
56px circle, bg-danger, text-white, font-bold text-xs, shadow-xl
"SOS" label
When Safe Mode ON: adds pulse ring animation (ping effect, red)
Always on top (z-50)
Visible on all screens except Login and Signup
```

### SafetyBadge
```
Props: score (number)
Circle badge, 36px, font-bold text-sm
score >= 70: bg-emerald-100 text-emerald-700 (safe)  
score 40-69: bg-gold-100 text-gold-600 (moderate)
score < 40:  bg-red-100 text-red-600 (risky)
Shows the number inside
```

### LeftPanel
```
Wrapper component: w-full md:w-[420px] md:min-h-screen 
bg-marg-panel border-r border-marg-border overflow-y-auto
When safeMode ON: bg-marg-safemode
```

---

## Screen 1 — Login (/login)

No left panel / map layout. Full centered page.

```
Page: min-h-screen bg-marg-bg flex items-center justify-center

Card: bg-white rounded-2xl shadow-lg p-8 w-full max-w-md mx-4

Top of card:
  Navigation icon (emerald-600, 40px) centered
  "Marg" text-3xl font-bold text-marg-text centered
  "Your city. Your route. Your way." text-marg-muted text-sm centered
  mb-8

Form:
  Email input (full width, shadcn Input, label above)
  Password input (full width, type password, label above)
  mt-6: "Login" button (full width, bg-emerald-600 hover:bg-emerald-700, text-white, h-12, rounded-xl, font-semibold)

Bottom:
  "Don't have an account?" text-marg-muted text-sm
  "Sign up →" text-emerald-600 font-medium link
  text-center mt-4
```

---

## Screen 2 — Signup (/signup)

Same centered layout as Login.

```
Card: same as login card, slightly taller

Header: same logo + tagline

Form fields:
  Full Name input
  Email input  
  Password input

Divider: thin border-t my-6

Emergency SOS section (inside a soft amber card):
  bg-amber-50 border border-amber-200 rounded-xl p-4
  
  Top row: ShieldAlert icon (gold-500, 20px) + "Emergency SOS Contact" font-semibold text-marg-text
  Sub-text: "We'll SMS this number instantly if you tap SOS" text-sm text-marg-muted mt-1
  
  Phone input below: 
    Left addon showing "+91" (gray bg, border-r)
    Input: placeholder "98765 43210"
    Full width, shadcn Input style

"Create Account" button (same emerald style, full width, h-12)

"Already have an account? Login →" link below, centered
```

---

## Screen 3 — Home (/home)

Uber web layout — left panel + map.

```
LEFT PANEL content:

Top section (p-6):
  "Good morning, Nikhil 👋" text-2xl font-bold text-marg-text
  "The smartest route for everyone — the safest one for women." 
  text-sm text-marg-muted mt-1

Search card (mx-4 mb-4, bg-white rounded-2xl shadow-sm border border-marg-border p-4):
  FROM row:
    MapPin icon (emerald-500, 18px) + Input placeholder "Where are you?" 
    text-marg-text, border-none, focus:ring-0, text-base
  
  Divider with swap:
    Thin horizontal line
    Centered button: ArrowUpDown icon (20px, text-marg-muted)
    bg-white border border-marg-border rounded-full p-1.5
    Absolute centered on the divider line
  
  TO row:
    Navigation icon (gold-500, 18px) + Input placeholder "Where to?"

  Time row (mt-4, flex gap-2):
    "Now" chip: bg-emerald-600 text-white rounded-full px-4 py-1.5 text-sm font-medium
    "Schedule" chip: border border-marg-border text-marg-muted rounded-full px-4 py-1.5 text-sm

Mode chips row (mx-4 mb-4, grid grid-cols-4 gap-3):
  Each chip: bg-white border border-marg-border rounded-xl p-3
  flex flex-col items-center gap-1
  Icon (24px) + Label text-xs font-medium text-marg-text
  
  Bus: Bus icon, emerald-500
  Metro: Train icon, purple-500  
  Train: TrainFront icon, blue-500
  Auto: Car icon, gold-500
  
  Hover: border-emerald-500 bg-emerald-50

Women Safety Mode card (mx-4 mb-4, bg-white border border-marg-border rounded-xl p-4):
  flex items-center gap-3
  
  Left: ShieldCheck icon (32px)
    Normal mode: text-marg-muted
    Safe mode ON: text-gold-500
  
  Middle (flex-1):
    "Women Safety Mode" font-semibold text-marg-text text-sm
    "Re-routes using real crime data" text-xs text-marg-muted mt-0.5
  
  Right: shadcn Toggle / Switch
    OFF: emerald track (normal)
    ON: gold track (safe mode)
  
  When ON: entire card bg shifts to amber-50, border-amber-300

"Find Routes →" button (mx-4, full width, bg-emerald-600, text-white, h-12, rounded-xl, font-semibold text-base)

RIGHT SIDE (map area):
  flex-1, min-h-screen, bg-gray-100
  Map placeholder: full size, light gray
  Subtle grid lines pattern (CSS background-image grid)
  Center: MapPin icon (48px, emerald-200) + "Map will load here" text-marg-muted
  
  Top-right of map (absolute, m-4):
    "Crime Heatmap" pill button (bg-white shadow rounded-full px-4 py-2 text-sm font-medium)
    Flame icon + label
    Visible only when safe mode ON
```

---

## Screen 4 — Results (/results)

```
LEFT PANEL content:

Header row (p-4 border-b border-marg-border flex items-center gap-3):
  ChevronLeft button (back)
  Column: "Anna Nagar → T. Nagar" font-semibold text-marg-text
          "Departing now · 3 routes found" text-xs text-marg-muted

Sort tabs (px-4 pt-3 pb-2 flex gap-2):
  "Fastest" chip (outlined)
  "Safest" chip (filled emerald when safe mode ON, filled emerald-600 text-white)
  "Cheapest" chip (outlined)

Route cards list (px-4 pb-4 flex flex-col gap-3):

CARD 1 (Safety 82 — recommended):
  bg-white rounded-2xl border-2 border-emerald-500 shadow-sm p-4
  
  Top banner: bg-emerald-50 rounded-t-xl -mx-4 -mt-4 px-4 py-2 mb-3
    CheckCircle2 icon (emerald-600, 14px) + "Recommended — Safest Route" 
    text-xs font-semibold text-emerald-700
  
  Mode sequence row (flex items-center gap-2 mb-3):
    [Footprints icon, blue-500, 18px] → [Train icon, purple-500, 18px] → [Car icon, gold-500, 18px]
    ArrowRight icon (12px, text-marg-muted) as separator
  
  Stats row (flex items-center justify-between):
    Left: "34 min" text-2xl font-bold text-marg-text
          "₹47 total" text-sm text-marg-muted
    Right: SafetyBadge score=82
  
  Footer: "2 transfers" text-xs text-marg-muted

CARD 2 (Safety 71):
  Same structure, border border-marg-border (normal, not highlighted)
  Train→Auto, 52min, ₹35, SafetyBadge score=71
  "1 transfer"

CARD 3 (Safety 58 — warning):
  border border-marg-border
  Bus→Walk, 41min, ₹15, SafetyBadge score=58
  "1 transfer"
  Warning row at bottom (mt-2 pt-2 border-t border-marg-border):
    AlertTriangle icon (gold-500, 14px) + "Isolated walk near Vadapalani · 600m after dark"
    text-xs text-gold-600

Footer note (px-4 mt-2):
  Info icon (12px) + "Safety scores use real incident data from Safecity.in"
  text-xs text-marg-muted

Safe Mode ON state changes:
  Left panel bg → marg-safemode (#FFFBEB)
  Cards re-sorted: Card 1 still first (82), Card 2 second (71), Card 3 last (58)
  Warning tags become more prominent

RIGHT SIDE:
  Map with route drawn (blue dotted polyline like Uber)
  Route tooltip: "34 min · ₹47" floating card on map
  Start/end markers (green start, red flag end)
  When safe mode ON: red heatmap blobs visible on map

AI Chat button:
  Fixed bottom-6 right-20 (left of SOS)
  56px circle, bg-emerald-600, MessageCircle icon white
  Opens chat modal on click
```

---

## Screen 5 — Map Detail (/map)

```
LEFT PANEL content:

Header (p-4 border-b):
  ChevronLeft back button
  "Route Details" font-semibold
  SafetyBadge score=82 (right)

Route summary card (m-4 bg-emerald-50 border border-emerald-200 rounded-xl p-4):
  Grid 3 cols:
    Clock icon + "34 min" font-bold + "Total time" text-xs muted
    IndianRupee icon + "47" font-bold + "Estimated fare" text-xs muted  
    Shield icon + "82/100" font-bold text-emerald-600 + "Safety score" text-xs muted

Steps section (px-4):
  "Journey breakdown" text-sm font-semibold text-marg-muted uppercase tracking-wide mb-3

  Step 1:
    Left: circle with Footprints icon, bg-blue-100, text-blue-600
    Line connector (vertical dashed, blue-200) 
    Content: "Walk to Anna Nagar Metro Station" font-medium
             "350m · 5 min" text-sm text-marg-muted
    
  Step 2:
    Circle: Train icon, bg-purple-100, text-purple-600
    Content: "Metro · Blue Line → Koyambedu" font-medium
             "12 min · ₹20" text-sm text-marg-muted
    
  Step 3 (last, no connector):
    Circle: Car icon, bg-gold-100, text-gold-600
    Content: "Auto to T. Nagar" font-medium
             "10 min · ₹27 (est.)" text-sm text-marg-muted

"Start Journey" button (mx-4 mt-6, full width, bg-emerald-600, white, h-12, rounded-xl, font-semibold)

RIGHT SIDE: Full map with complete route drawn

```

---

## Screen 6 — Profile (/profile)

```
LEFT PANEL (full width on this screen, no map):
max-w-2xl mx-auto px-4 py-8

Avatar section (text-center mb-8):
  80px circle, bg-emerald-600, white text-2xl font-bold "KN"
  "Karur Nikhil" text-xl font-bold mt-3
  "karurnikhil2507@gmail.com" text-marg-muted text-sm

Settings card (bg-white border border-marg-border rounded-2xl overflow-hidden mb-4):
  
  Row 1: ShieldAlert icon (gold-500) | "Emergency SOS Contact" font-medium | "+91 98765 43210" text-marg-muted text-sm ml-auto | Pencil edit icon (emerald-600)
  Divider
  Row 2: ShieldCheck icon (emerald-500) | "Women Safety Mode default" font-medium | Toggle right
  Divider  
  Row 3: Globe icon | "Language" font-medium | "English" text-marg-muted ml-auto | ChevronRight

Each row: flex items-center gap-3 px-4 py-4

Recent Trips card (bg-white border border-marg-border rounded-2xl overflow-hidden mb-6):
  Header: "Recent Trips" font-semibold px-4 py-3 border-b
  
  3 trip items, each:
    flex items-center gap-3 px-4 py-3 border-b last:border-0
    MapPin icon (emerald-500, 16px)
    Column: "Anna Nagar → T. Nagar" font-medium text-sm
            "Today, 2:30 PM · Metro + Auto" text-xs text-marg-muted
    ChevronRight text-marg-muted ml-auto

"Logout" button: 
  full width, variant outline, border-danger text-danger
  hover: bg-red-50
  h-11 rounded-xl font-medium
  LogOut icon left
```

---

## AI Chat Modal

```
Trigger: MessageCircle floating button (emerald-600)

Modal: fixed bottom-0 right-6 (desktop) / full width bottom-0 (mobile)
  w-96 (desktop) / w-full (mobile)
  bg-white rounded-t-2xl (mobile) / rounded-2xl (desktop)
  shadow-2xl border border-marg-border
  h-[500px] flex flex-col

Header:
  "Marg AI" font-semibold + Sparkles icon (gold-500)
  "Ask anything about your route" text-xs text-marg-muted
  X close button right

Messages area (flex-1 overflow-y-auto p-4 flex flex-col gap-3):
  AI message (left-aligned):
    bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[80%]
    text-sm text-marg-text
    "Hi! I'm Marg AI. Ask me anything about your journey or safety on this route."
  
  User message (right-aligned):
    bg-emerald-600 text-white rounded-2xl rounded-tr-sm px-4 py-3 max-w-[80%]
    text-sm

Input row (p-3 border-t border-marg-border flex gap-2):
  Input: flex-1, rounded-xl, border border-marg-border, px-4 py-2 text-sm
  Send button: bg-emerald-600, rounded-xl, p-2, Send icon white
```

---

## SOS Confirmation Modal

```
Overlay: fixed inset-0, bg-black/60, z-50, flex items-center justify-center

Modal: bg-white rounded-2xl p-6 mx-4 max-w-sm w-full shadow-2xl

Center:
  ShieldAlert icon (56px, text-danger) centered, mb-4
  "Send SOS Alert?" text-xl font-bold text-center
  "This will immediately SMS +91 98765 43210 with your current location." 
  text-sm text-marg-muted text-center mt-2 mb-6

Buttons (flex flex-col gap-3):
  "Send SOS Now" — bg-danger text-white h-12 rounded-xl font-semibold w-full
  "Cancel" — outlined, h-12 rounded-xl w-full
```

---

## useSafeMode Hook

```js
// src/hooks/useSafeMode.js
import { createContext, useContext, useState } from 'react'

const SafeModeContext = createContext()

export function SafeModeProvider({ children }) {
  const [safeMode, setSafeMode] = useState(false)
  const toggle = () => setSafeMode(prev => !prev)
  return (
    <SafeModeContext.Provider value={{ safeMode, toggle }}>
      {children}
    </SafeModeContext.Provider>
  )
}

export const useSafeMode = () => useContext(SafeModeContext)
```

Wrap entire app in `<SafeModeProvider>` in main.jsx. When safeMode is true, left panels shift to amber bg, accent color shifts to gold, SOS button pulses.

---

## Router Setup

```jsx
// src/App.jsx
<Routes>
  <Route path="/" element={<Navigate to="/login" />} />
  <Route path="/login" element={<Login />} />
  <Route path="/signup" element={<Signup />} />
  <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
  <Route path="/results" element={<ProtectedRoute><Results /></ProtectedRoute>} />
  <Route path="/map" element={<ProtectedRoute><MapDetail /></ProtectedRoute>} />
  <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
</Routes>
```

ProtectedRoute: checks localStorage for 'marg_user' token, redirects to /login if not found.

---

## Quality Rules

- Every screen must be pixel-perfect, screenshot-worthy
- Consistent spacing: use multiples of 4px (Tailwind default)
- No lorem ipsum — use real Chennai place names (Anna Nagar, T. Nagar, Koyambedu, Tambaram, Vadapalani, Guindy, Egmore)
- Transitions: all interactive elements have transition-colors duration-150
- Hover states on every clickable element
- Focus states on all inputs (emerald ring)
- Empty states handled (no blank white boxes)
- Loading skeleton on results (shadcn Skeleton component)
- This must look like a Y Combinator-funded startup's product. Not a hackathon project.

---

## Final Instruction

Build every file completely. No TODOs, no placeholders in code, no "implement later" comments. Every component fully functional with proper props. All screens navigable via React Router. The app should run with `npm run dev` and show all screens immediately.
