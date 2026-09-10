You are redesigning the engineering blog section of this project.

IMPORTANT:
Do not interpret this as a conventional blog redesign.

The desired result is a single, editorial, document-like reading experience.

Think:

    technical journal
        +
    beautifully typeset engineering document
        +
    premium editorial website
        +
    Linear / Arc / modern Swiss editorial design
        +
    subtle archival / paper / documentation aesthetic

NOT:

    generic developer blog
    Medium clone
    Notion clone
    card-based SaaS blog
    glassmorphism
    gradient-heavy AI website
    dashboard
    excessive rounded cards
    floating UI everywhere

The three provided reference images are the visual direction.

Study their visual language carefully and reproduce the underlying design system rather than copying individual elements.

==================================================
1. CORE DESIGN PHILOSOPHY
==================================================

The blog should feel like:

"I am reading an engineering document that happens to live on the web."

It should NOT feel like:

"I am browsing a website that contains a blog post."

The article itself is the product.

Everything should support reading, comprehension, hierarchy, and intellectual density.

The visual language should feel:

- restrained
- editorial
- precise
- quiet
- architectural
- highly intentional
- premium
- technical
- slightly experimental
- monochromatic
- spacious without feeling empty

Whitespace is a major design element.

Do not fill empty space merely because it exists.

==================================================
2. VISUAL REFERENCES
==================================================

Use the supplied reference images as the primary visual reference.

Reference 1:
A Linear-style editorial document.

Important characteristics:
- white / warm-white document surface
- extremely thin borders
- tiny metadata
- strong typographic hierarchy
- large headline
- restrained body copy
- diagrams embedded into the document
- almost no decorative UI
- generous whitespace
- information feels typeset rather than assembled from components

Reference 2:
An editorial product/interface presentation.

Important characteristics:
- large canvas
- centered composition
- extremely subtle borders
- almost imperceptible surfaces
- warm off-white background
- restrained typography
- UI is treated almost like an illustration
- no visual noise
- very deliberate alignment

Reference 3:
A premium architectural / financial AI landing page.

Important characteristics:
- editorial serif headline
- enormous typography
- architectural composition
- fine-line geometry
- monochrome artwork
- subtle blue accent used sparingly
- large negative space
- asymmetric but mathematically controlled layout
- thin structural borders
- content divided through lines rather than cards/shadows

The resulting engineering blog should combine these principles.

Do not literally copy the Roman architecture, blue artwork, or specific layouts.

Extract the DESIGN LANGUAGE.

==================================================
3. OVERALL PAGE STRUCTURE
==================================================

The article should be structured approximately like this:

                    VIEWPORT
┌──────────────────────────────────────────────────────┐
│                                                      │
│   small metadata / site identity                     │
│                                                      │
│                                                      │
│              ARTICLE TITLE                           │
│                                                      │
│              subtitle / thesis                       │
│                                                      │
│              author · date · reading time             │
│                                                      │
│                                                      │
│──────────────────────────────────────────────────────│
│                                                      │
│                                                      │
│                 article body                         │
│                                                      │
│                 ┌──────────────┐                     │
│                 │              │                     │
│                 │   content    │                     │
│                 │              │                     │
│                 └──────────────┘                     │
│                                                      │
│                                                      │
│──────────────────────────────────────────────────────│
│                                                      │
│                  next / related                      │
│                                                      │
└──────────────────────────────────────────────────────┘


The article is the central visual object.

Do not create a traditional:
- hero card
- article card
- sidebar-heavy blog layout
- grid of recommended posts immediately around the article

The page should read vertically like a document.

==================================================
4. PAGE WIDTH
==================================================

Use a large outer canvas but a controlled reading measure.

Recommended conceptual structure:

┌──────────────────────────────────────────────────────────────┐
│                                                              │
│   outer margin                                                │
│                                                              │
│             ┌────────────────────────────────┐                │
│             │                                │                │
│             │       article/document         │                │
│             │                                │                │
│             │                                │                │
│             └────────────────────────────────┘                │
│                                                              │
└──────────────────────────────────────────────────────────────┘

