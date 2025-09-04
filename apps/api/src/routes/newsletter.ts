import { FastifyInstance } from "fastify";
import { z } from "zod";
import { newsletterService, NewsletterData, NewsletterLanguage } from "../services/newsletter.js";
import { articleRepository, feedRepository } from "../repositories/index.js";
import type { DatabaseFilterOptions } from "../types/index.js";

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


export async function newsletterRoutes(app: FastifyInstance): Promise<void> {
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
      // Fetch articles from database using repository
      const dbArticles = await Promise.all(
        body.article_ids.map(id => articleRepository.findById(id))
      );
      const filteredArticles = dbArticles.filter(Boolean) as NonNullable<typeof dbArticles[number]>[];
      const articles = filteredArticles.map(article => ({
        title: article.title,
        url: article.url,
        description: article.description,
        detected_language: article.detected_language
      }));

      if (articles.length === 0) {
        throw Object.assign(new Error("No articles found"), {
          status: 404,
          detail: "None of the provided article IDs were found in the database"
        });
      }

      // Convert null descriptions to undefined to match service interface
      const formattedArticles = articles.map(article => ({
        ...article,
        description: article.description ?? undefined
      }));

      const html = newsletterService.generateFromArticles(formattedArticles, {
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


  // Get latest articles for newsletter creation
  app.get("/newsletter/latest-articles", async (request, reply) => {
    const query = z.object({
      limit: z.coerce.number().min(1).max(50).default(10),
      language: z.string().optional(),
      feed_id: z.string().uuid().optional()
    }).parse(request.query);

    try {
      // Use repository method with filter options
      const filterOptions: DatabaseFilterOptions = {
        language: query.language,
        limit: query.limit,
        offset: 0,
        sortBy: 'publishedAt'
      };

      const articles = await articleRepository.findMany(filterOptions);
      
      // Filter by feed_id if specified (since repository doesn't support feed_id filtering)
      let filteredArticles = articles;
      if (query.feed_id) {
        filteredArticles = articles.filter(article => article.feed_id === query.feed_id);
      }

      // Get feed names for each article
      const articlesWithFeedNames = await Promise.all(
        filteredArticles.map(async (article) => {
          const feed = await feedRepository.findById(article.feed_id);
          return {
            id: article.id,
            title: article.title,
            url: article.url,
            description: article.description,
            detected_language: article.detected_language,
            published_at: article.published_at,
            feed_name: feed?.name || 'Unknown Feed'
          };
        })
      );

      return reply.send({
        data: articlesWithFeedNames,
        total: articlesWithFeedNames.length,
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