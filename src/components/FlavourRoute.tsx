import { useEffect } from 'react';
import { useHistory, useLocation } from '@docusaurus/router';
import { choiceInUrl, redirectTarget } from '../flavours/resolve.mjs';
import { readSaved, saveChoice, useFlavourSite } from '../flavours/useFlavours';

/**
 * Handles an address on arrival in the app. A flavourless address goes to the saved choice. A tree address wins:
 * its flavours overwrite the saved choice. The head script does the first for a full page load.
 */
export default function FlavourRoute(): null {
  const site = useFlavourSite();
  const history = useHistory();
  const { pathname, search, hash } = useLocation();
  useEffect(() => {
    const to = redirectTarget({ ...site, pathname, saved: readSaved() });
    if (to) history.replace(to + search + hash);
    else saveChoice(choiceInUrl({ pathname, baseUrl: site.baseUrl, axes: site.axes }).choice);
    // The address alone decides; `search` and `hash` only ride along.
  }, [pathname]);
  return null;
}
