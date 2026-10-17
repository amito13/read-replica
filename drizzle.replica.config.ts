import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

if (!process.env.READ_DATABASE_URL) {
  throw new Error('READ_DATABASE_URL must be set');
}

export default defineConfig({
  schema: './src/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.READ_DATABASE_URL,
  },
});
