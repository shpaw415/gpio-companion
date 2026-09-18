# newUI spec — B6 Split Deck (from `reference-b6.html`)

## 1. Layout anatomy (desktop ≥1100px)

```
┌ topbar 42px: ◈ brand · B6 chip · ⌘K bar (max 520px, centered) · Easy/Expert seg
├ mid (flex-1, min-height 0)
│ ├ rail 58px: 4 labeled buttons 46px (📁 Work · 🧠 Fleet · 💻 T3 · 👤 You)
│ ├ sidebar 225px: context trees, scrolls independently
│ ├ main column
│ │ ├ split (flex-1): col ◧ + col ◨, each own scroll; focused col has 2px accent bar
│ │ └ dock: resizable console panel (default 150px, clamp 64–480)
│ └ inspector 230px: contextual card stack, own scroll
└ statusbar 28px mono: ● LIVE · context label · (expert: signed 12ms · model) · right hints
```

Theme: near-black operator (`--bg #090b10`, accent `#00d4ff → #a78bfa`), mono
accents for IDs/paths/status, 8px radii, 1px hairlines.

## 2. Behaviors

- **Rail**: switches pane; `aria-pressed` on active; labels always visible.
- **Sidebar**: per-pane trees (see §3); click selects + renders stage; selection
  ring = 2px accent inset bar.
- **Split focus**: click a column or `⌘1`/`⌘2` moves the accent bar.
- **Dock**: tabs CONSOLE ⏺ / GPIO / FLASH (+ PROBLEMS · 1 in Expert). Grip on the
  dock's top edge: drag vertically to resize, persist px in localStorage
  (`b6-dockH`), double-click resets to 150px. Touch pointer events.
- **Palette**: `⌘K`/`Ctrl-K` or click bar; overlay top-14vh, 560px card; live
  substring filter over name+hint; Enter runs hottest match; Esc closes.
  Commands = `Go:` navigation + board actions (Run/Flash/Verify/Save/Buy).
- **Board selection**: shared across Work/Fleet/T3/Docs (mock var `board` →
  real `gpio-companion-selected-board` + legacy T3 key).
- **Easy/Expert**: seg toggle; `.expert-only` blocks (UUID/URL, T3 pair, raw
  keys, Problems tab, honest-unknown notes) hidden in Easy.
- **Toasts**: bottom-center pill confirms every mock action (real app: keep for
  fire-and-forget actions, use inline errors for failures via `useActionError`).

## 3. Pages (pane → sidebar → stage)

**Work**: repos (line-follower/feat-ir · weather-station/main · blink-lab/main)
+ files of selected repo + New project. Stage: ◧ file viewer (C/ino with
highlight, json/svg viewers for diagram/circuit) with Run/Flash/Verify/Save/
Stop; ◨ live card (IR/err/PWM, console ⏺ chip, breadboard viewer + continuity
overlay) + expert branch note.

**Fleet**: boards (bench-pi live · rover offline · lab-pi pending) + device
pages Overview/Pair/WiFi/Docs/Debug/Requests.
- Overview: ◧ full board card (label/model/chips, expert UUID+URL, companion
  info; Open Code primary, Flash-proxy, T3-pair, GPIO, Unpair-danger); ◨ fleet
  column, selected outlined.
- Pair: claim form (UUID/key/Device URL) + how-it-works (BLE → claim → T3 QR).
- WiFi: SSID/PSK push via BLE + copy-envelope (iOS note) + link card
  (rssi/mtu).
- Docs: search input + doc list filtered live + reader (5 docs; FR note).
- Debug: redacted 24h log excerpt + Start update / disk snapshot + disk card.
- Requests: pending transfer card (Accept primary / Reject danger) + policy.

**T3**: sessions (IR tuning active · PCB review · console watch). Stage: ◧
keep-alive view (never unmount) + Open Code / new-tab; ◨ session list.

**You**: Account / Credits / Keys & tunnels.
- Account: GitHub ✓, locale EN/FR switch, theme follows-system, Sign out.
- Credits: $12.40 balance, list×1.25 + 402-empty + PayPal-capture notes,
  $5/$10/$25/$50 buttons; usage table (model/tokens/cost).
- Keys: GitHub PAT state, expert Ed25519, tunnel hostnames; Push-to-Pi +
  Rotate; policy card (public key endpoint, private never committed).

## 4. Breakpoints

- ≤1100px: split stacks vertically (viewer above live); inspector hides
  (surface its primary action in the stage).
- ≤900px: sidebar narrows to 190px.
- ≤640px (phones): topbar = ☰ + ◈ + "gpio" + 🔍 + Easy/Expert (42–48px,
  safe-area top); sidebar = slide-over drawer (`min(260px,78vw)`, backdrop,
  auto-close on select); split stacked; dock min 64px; palette full-width;
  BottomNavigation (existing) stays the primary nav.
