# Security

## Reporting a vulnerability

Please do not open a public issue. Email **harshuladwani@gmail.com** with the
details and steps to reproduce. I will reply as soon as I can.

## How Flat Portal protects data

- **Tenant isolation in the database.** Every customer's data belongs to one
  organization, and Postgres Row Level Security enforces this on every table.
  The app cannot read across organizations, even by mistake.
- **No self sign-up.** Only the platform admin creates logins and resets passwords.
- **Read-only demo.** The demo account can only read the dummy "Demo" organization.
  The database blocks its writes, not just the interface.
- **Private files.** Storage buckets are private. Access is tied to database rows.
- **Server-only secrets.** The service role key is used only in server code and
  is never sent to the browser.
- **Disable without data loss.** A disabled login is blocked at once and its data is kept.

## Supported versions

Only the latest version on the `main` branch.
