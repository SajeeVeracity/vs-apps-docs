import type { ReactElement } from 'react';
import Paginator from '@theme-original/DocItem/Paginator';
import DocPaginator from '@theme/DocPaginator';
import { useLocation } from '@docusaurus/router';
import { useDocsSidebar } from '@docusaurus/plugin-content-docs/client';
import { sidebarNeighbours } from '../../../flavours/sidebar.mjs';

/** A tree page is not in the sidebar the build computed its neighbours from, so they come from the sidebar the reader sees. */
export default function PaginatorWrapper(): ReactElement {
  const sidebar = useDocsSidebar();
  const { pathname } = useLocation();
  const neighbours = sidebar && sidebarNeighbours(sidebar.items, pathname);
  if (!neighbours) return <Paginator />;
  return <DocPaginator className="docusaurus-mt-lg" previous={neighbours.previous} next={neighbours.next} />;
}
