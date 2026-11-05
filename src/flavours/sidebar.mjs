import { normalizePath } from './resolve.mjs';

/**
 * A copy of the sidebar `items` with each link and category `href` replaced by `mapHref(href)`.
 * A null or undefined result keeps the href.
 */
export function mapSidebarHrefs(items, mapHref) {
  return items.map((item) => {
    const href = item.href === undefined ? undefined : (mapHref(item.href) ?? item.href);
    const next = href === item.href ? item : { ...item, href };
    return item.type === 'category' ? { ...next, items: mapSidebarHrefs(item.items, mapHref) } : next;
  });
}

const navigable = (items) =>
  items.flatMap((item) => [
    ...(item.href !== undefined && (item.type === 'link' || item.type === 'category') ? [{ title: item.label, permalink: item.href }] : []),
    ...(item.type === 'category' ? navigable(item.items) : []),
  ]);

/**
 * The entries before and after the page at `pathname`, in sidebar order, as `{ title, permalink }`.
 * Null when the page is not in the sidebar.
 */
export function sidebarNeighbours(items, pathname) {
  const flat = navigable(items);
  const at = flat.findIndex((entry) => normalizePath(entry.permalink, '') === normalizePath(pathname, ''));
  return at < 0 ? null : { previous: flat[at - 1], next: flat[at + 1] };
}
