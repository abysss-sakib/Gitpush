<<<<<<< HEAD
# Sa Kib — Personal Portfolio

A cinematic black-and-white personal portfolio website built with React + Vite + Tailwind CSS. Features letter-by-letter name animation, typing animation, parallax cover, scroll reveal effects, and a clean monochrome anime aesthetic.

---

## File Structure

```
sakib-portfolio/
├── public/
│   ├── dp.jpg          ← Your profile picture
│   └── cover.jpeg      ← Your cover/background image
├── src/
│   ├── components/
│   │   ├── Navbar.tsx          ← Top navigation bar
│   │   ├── TypingAnimation.tsx ← "I am a Developer..." cycling text
│   │   ├── ScrollReveal.tsx    ← Scroll-triggered animations
│   │   └── SocialLinks.tsx     ← Social media icons section
│   ├── pages/
│   │   └── Home.tsx    ← Main page (all sections live here)
│   ├── App.tsx         ← Root app component
│   ├── main.tsx        ← Entry point
│   └── index.css       ← Global styles, fonts, keyframes
├── index.html          ← HTML shell
├── package.json        ← Dependencies
├── vite.config.ts      ← Vite configuration
├── vercel.json         ← Vercel routing config
└── tsconfig.json       ← TypeScript config
```

---

## How to Run Locally

```bash
# 1. Install dependencies
npm install

# 2. Start development server
npm run dev

# 3. Open in browser
# http://localhost:5173
```

---

## How to Deploy on Vercel

