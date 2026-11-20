(() => {
  'use strict';

  const lab = document.querySelector('[data-network-topology]');
  const model = window.PortfolioNetworkModel;
  if (!lab || !model) return;

  const { sites, devices, links, scenarios, presets, trace } = model;
  const byId = new Map(devices.map((device) => [device.id, device]));
  const siteById = new Map(sites.map((site) => [site.id, site]));
  const devicesBySite = new Map(sites.map((site) => [
    site.id, devices.filter((device) => device.site === site.id),
  ]));
  const inputs = Object.fromEntries(
    ['scenario', 'preset', 'source', 'destination', 'site', 'run'].map((name) => [
      name, lab.querySelector(`[data-nt-${name}]`),
    ]),
  );
  const incident = lab.querySelector('[data-nt-incident]');
  const map = lab.querySelector('[data-nt-map]');
  const scroller = map.parentElement;
  const canvas = lab.querySelector('[data-nt-links]');
  const context = canvas.getContext('2d');
  const wan = lab.querySelector('[data-nt-wan]');
  const siteGrid = lab.querySelector('[data-nt-sites]');
  const readout = lab.querySelector('[data-nt-result]');
  const hops = lab.querySelector('[data-nt-hops]');
  const deviceTitle = lab.querySelector('[data-nt-device-title]');
  const deviceState = lab.querySelector('[data-nt-device-state]');
  const deviceContext = lab.querySelector('[data-nt-device-context]');
  const deviceDetail = lab.querySelector('[data-nt-device-detail]');
  const deviceAnnouncement = lab.querySelector('[data-nt-device-announcement]');
  const neighborList = lab.querySelector('[data-nt-neighbors]');
  const neighborSection = lab.querySelector('[data-nt-neighbor-list]');
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');

  const roles = {
    wan: ['W', 'WAN transport'],
    firewall: ['FW', 'Firewall'],
    router: ['R', 'Router'],
    core: ['C', 'Core or distribution switch'],
    switch: ['SW', 'Switch'],
    server: ['SV', 'Server'],
    endpoint: ['PC', 'Endpoint'],
    ap: ['AP', 'Access point'],
    phone: ['IP', 'IP phone'],
    printer: ['PR', 'Printer'],
  };
  const linkLabels = {
    primary: 'Primary WAN', backup: 'Backup path', backbone: 'Backbone',
    access: 'Access link', service: 'Service link',
  };
  const tiers = ['WAN', 'Edge', 'Core & distribution', 'Access & services', 'Endpoints'];
  const buttons = new Map();
  const sitePanels = new Map();
  const healthLabels = new Map();
  const siteHealth = new Map();
  const wanIds = new Set(devicesBySite.get('wan').map(({ id }) => id));
  let scenario = scenarios[0];
  let failedDevices = new Set();
  let failedLinks = new Set();
  let selectedDevice = null;
  let focusableDevice = null;
  let highlightedPath = [];
  let timer;
  let frame;

  function element(tag, className, content) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content) node.textContent = content;
    return node;
  }

  function option(value, label) {
    const node = element('option', '', label);
    node.value = value;
    return node;
  }

  function labelFor(id) {
    const device = byId.get(id);
    return `${device.name} (${siteById.get(device.site).name})`;
  }

  function makeDevice(device) {
    const [code, role] = roles[device.kind] || ['N', 'Network device'];
    const node = element('button', 'nt-node');
    const icon = element('span', 'nt-node-code', code);
    node.type = 'button';
    node.tabIndex = -1;
    node.dataset.device = device.id;
    node.dataset.kind = device.kind;
    node.setAttribute('aria-pressed', 'false');
    node.setAttribute('aria-controls', 'nt-device-inspector');
    node.setAttribute('aria-label', `${labelFor(device.id)}, ${role}`);
    icon.setAttribute('aria-hidden', 'true');
    node.append(icon, element('span', 'nt-node-name', device.name));
    node.addEventListener('click', () => selectDevice(device.id, true));
    node.addEventListener('focus', () => setFocusableDevice(device.id));
    buttons.set(device.id, node);
    return node;
  }

  function renderMap() {
    const wanSite = siteById.get('wan');
    const wanTrack = element('div', 'nt-wan-track');
    wan.append(element('h4', '', wanSite.name), wanTrack);
    wanTrack.append(...devicesBySite.get(wanSite.id).map(makeDevice));
    sitePanels.set(wanSite.id, wan);

    for (const site of sites.filter(({ id }) => id !== 'wan')) {
      const panel = element('section', 'nt-site');
      const header = element('div', 'nt-site-head');
      const title = element('h4', '', site.name);
      const health = element('span', 'nt-site-health');
      title.id = `nt-site-${site.id}`;
      panel.setAttribute('aria-labelledby', title.id);
      header.append(title, health);
      panel.append(header);
      for (let tierIndex = 1; tierIndex < tiers.length; tierIndex += 1) {
        const tier = element('div', 'nt-tier');
        tier.dataset.tier = tierIndex;
        const label = element('p', 'nt-tier-label', tiers[tierIndex]);
        const grid = element('div', 'nt-device-grid');
        grid.append(...devicesBySite.get(site.id)
          .filter((device) => device.tier === tierIndex).map(makeDevice));
        tier.append(label, grid);
        panel.append(tier);
      }
      siteGrid.append(panel);
      sitePanels.set(site.id, panel);
      healthLabels.set(site.id, health);
    }
  }

  function populateControls() {
    inputs.scenario.append(...scenarios.map(({ id, name }) => option(id, name)));
    inputs.preset.append(...presets.map(({ id, name }) => option(id, name)), option('custom', 'Custom path'));
    inputs.site.append(option('', 'Select a site'), ...sites.map(({ id, name }) => option(id, name)));
    for (const control of [inputs.source, inputs.destination]) {
      for (const site of sites) {
        const group = element('optgroup');
        group.label = site.name;
        group.append(...devicesBySite.get(site.id).map(({ id, name }) => option(id, name)));
        control.append(group);
      }
    }
    for (const input of Object.values(inputs)) input.disabled = false;
    usePreset(presets[0]);
  }

  function usePreset(preset) {
    if (!preset) return;
    inputs.source.value = preset.from;
    inputs.destination.value = preset.to;
  }

  function linkDown({ id, from, to }) {
    return failedLinks.has(id) || failedDevices.has(from) || failedDevices.has(to);
  }

  function updateSiteHealth() {
    for (const site of sites.filter(({ id }) => id !== 'wan')) {
      const edge = devicesBySite.get(site.id).find(({ tier }) => tier === 1);
      const outageCount = devicesBySite.get(site.id).filter(({ id }) => failedDevices.has(id)).length;
      const wanLinks = links.filter(({ from, to }) => (
        (from === edge.id && wanIds.has(to)) || (to === edge.id && wanIds.has(from))
      ));
      let health = 'healthy';
      let status = 'Connected';
      if (!wanLinks.some((link) => !linkDown(link))) {
        health = 'isolated';
        status = 'WAN isolated';
      } else if (outageCount) {
        health = 'fault';
        status = `${outageCount} device${outageCount === 1 ? '' : 's'} down`;
      } else if (wanLinks.some((link) => link.kind === 'primary' && linkDown(link))) {
        health = 'backup';
        status = 'Backup WAN';
      }
      siteHealth.set(site.id, health);
      sitePanels.get(site.id).dataset.health = health === 'isolated' ? 'fault' : health;
      healthLabels.get(site.id).textContent = status;
    }
  }

  function statusOf(device) {
    if (failedDevices.has(device.id)) return ['down', 'Down'];
    if (siteHealth.get(device.site) === 'isolated') return ['isolated', 'Up · WAN isolated'];
    if (siteHealth.get(device.site) === 'backup') return ['backup', 'Up · Backup WAN'];
    return ['up', 'Up'];
  }

  function selectDevice(id, announce = false) {
    const device = byId.get(id);
    if (!device) return;
    selectedDevice = id;
    for (const [buttonId, button] of buttons) {
      button.setAttribute('aria-pressed', String(buttonId === id));
    }
    const [, role] = roles[device.kind] || ['', 'Network device'];
    const [state, stateLabel] = statusOf(device);
    deviceTitle.textContent = device.name;
    deviceState.dataset.state = state;
    deviceState.textContent = stateLabel;
    deviceContext.textContent = `${siteById.get(device.site).name} · ${role} · ${device.segment}`;
    deviceDetail.textContent = device.description;
    neighborList.replaceChildren(...links
      .filter(({ from, to }) => from === id || to === id)
      .map((link) => {
        const neighbor = byId.get(link.from === id ? link.to : link.from);
        const entry = element('li', '', `${neighbor.name} · ${linkLabels[link.kind]}${linkDown(link) ? ' · down' : ''}`);
        if (linkDown(link)) entry.dataset.state = 'down';
        return entry;
      }));
    neighborSection.hidden = !neighborList.childElementCount;
    if (announce) {
      deviceAnnouncement.textContent = `${device.name}, ${stateLabel}. ${device.description}`;
    }
  }

  function setFocusableDevice(id) {
    if (focusableDevice) buttons.get(focusableDevice).tabIndex = -1;
    buttons.get(id).tabIndex = 0;
    focusableDevice = id;
  }

  function moveFocus(event) {
    const directions = {
      ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
    };
    const direction = directions[event.key];
    const active = event.target.closest('.nt-node');
    if (!direction || !active) return;
    const current = active.getBoundingClientRect();
    const centerX = current.left + current.width / 2;
    const centerY = current.top + current.height / 2;
    const [horizontal, vertical] = direction;
    let closest = null;
    let bestScore = Infinity;
    for (const button of buttons.values()) {
      const rect = button.getBoundingClientRect();
      const dx = rect.left + rect.width / 2 - centerX;
      const dy = rect.top + rect.height / 2 - centerY;
      const ahead = dx * horizontal + dy * vertical;
      if (ahead < 5) continue;
      const across = Math.abs(dx * vertical + dy * horizontal);
      const score = ahead + across * 2;
      if (score < bestScore) {
        closest = button;
        bestScore = score;
      }
    }
    if (closest) {
      event.preventDefault();
      closest.focus();
    }
  }

  function fewerAnimations() {
    return motionPreference.matches || document.documentElement.dataset.motion === 'off';
  }

  function jumpToSite(id) {
    const panel = sitePanels.get(id);
    if (!panel) return;
    const firstDevice = devicesBySite.get(id)[0];
    const target = id === 'wan' ? buttons.get(firstDevice.id) : panel;
    const horizontalSpace = scroller.clientWidth - target.offsetWidth;
    const left = target.getBoundingClientRect().left - map.getBoundingClientRect().left
      - Math.max(0, horizontalSpace / 2);
    scroller.scrollTo({ left, behavior: fewerAnimations() ? 'instant' : 'smooth' });
    setFocusableDevice(firstDevice.id);
    selectDevice(firstDevice.id, true);
  }

  function refreshScenario() {
    scenario = scenarios.find(({ id }) => id === inputs.scenario.value) || scenarios[0];
    failedDevices = new Set(scenario.failedDevices);
    failedLinks = new Set(scenario.failedLinks);
    const fault = failedDevices.size > 0 || failedLinks.size > 0;
    incident.classList.toggle('has-fault', fault);
    incident.replaceChildren(element('strong', '', scenario.name), element('span', '', scenario.summary));
    updateSiteHealth();
    for (const [id, node] of buttons) {
      const device = byId.get(id);
      const [state, status] = statusOf(device);
      const [, role] = roles[device.kind] || ['', 'Network device'];
      node.dataset.status = state;
      node.setAttribute('aria-label', `${labelFor(id)}, ${role}, ${status}`);
    }
    selectDevice(selectedDevice);
    resetTrace();
  }

  function scheduleCanvas() {
    if (frame === undefined) frame = window.requestAnimationFrame(drawCanvas);
  }

  function pointAt(points, fraction) {
    const lengths = points.slice(1).map(([x, y], index) => (
      Math.hypot(x - points[index][0], y - points[index][1])
    ));
    let remaining = lengths.reduce((total, length) => total + length, 0) * fraction;
    for (let index = 0; index < lengths.length; index += 1) {
      if (remaining <= lengths[index] && lengths[index]) {
        const [x, y] = points[index];
        const [nextX, nextY] = points[index + 1];
        const ratio = remaining / lengths[index];
        return [x + (nextX - x) * ratio, y + (nextY - y) * ratio];
      }
      remaining -= lengths[index];
    }
    return points[points.length - 1];
  }

  function linkPoints(link, coordinates) {
    const from = coordinates.get(link.from);
    const to = coordinates.get(link.to);
    const [upper, lower] = from.y <= to.y ? [from, to] : [to, from];
    if (Math.abs(from.y - to.y) < 4) {
      const [left, right] = from.x < to.x ? [from, to] : [to, from];
      return [[left.right, left.y], [right.left, right.y]];
    }
    const { x: topX, bottom } = upper;
    const { x: bottomX, top } = lower;
    const isWanLink = wanIds.has(link.from) || wanIds.has(link.to);
    if (isWanLink) {
      const isBackup = link.kind === 'backup';
      const midway = Math.min(bottom + (isBackup ? 34 : 21), top - 5);
      const dockX = bottomX + (isBackup ? 7 : -7);
      return [[topX, bottom], [topX, midway], [dockX, midway], [dockX, top]];
    }

    const lowerDevice = byId.get(lower.id);
    const endpointPeers = devicesBySite.get(lowerDevice.site)
      .filter(({ tier }) => tier === lowerDevice.tier).map(({ id }) => coordinates.get(id));
    const obstacle = endpointPeers.find((peer) => (
      peer.top < lower.top && Math.abs(peer.x - lower.x) < 4
    ));
    if (obstacle) {
      const leftLane = endpointPeers.some((peer) => peer.x > lower.x + 4);
      const sideX = leftLane ? lower.left : lower.right;
      const detourX = sideX + (leftLane ? -4 : 4);
      const branchY = (bottom + obstacle.top) / 2;
      return [[topX, bottom], [topX, branchY], [detourX, branchY], [detourX, lower.y], [sideX, lower.y]];
    }

    const midway = (bottom + top) / 2;
    return [[topX, bottom], [topX, midway], [bottomX, midway], [bottomX, top]];
  }

  function drawCanvas() {
    frame = undefined;
    if (!context) return;
    const bounds = map.getBoundingClientRect();
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(bounds.width * scale);
    const height = Math.round(bounds.height * scale);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    context.setTransform(scale, 0, 0, scale, 0, 0);
    context.clearRect(0, 0, bounds.width, bounds.height);
    const coordinates = new Map([...buttons].map(([id, node]) => {
      const rect = node.getBoundingClientRect();
      const left = rect.left - bounds.left;
      const top = rect.top - bounds.top;
      return [id, {
        id, left, right: left + rect.width, x: left + rect.width / 2,
        top, bottom: top + rect.height, y: top + rect.height / 2,
      }];
    }));
    const used = new Set();
    for (let index = 1; index < highlightedPath.length; index += 1) {
      const from = highlightedPath[index - 1];
      const to = highlightedPath[index];
      const link = links.find((item) => (
        (item.from === from && item.to === to) || (item.from === to && item.to === from)
      ));
      if (link) used.add(link.id);
    }

    const order = (link) => used.has(link.id) ? 2 : Number(linkDown(link));
    context.lineJoin = 'round';
    context.lineCap = 'round';
    for (const link of [...links].sort((a, b) => order(a) - order(b))) {
      const traced = used.has(link.id);
      const down = linkDown(link);
      const color = { primary: '#6ab8d1', backup: '#9392c8', backbone: '#678497',
        access: '#647d8e', service: '#609c89' }[link.kind] || '#678497';
      const points = linkPoints(link, coordinates);
      context.strokeStyle = traced ? '#a6f4c5' : down ? '#f4a987' : color;
      context.lineWidth = traced ? 2.5 : down ? 1.7 : 1.15;
      context.setLineDash(traced ? [] : down ? [1, 4] : link.kind === 'backup' ? [5, 5] : []);
      context.beginPath();
      context.moveTo(...points[0]);
      for (const point of points.slice(1)) context.lineTo(...point);
      context.stroke();
      if (down) {
        const [x, y] = wanIds.has(link.from) || wanIds.has(link.to)
          ? [points[3][0], points[2][1] + Math.min(7, (points[3][1] - points[2][1]) / 2)]
          : pointAt(points, .65);
        context.setLineDash([]);
        context.beginPath();
        context.moveTo(x - 3, y - 3);
        context.lineTo(x + 3, y + 3);
        context.moveTo(x + 3, y - 3);
        context.lineTo(x - 3, y + 3);
        context.stroke();
      }
    }
  }

  function paintPath(path, active = null) {
    highlightedPath = path;
    const activeIds = new Set(path);
    for (const [id, button] of buttons) {
      button.classList.toggle('is-traced', activeIds.has(id));
      button.classList.toggle('is-current', active === id);
    }
    scheduleCanvas();
  }

  function setResult(content, outcome = 'ready') {
    readout.textContent = content;
    readout.parentElement.dataset.outcome = outcome;
  }

  function resetTrace() {
    window.clearTimeout(timer);
    inputs.run.textContent = 'Run trace';
    hops.replaceChildren();
    hops.hidden = true;
    paintPath([]);
    setResult('Run a trace to see the path between the selected devices.');
  }

  function runTrace() {
    resetTrace();
    const from = inputs.source.value;
    const to = inputs.destination.value;
    if (from === to) {
      setResult('Choose two different devices to trace a path.', 'fail');
      return;
    }
    const route = trace(from, to, scenario.id);
    if (!route) {
      const down = [from, to].filter((id) => failedDevices.has(id));
      const reason = down.length
        ? `${down.map(labelFor).join(' and ')} ${down.length === 1 ? 'is' : 'are'} down.`
        : 'No surviving link path connects the selected devices in this scenario.';
      setResult(`Unreachable. ${reason}`, 'fail');
      return;
    }
    const normalRoute = trace(from, to, scenarios[0].id);
    const rerouted = normalRoute && route.join('|') !== normalRoute.join('|');
    const linkCount = route.length - 1;
    const success = `${rerouted ? 'Reachable via an alternate path' : 'Reachable'} across ${linkCount} ${linkCount === 1 ? 'link' : 'links'}.`;
    hops.replaceChildren(...route.map((id) => element('li', '', labelFor(id))));
    hops.hidden = false;

    function step(count) {
      if (count >= route.length || fewerAnimations()) {
        paintPath(route);
        setResult(success, 'pass');
        inputs.run.textContent = 'Run trace';
        return;
      }
      paintPath(route.slice(0, count), route[count - 1]);
      timer = window.setTimeout(() => step(count + 1), 120);
    }

    inputs.run.textContent = 'Tracing…';
    setResult(`Tracing from ${labelFor(from)} to ${labelFor(to)}.`);
    step(1);
  }

  renderMap();
  populateControls();
  const initialDevice = devices.find(({ site, tier }) => site !== 'wan' && tier === 1);
  setFocusableDevice(initialDevice.id);
  selectDevice(initialDevice.id);
  refreshScenario();
  inputs.scenario.addEventListener('change', refreshScenario);
  inputs.preset.addEventListener('change', () => {
    usePreset(presets.find(({ id }) => id === inputs.preset.value));
    if (inputs.preset.value === 'custom') lab.querySelector('[data-nt-custom]').open = true;
    resetTrace();
  });
  for (const input of [inputs.source, inputs.destination]) {
    input.addEventListener('change', () => {
      const matching = presets.find(({ from, to }) => (
        inputs.source.value === from && inputs.destination.value === to
      ));
      inputs.preset.value = matching ? matching.id : 'custom';
      resetTrace();
    });
  }
  inputs.site.addEventListener('change', () => jumpToSite(inputs.site.value));
  inputs.run.addEventListener('click', runTrace);
  map.addEventListener('keydown', moveFocus);
  if ('ResizeObserver' in window) new ResizeObserver(scheduleCanvas).observe(map);
  window.addEventListener('resize', scheduleCanvas);
  document.fonts?.ready.then(scheduleCanvas);
})();
