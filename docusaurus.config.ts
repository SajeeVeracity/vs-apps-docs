import { themes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import embedFile from './src/plugins/embed-file.mjs';
import { searchTheme } from './src/plugins/search-per-pair.mjs';
import pkg from './package.json' with { type: 'json' };
import flavours from './flavours.config.json' with { type: 'json' };
import { headScript } from './src/flavours/head-script.mjs';
import { loadFlavourSite } from './src/flavours/site.mjs';

const sdkVersion = pkg.dependencies['@vectoragents/vs-apps'];
const baseUrl = process.env.DOCS_BASE_URL ?? '/';
const flavourSite = { ...loadFlavourSite({ root: process.cwd(), config: flavours }), baseUrl };

const config: Config = {
  title: 'Vector Apps docs',
  tagline: 'Build apps for Vector Spaces with @vectoragents/vs-apps',
  url: process.env.DOCS_URL ?? 'https://docs.example.com',
  baseUrl,
  onBrokenLinks: 'throw',
  markdown: { mermaid: true },
  customFields: { sdkVersion, flavourSite },
  headTags: [{ tagName: 'script', attributes: {}, innerHTML: headScript(flavourSite) }],
  presets: [
    [
      'classic',
      {
        docs: { path: flavours.outDir, routeBasePath: '/', sidebarPath: './sidebars.ts', beforeDefaultRemarkPlugins: [embedFile] },
        blog: false,
        theme: { customCss: './src/css/custom.css' },
      },
    ],
  ],
  themes: [
    '@docusaurus/theme-mermaid',
    searchTheme(flavours),
  ],
  themeConfig: {
    navbar: {
      title: 'Vector Apps docs',
      items: [
        { to: '/builder', label: 'Definition builder', position: 'left' },
        { type: 'custom-flavourPicker', position: 'right' },
        { type: 'html', position: 'right', value: `<span class="sdk-version">@vectoragents/vs-apps ${sdkVersion}</span>` },
      ],
    },
    prism: { theme: themes.github, darkTheme: themes.dracula },
  },
};

export default config;
