/** One `defineApp` field and the rule the SDK enforces on it. */
export interface FieldRule {
  /** Dotted path from the definition root; `[]` marks an array item. */
  path: string;
  required: boolean;
  rule: string;
  /** Regular expression source the value must match, when the rule is a pattern. */
  pattern?: string;
}

const kebab = '^[a-z][a-z0-9-]*$';

/** Core definition fields, verified against `@vectoragents/vs-apps` 0.2.4. */
export const coreFieldRules: FieldRule[] = [
  {
    path: 'key',
    required: true,
    rule: 'Lower kebab-case, 2-63 characters, starts with a letter.',
    pattern: '^[a-z][a-z0-9-]{1,62}$',
  },
  { path: 'name', required: false, rule: 'Display name, 1-80 characters.' },
  { path: 'version', required: true, rule: 'Non-empty string. Not checked as semver.' },
  { path: 'pages', required: true, rule: 'At least one page. Array order is nav order.' },
  { path: 'defaultPageKey', required: false, rule: 'When set, must equal a declared page key.' },
  { path: 'capabilities', required: true, rule: 'Array of capabilities. An empty array is valid.' },
  { path: 'pages[].key', required: true, rule: 'Lower kebab-case. Unique within the app.', pattern: kebab },
  { path: 'pages[].label', required: true, rule: 'Non-empty string.' },
  { path: 'pages[].path', required: true, rule: 'String that starts with "/".' },
  {
    path: 'pages[].capability',
    required: false,
    rule: 'One capability key. Not checked against the capabilities array, so a typo passes import.',
  },
  {
    path: 'capabilities[].key',
    required: true,
    rule: 'Form <group>:<action>, lower kebab-case segments. Two or more segments are valid.',
    pattern: '^[a-z][a-z0-9-]*(:[a-z][a-z0-9-]*)+$',
  },
  { path: 'capabilities[].label', required: true, rule: 'Non-empty string.' },
  { path: 'capabilities[].description', required: false, rule: 'String.' },
  { path: 'capabilities[].effect', required: true, rule: '"read" or "write".' },
];

/** `resources` fields: modules, model slots and connector slots. */
export const resourceFieldRules: FieldRule[] = [
  { path: 'resources', required: false, rule: 'Object. Unknown keys are rejected.' },
  { path: 'resources.modules[]', required: false, rule: 'Module requirements. Module key unique.' },
  { path: 'resources.models[]', required: false, rule: 'Model slots. Slot key unique.' },
  { path: 'resources.connectors[]', required: false, rule: 'Connector slots. Slot key unique.' },
  { path: 'resources.models[].key', required: true, rule: 'Lower kebab-case slot key.', pattern: kebab },
  {
    path: 'resources.models[].modality',
    required: true,
    rule: '"chat", "vision", "embed" or "rerank".',
  },
  {
    path: 'resources.models[].providers',
    required: true,
    rule: 'At least one of ANTHROPIC, AZURE_OPENAI, COHERE, AZURE_DOCUMENT_INTELLIGENCE.',
  },
  { path: 'resources.models[].required', required: true, rule: 'Boolean.' },
  { path: 'resources.connectors[].key', required: true, rule: 'Lower kebab-case slot key.', pattern: kebab },
  {
    path: 'resources.connectors[].provider',
    required: true,
    rule: 'One of REST, GRAPHQL, MCP, GOOGLE, CLICKUP, EXA, FIRECRAWL, INSTANTLY, UNIPILE, APOLLO, META.',
  },
  { path: 'resources.connectors[].required', required: true, rule: 'Boolean.' },
  {
    path: 'resources.connectors[].eventHandlers',
    required: false,
    rule: 'At least one handler when set. Any handler makes eventsUrl required in the manifest.',
  },
];
