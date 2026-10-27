import type { ReactElement } from 'react';
import stamp from '../../static/verified.json';

/** Renders nothing until `check:snippets` has written a stamp with a date. */
export default function VerifiedStamp(): ReactElement | null {
  if (!stamp.verifiedAt) return null;
  return (
    <p className="verified-stamp">
      Last verified against <code>@vectoragents/vs-apps</code> {stamp.package} on {stamp.verifiedAt.slice(0, 10)}.
    </p>
  );
}
