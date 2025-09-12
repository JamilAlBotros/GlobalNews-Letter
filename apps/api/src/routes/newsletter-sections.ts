import { FastifyInstance } from "fastify";
import { z } from "zod";
import { newsletterSectionRepository } from "../repositories/newsletter-section-repository.js";
import { newsletterTemplateService } from "../services/newsletter-template-service.js";
import { CreateNewsletterSectionInput } from "@mtrx/contracts/src/schemas/newsletter.js";

export async function newsletterSectionRoutes(app: FastifyInstance): Promise<void> {
  // List newsletter sections with filtering
  app.get("/newsletter-sections", async (request, reply) => {
    const query = z.object({
      page: z.coerce.number().min(1).default(1),
      limit: z.coerce.number().min(1).max(100).default(20),
      section_type: z.enum(['header', 'top_news', 'market_trends', 'footer', 'custom']).optional(),
      is_recurring: z.coerce.boolean().optional(),
      sort_by: z.enum(['display_order', 'name', 'created_at']).default('display_order'),
      sort_order: z.enum(['ASC', 'DESC']).default('ASC')
    }).parse(request.query);

    try {
      const offset = (query.page - 1) * query.limit;
      
      const [sections, total] = await Promise.all([
        newsletterSectionRepository.findMany({
          limit: query.limit,
          offset,
          section_type: query.section_type,
          is_recurring: query.is_recurring,
          sortBy: query.sort_by,
          sortOrder: query.sort_order
        }),
        newsletterSectionRepository.count({
          section_type: query.section_type,
          is_recurring: query.is_recurring
        })
      ]);

      const totalPages = Math.ceil(total / query.limit);

      return reply.send({
        data: sections,
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          total_pages: totalPages
        }
      });
    } catch (error) {
      throw Object.assign(new Error("Failed to fetch newsletter sections"), {
        status: 500,
        detail: (error as Error).message
      });
    }
  });

  // Get section by ID
  app.get("/newsletter-sections/:id", async (request, reply) => {
    const params = z.object({
      id: z.string().uuid()
    }).parse(request.params);

    try {
      const section = await newsletterSectionRepository.findById(params.id);

      if (!section) {
        throw Object.assign(new Error("Newsletter section not found"), {
          status: 404,
          detail: `Newsletter section with ID ${params.id} was not found`
        });
      }

      return reply.send(section);
    } catch (error) {
      if ((error as any).status) {
        throw error;
      }
      throw Object.assign(new Error("Failed to fetch newsletter section"), {
        status: 500,
        detail: (error as Error).message
      });
    }
  });

  // Create new section
  app.post("/newsletter-sections", async (request, reply) => {
    const body = CreateNewsletterSectionInput.parse(request.body);

    try {
      // Auto-assign display_order if not provided
      if (!body.display_order) {
        const maxOrder = await newsletterSectionRepository.getMaxDisplayOrder(body.section_type);
        body.display_order = maxOrder + 1;
      }

      const section = await newsletterSectionRepository.create(body);

      return reply.code(201).send(section);
    } catch (error) {
      throw Object.assign(new Error("Failed to create newsletter section"), {
        status: 500,
        detail: (error as Error).message
      });
    }
  });

  // Update section
  app.put("/newsletter-sections/:id", async (request, reply) => {
    const params = z.object({
      id: z.string().uuid()
    }).parse(request.params);

    const body = z.object({
      name: z.string().min(1).max(100).optional(),
      display_name: z.string().min(1).max(200).optional(),
      section_type: z.enum(['header', 'top_news', 'market_trends', 'footer', 'custom']).optional(),
      template_content: z.string().min(1).optional(),
      is_recurring: z.boolean().optional(),
      display_order: z.number().int().optional(),
      metadata: z.record(z.any()).optional()
    }).parse(request.body);

    try {
      const section = await newsletterSectionRepository.update(params.id, body);

      return reply.send(section);
    } catch (error) {
      if ((error as Error).message === 'Newsletter section not found') {
        throw Object.assign(new Error("Newsletter section not found"), {
          status: 404,
          detail: `Newsletter section with ID ${params.id} was not found`
        });
      }
      throw Object.assign(new Error("Failed to update newsletter section"), {
        status: 500,
        detail: (error as Error).message
      });
    }
  });

  // Delete section
  app.delete("/newsletter-sections/:id", async (request, reply) => {
    const params = z.object({
      id: z.string().uuid()
    }).parse(request.params);

    try {
      await newsletterSectionRepository.delete(params.id);

      return reply.code(204).send();
    } catch (error) {
      if ((error as Error).message === 'Newsletter section not found') {
        throw Object.assign(new Error("Newsletter section not found"), {
          status: 404,
          detail: `Newsletter section with ID ${params.id} was not found`
        });
      }
      throw Object.assign(new Error("Failed to delete newsletter section"), {
        status: 500,
        detail: (error as Error).message
      });
    }
  });

  // Get sections by type
  app.get("/newsletter-sections/by-type/:type", async (request, reply) => {
    const params = z.object({
      type: z.enum(['header', 'top_news', 'market_trends', 'footer', 'custom'])
    }).parse(request.params);

    try {
      const sections = await newsletterSectionRepository.findByType(params.type);

      return reply.send({
        data: sections
      });
    } catch (error) {
      throw Object.assign(new Error("Failed to fetch sections by type"), {
        status: 500,
        detail: (error as Error).message
      });
    }
  });

  // Get recurring sections (for templates)
  app.get("/newsletter-sections/recurring", async (request, reply) => {
    try {
      const sections = await newsletterSectionRepository.findRecurringSections();

      return reply.send({
        data: sections
      });
    } catch (error) {
      throw Object.assign(new Error("Failed to fetch recurring sections"), {
        status: 500,
        detail: (error as Error).message
      });
    }
  });

  // Reorder sections (drag-and-drop support)
  app.post("/newsletter-sections/reorder", async (request, reply) => {
    const body = z.object({
      section_updates: z.array(z.object({
        id: z.string().uuid(),
        display_order: z.number().int().min(0)
      })).min(1)
    }).parse(request.body);

    try {
      await newsletterSectionRepository.reorderSections(body.section_updates);

      return reply.send({
        message: 'Sections reordered successfully',
        updated_count: body.section_updates.length
      });
    } catch (error) {
      throw Object.assign(new Error("Failed to reorder sections"), {
        status: 500,
        detail: (error as Error).message
      });
    }
  });

  // Clone section (for template creation)
  app.post("/newsletter-sections/:id/clone", async (request, reply) => {
    const params = z.object({
      id: z.string().uuid()
    }).parse(request.params);

    const body = z.object({
      name: z.string().min(1).max(100).optional(),
      display_name: z.string().min(1).max(200).optional()
    }).parse(request.body);

    try {
      const originalSection = await newsletterSectionRepository.findById(params.id);
      
      if (!originalSection) {
        throw Object.assign(new Error("Newsletter section not found"), {
          status: 404,
          detail: `Newsletter section with ID ${params.id} was not found`
        });
      }

      const maxOrder = await newsletterSectionRepository.getMaxDisplayOrder(originalSection.section_type);

      const cloneData = {
        name: body.name || `${originalSection.name} (Copy)`,
        display_name: body.display_name || `${originalSection.display_name} (Copy)`,
        section_type: originalSection.section_type,
        template_content: originalSection.template_content,
        is_recurring: false, // Clones are not recurring by default
        display_order: maxOrder + 1,
        metadata: originalSection.metadata
      };

      const clonedSection = await newsletterSectionRepository.create(cloneData);

      return reply.code(201).send(clonedSection);
    } catch (error) {
      if ((error as any).status) {
        throw error;
      }
      throw Object.assign(new Error("Failed to clone newsletter section"), {
        status: 500,
        detail: (error as Error).message
      });
    }
  });

  // Get template library (categorized sections for drag-and-drop)
  app.get("/newsletter-sections/template-library", async (request, reply) => {
    try {
      const library = await newsletterTemplateService.getSectionTemplateLibrary();

      return reply.send(library);
    } catch (error) {
      throw Object.assign(new Error("Failed to fetch template library"), {
        status: 500,
        detail: (error as Error).message
      });
    }
  });

  // Create custom section via template service
  app.post("/newsletter-sections/custom", async (request, reply) => {
    const body = z.object({
      name: z.string().min(1).max(100),
      display_name: z.string().min(1).max(200),
      template_content: z.string().min(1),
      section_type: z.enum(['header', 'top_news', 'market_trends', 'footer', 'custom']).default('custom'),
      metadata: z.record(z.any()).optional()
    }).parse(request.body);

    try {
      const section = await newsletterTemplateService.createCustomSection(
        body.name,
        body.display_name,
        body.template_content,
        body.section_type,
        body.metadata
      );

      return reply.code(201).send(section);
    } catch (error) {
      throw Object.assign(new Error("Failed to create custom section"), {
        status: 500,
        detail: (error as Error).message
      });
    }
  });
}