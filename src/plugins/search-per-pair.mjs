import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import base from '@easyops-cn/docusaurus-search-local';
import { buildIndex } from '@easyops-cn/docusaurus-search-local/dist/server/server/utils/buildIndex.js';
import { processDocInfos } from '@easyops-cn/docusaurus-search-local/dist/server/server/utils/processDocInfos.js';
import { processPluginOptions } from '@easyops-cn/docusaurus-search-local/dist/server/server/utils/processPluginOptions.js';
import { scanDocuments } from '@easyops-cn/docusaurus-search-local/dist/server/server/utils/scanDocuments.js';
import { combinations } from '../../scripts/generate.mjs';

/** Every URL prefix a flavoured page can have, longest first: the search bar uses the first prefix that matches. */
function contextsOf({ axes }) {
  const names = Object.keys(axes);
  const subsets = Array.from({ length: 2 ** names.length - 1 }, (_, i) => names.filter((_, bit) => (i + 1) & (1 << bit)));
  return subsets
    .sort((a, b) => b.length - a.length)
    .flatMap((subset) => combinations(axes, subset))
    .map((flavours) => ({
      flavours,
      path: Object.values(flavours).join('/'),
      label: Object.entries(flavours).map(([axis, flavour]) => axes[axis][flavour]).join(' · '),
    }));
}

/** The flavours in the leading segments of a page path: at most one per axis, in axis order. */
function treeOf({ axes }, uri) {
  const names = Object.keys(axes);
  const tree = {};
  let next = 0;
  for (const segment of uri.split('/')) {
    const axis = names.findIndex((name, i) => i >= next && segment in axes[name]);
    if (axis < 0) break;
    tree[names[axis]] = segment;
    next = axis + 1;
  }
  return tree;
}

/**
 * The search theme as a `themes` entry. The search plugin indexes a tree only under its own prefix, so the wrapper
 * rewrites each context index after the plugin's build to hold every page whose flavours agree with the context:
 * a pair gets its own trees, the client-only and server-only pages of its flavours, and the neutral pages. A context
 * that names one axis leaves the other axis open. The flavourless stubs stay in the root index only, where they send
 * a neutral-page reader to the saved choice.
 */
export function searchTheme(flavours) {
  const contexts = contextsOf(flavours);
  const plugin = (context, options) => {
    const instance = base.default(context, options);
    const config = processPluginOptions(options, context);
    const manifest = JSON.parse(readFileSync(join(context.siteDir, flavours.outDir, 'flavours.json'), 'utf8'));
    const stubs = new Set(manifest.pages.map(({ url }) => url));
    const { postBuild } = instance;
    instance.postBuild = async (buildData) => {
      await postBuild(buildData);
      for (const version of processDocInfos(buildData, config)) {
        const scanned = await scanDocuments(version.paths, config);
        for (const { flavours: wanted, path } of contexts) {
          const kept = scanned.map((docs) =>
            docs.filter(({ u }) => {
              const uri = u.slice(buildData.baseUrl.length).replace(/[#?].*$/, '').replace(/\/$/, '');
              const agrees = Object.entries(treeOf(flavours, uri)).every(([axis, flavour]) => !(axis in wanted) || wanted[axis] === flavour);
              return agrees && !stubs.has(`/${uri}`);
            }),
          );
          writeFileSync(join(version.outDir, `search-index-${path.replaceAll('/', '-')}.json`), JSON.stringify(buildIndex(kept, config)));
        }
      }
    };
    return instance;
  };
  plugin.validateOptions = base.validateOptions;
  return [
    plugin,
    {
      docsDir: flavours.outDir,
      docsRouteBasePath: '/',
      indexBlog: false,
      hashed: true,
      // A neutral page has no context, so the root index holds every page and `/search` offers "Everywhere".
      useAllContextsWithNoSearchContext: true,
      searchContextByPaths: contexts.map(({ path, label }) => ({ path, label })),
    },
  ];
}