### Option A — Vercel Dashboard (easiest)
1. Go to [vercel.com](https://vercel.com) and sign up/log in
2. Click **"Add New Project"**
3. Click **"Upload"** and drag-drop this zip file
4. Leave all settings as default
5. Click **"Deploy"** — done!

### Option B — Vercel CLI
```bash
npm install -g vercel
vercel
```

---

## Customization Guide (A to Z)

---

### 1. Change Your Name

Open `src/pages/Home.tsx`, find this line near the top:

```tsx
const NAME_LETTERS = ["S", "A", " ", "K", "I", "B"];
```

Change the letters to spell your name. Each letter is separate. Use `" "` for a space.

**Example** — for "MD RIFAT":
```tsx
const NAME_LETTERS = ["M", "D", " ", "R", "I", "F", "A", "T"];
```

Also update the `aria-label`:
```tsx
aria-label="MD RIFAT"
```

---

### 2. Change Profile Picture (dp)

1. Replace the file `public/dp.jpg` with your own photo
2. Keep the filename as `dp.jpg` — or update the `src` in `Home.tsx`:

```tsx
<img src="/dp.jpg" alt="Sa Kib" .../>
```

Change `/dp.jpg` to your filename, e.g. `/myphoto.png`

> Tip: For best results, use a square image (e.g. 400x400px)

---

### 3. Change Cover/Background Image

1. Replace `public/cover.jpeg` with your image
2. Or update the src in `Home.tsx`:

```tsx
<img src="/cover.jpeg" alt="" .../>
```

---

### 4. Change the Typing Animation Words

In `src/pages/Home.tsx`, find:

```tsx
<TypingAnimation words={["Developer", "Gamer", "Anime Lover", "Creator", "Builder"]} />
```

Edit the list to whatever you want:
```tsx
<TypingAnimation words={["Student", "Gamer", "Dreamer", "Coder"]} />
```

---

### 5. Change Location

Find in `Home.tsx`:
```tsx
<p className="font-mono text-[12px] ...">
  DHAKA, BANGLADESH
</p>
<p className="font-mono text-[11px] ...">
  STUDENT · CODE EXPLORER · MOBILE BUILDER
</p>
```

Replace with your city/country and tagline.

---

### 6. Change the About Me Text

In `Home.tsx`, find the About section (`{/* ── ABOUT ── */}`).

The body text is inside the big `<div>` with `font-sans`. Edit the text between the `<span>` tags freely.

**Highlighted words** (glowing/underlined) are wrapped in `<span>` with special styles:

```tsx
// Glowing highlight (name style):
<span className="text-white font-semibold" style={{ textShadow: "0 0 30px rgba(255,255,255,0.55)" }}>
  YourWord
</span>

// Underline highlight:
<span className="text-white font-medium" style={{ borderBottom: "1px solid rgba(255,255,255,0.25)", paddingBottom: "2px" }}>
  YourWord
</span>
```

---

### 7. Change the Status Line

Find in `Home.tsx`:
```tsx
<p className="font-mono text-sm text-white/75 tracking-wider">
  Building things from mobile &nbsp;—&nbsp; Dhaka, Bangladesh
</p>
```

Replace with your current status.

---

### 8. Change Interests / Skills

Find the skills array in `Home.tsx`:
```tsx
{ label: "Web Development", num: "01" },
{ label: "Learning New Things", num: "02" },
{ label: "Gaming", num: "03" },
{ label: "Watching Anime", num: "04" },
```

Edit `label` values freely. Add more items by copying a line.

---

### 9. Change Social Media Links

Open `src/components/SocialLinks.tsx`:

```tsx
const socials = [
  {
    icon: SiFacebook,
    href: "https://www.facebook.com/YOUR_USERNAME",
    label: "Facebook",
  },
  {
    icon: SiInstagram,
    href: "https://www.instagram.com/YOUR_USERNAME",
    label: "Instagram",
  },
  {
    icon: SiGithub,
    href: "https://github.com/YOUR_USERNAME",
    label: "GitHub",
  },
];
```

Replace the `href` URLs with your own profile links.

**To add a new social** (e.g. YouTube), import the icon and add it:
```tsx
import { SiFacebook, SiInstagram, SiGithub, SiYoutube } from "react-icons/si";

// Add to socials array:
{ icon: SiYoutube, href: "https://youtube.com/@YOUR_CHANNEL", label: "YouTube" }
```

Available icons: `SiFacebook`, `SiInstagram`, `SiGithub`, `SiYoutube`, `SiDiscord`, `SiX`, `SiTiktok`, `SiTwitch`, `SiTelegram`

---

### 10. Change Navigation Links

Open `src/components/Navbar.tsx`:

```tsx
{ label: "HOME", id: "hero" },
{ label: "ABOUT", id: "about" },
{ label: "SKILLS", id: "skills" },
{ label: "SOCIAL", id: "social" },
```

- `label` — what the user sees
- `id` — must match the `id` of the matching `<section>` in `Home.tsx`

---

### 11. Change Fonts

Open `src/index.css`. The first line imports Google Fonts:

```css
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=Inter:wght@300;400;500;600&family=Space+Mono:wght@400;700&display=swap');
```

And further down:
```css
--app-font-sans: 'Inter', sans-serif;       /* body text */
--app-font-serif: 'Playfair Display', serif; /* headings */
--app-font-mono: 'Space Mono', monospace;    /* labels/nav */
```

Replace font names with any Google Font. Browse at [fonts.google.com](https://fonts.google.com).

---

### 12. Change Background Color

In `src/pages/Home.tsx`:
```tsx
<div className="min-h-screen bg-[#080808] ...">
```

Change `#080808` to any hex color. Default is near-black.

Also in `src/index.css`:
```css
--background: 0 0% 3%;
```

---

### 13. Change Text Brightness

All text uses `text-white/XX` where XX is the opacity (0-100).

- `text-white/100` = fully white (brightest)
- `text-white/50` = 50% visible
- `text-white/20` = very faint

Increase the number to make text brighter. Decrease to make it fainter.

---

### 14. Change Animation Timing

**Page load animation** — in `Home.tsx`:
```tsx
const t1 = setTimeout(() => setPhase(1), 100);   // cover fades in
const t2 = setTimeout(() => setPhase(2), 600);   // name appears
const t3 = setTimeout(() => setPhase(3), 1100);  // typing starts
const t4 = setTimeout(() => setPhase(4), 1600);  // location shows
```

Increase numbers to slow down, decrease to speed up (in milliseconds).

**Scroll reveal speed** — in `src/components/ScrollReveal.tsx`:
```tsx
transition: `opacity 0.75s ease ...`
```

Change `0.75s` to control how fast elements appear on scroll.

**Typing speed** — in `src/components/TypingAnimation.tsx`:
```tsx
const typeSpeed = isDeleting ? 45 : 90;  // ms per character
// pause after full word:
}, 2200);
```

- Lower `90` → types faster
- Higher `2200` → waits longer before deleting

---

### 15. Change Page Title / SEO

Open `index.html`:
```html
<title>Sa Kib | Portfolio</title>
<meta name="description" content="Sa Kib — Student, Code Explorer..." />
```

Replace with your name and description.

---

### 16. Add a New Section

1. Add a new `<section id="mysection">` block in `Home.tsx`
2. Add a nav link in `Navbar.tsx`:
```tsx
{ label: "PROJECTS", id: "mysection" },
```
3. Wrap content in `<ScrollReveal>` for animation

---

## Dependencies Used

| Package | Purpose |
|---|---|
| `react` + `react-dom` | UI framework |
| `react-icons` | Social media icons (SiFacebook, etc.) |
| `tailwindcss` | Utility-first CSS |
| `vite` | Build tool / dev server |
| `typescript` | Type safety |

---

## Common Issues

**Images not showing?**
- Make sure `dp.jpg` and `cover.jpeg` are inside the `public/` folder
- File names are case-sensitive

**Fonts not loading?**
- Check your internet connection — fonts load from Google Fonts
- The `@import url(...)` must be the very first line in `index.css`

**Build errors?**
- Run `npm install` first
- Make sure you haven't deleted any import at the top of the files

---

Made with focus, intention, and a touch of madness.
=======
# sakib-portfolio
>>>>>>> c7ec004571f3eb1945aecf9e657db93432d56f0b
