import { csrDefinition } from '../examples/csr.definition.ts';
import { sdrDefinition } from '../examples/sdr.definition.ts';
import type { Draft } from './index.ts';

const fromDefinition = (def: unknown): Draft => {
  const copy = structuredClone(def) as Partial<Draft>;
  return { ...copy, resources: { modules: [], models: [], connectors: [], ...copy.resources } } as Draft;
};

export type PresetName = 'minimal' | 'sdr' | 'csr';

export const presets: Record<PresetName, Draft> = {
  minimal: {
    key: 'my-app',
    name: 'My App',
    version: '0.1.0',
    defaultPageKey: 'home',
    pages: [{ key: 'home', label: 'Home', path: '/home', capability: 'my-app:read' }],
    capabilities: [{ key: 'my-app:read', label: 'View My App', effect: 'read' }],
    resources: { modules: [], models: [], connectors: [] },
  },
  sdr: fromDefinition(sdrDefinition),
  csr: fromDefinition(csrDefinition),
};
