(() => {
  'use strict';

  const sites = [
    { id: 'wan', name: 'Shared WAN', label: 'WAN', description: 'Two independent WAN transports connect the four sites.' },
    { id: 'hq', name: 'HQ campus', label: 'HQ', description: 'Corporate offices with separate wired, voice, and wireless access.' },
    { id: 'west', name: 'West Branch', label: 'WEST', description: 'A field office with workstations, wireless access, and shared printing.' },
    { id: 'east', name: 'East Branch', label: 'EAST', description: 'A remote branch with staff devices, wireless access, and point-of-sale equipment.' },
    { id: 'dc', name: 'Data Center', label: 'DC', description: 'Shared DNS, identity, and business application services on a dual-core network.' },
  ];

  const devices = [
    { id: 'wan-primary', site: 'wan', name: 'Primary WAN', kind: 'wan', tier: 0, segment: 'Preferred transport', description: 'Carries inter-site traffic in the healthy state. Each site connects through its own circuit.' },
    { id: 'wan-backup', site: 'wan', name: 'Backup WAN', kind: 'wan', tier: 0, segment: 'Secondary transport', description: 'Provides a separate path between sites if a primary circuit is unavailable.' },

    { id: 'hq-edge', site: 'hq', name: 'HQ firewall', kind: 'firewall', tier: 1, segment: 'WAN edge', description: 'Connects the campus to both WAN transports and provides a policy boundary between the campus and external routes.' },
    { id: 'hq-core', site: 'hq', name: 'Campus core', kind: 'core', tier: 2, segment: 'Campus backbone', description: 'Aggregates the wired and wireless access switches and provides the campus routing layer.' },
    { id: 'hq-office-switch', site: 'hq', name: 'Office access', kind: 'switch', tier: 3, segment: 'Staff and voice VLANs', description: 'Brings desktops and phones onto separate logical networks over the same access switch.' },
    { id: 'hq-wireless-switch', site: 'hq', name: 'Wireless access', kind: 'switch', tier: 3, segment: 'Wireless uplinks', description: 'Powers the campus access point and carries the wireless network segments back to the campus core.' },
    { id: 'hq-laptop', site: 'hq', name: 'Staff laptop', kind: 'endpoint', tier: 4, segment: 'Staff VLAN', description: 'A corporate endpoint used to verify the path from campus to shared services.' },
    { id: 'hq-phone', site: 'hq', name: 'Desk phone', kind: 'phone', tier: 4, segment: 'Voice VLAN', description: 'An IP phone placed on a dedicated voice segment so voice traffic can be managed separately.' },
    { id: 'hq-ap', site: 'hq', name: 'Campus AP', kind: 'ap', tier: 4, segment: 'Staff and guest Wi-Fi', description: 'Provides wireless access and maps the staff and guest SSIDs to separate logical segments.' },

    { id: 'west-edge', site: 'west', name: 'West router', kind: 'router', tier: 1, segment: 'Dual WAN edge', description: 'Uses the primary WAN in the healthy state and the secondary transport when its preferred circuit fails.' },
    { id: 'west-distribution', site: 'west', name: 'West distribution', kind: 'core', tier: 2, segment: 'Branch backbone', description: 'Aggregates branch VLANs and forwards traffic upstream to the West router.' },
    { id: 'west-access', site: 'west', name: 'West access', kind: 'switch', tier: 3, segment: 'Wired and wireless access', description: 'Connects the local workstation, printer, and access point to the branch network.' },
    { id: 'west-workstation', site: 'west', name: 'Workstation', kind: 'endpoint', tier: 4, segment: 'Staff VLAN', description: 'Represents the West Branch user connecting to the shared business application.' },
    { id: 'west-ap', site: 'west', name: 'West AP', kind: 'ap', tier: 4, segment: 'Branch Wi-Fi', description: 'Provides local wireless access through its uplink to the branch access switch.' },
    { id: 'west-printer', site: 'west', name: 'Network printer', kind: 'printer', tier: 4, segment: 'Printer VLAN', description: 'Sits on a separate device segment from staff workstations.' },

    { id: 'east-edge', site: 'east', name: 'East router', kind: 'router', tier: 1, segment: 'Dual WAN edge', description: 'Connects the East Branch to both transports. Losing both circuits isolates the branch from the other sites.' },
    { id: 'east-distribution', site: 'east', name: 'East distribution', kind: 'core', tier: 2, segment: 'Branch backbone', description: 'Aggregates East Branch VLANs and forwards inter-site traffic to the edge router.' },
    { id: 'east-access', site: 'east', name: 'East access', kind: 'switch', tier: 3, segment: 'Wired and wireless access', description: 'Connects branch staff devices, the access point, and the sales terminal.' },
    { id: 'east-workstation', site: 'east', name: 'Workstation', kind: 'endpoint', tier: 4, segment: 'Staff VLAN', description: 'A staff endpoint that uses the central DNS and identity services across the WAN.' },
    { id: 'east-ap', site: 'east', name: 'East AP', kind: 'ap', tier: 4, segment: 'Branch Wi-Fi', description: 'A locally powered access point. Its physical network path within the branch remains when the WAN is cut.' },
    { id: 'east-pos', site: 'east', name: 'Sales terminal', kind: 'endpoint', tier: 4, segment: 'Point-of-sale VLAN', description: 'A sales endpoint on its own network segment. WAN isolation can interrupt its access to remote services.' },

    { id: 'dc-edge', site: 'dc', name: 'Data center edge', kind: 'firewall', tier: 1, segment: 'WAN edge', description: 'Terminates both WAN transports at the data center and connects to two internal cores.' },
    { id: 'dc-core-a', site: 'dc', name: 'Core A', kind: 'core', tier: 2, segment: 'Preferred core', description: 'The preferred forwarding path between the data center edge and the services and storage switches.' },
    { id: 'dc-core-b', site: 'dc', name: 'Core B', kind: 'core', tier: 2, segment: 'Secondary core', description: 'Provides a second path from the edge to the services and storage switches.' },
    { id: 'dc-services', site: 'dc', name: 'Services switch', kind: 'switch', tier: 3, segment: 'Services network', description: 'Connects the DNS, identity, and business application servers to both core switches.' },
    { id: 'dc-storage', site: 'dc', name: 'Storage switch', kind: 'switch', tier: 3, segment: 'Backup network', description: 'Connects the backup host to the data center backbone over a dedicated network segment.' },
    { id: 'dc-dns', site: 'dc', name: 'DNS resolver', kind: 'server', tier: 4, segment: 'Name service', description: 'Resolves internal hostnames. If it goes offline, the physical path to other services can still exist even when name lookups fail.' },
    { id: 'dc-identity', site: 'dc', name: 'Identity server', kind: 'server', tier: 4, segment: 'Identity services', description: 'Represents the central directory used by managed devices for sign-in and identity checks.' },
    { id: 'dc-app', site: 'dc', name: 'App server', kind: 'server', tier: 4, segment: 'Business applications', description: 'Represents an internal application reached from the campus and branch offices.' },
    { id: 'dc-backup', site: 'dc', name: 'Backup host', kind: 'server', tier: 4, segment: 'Backup network', description: 'Represents a data protection host on a separate network attached to the storage switch.' },
  ];

  // Preferred links come before backup links so equal-length routes match the healthy state.
  const links = [
    ['hq-wan-primary', 'hq-edge', 'wan-primary', 'primary'],
    ['west-wan-primary', 'west-edge', 'wan-primary', 'primary'],
    ['east-wan-primary', 'east-edge', 'wan-primary', 'primary'],
    ['dc-wan-primary', 'dc-edge', 'wan-primary', 'primary'],
    ['hq-wan-backup', 'hq-edge', 'wan-backup', 'backup'],
    ['west-wan-backup', 'west-edge', 'wan-backup', 'backup'],
    ['east-wan-backup', 'east-edge', 'wan-backup', 'backup'],
    ['dc-wan-backup', 'dc-edge', 'wan-backup', 'backup'],
    ['hq-edge-core', 'hq-edge', 'hq-core', 'backbone'],
    ['hq-core-office', 'hq-core', 'hq-office-switch', 'backbone'],
    ['hq-core-wireless', 'hq-core', 'hq-wireless-switch', 'backbone'],
    ['hq-office-laptop', 'hq-office-switch', 'hq-laptop', 'access'],
    ['hq-office-phone', 'hq-office-switch', 'hq-phone', 'access'],
    ['hq-wireless-ap', 'hq-wireless-switch', 'hq-ap', 'access'],
    ['west-edge-distribution', 'west-edge', 'west-distribution', 'backbone'],
    ['west-distribution-access', 'west-distribution', 'west-access', 'backbone'],
    ['west-access-workstation', 'west-access', 'west-workstation', 'access'],
    ['west-access-ap', 'west-access', 'west-ap', 'access'],
    ['west-access-printer', 'west-access', 'west-printer', 'access'],
    ['east-edge-distribution', 'east-edge', 'east-distribution', 'backbone'],
    ['east-distribution-access', 'east-distribution', 'east-access', 'backbone'],
    ['east-access-workstation', 'east-access', 'east-workstation', 'access'],
    ['east-access-ap', 'east-access', 'east-ap', 'access'],
    ['east-access-pos', 'east-access', 'east-pos', 'access'],
    ['dc-edge-core-a', 'dc-edge', 'dc-core-a', 'backbone'],
    ['dc-edge-core-b', 'dc-edge', 'dc-core-b', 'backup'],
    ['dc-core-peer', 'dc-core-a', 'dc-core-b', 'backbone'],
    ['dc-a-services', 'dc-core-a', 'dc-services', 'backbone'],
    ['dc-b-services', 'dc-core-b', 'dc-services', 'backup'],
    ['dc-a-storage', 'dc-core-a', 'dc-storage', 'backbone'],
    ['dc-b-storage', 'dc-core-b', 'dc-storage', 'backup'],
    ['dc-services-dns', 'dc-services', 'dc-dns', 'service'],
    ['dc-services-identity', 'dc-services', 'dc-identity', 'service'],
    ['dc-services-app', 'dc-services', 'dc-app', 'service'],
    ['dc-storage-backup', 'dc-storage', 'dc-backup', 'service'],
  ].map(([id, from, to, kind]) => ({ id, from, to, kind }));

  const scenarios = [
    {
      id: 'healthy',
      name: 'Normal operation',
      summary: 'All devices and links are up. Inter-site traces prefer the primary WAN where the paths are otherwise equal.',
      failedLinks: [],
      failedDevices: [],
    },
    {
      id: 'wan-failover',
      name: 'West WAN failover',
      summary: 'The West Branch primary circuit is down. Trace a West Branch workstation to the app server to see it use the backup WAN. The other sites retain their primary links.',
      failedLinks: ['west-wan-primary'],
      failedDevices: [],
    },
    {
      id: 'east-isolated',
      name: 'East Branch isolation',
      summary: 'Both East Branch circuits are down. Devices can still reach each other within the branch, while paths from East Branch to other sites stop at the WAN edge.',
      failedLinks: ['east-wan-primary', 'east-wan-backup'],
      failedDevices: [],
    },
    {
      id: 'dns-down',
      name: 'DNS service offline',
      summary: 'The shared DNS resolver is unavailable. Compare a trace to DNS with a trace to the app server to see the difference between service health and raw network reachability.',
      failedLinks: [],
      failedDevices: ['dc-dns'],
    },
    {
      id: 'dc-core-down',
      name: 'Data center core failover',
      summary: 'Core A is offline. Traces to shared services use Core B through the remaining uplinks.',
      failedLinks: [],
      failedDevices: ['dc-core-a'],
    },
  ];

  const presets = [
    { id: 'west-app', name: 'West workstation to app server', from: 'west-workstation', to: 'dc-app' },
    { id: 'east-dns', name: 'East workstation to DNS', from: 'east-workstation', to: 'dc-dns' },
    { id: 'hq-identity', name: 'HQ laptop to identity server', from: 'hq-laptop', to: 'dc-identity' },
    { id: 'east-local', name: 'East workstation to East AP', from: 'east-workstation', to: 'east-ap' },
    { id: 'west-east', name: 'West workstation to East workstation', from: 'west-workstation', to: 'east-workstation' },
  ];

  const adjacency = new Map(devices.map(({ id }) => [id, []]));
  for (const { id, from, to } of links) {
    adjacency.get(from).push({ deviceId: to, linkId: id });
    adjacency.get(to).push({ deviceId: from, linkId: id });
  }

  // Return a path through the model graph only. This never sends real network traffic.
  function trace(from, to, scenarioId = 'healthy') {
    const scenario = scenarios.find(({ id }) => id === scenarioId);
    if (!scenario || !adjacency.has(from) || !adjacency.has(to)) return null;

    const failedDevices = new Set(scenario.failedDevices);
    if (failedDevices.has(from) || failedDevices.has(to)) return null;

    const failedLinks = new Set(scenario.failedLinks);
    const queue = [from];
    const previous = new Map([[from, null]]);
    for (let index = 0; index < queue.length; index += 1) {
      const device = queue[index];
      if (device === to) {
        const path = [];
        for (let step = to; step !== null; step = previous.get(step)) path.push(step);
        return path.reverse();
      }

      for (const { deviceId, linkId } of adjacency.get(device)) {
        if (failedLinks.has(linkId) || failedDevices.has(deviceId) || previous.has(deviceId)) continue;
        previous.set(deviceId, device);
        queue.push(deviceId);
      }
    }
    return null;
  }

  window.PortfolioNetworkModel = { sites, devices, links, scenarios, presets, trace };
})();
