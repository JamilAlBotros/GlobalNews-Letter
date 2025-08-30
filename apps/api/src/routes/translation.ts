import { FastifyInstance } from "fastify";
import { v4 as uuidv4 } from "uuid";
import { 
  TranslationJob, 
  CreateTranslationJobInput, 
  UpdateTranslationJobInput,
  TranslationJobType 
} from "../schemas/translation.js";
import { PaginationQuery } from "../schemas/common.js";
import { getDatabase } from "../database/connection.js";

interface TranslationJobRow {
  id: string;
  article_id: string;
  article_title: string;
  source_language: string;
  target_languages: string;
  status: string;
  priority: string;
  progress_percentage: number;
  assigned_worker: string | null;
  retry_count: number;
  max_retries: number;
  estimated_completion: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  error_message: string | null;
  word_count: number;
  cost_estimate: number | null;
}

function mapTranslationJobRow(row: TranslationJobRow): TranslationJobType {
  return {
    id: row.id,
    article_id: row.article_id,
    article_title: row.article_title,
    source_language: row.source_language as any,
    target_languages: row.target_languages,
    status: row.status as any,
    priority: row.priority as any,
    progress_percentage: row.progress_percentage,
    assigned_worker: row.assigned_worker,
    retry_count: row.retry_count,
    max_retries: row.max_retries,
    estimated_completion: row.estimated_completion,
    started_at: row.started_at,
    completed_at: row.completed_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    error_message: row.error_message,
    word_count: row.word_count,
    cost_estimate: row.cost_estimate
  };
}

