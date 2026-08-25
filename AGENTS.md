# Agent Guidelines & Anti-Slop Frontend Rules

These rules apply across this workspace for all frontend, UI/UX, styling, and design tasks.

## 1. Active Skills Reference
The workspace is equipped with the full suite of **Taste Skills** located in `.agents/skills/`:
* `design-taste-frontend` (`.agents/skills/taste-skill/SKILL.md`) - Master anti-slop frontend engineering.
* `output-skill` (`.agents/skills/output-skill/SKILL.md`) - Full output enforcement, no placeholders or abbreviations.
* `gpt-taste` (`.agents/skills/gpt-tasteskill/SKILL.md`) - GSAP physics and motion engineering.
* `stitch-design-taste` (`.agents/skills/stitch-skill/SKILL.md`) - Semantic design system definition (`DESIGN.md`).
* `image-to-code-skill` (`.agents/skills/image-to-code-skill/SKILL.md`) & `brandkit` - High-fidelity asset and mockup generation.
* Specialized aesthetics: `minimalist-skill`, `brutalist-skill`, `soft-skill`, `redesign-skill`.

---

## 2. Core Anti-Slop Directives

### A. Layout & Composition
* **Anti-Center Bias:** Do not default to centered hero sections with 3 identical cards below. Use split screens (50/50), asymmetric grids, or scroll-driven layouts.
* **Layout Diversity:** No two consecutive sections may use the exact same layout family. Vary column counts, visual weights, and content densities.
* **No "Card-in-Card" Nesting:** Do not wrap every element in rounded border boxes. Rely on whitespace, hairline rules (`divide-y`, `border-t`), and typographic contrast.
* **Bento Grid Discipline:** Ensure bento tiles have visual variety (photography, tinted cards, bold stats) rather than identical text containers.

### B. Color & Typography
* **The Lila / Neon Glow Ban:** Never default to purple/indigo button glows, dark gradient mesh backgrounds, or AI-style neon accents.
* **1-Accent Rule:** Use calibrated, neutral foundations (Zinc, Slate, Stone) with at most **one** high-contrast accent color (saturation < 80%).
* **Consistent Radii & Spacing:** Lock to a single corner radius scale across the entire page (e.g. all-soft `rounded-xl` or all-sharp `rounded-none`).
* **Typography:** Avoid generic `Inter` or forced decorative serifs. Default to modern sans display (`Geist`, `Satoshi`, `Cabinet Grotesk`) paired with a clean monospace.

### C. Visual Assets & Copy
* **No Div-Based Fake Screenshots:** Never build fake product previews or mock dashboards out of styled `<div>` boxes. Use real component rendering, image tools, or authentic photography.
* **Human Copywriting:** Avoid AI buzzwords (*"Unleash the power"*, *"Next-gen solution"*). State concrete features, user benefits, and clear functional steps.
* **Exhaustive Code Delivery:** Always output complete, runnable code files. Never insert placeholders such as `// ... rest of code`.
