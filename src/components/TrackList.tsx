import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import { loadProgress, saveProgress, summarize, toggleStep, tracks } from '../tracks/index.ts';
import type { Progress, ProgressStore } from '../tracks/index.ts';

const browserStore = (): ProgressStore | undefined => {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
};

export default function TrackList(): ReactElement {
  const { siteConfig } = useDocusaurusContext();
  const [progress, setProgress] = useState<Progress>({});

  useEffect(() => setProgress(loadProgress(browserStore())), []);

  const toggle = (trackId: string, stepId: string): void => {
    const next = toggleStep(progress, trackId, stepId);
    setProgress(next);
    saveProgress(browserStore(), next);
  };

  return (
    <>
      <p className="tracks-version">
        Documents <code>@vectoragents/vs-apps</code> <strong>{String(siteConfig.customFields?.sdkVersion)}</strong>.
      </p>
      <div className="tracks">
        {tracks.map((track) => {
          const { done, total } = summarize(track, progress);
          const doneIds = new Set(progress[track.id] ?? []);
          return (
            <section key={track.id} className="track" aria-labelledby={`track-${track.id}`}>
              <h2 id={`track-${track.id}`}>{track.title}</h2>
              <p>{track.goal}</p>
              <p className="track-count" aria-live="polite">
                {done} of {total} done
              </p>
              <ol>
                {track.steps.map((step) => {
                  const id = `${track.id}-${step.id}`;
                  return (
                    <li key={step.id}>
                      <input id={id} type="checkbox" checked={doneIds.has(step.id)} onChange={() => toggle(track.id, step.id)} />{' '}
                      <label htmlFor={id} className="visually-hidden">
                        Mark done: {step.label}
                      </label>
                      <Link to={step.to}>{step.label}</Link>
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })}
      </div>
    </>
  );
}
