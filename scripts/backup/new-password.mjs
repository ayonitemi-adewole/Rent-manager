// Makes a new password for the backup login and prints the two things to paste (docs/BACKUPS.md):
//
//   node scripts/backup/new-password.mjs
//
// 1. the SQL to run in Supabase → SQL Editor
// 2. the BACKUP_DATABASE_URL GitHub secret
//
// Letters and digits only, so the password goes into the URL without any encoding.
import { randomBytes } from 'node:crypto'

const PROJECT_REF = 'fyofadksrnasrnzxeptk'
// Session pooler: GitHub's machines have no IPv6, which the direct database address needs.
const POOLER = 'aws-1-eu-west-1.pooler.supabase.com:5432'

const password = randomBytes(24).toString('hex')

console.log(`
1. Supabase → SQL Editor, run:

alter role backup_reader password '${password}';

2. GitHub → Settings → Secrets and variables → Actions → BACKUP_DATABASE_URL (update), paste:

postgresql://backup_reader.${PROJECT_REF}:${password}@${POOLER}/postgres

Then close this terminal: the password isn't stored anywhere else.
`)
