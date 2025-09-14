import { FastifyInstance } from "fastify";
import { z } from "zod";
import { newsletterRepository } from "../repositories/newsletter-repository.js";
import { CreateNewsletterInput, UpdateNewsletterInput } from "@mtrx/contracts";

export async function newsletterRoutes(app: FastifyInstance): Promise<void> {
  // List newsletters with pagination
  app.get("/newsletters", async (request, reply) => {
    const query = z.object({
      page: z.coerce.number().min(1).default(1),
      limit: z.coerce.number().min(1).max(100).default(20),
      status: z.enum(['draft', 'published', 'archived']).optional(),
      language: z.string().optional(),
      sort_by: z.enum(['issue_number', 'publish_date', 'created_at']).default('issue_number'),
      sort_order: z.enum(['ASC', 'DESC']).default('DESC')
    }).parse(request.query);

    try {
      const offset = (query.page - 1) * query.limit;
      
      const [newsletters, total] = await Promise.all([
        newsletterRepository.findMany({
          limit: query.limit,
          offset,
          status: query.status,
          language: query.language,
          sortBy: query.sort_by,
          sortOrder: query.sort_order
        }),
        newsletterRepository.count({
          status: query.status,
          language: query.language
        })
      ]);

      const totalPages = Math.ceil(total / query.limit);

      return reply.send({
        data: newsletters,
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          total_pages: totalPages
        }
      });
    } catch (error) {
      throw Object.assign(new Error("Failed to fetch newsletters"), {
        status: 500,
        detail: (error as Error).message
      });
    }
  });

  // Get newsletter by ID
  app.get("/newsletters/:id", async (request, reply) => {
    const params = z.object({
      id: z.string().uuid()
    }).parse(request.params);

    try {
      const newsletter = await newsletterRepository.findById(params.id);

      if (!newsletter) {
        throw Object.assign(new Error("Newsletter not found"), {
          status: 404,
          detail: `Newsletter with ID ${params.id} was not found`
        });
      }

      return reply.send(newsletter);
    } catch (error) {
      if ((error as any).status) {
        throw error;
      }
      throw Object.assign(new Error("Failed to fetch newsletter"), {
        status: 500,
        detail: (error as Error).message
      });
    }
  });

  // Create new newsletter
  app.post("/newsletters", async (request, reply) => {
    const body = CreateNewsletterInput.parse(request.body);

    try {
      const newsletter = await newsletterRepository.create(body);

      return reply.code(201).send(newsletter);
    } catch (error) {
      throw Object.assign(new Error("Failed to create newsletter"), {
        status: 500,
        detail: (error as Error).message
      });
    }
  });

  // Update newsletter
  app.put("/newsletters/:id", async (request, reply) => {
    const params = z.object({
      id: z.string().uuid()
    }).parse(request.params);

    const body = UpdateNewsletterInput.parse(request.body);

    try {
      const newsletter = await newsletterRepository.update(params.id, body);

      return reply.send(newsletter);
    } catch (error) {
      if ((error as Error).message === 'Newsletter not found') {
        throw Object.assign(new Error("Newsletter not found"), {
          status: 404,
          detail: `Newsletter with ID ${params.id} was not found`
        });
      }
      throw Object.assign(new Error("Failed to update newsletter"), {
        status: 500,
        detail: (error as Error).message
      });
    }
  });

  // Delete newsletter
  app.delete("/newsletters/:id", async (request, reply) => {
    const params = z.object({
      id: z.string().uuid()
    }).parse(request.params);

    try {
      await newsletterRepository.delete(params.id);

      return reply.code(204).send();
    } catch (error) {
      if ((error as Error).message === 'Newsletter not found') {
        throw Object.assign(new Error("Newsletter not found"), {
          status: 404,
          detail: `Newsletter with ID ${params.id} was not found`
        });
      }
      throw Object.assign(new Error("Failed to delete newsletter"), {
        status: 500,
        detail: (error as Error).message
      });
    }
  });

  // Publish newsletter (status change helper)
  app.post("/newsletters/:id/publish", async (request, reply) => {
    const params = z.object({
      id: z.string().uuid()
    }).parse(request.params);

    try {
      const newsletter = await newsletterRepository.update(params.id, { status: 'published' });

      return reply.send(newsletter);
    } catch (error) {
      if ((error as Error).message === 'Newsletter not found') {
        throw Object.assign(new Error("Newsletter not found"), {
          status: 404,
          detail: `Newsletter with ID ${params.id} was not found`
        });
      }
      throw Object.assign(new Error("Failed to publish newsletter"), {
        status: 500,
        detail: (error as Error).message
      });
    }
  });

  // Get next issue number
  app.get("/newsletters/meta/next-issue-number", async (request, reply) => {
    try {
      const nextIssueNumber = await newsletterRepository.getNextIssueNumber();

      return reply.send({
        next_issue_number: nextIssueNumber
      });
    } catch (error) {
      throw Object.assign(new Error("Failed to get next issue number"), {
        status: 500,
        detail: (error as Error).message
      });
    }
  });
}