export async function translationRoutes(app: FastifyInstance): Promise<void> {
  const db = getDatabase();

  // List translation jobs with pagination and filtering
  app.get("/translations/jobs", async (request, reply) => {
    const query = PaginationQuery.parse(request.query);
    const { status, priority, article_id } = request.query as any;
    
    const offset = (query.page - 1) * query.limit;
    
    let whereClause = "1 = 1";
    const params: any[] = [];
    
    if (status) {
      whereClause += " AND status = ?";
      params.push(status);
    }
    
    if (priority) {
      whereClause += " AND priority = ?";
      params.push(priority);
    }
    
    if (article_id) {
      whereClause += " AND article_id = ?";
      params.push(article_id);
    }
    
    const jobs = db.all<TranslationJobRow>(
      `SELECT * FROM translation_jobs WHERE ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      ...params,
      query.limit,
      offset
    );
    
    const totalResult = db.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM translation_jobs WHERE ${whereClause}`,
      ...params
    );

    const total = totalResult?.count || 0;
    const totalPages = Math.ceil(total / query.limit);

    return {
      data: jobs.map(mapTranslationJobRow),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        total_pages: totalPages
      }
    };
  });

  // Get single translation job
  app.get("/translations/jobs/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    
    const job = db.get<TranslationJobRow>("SELECT * FROM translation_jobs WHERE id = ?", id);
    if (!job) {
      return reply.code(404).type("application/problem+json").send({
        type: "about:blank",
        title: "Translation job not found",
        status: 404,
        instance: request.url
      });
    }

    return mapTranslationJobRow(job);
  });

  // Create translation job
  app.post("/translations/jobs", async (request, reply) => {
    const input = CreateTranslationJobInput.parse(request.body);
    
    // Check if article exists
    const article = db.get<{ id: string; title: string }>(
      "SELECT id, title FROM articles WHERE id = ?",
      input.article_id
    );

    if (!article) {
      return reply.code(404).type("application/problem+json").send({
        type: "about:blank",
        title: "Article not found",
        status: 404,
        instance: request.url
      });
    }

    const id = uuidv4();
    const now = new Date().toISOString();
    
    // Convert target languages array to comma-separated string
    const targetLanguagesStr = input.target_languages.join(',');
    
    // Estimate completion time (mock: 30 minutes from now)
    const estimatedCompletion = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    
    // Mock word count estimation based on title length
    const estimatedWordCount = Math.max(100, article.title.split(' ').length * 20);
    
    // Mock cost estimation ($0.05 per word)
    const costEstimate = estimatedWordCount * 0.05;

    db.run(`
      INSERT INTO translation_jobs (
        id, article_id, article_title, source_language, target_languages,
        status, priority, progress_percentage, assigned_worker, retry_count,
        max_retries, estimated_completion, started_at, completed_at,
        created_at, updated_at, error_message, word_count, cost_estimate
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, input.article_id, article.title, 'en', targetLanguagesStr,
      'queued', input.priority, 0, null, 0,
      3, estimatedCompletion, null, null,
      now, now, null, estimatedWordCount, costEstimate
    ]);

    const newJob = db.get<TranslationJobRow>("SELECT * FROM translation_jobs WHERE id = ?", id);
    if (!newJob) {
      throw new Error("Failed to create translation job");
    }

    reply.code(201);
    return mapTranslationJobRow(newJob);
  });

  // Update translation job
  app.put("/translations/jobs/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const input = UpdateTranslationJobInput.parse(request.body);

    const existingJob = db.get<TranslationJobRow>("SELECT * FROM translation_jobs WHERE id = ?", id);
    if (!existingJob) {
      return reply.code(404).type("application/problem+json").send({
        type: "about:blank",
        title: "Translation job not found",
        status: 404,
        instance: request.url
      });
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (input.status !== undefined) {
      updates.push("status = ?");
      values.push(input.status);
      
      // Update timestamps based on status
      if (input.status === 'processing' && !existingJob.started_at) {
        updates.push("started_at = ?");
        values.push(new Date().toISOString());
      } else if (input.status === 'completed' && !existingJob.completed_at) {
        updates.push("completed_at = ?", "progress_percentage = ?");
        values.push(new Date().toISOString(), 100);
      }
    }

    if (input.priority !== undefined) {
      updates.push("priority = ?");
      values.push(input.priority);
    }

    if (input.progress_percentage !== undefined) {
      updates.push("progress_percentage = ?");
      values.push(input.progress_percentage);
    }

    if (input.assigned_worker !== undefined) {
      updates.push("assigned_worker = ?");
      values.push(input.assigned_worker);
    }

    if (input.error_message !== undefined) {
      updates.push("error_message = ?");
      values.push(input.error_message);
    }

    if (updates.length === 0) {
      return mapTranslationJobRow(existingJob);
    }

    updates.push("updated_at = ?");
    values.push(new Date().toISOString());
    values.push(id);

    db.run(
      `UPDATE translation_jobs SET ${updates.join(", ")} WHERE id = ?`,
      ...values
    );

    const updatedJob = db.get<TranslationJobRow>("SELECT * FROM translation_jobs WHERE id = ?", id);
    if (!updatedJob) {
      throw new Error("Failed to update translation job");
    }

    return mapTranslationJobRow(updatedJob);
  });

  // Delete translation job
  app.delete("/translations/jobs/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    
    const existingJob = db.get<TranslationJobRow>("SELECT id FROM translation_jobs WHERE id = ?", id);
    if (!existingJob) {
      return reply.code(404).type("application/problem+json").send({
        type: "about:blank",
        title: "Translation job not found",
        status: 404,
        instance: request.url
      });
    }

    db.run("DELETE FROM translation_jobs WHERE id = ?", id);
    reply.code(204);
  });

  // Bulk status update for jobs
  app.patch("/translations/jobs/batch", async (request, reply) => {
    const { job_ids, status, assigned_worker } = request.body as any;
    
    if (!job_ids || !Array.isArray(job_ids) || job_ids.length === 0) {
      throw Object.assign(new Error("job_ids array is required"), {
        status: 400,
        detail: "Provide an array of job IDs to update"
      });
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (status) {
      updates.push("status = ?");
      values.push(status);
      
      if (status === 'processing') {
        updates.push("started_at = COALESCE(started_at, ?)");
        values.push(new Date().toISOString());
      } else if (status === 'completed') {
        updates.push("completed_at = COALESCE(completed_at, ?)", "progress_percentage = 100");
        values.push(new Date().toISOString());
      }
    }

    if (assigned_worker !== undefined) {
      updates.push("assigned_worker = ?");
      values.push(assigned_worker);
    }

    if (updates.length === 0) {
      throw Object.assign(new Error("No valid updates provided"), {
        status: 400,
        detail: "Provide status or assigned_worker to update"
      });
    }

    updates.push("updated_at = ?");
    values.push(new Date().toISOString());

    const placeholders = job_ids.map(() => '?').join(',');
    
    const result = db.run(
      `UPDATE translation_jobs SET ${updates.join(", ")} WHERE id IN (${placeholders})`,
      ...values,
      ...job_ids
    );

    return {
      success: true,
      updated_count: result.changes,
      message: `Updated ${result.changes} translation job(s)`
    };
  });
}