(function portfolioNetworkDemo() {
  'use strict';

  var root = document.querySelector('.network-demo');
  if (!root || root.dataset.networkInitialized === 'true') return;
  root.dataset.networkInitialized = 'true';

  var nodes = Array.from(root.querySelectorAll('[data-network-node]'));
  var detail = root.querySelector('#network-demo-detail');
  var status = root.querySelector('[data-network-status]');
  var traceButton = root.querySelector('[data-network-trace]');
  var routes = Array.from(root.querySelectorAll('[data-network-route]'));
  var timers = [];
  var descriptions = {
    gateway: ['Gateway.', 'Connects the local network to other networks and routes traffic between them.'],
    core: ['Core switch.', 'Connects local devices and carries traffic between them.'],
    workstation: ['Workstation.', 'A user device that reaches shared services through the core switch.'],
    directory: ['Directory server.', 'Provides a central place to manage identities and access to shared resources.'],
    wireless: ['Wireless access point.', 'Bridges wireless devices onto the local network.']
  };

  function selectNode(key) {
    var description = descriptions[key];
    if (!description) return;
    nodes.forEach(function (node) {
      node.setAttribute('aria-pressed', String(node.dataset.networkNode === key));
    });
    var title = document.createElement('strong');
    title.textContent = description[0];
    detail.replaceChildren(title, document.createTextNode(' ' + description[1]));
  }

  function clearTrace() {
    timers.forEach(function (timer) { window.clearTimeout(timer); });
    timers = [];
    nodes.forEach(function (node) { node.classList.remove('is-traced'); });
    routes.forEach(function (route) { route.classList.remove('is-traced'); });
    traceButton.disabled = false;
    traceButton.removeAttribute('aria-busy');
  }

  function markNode(key) {
    var node = nodes.find(function (candidate) { return candidate.dataset.networkNode === key; });
    if (node) node.classList.add('is-traced');
  }

  function markRoute(key) {
    routes.forEach(function (route) {
      if (route.dataset.networkRoute === key) route.classList.add('is-traced');
    });
  }

  nodes.forEach(function (node) {
    node.addEventListener('click', function () {
      clearTrace();
      status.textContent = '';
      selectNode(node.dataset.networkNode);
    });
  });

  traceButton.addEventListener('click', function () {
    clearTrace();
    var reducedMotion = document.documentElement.dataset.motion === 'off' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function finish() {
      ['gateway', 'core', 'workstation'].forEach(markNode);
      ['gateway', 'workstation'].forEach(markRoute);
      selectNode('workstation');
      status.textContent = 'Demo trace complete: Gateway → Core switch → Workstation. No live network traffic is sent.';
      traceButton.disabled = false;
      traceButton.removeAttribute('aria-busy');
    }

    if (reducedMotion) {
      finish();
      return;
    }

    traceButton.disabled = true;
    traceButton.setAttribute('aria-busy', 'true');
    markNode('gateway');
    selectNode('gateway');
    status.textContent = 'Demo trace: starting at the gateway.';

    timers.push(window.setTimeout(function () {
      markRoute('gateway');
      markNode('core');
      selectNode('core');
      status.textContent = 'Demo trace: the core switch forwards traffic toward the workstation.';
    }, 650));
    timers.push(window.setTimeout(finish, 1400));
  });
}());
