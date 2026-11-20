# Ernesto Cardenas — Portfolio

A dependency-free static portfolio for GitHub Pages. Open `index.html`, or preview with `python3 -m http.server 4173`.

## Content

- Current systems administration and remote field services work at Carvana, plus Quick Quack Car Wash, MGA Entertainment, and Partners Personnel experience.
- Fielddesk, a live IT support chatbot with step-by-step checks, Groq browser search, clickable source citations, and follow-up context. [Live demo](https://fielddesk-silk.vercel.app/)
- Ops Copilot, a live IT support assistant with 67 searchable runbooks across 11 topics, source citations, verification and handoff guidance, and optional Gemini prioritization. It runs on Vercel and supports local Docker Compose deployment. [Live demo](https://ai-agents-omega-nine.vercel.app/) · [GitHub source](https://github.com/justernesto/ai-agents) · [Runbook expansion](https://github.com/justernesto/ai-agents/pull/4)
- Windows domain/security home lab, BLE tooling, and a CCNA study/lab roadmap.
- A printable résumé at `resume.html`, verified email, and LinkedIn at https://www.linkedin.com/in/nescardenas.

Experience, credentials, and lab descriptions were reconciled with the latest résumé and existing lab materials in November 2026. CCNA is in progress. The Bluetooth toolkit is source implementation without claimed hardware results. The AI project is an independent prototype. No employment duration total or unsupported project results are asserted.

## Features

- Responsive layout, accessible mobile navigation, and progressive section reveals.
- Interactive network lab with 30 devices, 35 links, and four sites. Trace a path, inspect a device and its neighbors, or simulate outages such as WAN failover and branch isolation. The visualization runs on a fictional graph in the browser.
- Combined category filtering and technology search, including a `/` shortcut.
- Keyboard-accessible project dialogs, skill tabs, and experience disclosures.
- Motion preference control, OS reduced-motion support, and readable static content if JavaScript is unavailable.
- Real email/LinkedIn links and a clipboard fallback; there is no simulated contact submission.

## Maintenance

Keep visible cards in `index.html`, detailed case studies and skill panels in `portfolio.js`, and `resume.html` in sync. Update filter counts if adding projects. Use `network-model.js` for topology devices, links, scenarios, and route tracing. The lab UI uses `network.js` and `network.css`. Site styles and project showcase styles are in `styles.css` and `showcase.css`. Internal links and assets use relative paths for GitHub Pages.

Google Fonts is an optional typography enhancement with system fallbacks. There are no JavaScript libraries, analytics, credentials, external AI calls, or build steps.
