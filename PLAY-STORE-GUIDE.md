# Google Play Store Publishing & Compliance Guide — SteadyHands

**App Name:** SteadyHands: Fidget & Calm (`26 / 30 chars`)  
**Package ID:** `com.phantasticvanguard.fidget`  
**Publisher:** Phantastic.Vanguard LLC  
**Target SDK:** Android 15 / 16 (API 35 / 36 compliant, edge-to-edge enabled)

---

## 1. Ready-to-Paste Store Listing Copy

### App Title (<= 30 characters)
```text
SteadyHands: Fidget & Calm
```
*(26 characters)*

### Short Description (<= 80 characters)
```text
Sensory-safe fidgets, 3-min smoking urge timer & offline brown noise for focus.
```
*(79 characters)*

### Full Description (<= 4000 characters)
```text
SteadyHands is a sensory-safe, 100% offline tactile fidget studio designed for three everyday needs: neurodivergent & autism sensory self-regulation, riding out 3-minute smoking or nicotine cravings, and keeping restless hands focused during study, work, or meetings.

Every click, silicone pop, detent tick, worry-stone hum, and breathing chime is synthesized mathematically on your device in real time — with zero ads, zero pop-ups, zero accounts, and zero data collection.

🌿 SENSORY-SAFE & AUTISM-FRIENDLY DESIGN
• Low-Stimulation Mode: One tap softens screen contrast, dampens visual trails, and routes all audio through a warm 820Hz low-pass filter so sounds never startle or overwhelm.
• Predictable Acoustics: Toggle between musical pitch-scaled bubbles or uniform, repeatable pitch across the board.
• 4 Curated Palettes: Deep Ocean, Sage Calm, Warm Sand, and High-Contrast Dark.

🔥 3-MINUTE CRAVING & URGE SURFING (FOR SMOKERS QUITTING OR CUTTING BACK)
• Persistent 3:00 Urge Timer: Nicotine cravings typically peak and pass within 3 minutes. Start the 3:00 Urge Wave countdown in the top bar while keeping your fingers busy on any fidget toy.
• Deep-Draw 4-2-6 Breath Pacer: Designed to replace the hand-to-mouth rhythm and deep inhalation pause of a smoke break (4s deep draw in, 2s steady hold, 6s slow calming release), plus Box Breathing (4-4-4-4) and 4-7-8 Calm.
• Interactive Hold-to-Draw Orb: Press and hold the breathing orb to draw in with gentle haptic feedback, and release to exhale slowly.

🎯 BUSY-HANDS FOCUS & STUDY COMPANION
• Offline Ambient Soundscapes: Toggle synthesized Warm Brown Noise, Soft Rain Hum, or a 40Hz Focus Drone that plays smoothly in the background while you fidget.
• Focus Session Timer: Built-in 5, 15, and 25-minute focus timers right in the top bar.
• Quiet Classroom & Meeting Controls: Dedicated silent soft-thud buttons on the Fidget Cube and Silent Linear Red switches on the keyboard pad.

🎛️ 6 TACTILE FIDGET TOYS IN ONE POCKET STUDIO
1. Pop It (6x6 Silicone Grid): Drag your finger across bubbles to multi-pop, switch between Classic Flip, Endless Auto-Reset, and Row Chords, or trigger a Domino Wave.
2. 5-in-1 Fidget Cube: Heavy mechanical rocker switch with LED, 5-button dice pad (3 crisp clicky + 2 silent thud buttons), 24-detent rotary click wheel, spring-loaded analog thumbstick with L3 click, and a smooth Sensory Worry Stone that purrs when rubbed.
3. Breathe & Urge Pacer: Guided and touch-hold breathing rings with on-device Urges Surfed and Breath Cycle counters.
4. Physics Fidget Spinner: Flick-to-spin angular physics with Tri-Wing Tungsten, Hex Brass, and Gyro Ring designs plus Ceramic, Steel, and Detent Clicker bearings.
5. Zen Pad: Multi-touch Magnetic Putty swarm, Calming Water Ripples, and a 3-prong Japanese Zen Kinetic Sand rake.
6. Mechanical Keys: 12 sculpted keycaps with authentic downstroke and upstroke acoustics across Creamy Thock, Clicky Blue, Tactile Brown, and Silent Red switches.

🔒 100% ON-DEVICE PRIVACY
• Works completely offline after install.
• Collects zero personal data, zero location data, and zero device identifiers.
• Contains zero ads and zero third-party analytics SDKs.

⚕️ WELLNESS DISCLAIMER
SteadyHands is a non-medical self-regulation, focus, and habit-distraction companion tool. It is not a medical device or clinical smoking cessation treatment and does not provide medical advice, diagnosis, or cure.
```

