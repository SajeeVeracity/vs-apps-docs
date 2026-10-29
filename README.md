# vs-apps-docs

Docusaurus site for `@vectoragents/vs-apps`.

```bash
pnpm install
pnpm start
pnpm build
pnpm test
```

- `pnpm install` needs a GitHub token with `read:packages` in `~/.npmrc` for `@vectoragents` (registry set in the project `.npmrc`).
- `pnpm build` runs `scripts/check-snippets.mjs` first: it typechecks every `ts`/`tsx` block in `docs/` against the pinned package and writes `static/verified.json`, which the site shows as the verified stamp.
- CI reads the registry token from the `PACKAGES_TOKEN` secret.
