import { defineApp } from '@vectoragents/vs-apps';

/** Model slots the space manager points at a model; the server asks for a slot, never a model. */
export const SDR_MODEL_SLOTS = {
  agent: 'sdr-agent',
} as const;

export const sdrDefinition = defineApp({
  key: 'sdr',
  name: 'SDR',
  version: '0.1.0',
  defaultPageKey: 'sdr-dashboard',
  pages: [
    { key: 'sdr-dashboard', label: 'Dashboard', path: '/dashboard', capability: 'sdr:read' },
    { key: 'sdr-icp', label: 'ICP Library', path: '/icp', capability: 'icp:manage' },
    { key: 'sdr-leads', label: 'Leads', path: '/leads', capability: 'lead:manage' },
    { key: 'sdr-workflows', label: 'Workflows', path: '/workflows', capability: 'sdr:workflows' },
  ],
  capabilities: [
    { key: 'sdr:read', label: 'View SDR', effect: 'read' },
    { key: 'icp:manage', label: 'Manage ICPs', effect: 'write' },
    { key: 'lead:manage', label: 'Manage Leads', effect: 'write' },
    { key: 'sdr:workflows', label: 'Workflows', effect: 'read' },
  ],
  resources: {
    models: [
      {
        key: SDR_MODEL_SLOTS.agent,
        label: 'SDR agent',
        description: 'Runs sales development work the space orchestrator delegates.',
        modality: 'chat',
        providers: ['ANTHROPIC'],
        capabilities: ['toolCalling'],
        required: true,
      },
    ],
  },
});
