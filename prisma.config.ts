import "dotenv/config";
import path from "node:path";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  earlyAccess: true,
  schema: path.join(__dirname, "prisma", "schema.prisma"),
  datasource: {
    url: env("DATABASE_URL"),
  },
  migrate: {
    development: {
      migrations: {
        path: "prisma/migrations",
      },
    },
  },
  seed: {
    tsx: "prisma/seed.ts",
  },
});