Desktop:

- overall content width: approximately 1100px to 1280px
- article reading width: approximately 680px to 760px
- wide figures/code blocks can expand beyond the reading column
- do NOT make body text span the entire viewport
- maintain a strong central axis

The page should have substantial side whitespace.

The whitespace is intentional.

==================================================
5. GRID SYSTEM
==================================================

Use a disciplined grid.

Conceptually:

12-column grid

┌────┬────┬────┬────┬────┬────┬────┬────┬────┬────┬────┬────┐
│    │    │    │    │    │    │    │    │    │    │    │    │
└────┴────┴────┴────┴────┴────┴────┴────┴────┴────┴────┴────┘

The article reading column should occupy the center portion.

Possible desktop layout:

    2 columns     8 columns        2 columns
┌────────────┬──────────────────────┬────────────┐
│            │                      │            │
│ metadata   │     article         │ TOC        │
│ / breathing│     content         │ / anchors  │
│ room       │                      │            │
│            │                      │            │
└────────────┴──────────────────────┴────────────┘

However:

The sidebar should NOT become visually dominant.

If a table of contents exists, keep it extremely quiet.

==================================================
6. BORDERS
==================================================

This is extremely important.

Borders should be:

- 1px
- very low contrast
- neutral
- structural
- never decorative

Think:

    #E8E8E5
    #E5E5E2
    #DEDEDA

rather than dark gray.

Avoid thick borders.

Avoid black outlines.

Avoid colored outlines.

Avoid cards that look "boxed in".

The references use lines as architectural structure.

Use borders to establish:
- document boundaries
- section separation
- navigation separation
- code boundaries
- figure boundaries
- metadata divisions

NOT to decorate every component.

Do not put borders around every paragraph or UI element.

==================================================
7. NO SHADOWS
==================================================

ABSOLUTELY NO DROP SHADOWS.

Do not use:

box-shadow
text-shadow
glow
outer glow
neumorphism
floating elevation
heavy depth effects

The references derive depth from:

- whitespace
- layering
- borders
- typography
- composition
- slight surface differences

Not shadows.

If something needs separation:

use whitespace or a 1px border.

==================================================
8. CORNERS / BORDER RADIUS
==================================================

Use very restrained corner rounding.

Most editorial/document elements should feel architectural and almost square.

Recommended:

- document containers: 0px to 4px
- images/figures: 0px to 4px
- code blocks: 2px to 4px
- buttons: 2px to 4px

Avoid:

- 12px cards
- 16px cards
- 24px cards
- pill-shaped everything

Rounded corners should not become a defining visual language.

==================================================
9. COLOR SYSTEM
==================================================

Primary palette should be almost monochromatic.

Background:

warm white / paper white

Examples:

#FAFAF8
#F8F8F5
#F7F7F4

Primary text:

near-black

#171717
#1A1A1A
#202020

Secondary text:

#6F6F6A

Muted:

#999993

Borders:

#E5E5E1

Code background:

slightly darker warm gray

#F3F3F0

Do not introduce lots of colors.

Accent color should be extremely restrained.

If the existing project has a brand accent, use it only for:
- links
- tiny interactive indicators
- selected navigation state
- very occasional diagrams

Never use gradients.

Never use giant colored backgrounds.

Never use colorful cards.

Never use glowing blue/purple AI aesthetics.

==================================================
10. TYPOGRAPHY
==================================================

Typography is the most important visual element.

Use a sophisticated pairing.

Preferred direction:

SERIF:
Editorial headline / major section titles

Examples:
- Instrument Serif
- Cormorant Garamond
- DM Serif Display
- Playfair Display
- Newsreader

SANS:
Interface, metadata, body copy, navigation

