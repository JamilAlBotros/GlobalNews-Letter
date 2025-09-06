import { FastifyInstance } from "fastify";
import { z } from "zod";
import { newsletterTranslationJobRepository, CreateNewsletterTranslationJobInput } from "../repositories/newsletter-translation-job.js";

const CreateTranslationJobSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  source_language: z.string().default('en'),
  target_languages: z.array(z.enum(['es', 'en', 'ar', 'fr'])).min(1),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  original_articles: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    url: z.string()
  }))
});

const UpdateTranslationJobSchema = z.object({
  status: z.enum(['pending', 'processing', 'completed', 'failed', 'cancelled']).optional(),
  progress: z.number().min(0).max(100).optional(),
  assigned_worker: z.string().optional(),
  translated_content: z.record(z.string()).optional(),
  error_message: z.string().optional(),
  estimated_completion: z.string().optional()
});

const PaginationSchema = z.object({
  page: z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('20'),
  status: z.enum(['pending', 'processing', 'completed', 'failed', 'cancelled']).optional()
});

export async function newsletterTranslationJobRoutes(app: FastifyInstance): Promise<void> {
  
  // Get all translation jobs with pagination and filtering
  app.get("/newsletter-translation-jobs", async (request, reply) => {
    try {
      const query = PaginationSchema.parse(request.query);
      const offset = (query.page - 1) * query.limit;
      
      let jobs;
      if (query.status) {
        jobs = await newsletterTranslationJobRepository.findByStatus(query.status, query.limit);
      } else {
        jobs = await newsletterTranslationJobRepository.findAll(query.limit, offset);
      }
      
      const stats = await newsletterTranslationJobRepository.getStats();
      
      return {
        data: jobs,
        pagination: {
          page: query.page,
          limit: query.limit,
          total: stats.total
        },
        stats
      };
    } catch (error: any) {
      return reply.code(500).send({
        error: "Failed to fetch translation jobs",
        detail: error.message
      });
    }
  });

  // Get translation job by ID
  app.get("/newsletter-translation-jobs/:id", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const job = await newsletterTranslationJobRepository.findById(id);
      
      if (!job) {
        return reply.code(404).send({
          error: "Translation job not found"
        });
      }
      
      return job;
    } catch (error: any) {
      return reply.code(500).send({
        error: "Failed to fetch translation job",
        detail: error.message
      });
    }
  });

  // Create new translation job
  app.post("/newsletter-translation-jobs", async (request, reply) => {
    try {
      const input = CreateTranslationJobSchema.parse(request.body);
      
      const jobId = await newsletterTranslationJobRepository.create(input);
      const job = await newsletterTranslationJobRepository.findById(jobId);
      
      return reply.code(201).send(job);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return reply.code(400).send({
          error: "Invalid input",
          details: error.errors
        });
      }
      
      return reply.code(500).send({
        error: "Failed to create translation job",
        detail: error.message
      });
    }
  });

  // Update translation job
  app.put("/newsletter-translation-jobs/:id", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const input = UpdateTranslationJobSchema.parse(request.body);
      
      const updated = await newsletterTranslationJobRepository.update(id, input);
      
      if (!updated) {
        return reply.code(404).send({
          error: "Translation job not found"
        });
      }
      
      const job = await newsletterTranslationJobRepository.findById(id);
      return job;
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return reply.code(400).send({
          error: "Invalid input",
          details: error.errors
        });
      }
      
      return reply.code(500).send({
        error: "Failed to update translation job",
        detail: error.message
      });
    }
  });

  // Cancel translation job
  app.post("/newsletter-translation-jobs/:id/cancel", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      
      const job = await newsletterTranslationJobRepository.findById(id);
      if (!job) {
        return reply.code(404).send({
          error: "Translation job not found"
        });
      }
      
      if (job.status === 'completed') {
        return reply.code(400).send({
          error: "Cannot cancel completed job"
        });
      }
      
      await newsletterTranslationJobRepository.update(id, { status: 'cancelled' });
      const updatedJob = await newsletterTranslationJobRepository.findById(id);
      
      return updatedJob;
    } catch (error: any) {
      return reply.code(500).send({
        error: "Failed to cancel translation job",
        detail: error.message
      });
    }
  });

  // Retry failed translation job
  app.post("/newsletter-translation-jobs/:id/retry", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      
      const job = await newsletterTranslationJobRepository.findById(id);
      if (!job) {
        return reply.code(404).send({
          error: "Translation job not found"
        });
      }
      
      if (job.status !== 'failed') {
        return reply.code(400).send({
          error: "Can only retry failed jobs"
        });
      }
      
      if (job.retry_count >= job.max_retries) {
        return reply.code(400).send({
          error: "Maximum retry attempts reached"
        });
      }
      
      await newsletterTranslationJobRepository.incrementRetry(id);
      await newsletterTranslationJobRepository.update(id, { 
        status: 'pending',
        error_message: undefined,
        assigned_worker: undefined
      });
      
      const updatedJob = await newsletterTranslationJobRepository.findById(id);
      return updatedJob;
    } catch (error: any) {
      return reply.code(500).send({
        error: "Failed to retry translation job",
        detail: error.message
      });
    }
  });

  // Delete translation job
  app.delete("/newsletter-translation-jobs/:id", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      
      const deleted = await newsletterTranslationJobRepository.delete(id);
      if (!deleted) {
        return reply.code(404).send({
          error: "Translation job not found"
        });
      }
      
      return reply.code(204).send();
    } catch (error: any) {
      return reply.code(500).send({
        error: "Failed to delete translation job",
        detail: error.message
      });
    }
  });

  // Get translation job stats
  app.get("/newsletter-translation-jobs/stats", async (request, reply) => {
    try {
      const stats = await newsletterTranslationJobRepository.getStats();
      return stats;
    } catch (error: any) {
      return reply.code(500).send({
        error: "Failed to fetch translation stats",
        detail: error.message
      });
    }
  });

  // Process next pending job (for worker integration)
  app.post("/newsletter-translation-jobs/process-next", async (request, reply) => {
    try {
      const { worker_id } = request.body as { worker_id?: string };
      
      const pendingJobs = await newsletterTranslationJobRepository.findPendingJobs(1);
      
      if (pendingJobs.length === 0) {
        return reply.code(404).send({
          error: "No pending jobs available"
        });
      }
      
      const job = pendingJobs[0];
      
      // Mark as processing
      await newsletterTranslationJobRepository.update(job.id, {
        status: 'processing',
        assigned_worker: worker_id || 'local-llm',
        progress: 0
      });
      
      const updatedJob = await newsletterTranslationJobRepository.findById(job.id);
      return updatedJob;
    } catch (error: any) {
      return reply.code(500).send({
        error: "Failed to process next job",
        detail: error.message
      });
    }
  });
}