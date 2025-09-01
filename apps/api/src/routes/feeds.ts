import { FastifyInstance } from "fastify";
import { v4 as uuidv4 } from "uuid";
import { Feed, CreateFeedInput, UpdateFeedInput } from "../schemas/feed.js";
import { PaginationQuery } from "../schemas/common.js";
import { getDatabase } from "../database/connection.js";
import { validateRSSFeed, RSSValidationError } from "../utils/rss-validator.js";

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

    const feeds = db.all<FeedRow>(
      "SELECT * FROM feeds ORDER BY created_at DESC LIMIT ? OFFSET ?",
      query.limit,
      offset
    );
    const totalResult = db.get<{ count: number }>("SELECT COUNT(*) as count FROM feeds");

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
    
    // Step 1: Validate RSS feed before proceeding
    const validationResult = await validateRSSFeed({ url: input.url });
    
    if (!validationResult.isValid) {
      return reply.code(400).type("application/problem+json").send({
        type: "about:blank",
        title: "Invalid RSS Feed",
        status: 400,
        detail: `RSS validation failed: ${validationResult.message}`,
        instance: request.url,
        extensions: {
          validation_result: validationResult
        }
      });
    }

    // Step 2: Check for existing feed
    const existingFeed = db.get<FeedRow>(
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

    // Step 3: Create feed if validation passed
    const id = uuidv4();
    const now = new Date().toISOString();

    db.run(`
      INSERT INTO feeds (id, name, url, language, region, category, type, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, input.name, input.url, input.language, input.region, input.category, input.type, input.is_active ? 1 : 0, now, now]);

    const newFeed = db.get<FeedRow>("SELECT * FROM feeds WHERE id = ?", id);
    if (!newFeed) {
      throw new Error("Failed to create feed");
    }

    reply.code(201);
    return {
      ...mapFeedRow(newFeed),
      validation_info: {
        message: validationResult.message,
        has_entries: validationResult.hasEntries,
        entry_count: validationResult.entryCount,
        feed_title: validationResult.feedTitle
      }
    };
  });

  // RSS validation endpoint - test feed without creating it
  app.post("/feeds/validate", async (request, reply) => {
    const { url } = request.body as { url: string };
    
    if (!url) {
      return reply.code(400).type("application/problem+json").send({
        type: "about:blank",
        title: "Missing URL",
        status: 400,
        detail: "URL is required for RSS validation",
        instance: request.url
      });
    }

    try {
      const validationResult = await validateRSSFeed({ url });
      
      return {
        url,
        validation_result: validationResult,
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
      return reply.code(500).type("application/problem+json").send({
        type: "about:blank",
        title: "Validation Error",
        status: 500,
        detail: `Failed to validate RSS feed: ${error.message}`,
        instance: request.url
      });
    }
  });

  app.get("/feeds/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    
    const feed = db.get<FeedRow>("SELECT * FROM feeds WHERE id = ?", id);
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

    const existingFeed = db.get<FeedRow>("SELECT * FROM feeds WHERE id = ?", id);
    if (!existingFeed) {
      return reply.code(404).type("application/problem+json").send({
        type: "about:blank",
        title: "Feed not found",
        status: 404,
        instance: request.url
      });
    }

    if (input.url && input.url !== existingFeed.url) {
      const duplicateFeed = db.get<FeedRow>(
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

    db.run(
      `UPDATE feeds SET ${updates.join(", ")} WHERE id = ?`,
      ...values
    );

    const updatedFeed = db.get<FeedRow>("SELECT * FROM feeds WHERE id = ?", id);
    if (!updatedFeed) {
      throw new Error("Failed to update feed");
    }

    return mapFeedRow(updatedFeed);
  });

  app.delete("/feeds/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    
    const existingFeed = db.get<FeedRow>("SELECT id FROM feeds WHERE id = ?", id);
    if (!existingFeed) {
      return reply.code(404).type("application/problem+json").send({
        type: "about:blank",
        title: "Feed not found",
        status: 404,
        instance: request.url
      });
    }

    db.run("DELETE FROM feeds WHERE id = ?", id);
    reply.code(204);
  });

  // Feed instances endpoint - shows actual feed processing instances/runs
  app.get("/feeds/instances", async (request, reply) => {
    const query = PaginationQuery.parse(request.query);
    const offset = (query.page - 1) * query.limit;

    // For now, return feed processing instances (could be from feed_runs or similar table)
    // This is a placeholder implementation - adjust based on your feed processing architecture
    const instances = db.all<any>(
      `SELECT f.id, f.name, f.url, f.is_active, f.updated_at as last_run,
       'running' as status, 0 as articles_fetched, NULL as error_message
       FROM feeds f WHERE f.is_active = 1 
       ORDER BY f.updated_at DESC LIMIT ? OFFSET ?`,
      query.limit,
      offset
    );
    const totalResult = db.get<{ count: number }>("SELECT COUNT(*) as count FROM feeds WHERE is_active = 1");

    const total = totalResult?.count || 0;
    const totalPages = Math.ceil(total / query.limit);

    return {
      data: instances,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        total_pages: totalPages
      }
    };
  });

  // Get feeds with filtering options for polling
  app.get("/feeds/filter-options", async (request, reply) => {
    const feeds = db.all<FeedRow>("SELECT * FROM feeds WHERE is_active = 1");
    
    const categories = [...new Set(feeds.map(feed => feed.category))].sort();
    const languages = [...new Set(feeds.map(feed => feed.language))].sort();
    const regions = [...new Set(feeds.map(feed => feed.region))].sort();
    const types = [...new Set(feeds.map(feed => feed.type))].sort();
    
    return reply.send({
      categories,
      languages,
      regions,
      types,
      total_feeds: feeds.length
    });
  });
  
  // Get filtered feeds for polling
  app.post("/feeds/filtered", async (request, reply) => {
    const filters = request.body as {
      categories?: string[];
      languages?: string[];
      regions?: string[];
      types?: string[];
      feed_ids?: string[];
    };
    
    let query = "SELECT * FROM feeds WHERE is_active = 1";
    let params: any[] = [];
    let conditions: string[] = [];
    
    // Apply filters
    if (filters.feed_ids && filters.feed_ids.length > 0) {
      conditions.push(`id IN (${filters.feed_ids.map(() => '?').join(',')})`);
      params.push(...filters.feed_ids);
    }
    
    if (filters.categories && filters.categories.length > 0) {
      conditions.push(`category IN (${filters.categories.map(() => '?').join(',')})`);
      params.push(...filters.categories);
    }
    
    if (filters.languages && filters.languages.length > 0) {
      conditions.push(`language IN (${filters.languages.map(() => '?').join(',')})`);
      params.push(...filters.languages);
    }
    
    if (filters.regions && filters.regions.length > 0) {
      conditions.push(`region IN (${filters.regions.map(() => '?').join(',')})`);
      params.push(...filters.regions);
    }
    
    if (filters.types && filters.types.length > 0) {
      conditions.push(`type IN (${filters.types.map(() => '?').join(',')})`);
      params.push(...filters.types);
    }
    
    if (conditions.length > 0) {
      query += ` AND ${conditions.join(' AND ')}`;
    }
    
    query += " ORDER BY name ASC";
    
    const feedRows = db.all<FeedRow>(query, ...params);
    const feeds = feedRows.map(mapFeedRow);
    
    return reply.send({
      feeds,
      total: feeds.length,
      applied_filters: filters
    });
  });
}