Examples:
- Inter
- Geist
- Helvetica Neue
- IBM Plex Sans
- Manrope

Preferred combination:

    Editorial serif
          +
    neutral modern sans

The contrast should feel intentional.

For example:

Article title:
Editorial serif

Metadata:
Modern sans

Body:
Modern sans OR highly readable serif depending on the existing project.

Code:
Monospace

Examples:
- Geist Mono
- IBM Plex Mono
- JetBrains Mono

Do not use more than 3 font families.

Ideally:

    Serif
    Sans
    Mono

==================================================
11. TYPOGRAPHIC SCALE
==================================================

Desktop article title:

approximately 64px to 88px

Line height:

0.95 to 1.05

The title should feel large and editorial.

Example:

    Building reliable
    retrieval systems

rather than:

    Building Reliable Retrieval Systems
    for Production Applications

Avoid excessive capitalization.

Use sentence case.

Subtitle:

18px to 22px

Line height:

1.4 to 1.6

Metadata:

11px to 13px

Use uppercase sparingly.

Body:

17px to 19px

Line height:

1.65 to 1.85

Maximum reading width:

approximately 680px to 740px.

Section heading:

32px to 44px

Subsection:

22px to 28px

Small heading:

16px to 18px

Do not make everything huge.

The hierarchy should come from contrast.

==================================================
12. ARTICLE HEADER
==================================================

The article header should feel like the title page of a technical publication.

Conceptually:

                    ENGINEERING / SYSTEMS

             Building systems that
             survive production

       A practical investigation into reliability,
       failure modes, and engineering tradeoffs.

             Rama · September 2026 · 12 min

                    ───────────────

Large whitespace should surround this.

Do NOT place the title inside a card.

Do NOT place the title inside a colored hero.

Do NOT use a giant gradient background.

Do NOT immediately place a featured image underneath.

If an image exists, treat it as editorial artwork.

==================================================
13. DOCUMENT FEEL
==================================================

The entire page should feel like a sheet of paper translated into a browser.

Use:

- subtle rules
- page-like margins
- section numbering
- small metadata
- precise alignment
- diagrams
- footnote-like annotations
- captions
- technical labels

Possible section treatment:

01 / INTRODUCTION

The problem is not...

────────────────────────────

02 / WHY THIS BREAKS

...

This should feel closer to a technical publication than a CMS template.

==================================================
14. SECTION DESIGN
==================================================

Sections should have strong breathing room.

Example:

        01 / THE PROBLEM


        Large section heading

        Body paragraph...

        Body paragraph...


        [diagram]


        Figure 01
        System architecture showing...


        02 / THE APPROACH

Do not put each section in a card.

Sections should flow naturally into each other.

Use horizontal rules sparingly.

==================================================
15. BODY TEXT
==================================================

Body copy must be extremely readable.

Rules:

- 680px to 740px maximum width
- generous line height
- comfortable paragraph spacing
- no justified text
- no giant blocks of text
- no tiny 14px article body
- no excessive bolding

Paragraph spacing:

approximately 20px to 28px.

Emphasis should be subtle.

Links should look editorial rather than SaaS-like.

==================================================
16. CODE BLOCKS
==================================================

Code is important for an engineering blog.

Code blocks should still belong to the editorial system.

Do not make them look like colorful IDE screenshots.

Conceptually:

┌────────────────────────────────────────────────────┐
│ Python                                      copy  │
├────────────────────────────────────────────────────┤
│                                                    │
│ def retrieve(query):                               │
│     results = index.search(query)                  │
│     return rerank(results)                         │
│                                                    │
└────────────────────────────────────────────────────┘

Characteristics:

- warm gray background
- 1px border
- almost no radius
- no shadow
- restrained syntax colors
- excellent typography
- generous internal padding
- line numbers only when useful
- language label should be tiny

Code font:

13px to 15px

Line height:

1.6

==================================================
17. DIAGRAMS
==================================================

Diagrams should be treated as part of the document.

