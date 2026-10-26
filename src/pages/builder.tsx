import { useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import Layout from '@theme/Layout';
import {
  buildOutput,
  connectorProviders,
  modalities,
  modelCapabilities,
  modelProviders,
} from '../builder/index.ts';
import type {
  CapabilityDraft,
  ConnectorDraft,
  Draft,
  EventHandlerDraft,
  Issue,
  ModelDraft,
  ModuleDraft,
  PageDraft,
} from '../builder/index.ts';
import { presets } from '../builder/presets.ts';
import type { PresetName } from '../builder/presets.ts';

type Messages = Map<string, Issue[]>;

const byPath = (issues: Issue[]): Messages => {
  const map: Messages = new Map();
  for (const issue of issues) map.set(issue.path, [...(map.get(issue.path) ?? []), issue]);
  return map;
};

interface FieldProps {
  label: string;
  path: string;
  errors: Messages;
  warnings: Messages;
  children: (id: string) => ReactNode;
}

function Field({ label, path, errors, warnings, children }: FieldProps): ReactElement {
  const id = `f-${path}`;
  return (
    <div className="builder-field">
      <label htmlFor={id}>{label}</label>
      {children(id)}
      {errors.get(path)?.map((e) => (
        <p key={e.message} className="builder-error" role="alert">
          {e.message}
        </p>
      ))}
      {warnings.get(path)?.map((w) => (
        <p key={w.message} className="builder-warning">
          Warning: {w.message}
        </p>
      ))}
    </div>
  );
}

const csv = (value: string): string[] =>
  value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

function remove<T>(list: T[], index: number): T[] {
  return list.filter((_, i) => i !== index);
}

function replace<T>(list: T[], index: number, patch: Partial<T>): T[] {
  return list.map((item, i) => (i === index ? { ...item, ...patch } : item));
}

function Select({ id, value, options, onChange }: { id: string; value: string; options: readonly string[]; onChange: (v: string) => void }): ReactElement {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => (
        <option key={o}>{o}</option>
      ))}
    </select>
  );
}

function Check({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (v: boolean) => void }): ReactElement {
  return (
    <label htmlFor={id} className="builder-check">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /> {label}
    </label>
  );
}

