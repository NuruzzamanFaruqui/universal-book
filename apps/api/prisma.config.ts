import path from 'path'
import { config as loadEnv } from 'dotenv'
import { defineConfig } from 'prisma/config'

// Prisma CLI commands run outside the Nest process, so nothing else has loaded
// .env by this point.
loadEnv({ path: path.join(__dirname, '.env') })

// Deliberately a warning rather than a throw: `prisma generate` never opens a
// connection and runs during the Docker build, where no DATABASE_URL exists.
// Commands that do need a connection fail on their own with a clear message.
if (!process.env.DATABASE_URL) {
  console.warn(
    '[prisma.config] DATABASE_URL is not set. Codegen will still work; ' +
    'anything touching the database will not. See apps/api/.env.example.',
  )
}

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
})
