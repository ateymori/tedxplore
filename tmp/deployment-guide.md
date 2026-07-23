# Deployment & Configuration Guide (for a Junior Developer)

This guide explains **everything we did to take Tedxplore from "code on my laptop" to "a live website on the internet"** — and, more importantly, the *background concepts* and the *why* behind each step, with concrete examples.

The goal is understanding, not copying. Read it once end-to-end to build the mental model; after that, use the [Checklist](#14-checklist-do-it-yourself-on-a-new-project) as a quick reference.

> **How to read this:** Sections 1–3 are *concepts* (the foundation). Sections 4–12 are the *actual steps we took*, each with **Background → What → Why → Example**. Section 13 traces a real request end-to-end so everything clicks together. The rest is checklist, troubleshooting, security, and a glossary.

---

## Table of contents

1. [The big picture (mental model)](#1-the-big-picture-mental-model)
2. [A 5-minute primer: how the web actually works](#2-a-5-minute-primer-how-the-web-actually-works)
3. [Core concepts you need first](#3-core-concepts-you-need-first)
4. [The cast of services (who does what)](#4-the-cast-of-services-who-does-what)
5. [Step 1 — Put the code on GitHub](#5-step-1--put-the-code-on-github)
6. [Step 2 — Continuous Integration (GitHub Actions / CI)](#6-step-2--continuous-integration-github-actions--ci)
7. [Step 3 — Create the Vercel project](#7-step-3--create-the-vercel-project)
8. [Step 4 — Add a database (Neon)](#8-step-4--add-a-database-neon)
9. [Step 5 — Environment variables (the heart of configuration)](#9-step-5--environment-variables-the-heart-of-configuration)
10. [Step 6 — Make the build run database migrations](#10-step-6--make-the-build-run-database-migrations)
11. [Step 7 — Email (Resend) and images (Cloudinary)](#11-step-7--email-resend-and-images-cloudinary)
12. [Step 8 — Deploy and bootstrap your admin account](#12-step-8--deploy-and-bootstrap-your-admin-account)
13. [How it all fits together: a request's journey](#13-how-it-all-fits-together-a-requests-journey)
14. [Checklist: do it yourself on a new project](#14-checklist-do-it-yourself-on-a-new-project)
15. [Troubleshooting log (the real errors we hit)](#15-troubleshooting-log-the-real-errors-we-hit)
16. [Security notes](#16-security-notes)
17. [Glossary](#17-glossary)
18. [Where to learn more](#18-where-to-learn-more)

---

## 1. The big picture (mental model)

Your app is not one single thing. It's a **main application** plus a few **specialist services** that each do one job well. Instead of building and running your own servers for a database, an email sender, and an image host, you *rent* those from companies who specialize in them, and your app talks to them over the internet.

Here's the whole system on one page:

```
        You push code
        to GitHub  ─────────────►  GitHub (stores your code + runs CI tests)
                                          │
                                          │ Vercel is "watching" your repo
                                          ▼
                                   ┌──────────────────┐
   A visitor's browser  ──────────►│      VERCEL      │  runs your Next.js app
   (tedxplore.vercel.app)          │ (the main app +  │
                                   │  the web server) │
                                   └───────┬──────────┘
                                           │  talks to specialist services:
                    ┌──────────────────────┼───────────────────────┐
                    ▼                       ▼                       ▼
                 NEON                    RESEND                 CLOUDINARY
            (the database)          (sends emails)          (stores images)
         stores users, events,   verification, password    hero photos, speaker
         publish requests, etc.   reset, approval emails    photos, sponsor logos
```

**The key insight:** the *only* thing that connects your app to each service is a small piece of secret text — an **API key** or a **connection string** — that you paste into Vercel's settings. Your code reads those secrets from its environment at runtime and uses them to make requests. That's the whole trick. Almost everything in this guide is a variation of: *create an account with a service, get its secret, and give that secret to your app.*

**Why split things up like this?** This is called a **service-oriented** (or "managed services") architecture, and juniors sometimes wonder why we don't just build it all ourselves. Three reasons:
1. **Reliability & expertise.** Email deliverability, database backups, and image CDNs are each hard, full-time engineering problems. Renting them means a specialist team keeps them running.
2. **Cost at small scale.** All of these have free tiers. Running your own database server 24/7 would cost more and do less.
3. **Focus.** Your time goes into *your* product (the event-website generator), not into reinventing infrastructure.

The trade-off is that you now depend on several vendors and must configure them — which is exactly what this guide is about.

---

## 2. A 5-minute primer: how the web actually works

Before the specific tools, here's the physics underneath all of it. If this is already familiar, skim it.

### A website is a conversation between two computers
When you open `tedxplore.vercel.app`, your **browser** (the *client*) sends a **request** over the internet to a **server** (a computer running your app, somewhere in a data center). The server does some work and sends back a **response** (usually HTML). Your browser draws that HTML on screen. That request→response exchange is the atom of the whole web.

### HTTP: the language they speak
The rules for that conversation are a protocol called **HTTP**. A request is just structured text: a **method** (what you want to do), a **URL** (what you want it from), some **headers** (metadata), and sometimes a **body** (data you're sending). For example, when your app asks Resend to send an email, it literally sends this over the wire:

```
POST https://api.resend.com/emails          ← method + URL
Authorization: Bearer re_XXXXXXXX           ← header: "here is my API key"
Content-Type: application/json              ← header: "my body is JSON"

{                                            ← body (the actual data)
  "from": "Tedxplore <onboarding@resend.dev>",
  "to": "someone@example.com",
  "subject": "Confirm your email",
  "html": "<p>Click here…</p>"
}
```

Common **methods**: `GET` (read something), `POST` (create/submit something), `PUT`/`PATCH` (update), `DELETE` (remove). Common **status codes** in the response: `200` OK, `404` Not Found, `401` Unauthorized, `500` Server Error.

> **This is the single most important thing to internalize:** *every* interaction — a visitor loading a page, your app querying Neon, your app calling Resend or Cloudinary — is an HTTP-style request/response between two machines, and the API key rides along in a header to prove who's asking.

### DNS: turning a name into an address
Computers find each other by **IP address** (like `76.76.21.21`), not names. **DNS** (Domain Name System) is the internet's phone book: it translates `tedxplore.vercel.app` into the IP address of the server. When you later buy `tedxplore.com`, "configuring DNS" means editing that phone book entry so the name points at Vercel.

### A "server" is just a program that waits for requests
Don't over-mystify it. A server is a program running on an always-on computer, listening on a **port** (a numbered door — web traffic uses ports 80 and 443). When a request arrives on that port, the program runs, produces a response, and goes back to waiting. On your laptop, `pnpm dev` starts exactly such a program at `http://localhost:3000` (`localhost` = "this same computer"). Vercel runs the same kind of program, but on the public internet.

---

## 3. Core concepts you need first

### 3.1 Frontend, backend, and "full-stack"
- **Frontend** = code that runs in the visitor's **browser** (the HTML/CSS and the buttons they click).
- **Backend** = code that runs on **your server** (checking passwords, reading the database, calling Resend). The browser can't be trusted with secrets or direct database access, so this work happens server-side.
- **Full-stack framework** (like **Next.js**, which this app uses) = one codebase containing *both*, plus the plumbing between them. Vercel runs the backend and serves the frontend from the same deployment.

**Why the split matters for security:** anything in the frontend is fully visible to the user (they can open dev tools and read it). So the database password, the Resend key, and password-checking logic **must** live in the backend. This distinction drives the "public vs. secret" rule below.

### 3.2 Environment variables
An **environment variable** ("env var") is a named value your app reads from *outside* its code — for example `DATABASE_URL=postgres://...`. In JavaScript/Node, code reads it like this:

```ts
const dbUrl = process.env.DATABASE_URL;   // the value comes from the environment, not the code
```

Why not just hard-code the value in the source? Two reasons:
1. **Secrets must not live in code.** Code goes to GitHub, which many people can see, and lives forever in git history. A password written in code is a leaked password — even if you delete it later, it's still in the history.
2. **The value changes per environment.** On your laptop the database is on `localhost`; in production it's Neon. The *code* is identical — only the env var differs. This is what lets the exact same build run on your machine, in CI, and in production.

**Where do env vars come from?**
- **Locally:** a file named `.env` in the project root (which is git-ignored, so it never leaves your machine). Example:
  ```bash
  DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tedxplore"
  BETTER_AUTH_SECRET="a-long-random-string"
  NEXT_PUBLIC_APP_URL="http://localhost:3000"
  ```
- **In production:** Vercel's **Settings → Environment Variables**. Vercel injects them into the running app.

Mental model: env vars are **the app's settings dial**. The code says "read `DATABASE_URL`"; *what* that points to is decided by the environment.

### 3.3 Public vs. secret variables
- **Secret** (e.g. `BETTER_AUTH_SECRET`, `CLOUDINARY_API_SECRET`): must *never* reach the browser. Only backend code reads them.
- **Public** (in Next.js, any name starting with **`NEXT_PUBLIC_`**, e.g. `NEXT_PUBLIC_APP_URL`): deliberately shipped to the browser because the browser genuinely needs it — for example to build an image URL or know the site's own address.

**How Next.js enforces this:** at build time, Next.js finds every `NEXT_PUBLIC_*` var and *bakes its value directly into the JavaScript sent to browsers*. A non-public var is simply never included in that bundle. So the prefix isn't decoration — it changes where the value physically ends up.

> Rule of thumb: **`NEXT_PUBLIC_` = "the whole world may read this."** If you'd be upset to see a value printed on a billboard, it must **not** have that prefix. (This is why the Cloudinary *cloud name* is public but the Cloudinary *API secret* is not.)

### 3.4 API keys — and how they travel
An **API key** is a password *for a program instead of a person*. When your app asks Resend to send an email, Resend needs to know "is this really an authorized Tedxplore, and what's it allowed to do?" The API key answers that.

As you saw in §2, the key travels in a request **header** (commonly `Authorization: Bearer <key>`). The receiving service checks the key against its records, confirms the caller and their permissions, and only then does the work. That's why:
- A leaked key = anyone can impersonate your app (send emails on your behalf, run up your bill). Hence: keep keys secret, and **rotate** (replace) them if exposed.
- Keys often have **scopes/permissions** — give each key only what it needs (e.g. Resend "Sending access", not full account admin). This is the *principle of least privilege*: if a limited key leaks, the damage is limited too.

### 3.5 Secrets, hashing, and signing (`BETTER_AUTH_SECRET` explained)
Some secrets aren't for calling another service — they protect *your own* data. `BETTER_AUTH_SECRET` is the classic example.

When you log in, the server gives your browser a **session cookie** so it remembers you on the next request. But a cookie lives in the user's browser, where they could edit it. What stops someone changing their cookie from "I am user #42" to "I am the admin"?

**Signing.** The server attaches a cryptographic **signature** to the cookie:

```
cookie = data + signature,  where  signature = HMAC(data, BETTER_AUTH_SECRET)
```

`HMAC` is a function that mixes the data with the secret to produce a fingerprint. On every request the server recomputes the fingerprint from the cookie's data + its secret and checks it matches. If an attacker edits the data, the fingerprint no longer matches — because they don't know the secret, they can't produce a valid one. Tampering is detected and rejected.

So the secret is like the **unforgeable wax seal** on a letter. This is why:
- It must be **long and random** (guessing it must be infeasible).
- It must be **secret** (whoever has it can forge sessions).
- **Rotating it** invalidates all existing signatures → everyone gets logged out once, then it's fine.

> **Hashing vs. signing vs. encryption** (you'll meet all three):
> - **Hashing** = one-way fingerprint, can't be reversed (used to store passwords — the DB keeps the hash, never the password).
> - **Signing** = hashing-with-a-secret to prove authenticity/integrity (the cookie example above).
> - **Encryption** = two-way scrambling you can reverse *with a key* (used to keep data confidential in transit, e.g. HTTPS).

### 3.6 Connection strings, and "pooled" vs "direct"
A **connection string** is one line that tells your app *how to reach a database* — everything needed, packed into a URL. Decomposed:

```
postgresql://neondb_owner:npg_secret@ep-royal-frog-au6.us-east-1.aws.neon.tech/neondb?sslmode=require
└────┬────┘ └────┬─────┘ └────┬───┘ └──────────────┬──────────────────────┘ └──┬──┘ └──────┬──────┘
  protocol    username    password              host (server address)        database    options
```

- **protocol** — which kind of database (`postgresql`).
- **username / password** — credentials to log in.
- **host** — the address of the database server.
- **database** — which database on that server.
- **options** — extras; `sslmode=require` means "encrypt the connection" (never send a DB password in the clear).

**Pooled vs. direct** — Neon gives you two versions of this string:
- **Pooled** (host contains `-pooler`): routes through a **connection pooler**, a middleman that keeps a small set of real database connections open and *shares* them across many requests.
- **Direct / unpooled** (no `-pooler`): a plain one-to-one connection straight to the database.

**Why pooling matters, especially on serverless:** a database can only handle a limited number of simultaneous connections (opening one is expensive). On Vercel, each visitor request may spin up a fresh copy of your function — under load that's potentially hundreds of functions each wanting a connection, which would exhaust the database instantly. The pooler absorbs that: functions talk to the pooler, and the pooler reuses a small pile of real connections. So: **the running app uses the pooled URL** (`DATABASE_URL`).

**Why migrations need the direct URL:** schema changes ("create this table") sometimes use database features that a transaction-mode pooler doesn't support, so they must go straight to the database. So: **migrations use the direct URL** (`DIRECT_URL` / `DATABASE_URL_UNPOOLED`).

### 3.7 Build-time vs. runtime (this one bit us — understand it)
There are **two different moments** when your code runs, and they have different needs:

- **Build time** — `next build` runs **once**, when you deploy. It compiles your code and, for performance, **prerenders** some pages: it runs their code ahead of time and saves the resulting HTML, so visitors get an instant response instead of waiting for the page to be generated. **Prerendering a page that reads the database means the database must be reachable *during the build*.** (This is the surprise: a build can need a live database.)
- **Runtime** — the deployed app runs **continuously**, once per visitor request, for as long as the site is live. This is where sessions, form submissions, and live data happen.

Some env vars are needed at build time (`DATABASE_URL` for prerendering), some at runtime (all of them), and some at both. When our build failed with `ECONNREFUSED` (see Troubleshooting), it was build-time prerendering trying to reach a database that wasn't there yet — a pure build-vs-runtime confusion.

> **Prerendering vs. server-rendering vs. client-rendering** (three ways a page's HTML gets made):
> - **Prerendered (static):** built once at deploy time, same for everyone, fastest. Good for marketing pages.
> - **Server-rendered (dynamic):** built fresh on each request (e.g. a page that shows *your* logged-in name).
> - **Client-rendered:** the browser builds it with JavaScript after loading.
> Next.js mixes these per-page automatically; you mostly just need to know that "static build" can still touch your database.

### 3.8 CI/CD
- **CI (Continuous Integration):** every time you push code, an automated system runs your checks — lint (style), type-check (types line up), tests, and a build. You catch breakage in minutes, before it reaches anyone. Ours runs on **GitHub Actions**.
- **CD (Continuous Deployment):** every push to the `main` branch automatically deploys to production. **Vercel does this for us** — push to GitHub, and minutes later the live site updates.

Together: **push → CI checks it → (if `main`) Vercel deploys it.** The payoff is a tight, safe feedback loop — small changes, shipped often, each verified automatically.

### 3.9 Database schema and migrations
A database's **schema** is the *shape* of its tables — which tables exist and what columns they have. Example of what a schema looks like as raw SQL:

```sql
CREATE TABLE "User" (
  id         TEXT PRIMARY KEY,
  email      TEXT UNIQUE NOT NULL,
  role       TEXT NOT NULL DEFAULT 'USER',
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
```

A **migration** is a versioned file describing a change to that shape ("create the `User` table", later "add a `role` column"). Migrations are numbered and applied in order, so any empty database can be brought up to the exact shape your code expects by replaying them. This project keeps its migrations in `prisma/migrations/`, and **`prisma migrate deploy`** is the command that applies any not-yet-applied ones.

**Why this exists:** your code assumes certain tables/columns. If the database doesn't match, queries crash. Migrations keep code and database in lockstep, and give you a repeatable, reviewable history of every schema change (instead of someone manually editing the production database and forgetting what they did). A brand-new Neon database has *no tables* — so migrations must run before the app can work.

### 3.10 Domains and DNS
A **domain** is the human-friendly address (`tedxplore.com`). Until you buy one, Vercel gives you a free subdomain: `tedxplore.vercel.app`. To use a custom domain you buy it from a registrar, then add **DNS records** pointing it at Vercel (and, for email, add records that prove you own it — see Resend below). We're on the free Vercel domain for now, so there's no DNS to configure yet.

---

## 4. The cast of services (who does what)

| Service | What it is | Why we use it | What it gives your app |
|---|---|---|---|
| **GitHub** | Cloud storage + version history for code | Vercel deploys *from* it; it runs your CI | (nothing at runtime — it's the source of truth for code) |
| **Vercel** | Hosting platform that runs the app | Runs Next.js with zero server management; auto-deploys from GitHub | The server that serves every page |
| **Neon** | Serverless PostgreSQL database | Stores all app data; scales to zero when idle (cheap) | `DATABASE_URL` (+ a direct URL for migrations) |
| **Resend** | Transactional email service | Sends verification/reset/approval emails reliably | `RESEND_API_KEY` |
| **Cloudinary** | Image hosting + transformation | Stores and optimizes uploaded photos (resize/format at the edge) | `CLOUDINARY_API_KEY`, `_API_SECRET`, `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` |
| **Better Auth** | (a library *in* the code, not a service) | Handles sign-up/login/sessions | needs `BETTER_AUTH_SECRET` |

These are swappable (you could use Supabase instead of Neon, Postmark instead of Resend, etc.), but they're a well-matched, mostly-free set for a Next.js app.

---

## 5. Step 1 — Put the code on GitHub

**Background:** **Git** is a version-control tool that tracks every change to your code as a series of **commits** (snapshots). **GitHub** is a website that hosts a copy of your git repository in the cloud, so it's backed up, shareable, and — crucially here — reachable by other machines like Vercel and CI runners.

**What we did:**
```bash
git remote add origin https://github.com/ateymori/tedxplore.git
git push -u origin main
```
- `git remote add origin <url>` tells your local repo "here is my cloud copy, nicknamed `origin`." (A *remote* is just a named URL for a copy of your repo elsewhere.)
- `git push -u origin main` uploads the `main` branch and remembers the link (`-u`), so future pushes are just `git push`.

**Why it's necessary:** Vercel and CI don't run on your laptop — they need to *fetch* your code from somewhere reachable. GitHub is that somewhere. Without it, there's nothing to deploy or test.

**Concept — branches:** a **branch** is an independent line of changes. `main` is the primary one, and (because of CD) whatever lands on `main` goes live. Real projects do feature work on separate branches and merge into `main` via **pull requests** (a request to merge, which CI checks first). Solo and early, pushing straight to `main` is fine.

---

## 6. Step 2 — Continuous Integration (GitHub Actions / CI)

**Background — what GitHub Actions is:** a system built into GitHub that runs commands for you on GitHub's own computers whenever an event happens (like a push). You describe the job in a **YAML** file (a simple indented config format) at `.github/workflows/ci.yml`. GitHub reads it and runs the steps.

**What ours does:** on every push and pull request, it installs dependencies and runs **lint → type-check → tests → build**.

**Why it's worth having:** it's an automated safety net. If a change breaks the build or a test, CI goes red and you know within minutes — *before* it reaches users. Since Vercel auto-deploys `main`, you especially want broken code caught by CI, not by visitors.

**The crucial background — a "clean room":** each run happens on a **fresh, empty Linux machine** (a "runner"). Nothing is pre-installed; nothing is left over from your laptop. This is a feature: it proves your project builds *from nothing*, the way it will on any new machine or on Vercel. It's also why several of our early failures happened — our laptop had things (a pinned tool version, generated type files, a running database) that the clean runner didn't. The build step even needs a database, so CI **starts a throwaway PostgreSQL "service container"** (a temporary database that exists only for the job) and runs migrations against it.

> **Takeaway:** *"It works on my machine"* is not evidence it works. **CI is the honest test**, because it has none of your machine's hidden state.

---

## 7. Step 3 — Create the Vercel project

**Background — what "hosting" means here:** Vercel is a **PaaS** (Platform-as-a-Service). You give it your code; it handles building, running, scaling, HTTPS certificates, and a global CDN. You never SSH into a server or manage an OS. For a framework it knows (Next.js), it configures the build automatically.

**What we did:** Vercel dashboard → **Add New → Project → Import** the `ateymori/tedxplore` repo. Vercel detected Next.js and filled in the build settings.

**Why it's necessary:** this creates the living link between "your GitHub repo" and "a running website." From now on: every push to `main` → a **production** deployment; every push to another branch or PR → its own **preview** deployment (a real, temporary live copy at its own URL — fantastic for testing a change before it goes live).

**The chicken-and-egg you hit:** the import screen has an *Environment Variables* box but **no Storage tab** — because Storage (where you add a database) only appears *after* the project exists. So the natural flow is: create the project first (its very first build may fail because there's no database yet — expected and harmless), then add the database and env vars, then redeploy. A failed first deploy doesn't break anything; it just means "not ready yet."

**Concept — three environments:** the same app has **Production** (the real site), **Preview** (per-branch test copies), and **Development** (your laptop). Env vars can be set per environment. We set ours for **Production + Preview**; Development keeps reading your local `.env`.

---

## 8. Step 4 — Add a database (Neon)

**Background — why not the database on my laptop?** Your local PostgreSQL listens on `localhost`, which means "this machine only." Vercel's servers are different machines in a data center; they literally cannot reach your laptop. Production needs a database that lives on the public internet with proper credentials — that's Neon.

**Why Neon specifically:** it's **serverless PostgreSQL**. Normal databases run a server 24/7 (you pay even when idle). Neon **scales to zero** — it sleeps when no one's querying and wakes on demand — so a low-traffic app costs nothing on the free tier. It's still ordinary PostgreSQL, so all your SQL/Prisma code works unchanged.

**What we did:** project → **Storage → Create Database → Neon → Free plan**, then connected it to the project.

**Decisions and why:**
- **Neon's "Auth" toggle → OFF.** That's Neon's *own* login product. This app already has Better Auth, so Neon Auth would add unused tables and confusion. (General lesson: don't enable features you won't use — every one is surface area to understand and secure.)
- **Region → US East.** Put the database physically near the app's server (Vercel's default region is US East). Every query is a round-trip; closer = faster.
- **No per-environment DB branch, no custom variable prefix.** Keep it simple to start. A prefix would rename the injected variables (e.g. `STORAGE_DATABASE_URL`), and then your code — which reads the name `DATABASE_URL` — wouldn't find them.

**What happened automatically — and why it's convenient:** on connecting, the Neon↔Vercel integration **injected a bundle of env vars into your Vercel project**, including `DATABASE_URL` (pooled), `DATABASE_URL_UNPOOLED` (direct), and several `PG*`/`POSTGRES_*` aliases. You never copied a password by hand; the integration wired the secret in for you. (Contrast with Resend/Cloudinary, where *you* copy the key — those aren't Vercel-integrated the same way.)

**Accessing Neon later:** because it was created *through* Vercel, there's **no separate Neon login**. Reach the console via **Vercel → Storage → your database → "Open in Neon"**, or console.neon.tech → "Continue with Vercel."

---

## 9. Step 5 — Environment variables (the heart of configuration)

This is where "connecting services" actually happens: you give the app each service's secret so it can make those HTTP requests from §2. Here's the complete set and what each is for:

| Variable | Public or secret? | Where it comes from | What it does |
|---|---|---|---|
| `DATABASE_URL` | secret | Neon (auto) | Pooled connection the **running app** uses to query the DB |
| `DATABASE_URL_UNPOOLED` | secret | Neon (auto) | Direct connection used to **run migrations** at build time |
| `BETTER_AUTH_SECRET` | secret | You generate it | Signs login cookies/tokens so sessions can't be forged (§3.5) |
| `NEXT_PUBLIC_APP_URL` | public | You set it | The app's own public URL; used to build email links and know its own address |
| `RESEND_API_KEY` | secret | Resend | Lets the app send email |
| `EMAIL_FROM` | (config) | You set it | The "From:" address on outgoing email |
| `CLOUDINARY_API_KEY` | secret | Cloudinary | Identifies the app to Cloudinary |
| `CLOUDINARY_API_SECRET` | secret | Cloudinary | Signs upload requests so they can't be tampered with |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | public | Cloudinary | Names your Cloudinary account so the browser can build image URLs |
| `GOOGLE_CLIENT_ID` / `_SECRET` | secret | Google (optional) | Enables "Sign in with Google" (we left these unset) |
| `REACTBITS_LICENSE_KEY` | secret (build-time only) | React Bits (optional) | Authenticates the shadcn CLI against React Bits' paid registries when installing components; not read at runtime, not needed in production |

**Generating `BETTER_AUTH_SECRET`:** it just needs to be long, random, and unguessable (32+ chars). We ran:
```bash
openssl rand -base64 32
```
`openssl` is a cryptography toolkit on most systems; `rand 32` produces 32 random bytes and `-base64` prints them as safe text. Any high-quality random 32+ char string works — the point is that no one could guess it (see §3.5 for *why* it must be unguessable).

**Why some vars are required and some aren't:**
- The app **won't even build** without `DATABASE_URL` (prerendering queries the DB) or `BETTER_AUTH_SECRET` (the code validates it exists at startup and refuses to boot without it — failing loudly now beats a mysterious auth bug later).
- The app **builds fine** without Resend/Cloudinary — but this project deliberately **refuses to run auth in production** unless *both* are configured (a guard in the code called `assertProductionIntegrations`). The reasoning: a production event platform where no one can receive a verification email or upload an image is broken in a way worth blocking outright. So for a *usable* production app, you need them all.

**How you add one:** Vercel → Settings → Environment Variables → **Add** → type the Key, paste the Value, tick **Production** and **Preview**, Save. Repeat for each.

**Crucial detail — env vars are read at build/boot, not live.** After adding or changing any variable, you must **redeploy** for it to take effect. Changing a var does not change the already-running deployment.

---

## 10. Step 6 — Make the build run database migrations

**The problem (a direct consequence of §3.7):** a fresh Neon database has *no tables*. The build **prerenders** pages that query the database. Query a table that doesn't exist → error → build fails.

**The fix — run migrations before the build.** We added a script to `package.json`:
```json
"vercel-build": "prisma migrate deploy && next build"
```
Vercel has a convention: if a script named **`vercel-build`** exists, it runs *that* instead of the normal `build`. So every deploy now does: `prisma migrate deploy` (bring the schema up to date) **then** `next build` (with the tables now present). The `&&` means "only run the build if the migration succeeded."

**Why this is safe to run on every single deploy:** `migrate deploy` only applies migrations that haven't run yet. If the schema is already current, it does nothing. So there's no harm in it being part of every build — it's *idempotent* (running it repeatedly has the same effect as running it once).

**A wrinkle we solved — different names in different places:** migrations need the *direct* connection (§3.6). Locally we call that env var `DIRECT_URL`; on Vercel, Neon injected it as `DATABASE_URL_UNPOOLED`. Rather than hand-copy a secret into a second variable, we made the migration config (`prisma.config.ts`) try `DIRECT_URL` first and **fall back** to `DATABASE_URL_UNPOOLED`:
```ts
url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL_UNPOOLED"]
```
(`??` means "use the left value if it exists, otherwise the right.") Now the same code finds the right connection locally *and* on Vercel — a small, general pattern for bridging naming differences between environments without duplicating secrets.

---

## 11. Step 7 — Email (Resend) and images (Cloudinary)

### Resend (email)
**What "transactional email" means:** the automatic one-to-one messages your app sends because of something a specific user did — verify your address, reset your password, your event was approved. (Different from marketing email, which is bulk and opt-in.)

**Why use a service instead of sending it yourself:** email is a minefield of anti-spam rules. Mail sent from a random server almost always lands in spam or is blocked outright, because receiving servers can't verify it's legitimate. Resend maintains the reputation and the machinery to get mail *delivered*, and exposes it as a simple API (the `POST /emails` request from §2).

**What we did:** created a Resend account → created an **API key** (`re_…`) → put it in `RESEND_API_KEY` → set the "From" address in `EMAIL_FROM`.

**The important background — you can't send "from" any address you like.** Email has anti-forgery rules enforced by **DNS records** on the sender's domain:
- **SPF** says "these servers are allowed to send mail for my domain."
- **DKIM** cryptographically **signs** each message so the receiver can verify it truly came from your domain and wasn't altered (same signing idea as §3.5, applied to email).
- **DMARC** ties them together and tells receivers what to do if checks fail.

You don't own `tedxplore.com` yet, so you can't set those records, so you can't yet send from `no-reply@tedxplore.com`. Resend gives you a shared test sender, **`onboarding@resend.dev`**, that works instantly — **but** because it isn't tied to *you* via SPF/DKIM, Resend restricts it to **only deliver to your own account's email address**, and receivers (like Gmail) are suspicious of it, so it **often lands in spam**. That's exactly what we saw. The real fix, later: buy the domain, add Resend's SPF/DKIM records to its DNS, and then you can send to anyone with good deliverability.

### Cloudinary (images)
**What it does:** stores uploaded images and serves optimized versions — correct size, modern format, delivered from a fast global **CDN** (a network of servers near users). Your app never stores the image bytes itself.

**Why a service:** images are large and must be resized/reformatted per device, or pages become slow. Doing that well (and serving it from edge locations worldwide) is Cloudinary's whole job.

**What we did:** created a free account and copied three values into Vercel:
- `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` — your account's public name. It's `NEXT_PUBLIC_` because the **browser** builds image URLs like `https://res.cloudinary.com/<cloud-name>/image/upload/...`, so it must know this value. It's not sensitive — it appears in every image URL anyway.
- `CLOUDINARY_API_KEY` + `CLOUDINARY_API_SECRET` — used **server-side** to cryptographically **sign** upload requests, so a malicious user can't forge or tamper with what gets stored. The secret never reaches the browser.

This public/secret split is the §3.3 rule in action: the identifier needed by the browser is public; the credentials that grant power are secret.

---

## 12. Step 8 — Deploy and bootstrap your admin account

**Deploy:** with all env vars in place, trigger a fresh deploy (Deployments → latest → ⋯ → **Redeploy**, or push to `main`). The build log shows: install → migrate → build → **Ready**. Then visit the URL.

**Verify the database is truly connected — the health check.** We opened `https://tedxplore.vercel.app/api/health`, which returned:
```json
{ "status": "ok", "db": "ok" }
```
A **health check** is a tiny endpoint whose only job is to answer "am I alive and can I reach my dependencies?" Here it runs a trivial `SELECT 1` against the database and reports success. It's the fastest way to confirm the app↔database wiring works in production, and it's what uptime monitors ping to detect outages.

**Bootstrap the admin — and why it's deliberately awkward.** This app has a single admin (you), and there is intentionally **no button** to make someone an admin. Why? An admin can suspend sites and read abuse reports — too much power to ever be reachable through a web form that a bug or attacker might trigger. The only way to grant it is to run a script *with direct database credentials*, which only someone with real access has. So:
1. Sign up on the live site and verify your email. (This also proves the whole chain — sign-up → Better Auth → Resend → your inbox — works end to end.)
2. Run the admin script against the **production** database:
   ```bash
   DIRECT_URL='<neon-direct-connection-string>' pnpm exec tsx scripts/grant-admin.ts you@example.com
   ```

**Understanding that command, piece by piece:**
- `DIRECT_URL='...'` at the **front** sets an env var *for this one command only*. The script reads `DIRECT_URL` to know which database to touch; by supplying the **production** Neon string here, we point an otherwise-local script at production for this single run.
- It wins over your local `.env` because the library that loads `.env` (dotenv) **won't overwrite a variable that's already set** — and a variable set on the command line is already set before the program starts.
- `pnpm exec tsx scripts/grant-admin.ts` runs the TypeScript file directly (`tsx` = "run TS without a separate compile step"). `you@example.com` is the argument telling it whom to promote.

Result: `you@example.com is now ADMIN.` Now `/admin` is reachable for that account.

---

## 13. How it all fits together: a request's journey

Concepts stick when you trace one real interaction all the way through. Here's what happens the moment a visitor signs up on your live site — watch every service play its part:

```
1. Visitor's browser  ──POST /api/auth/sign-up──►  VERCEL (your Next.js backend)
                                                     │
2.                        reads BETTER_AUTH_SECRET, DATABASE_URL, RESEND_API_KEY
                          from its environment
                                                     │
3.  backend ──INSERT new user──►  NEON            (over the pooled DATABASE_URL)
                                                     │
4.  backend ──POST /emails (Authorization: Bearer RESEND_API_KEY)──►  RESEND
                                                     │
5.  RESEND ──sends "verify your email"──►  Visitor's inbox
                                                     │
6.  backend ──200 OK──►  Visitor's browser  ("check your email")
```

Then the visitor clicks the verification link in the email:

```
7.  Browser ──GET /verify?token=…──►  VERCEL
8.  backend checks the token, marks the user verified in NEON,
    and issues a session cookie SIGNED with BETTER_AUTH_SECRET
9.  Every later request carries that cookie; the backend re-checks the
    signature (§3.5) to trust "yes, this is that logged-in user."
```

And when that user later uploads a hero image:

```
10. Browser asks VERCEL backend for a signed upload ticket
11. backend signs it with CLOUDINARY_API_SECRET and returns it
12. Browser uploads the file straight to CLOUDINARY using that ticket
13. Later, any visitor's browser loads the image directly from
    res.cloudinary.com/<NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME>/...
```

Notice how **every arrow is an HTTP request (§2)**, every **secret env var (§3.2–3.5)** is what authorizes one of those arrows, and each **service (§4)** owns exactly one responsibility. That's the entire architecture — you now understand it top to bottom.

---

## 14. Checklist: do it yourself on a new project

A condensed, repeatable version. Assumes a Next.js + Prisma + Better Auth app like this one.

```
[ ] 1. Code on GitHub
       git remote add origin <repo-url>
       git push -u origin main

[ ] 2. CI (recommended)
       - Add .github/workflows/ci.yml (lint/typecheck/test/build)
       - Let package.json "packageManager" pin the pnpm version (don't ALSO set it in the action)
       - typecheck script = "next typegen && tsc --noEmit"
       - If the build needs a DB, add a Postgres service container + a migrate step

[ ] 3. Create Vercel project
       - Add New → Project → Import the GitHub repo (framework auto-detected)
       - Expect the very first deploy to fail (no DB yet) — that's fine

[ ] 4. Add a database (Neon via Storage tab)
       - Free plan, region near your app, Neon-Auth OFF, no prefix
       - It injects DATABASE_URL + DATABASE_URL_UNPOOLED automatically

[ ] 5. Make migrations run on deploy
       - package.json: "vercel-build": "prisma migrate deploy && next build"
       - Ensure migrations can find the direct URL (DIRECT_URL ?? DATABASE_URL_UNPOOLED)

[ ] 6. Set environment variables (Production + Preview)
       - BETTER_AUTH_SECRET  ← openssl rand -base64 32
       - NEXT_PUBLIC_APP_URL ← https://<project>.vercel.app  (no trailing slash)
       - RESEND_API_KEY + EMAIL_FROM        (email)
       - CLOUDINARY_API_KEY + _SECRET + NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME  (images)

[ ] 7. Deploy (push to main or Redeploy) and confirm
       - Build log: migrate → build → Ready
       - Visit /api/health → {"status":"ok","db":"ok"}

[ ] 8. Bootstrap admin
       - Sign up + verify email on the live site
       - Run grant-admin script against the production direct URL

[ ] 9. (Later) Buy a domain, add it in Vercel, verify it in Resend (SPF/DKIM) for real email
```

---

## 15. Troubleshooting log (the real errors we hit)

These are the *actual* failures from setting up this project — the most common beginner traps, with the concept behind each.

| Symptom | Cause | Fix | Underlying concept |
|---|---|---|---|
| CI: `Multiple versions of pnpm specified … ERR_PNPM_BAD_PM_VERSION` | pnpm version set in **both** the workflow (`version: 9`) *and* `package.json` (`packageManager`) | Remove `version:` from the workflow; let `packageManager` be the single source | Single source of truth |
| CI warning: "Node 20 is being deprecated" | Build pinned to an aging Node version | Bump `node-version` to 22 | Keep runtimes current |
| CI: `error TS2304: Cannot find name 'PageProps'` | `PageProps`/`LayoutProps` are types Next.js **generates**; a clean CI checkout hasn't generated them yet | typecheck script = `next typegen && tsc --noEmit` | Clean environment has no generated files (§6) |
| CI/Vercel build: `ECONNREFUSED … prisma.event.findMany()` | The build **prerenders** pages that query the DB, but no DB was reachable | CI: Postgres service container + migrate before build. Vercel: attach Neon + `vercel-build` migrates | Build-time vs runtime (§3.7) |
| Vercel: first deploy failed right after import | No env vars / no database existed yet | Expected — add Neon + env vars, then Redeploy | Chicken-and-egg (§7) |
| Migrations couldn't find their connection on Vercel | Vercel/Neon names the direct URL `DATABASE_URL_UNPOOLED`, not `DIRECT_URL` | Fall back: `DIRECT_URL ?? DATABASE_URL_UNPOOLED` | Same value, different names per env (§10) |
| Verification email in spam / only reached one address | Resend's shared `onboarding@resend.dev` sender (no SPF/DKIM, owner-only) | Fine for testing; verify a real domain for production | Email auth: SPF/DKIM (§11) |

**The meta-lesson:** almost every failure was *"my laptop had something CI/Vercel didn't"* — a pinned tool version, generated files, or a running database. **A clean environment is the real test**, and reproducing your setup from nothing is a skill worth practicing.

---

## 16. Security notes

- **Never commit secrets.** Keep them in `.env` locally (which must be in `.gitignore`, so it's never uploaded) and in Vercel's env settings for production. Confirm a file is ignored with `git check-ignore .env`. Remember: git history is forever — a secret committed once and deleted later is still exposed.
- **`NEXT_PUBLIC_` = world-readable.** Never put a real secret behind that prefix (§3.3).
- **Least privilege.** Give each API key only the permissions it needs (e.g. Resend "Sending access", not full admin). If a limited key leaks, the blast radius is smaller.
- **Rotating a leaked secret** is easy and low-stakes — practice it so it's not scary:
  - `BETTER_AUTH_SECRET`: generate a new one, update it in Vercel, redeploy. (Effect: everyone is logged out once.)
  - Neon DB password: Neon console → Settings → Reset password, then update `DATABASE_URL`/`DATABASE_URL_UNPOOLED` in Vercel.
  - API keys (Resend/Cloudinary): delete the old key in their dashboard, create a new one, update Vercel.
- **HTTPS everywhere.** Vercel serves your site over HTTPS automatically (encrypted transport), and your DB connection uses `sslmode=require`. Never send credentials over plain HTTP.

---

## 17. Glossary

- **API** — a defined way for programs to talk to each other over the network.
- **API key** — a secret that identifies and authorizes a *program* calling an API; travels in a request header.
- **Branch** — a parallel line of code changes in git; `main` is the one that goes live.
- **Build time vs. runtime** — build time is the one-off `next build` at deploy; runtime is the app serving each visitor request (§3.7).
- **CDN (Content Delivery Network)** — servers spread worldwide that serve content from a location near each user (Cloudinary images, Vercel static files).
- **CI / CD** — auto-running checks on every push / auto-deploying `main`.
- **Client / server** — the browser making requests / the machine answering them.
- **Connection string** — one URL containing everything needed to reach a database (§3.6).
- **DNS** — the internet's phone book: maps domain names to server addresses; also holds SPF/DKIM records for email.
- **Environment variable** — a named value the app reads from its environment instead of its code.
- **Hashing / signing / encryption** — one-way fingerprint / fingerprint-with-a-secret / reversible scrambling (§3.5).
- **HTTP** — the request/response protocol underlying the web (methods, headers, body, status codes).
- **Idempotent** — an operation safe to run repeatedly with the same result (e.g. `migrate deploy`).
- **Migration** — a versioned change to the database schema (§3.9).
- **Pooled vs. direct connection** — pooled shares DB connections (best for the app); direct is one-to-one (needed for migrations) (§3.6).
- **Prerendering** — building a page's HTML ahead of time so it loads instantly (§3.7).
- **Preview deployment** — a temporary live copy of a branch/PR at its own URL.
- **Serverless** — you don't manage servers; the platform runs code on demand and scales it (and can scale to zero).
- **Service container** — a throwaway service (e.g. Postgres) CI starts just for the duration of a job.
- **SPF / DKIM / DMARC** — DNS-based rules that prove an email genuinely came from your domain (§11).
- **Transactional email** — automatic one-to-one email triggered by a user action.
- **YAML** — an indentation-based config format used for CI workflow files.

---

## 18. Where to learn more

When you want to go deeper on a concept from this guide:
- **How the web works:** MDN's "How the Web works" and "An overview of HTTP" (developer.mozilla.org).
- **Environment variables in Next.js:** the Next.js docs page on Environment Variables (explains `NEXT_PUBLIC_` and build-time inlining).
- **Databases & migrations:** the Prisma docs — "Prisma Migrate" and "Connection pooling."
- **Auth concepts:** the Better Auth docs, and read up on "sessions vs. JWT" and "HMAC" for the signing idea.
- **Email deliverability:** Resend's docs on domain verification (SPF/DKIM/DMARC).
- **Deployment:** Vercel's docs on "Environments" and "Build & Development Settings."

A good way to cement all of this: **do it once more from scratch on a throwaway project**, following only the [Checklist](#14-checklist-do-it-yourself-on-a-new-project), and reach for the explanations here only when something surprises you. The second time through is when it becomes yours.

---

*Written as a personal reference for the Tedxplore deployment. Update it whenever the setup changes (e.g. after adding a custom domain or verifying an email domain).*