Do not put diagrams into generic image cards.

Prefer:

- thin strokes
- monochrome
- subtle fills
- fine geometry
- labels
- arrows
- technical annotations

Example:

       ┌─────────────┐
       │   CLIENT    │
       └──────┬──────┘
              │
              ▼
       ┌─────────────┐
       │   API       │
       └──────┬──────┘
              │
        ┌─────┴─────┐
        ▼           ▼
   ┌─────────┐  ┌─────────┐
   │ CACHE   │  │ DATABASE│
   └─────────┘  └─────────┘

The visual equivalent should use very thin lines and lots of whitespace.

Captions should be small and muted.

Example:

FIGURE 03

Request flow through the retrieval layer.

==================================================
18. IMAGES
==================================================

Do not automatically use large rounded image cards.

Images should feel like figures inside a publication.

Possible treatment:

┌──────────────────────────────────────────────────────┐
│                                                      │
│                     IMAGE                            │
│                                                      │
└──────────────────────────────────────────────────────┘

Figure 02
Architecture of the indexing pipeline.

Images can occasionally break out of the reading width:

                    ┌──────────────────────────┐
                    │                          │
                    │          FIGURE          │
                    │                          │
                    └──────────────────────────┘
                          900px wide

This creates editorial rhythm.

==================================================
19. PULL QUOTES / IMPORTANT IDEAS
==================================================

When emphasizing a major engineering insight, do not use a colorful callout card.

Instead use typography.

Example:

            "The bottleneck wasn't inference.
             It was coordination."

Large serif text.

Lots of whitespace.

Perhaps a thin vertical rule.

Nothing else.

==================================================
20. TABLES
==================================================

Tables should look like technical publication tables.

Use thin horizontal/vertical rules.

No shadows.

No rounded cards.

No colorful headers.

Example:

┌────────────────┬──────────────┬──────────────┐
│ System         │ Latency      │ Accuracy     │
├────────────────┼──────────────┼──────────────┤
│ Baseline       │ 240ms        │ 81%          │
│ Optimized      │ 110ms        │ 87%          │
└────────────────┴──────────────┴──────────────┘

Keep typography small but readable.

==================================================
21. NAVIGATION
==================================================

Navigation should be quiet.

Top navigation should not dominate the page.

Possible:

┌──────────────────────────────────────────────────────┐
│ logo                         Writing   About   GitHub │
└──────────────────────────────────────────────────────┘

Very thin bottom border.

Small typography.

No giant nav pills.

No floating navbar unless the existing application requires it.

==================================================
22. TABLE OF CONTENTS
==================================================

If a TOC exists:

keep it subtle.

Example:

01  Introduction
02  The problem
03  Architecture
04  Implementation
05  Failure modes
06  Conclusion

Use:

- 11px to 13px typography
- muted gray
- thin active indicator
- no boxed navigation

Desktop TOC can be sticky.

Mobile TOC should collapse.

==================================================
23. MICRO-DETAILS
==================================================

The quality of the design should come from tiny details.

Use:

- 1px rules
- carefully tuned letter spacing
- small labels
- section numbering
- figure numbering
- subtle captions
- consistent baseline alignment
- deliberate whitespace
- precise margins

Avoid:

- excessive icons
- emoji
- huge iconography
- unnecessary badges
- colorful status indicators
- decorative blobs
- gradients
- glassmorphism
- excessive animations

==================================================
24. MOTION
==================================================

Motion should be almost invisible.

Use animation only where it improves interaction.

Preferred:

- 150ms to 250ms transitions
- subtle opacity changes
- subtle underline transitions
- tiny translation if needed

Avoid:

- bouncing
- spring-heavy animation
- scroll-jacking
- parallax everywhere
- huge entrance animations
- flashy hover effects

The page should feel still.

==================================================
25. RESPONSIVE DESIGN
==================================================

Desktop is the primary editorial composition.

Mobile must not simply shrink the desktop layout.

