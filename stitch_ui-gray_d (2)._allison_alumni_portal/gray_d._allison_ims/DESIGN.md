---
name: Gray D. Allison IMS
colors:
  surface: '#fbf9fb'
  surface-dim: '#dbd9dc'
  surface-bright: '#fbf9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f5f3f6'
  surface-container: '#efedf0'
  surface-container-high: '#e9e7ea'
  surface-container-highest: '#e4e2e5'
  on-surface: '#1b1b1e'
  on-surface-variant: '#44474d'
  inverse-surface: '#303033'
  inverse-on-surface: '#f2f0f3'
  outline: '#75777e'
  outline-variant: '#c4c6ce'
  surface-tint: '#4d5f7f'
  primary: '#031935'
  on-primary: '#ffffff'
  primary-container: '#1b2e4b'
  on-primary-container: '#8396b8'
  inverse-primary: '#b4c7ec'
  secondary: '#5e5e5e'
  on-secondary: '#ffffff'
  secondary-container: '#e2e2e2'
  on-secondary-container: '#646464'
  tertiary: '#251700'
  on-tertiary: '#ffffff'
  tertiary-container: '#3f2a01'
  on-tertiary-container: '#b0915d'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d6e3ff'
  primary-fixed-dim: '#b4c7ec'
  on-primary-fixed: '#061b38'
  on-primary-fixed-variant: '#354766'
  secondary-fixed: '#e2e2e2'
  secondary-fixed-dim: '#c6c6c6'
  on-secondary-fixed: '#1b1b1b'
  on-secondary-fixed-variant: '#474747'
  tertiary-fixed: '#ffdeab'
  tertiary-fixed-dim: '#e5c18a'
  on-tertiary-fixed: '#281900'
  on-tertiary-fixed-variant: '#5b4317'
  background: '#fbf9fb'
  on-background: '#1b1b1e'
  surface-variant: '#e4e2e5'
typography:
  h1:
    fontFamily: Public Sans
    fontSize: 36px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  h2:
    fontFamily: Public Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Public Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Public Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  label-sm:
    fontFamily: Public Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: '1.2'
  caption:
    fontFamily: Public Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: '1.4'
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  container-max: 1280px
  sidebar-width: 280px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 32px
  stack-gap: 16px
---

## Brand & Style

The design system is anchored in a **Corporate/Modern** aesthetic tailored for the Ministry of National Defense of Liberia. It prioritizes institutional authority, reliability, and high utility. The brand personality is serious and disciplined, reflecting the prestigious nature of the Gray D. Allison school. 

The visual direction uses a "Safety and Security" approach: high-contrast typography, disciplined alignment, and a controlled color palette. Whitespace is used not just for aesthetics, but to ensure clarity and error reduction for administrative staff and alumni. The target audience includes government officials, alumni, and school staff who require a tool that feels official, secure, and permanent.

## Colors

The palette is strictly institutional. **Navy Blue (#1B2E4B)** serves as the primary anchor, symbolizing trust and military-affiliated stability. **Black (#000000)** is reserved for primary text and high-level navigation to ensure maximum legibility. 

The background system uses **White** for primary content areas and **Light Gray (Slate-50)** for layout containment and background surfaces. The **Subtle Silver/Gray** accent is utilized for borders and dividers to maintain a clean, structured appearance without adding visual noise. Status indicators (Success/Error) are deeply desaturated to remain professional rather than vibrant.

## Typography

This design system utilizes **Public Sans**, a typeface originally designed for US government platforms. It provides an inherently official, neutral, and highly readable feel. 

Headlines use heavy weights and tighter letter spacing to project authority. Body text is optimized for long-form data reading with a generous 1.5-1.6 line height. Labels and metadata are set in semi-bold uppercase at smaller scales to clearly distinguish "Form Field Labels" from user-generated content.

## Layout & Spacing

The system follows a **Fixed Grid** philosophy for the public site and a **Fluid Dashboard** model for the information management system.

- **Public View:** 12-column grid centered on the page with a max-width of 1280px.
- **Admin Dashboard:** Uses a persistent 280px sidebar for primary navigation and a flexible main content area that expands to fill the viewport.
- **Spacing Rhythm:** Based on a 4px baseline. Components are typically separated by 16px (stack) or 24px (section) increments to maintain a disciplined, rhythmic layout characteristic of official documents.

## Elevation & Depth

To maintain a "serious" tone, this design system avoids heavy shadows and floating elements. Depth is conveyed through:

1.  **Low-Contrast Outlines:** Containers and cards use a 1px solid border in `#E2E8F0` rather than heavy drop shadows.
2.  **Tonal Layering:** The dashboard background is light gray (`#F8FAFC`), while active content cards and the sidebar are white, creating a subtle "lift" through color contrast alone.
3.  **Minimal Shadows:** Where necessary (e.g., dropdowns or primary cards), use a single, highly diffused shadow: `0 4px 6px -1px rgba(0, 0, 0, 0.05)`. This ensures the UI feels tactile but grounded.

## Shapes

The design system uses **Soft (0.25rem)** roundedness. This "near-sharp" approach strikes a balance between modern UI standards and the rigid, official nature of an educational/military institution. 

- **Inputs & Buttons:** 4px (0.25rem) radius.
- **Large Cards/Containers:** 8px (0.5rem) radius.
- **Status Badges:** 2px radius or sharp corners to avoid a "pill" or social-media appearance.

## Components

### Navigation
- **Top Navbar (Public):** High-contrast Navy background with white text. Minimalist links and a clear "Login" button.
- **Sidebar (Dashboard):** White background with a 1px right border. Active states are indicated by a Navy Blue vertical bar on the left edge and a subtle gray background fill.

### Tables & Data
- **Institutional Tables:** No vertical borders. Use 1px horizontal dividers. Header rows must have a light gray background (`#F8FAFC`) and uppercase labels.
- **Status Badges:** Small, rectangular badges with low-saturation backgrounds (e.g., light gray for "Pending," dark green for "Active").

### Inputs & Forms
- **Professional Forms:** Labels are always positioned above the input field. Inputs use a 1px border that thickens slightly on focus. No glowing effects; focus state is a simple Navy Blue border.

### Buttons
- **Primary:** Solid Navy Blue with white text. No gradients.
- **Secondary:** White background with Navy Blue border and text.
- **Tertiary:** Ghost style; text-only with Navy Blue color, underlined on hover.

### Cards
- Use for dashboard metrics and alumni profiles. White background, 1px Silver border, and 16px internal padding.