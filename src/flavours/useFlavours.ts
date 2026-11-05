import { useMemo, useSyncExternalStore } from 'react';
import { useLocation } from '@docusaurus/router';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import { storageKey } from './head-script.mjs';
import { choiceInUrl, completeChoice } from './resolve.mjs';

export type Choice = Record<string, string>;

export interface FlavourSite {
  axes: Record<string, Record<string, string>>;
  defaults: Choice;
  baseUrl: string;
  redirects: Record<string, { to?: string; axes: string[]; fixed?: Choice }>;
}

export const useFlavourSite = (): FlavourSite => useDocusaurusContext().siteConfig.customFields!.flavourSite as FlavourSite;

const listeners = new Set<() => void>();

const readRaw = (): string => {
  try {
    return localStorage.getItem(storageKey) ?? '';
  } catch {
    return '';
  }
};

const parse = (raw: string): Choice | null => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

/** The saved choice as stored, or null before the first save; may name flavours that no longer exist. */
export const readSaved = (): Choice | null => parse(readRaw());

/** Merges `choice` into the saved choice. Storage that throws keeps the choice for this page view only. */
export function saveChoice(choice: Choice): void {
  const next = JSON.stringify({ ...readSaved(), ...choice });
  if (next === readRaw()) return;
  try {
    localStorage.setItem(storageKey, next);
  } catch {
    return;
  }
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => event.key === storageKey && listener();
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
};

/**
 * The reader's current pair: the flavours in the address win over the saved choice, the defaults fill the rest.
 * The server render and the first client render use no saved choice, so they match.
 */
export function useChoice(): Choice {
  const { axes, defaults, baseUrl } = useFlavourSite();
  const { pathname } = useLocation();
  const raw = useSyncExternalStore(subscribe, readRaw, () => '');
  return useMemo(
    () => completeChoice({ ...parse(raw), ...choiceInUrl({ pathname, baseUrl, axes }).choice }, axes, defaults),
    [raw, pathname, axes, defaults, baseUrl],
  );
}
