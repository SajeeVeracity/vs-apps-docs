import { useMemo, type ReactElement } from 'react';
import Layout from '@theme-original/DocRoot/Layout';
import type { WrapperProps } from '@docusaurus/types';
import { DocsSidebarProvider, useDocsSidebar } from '@docusaurus/plugin-content-docs/client';
import { redirectTarget } from '../../../flavours/resolve.mjs';
import { mapSidebarHrefs } from '../../../flavours/sidebar.mjs';
import { useChoice, useFlavourSite } from '../../../flavours/useFlavours';

type Props = WrapperProps<typeof Layout>;

/**
 * The sidebar lists stubs; everything below this layout (active entry, expanded categories, breadcrumbs,
 * the sidebar links) reads it from context, so it gets the reader's pair addresses and a tree page matches an entry.
 */
export default function DocRootLayoutWrapper(props: Props): ReactElement {
  const sidebar = useDocsSidebar();
  const site = useFlavourSite();
  const choice = useChoice();
  const items = useMemo(
    () => sidebar && mapSidebarHrefs(sidebar.items, (href: string) => redirectTarget({ ...site, pathname: href, saved: choice })),
    [sidebar, site, choice],
  );
  return (
    <DocsSidebarProvider name={sidebar?.name} items={items ?? undefined}>
      <Layout {...props} />
    </DocsSidebarProvider>
  );
}