Mobile:

┌──────────────────────────────┐
│ logo                  menu   │
├──────────────────────────────┤
│                              │
│ ENGINEERING                  │
│                              │
│ Building reliable            │
│ systems                      │
│                              │
│ subtitle...                  │
│                              │
│ author · date                │
│                              │
│──────────────────────────────│
│                              │
│ body text                    │
│                              │
│ body text                    │
│                              │
│ ┌──────────────────────────┐ │
│ │          CODE            │ │
│ └──────────────────────────┘ │
│                              │
└──────────────────────────────┘

On mobile:

- 20px to 24px horizontal page padding
- article body approximately full available width
- title approximately 42px to 52px
- body 16px to 18px
- hide desktop TOC
- maintain generous vertical whitespace
- preserve thin borders
- prevent horizontal overflow
- code blocks should scroll horizontally if necessary

==================================================
26. SPACING SYSTEM
==================================================

Use a consistent spacing scale.

Base unit:

4px.

Preferred values:

4
8
12
16
24
32
40
48
64
80
96
120
160

Do not randomly choose spacing values everywhere.

Typical article rhythm:

metadata
↓ 24px
title
↓ 24px
subtitle
↓ 32px
author metadata
↓ 80px
intro
↓ 64px
section
↓ 32px
paragraph
↓ 24px
paragraph
↓ 48px
figure
↓ 16px
caption
↓ 96px
next section

The design should breathe.

==================================================
27. VERTICAL RHYTHM
==================================================

A major goal is to create a deliberate vertical rhythm.

Think of the article as:

    small
    medium
    LARGE

    text
    whitespace
    text
    figure
    whitespace
    LARGE heading
    text
    code
    whitespace
    text

Avoid uniform spacing everywhere.

Uniform spacing feels like a component library.

Variable but systematic spacing feels editorial.

==================================================
28. ASYMMETRY
==================================================

Do not make everything perfectly centered.

The references use controlled asymmetry.

For example:

                         TITLE
                         TITLE

                 subtitle...

      ─────────────────────────────

      01 / INTRODUCTION

      Body body body body body
      body body body body body


                         FIGURE
                         FIGURE

Use asymmetry deliberately.

However:

Every alignment must still feel intentional.

Asymmetry ≠ randomness.

==================================================
29. EDITORIAL DETAILS
==================================================

Introduce small publication-like details where appropriate:

    ENGINEERING / AI

    01

    SEPTEMBER 2026

    FIGURE 04

    NOTE

    TL;DR

    APPENDIX

These should be tiny.

Never turn them into badges.

Example:

01 / RETRIEVAL

rather than:

[ RETRIEVAL ]

==================================================
30. DESIGN TOKENS
==================================================

Centralize visual tokens.

Create variables for:

--bg
--surface
--surface-muted
--text
--text-secondary
--text-muted
--border
--accent

Typography:

--font-serif
--font-sans
--font-mono

Spacing:

--space-1
--space-2
--space-3
...

Do not scatter arbitrary colors and spacing values throughout components.

==================================================
31. COMPONENT ARCHITECTURE
==================================================

Build reusable primitives, but do NOT let the page look component-driven.

Potential components:

ArticleLayout
ArticleHeader
ArticleMeta
ArticleSection
ArticleProse
ArticleFigure
FigureCaption
CodeBlock
Callout
PullQuote
DataTable
TableOfContents
ArticleNavigation
Footnote

The implementation should be modular.

The visual output should feel like one continuous document.

==================================================
32. CONTENT HIERARCHY
==================================================

The hierarchy should roughly be:

LEVEL 0
Site identity

LEVEL 1
Article title

LEVEL 2
Major section

LEVEL 3
Subsection

LEVEL 4
Body

LEVEL 5
Caption / metadata

LEVEL 6
Footnote / annotation

Do not create 8 different visual styles for headings.

Typography should do most of the work.

