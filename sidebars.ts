import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docs: [
    {
      type: 'category',
      label: 'Get started',
      collapsible: false,
      items: ['index', 'quickstart', 'examples', 'app-definition'],
    },
    {
      type: 'category',
      label: 'Guides',
      link: {
        type: 'generated-index',
        slug: '/category/guides',
        description: 'Advanced configuration of an app, one topic per guide.',
      },
      items: ['guides/agent-action-trees', 'guides/filter-navigation-by-capability'],
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
        'recipes/read-app-context',
        'recipes/gate-by-capability',
        'recipes/list-members',
        'recipes/expose-agent-actions',
        'recipes/nest-adapter',
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
        'reference/client',
        'reference/react',
        'reference/agent-react',
        'reference/harness',
        'glossary',
      ],
    },
  ],
};

export default sidebars;
