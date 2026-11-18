# Speaking Room

A private, single-user IELTS speaking question catalog and answer notebook.
The preview includes an overview, searchable Part 1/2/3 catalog, question copying,
multiple answers per question, optional ChatGPT feedback, editing, and deletion.
The catalog and selected question share one workspace. Mobile uses list/detail
navigation without a separate route.

The 12 original example questions in `db/demo.sql` are clearly labelled demo
content, not an official or current-season question bank. There are no fabricated
answers, practice counts, or scores. Counts mean answers saved, not skills mastered.
Formal question-bank material is curated on the backend, not imported through a
public upload interface. Keep source material out of this public repository.
When replacing example questions, preserve any with saved answers.

## Stack

Next.js 14 App Router, React 18, Tailwind, PostgreSQL and lucide icons. Next is
on the 14.2.35 security patch rather than the older fleet 14.2.18 baseline;
other projects are not changed. Answers are rendered as plain text with preserved
line breaks, never as executable HTML.

## Deployment

The service lives at `/ielts`, bound to `127.0.0.1:3017`. Its Docker container
joins the existing `traffic-monitor_default` network and uses the shared `db`.
Nginx snippets are in `deploy/`. `docker compose up -d --build web` deploys it.
Database storage belongs to the existing shared PostgreSQL container, not the web
container, so web rebuilds retain all data.

`node scripts/bootstrap.mjs --approve-new-secrets` is a one-time operator command
that refuses to overwrite an existing DB, role or configuration. It creates
`~/.config/ielts.env` and `~/.config/ielts-monitor.env` with mode 600, and symlinks
the former as `.env`. No initial admin password is generated. The monitor has
access only to the aggregate `service_health` view, not answers or credentials.

The status compose file loads the **separate** monitor env file so existing
private configuration does not need modification. The site index and status
dashboard expose service entry/health, never private answers. There are no AI
calls or scheduled jobs in this preview, so no cost or cron heartbeat integration
is needed. No content-age warning is used for a manually maintained notebook.

## First password

Following the OurDays pattern, username is `admin`, and no public registration
exists. On the host, with the project configuration loaded:

```sh
set -a
. /home/liharr/.config/ielts.env
set +a
PG_HOST=127.0.0.1 npm run password-link
```

The generated HTTPS link holds a random, 24-hour, one-use token in the URL fragment.
Only its SHA-256 hash is stored; the browser removes the fragment immediately.
Opening the page does not consume it; setting a valid password does. Passwords
use salted scrypt, matching the OurDays 9+ alphanumeric letter-and-digit policy.
The setup page never requires the user to share a password in chat.

Password setup revokes all old sessions and outstanding setup tokens. Generating
a new link invalidates old unused links. Once a password exists, the script
refuses unless an operator explicitly requests `--reset`. Never publish setup
links in source, the service index or status.

Login uses a Secure, HttpOnly, SameSite=Strict cookie scoped to `/ielts`, expiring
after 30 days. Database-backed login throttling, server-side authentication on
every private API, same-origin mutation checks and bounded request bodies apply.

## Development and verification

```sh
npm ci
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
cp -a .next/static .next/standalone/.next/
```

Use the real HTTPS nginx route for cookie-based manual development, since session
cookies are always Secure. Automated checks use localhost in isolated contexts.

After loading the project env as above, `npm run test:integration` and
`npm run test:browser` start the built server against a uniquely named temporary
database created inside the shared PostgreSQL container. They never set the
production admin password or change real answers. The test database and server
are removed on completion. Browser checks require Playwright Chromium;
`PLAYWRIGHT_BROWSERS_PATH` can point to an existing installation. Optional
`SCREENSHOT_DIR` writes desktop/mobile previews outside the repository.

## Optional analytics

`layout.tsx` loads the Umami script only when both `NEXT_PUBLIC_UMAMI_SRC` and
`NEXT_PUBLIC_UMAMI_WEBSITE_ID` are configured at runtime. Both start empty until
the operator creates a website in Umami. Automatic tracking is disabled: setup
links, private reading activity and answer content are not sent to analytics.