==================================================
33. ACCESSIBILITY
==================================================

Maintain:

- semantic HTML
- proper heading hierarchy
- accessible contrast
- keyboard navigation
- visible focus states
- alt text for figures
- accessible code blocks
- responsive typography

Do not sacrifice accessibility for aesthetics.

==================================================
34. PERFORMANCE
==================================================

Keep the design lightweight.

Avoid unnecessary:

- JavaScript animations
- huge libraries
- image effects
- decorative assets
- expensive scroll listeners

The article is primarily text.

It should load extremely quickly.

==================================================
35. WHAT TO AVOID
==================================================

This section is NON-NEGOTIABLE.

DO NOT build:

❌ Medium clone

❌ Substack clone

❌ Notion clone

❌ SaaS dashboard

❌ Card-grid blog

❌ Glassmorphism

❌ Gradient backgrounds

❌ Purple/blue AI gradients

❌ Floating blobs

❌ Giant rounded cards

❌ Heavy shadows

❌ Thick borders

❌ Excessive pills

❌ Excessive icons

❌ Excessive animations

❌ Huge hero illustrations unrelated to the article

❌ Full-width paragraphs

❌ Tiny body text

❌ Dense sidebar

❌ Every section inside a container/card

❌ Generic "AI startup" aesthetics

❌ Excessive use of accent color

❌ Random asymmetry

❌ Decorative elements without semantic purpose

==================================================
36. THE FEELING WE WANT
==================================================

When someone opens the page, the immediate impression should be:

"Someone cared about typesetting this."

Not:

"Someone assembled this from a UI kit."

The page should feel closer to:

    a beautifully designed engineering paper
    +
    an architectural magazine
    +
    Linear's editorial restraint
    +
    a modern technical publication

than to:

    a blog CMS.

==================================================
37. IMPLEMENTATION PROCESS
==================================================

Before modifying code:

1. Inspect the existing project structure.
2. Identify the current blog/article route.
3. Identify the existing design system and typography.
4. Identify existing reusable components.
5. Determine whether fonts are already configured.
6. Preserve existing application functionality.
7. Do not rewrite unrelated parts of the application.

Then redesign the article experience around this specification.

Do not blindly create a new design system if the project already has one.

Extend it where possible.

==================================================
38. IMPORTANT: CONTENT FIRST
==================================================

The article content must remain the visual focus.

Do not allow UI chrome to compete with the writing.

The page should prioritize:

    reading
      ↓
    understanding
      ↓
    technical diagrams/code
      ↓
    navigation
      ↓
    decoration

Decoration is the lowest priority.

==================================================
39. FINAL VISUAL TEST
==================================================

After implementation, inspect the page at:

- 1440px desktop
- 1280px desktop
- 1024px tablet
- 768px tablet
- 390px mobile

Ask:

1. Does this look like a document?
2. Does the article feel like the primary object?
3. Is the typography doing most of the visual work?
4. Are the borders subtle enough?
5. Are there ZERO unnecessary shadows?
6. Is the whitespace intentional?
7. Is the body text comfortable to read?
8. Does the page feel premium without looking flashy?
9. Does the composition have editorial character?
10. Does it avoid looking like a generic blog template?
11. Does the desktop layout have controlled asymmetry?
12. Does mobile preserve the same visual philosophy?
13. Do diagrams and code feel like part of the document?
14. Are there unnecessary cards, pills, gradients, icons, or decorations?

If the answer to any of these is no, iterate.

==================================================
40. MOST IMPORTANT PRINCIPLE
==================================================

Do not reproduce the screenshots literally.

Extract the design language:

    restraint
    typography
    whitespace
    fine borders
    editorial composition
    architectural structure
    monochrome palette
    controlled asymmetry
    document-like hierarchy
    technical precision

The final result should feel like the same DESIGNER created all three references and then designed an engineering publication.

It should feel original.

It should feel intentional.

It should feel like a document, not a blog.
