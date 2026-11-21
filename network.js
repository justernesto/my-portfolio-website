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
  const mapStatus = lab.querySelector('[data-nt-map-status]');
  const mapHint = mapStatus.textContent;
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
  let activeTrace = null;
  let layout;
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
    invalidateLayout();
    resetTrace();
  }

  function scheduleCanvas() {
    if (frame === undefined) frame = window.requestAnimationFrame(drawCanvas);
  }

  function invalidateLayout() {
    layout = undefined;
    scheduleCanvas();
  }

  function measurePath(points) {
    const distances = [0];
    let arrow;
    let longest = 0;
    for (let index = 1; index < points.length; index += 1) {
      const [x, y] = points[index - 1];
      const [nextX, nextY] = points[index];
      const length = Math.hypot(nextX - x, nextY - y);
      distances.push(distances[index - 1] + length);
      if (length > longest) {
        longest = length;
        arrow = [(x + nextX) / 2, (y + nextY) / 2, (nextX - x) / length, (nextY - y) / length];
      }
    }
    return { points, distances, length: distances[distances.length - 1], arrow };
  }

  function pointAt(path, distance) {
    const { points, distances } = path;
    for (let index = 1; index < points.length; index += 1) {
      const length = distances[index] - distances[index - 1];
      if (distance > distances[index] || !length) continue;
      const [x, y] = points[index - 1];
      const [nextX, nextY] = points[index];
      const progress = (distance - distances[index - 1]) / length;
      return [x + (nextX - x) * progress, y + (nextY - y) * progress];
    }
    return points[points.length - 1];
  }

  function strokePath(path, start = 0, end = path.length) {
    if (end <= start) return;
    context.beginPath();
    context.moveTo(...pointAt(path, start));
    path.distances.forEach((distance, index) => {
      if (distance > start && distance < end) context.lineTo(...path.points[index]);
    });
    context.lineTo(...pointAt(path, end));
    context.stroke();
  }

  function linkPoints(link, coordinates) {
    const from = coordinates.get(link.from);
    const to = coordinates.get(link.to);
    const [upper, lower] = from.y <= to.y ? [from, to] : [to, from];
    if (Math.abs(from.y - to.y) < 4) {
      const [left, right] = from.x < to.x ? [from, to] : [to, from];
      return { start: left.id, points: [[left.right, left.y], [right.left, right.y]] };
    }
    const { x: topX, bottom } = upper;
    const { x: bottomX, top } = lower;
    const isWanLink = wanIds.has(link.from) || wanIds.has(link.to);
    if (isWanLink) {
      const isBackup = link.kind === 'backup';
      const midway = Math.min(bottom + (isBackup ? 34 : 21), top - 5);
      const dockX = bottomX + (isBackup ? 7 : -7);
      return { start: upper.id, points: [[topX, bottom], [topX, midway], [dockX, midway], [dockX, top]] };
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
      return {
        start: upper.id,
        points: [[topX, bottom], [topX, branchY], [detourX, branchY], [detourX, lower.y], [sideX, lower.y]],
      };
    }

    const midway = (bottom + top) / 2;
    return { start: upper.id, points: [[topX, bottom], [topX, midway], [bottomX, midway], [bottomX, top]] };
  }

  function measureLayout() {
    const bounds = map.getBoundingClientRect();
    const coordinates = new Map([...buttons].map(([id, node]) => {
      const rect = node.getBoundingClientRect();
      const left = rect.left - bounds.left;
      const top = rect.top - bounds.top;
      return [id, {
        id, left, right: left + rect.width, x: left + rect.width / 2,
        top, bottom: top + rect.height, y: top + rect.height / 2,
      }];
    }));
    const paths = new Map(links.map((link) => {
      const { start, points } = linkPoints(link, coordinates);
      return [link.id, { start, path: measurePath(points), reverse: measurePath([...points].reverse()) }];
    }));
    return { width: bounds.width, height: bounds.height, paths };
  }

  function drawLinks() {
    for (const link of [...links].sort((a, b) => Number(linkDown(a)) - Number(linkDown(b)))) {
      const down = linkDown(link);
      const color = { primary: '#6ab8d1', backup: '#9392c8', backbone: '#678497',
        access: '#647d8e', service: '#609c89' }[link.kind] || '#678497';
      const { path } = layout.paths.get(link.id);
      const { points } = path;
      context.strokeStyle = down ? '#f4a987' : color;
      context.lineWidth = down ? 1.7 : 1.15;
      context.setLineDash(down ? [1, 4] : link.kind === 'backup' ? [5, 5] : []);
      strokePath(path);
      if (down) {
        const [x, y] = wanIds.has(link.from) || wanIds.has(link.to)
          ? [points[3][0], points[2][1] + Math.min(7, (points[3][1] - points[2][1]) / 2)]
          : pointAt(path, path.length * .65);
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

  function directedPath({ link, from }) {
    const geometry = layout.paths.get(link.id);
    return geometry.start === from ? geometry.path : geometry.reverse;
  }

  function drawTrail(path, distance) {
    context.strokeStyle = 'rgba(42, 223, 252, .28)';
    context.lineWidth = 6;
    strokePath(path, 0, distance);
    context.strokeStyle = '#58e8fd';
    context.lineWidth = 2.5;
    strokePath(path, 0, distance);
  }

  function drawArrow(path) {
    if (!path.arrow) return;
    const [x, y, dx, dy] = path.arrow;
    context.strokeStyle = '#c9faff';
    context.lineWidth = 1.75;
    context.beginPath();
    context.moveTo(x - dx * 4 - dy * 4, y - dy * 4 + dx * 4);
    context.lineTo(x + dx * 3, y + dy * 3);
    context.lineTo(x - dx * 4 + dy * 4, y - dy * 4 - dx * 4);
    context.stroke();
  }

  function drawPacket(path, distance) {
    const [x, y] = pointAt(path, distance);
    context.save();
    context.shadowColor = '#23e2ff';
    context.shadowBlur = 14;
    context.strokeStyle = '#bcfaff';
    context.lineWidth = 3.75;
    strokePath(path, Math.max(0, distance - 40), distance);
    context.fillStyle = '#e7fdff';
    context.beginPath();
    context.arc(x, y, 4.5, 0, Math.PI * 2);
    context.fill();
    context.restore();

    const viewport = scroller.clientWidth;
    if (layout.width <= viewport) return;
    const margin = Math.min(76, viewport / 4);
    const left = scroller.scrollLeft;
    if (x < left + margin) scroller.scrollLeft = x - margin;
    else if (x > left + viewport - margin) scroller.scrollLeft = x + margin - viewport;
  }

  function drawCanvas(timestamp) {
    frame = undefined;
    if (!context) return;
    layout ??= measureLayout();
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(layout.width * scale);
    const height = Math.round(layout.height * scale);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    context.setTransform(scale, 0, 0, scale, 0, 0);
    context.clearRect(0, 0, layout.width, layout.height);
    context.lineJoin = 'round';
    context.lineCap = 'round';
    drawLinks();
    if (!activeTrace) return;

    const progress = advanceTrace(timestamp);
    const { legs, currentLeg } = activeTrace;
    context.setLineDash([]);
    for (const leg of legs.slice(0, currentLeg)) {
      const path = directedPath(leg);
      drawTrail(path, path.length);
      drawArrow(path);
    }
    if (currentLeg < legs.length) {
      const path = directedPath(legs[currentLeg]);
      const distance = path.length * progress;
      drawTrail(path, distance);
      drawPacket(path, distance);
      scheduleCanvas();
    }
  }

  function showTraceProgress() {
    const { route = [], legs = [], currentLeg = -1 } = activeTrace || {};
    const visited = new Set(route.slice(0, currentLeg + 1));
    const active = legs[currentLeg];
    for (const [id, button] of buttons) {
      button.classList.toggle('is-traced', visited.has(id));
      button.classList.toggle('is-current', active?.from === id);
      button.classList.toggle('is-next', active?.to === id);
      button.classList.toggle('is-arrived', currentLeg === legs.length && route[currentLeg] === id);
    }
    [...hops.children].forEach((hop, index) => {
      if (active && index === currentLeg) hop.setAttribute('aria-current', 'step');
      else hop.removeAttribute('aria-current');
    });
    mapStatus.classList.toggle('has-trace', Boolean(activeTrace));
    if (active) {
      mapStatus.textContent = `Hop ${currentLeg + 1} of ${legs.length} · ${labelFor(active.from)} → ${labelFor(active.to)}`;
    } else {
      mapStatus.textContent = activeTrace ? `Packet arrived at ${labelFor(route[currentLeg])}.` : mapHint;
    }
  }

  function finishTrace() {
    activeTrace.currentLeg = activeTrace.legs.length;
    showTraceProgress();
    setResult(activeTrace.success, 'pass');
    inputs.run.textContent = 'Replay trace';
  }

  function advanceTrace(timestamp) {
    const { legs, currentLeg } = activeTrace;
    if (currentLeg === legs.length) return 0;
    if (fewerAnimations()) {
      finishTrace();
      return 0;
    }
    activeTrace.startedAt ??= timestamp;
    activeTrace.duration ??= Math.min(1100, Math.max(440, directedPath(legs[currentLeg]).length * 1.35 + 260));
    // Hold the packet at each device briefly before starting the next leg.
    const progress = Math.max(0, (timestamp - activeTrace.startedAt - 140) / activeTrace.duration);
    if (progress < 1) return progress;

    activeTrace.currentLeg += 1;
    activeTrace.startedAt = timestamp;
    activeTrace.duration = undefined;
    if (activeTrace.currentLeg === legs.length) finishTrace();
    else showTraceProgress();
    return 0;
  }

  function setResult(content, outcome = 'ready') {
    readout.textContent = content;
    readout.parentElement.dataset.outcome = outcome;
  }

  function resetTrace() {
    activeTrace = null;
    inputs.run.textContent = 'Run trace';
    hops.replaceChildren();
    hops.hidden = true;
    showTraceProgress();
    scheduleCanvas();
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

    const legs = route.slice(1).map((to, index) => {
      const from = route[index];
      const link = links.find((item) => (
        (item.from === from && item.to === to) || (item.from === to && item.to === from)
      ));
      return { from, to, link };
    });
    activeTrace = { route, legs, success, currentLeg: 0 };
    if (fewerAnimations() || !context) {
      finishTrace();
      return;
    }

    inputs.run.textContent = 'Restart trace';
    setResult(`Tracing from ${labelFor(from)} to ${labelFor(to)}.`);
    showTraceProgress();
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
  if ('ResizeObserver' in window) new ResizeObserver(invalidateLayout).observe(map);
  window.addEventListener('resize', invalidateLayout);
  document.fonts?.ready.then(invalidateLayout);
})();
