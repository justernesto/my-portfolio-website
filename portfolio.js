(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const html = document.documentElement;
  const motionButton = $('#motion-toggle');
  const systemMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let savedMotion;
  try { savedMotion = localStorage.getItem('ec-motion'); } catch (_) { /* Preference storage is optional. */ }

  function setMotion(value) {
    const paused = systemMotion.matches || value === 'off';
    html.dataset.motion = paused ? 'off' : 'on';
    motionButton.setAttribute('aria-pressed', String(paused));
    motionButton.setAttribute('aria-label', systemMotion.matches ? 'Animations reduced by your system settings' : paused ? 'Enable animation' : 'Pause animation');
    motionButton.title = motionButton.getAttribute('aria-label');
    motionButton.disabled = systemMotion.matches;
    if (paused) $$('.reveal').forEach(item => { item.classList.remove('pending'); item.classList.add('visible'); });
  }
  setMotion(savedMotion);
  motionButton.addEventListener('click', () => {
    savedMotion = html.dataset.motion === 'off' ? 'on' : 'off';
    setMotion(savedMotion);
    try { localStorage.setItem('ec-motion', savedMotion); } catch (_) { /* The control also works without storage. */ }
  });
  systemMotion.addEventListener('change', () => setMotion(savedMotion));

  if ('IntersectionObserver' in window && html.dataset.motion !== 'off') {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.remove('pending');
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.05 });
    html.classList.add('js-motion');
    $$('.reveal').forEach(element => { element.classList.add('pending'); observer.observe(element); });
  }

  const menuButton = $('.menu-toggle');
  const nav = $('#navigation');
  function closeMenu() {
    nav.classList.remove('open');
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', 'Open navigation');
  }
  menuButton.addEventListener('click', () => {
    const open = menuButton.getAttribute('aria-expanded') !== 'true';
    nav.classList.toggle('open', open);
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  });
  $$('a', nav).forEach(link => link.addEventListener('click', closeMenu));
  document.addEventListener('click', event => { if (!nav.contains(event.target) && !menuButton.contains(event.target)) closeMenu(); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && nav.classList.contains('open')) { closeMenu(); menuButton.focus(); }
  });
  window.matchMedia('(min-width: 801px)').addEventListener('change', closeMenu);
  if ('IntersectionObserver' in window) {
    const sectionObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) $$('a', nav).forEach(link => {
          if (link.hash === `#${entry.target.id}`) link.setAttribute('aria-current', 'location');
          else link.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-20% 0px -65% 0px', threshold: 0 });
    $$('main section[id]').forEach(section => sectionObserver.observe(section));
  }
  const progress = $('.scroll-progress');
  let ticking = false;
  function updateProgress() {
    const scrollable = html.scrollHeight - window.innerHeight;
    progress.style.width = `${scrollable > 0 ? Math.min(100, window.scrollY / scrollable * 100) : 0}%`;
    ticking = false;
  }
  window.addEventListener('scroll', () => { if (!ticking) { window.requestAnimationFrame(updateProgress); ticking = true; } }, { passive: true });
  window.addEventListener('resize', updateProgress);
  updateProgress();
  $('#year').textContent = new Date().getFullYear();

  const projects = {
    windows: {
      title: 'Inside a Windows domain', status: 'Hands-on home lab · Windows Server 2022 / Windows 11',
      intro: 'A VMware environment for practicing identity administration, connectivity troubleshooting, and host-level security investigation.',
      tags: ['VMware', 'Active Directory', 'Group Policy', 'DNS / DHCP', 'NTFS', 'PowerShell', 'Sysmon'],
      sections: [
        ['The objective', 'Understand how a Windows domain works as a whole: identity, policy, name resolution, addressing, and the telemetry that helps explain activity on a host.'],
        ['What I practiced', ['Built an Active Directory domain with Windows 11 clients and managed users and groups.', 'Configured Group Policy, NTFS permissions, and DNS/DHCP in the lab environment.', 'Tested DNS failures and APIPA/DHCP behavior using structured troubleshooting and verification.', 'Deployed Sysmon and reviewed Event ID 1 process-creation records, including PowerShell activity, in Event Viewer.']],
        ['Why it matters in operations', 'The same methodical approach helps separate account, endpoint, and network issues during support triage. Reading host telemetry adds context when a problem needs security escalation.'],
        ['Project context', 'Independent home lab documented in my résumé. This portfolio summarizes the work; no production incident data or raw event captures are published here.']
      ], links: [{ label: 'View résumé', href: 'resume.html' }]
    },
    ble: {
      title: 'Making Bluetooth observable', status: 'Toolkit source built · October 2026',
      intro: 'A four-tool Python workflow that moves from Bluetooth Low Energy advertisement discovery to structured GATT inventory and offline ATT analysis.',
      tags: ['Python', 'asyncio', 'Bleak', 'CoreBluetooth', 'GATT / ATT', 'tshark', 'JSONL / CSV'],
      sections: [
        ['The objective', 'Make device observations easier to collect, inspect, and compare through small, focused tools and structured output formats.'],
        ['The toolkit', ['scan_identify.py inventories advertisements, service UUIDs, manufacturer data, and RSSI as JSONL observations.', 'gatt_snapshot.py exports service, characteristic, and descriptor metadata without reading or writing characteristic values.', 'att_timeline.py uses tshark to turn PacketLogger or pcapng captures into normalized ATT event timelines and payload comparisons.', 'notify_capture.py provides optional notification recording for selected characteristics.']],
        ['What it demonstrates', 'Protocol curiosity, asynchronous Python, command-line tooling, and a preference for observable, repeatable investigation workflows.'],
        ['Current state', 'The source toolkit and documentation exist. Captured device results, hardware validation, and a protocol reverse-engineering result are not claimed. Device identifiers and raw captures are excluded from this public portfolio.']
      ], links: []
    },
    fielddesk: {
      title: 'Fielddesk', status: 'Live IT support chatbot · Web search and citations',
      intro: 'I built Fielddesk for everyday IT questions that start with a symptom. It gives the user a short troubleshooting plan and can look up documentation when an answer depends on a product, version, or current behavior.',
      tags: ['Node.js', 'JavaScript', 'Groq', 'Browser search', 'Vercel'],
      sections: [
        ['Try a support scenario', ['Pick one of six starters for devices, connectivity, apps, printing, accounts, or VPN. For example, try the Devices starter for a wireless keyboard that stopped working while its mouse still responds.', 'Follow up with the device model or the result of a check. Fielddesk uses recent conversation context to suggest what to try next.']],
        ['How sources work', 'Routine questions get a direct answer. When a question needs verification, Fielddesk can use Groq browser search and prefers official vendor documentation. The server checks cited URLs against retrieved results, and “View sources” opens the matching references.'],
        ['What I built', 'The JavaScript workspace offers conversation history, pinning, and archiving in the browser. A Node.js API bounds the context sent to Groq and keeps the provider key on the server. Vercel hosts the app and limits requests to the public chat endpoint.'],
        ['How it complements Ops Copilot', 'Fielddesk answers open-ended support questions and can consult web documentation. Ops Copilot matches symptoms to a curated set of runbooks for repeatable triage and handoffs.']
      ], links: [
        { label: 'Try Fielddesk live', href: 'https://fielddesk-silk.vercel.app/' },
        { label: 'Compare with Ops Copilot', href: 'https://ai-agents-omega-nine.vercel.app/', secondary: true }
      ]
    },
    ai: {
      title: 'Ops Copilot', status: 'Live demo · 67 runbooks across 11 IT support topics',
      intro: 'I built Ops Copilot for the first few minutes of a support ticket. It helps technicians narrow the symptom, choose the next check, verify recovery, and record what the next team needs to know.',
      tags: ['Next.js', 'TypeScript', 'Python', 'FastAPI', 'Docker Compose', 'Gemini'],
      sections: [
        ['The runbook library', ['The catalog has 67 runbooks and 335 checks across 11 topics. Search by symptom or filter by topic. Coverage includes VPN and DNS, identity and access, endpoints and mobile devices, remote desktops, email and collaboration, file recovery, security reports, and incident response.', 'Each guide helps establish who is affected, distinguish likely causes, verify recovery, and record evidence or an escalation handoff.']],
        ['What you can try', ['Start with a Wi-Fi, DNS, MFA, or handoff example, or enter a fictional symptom such as “My print job is stuck in the queue.”', 'Read the suggested checks and open the cited runbook to review the original guidance. Ask a short follow-up or start a new conversation to try another issue.']],
        ['How it matches a ticket', 'The Next.js browser demo, FastAPI service, and Python CLI share one catalog. Matching gives specific symptom phrases priority over broader terms. An explicit handoff request opens the shift handoff guide.'],
        ['Where Gemini fits', 'The public app starts in browser mode with no account or API key. Connect to the hosted API to try Gemini prioritization. Gemini orders the checks in the selected guide, and the API validates that order. The app falls back to the default runbook order when the shared request limit is reached or Gemini is unavailable.'],
        ['Deployment and verification', 'The demo is hosted on Vercel. Docker Compose also supports running the frontend and API on your own computer. Offline tests cover issue matching, context isolation, input validation, provider fallback, and shared quota handling. I verified catalog search and runbook citations in the public demo.']
      ], links: [
        { label: 'Try the live demo', href: 'https://ai-agents-omega-nine.vercel.app/' },
        { label: 'View source on GitHub', href: 'https://github.com/justernesto/ai-agents', secondary: true },
        { label: 'See the runbook expansion', href: 'https://github.com/justernesto/ai-agents/pull/4', secondary: true }
      ]
    },
    ccna: {
      title: 'Building stronger network instincts', status: 'CCNA studies · Lab roadmap in progress · November 2026',
      intro: 'A structured study package that connects networking fundamentals with an enterprise-style Packet Tracer lab plan.',
      tags: ['Cisco IOS', 'Packet Tracer', 'VLSM', 'VLANs', 'OSPF', 'IPv6', 'NAT / PAT', 'ACLs'],
      sections: [
        ['The learning plan', ['Switching: VLANs and trunks, STP, LACP, and inter-VLAN routing.', 'Addressing and routing: VLSM, IPv6, and OSPF.', 'Network services and access: DHCP/DNS, NAT/PAT, SSH, and ACLs.', 'Troubleshooting: repeatable verification steps, fault isolation, and documented recovery.']],
        ['The capstone design', 'The package includes a staged enterprise network specification, an acceptance-test checklist, and a fault catalog. These define what to build and verify as the lab progresses.'],
        ['Current state', 'The study and lab-design materials are authored. The package does not include generated or tested .pkt files, and the capstone acceptance tests are planned criteria rather than observed results. CCNA studies are in progress; I am not yet CCNA certified.'],
        ['Why I’m investing in it', 'A stronger understanding of switching, routing, and services supports the network diagnostics I perform in field services today.']
      ], links: []
    }
  };

  const dialog = $('#project-dialog');
  let dialogTrigger = null;
  function openProject(key, trigger) {
    const project = projects[key];
    if (!project) return;
    dialogTrigger = trigger || document.activeElement;
    $('#dialog-title').textContent = project.title;
    $('#dialog-status').textContent = project.status;
    $('#dialog-intro').textContent = project.intro;
    $('#dialog-tags').replaceChildren(...project.tags.map(tag => { const node = document.createElement('span'); node.textContent = tag; return node; }));
    $('#dialog-sections').replaceChildren(...project.sections.map(([title, content]) => {
      const section = document.createElement('section'); section.className = 'case-section';
      const heading = document.createElement('h3'); heading.textContent = title; section.append(heading);
      if (Array.isArray(content)) {
        const list = document.createElement('ul'); content.forEach(text => { const item = document.createElement('li'); item.textContent = text; list.append(item); }); section.append(list);
      } else { const paragraph = document.createElement('p'); paragraph.textContent = content; section.append(paragraph); }
      return section;
    }));
    $('#dialog-links').replaceChildren(...project.links.map(item => {
      const link = document.createElement('a'); link.className = item.secondary ? 'button secondary' : 'button primary'; link.textContent = item.label; link.href = item.href;
      link.target = '_blank'; link.rel = 'noopener noreferrer'; return link;
    }));
    dialog.showModal(); dialog.scrollTop = 0; document.body.style.overflow = 'hidden';
    $('.dialog-close', dialog).focus({ preventScroll: true });
  }
  $$('[data-open]').forEach(button => button.addEventListener('click', () => openProject(button.dataset.open, button)));
  $('.dialog-close', dialog).addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target === dialog) {
      const bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
    }
  });
  dialog.addEventListener('close', () => { document.body.style.overflow = ''; dialogTrigger?.focus({ preventScroll: true }); });

  let selectedFilter = 'all';
  const search = $('#project-search');
  const projectCards = $$('.project-card');
  const filters = $$('[data-filter]');
  function filterProjects() {
    const terms = search.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
    let count = 0;
    projectCards.forEach(card => {
      const categoryMatch = selectedFilter === 'all' || card.dataset.category.split(' ').includes(selectedFilter);
      const haystack = `${card.dataset.search} ${card.textContent}`.toLowerCase();
      const matches = categoryMatch && terms.every(term => haystack.includes(term));
      card.hidden = !matches;
      if (matches) { count += 1; card.classList.remove('pending'); card.classList.add('visible'); }
    });
    $('#project-count').textContent = `Showing ${count} ${count === 1 ? 'project' : 'projects'}`;
    $('#no-results').hidden = count > 0;
    updateProgress();
  }
  filters.forEach(button => button.addEventListener('click', () => {
    selectedFilter = button.dataset.filter;
    filters.forEach(filter => { const active = filter === button; filter.classList.toggle('active', active); filter.setAttribute('aria-pressed', String(active)); });
    filterProjects();
  }));
  search.addEventListener('input', filterProjects);
  $('#clear-search').addEventListener('click', () => { search.value = ''; filters[0].click(); search.focus(); });
  document.addEventListener('keydown', event => {
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
    if (event.key === '/' && !event.ctrlKey && !event.metaKey && !typing && !dialog.open) { event.preventDefault(); search.focus(); }
  });

  const toolkitData = {
    networks: { context: 'PRODUCTION EXPERIENCE + CONTINUED STUDY', title: 'Follow the connection.\nFind the cause.', description: 'From a physical switch port to a default gateway, I work through connectivity problems methodically and coordinate fixes with the right team.', tags: ['TCP/IP', 'VLANs', 'DNS / DHCP', 'VPN', 'UniFi', 'LAN / WAN'], evidence: 'Explore the network lab', href: '#network-lab' },
    systems: { context: 'ENTERPRISE SUPPORT + HOME LAB', title: 'Help people get access.\nKeep the environment usable.', description: 'Windows and macOS support, Microsoft 365 accounts, identity troubleshooting, and hands-on domain administration practice in a VMware lab.', tags: ['Active Directory', 'MFA', 'Microsoft 365', 'Windows / macOS', 'Group Policy', 'VMware'], evidence: 'Explore the Windows lab', project: 'windows' },
    security: { context: 'CYBERSECURITY CERTIFICATES + LAB PRACTICE', title: 'Look for context.\nDocument what the evidence says.', description: 'I combine disciplined support triage with security coursework and home-lab process telemetry, using logs to understand what happened on a host.', tags: ['Sysmon Event ID 1', 'Event Viewer', 'PowerShell', 'NTFS permissions', 'Triage & escalation'], evidence: 'Explore security monitoring practice', project: 'windows' },
    ai: { context: 'LIVE PROJECTS', title: 'Make AI useful\nin everyday IT operations.', description: 'Fielddesk answers everyday support questions and can look up vendor documentation. Ops Copilot matches symptoms to 67 runbooks with verification and handoff guidance.', tags: ['Node.js', 'Groq', 'Browser search', 'Next.js', 'FastAPI', 'Gemini'], evidence: 'Explore the Ops Copilot case study', project: 'ai' }
  };
  let activeToolkit = 'networks';
  const toolkitTabs = $$('[data-toolkit]');
  const toolkitEvidence = $('#toolkit-evidence');
  function selectToolkit(tab, focus = false) {
    const key = tab.dataset.toolkit; const item = toolkitData[key]; activeToolkit = key;
    toolkitTabs.forEach(candidate => { const active = candidate === tab; candidate.setAttribute('aria-selected', String(active)); candidate.tabIndex = active ? 0 : -1; });
    $('#toolkit-panel').setAttribute('aria-labelledby', tab.id);
    $('#toolkit-context').textContent = item.context; $('#toolkit-title').textContent = item.title;
    $('#toolkit-description').textContent = item.description;
    $('#toolkit-tags').replaceChildren(...item.tags.map(text => { const tag = document.createElement('span'); tag.textContent = text; return tag; }));
    toolkitEvidence.textContent = item.evidence; toolkitEvidence.href = item.project ? '#work' : item.href;
    if (item.project) toolkitEvidence.setAttribute('aria-haspopup', 'dialog'); else toolkitEvidence.removeAttribute('aria-haspopup');
    if (focus) tab.focus();
  }
  toolkitTabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectToolkit(tab));
    tab.addEventListener('keydown', event => {
      let next;
      if (['ArrowDown', 'ArrowRight'].includes(event.key)) next = (index + 1) % toolkitTabs.length;
      if (['ArrowUp', 'ArrowLeft'].includes(event.key)) next = (index - 1 + toolkitTabs.length) % toolkitTabs.length;
      if (event.key === 'Home') next = 0; if (event.key === 'End') next = toolkitTabs.length - 1;
      if (next !== undefined) { event.preventDefault(); selectToolkit(toolkitTabs[next], true); }
    });
  });
  toolkitEvidence.addEventListener('click', event => { const key = toolkitData[activeToolkit].project; if (key) { event.preventDefault(); openProject(key, toolkitEvidence); } });

  $('#copy-email').addEventListener('click', async () => {
    const status = $('#copy-status');
    try {
      if (!navigator.clipboard || !window.isSecureContext) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText('nesdancard@gmail.com');
      status.textContent = 'Email copied. Let’s connect!';
    } catch (_) { status.textContent = 'Select and copy: nesdancard@gmail.com'; }
  });
})();
