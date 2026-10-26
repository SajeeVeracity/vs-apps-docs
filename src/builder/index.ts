import { coreFieldRules, resourceFieldRules } from '../data/field-rules.ts';

export const modalities = ['chat', 'vision', 'embed', 'rerank'] as const;
export const modelProviders = ['ANTHROPIC', 'AZURE_OPENAI', 'COHERE', 'AZURE_DOCUMENT_INTELLIGENCE'] as const;
export const modelCapabilities = [
  'toolCalling',
  'structuredOutput',
  'reasoningOutput',
  'promptCaching',
  'streaming',
] as const;
export const connectorProviders = [
  'REST',
  'GRAPHQL',
  'MCP',
  'GOOGLE',
  'CLICKUP',
  'EXA',
  'FIRECRAWL',
  'INSTANTLY',
  'UNIPILE',
  'APOLLO',
  'META',
] as const;

export interface PageDraft {
  key: string;
  label: string;
  path: string;
  capability?: string;
}

export interface CapabilityDraft {
  key: string;
  label: string;
  description?: string;
  effect: string;
}

export interface ModuleDraft {
  key: string;
  required: boolean;
}

export interface ModelDraft {
  key: string;
  label?: string;
  description?: string;
  modality: string;
  providers: string[];
  capabilities?: string[];
  required: boolean;
}

export interface EventHandlerDraft {
  key: string;
  label: string;
  description?: string;
  defaultEventTypes?: string[];
  singleEventType?: boolean;
}

export interface ConnectorDraft {
  key: string;
  label?: string;
  provider: string;
  required: boolean;
  eventHandlers?: EventHandlerDraft[];
}

/** Form state. Strings stay unchecked so invalid input is representable and reported. */
export interface Draft {
  key: string;
  name?: string;
  version: string;
  defaultPageKey?: string;
  pages: PageDraft[];
  capabilities: CapabilityDraft[];
  resources: { modules: ModuleDraft[]; models: ModelDraft[]; connectors: ConnectorDraft[] };
}

export interface Issue {
  path: string;
  message: string;
}

export interface BuildOutput {
  ok: boolean;
  errors: Issue[];
  warnings: Issue[];
  file: { path: string; code: string };
}

const rules = new Map([...coreFieldRules, ...resourceFieldRules].map((r) => [r.path, r]));
const matches = (rulePath: string, value: string): boolean => new RegExp(rules.get(rulePath)!.pattern!).test(value);
const ruleText = (rulePath: string): string => rules.get(rulePath)!.rule;
const oneOf = (value: string, options: readonly string[]): boolean => options.includes(value);

function checkUnique(keys: string[], base: string, noun: string, errors: Issue[]): void {
  keys.forEach((key, i) => {
    if (key && keys.indexOf(key) !== i) errors.push({ path: `${base}[${i}].key`, message: `Duplicate ${noun} "${key}".` });
  });
}

/** Errors mirror what `defineApp` rejects. Warnings flag input `defineApp` accepts but that is likely a mistake. */
export function validateDraft(draft: Draft): { errors: Issue[]; warnings: Issue[] } {
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  const fail = (path: string, message: string): number => errors.push({ path, message });

  if (!matches('key', draft.key)) fail('key', ruleText('key'));
  if (draft.name && draft.name.length > 80) fail('name', ruleText('name'));
  if (!draft.version) fail('version', ruleText('version'));

  if (draft.pages.length === 0) fail('pages', ruleText('pages'));
  const capabilityKeys = draft.capabilities.map((c) => c.key);
  draft.pages.forEach((page, i) => {
    if (!matches('pages[].key', page.key)) fail(`pages[${i}].key`, ruleText('pages[].key'));
    if (!page.label) fail(`pages[${i}].label`, ruleText('pages[].label'));
    if (!page.path.startsWith('/')) fail(`pages[${i}].path`, ruleText('pages[].path'));
    if (page.capability === undefined) return;
    if (!matches('capabilities[].key', page.capability)) {
      fail(`pages[${i}].capability`, 'Capability must look like <group>:<action>.');
    } else if (!capabilityKeys.includes(page.capability)) {
      warnings.push({
        path: `pages[${i}].capability`,
        message: `Capability "${page.capability}" is not declared. defineApp accepts it, and the page stays ungated by any real capability.`,
      });
    }
  });
  checkUnique(draft.pages.map((p) => p.key), 'pages', 'page key', errors);
  if (draft.defaultPageKey && !draft.pages.some((p) => p.key === draft.defaultPageKey)) {
    fail('defaultPageKey', ruleText('defaultPageKey'));
  }

  draft.capabilities.forEach((cap, i) => {
    if (!matches('capabilities[].key', cap.key)) fail(`capabilities[${i}].key`, ruleText('capabilities[].key'));
    if (!cap.label) fail(`capabilities[${i}].label`, ruleText('capabilities[].label'));
    if (!oneOf(cap.effect, ['read', 'write'])) fail(`capabilities[${i}].effect`, ruleText('capabilities[].effect'));
  });
  checkUnique(capabilityKeys, 'capabilities', 'capability key', errors);

  const { modules, models, connectors } = draft.resources;
  modules.forEach((m, i) => {
    if (!m.key) fail(`resources.modules[${i}].key`, 'Module key is required.');
  });
  checkUnique(modules.map((m) => m.key), 'resources.modules', 'module key', errors);

  models.forEach((m, i) => {
    const at = `resources.models[${i}]`;
    if (!matches('resources.models[].key', m.key)) fail(`${at}.key`, ruleText('resources.models[].key'));
    if (!oneOf(m.modality, modalities)) fail(`${at}.modality`, ruleText('resources.models[].modality'));
    if (m.providers.length === 0) fail(`${at}.providers`, ruleText('resources.models[].providers'));
    if (m.capabilities?.some((c) => !oneOf(c, modelCapabilities))) {
      fail(`${at}.capabilities`, `Each capability is one of ${modelCapabilities.join(', ')}.`);
    }
  });
  checkUnique(models.map((m) => m.key), 'resources.models', 'model slot key', errors);

  connectors.forEach((c, i) => {
    const at = `resources.connectors[${i}]`;
    if (!matches('resources.connectors[].key', c.key)) fail(`${at}.key`, ruleText('resources.connectors[].key'));
    if (!oneOf(c.provider, connectorProviders)) fail(`${at}.provider`, ruleText('resources.connectors[].provider'));
    const handlers = c.eventHandlers ?? [];
    handlers.forEach((h, j) => {
      const hat = `${at}.eventHandlers[${j}]`;
      const handlerKeyRule = 'resources.connectors[].eventHandlers[].key';
      if (!matches(handlerKeyRule, h.key)) fail(`${hat}.key`, ruleText(handlerKeyRule));
      if (!h.label) fail(`${hat}.label`, ruleText('resources.connectors[].eventHandlers[].label'));
      if (h.singleEventType && (h.defaultEventTypes?.length ?? 0) > 1) {
        fail(`${hat}.singleEventType`, 'A single-event-type handler takes at most one default event type.');
      }
    });
    checkUnique(handlers.map((h) => h.key), `${at}.eventHandlers`, 'event handler key', errors);
  });
  checkUnique(connectors.map((c) => c.key), 'resources.connectors', 'connector slot key', errors);

  return { errors, warnings };
}

