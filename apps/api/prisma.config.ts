import path from 'path'
import { config as loadEnv } from 'dotenv'
import { defineConfig } from 'prisma/config'

// Prisma CLI commands run outside the Nest process, so nothing else has loaded
// .env by this point.
loadEnv({ path: path.join(__dirname, '.env') })

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is not set. Add it to apps/api/.env (see .env.example) ' +
    'or export it before running Prisma CLI commands.',
  )
}

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  datasource: {
    url: process.env.DATABASE_URL,
  },
})
