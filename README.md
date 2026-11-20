# Ernesto Cardenas — Portfolio

A dependency-free static portfolio for GitHub Pages. Open `index.html`, or preview with `python3 -m http.server 4173`.

## Content

- Current systems administration and remote field services work at Carvana, plus Quick Quack Car Wash, MGA Entertainment, and Partners Personnel experience.
- A strong interest in integrating AI with IT operations, grounded in the public Gemini/LangChain prototype at https://github.com/justernesto/ai-agents.
- Windows domain/security home lab, BLE tooling, and a CCNA study/lab roadmap.
- A printable résumé at `resume.html`, verified email, and LinkedIn at https://www.linkedin.com/in/nescardenas.

Experience, credentials, and lab descriptions were reconciled with the latest résumé and existing lab materials in November 2026. CCNA is in progress. The Bluetooth toolkit is source implementation without claimed hardware results. The AI project is an independent prototype. No employment duration total or unsupported project results are asserted.

## Features

- Responsive layout, accessible mobile navigation, and progressive section reveals.
- Interactive illustrative topology with selectable devices and a simulated trace; no network traffic is sent.
- Combined category filtering and technology search, including a `/` shortcut.
- Keyboard-accessible project dialogs, skill tabs, and experience disclosures.
- Motion preference control, OS reduced-motion support, and readable static content if JavaScript is unavailable.
- Real email/LinkedIn links and a clipboard fallback; there is no simulated contact submission.

## Maintenance

Keep visible cards in `index.html`, detailed case studies and skill panels in `portfolio.js`, and `resume.html` in sync. Update filter counts if adding projects. Styles are in `styles.css` and `network.css`; the topology behavior is in `network.js`. All links and assets use relative paths so deployment works under a GitHub Pages repository subpath.

Google Fonts is an optional typography enhancement with system fallbacks. There are no JavaScript libraries, analytics, credentials, external AI calls, or build steps.
