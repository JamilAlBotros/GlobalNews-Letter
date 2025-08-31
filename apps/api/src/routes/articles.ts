import { FastifyInstance } from "fastify";
import { v4 as uuidv4 } from "uuid";
import { Article, CreateArticleInput, UpdateArticleInput } from "../schemas/article.js";
import { PaginationQuery } from "../schemas/common.js";
import { getDatabase } from "../database/connection.js";

interface ArticleRow {
  id: string;
  feed_id: string;
  detected_language: string | null;
  needs_manual_language_review: number;
  title: string;
  description: string | null;
  content: string | null;
  url: string;
  published_at: string;
  scraped_at: string;
  created_at: string;
}

function mapArticleRow(row: ArticleRow): Article {
  return {
    id: row.id,
    feed_id: row.feed_id,
    detected_language: row.detected_language,
    needs_manual_language_review: Boolean(row.needs_manual_language_review),
    title: row.title,
    description: row.description,
    content: row.content,
    url: row.url,
    published_at: row.published_at,
    scraped_at: row.scraped_at,
    created_at: row.created_at
  };
}

export async function articleRoutes(app: FastifyInstance): Promise<void> {
  const db = getDatabase();

  app.get("/articles", async (request, reply) => {
    const query = request.query as any;
    const paginationQuery = PaginationQuery.parse(query);
    const feedId = query.feed_id as string | undefined;
    
    const offset = (paginationQuery.page - 1) * paginationQuery.limit;

    let articlesQuery = "SELECT * FROM articles";
    let countQuery = "SELECT COUNT(*) as count FROM articles";
    const queryParams: any[] = [];

    if (feedId) {
      articlesQuery += " WHERE feed_id = ?";
      countQuery += " WHERE feed_id = ?";
      queryParams.push(feedId);
    }

    articlesQuery += " ORDER BY published_at DESC LIMIT ? OFFSET ?";
    const articlesParams = [...queryParams, paginationQuery.limit, offset];
    const countParams = [...queryParams];

    const [articles, totalResult] = await Promise.all([
      db.all<ArticleRow>(articlesQuery, ...articlesParams),
      db.get<{ count: number }>(countQuery, ...countParams)
    ]);

    const total = totalResult?.count || 0;
    const totalPages = Math.ceil(total / paginationQuery.limit);

    return {
      data: articles.map(mapArticleRow),
      pagination: {
        page: paginationQuery.page,
        limit: paginationQuery.limit,
        total,
        total_pages: totalPages
      }
    };
  });

  app.post("/articles", async (request, reply) => {
    const input = CreateArticleInput.parse(request.body);
    
    const existingFeed = await db.get(
      "SELECT id FROM feeds WHERE id = ?",
      input.feed_id
    );

    if (!existingFeed) {
      return reply.code(400).type("application/problem+json").send({
        type: "about:blank",
        title: "Feed not found",
        status: 400,
        instance: request.url
      });
    }

    const existingArticle = await db.get<ArticleRow>(
      "SELECT id FROM articles WHERE url = ?",
      input.url
    );

    if (existingArticle) {
      return reply.code(409).type("application/problem+json").send({
        type: "about:blank",
        title: "Article with this URL already exists",
        status: 409,
        instance: request.url
      });
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    await db.run(`
      INSERT INTO articles (id, feed_id, detected_language, needs_manual_language_review, title, description, content, url, published_at, scraped_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      input.feed_id,
      input.detected_language,
      input.needs_manual_language_review ? 1 : 0,
      input.title,
      input.description,
      input.content,
      input.url,
      input.published_at,
      now,
      now
    ]);

    const newArticle = await db.get<ArticleRow>("SELECT * FROM articles WHERE id = ?", id);
    if (!newArticle) {
      throw new Error("Failed to create article");
    }

    reply.code(201);
    return mapArticleRow(newArticle);
  });

  app.get("/articles/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    
    const article = await db.get<ArticleRow>("SELECT * FROM articles WHERE id = ?", id);
    if (!article) {
      return reply.code(404).type("application/problem+json").send({
        type: "about:blank",
        title: "Article not found",
        status: 404,
        instance: request.url
      });
    }

    return mapArticleRow(article);
  });

  app.put("/articles/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const input = UpdateArticleInput.parse(request.body);

    const existingArticle = await db.get<ArticleRow>("SELECT * FROM articles WHERE id = ?", id);
    if (!existingArticle) {
      reply.code(404);
      throw new Error("Article not found");
    }

    if (input.url && input.url !== existingArticle.url) {
      const duplicateArticle = await db.get<ArticleRow>(
        "SELECT id FROM articles WHERE url = ? AND id != ?",
        input.url,
        id
      );
      if (duplicateArticle) {
        reply.code(400);
        throw new Error("Another article with this URL already exists");
      }
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (input.title !== undefined) {
      updates.push("title = ?");
      values.push(input.title);
    }
    if (input.description !== undefined) {
      updates.push("description = ?");
      values.push(input.description);
    }
    if (input.detected_language !== undefined) {
      updates.push("detected_language = ?");
      values.push(input.detected_language);
    }
    if (input.needs_manual_language_review !== undefined) {
      updates.push("needs_manual_language_review = ?");
      values.push(input.needs_manual_language_review ? 1 : 0);
    }
    if (input.content !== undefined) {
      updates.push("content = ?");
      values.push(input.content);
    }
    if (input.url !== undefined) {
      updates.push("url = ?");
      values.push(input.url);
    }
    if (input.published_at !== undefined) {
      updates.push("published_at = ?");
      values.push(input.published_at);
    }

    if (updates.length === 0) {
      return mapArticleRow(existingArticle);
    }

    values.push(id);

    await db.run(
      `UPDATE articles SET ${updates.join(", ")} WHERE id = ?`,
      ...values
    );

    const updatedArticle = await db.get<ArticleRow>("SELECT * FROM articles WHERE id = ?", id);
    if (!updatedArticle) {
      throw new Error("Failed to update article");
    }

    return mapArticleRow(updatedArticle);
  });

  app.delete("/articles/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    
    const existingArticle = await db.get<ArticleRow>("SELECT id FROM articles WHERE id = ?", id);
    if (!existingArticle) {
      reply.code(404);
      throw new Error("Article not found");
    }

    await db.run("DELETE FROM articles WHERE id = ?", id);
    reply.code(204);
  });
}