import type { ReactElement } from 'react';
import stamp from '../../static/verified.json';

export default function VerifiedStamp(): ReactElement {
  const date = stamp.verifiedAt.slice(0, 10);
  return (
    <p className="verified-stamp">
      Last verified against <code>@vectoragents/vs-apps</code> {stamp.package} on {date}.
    </p>
  );
}
