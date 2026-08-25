---
name: frontend-qa-audit
description: Comprehensive pre-flight QA and anti-slop audit for web and mobile frontend interfaces. Use after building or refactoring UI components to verify responsiveness, WCAG AA contrast, layout diversity, and eliminate AI artifacts before delivery.
---

# Frontend Pre-Flight QA & Anti-Slop Audit

Execute this audit on every generated or modified frontend component before marking a design task complete.

---

## 1. Contrast & Accessibility Audit (WCAG AA)
- [ ] **CTA Buttons:** Text has $\ge 4.5:1$ contrast against the button fill. No white text on light buttons or ghost buttons without readable borders/scrims.
- [ ] **Form Inputs:** Labels, placeholder text, focus rings, and validation errors are easily legible against background tiles.
- [ ] **Body Copy:** Paragraphs have adequate contrast (minimum `text-zinc-600` / `text-slate-600` on light mode; `text-zinc-400` on dark mode).

---

## 2. Layout & Viewport Geometry
- [ ] **Viewport Height:** Full-height sections use `min-h-[100dvh]` instead of `h-screen` (prevents mobile Safari address bar jumping).
- [ ] **Hero Section Density:** Hero headline $\le 2$ lines on desktop. Subtext $\le 20$ words. Primary CTAs visible without scrolling.
- [ ] **Button Wrapping:** All button text fits on a single line at desktop (no wrapped CTA labels).
- [ ] **Navigation Bar:** Fixed height ($64\text{px} - 72\text{px}$), fits on a single horizontal row at `lg` breakpoint ($1024\text{px}$).
- [ ] **Mobile Breakpoints:** Explicit `< 768px` fallbacks for all multi-column CSS grids (`grid-cols-1 md:grid-cols-3`).

---

## 3. Anti-Slop & Taste Verification
- [ ] **1-Accent Rule:** Only ONE deliberate accent color used consistently across every section.
- [ ] **No Lila / Generic Glows:** No purple radial gradient blobs, ambient dark-mode neon glows, or gratuitous glassmorphism.
- [ ] **Section Variety:** No two consecutive sections use the same layout pattern (e.g. alternating left-image/right-text zigzag cap $\le 2$).
- [ ] **Authentic Assets:** No fake div-based screenshot boxes. Real photography, SVG icons, or actual component previews used.
- [ ] **Icon Consistency:** Exactly ONE icon family used across the page (Phosphor, Radix, or HugeIcons). Hand-rolled SVGs only for brand monograms.

---

## 4. Copy & Content Polish
- [ ] **Zero AI Buzzwords:** Replaced generic marketing fluff ("Unleash the next-gen power") with factual, functional benefits.
- [ ] **No Placeholder Truncation:** Entire code delivered with complete implementations, zero `// ... TODO` or `// ... rest of code`.