const nonEmpty = <T>(value: T[] | undefined): T[] | undefined => (value && value.length > 0 ? value : undefined);
const blank = (value: string | undefined): string | undefined => (value ? value : undefined);

/** Drops empty optional fields and nests `resources` only when a slot exists. */
export function toDefinition(draft: Draft): Record<string, unknown> {
  const { modules, models, connectors } = draft.resources;
  const resources = {
    modules: nonEmpty(modules),
    models: nonEmpty(models.map((m) => ({ ...m, label: blank(m.label), description: blank(m.description), capabilities: nonEmpty(m.capabilities) }))),
    connectors: nonEmpty(
      connectors.map((c) => ({
        ...c,
        label: blank(c.label),
        eventHandlers: nonEmpty(
          c.eventHandlers?.map((h) => ({ ...h, description: blank(h.description), defaultEventTypes: nonEmpty(h.defaultEventTypes) })),
        ),
      })),
    ),
  };
  const hasResources = Object.values(resources).some((v) => v !== undefined);
  return strip({
    key: draft.key,
    name: blank(draft.name),
    version: draft.version,
    defaultPageKey: blank(draft.defaultPageKey),
    pages: draft.pages.map((p) => ({ ...p, capability: blank(p.capability) })),
    capabilities: draft.capabilities.map((c) => ({ ...c, description: blank(c.description) })),
    resources: hasResources ? resources : undefined,
  }) as Record<string, unknown>;
}

function strip(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(strip);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, strip(v)]),
    );
  }
  return value;
}

const identifier = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

function serialize(value: unknown, depth: number): string {
  if (typeof value === 'string') return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;
  if (typeof value !== 'object' || value === null) return String(value);
  const pad = '  '.repeat(depth + 1);
  const close = '  '.repeat(depth);
  if (Array.isArray(value)) {
    if (value.every((v) => typeof v === 'string')) return `[${value.map((v) => serialize(v, 0)).join(', ')}]`;
    return `[\n${value.map((v) => `${pad}${serialize(v, depth + 1)},\n`).join('')}${close}]`;
  }
  const lines = Object.entries(value).map(([k, v]) => `${pad}${identifier.test(k) ? k : serialize(k, 0)}: ${serialize(v, depth + 1)},\n`);
  return `{\n${lines.join('')}${close}}`;
}

const camel = (key: string): string => key.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());

/** The complete file text, even for an invalid draft: `defineApp` then fails when the file loads. */
export function emitFile(draft: Draft): { path: string; code: string } {
  const stem = /^[a-z][a-z0-9-]*$/.test(draft.key) ? draft.key : 'app';
  const path = `src/${stem}.definition.ts`;
  const code = [
    `// ${path}`,
    `import { defineApp } from '@vectoragents/vs-apps';`,
    '',
    `export const ${camel(stem)}Definition = defineApp(${serialize(toDefinition(draft), 0)});`,
    '',
  ].join('\n');
  return { path, code };
}

export function buildOutput(draft: Draft): BuildOutput {
  const { errors, warnings } = validateDraft(draft);
  return { ok: errors.length === 0, errors, warnings, file: emitFile(draft) };
}
