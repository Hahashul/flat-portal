# Flat Portal

A secure, two-sided web application for managing flat holders on construction and redevelopment projects. Administrators manage flats, accounts and documents; flat holders sign in to view their own flat, payment status and paperwork.

First deployment: **860 Shukrawar Peth** (A Wing, B Wing). The data model supports multiple projects.

---

## Contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Project structure](#project-structure)
- [Data model](#data-model)
- [Security](#security)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [Command reference](#command-reference)
- [Database operations](#database-operations)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap)
- [Pre-launch checklist](#pre-launch-checklist)
- [Ownership and maintenance](#ownership-and-maintenance)

---

## Features

### Administrator
- **Dashboard**: total flats, total sales value, amount received, amount pending, collection progress, flats by status (coloured badges), highest balances due, and a per-wing breakdown
- **Flats list**: search, status filter chips, payment progress, login status, clickable rows
- **Flat page**: a presentable view of one flat (balance, details, payment breakdown, documents, linked login) with an **Edit flat** button; the same page the customer sees
- **Flat management**: create, edit and delete; the Save button stays disabled until the required fields are filled
- **Account section** per flat: agreement value, stamp duty and registration, MSEB, legal, GST; additional charges (for example car parking) are configuration, not a schema change
- **Document management**: site plan and agreement per flat; choose files while adding a flat, or drag-and-drop, replace and delete when editing
- **Customer logins**: create an account for a flat holder and link it to one or more flats; the password is random (hidden, with show, copy and regenerate) or typed by the admin, and is shown once after creation

### Flat holder
- Email and password sign-in
- Read-only view of their own flat(s) with a balance-due card, details, charges, total, received, balance and last-updated date; customers with several flats switch between them with tabs
- Secure download of their site plan and agreement
- Owner flats with no financial data hide the payment section automatically

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router), React, JavaScript |
| Styling | Tailwind CSS v4 (one brand colour defined in `app/globals.css`) |
| Database | Supabase (PostgreSQL) |
| Authentication | Supabase Auth, email and password |
| File storage | Supabase Storage, private bucket |
| Hosting | Vercel |

The Supabase project runs in **Mumbai (ap-south-1)** for low latency in India.

---

## Architecture

```
Browser (Next.js client pages)
   |
   |-- Supabase JS client (publishable key) ---> Postgres + Auth + Storage
   |                                              protected by Row Level Security
   |
   '-- POST /api/admin/create-customer ---------> Next.js server route
                                                  verifies caller is admin,
                                                  then uses the secret key to
                                                  create the login and link flats
```

All reads and writes from the browser go through Row Level Security. The only privileged operation, creating a user, runs server-side behind an admin check.

---

## Project structure

```
app/
  page.js                           Routes visitors to login, admin or portal
  login/page.js                     Sign-in
  admin/
    layout.js                       Sidebar, session and admin-role guard
    page.js                         Dashboard
    flats/page.js                   Flats list
    flats/new/page.js               Create flat
    flats/[id]/page.js              Flat page (shared view, admin mode)
    flats/[id]/edit/page.js         Edit flat and documents
    customers/new/page.js           Create customer login
  portal/page.js                    Flat holder view (tabs for several flats)
  api/admin/create-customer/
    route.js                        Server-only user creation
components/
  FlatView.js                       Shared flat page (admin and customer)
  FlatForm.js                       Shared create and edit form
  FlatDocuments.js                  Site plan and agreement upload
lib/
  supabase.js                       Browser client
  supabaseAdmin.js                  Server-only client (secret key)
  format.js                         Currency formatting helpers
schema.sql                          Tables, views, policies, storage rules, seed data
import.mjs                          One-time Excel import (reads flats_import.json)
```

---

## Data model

```
projects ──< wings ──< flats ──< flat_charges
                         └─────< documents
profiles   one row per login (role: admin | customer)
statuses   allowed flat statuses (Sold, Tenant, Owner, For Sale)
```

| Table / view | Purpose |
|---|---|
| `profiles` | Links an `auth.users` login to a role, name and phone |
| `projects`, `wings` | Building hierarchy; add rows to onboard a new project |
| `flats` | One row per unit; `customer_id` is the login that may view it |
| `flat_charges` | One row per charge (`name`, `amount`); the total is their sum |
| `documents` | File metadata; `kind` is `site_plan`, `agreement` or `other` |
| `statuses` | Dropdown values for flat status |
| `flat_summary` (view) | Flats plus calculated `total_amount` and `balance_amount` |

Design decisions:
- **Totals are calculated, never stored.** `flat_summary` derives them, so they cannot drift out of sync.
- **Charges are rows, not columns.** New charge types need no migration.
- **One login per flat; one person may hold many flats.** Joint holders share a login, and their names are stored in `flats.holder_name`.
- **Flat numbers are text** (`Store No-7`, `502A`), unique per wing.

---

## Security

Authorisation is enforced by the database through Row Level Security (RLS). Hiding screens is a convenience and is not relied on.

- Flat holders can read only flats where `customer_id` matches their login, and only the charges and documents belonging to those flats
- Administrators have full read and write access
- No user can change their own role
- Documents live in a **private** bucket and are served through signed URLs that expire after one hour
- Public sign-up is disabled; only administrators create accounts
- The Supabase secret key is used only inside the server route, which first verifies the caller is a signed-in administrator
- Never commit `.env.local`, never expose the secret key to the browser, and never give it a `NEXT_PUBLIC_` prefix

---

## Getting started

### Prerequisites
- Node.js (current LTS)
- A Supabase project
- A GitHub account and a Vercel account for deployment

### Install

```bash
git clone <repository-url>
cd flat-portal
npm install
```

### Provision the database

1. In Supabase, open **SQL Editor** and run the contents of `schema.sql`
2. Create the administrator under **Authentication, Users, Add user**
3. Promote that user (see [Database operations](#database-operations))
4. Under **Authentication, Sign In / Providers**, disable new user sign-ups

### Run locally

```bash
npm run dev
```

The app is served at `http://localhost:3000`.

---

## Configuration

Create `.env.local` in the project root:

| Variable | Exposed to browser | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Project URL, `https://<project-id>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Publishable key (`sb_publishable_...`) |
| `SUPABASE_SERVICE_ROLE_KEY` | **No** | Secret key (`sb_secret_...`); server only |

Environment files are read at startup. Restart the dev server after changing them.

Adding a charge type: add its name to `CHARGE_NAMES` at the top of `components/FlatForm.js`.

### Theme

Shared styles (`.card`, `.btn`, `.btn-primary`, `.badge-*`) and the brand colour live in `app/globals.css`. To change the accent colour, edit the four `--color-brand-*` values in the `@theme` block; every screen uses `brand-` classes.

---

## Data import

The contractor's Excel sheet was converted once into `flats_import.json` (not committed, it holds customer data). Run from the project root, Node 20.6 or newer:

```bash
node --env-file=.env.local import.mjs          # dry run, writes nothing
node --env-file=.env.local import.mjs --run    # real import (safe to repeat)
```

Rules used: a `SALE` status with a holder becomes `Sold`, without a holder `For Sale`; agreement `23771/24/09/2026` becomes number and date; joint holders are joined with ` & `; blank statuses stay empty. Flats with a total but no breakdown, or parts that do not add up to the sheet total, were held back and are entered by hand: A-301, A-402, B-408, B-505, B-606.

---

## Command reference

### Application

```bash
npm install                  # install dependencies
npm run dev                  # development server with hot reload
npm run build                # production build (run before every deploy)
npm start                    # serve the production build locally
npm run lint                 # run ESLint
```

### Maintenance

```bash
npm outdated                 # list dependencies with newer versions
npm audit                    # report known vulnerabilities
npm audit fix                # apply safe fixes only
```

Avoid `npm audit fix --force` on this project without reviewing the changes; it can introduce breaking upgrades.

Clearing the Next.js build cache:

```bash
# Windows (cmd)
rmdir /s /q .next

# macOS / Linux / Git Bash
rm -rf .next
```

### Git

```bash
git status                           # what changed
git add .                            # stage everything
git commit -m "Describe the change"  # commit
git push                             # push; Vercel deploys automatically from main
git log --oneline -10                # recent history
git check-ignore .env.local          # must print the filename (file is ignored)
```

### Optional: Vercel CLI

```bash
npx vercel                   # preview deployment
npx vercel --prod            # production deployment
npx vercel env ls            # list environment variables
```

---

## Database operations

Run these in the Supabase **SQL Editor**. Clear the editor afterwards if a query contains a password.

**Promote a user to administrator**
```sql
insert into public.profiles (id, role, full_name)
values ('<user-uuid>', 'admin', 'Admin')
on conflict (id) do update set role = 'admin';
```

**List all profiles and roles**
```sql
select p.id, u.email, p.role, p.full_name
from public.profiles p
join auth.users u on u.id = p.id
order by p.role, u.email;
```

**Reset a user's password**
```sql
update auth.users
set encrypted_password = crypt('<new-strong-password>', gen_salt('bf'))
where email = '<user-email>';
```

**Delete a user** (the profile is removed automatically and their flats become unlinked)
```sql
delete from auth.users where email = '<user-email>';
```

**Flats that do not have a customer login yet**
```sql
select w.name as wing, f.flat_no, f.holder_name, f.status
from public.flats f
join public.wings w on w.id = f.wing_id
where f.customer_id is null
order by w.name, f.flat_no;
```

**Unlink a flat from its login**
```sql
update public.flats set customer_id = null where id = '<flat-uuid>';
```

**Check balances against the source data**
```sql
select w.name as wing, f.flat_no, f.holder_name,
       f.total_amount, f.received_amount, f.balance_amount
from public.flat_summary f
join public.wings w on w.id = f.wing_id
order by w.name, f.flat_no;
```

**Find likely data-entry errors** (received exceeds total, or no charges entered)
```sql
select w.name as wing, f.flat_no, f.total_amount, f.received_amount
from public.flat_summary f
join public.wings w on w.id = f.wing_id
where f.balance_amount < 0
   or (f.total_amount = 0 and f.received_amount > 0);
```

**Add a status option**
```sql
insert into public.statuses (name) values ('Handed over');
```

**Add a project and wings**
```sql
with p as (
  insert into public.projects (name, address)
  values ('New Project', 'Address')
  returning id
)
insert into public.wings (project_id, name)
select id, w from p, unnest(array['A', 'B']) as w;
```

---

## Deployment

Hosting is on Vercel, deployed from the `main` branch of a private GitHub repository.

1. Run `npm run build` locally and fix any errors
2. Push to `main`
3. In Vercel, set the three environment variables for Production and Preview
4. After the first deploy, set the Supabase **Site URL** (Authentication, URL Configuration) to the production address

Every push to `main` produces a new production deployment. HTTPS certificates are issued automatically for `vercel.app` addresses and for custom domains once DNS is correct.

---

## Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| Pages render unstyled | Stale build cache: stop the server, delete `.next`, restart |
| App cannot reach Supabase after editing `.env.local` | Restart `npm run dev` so the file is re-read |
| Admin area shows nothing | The login has no `admin` row in `profiles`; promote it |
| "That flat number already exists in this wing" | Flat numbers are unique per wing; check the wing selection |
| A flat's balance looks wrong | A charge is missing on that flat; compare against the source sheet |
| Customer sees "No flats are linked" | The flat's `customer_id` is empty; link it through Add customer |
| Document links stop working | Signed links expire after an hour; refresh the page |
| Deploy fails on Vercel | Read the last red lines of the build log; check variable names for typos |

---

## Roadmap

- [ ] Change-password page and email-based password reset (requires a transactional email provider; Supabase's built-in sender is heavily rate-limited)
- [ ] Two-factor authentication for the administrator account
- [ ] Unlink and reset actions for customer logins (the flats list already shows login status)
- [x] One-time import of the existing Excel records (five flats still to be entered by hand)
- [ ] Screens for managing projects and wings
- [ ] Additional dashboard cards based on the contractor's priorities
- [ ] Marathi language support, if required

---

## Pre-launch checklist

- [ ] Upgrade Supabase to a paid plan (the free tier pauses when idle and has no backups)
- [ ] Confirm the hosting plan permits commercial use
- [ ] Use a strong, unique administrator password, kept in a password manager
- [ ] Delete test accounts
- [ ] Confirm public sign-ups are disabled
- [ ] Verify isolation with two customers: neither may see the other's flats, charges or files
- [ ] Review `npm audit` output
- [ ] Verify entered data against the source sheet, and enter the corrected figures for the five held-back flats (A-301, A-402, B-408, B-505, B-606) and confirm B-601's received amount

---

## Ownership and maintenance

- The client owns the data. Agree an export and handover process in writing before launch
- Create the Supabase, Vercel and GitHub accounts under an owner who can be reached long term, and document who holds the credentials
- Keep secrets in environment variables and a password manager, never in the repository or in chat