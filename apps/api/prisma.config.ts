import path from 'path'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  datasource: {
    url: "postgresql://ubadmin:Uni-Book-2244@34.70.84.122:5432/universalbook",
  },
})
