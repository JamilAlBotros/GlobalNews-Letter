import { FastifyInstance } from "fastify";
import { v4 as uuidv4 } from "uuid";
import { Article, CreateArticleInput, UpdateArticleInput } from "../schemas/article.js";
import { PaginationQuery } from "../schemas/common.js";
import { articleRepository, feedRepository } from "../repositories/index.js";
import type { DatabaseFilterOptions } from "../types/index.js";

interface ArticleRow {
  id: string;
  feed_id: string;
  detected_language: string | null;
  needs_manual_language_review: number | null;
  title: string;
  description: string | null;
  content: string | null;
  url: string;
  published_at: string;
  scraped_at: string;
  created_at: string;
  summary: string | null;
  original_language: string | null;
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
  app.get("/articles", async (request, reply) => {
    const query = request.query as any;
    const paginationQuery = PaginationQuery.parse(query);
    const feedId = query.feed_id as string | undefined;
    
    const offset = (paginationQuery.page - 1) * paginationQuery.limit;

    if (feedId) {
      // Use findByFeedId method for feed-specific queries
      const articles = await articleRepository.findByFeedId(feedId, paginationQuery.limit);
      const total = articles.length; // Note: This is a limitation - we get all articles for the feed
      
      return {
        data: articles.map(mapArticleRow),
        pagination: {
          page: paginationQuery.page,
          limit: paginationQuery.limit,
          total,
          total_pages: Math.ceil(total / paginationQuery.limit)
        }
      };
    } else {
      // Use findMany and countMany methods for general queries
      const filterOptions: DatabaseFilterOptions = {
        sortBy: 'publishedAt',
        limit: paginationQuery.limit,
        offset: offset
      };

      try {
        const [articles, total] = await Promise.all([
          articleRepository.findMany(filterOptions),
          articleRepository.countMany(filterOptions)
        ]);

        const totalPages = Math.ceil(total / paginationQuery.limit);

        return {
          data: articles.map(mapArticleRow),
          pagination: {
            page: paginationQuery.page,
            limit: paginationQuery.limit,
            total: Number(total), // Ensure it's a number
            total_pages: totalPages
          }
        };
      } catch (error) {
        console.error('Error in articles route:', error);
        throw error;
      }
    }
  });

  app.post("/articles", async (request, reply) => {
    const input = CreateArticleInput.parse(request.body);
    
    try {
      // Use repository method for feed validation
      const existingFeed = await feedRepository.findById(input.feed_id);

      if (!existingFeed) {
        return reply.code(400).type("application/problem+json").send({
          type: "about:blank",
          title: "Feed not found",
          status: 400,
          instance: request.url
        });
      }

      // Use repository method for article URL check
      const existingArticle = await articleRepository.findByUrl(input.url);

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

      // Use repository method for article creation
      await articleRepository.create({
        id,
        feed_id: input.feed_id,
        title: input.title,
        description: input.description,
        content: input.content,
        url: input.url,
        detected_language: input.detected_language,
        needs_manual_language_review: input.needs_manual_language_review,
        published_at: input.published_at,
        scraped_at: now,
        created_at: now
      });

      const newArticle = await articleRepository.findById(id);
      if (!newArticle) {
        throw new Error("Failed to create article");
      }

      reply.code(201);
      return mapArticleRow(newArticle);
    } catch (error) {
      console.error('Error creating article:', error);
      throw error;
    }
  });

  app.get("/articles/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    
    try {
      // Use repository method for finding article by ID
      const article = await articleRepository.findById(id);
      if (!article) {
        return reply.code(404).type("application/problem+json").send({
          type: "about:blank",
          title: "Article not found",
          status: 404,
          instance: request.url
        });
      }

      return mapArticleRow(article);
    } catch (error) {
      console.error('Error finding article:', error);
      throw error;
    }
  });

  app.put("/articles/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const input = UpdateArticleInput.parse(request.body);

    try {
      // Use repository method for finding existing article
      const existingArticle = await articleRepository.findById(id);
      if (!existingArticle) {
        reply.code(404);
        throw new Error("Article not found");
      }

      if (input.url && input.url !== existingArticle.url) {
        // Use repository method for checking duplicate URLs
        const duplicateArticle = await articleRepository.findByUrl(input.url);
        if (duplicateArticle && duplicateArticle.id !== id) {
          reply.code(400);
          throw new Error("Another article with this URL already exists");
        }
      }

      // Use repository method for updating article
      const updateData = {
        title: input.title,
        description: input.description,
        content: input.content,
        detected_language: input.detected_language,
        needs_manual_language_review: input.needs_manual_language_review
      };

      const updated = await articleRepository.update(id, updateData);
      if (!updated) {
        return mapArticleRow(existingArticle);
      }

      const updatedArticle = await articleRepository.findById(id);
      if (!updatedArticle) {
        throw new Error("Failed to update article");
      }

      return mapArticleRow(updatedArticle);
    } catch (error) {
      console.error('Error updating article:', error);
      throw error;
    }
  });

  app.delete("/articles/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    
    try {
      // Use repository method for checking if article exists
      const existingArticle = await articleRepository.findById(id);
      if (!existingArticle) {
        reply.code(404);
        throw new Error("Article not found");
      }

      // Use repository method for deleting article
      await articleRepository.delete(id);
      reply.code(204);
    } catch (error) {
      console.error('Error deleting article:', error);
      throw error;
    }
  });
}