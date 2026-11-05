import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docs: [
    {
      type: 'category',
      label: 'Get started',
      collapsible: false,
      items: ['index', 'quickstart', 'app-definition', 'examples'],
    },
    {
      type: 'category',
      label: 'Recipes',
      link: {
        type: 'generated-index',
        slug: '/category/recipes',
        description: 'Step-by-step tasks that add one feature to the example app, from simplest to most advanced.',
      },
      items: [
        'recipes/add-page-and-capability',
        'recipes/gate-by-capability',
        'recipes/read-app-context',
        'recipes/list-members',
        'recipes/expose-agent-actions',
      ],
    },
    {
      type: 'category',
      label: 'Guides',
      link: {
        type: 'generated-index',
        slug: '/category/guides',
        description: 'Advanced configuration of an app, one topic per guide.',
      },
      items: [
        'guides/agent-action-trees',
        'guides/filter-navigation-by-capability',
        'guides/call-space-from-your-server',
        'guides/call-a-model-from-your-server',
        'guides/expose-app-as-a2a-agent',
        'guides/open-route-and-read-caller',
        'guides/handle-connector-events',
      ],
    },
    {
      type: 'category',
      label: 'Reference',
      link: {
        type: 'generated-index',
        slug: '/category/reference',
        description: 'Signatures and behaviour of each export in @vectoragents/vs-apps, plus the glossary.',
      },
      items: [
        'reference/root',
        'reference/browser',
        'reference/react',
        'reference/harness',
        'reference/server',
        'reference/orpc',
        'reference/extract',
        'reference/conformance',
        'glossary',
      ],
    },
  ],
};

export default sidebars;
