\---

version: alpha

name: Medicalbay Calm Care

description: A clean, light medical hospitality system with teal accents, generous white space, and reassuring editorial typography.

colors:

&#x20; primary: "#4bbdbd"

&#x20; primary-60: "#6ccaca"

&#x20; primary-70: "#8ad6d6"

&#x20; secondary: "#4b4f58"

&#x20; tertiary: "#3a3a3a"

&#x20; neutral: "#ffffff"

&#x20; surface: "#ffffff"

&#x20; surface-muted: "#f7f8f9"

&#x20; on-surface: "#4b4f58"

&#x20; border: "#e5e7eb"

&#x20; error: "#d9534f"

typography:

&#x20; headline-display:

&#x20;   fontFamily: Heebo

&#x20;   fontSize: 41px

&#x20;   fontWeight: 700

&#x20;   lineHeight: 49px

&#x20;   letterSpacing: 0px

&#x20; headline-lg:

&#x20;   fontFamily: Heebo

&#x20;   fontSize: 30px

&#x20;   fontWeight: 700

&#x20;   lineHeight: 39px

&#x20;   letterSpacing: 0px

&#x20; headline-md:

&#x20;   fontFamily: Heebo

&#x20;   fontSize: 25px

&#x20;   fontWeight: 700

&#x20;   lineHeight: 35px

&#x20;   letterSpacing: 0px

&#x20; headline-sm:

&#x20;   fontFamily: Heebo

&#x20;   fontSize: 18px

&#x20;   fontWeight: 600

&#x20;   lineHeight: 22px

&#x20;   letterSpacing: 0px

&#x20; body-lg:

&#x20;   fontFamily: Heebo

&#x20;   fontSize: 16px

&#x20;   fontWeight: 400

&#x20;   lineHeight: 28px

&#x20;   letterSpacing: 0px

&#x20; body-md:

&#x20;   fontFamily: Heebo

&#x20;   fontSize: 15px

&#x20;   fontWeight: 400

&#x20;   lineHeight: 28px

&#x20;   letterSpacing: 0px

&#x20; body-sm:

&#x20;   fontFamily: Heebo

&#x20;   fontSize: 14px

&#x20;   fontWeight: 400

&#x20;   lineHeight: 24px

&#x20;   letterSpacing: 0px

&#x20; label-lg:

&#x20;   fontFamily: Heebo

&#x20;   fontSize: 15px

&#x20;   fontWeight: 600

&#x20;   lineHeight: 20px

&#x20;   letterSpacing: 0px

&#x20; label-md:

&#x20;   fontFamily: Heebo

&#x20;   fontSize: 14px

&#x20;   fontWeight: 600

&#x20;   lineHeight: 18px

&#x20;   letterSpacing: 0px

&#x20; label-sm:

&#x20;   fontFamily: Heebo

&#x20;   fontSize: 12px

&#x20;   fontWeight: 600

&#x20;   lineHeight: 16px

&#x20;   letterSpacing: 0.04em

&#x20; nav-link:

&#x20;   fontFamily: Heebo

&#x20;   fontSize: 15px

&#x20;   fontWeight: 400

&#x20;   lineHeight: 20px

&#x20;   letterSpacing: 0px

&#x20; button-text:

&#x20;   fontFamily: Heebo

&#x20;   fontSize: 15px

&#x20;   fontWeight: 600

&#x20;   lineHeight: 20px

&#x20;   letterSpacing: 0px

rounded:

&#x20; none: 0px

&#x20; sm: 4px

&#x20; md: 7px

&#x20; lg: 8px

&#x20; xl: 12px

&#x20; full: 9999px

spacing:

&#x20; xs: 6px

&#x20; sm: 14px

&#x20; md: 24px

&#x20; lg: 50px

&#x20; xl: 100px

components:

&#x20; button-primary:

&#x20;   backgroundColor: "{colors.primary}"

&#x20;   textColor: "{colors.neutral}"

&#x20;   typography: "{typography.button-text}"

&#x20;   rounded: "{rounded.md}"

&#x20;   padding: 15px 25px

&#x20;   height: 47px

&#x20; button-secondary:

&#x20;   backgroundColor: "{colors.neutral}"

&#x20;   textColor: "{colors.primary}"

&#x20;   typography: "{typography.button-text}"

&#x20;   rounded: "{rounded.md}"

&#x20;   padding: 15px 25px

&#x20;   height: 47px

&#x20; button-link:

&#x20;   backgroundColor: "transparent"

&#x20;   textColor: "{colors.tertiary}"

&#x20;   typography: "{typography.body-md}"

&#x20;   rounded: "{rounded.none}"

&#x20;   padding: 0px

&#x20; card:

&#x20;   backgroundColor: "{colors.surface}"

&#x20;   textColor: "{colors.on-surface}"

&#x20;   rounded: "{rounded.lg}"

&#x20;   padding: 16px

&#x20; input:

&#x20;   backgroundColor: "{colors.surface}"

&#x20;   textColor: "{colors.on-surface}"

&#x20;   typography: "{typography.body-md}"

&#x20;   rounded: "{rounded.md}"

&#x20;   padding: 12px 14px

