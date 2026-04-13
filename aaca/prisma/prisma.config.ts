import { defineConfig } from 'prisma/config'

export default defineConfig({
  earlyAccess: true,
  migrations: {
    path: './migrations',
    adapter: 'postgresql',
  },
})
