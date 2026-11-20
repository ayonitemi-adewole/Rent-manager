# Database backups

Every night at 02:15 Lagos time, [.github/workflows/backup.yml](../.github/workflows/backup.yml):

1. **Dumps** the database with a read-only login (`backup_reader`): our schema, every row (including logins and scheduled jobs) and the migration history. The script is [scripts/backup/dump.sh](../scripts/backup/dump.sh).
2. **Encrypts** the dump with an [age](https://age-encryption.org) public key. Only the private key, which you keep offline, can open it. GitHub and Cloudflare never see the data.
3. **Uploads** it to a private Cloudflare R2 bucket: `daily/` (kept 35 days) plus, on the 1st of each month, `monthly/` (kept 400 days).
4. **Proves it restores:** it loads the same dump into an empty local Supabase and checks that every table has every row ([scripts/backup/restore-check.sh](../scripts/backup/restore-check.sh)).

If any step fails, the run fails and GitHub emails you.

**Not in the backup** (keep these in your password manager): Vault secrets, edge function secrets, Auth settings, the `backup_reader` password and the age private key. Supabase Storage isn't used, so there are no files to back up.

The repo is public, so the workflow logs are too. The workflow never prints data, row counts or sizes, and never uploads the dump as a GitHub artifact.

---

## One-time setup

### 1. Create the backup login

```sh
npm run db:push   # applies supabase/migrations/20261130090000_backup_role.sql
```

Then make its password. This prints the SQL to run and the finished connection string, so there is nothing to fill in by hand:

```sh
node scripts/backup/new-password.mjs
```

1. Run the `alter role backup_reader password …` line it prints in the Supabase dashboard → **SQL Editor**.
2. Copy the `postgresql://backup_reader…` line it prints: that is the `BACKUP_DATABASE_URL` secret (step 4).

The connection string uses the **session pooler** (port 5432), because GitHub's machines can't reach the direct (IPv6) address. To change the password later, run the script again and do both steps again.

### 2. Make the encryption key

Install age (`winget install FiloSottile.age`, then open a new terminal), and run:

```sh
age-keygen -o rentpadi-backup-key.txt
```

It prints `Public key: age1…`. That public key goes to GitHub. The file holds the **private key**:

- Keep it in your password manager **and** one offline copy (a USB stick or a printout in a safe place).
- **If you lose it, every backup is unreadable.** If someone else gets it *and* the R2 bucket, they can read your data.
- Never commit it. `.gitignore` already ignores `*backup-key*`.

### 3. Create the R2 bucket

In the Cloudflare dashboard → **R2 Object Storage**. The first time, R2 asks for a payment method; backups this size stay inside the free 10 GB.

1. **Create bucket** named `rentpadi-backups`. Leave it private: never turn on public access or a custom domain.
2. Bucket → **Settings** → **Object lifecycle rules**: add
   - prefix `daily/`: delete objects after **35 days**
   - prefix `monthly/`: delete objects after **400 days**
3. Optional but recommended: **Settings** → **Bucket lock rules**, prefix `daily/`, retain **7 days**. Then even a leaked token can't delete the last week of backups.
4. R2 overview → **Manage API tokens** → **Create API token**:
   - Permissions: **Object Read & Write**
   - Specify bucket: **only `rentpadi-backups`**
   - Copy the **Access Key ID** and **Secret Access Key** (shown once), and your **Account ID** (on the R2 overview page).

### 4. Add the GitHub secrets

GitHub → the repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:

| Secret | Value |
| --- | --- |
| `BACKUP_DATABASE_URL` | the connection string from step 1 |
| `BACKUP_AGE_RECIPIENT` | the `age1…` public key from step 2 |
| `R2_ACCOUNT_ID` | your Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | from the R2 token |
| `R2_SECRET_ACCESS_KEY` | from the R2 token |
| `R2_BUCKET` | `rentpadi-backups` |

### 5. Run it once

The workflow runs from the default branch, so merge it into `develop` first. Then go to **Actions** → **Database backup** → **Run workflow**. In about 5 minutes you should see a green run and a `daily/rentpadi-….tar.gz.age` file in the bucket.

Failure emails: GitHub → your profile → **Settings** → **Notifications** → **Actions**: tick **Email** and **Only notify for failed workflows**.

GitHub pauses scheduled workflows in public repos after **60 days without a commit** and emails a warning first. If that happens, re-enable it from the Actions tab.

---

## Restoring

Restore into a **new** Supabase project, check it, then switch the app over. Never restore over the live project: you'd overwrite whatever happened since the backup.

### 1. Get and open a backup

R2 → `rentpadi-backups` → `daily/` (or `monthly/`) → pick a file → **Download**. Then:

```sh
age --decrypt -i rentpadi-backup-key.txt -o backup.tar.gz rentpadi-2026-12-01T0115Z.tar.gz.age
tar -xzf backup.tar.gz   # → schema.sql, data.sql, counts.tsv
```

(Use `-o` as shown, not a pipe: PowerShell 5 pipes are text and corrupt binary files.)

### 2. Load it into a new project

1. Create a Supabase project in the **same region** (eu-west-1) on **Postgres 17**.
2. Copy its **session pooler** connection string (Connect → Session pooler).
3. With `psql` 17 (`winget install PostgreSQL.PostgreSQL.17` includes it), run:

```sh
psql "<new project connection string>" --single-transaction -v ON_ERROR_STOP=1 -f schema.sql -f data.sql
```

It's one transaction, so it either loads everything or nothing. This brings back the tables, policies, functions, logins, scheduled jobs and migration history. Afterwards `supabase link` + `supabase db push` on the new project should find nothing to apply.

### 3. Put back what isn't in the database

- **Vault secrets** `project_url` (the new project's URL) and `message_sender_secret`: the 5-minute message sender cron job reads them.
- **Edge functions:** `supabase functions deploy`, and `supabase secrets set` for each secret in the README (Paystack, Termii, Meta, Sentry, …).
- **Auth settings:** phone login, the Send SMS hook pointing at `sms-hook`, URL configuration.
- **Outside services:** the Paystack and Meta webhook URLs, and the app's `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` on Vercel.
- **This backup:** set a `backup_reader` password on the new project and update `BACKUP_DATABASE_URL`.

### Practise once

Do a full restore into a throwaway project once after setup, and again every few months. The nightly check proves the dump loads. A practice run proves that *you* can do it, with your key, without this page being new to you.
