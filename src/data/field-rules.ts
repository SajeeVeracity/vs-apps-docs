export interface FieldRule {
  /** Dotted path from the definition root; `[]` marks an array item. */
  path: string;
  required: boolean;
  /** Markdown text with no links; the app-definition page repeats it verbatim and a test keeps the two equal. */
  rule: string;
  /** Regular expression source the value must match, when the rule is a pattern. */
  pattern?: string;
}

// The value lists below mirror what `defineApp` accepts.
export const modalities = ['chat', 'vision', 'embed', 'rerank'] as const;
export const modelProviders = ['ANTHROPIC', 'AZURE_OPENAI', 'COHERE', 'AZURE_DOCUMENT_INTELLIGENCE'] as const;
export const modelCapabilities = ['toolCalling', 'structuredOutput', 'reasoningOutput', 'promptCaching', 'streaming'] as const;
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

const code = (values: readonly string[]): string => values.map((v) => `\`${v}\``).join(', ');
const kebab = '^[a-z][a-z0-9-]*$';

export const coreFieldRules: FieldRule[] = [
  {
    path: 'key',
    required: true,
    rule: 'Lower kebab-case, 2-63 characters, starts with a letter.',
    pattern: '^[a-z][a-z0-9-]{1,62}$',
  },
  { path: 'name', required: false, rule: 'Display name, 1-80 characters.' },
  { path: 'version', required: true, rule: 'Non-empty string. Not checked as semver.' },
  { path: 'pages', required: true, rule: 'At least one page. Array order is navigation order.' },
  { path: 'defaultPageKey', required: false, rule: 'When set, must equal a declared page key.' },
  { path: 'capabilities', required: true, rule: 'Array of capabilities. `capabilities: []` is valid.' },
  {
    path: 'pages[].key',
    required: true,
    rule: 'Lower kebab-case. Unique within the app. Uniqueness is checked by `buildManifests`, not at import.',
    pattern: kebab,
  },
  { path: 'pages[].label', required: true, rule: 'Non-empty string.' },
  { path: 'pages[].path', required: true, rule: 'String that starts with `/`.' },
  {
    path: 'pages[].capability',
    required: false,
    rule: 'One capability key. A page without a capability has no gate.',
    pattern: '^[a-z][a-z0-9-]*(:[a-z][a-z0-9-]*)+$',
  },
  {
    path: 'capabilities[].key',
    required: true,
    rule: 'Form `<group>:<action>`, lower kebab-case segments. Two or more segments are valid.',
    pattern: '^[a-z][a-z0-9-]*(:[a-z][a-z0-9-]*)+$',
  },
  { path: 'capabilities[].label', required: true, rule: 'Non-empty string.' },
  { path: 'capabilities[].description', required: false, rule: 'String.' },
  { path: 'capabilities[].effect', required: true, rule: '`"read"` or `"write"`.' },
];

export const resourceFieldRules: FieldRule[] = [
  { path: 'resources', required: false, rule: 'Object. Declares what the app needs from each Space.' },
  { path: 'resources.modules[].key', required: true, rule: 'Non-empty string. Unique within modules.' },
  { path: 'resources.modules[].required', required: true, rule: 'Boolean.' },
  { path: 'resources.modules[].label', required: false, rule: 'Display label.' },
  { path: 'resources.models[].key', required: true, rule: 'Lower kebab-case slot key.', pattern: kebab },
  {
    path: 'resources.models[].modality',
    required: true,
    rule: 'Kind of model: `"chat"`, `"vision"`, `"embed"` or `"rerank"`.',
  },
  {
    path: 'resources.models[].providers',
    required: true,
    rule: `At least one of ${code(modelProviders)}.`,
  },
  { path: 'resources.models[].label', required: false, rule: 'Display label. Falls back to the slot key.' },
  { path: 'resources.models[].description', required: false, rule: 'String.' },
  {
    path: 'resources.models[].models',
    required: false,
    rule: 'Exact model identifiers, as the provider names them. At least one when set.',
  },
  {
    path: 'resources.models[].capabilities',
    required: false,
    rule: `Each one of ${code(modelCapabilities)}.`,
  },
  { path: 'resources.models[].required', required: true, rule: 'Boolean.' },
  { path: 'resources.connectors[].key', required: true, rule: 'Lower kebab-case slot key.', pattern: kebab },
  {
    path: 'resources.connectors[].provider',
    required: true,
    rule: `One of ${code(connectorProviders)}.`,
  },
  { path: 'resources.connectors[].label', required: false, rule: 'Display label. Falls back to the slot key.' },
  { path: 'resources.connectors[].required', required: true, rule: 'Boolean.' },
  {
    path: 'resources.connectors[].eventHandlers',
    required: false,
    rule: 'At least one handler when set. See the next table.',
  },
  {
    path: 'resources.connectors[].eventHandlers[].key',
    required: true,
    rule: 'Lower kebab-case handler key. Unique within the connector slot.',
    pattern: kebab,
  },
  { path: 'resources.connectors[].eventHandlers[].label', required: true, rule: 'Non-empty string.' },
  { path: 'resources.connectors[].eventHandlers[].description', required: false, rule: 'String.' },
  {
    path: 'resources.connectors[].eventHandlers[].defaultEventTypes',
    required: false,
    rule: 'At least one lower-case slug when set. A type is the default of one handler only.',
  },
  {
    path: 'resources.connectors[].eventHandlers[].singleEventType',
    required: false,
    rule: 'Boolean. When `true`, `defaultEventTypes` holds at most one type.',
  },
];