&#x20; chip:

&#x20;   backgroundColor: "{colors.surface}"

&#x20;   textColor: "{colors.primary}"

&#x20;   typography: "{typography.label-md}"

&#x20;   rounded: "{rounded.full}"

&#x20;   padding: 6px 12px

\---

\# Medicalbay Calm Care



\## Overview

Medicalbay presents a reassuring, professional medical-tourism experience with a soft hospitality tone. The visual language is bright, airy, and confidence-building, using white space, teal accents, and large smiling imagery to reduce perceived friction. The interface feels polished rather than experimental, with clear hierarchy and a calm, accessible rhythm.



\## Colors

\- \*\*Primary (#4bbdbd):\*\* A fresh teal used for key actions, active accents, the top bar, and emphasis lines. It carries the brand personality and should remain the dominant accent color.

\- \*\*Primary-60 (#6ccaca) and Primary-70 (#8ad6d6):\*\* Lighter teal steps for hover states, subtle highlights, and soft backgrounds where a calmer version of the brand color is needed.

\- \*\*Secondary (#4b4f58):\*\* The main body-text gray, used for supporting copy and neutral UI text on white backgrounds.

\- \*\*Tertiary (#3a3a3a):\*\* A deeper neutral reserved for strong navigation text and higher-contrast link treatments.

\- \*\*Neutral (#ffffff) and Surface (#ffffff):\*\* The page base and card/button surfaces. White is a defining part of the system and should stay predominant.

\- \*\*Surface-muted (#f7f8f9):\*\* A very light cool gray for section breaks or subtle panels when a touch of separation is needed without losing the airy feel.

\- \*\*Border (#e5e7eb):\*\* Soft cool gray borders used for cards, outlined controls, and quiet structural separation.

\- \*\*Error (#d9534f):\*\* A restrained alert red for validation and destructive states; it should remain secondary to the brand’s calm palette.



\## Typography

The system uses Heebo throughout, which gives the site a modern, approachable, and highly readable voice. Headlines are bold and compact, with headline-display and headline-lg carrying the strongest emphasis for hero sections and major page titles. Body text stays regular-weight and spacious through body-md, matching the source’s comfortable reading rhythm. Labels and buttons use semibold weights for clarity, while label-sm adds slight letter spacing for small utility text and compact UI. Uppercase treatment appears in call-to-action buttons and some section labels, so use sparingly and keep it reserved for emphasis.



\## Layout

The layout is centered and spacious, with a clear full-width hero area followed by a constrained content column. Sections breathe with large vertical spacing, using the xs to xl scale to create a rhythm that moves from tight utility spacing to generous page breaks. Cards and content blocks should use modest internal padding and soft borders rather than dense shadowed containers. Navigation and top utility areas should remain horizontally distributed and aligned, with clear separation between contact info, nav links, and action buttons.



\## Elevation \& Depth

The design is mostly flat, relying on color contrast, whitespace, and image layering rather than pronounced shadow depth. Subtle borders define containers and cards, while the main hero uses photographic contrast to create the strongest visual hierarchy. Shadows should be minimal and almost imperceptible, only used when needed to lift floating UI such as sticky utilities or small overlays.



\## Shapes

The shape language is gently rounded and friendly, but not pill-heavy. Controls commonly use a medium radius around 7px to 8px, which softens the interface without making it playful. Full-radius shapes should be reserved for chips, avatars, and circular utility indicators, while major panels and cards remain lightly rounded for a clean clinical feel.



\## Components

Buttons should be the primary brand expression. Use button-primary for the main teal CTA with white text, 15px/25px padding, and a 47px height; this is the default action style for booking or quote requests. Use button-secondary for inverse or low-emphasis actions on light backgrounds, keeping the same size and radius but with teal text on white. Use button-link for plain text navigation or inline actions; it should be visually quiet and borderless.



Cards should use card styling: white background, subtle border, 8px radius, and 16px padding. Avoid heavy shadows; structure should come from spacing and borders. Inputs should visually match cards and buttons with clean white fills, soft radii, and comfortable padding, prioritizing legibility over decoration. Chips should be compact, rounded, and teal-accented, suitable for filters, tags, or small status indicators.



Navigation items should stay simple and readable, using nav-link styling with no decorative underline by default. The top utility bar can use smaller text and icon-led spacing, while dropdown triggers should keep a quiet outlined treatment to remain visible over imagery. Floating contact utilities, such as the WhatsApp button, should remain small, rounded, and teal to preserve brand consistency without competing with primary actions.



\## Do's and Don'ts

\- Do keep the interface bright, open, and whitespace-driven.

\- Do use the teal primary color consistently for CTAs, highlights, and subtle brand cues.

\- Do keep body text in the secondary gray for comfortable readability.

\- Do prefer soft borders and minimal shadows over heavy elevation.

\- Don't introduce dark, saturated, or high-contrast accent colors that fight the calm medical tone.

\- Don't over-round controls into oversized pills unless the component is explicitly a chip or floating utility.

\- Don't crowd sections with dense layouts; preserve the spacious editorial rhythm.

\- Don't use decorative typography effects, exaggerated tracking, or overly stylized display fonts.

