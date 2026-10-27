export interface TrackStep {
  id: string;
  label: string;
  to: string;
}

export interface Track {
  id: string;
  title: string;
  goal: string;
  steps: TrackStep[];
}

/** Completed step ids per track id. */
export type Progress = Record<string, string[]>;

/** The subset of `Storage` the progress logic uses. */
export interface ProgressStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const storageKey = 'vs-apps-docs:track-progress';

/** The goal tracks on the landing page, each an ordered list of pages. */
export const tracks: Track[] = [
  {
    id: 'page-in-space',
    title: 'Put a page in a Space',
    goal: 'Run an app whose page renders inside a Space and reads a verified user.',
    steps: [
      { id: 'quickstart', label: 'Quickstart', to: '/quickstart' },
      { id: 'app-definition', label: 'App definition', to: '/app-definition' },
      { id: 'react', label: 'React reference', to: '/reference/react' },
      { id: 'add-page', label: 'Add a page and a capability', to: '/recipes/add-page-and-capability' },
      { id: 'glossary', label: 'Glossary', to: '/glossary' },
    ],
  },
  {
    id: 'build-definition',
    title: 'Build an app definition',
    goal: 'Write a complete defineApp file from a form or a working example.',
    steps: [
      { id: 'app-definition', label: 'App definition', to: '/app-definition' },
      { id: 'builder', label: 'Definition builder', to: '/builder' },
      { id: 'examples', label: 'Example definitions', to: '/examples' },
      { id: 'root', label: 'Root reference', to: '/reference/root' },
      { id: 'glossary', label: 'Glossary', to: '/glossary' },
    ],
  },
  {
    id: 'gate-by-capability',
    title: 'Gate by capability',
    goal: 'Limit pages, navigation and server routes to the users who hold a capability.',
    steps: [
      { id: 'quickstart', label: 'Quickstart', to: '/quickstart' },
      { id: 'app-definition', label: 'App definition', to: '/app-definition' },
      { id: 'harness', label: 'Harness reference', to: '/reference/harness' },
      { id: 'gate', label: 'Gate by capability', to: '/recipes/gate-by-capability' },
      { id: 'filter-nav', label: 'Filter navigation by capability', to: '/guides/filter-navigation-by-capability' },
      { id: 'glossary', label: 'Glossary', to: '/glossary' },
    ],
  },
  {
    id: 'agent-actions',
    title: 'Expose agent actions',
    goal: 'Let an agent in a Space call actions your app defines.',
    steps: [
      { id: 'app-definition', label: 'App definition', to: '/app-definition' },
      { id: 'examples', label: 'Example definitions', to: '/examples' },
      { id: 'agent-react', label: 'Agent React reference', to: '/reference/agent-react' },
      { id: 'expose', label: 'Expose agent actions', to: '/recipes/expose-agent-actions' },
      { id: 'trees', label: 'Agent action trees', to: '/guides/agent-action-trees' },
      { id: 'glossary', label: 'Glossary', to: '/glossary' },
    ],
  },
];

/** Returns a copy of `progress` with the step flipped between done and not done. */
export function toggleStep(progress: Progress, trackId: string, stepId: string): Progress {
  const done = progress[trackId] ?? [];
  const next = done.includes(stepId) ? done.filter((id) => id !== stepId) : [...done, stepId];
  return { ...progress, [trackId]: next };
}

/** Counts only steps the track still defines, so stored ids from older versions do not inflate it. */
export function summarize(track: Track, progress: Progress): { done: number; total: number } {
  const done = new Set(progress[track.id] ?? []);
  return { done: track.steps.filter((s) => done.has(s.id)).length, total: track.steps.length };
}

/** Returns `{}` when storage is missing, blocked or holds data of the wrong shape. */
export function loadProgress(store: ProgressStore | undefined): Progress {
  try {
    const parsed: unknown = JSON.parse(store?.getItem(storageKey) ?? '{}');
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    const progress: Progress = {};
    for (const [id, value] of Object.entries(parsed)) {
      if (Array.isArray(value)) progress[id] = value.filter((v): v is string => typeof v === 'string');
    }
    return progress;
  } catch {
    return {};
  }
}

/** Persists `progress`; a missing or blocked store is ignored. */
export function saveProgress(store: ProgressStore | undefined, progress: Progress): void {
  try {
    store?.setItem(storageKey, JSON.stringify(progress));
  } catch {
    // Progress then lasts for the page view only.
  }
}
