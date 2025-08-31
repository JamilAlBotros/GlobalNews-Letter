import { FastifyInstance } from "fastify";
import { z } from "zod";
import { newsletterService, NewsletterData, NewsletterLanguage } from "../services/newsletter.js";
import { getDatabase } from "../database/connection.js";

const GenerateNewsletterInput = z.object({
  title: z.string().min(1, "Title is required"),
  intro: z.string().min(1, "Introduction is required"),
  articles: z.array(z.object({
    url: z.string().url("Valid URL required"),
    title: z.string().min(1, "Article title is required"),
    description: z.string().optional()
  })).min(1, "At least one article is required"),
  footer: z.string().optional(),
  language: z.enum(['ltr', 'rtl']).default('ltr')
});

const GenerateFromArticlesInput = z.object({
  article_ids: z.array(z.string().uuid()).min(1, "At least one article ID is required"),
  newsletter_title: z.string().optional(),
  intro: z.string().optional(),
  footer: z.string().optional(),
  force_language: z.enum(['ltr', 'rtl']).optional()
});

const PreviewInput = z.object({
  language: z.enum(['ltr', 'rtl']).default('ltr')
});

export async function newsletterRoutes(app: FastifyInstance): Promise<void> {
  const db = getDatabase();

  // Generate newsletter from custom data
  app.post("/newsletter/generate", async (request, reply) => {
    const body = GenerateNewsletterInput.parse(request.body);
    
    try {
      const html = newsletterService.generateDynamicNewsletter(
        {
          title: body.title,
          intro: body.intro,
          articles: body.articles,
          footer: body.footer
        },
        body.language
      );

      return reply
        .header('Content-Type', 'text/html')
        .send(html);
    } catch (error) {
      throw Object.assign(new Error("Failed to generate newsletter"), {
        status: 500,
        detail: (error as Error).message
      });
    }
  });

  // Generate newsletter from database articles
  app.post("/newsletter/from-articles", async (request, reply) => {
    const body = GenerateFromArticlesInput.parse(request.body);
    
    try {
      // Fetch articles from database
      const placeholders = body.article_ids.map(() => '?').join(',');
      const articles = db.all(`
        SELECT id, title, url, description, detected_language 
        FROM articles 
        WHERE id IN (${placeholders})
      `, body.article_ids) as Array<{
        id: string;
        title: string;
        url: string;
        description: string | null;
        detected_language: string | null;
      }>;

      if (articles.length === 0) {
        throw Object.assign(new Error("No articles found"), {
          status: 404,
          detail: "None of the provided article IDs were found in the database"
        });
      }

      const html = newsletterService.generateFromArticles(articles, {
        newsletterTitle: body.newsletter_title,
        intro: body.intro,
        footer: body.footer,
        forceLanguage: body.force_language
      });

      return reply
        .header('Content-Type', 'text/html')
        .send(html);
    } catch (error) {
      if ((error as any).status) {
        throw error; // Re-throw known errors
      }
      throw Object.assign(new Error("Failed to generate newsletter from articles"), {
        status: 500,
        detail: (error as Error).message
      });
    }
  });

  // Generate preview newsletter
  app.post("/newsletter/preview", async (request, reply) => {
    const body = PreviewInput.parse(request.body);
    
    try {
      const html = newsletterService.generatePreview(body.language);
      
      return reply
        .header('Content-Type', 'text/html')
        .send(html);
    } catch (error) {
      throw Object.assign(new Error("Failed to generate preview newsletter"), {
        status: 500,
        detail: (error as Error).message
      });
    }
  });

  // Get latest articles for newsletter creation
  app.get("/newsletter/latest-articles", async (request, reply) => {
    const query = z.object({
      limit: z.coerce.number().min(1).max(50).default(10),
      language: z.string().optional(),
      feed_id: z.string().uuid().optional()
    }).parse(request.query);

    try {
      let sql = `
        SELECT a.id, a.title, a.url, a.description, a.detected_language, 
               a.published_at, f.name as feed_name
        FROM articles a
        LEFT JOIN feeds f ON a.feed_id = f.id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (query.language) {
        sql += ` AND a.detected_language = ?`;
        params.push(query.language);
      }

      if (query.feed_id) {
        sql += ` AND a.feed_id = ?`;
        params.push(query.feed_id);
      }

      sql += ` ORDER BY a.published_at DESC LIMIT ?`;
      params.push(query.limit);

      const articles = db.all(sql, params);

      return reply.send({
        data: articles,
        total: articles.length,
        query: {
          limit: query.limit,
          language: query.language,
          feed_id: query.feed_id
        }
      });
    } catch (error) {
      throw Object.assign(new Error("Failed to fetch articles"), {
        status: 500,
        detail: (error as Error).message
      });
    }
  });

  // Get newsletter templates info
  app.get("/newsletter/templates", async (request, reply) => {
    return reply.send({
      templates: [
        {
          name: 'ltr',
          displayName: 'Left-to-Right (LTR)',
          description: 'Template for English, Spanish, French, and other LTR languages',
          fontFamily: 'Courier New, monospace',
          direction: 'ltr'
        },
        {
          name: 'rtl',
          displayName: 'Right-to-Left (RTL)',
          description: 'Template for Arabic, Hebrew, and other RTL languages',
          fontFamily: 'Tahoma, monospace',
          direction: 'rtl'
        }
      ],
      supported_languages: [
        'english', 'spanish', 'french', 'portuguese', 'chinese', 'japanese', 'arabic'
      ]
    });
  });
}