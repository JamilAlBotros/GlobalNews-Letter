import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { v4 as uuidv4 } from "uuid";
import { initializeDatabase } from "./database/init.js";
import { getDatabase, healthCheck } from "./database/connection.js";
import { feedRoutes } from "./routes/feeds.js";
import { articleRoutes } from "./routes/articles.js";
import { backupRoutes } from "./routes/backup.js";
import { pollingRoutes } from "./routes/polling.js";
import { translationRoutes } from "./routes/translation.js";
import { newsletterRoutes } from "./routes/newsletter.js";
import { newsletterRoutes as newsletterCrudRoutes } from "./routes/newsletters.js";
import { llmRoutes } from "./routes/llm.js";
import { settingsRoutes } from "./routes/settings.js";
import { dashboardRoutes } from "./routes/dashboard.js";
import { newsletterTranslationJobRoutes } from "./routes/newsletter-translation-jobs.js";
import { googleRSSFeedRoutes } from "./routes/google-rss-feeds.js";
import { pollingScheduler } from "./services/polling-scheduler.js";

const app = Fastify({
  logger: {
    level: "info",
    serializers: {
      req: (req) => ({
        method: req.method,
        url: req.url,
        headers: req.headers,
        reqId: (req as any).reqId
      }),
      res: (res) => ({
        statusCode: res.statusCode
      })
    }
  }
});

app.addHook("onRequest", async (request, reply) => {
  (request as any).reqId = uuidv4();
  (reply as any).start = performance.now();
});

app.addHook("onResponse", async (request, reply) => {
  const ms = Math.round(performance.now() - (reply as any).start);
  console.log(JSON.stringify({
    ts: new Date().toISOString(),
    level: "info",
    msg: "request",
    reqId: (request as any).reqId,
    method: request.method,
    url: request.url,
    status: reply.statusCode,
    ms
  }));
});

app.setErrorHandler(async (error, request, reply) => {
  const status = (error as any).status ?? (error as any).statusCode ?? 500;
  const problem = {
    type: "about:blank",
    title: status >= 500 ? "Internal Server Error" : error.message,
    status,
    detail: (error as any).detail,
    instance: request.url
  };
  
  reply.code(status).type("application/problem+json").send(problem);
});

await app.register(cors, {
  origin: ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002", "http://localhost:3333"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"]
});

await app.register(rateLimit, {
  max: 1000,
  timeWindow: "1 minute"
});

app.get("/healthz", async () => {
  return {
    ok: true,
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  };
});

app.get("/readyz", async (request, reply) => {
  const isReady = await healthCheck();
  
  if (!isReady) {
    reply.code(503);
    return {
      ready: false,
      database: false,
      timestamp: new Date().toISOString()
    };
  }
  
  return {
    ready: true,
    database: true,
    timestamp: new Date().toISOString()
  };
});

await app.register(feedRoutes);
await app.register(articleRoutes);
await app.register(backupRoutes);
await app.register(pollingRoutes);
await app.register(translationRoutes);
await app.register(newsletterRoutes);
await app.register(newsletterCrudRoutes);
await app.register(newsletterTranslationJobRoutes);
await app.register(googleRSSFeedRoutes);
await app.register(llmRoutes);
await app.register(settingsRoutes);
await app.register(dashboardRoutes);

const start = async (): Promise<void> => {
  try {
    await initializeDatabase();
    await app.listen({ port: 3333, host: "0.0.0.0" });
    console.log("🚀 Server started on http://localhost:3333");
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

const shutdown = async (signal: string): Promise<void> => {
  console.log(`\nReceived ${signal}, shutting down gracefully...`);
  try {
    // Stop polling scheduler first
    await pollingScheduler.stop();
    await app.close();
    console.log("Server closed successfully");
    process.exit(0);
  } catch (error) {
    console.error("Error during shutdown:", error);
    process.exit(1);
  }
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

start();