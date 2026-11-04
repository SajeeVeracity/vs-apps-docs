import type { ReactElement } from 'react';
import Link from '@theme-original/DocSidebarItem/Link';
import type { WrapperProps } from '@docusaurus/types';
import { redirectTarget } from '../../../flavours/resolve.mjs';
import { useChoice, useFlavourSite } from '../../../flavours/useFlavours';

type Props = WrapperProps<typeof Link>;

/** A sidebar entry for a flavoured page points at the stub; this sends it into the reader's pair instead. */
export default function SidebarLinkWrapper(props: Props): ReactElement {
  const site = useFlavourSite();
  const choice = useChoice();
  const href = redirectTarget({ ...site, pathname: props.item.href, saved: choice });
  return <Link {...props} item={href ? { ...props.item, href } : props.item} />;
}
