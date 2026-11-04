/**
 * Pure flavour routing. The head script is built from the function sources below, so `normalizePath`,
 * `completeChoice` and `redirectTarget` must stay self-contained: no imports, no outside names.
 */

/** Strips `baseUrl` and any trailing slash from `pathname`; the root is `/`. */
export function normalizePath(pathname, baseUrl) {
  const base = baseUrl.replace(/\/+$/, '');
  const inBase = base && (pathname === base || pathname.startsWith(`${base}/`));
  const path = inBase ? pathname.slice(base.length) : pathname;
  return path.replace(/\/+$/, '') || '/';
}

/** A full choice, one valid flavour per axis: `saved` where it names a known flavour, else the default. */
export function completeChoice(saved, axes, defaults) {
  const choice = /** @type {Record<string, string>} */ ({});
  for (const axis of Object.keys(axes)) {
    const value = saved?.[axis];
    choice[axis] = typeof value === 'string' && Object.hasOwn(axes[axis], value) ? value : defaults[axis];
  }
  return choice;
}

/**
 * Where a flavourless address sends the reader, or null when the address is not in `redirects`.
 * An entry names the axes it varies on, the page it resolves to (`to`, default the address itself)
 * and flavours it pins (`fixed`) over the reader's choice.
 */
export function redirectTarget({ pathname, baseUrl, redirects, axes, defaults, saved }) {
  const path = normalizePath(pathname, baseUrl);
  const entry = Object.hasOwn(redirects, path) ? redirects[path] : null;
  if (!entry) return null;
  const choice = { ...completeChoice(saved, axes, defaults), ...entry.fixed };
  const page = entry.to ?? path;
  const prefix = Object.keys(axes)
    .filter((axis) => entry.axes.includes(axis))
    .map((axis) => `/${choice[axis]}`)
    .join('');
  const target = prefix + (page === '/' ? '' : page) || '/';
  return baseUrl.replace(/\/+$/, '') + target;
}

/** The flavours a tree address starts with, in axis order, and the page path after them. */
export function choiceInUrl({ pathname, baseUrl, axes }) {
  const names = Object.keys(axes);
  const segments = normalizePath(pathname, baseUrl).split('/').slice(1);
  const choice = /** @type {Record<string, string>} */ ({});
  let from = 0;
  while (segments.length) {
    const at = names.findIndex((axis, index) => index >= from && Object.hasOwn(axes[axis], segments[0]));
    if (at < 0) break;
    choice[names[at]] = segments.shift();
    from = at + 1;
  }
  return { choice, rest: `/${segments.join('/')}` };
}

/** The address of the same page in the new flavour, or null when the page does not vary on `axis`. */
export function switchTarget({ pathname, baseUrl, axes, axis, flavour }) {
  const { choice, rest } = choiceInUrl({ pathname, baseUrl, axes });
  if (!(axis in choice) || choice[axis] === flavour) return null;
  const next = { ...choice, [axis]: flavour };
  const prefix = Object.keys(axes)
    .filter((name) => name in next)
    .map((name) => `/${next[name]}`)
    .join('');
  return baseUrl.replace(/\/+$/, '') + prefix + (rest === '/' ? '' : rest);
}

/** The trigger text of a flavour: its name up to ` + `, so `Node.js + TypeScript` reads `Node.js`. */
export function shortLabel(label) {
  return label.split(' + ')[0];
}
