import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/database/schema.ts',
  out: './drizzle',
  dbCredentials: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'globalnews',
    password: process.env.DB_PASSWORD || 'dev_password_change_in_prod',
    database: process.env.DB_NAME || 'globalnews',
  },
  verbose: true,
  strict: true,
});