export default function Builder(): ReactElement {
  const [preset, setPreset] = useState<PresetName>('minimal');
  const [draft, setDraft] = useState<Draft>(() => structuredClone(presets.minimal));
  const [copied, setCopied] = useState(false);
  const out = buildOutput(draft);
  const errors = byPath(out.errors);
  const warnings = byPath(out.warnings);
  const fieldProps = { errors, warnings };

  const set = (patch: Partial<Draft>): void => setDraft((d) => ({ ...d, ...patch }));
  const setResources = (patch: Partial<Draft['resources']>): void =>
    setDraft((d) => ({ ...d, resources: { ...d.resources, ...patch } }));
  const { modules, models, connectors } = draft.resources;

  const loadPreset = (name: PresetName): void => {
    setPreset(name);
    setDraft(structuredClone(presets[name]));
  };

  const copy = async (): Promise<void> => {
    await navigator.clipboard.writeText(out.file.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const setHandler = (ci: number, hi: number, patch: Partial<EventHandlerDraft>): void =>
    setResources({
      connectors: replace(connectors, ci, {
        eventHandlers: replace(connectors[ci].eventHandlers ?? [], hi, patch),
      }),
    });

  return (
    <Layout title="Definition builder" description="Build a defineApp file with a form and copy it.">
      <main className="container margin-vert--lg builder">
        <h1>App definition builder</h1>
        <p>
          Fill the form and copy a complete <code>defineApp</code> file. Everything runs in the browser. Contract, acts,
          approvals, retrieval and datasource are not offered.
        </p>
        <div className="builder-grid">
          <form onSubmit={(e) => e.preventDefault()} aria-label="App definition">
            <Field label="Start from" path="preset" {...fieldProps}>
              {(id) => <Select id={id} value={preset} options={['minimal', 'sdr', 'csr']} onChange={(v) => loadPreset(v as PresetName)} />}
            </Field>

            <h2>App</h2>
            <Field label="Key" path="key" {...fieldProps}>
              {(id) => <input id={id} value={draft.key} onChange={(e) => set({ key: e.target.value })} />}
            </Field>
            <Field label="Name (optional)" path="name" {...fieldProps}>
              {(id) => <input id={id} value={draft.name ?? ''} onChange={(e) => set({ name: e.target.value })} />}
            </Field>
            <Field label="Version" path="version" {...fieldProps}>
              {(id) => <input id={id} value={draft.version} onChange={(e) => set({ version: e.target.value })} />}
            </Field>
            <Field label="Default page key (optional)" path="defaultPageKey" {...fieldProps}>
              {(id) => <input id={id} value={draft.defaultPageKey ?? ''} onChange={(e) => set({ defaultPageKey: e.target.value })} />}
            </Field>

            <h2>Pages</h2>
            {errors.get('pages')?.map((e) => (
              <p key={e.message} className="builder-error" role="alert">
                {e.message}
              </p>
            ))}
            {draft.pages.map((page, i) => (
              <fieldset key={i}>
                <legend>Page {i + 1}</legend>
                <Field label="Key" path={`pages[${i}].key`} {...fieldProps}>
                  {(id) => <input id={id} value={page.key} onChange={(e) => set({ pages: replace<PageDraft>(draft.pages, i, { key: e.target.value }) })} />}
                </Field>
                <Field label="Label" path={`pages[${i}].label`} {...fieldProps}>
                  {(id) => <input id={id} value={page.label} onChange={(e) => set({ pages: replace<PageDraft>(draft.pages, i, { label: e.target.value }) })} />}
                </Field>
                <Field label="Path" path={`pages[${i}].path`} {...fieldProps}>
                  {(id) => <input id={id} value={page.path} onChange={(e) => set({ pages: replace<PageDraft>(draft.pages, i, { path: e.target.value }) })} />}
                </Field>
                <Field label="Capability (optional)" path={`pages[${i}].capability`} {...fieldProps}>
                  {(id) => (
                    <input
                      id={id}
                      value={page.capability ?? ''}
                      onChange={(e) => set({ pages: replace<PageDraft>(draft.pages, i, { capability: e.target.value || undefined }) })}
                    />
                  )}
                </Field>
                <button type="button" onClick={() => set({ pages: remove(draft.pages, i) })}>
                  Remove page
                </button>
              </fieldset>
            ))}
            <button type="button" onClick={() => set({ pages: [...draft.pages, { key: '', label: '', path: '/' }] })}>
              Add page
            </button>

            <h2>Capabilities</h2>
            {draft.capabilities.map((cap, i) => (
              <fieldset key={i}>
                <legend>Capability {i + 1}</legend>
                <Field label="Key" path={`capabilities[${i}].key`} {...fieldProps}>
                  {(id) => <input id={id} value={cap.key} onChange={(e) => set({ capabilities: replace<CapabilityDraft>(draft.capabilities, i, { key: e.target.value }) })} />}
                </Field>
                <Field label="Label" path={`capabilities[${i}].label`} {...fieldProps}>
                  {(id) => <input id={id} value={cap.label} onChange={(e) => set({ capabilities: replace<CapabilityDraft>(draft.capabilities, i, { label: e.target.value }) })} />}
                </Field>
                <Field label="Effect" path={`capabilities[${i}].effect`} {...fieldProps}>
                  {(id) => <Select id={id} value={cap.effect} options={['read', 'write']} onChange={(v) => set({ capabilities: replace<CapabilityDraft>(draft.capabilities, i, { effect: v }) })} />}
                </Field>
                <button type="button" onClick={() => set({ capabilities: remove(draft.capabilities, i) })}>
                  Remove capability
                </button>
              </fieldset>
            ))}
            <button type="button" onClick={() => set({ capabilities: [...draft.capabilities, { key: '', label: '', effect: 'read' }] })}>
              Add capability
            </button>

            <h2>Modules</h2>
            {modules.map((mod, i) => (
              <fieldset key={i}>
                <legend>Module {i + 1}</legend>
                <Field label="Key" path={`resources.modules[${i}].key`} {...fieldProps}>
                  {(id) => <input id={id} value={mod.key} onChange={(e) => setResources({ modules: replace<ModuleDraft>(modules, i, { key: e.target.value }) })} />}
                </Field>
                <Check id={`mod-req-${i}`} label="Required" checked={mod.required} onChange={(v) => setResources({ modules: replace<ModuleDraft>(modules, i, { required: v }) })} />
                <button type="button" onClick={() => setResources({ modules: remove(modules, i) })}>
                  Remove module
                </button>
              </fieldset>
            ))}
            <button type="button" onClick={() => setResources({ modules: [...modules, { key: '', required: true }] })}>
              Add module
            </button>

            <h2>Model slots</h2>
            {models.map((model, i) => {
              const patch = (p: Partial<ModelDraft>): void => setResources({ models: replace<ModelDraft>(models, i, p) });
              return (
                <fieldset key={i}>
                  <legend>Model slot {i + 1}</legend>
                  <Field label="Key" path={`resources.models[${i}].key`} {...fieldProps}>
                    {(id) => <input id={id} value={model.key} onChange={(e) => patch({ key: e.target.value })} />}
                  </Field>
                  <Field label="Label (optional)" path={`resources.models[${i}].label`} {...fieldProps}>
                    {(id) => <input id={id} value={model.label ?? ''} onChange={(e) => patch({ label: e.target.value })} />}
                  </Field>
                  <Field label="Modality" path={`resources.models[${i}].modality`} {...fieldProps}>
                    {(id) => <Select id={id} value={model.modality} options={modalities} onChange={(v) => patch({ modality: v })} />}
                  </Field>
                  <Field label="Providers (comma separated)" path={`resources.models[${i}].providers`} {...fieldProps}>
                    {(id) => (
                      <input
                        id={id}
                        list="model-providers"
                        value={model.providers.join(', ')}
                        onChange={(e) => patch({ providers: csv(e.target.value) })}
                      />
                    )}
                  </Field>
                  <Field label="Capabilities (comma separated)" path={`resources.models[${i}].capabilities`} {...fieldProps}>
                    {(id) => <input id={id} value={(model.capabilities ?? []).join(', ')} onChange={(e) => patch({ capabilities: csv(e.target.value) })} />}
                  </Field>
                  <Check id={`model-req-${i}`} label="Required" checked={model.required} onChange={(v) => patch({ required: v })} />
                  <button type="button" onClick={() => setResources({ models: remove(models, i) })}>
                    Remove model slot
                  </button>
                </fieldset>
              );
            })}
            <datalist id="model-providers">
              {modelProviders.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
            <p className="builder-hint">Providers: {modelProviders.join(', ')}. Capabilities: {modelCapabilities.join(', ')}.</p>
            <button
              type="button"
              onClick={() => setResources({ models: [...models, { key: '', modality: 'chat', providers: ['ANTHROPIC'], required: true }] })}
            >
              Add model slot
            </button>

            <h2>Connector slots</h2>
            {connectors.map((conn, ci) => {
              const patch = (p: Partial<ConnectorDraft>): void => setResources({ connectors: replace<ConnectorDraft>(connectors, ci, p) });
              const handlers = conn.eventHandlers ?? [];
              return (
                <fieldset key={ci}>
                  <legend>Connector slot {ci + 1}</legend>
                  <Field label="Key" path={`resources.connectors[${ci}].key`} {...fieldProps}>
                    {(id) => <input id={id} value={conn.key} onChange={(e) => patch({ key: e.target.value })} />}
                  </Field>
                  <Field label="Label (optional)" path={`resources.connectors[${ci}].label`} {...fieldProps}>
                    {(id) => <input id={id} value={conn.label ?? ''} onChange={(e) => patch({ label: e.target.value })} />}
                  </Field>
                  <Field label="Provider" path={`resources.connectors[${ci}].provider`} {...fieldProps}>
                    {(id) => <Select id={id} value={conn.provider} options={connectorProviders} onChange={(v) => patch({ provider: v })} />}
                  </Field>
                  <Check id={`conn-req-${ci}`} label="Required" checked={conn.required} onChange={(v) => patch({ required: v })} />
                  {handlers.map((h, hi) => {
                    const base = `resources.connectors[${ci}].eventHandlers[${hi}]`;
                    const hp = (p: Partial<EventHandlerDraft>): void => setHandler(ci, hi, p);
                    return (
                      <fieldset key={hi}>
                        <legend>Event handler {hi + 1}</legend>
                        <Field label="Key" path={`${base}.key`} {...fieldProps}>
                          {(id) => <input id={id} value={h.key} onChange={(e) => hp({ key: e.target.value })} />}
                        </Field>
                        <Field label="Label" path={`${base}.label`} {...fieldProps}>
                          {(id) => <input id={id} value={h.label} onChange={(e) => hp({ label: e.target.value })} />}
                        </Field>
                        <Field label="Default event types (comma separated)" path={`${base}.defaultEventTypes`} {...fieldProps}>
                          {(id) => <input id={id} value={(h.defaultEventTypes ?? []).join(', ')} onChange={(e) => hp({ defaultEventTypes: csv(e.target.value) })} />}
                        </Field>
                        <Field label="Single event type" path={`${base}.singleEventType`} {...fieldProps}>
                          {(id) => <Check id={id} label="Handler takes one event type" checked={h.singleEventType ?? false} onChange={(v) => hp({ singleEventType: v || undefined })} />}
                        </Field>
                        <button type="button" onClick={() => patch({ eventHandlers: remove(handlers, hi) })}>
                          Remove event handler
                        </button>
                      </fieldset>
                    );
                  })}
                  <button type="button" onClick={() => patch({ eventHandlers: [...handlers, { key: '', label: '' }] })}>
                    Add event handler
                  </button>
                  <button type="button" onClick={() => setResources({ connectors: remove(connectors, ci) })}>
                    Remove connector slot
                  </button>
                </fieldset>
              );
            })}
            <button
              type="button"
              onClick={() => setResources({ connectors: [...connectors, { key: '', provider: 'REST', required: false }] })}
            >
              Add connector slot
            </button>
          </form>

          <section className="builder-output" aria-label="Output">
            <h2>Output</h2>
            <p>
              Save as <code>{out.file.path}</code>
            </p>
            {out.errors.length > 0 && (
              <p className="builder-error" role="status">
                {out.errors.length} {out.errors.length === 1 ? 'error' : 'errors'}. Fix them before copying.
              </p>
            )}
            {out.warnings.length > 0 && (
              <p className="builder-warning" role="status">
                {out.warnings.length} {out.warnings.length === 1 ? 'warning' : 'warnings'}.
              </p>
            )}
            <button type="button" className="button button--primary" onClick={copy} disabled={!out.ok}>
              {copied ? 'Copied' : 'Copy file'}
            </button>
            <pre>
              <code>{out.file.code}</code>
            </pre>
          </section>
        </div>
      </main>
    </Layout>
  );
}
