import { FastifyInstance } from "fastify";
import { v4 as uuidv4 } from "uuid";
import { Feed, CreateFeedInput, UpdateFeedInput } from "../schemas/feed.js";
import { PaginationQuery } from "../schemas/common.js";
import { getDatabase } from "../database/connection.js";

interface FeedRow {
  id: string;
  name: string;
  url: string;
  language: string;
  region: string;
  category: string;
  type: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

function mapFeedRow(row: FeedRow): Feed {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    language: row.language as any,
    region: row.region,
    category: row.category as any,
    type: row.type as any,
    is_active: Boolean(row.is_active),
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

export async function feedRoutes(app: FastifyInstance): Promise<void> {
  const db = getDatabase();

  app.get("/feeds", async (request, reply) => {
    const query = PaginationQuery.parse(request.query);
    const offset = (query.page - 1) * query.limit;

    const [feeds, totalResult] = await Promise.all([
      db.all<FeedRow>(
        "SELECT * FROM feeds ORDER BY created_at DESC LIMIT ? OFFSET ?",
        query.limit,
        offset
      ),
      db.get<{ count: number }>("SELECT COUNT(*) as count FROM feeds")
    ]);

    const total = totalResult?.count || 0;
    const totalPages = Math.ceil(total / query.limit);

    return {
      data: feeds.map(mapFeedRow),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        total_pages: totalPages
      }
    };
  });

  app.post("/feeds", async (request, reply) => {
    const input = CreateFeedInput.parse(request.body);
    
    const existingFeed = await db.get<FeedRow>(
      "SELECT id FROM feeds WHERE url = ?",
      input.url
    );

    if (existingFeed) {
      return reply.code(409).type("application/problem+json").send({
        type: "about:blank",
        title: "Feed with this URL already exists",
        status: 409,
        instance: request.url
      });
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    await db.run(`
      INSERT INTO feeds (id, name, url, language, region, category, type, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, input.name, input.url, input.language, input.region, input.category, input.type, input.is_active ? 1 : 0, now, now]);

    const newFeed = await db.get<FeedRow>("SELECT * FROM feeds WHERE id = ?", id);
    if (!newFeed) {
      throw new Error("Failed to create feed");
    }

    reply.code(201);
    return mapFeedRow(newFeed);
  });

  app.get("/feeds/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    
    const feed = await db.get<FeedRow>("SELECT * FROM feeds WHERE id = ?", id);
    if (!feed) {
      return reply.code(404).type("application/problem+json").send({
        type: "about:blank",
        title: "Feed not found",
        status: 404,
        instance: request.url
      });
    }

    return mapFeedRow(feed);
  });

  app.put("/feeds/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const input = UpdateFeedInput.parse(request.body);

    const existingFeed = await db.get<FeedRow>("SELECT * FROM feeds WHERE id = ?", id);
    if (!existingFeed) {
      return reply.code(404).type("application/problem+json").send({
        type: "about:blank",
        title: "Feed not found",
        status: 404,
        instance: request.url
      });
    }

    if (input.url && input.url !== existingFeed.url) {
      const duplicateFeed = await db.get<FeedRow>(
        "SELECT id FROM feeds WHERE url = ? AND id != ?",
        input.url,
        id
      );
      if (duplicateFeed) {
        reply.code(400);
        throw new Error("Another feed with this URL already exists");
      }
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (input.name !== undefined) {
      updates.push("name = ?");
      values.push(input.name);
    }
    if (input.url !== undefined) {
      updates.push("url = ?");
      values.push(input.url);
    }
    if (input.language !== undefined) {
      updates.push("language = ?");
      values.push(input.language);
    }
    if (input.region !== undefined) {
      updates.push("region = ?");
      values.push(input.region);
    }
    if (input.category !== undefined) {
      updates.push("category = ?");
      values.push(input.category);
    }
    if (input.type !== undefined) {
      updates.push("type = ?");
      values.push(input.type);
    }
    if (input.is_active !== undefined) {
      updates.push("is_active = ?");
      values.push(input.is_active ? 1 : 0);
    }

    if (updates.length === 0) {
      return mapFeedRow(existingFeed);
    }

    updates.push("updated_at = ?");
    values.push(new Date().toISOString());
    values.push(id);

    await db.run(
      `UPDATE feeds SET ${updates.join(", ")} WHERE id = ?`,
      ...values
    );

    const updatedFeed = await db.get<FeedRow>("SELECT * FROM feeds WHERE id = ?", id);
    if (!updatedFeed) {
      throw new Error("Failed to update feed");
    }

    return mapFeedRow(updatedFeed);
  });

  app.delete("/feeds/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    
    const existingFeed = await db.get<FeedRow>("SELECT id FROM feeds WHERE id = ?", id);
    if (!existingFeed) {
      return reply.code(404).type("application/problem+json").send({
        type: "about:blank",
        title: "Feed not found",
        status: 404,
        instance: request.url
      });
    }

    await db.run("DELETE FROM feeds WHERE id = ?", id);
    reply.code(204);
  });
}