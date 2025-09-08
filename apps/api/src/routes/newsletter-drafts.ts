import { FastifyInstance } from "fastify";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { getDatabase } from "../database/connection.js";

// Zod schemas for validation
const NewsletterItemSchema = z.object({
  id: z.string(),
  type: z.enum(['article', 'text']),
  content: z.union([
    z.object({
      id: z.string(),
      title: z.string(),
      url: z.string(),
      description: z.string().nullable(),
      feed_name: z.string(),
      detected_language: z.string().nullable(),
      published_at: z.string(),
      created_at: z.string()
    }),
    z.object({
      text: z.string(),
      htmlContent: z.string().optional()
    })
  ]),
  order: z.number()
});

const NewsletterDraftSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  items: z.array(NewsletterItemSchema)
});

const UpdateNewsletterDraftSchema = z.object({
  id: z.string(),
  title: z.string().min(1, 'Title is required'),
  items: z.array(NewsletterItemSchema)
});

export async function newsletterDraftRoutes(app: FastifyInstance): Promise<void> {
  const db = getDatabase();

  // Get all newsletter drafts
  app.get("/newsletter/drafts", async (request, reply) => {
    try {
      const drafts = await db.all(`
        SELECT id, title, created_at, updated_at, items
        FROM newsletter_drafts 
        ORDER BY updated_at DESC
      `);

      return {
        data: drafts.map(draft => ({
          id: draft.id,
          title: draft.title,
          created_at: draft.created_at,
          updated_at: draft.updated_at,
          items_count: JSON.parse(draft.items || '[]').length
        })),
        total: drafts.length
      };
    } catch (error: any) {
      return reply.code(500).type("application/problem+json").send({
        type: "about:blank",
        title: "Database Error",
        status: 500,
        detail: error.message,
        instance: request.url
      });
    }
  });

  // Get a specific newsletter draft
  app.get("/newsletter/drafts/:id", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      const draft = await db.get(`
        SELECT * FROM newsletter_drafts WHERE id = $1
      `, id);

      if (!draft) {
        return reply.code(404).type("application/problem+json").send({
          type: "about:blank",
          title: "Newsletter Draft Not Found",
          status: 404,
          detail: `Newsletter draft with ID ${id} not found`,
          instance: request.url
        });
      }

      return {
        ...draft,
        items: JSON.parse((draft as any).items)
      };
    } catch (error: any) {
      return reply.code(500).type("application/problem+json").send({
        type: "about:blank",
        title: "Database Error",
        status: 500,
        detail: error.message,
        instance: request.url
      });
    }
  });

  // Create a new newsletter draft
  app.post("/newsletter/drafts", async (request, reply) => {
    try {
      const input = NewsletterDraftSchema.parse(request.body);
      const id = uuidv4();
      const now = new Date().toISOString();

      await db.run(`
        INSERT INTO newsletter_drafts (id, title, items, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5)
      `, id, input.title, JSON.stringify(input.items), now, now);

      const draft = await db.get(`
        SELECT * FROM newsletter_drafts WHERE id = $1
      `, id);

      return reply.code(201).send({
        ...draft,
        items: JSON.parse((draft as any).items)
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.code(400).type("application/problem+json").send({
          type: "about:blank",
          title: "Validation Error",
          status: 400,
          detail: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
          instance: request.url
        });
      }

      return reply.code(500).type("application/problem+json").send({
        type: "about:blank",
        title: "Database Error",
        status: 500,
        detail: error.message,
        instance: request.url
      });
    }
  });

  // Update an existing newsletter draft
  app.put("/newsletter/drafts", async (request, reply) => {
    try {
      const input = UpdateNewsletterDraftSchema.parse(request.body);
      const now = new Date().toISOString();

      // Check if draft exists
      const existing = await db.get(`
        SELECT id FROM newsletter_drafts WHERE id = $1
      `, input.id);

      if (!existing) {
        return reply.code(404).type("application/problem+json").send({
          type: "about:blank",
          title: "Newsletter Draft Not Found",
          status: 404,
          detail: `Newsletter draft with ID ${input.id} not found`,
          instance: request.url
        });
      }

      // Update the draft
      await db.run(`
        UPDATE newsletter_drafts 
        SET title = $1, items = $2, updated_at = $3
        WHERE id = $4
      `, input.title, JSON.stringify(input.items), now, input.id);

      const updatedDraft = await db.get(`
        SELECT * FROM newsletter_drafts WHERE id = $1
      `, input.id);

      return {
        ...updatedDraft,
        items: JSON.parse((updatedDraft as any).items)
      };
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.code(400).type("application/problem+json").send({
          type: "about:blank",
          title: "Validation Error",
          status: 400,
          detail: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
          instance: request.url
        });
      }

      return reply.code(500).type("application/problem+json").send({
        type: "about:blank",
        title: "Database Error",
        status: 500,
        detail: error.message,
        instance: request.url
      });
    }
  });

  // Delete a newsletter draft
  app.delete("/newsletter/drafts/:id", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      // Check if draft exists
      const existing = await db.get(`
        SELECT id FROM newsletter_drafts WHERE id = $1
      `, id);

      if (!existing) {
        return reply.code(404).type("application/problem+json").send({
          type: "about:blank",
          title: "Newsletter Draft Not Found",
          status: 404,
          detail: `Newsletter draft with ID ${id} not found`,
          instance: request.url
        });
      }

      // Delete the draft
      await db.run(`
        DELETE FROM newsletter_drafts WHERE id = $1
      `, id);

      return reply.code(204).send();
    } catch (error: any) {
      return reply.code(500).type("application/problem+json").send({
        type: "about:blank",
        title: "Database Error",
        status: 500,
        detail: error.message,
        instance: request.url
      });
    }
  });

  // Duplicate a newsletter draft
  app.post("/newsletter/drafts/:id/duplicate", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      // Get the original draft
      const originalDraft = await db.get(`
        SELECT * FROM newsletter_drafts WHERE id = $1
      `, id);

      if (!originalDraft) {
        return reply.code(404).type("application/problem+json").send({
          type: "about:blank",
          title: "Newsletter Draft Not Found",
          status: 404,
          detail: `Newsletter draft with ID ${id} not found`,
          instance: request.url
        });
      }

      // Create a duplicate
      const newId = uuidv4();
      const now = new Date().toISOString();
      const newTitle = `${(originalDraft as any).title} (Copy)`;

      await db.run(`
        INSERT INTO newsletter_drafts (id, title, items, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5)
      `, newId, newTitle, (originalDraft as any).items, now, now);

      const newDraft = await db.get(`
        SELECT * FROM newsletter_drafts WHERE id = $1
      `, newId);

      return reply.code(201).send({
        ...newDraft,
        items: JSON.parse((newDraft as any).items)
      });
    } catch (error: any) {
      return reply.code(500).type("application/problem+json").send({
        type: "about:blank",
        title: "Database Error",
        status: 500,
        detail: error.message,
        instance: request.url
      });
    }
  });
}