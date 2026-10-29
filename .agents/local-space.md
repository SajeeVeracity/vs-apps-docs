# Local Space runbook

Not published. Run a Space on your machine to check the docs against a real Space. Start commands live in the Space repo, so this file holds only what that repo does not.

## Rule

If a port or command here disagrees with `../vector-spaces`, trust the Space repo and fix this file.

## Start the Space

Read `../vector-spaces/CLAUDE.md` under "Build, verify, run" and `../vector-spaces/docker-compose.yml` for the commands. Three facts are not there:

- The Space server listens on port 3000.
- The Space client listens on port 3001.
- Set `SERVER_PORT=3101` for the starter. Its client proxies `/api` to `SERVER_PORT`, and port 3001 is taken by the Space client.

## Register the app

Follow `.agents/staff-registration.md`. Run every step through the user interface, as Vector staff would. Never write SQL. A step that needs SQL is a guide defect: stop and report it to the user.

## Local source only

After a pull, pending database migrations break Space pages. Read `docs/systems/DATABASE.md` under "Branch databases" in `../vector-spaces`, then run `pnpm migration:run` there.

## Drive the interface

Follow `.agents/browser-checks.md`.
