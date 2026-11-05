import { readFileSync } from 'node:fs';
import { searchTheme } from '../../../src/plugins/search-per-pair.mjs';

const flavours = JSON.parse(readFileSync(new URL('./flavours.config.json', import.meta.url), 'utf8'));

export default {
  title: 'Search fixture',
  url: 'http://localhost',
  baseUrl: '/',
  onBrokenLinks: 'throw',
  presets: [['classic', { docs: { path: flavours.outDir, routeBasePath: '/', sidebarPath: './sidebars.mjs' }, blog: false }]],
  themes: [searchTheme(flavours)],
};
