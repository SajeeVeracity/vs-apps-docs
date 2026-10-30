import type { ReactElement } from 'react';
import Link from '@docusaurus/Link';
import { tracks } from '../tracks/index.ts';

export default function TrackList(): ReactElement {
  return (
    <div className="tracks">
      {tracks.map((track) => (
        <section key={track.id} className="track" aria-labelledby={`track-${track.id}`}>
          <h3 id={`track-${track.id}`}>{track.title}</h3>
          <p>{track.goal}</p>
          <ol>
            {track.steps.map((step) => (
              <li key={step.to}>
                <Link to={step.to}>{step.label}</Link>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
