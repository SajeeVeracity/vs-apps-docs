import { themes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import embedFile from './src/plugins/embed-file.mjs';
import pkg from './package.json' with { type: 'json' };

const sdkVersion = pkg.dependencies['@vectoragents/vs-apps'];

const config: Config = {
  title: 'Vector Apps docs',
  tagline: 'Build apps for Vector Spaces with @vectoragents/vs-apps',
  url: process.env.DOCS_URL ?? 'https://docs.example.com',
  baseUrl: process.env.DOCS_BASE_URL ?? '/',
  onBrokenLinks: 'throw',
  customFields: { sdkVersion },
  presets: [
    [
      'classic',
      {
        docs: { routeBasePath: '/', sidebarPath: './sidebars.ts', beforeDefaultRemarkPlugins: [embedFile] },
        blog: false,
        theme: { customCss: './src/css/custom.css' },
      },
    ],
  ],
  themes: [
    [
      '@easyops-cn/docusaurus-search-local',
      { docsRouteBasePath: '/', indexBlog: false, hashed: true },
    ],
  ],
  themeConfig: {
    navbar: {
      title: 'Vector Apps docs',
      items: [
        { to: '/builder', label: 'Definition builder', position: 'left' },
        { type: 'html', position: 'right', value: `<span class="sdk-version">@vectoragents/vs-apps ${sdkVersion}</span>` },
      ],
    },
    prism: { theme: themes.github, darkTheme: themes.dracula },
  },
};

export default config;