---

## 2. Google Play Console Declarations (App Content Tab)

Because SteadyHands supports **autism sensory regulation**, **smoking craving distraction**, and **focus**, Google Play Console requires specific answers in the **App Content** section so the app is approved smoothly without triggering Medical Device or Families Policy rejections:

### A. Privacy Policy URL
- **URL (once published to GitHub Pages):** `https://phantasticinc.github.io/steady-hands/privacy.html`
- Also accessible inside the app via the top-bar **🛡️** button.

### B. Data Safety Form
- **Does your app collect or share any of the required user data types?** → **No**
- *(All preferences and counters are stored strictly locally in `localStorage` on the user's device and never transmitted).*

### C. Health Apps Declaration
- In **App content -> Health apps**, select:
  - ✅ **"Stress management, relaxation, or mental wellness"** (Non-medical relaxation, breathing, and sensory self-regulation tool).
  - ❌ Do **NOT** select "Medical device", "Clinical decision support", or "Disease diagnosis/treatment".
- Both the in-app `🛡️` sheet and `privacy.html` contain the required non-medical wellness disclaimer.

### D. Target Audience and Content (Important for Smoking Urge Timer)
- **Target Age Groups:** Select **13–15, 16–17, and 18 and over**.
- **Do NOT select Under 13 / "Designed for Families":** Google Play's Families Policy prohibits apps targeted at children under 13 from mentioning tobacco or nicotine, even for positive quitting/craving-relief timers. Selecting **13+** avoids Families Policy flags while keeping the **Everyone** IARC rating.

### E. Ads & App Access
- **Ads:** No, my app does not contain ads.
- **App Access:** All functionality is available without special access (no login required).
- **Government / Financial Features:** None.

---

## 3. Store Graphic Assets (Generated in `store-assets/`)

All required graphics are pre-rendered in `/workspace/steady-hands/store-assets/`:
- `icon-512.png` — 512×512 24-bit PNG Play Store High-Res Icon
- `icon-maskable-512.png` — 512×512 Maskable Adaptive Icon
- `feature-graphic-1024x500.png` — 1024×500 24-bit RGB PNG (no alpha channel)
- `screenshot-1-popit.png` — 1080×1920 Phone Screenshot (Pop It + 3:00 Urge Wave Banner)
- `screenshot-2-cube.png` — 1080×1920 Phone Screenshot (5-in-1 Tactile Fidget Cube & Worry Stone)
- `screenshot-3-breathe.png` — 1080×1920 Phone Screenshot (Deep Draw 4-2-6 Smoking Craving Pacer)
- `screenshot-4-spinner.png` — 1080×1920 Phone Screenshot (Physics Fidget Spinner)
- `screenshot-5-zen.png` — 1080×1920 Phone Screenshot (Zen Pad Magnetic Putty & Sand Rake)
- `screenshot-6-keys.png` — 1080×1920 Phone Screenshot (12-Key Mechanical Switch Tester)

---

## 4. Publishing to GitHub Pages & Building the Signed `.aab`

### Step 1: Publish to GitHub Pages (after user approval)
```bash
cd /workspace/steady-hands
git init
git add .
git commit -m "Initial release of SteadyHands Fidget & Craving Relief PWA"
gh repo create Phantasticinc/steady-hands --public --source=. --push
gh api -X POST repos/Phantasticinc/steady-hands/pages -f build_type=legacy -f 'source[branch]=main' -f 'source[path]=/'
```

### Step 2: Generate `.aab` with Bubblewrap CLI (or PWABuilder.com)
```bash
npx @bubblewrap/cli build
```
- Uses `/workspace/steady-hands/twa-manifest.json` (`com.phantasticvanguard.fidget`, `targetSdkVersion: 36`).
- Produces `app-release-bundle.aab` for Google Play Console upload.

### Step 3: Paste Play App Signing SHA-256 into `.well-known/assetlinks.json`
After uploading the `.aab` to Google Play Console, copy the **SHA-256 certificate fingerprint** from **Setup -> App signing** in Play Console, paste it into `/workspace/steady-hands/.well-known/assetlinks.json`, and push to `main`. Because `.nojekyll` is included in the root, GitHub Pages serves `https://phantasticinc.github.io/steady-hands/.well-known/assetlinks.json` directly so the fullscreen Trusted Web Activity verifies with zero URL bar.
