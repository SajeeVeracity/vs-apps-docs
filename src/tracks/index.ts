export interface TrackStep {
  label: string;
  /** Route of an existing page; the build fails on a broken one. */
  to: string;
}

export interface Track {
  /** Stable slug that also forms the heading `id`. */
  id: string;
  title: string;
  goal: string;
  steps: TrackStep[];
}

/** The goal tracks on the landing page, in card order. Steps are page titles in prerequisite order. */
export const tracks: Track[] = [
  {
    id: 'first-app-in-space',
    title: 'Hello world app',
    goal: 'Run hello world in a Space, then add a page that a capability gates.',
    steps: [
      { label: 'Quickstart', to: '/quickstart' },
      { label: 'Add a page and a capability', to: '/recipes/add-page-and-capability' },
    ],
  },
  {
    id: 'build-definition',
    title: 'Build an app definition',
    goal: 'Write an app definition from a form or a working example.',
    steps: [
      { label: 'App definition', to: '/app-definition' },
      { label: 'Definition builder', to: '/builder' },
      { label: 'Example app definitions', to: '/examples' },
    ],
  },
  {
    id: 'gate-by-capability',
    title: 'Gate by capability',
    goal: 'Limit pages, navigation and server routes to users who hold a capability.',
    steps: [
      { label: 'Quickstart', to: '/quickstart' },
      { label: 'Add a page and a capability', to: '/recipes/add-page-and-capability' },
      { label: 'Gate a page and an endpoint by capability', to: '/recipes/gate-by-capability' },
      { label: 'Filter navigation by capability', to: '/guides/filter-navigation-by-capability' },
    ],
  },
  {
    id: 'agent-actions',
    title: 'Expose agent actions',
    goal: 'Let the Space agent call an action on your page while the page is open.',
    steps: [
      { label: 'Quickstart', to: '/quickstart' },
      { label: 'Expose agent actions on a page', to: '/recipes/expose-agent-actions' },
    ],
  },
];
