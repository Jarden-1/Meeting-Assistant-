---
name: Efficient Collaboration System
colors:
  surface: '#f8f9ff'
  surface-dim: '#d5dae5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eef4fe'
  surface-container: '#e9eef9'
  surface-container-high: '#e3e8f3'
  surface-container-highest: '#dde3ed'
  on-surface: '#161c23'
  on-surface-variant: '#424655'
  inverse-surface: '#2b3139'
  inverse-on-surface: '#ecf1fc'
  outline: '#737687'
  outline-variant: '#c3c6d8'
  surface-tint: '#0053db'
  primary: '#0050d6'
  on-primary: '#ffffff'
  primary-container: '#2a6af9'
  on-primary-container: '#fefcff'
  inverse-primary: '#b4c5ff'
  secondary: '#5b3cdd'
  on-secondary: '#ffffff'
  secondary-container: '#7459f7'
  on-secondary-container: '#fffbff'
  tertiary: '#9e3e00'
  on-tertiary: '#ffffff'
  tertiary-container: '#c64f00'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b4c5ff'
  on-primary-fixed: '#00174b'
  on-primary-fixed-variant: '#003ea8'
  secondary-fixed: '#e5deff'
  secondary-fixed-dim: '#c9bfff'
  on-secondary-fixed: '#1a0063'
  on-secondary-fixed-variant: '#441cc8'
  tertiary-fixed: '#ffdbcc'
  tertiary-fixed-dim: '#ffb695'
  on-tertiary-fixed: '#351000'
  on-tertiary-fixed-variant: '#7b2e00'
  background: '#f8f9ff'
  on-background: '#161c23'
  surface-variant: '#dde3ed'
  bg-canvas: '#F5F6F7'
  bg-card: '#FFFFFF'
  border-base: '#DEE0E3'
  status-high-risk: '#F54A45'
  status-at-risk: '#FF8800'
  status-todo: '#3370FF'
  status-unupdated: '#8F959E'
  text-primary: '#1F2329'
  text-secondary: '#646A73'
  text-placeholder: '#BBBFCC'
typography:
  display-lg:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-sm:
    fontFamily: Hanken Grotesk
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  title-md:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 24px
  body-lg:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
  label-md:
    fontFamily: Hanken Grotesk
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 18px
  label-sm:
    fontFamily: Hanken Grotesk
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
  headline-md-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  sidebar-width: 240px
  sidebar-collapsed: 64px
  container-max: 1440px
  gutter: 16px
  margin-page: 24px
  stack-xs: 4px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 24px
---

## Brand & Style

This design system is built for high-performance enterprise collaboration, prioritizing clarity, efficiency, and professional trust. It draws inspiration from modern productivity platforms, focusing on a "content-first" approach where the interface recedes to let user data and communication take center stage.

The aesthetic is **Corporate / Modern**, characterized by a systematic grid, functional color application, and high-density information layouts. The emotional response should be one of "structured calm"—providing users with a sense of order and reliability even when managing complex tasks or large datasets. Key visual markers include a narrow functional sidebar, subtle elevation, and a rigorous adherence to systematic spacing.

## Colors

The color palette is anchored by "Feishu Blue" (#3370FF), used purposefully for primary actions, active states, and focus indicators. The background strategy uses a tiered approach: a light gray canvas (#F5F6F7) to provide contrast for white content cards and containers.

**Semantic Color Usage:**
- **Primary:** Core actions and navigational highlights.
- **Secondary (Purple):** Specialized features or secondary brand accents.
- **Neutral:** A range of grays used to establish typographic hierarchy and UI borders.
- **Status Colors:** High-contrast tokens for "High Risk" (Red), "At Risk" (Orange), and "Todo" (Blue) to ensure immediate visual recognition in dashboards.

## Typography

The typography system uses **Hanken Grotesk** for international contexts, paired with system-level sans-serifs (like PingFang SC) for Chinese characters. The hierarchy is designed for high legibility in data-dense environments.

For Chinese text, ensure `line-height` is slightly more generous (at least 1.5x) to maintain readability at smaller sizes. The primary body size is 14px, which is the enterprise standard for balancing information density and comfort. Font weights are used sparingly—400 for content, 500 for UI labels, and 600 for section headings.

## Layout & Spacing

The layout utilizes a **Fixed Grid** approach for internal content containers while employing a flexible Sidebar + Header shell. 

**Sidebar Strategy:**
- Use a narrow, high-density sidebar for primary navigation.
- Desktop: 240px width with an option to collapse to 64px (icons only).
- Mobile: Bottom navigation bar for core features or a full-width drawer.

**Grid & Rhythm:**
The system follows an 8px spacing scale (4, 8, 16, 24, 32, 48, 64). Gutters are fixed at 16px to maximize horizontal space for tables and lists. Content is typically grouped in cards that sit on the `#F5F6F7` background, with 24px padding within cards to provide "visual breathing room" amidst dense data.

## Elevation & Depth

Hierarchy is established primarily through **Tonal Layers** and extremely subtle **Ambient Shadows**.

1.  **Canvas (Level 0):** The `#F5F6F7` background acts as the lowest layer.
2.  **Surface (Level 1):** White cards (`#FFFFFF`) with a 1px border (`#DEE0E3`). No shadow is used here to keep the UI flat and clean.
3.  **Raised (Level 2):** Used for cards that are interactive or "active." Add a soft shadow: `0 4px 12px rgba(31, 35, 41, 0.06)`.
4.  **Overlay (Level 3):** Used for modals, dropdowns, and popovers. These use a more pronounced shadow: `0 8px 24px rgba(31, 35, 41, 0.12)` and a 1px border.

Avoid heavy blurs or colorful glows; depth should feel functional and structural rather than decorative.

## Shapes

The design system uses **Soft (0.25rem)** roundedness for most UI components. This subtle rounding maintains a professional, "pixel-perfect" feel while avoiding the clinical sharpness of 0px corners.

- **Buttons & Inputs:** 4px radius (0.25rem).
- **Cards & Large Containers:** 8px radius (0.5rem).
- **Status Tags/Chips:** Fully rounded (pill-shaped) to distinguish them from interactive buttons.
- **Avatars:** Circular (50% or 100px) to provide a soft contrast to the otherwise rectangular grid.

## Components

### Buttons
- **Primary:** Background `#3370FF`, Text `#FFFFFF`. Solid state.
- **Secondary:** Border `#DEE0E3`, Text `#1F2329`, Background `#FFFFFF`.
- **Ghost:** No background/border, Text `#646A73`, shifts to light gray hover.

### Status Tags
Status tags are essential for quick scanning. They use a "Light Fill" style:
- **High Risk:** Background `#FFF0F0`, Text `#F54A45`.
- **At Risk:** Background `#FFF5EB`, Text `#FF8800`.
- **Has Todo:** Background `#E8F0FF`, Text `#3370FF`.
- **Unupdated:** Background `#F2F3F5`, Text `#8F959E`.

### Inputs
- **Default:** White background, 1px border `#DEE0E3`, 14px text.
- **Focus:** 1px solid `#3370FF` border with a 2px soft blue halo (alpha 10%).
- **Placeholder:** Text color `#BBBFCC`.

### Cards
Cards are the primary container for content. They should always have a white background, 8px corner radius, and a 1px border `#DEE0E3`. Shadows should only be applied if the card is a hoverable/clickable element.

### Tables
Tables should be borderless on the sides, using only horizontal dividers (`1px solid #DEE0E3`). Header rows should have a very light gray background (`#F8F9FA`) to distinguish them from data rows.