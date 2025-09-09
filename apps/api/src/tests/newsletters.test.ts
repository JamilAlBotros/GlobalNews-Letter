import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { newsletterRepository } from '../repositories/newsletter-repository.js';
import { initializeDatabase } from '../database/init.js';
import { getDatabase } from '../database/connection.js';
import type { CreateNewsletterInputType, UpdateNewsletterInputType } from '@mtrx/contracts/src/schemas/newsletter.js';

describe('Newsletter Repository', () => {
  beforeEach(async () => {
    await initializeDatabase();
    // Clean up newsletters table
    const db = getDatabase();
    db.prepare('DELETE FROM newsletters').run();
  });

  afterEach(() => {
    // Clean up newsletters table
    const db = getDatabase();
    db.prepare('DELETE FROM newsletters').run();
  });

  describe('create', () => {
    it('should create a newsletter with auto-generated issue number', async () => {
      const input: CreateNewsletterInputType = {
        title: 'Weekly Tech News',
        subtitle: 'Latest technology updates',
        publish_date: '2024-01-15T09:00:00Z',
        language: 'en',
        content_metadata: { theme: 'tech' }
      };

      const newsletter = await newsletterRepository.create(input);

      expect(newsletter).toMatchObject({
        id: expect.any(String),
        issue_number: 1,
        title: 'Weekly Tech News',
        subtitle: 'Latest technology updates',
        publish_date: '2024-01-15T09:00:00Z',
        status: 'draft',
        language: 'en',
        content_metadata: { theme: 'tech' },
        created_at: expect.any(String),
        updated_at: expect.any(String),
        published_at: undefined
      });
    });

    it('should auto-increment issue numbers', async () => {
      const input: CreateNewsletterInputType = {
        title: 'First Newsletter',
        publish_date: '2024-01-15T09:00:00Z'
      };

      const first = await newsletterRepository.create(input);
      const second = await newsletterRepository.create({
        ...input,
        title: 'Second Newsletter'
      });

      expect(first.issue_number).toBe(1);
      expect(second.issue_number).toBe(2);
    });

    it('should handle optional fields', async () => {
      const input: CreateNewsletterInputType = {
        title: 'Simple Newsletter',
        publish_date: '2024-01-15T09:00:00Z'
      };

      const newsletter = await newsletterRepository.create(input);

      expect(newsletter.subtitle).toBeUndefined();
      expect(newsletter.content_metadata).toBeUndefined();
      expect(newsletter.language).toBe('en');
    });
  });

  describe('findById', () => {
    it('should find newsletter by ID', async () => {
      const input: CreateNewsletterInputType = {
        title: 'Test Newsletter',
        publish_date: '2024-01-15T09:00:00Z'
      };

      const created = await newsletterRepository.create(input);
      const found = await newsletterRepository.findById(created.id);

      expect(found).toEqual(created);
    });

    it('should return null for non-existent ID', async () => {
      const found = await newsletterRepository.findById('00000000-0000-0000-0000-000000000000');
      expect(found).toBeNull();
    });
  });

  describe('findByIssueNumber', () => {
    it('should find newsletter by issue number', async () => {
      const input: CreateNewsletterInputType = {
        title: 'Issue #1',
        publish_date: '2024-01-15T09:00:00Z'
      };

      const created = await newsletterRepository.create(input);
      const found = await newsletterRepository.findByIssueNumber(1);

      expect(found).toEqual(created);
    });

    it('should return null for non-existent issue number', async () => {
      const found = await newsletterRepository.findByIssueNumber(999);
      expect(found).toBeNull();
    });
  });

  describe('findMany', () => {
    it('should return empty array when no newsletters exist', async () => {
      const newsletters = await newsletterRepository.findMany();
      expect(newsletters).toEqual([]);
    });

    it('should return newsletters with default sorting (issue_number DESC)', async () => {
      await newsletterRepository.create({
        title: 'First',
        publish_date: '2024-01-15T09:00:00Z'
      });
      await newsletterRepository.create({
        title: 'Second',
        publish_date: '2024-01-16T09:00:00Z'
      });

      const newsletters = await newsletterRepository.findMany();

      expect(newsletters).toHaveLength(2);
      expect(newsletters[0].title).toBe('Second');
      expect(newsletters[1].title).toBe('First');
    });

    it('should filter by status', async () => {
      const draft = await newsletterRepository.create({
        title: 'Draft Newsletter',
        publish_date: '2024-01-15T09:00:00Z'
      });
      
      await newsletterRepository.update(draft.id, { status: 'published' });
      
      await newsletterRepository.create({
        title: 'Another Draft',
        publish_date: '2024-01-16T09:00:00Z'
      });

      const draftNewsletters = await newsletterRepository.findMany({ status: 'draft' });
      const publishedNewsletters = await newsletterRepository.findMany({ status: 'published' });

      expect(draftNewsletters).toHaveLength(1);
      expect(draftNewsletters[0].title).toBe('Another Draft');
      expect(publishedNewsletters).toHaveLength(1);
      expect(publishedNewsletters[0].title).toBe('Draft Newsletter');
    });

    it('should apply limit and offset', async () => {
      // Create 5 newsletters
      for (let i = 1; i <= 5; i++) {
        await newsletterRepository.create({
          title: `Newsletter ${i}`,
          publish_date: `2024-01-${10 + i}T09:00:00Z`
        });
      }

      const page1 = await newsletterRepository.findMany({ limit: 2, offset: 0 });
      const page2 = await newsletterRepository.findMany({ limit: 2, offset: 2 });

      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(2);
      expect(page1[0].title).toBe('Newsletter 5');
      expect(page2[0].title).toBe('Newsletter 3');
    });
  });

  describe('count', () => {
    it('should return 0 when no newsletters exist', async () => {
      const count = await newsletterRepository.count();
      expect(count).toBe(0);
    });

    it('should count all newsletters', async () => {
      await newsletterRepository.create({
        title: 'Newsletter 1',
        publish_date: '2024-01-15T09:00:00Z'
      });
      await newsletterRepository.create({
        title: 'Newsletter 2',
        publish_date: '2024-01-16T09:00:00Z'
      });

      const count = await newsletterRepository.count();
      expect(count).toBe(2);
    });

    it('should count with filters', async () => {
      const draft = await newsletterRepository.create({
        title: 'Draft',
        publish_date: '2024-01-15T09:00:00Z'
      });
      
      await newsletterRepository.update(draft.id, { status: 'published' });
      
      await newsletterRepository.create({
        title: 'Another Draft',
        publish_date: '2024-01-16T09:00:00Z'
      });

      const draftCount = await newsletterRepository.count({ status: 'draft' });
      const publishedCount = await newsletterRepository.count({ status: 'published' });

      expect(draftCount).toBe(1);
      expect(publishedCount).toBe(1);
    });
  });

  describe('update', () => {
    it('should update newsletter fields', async () => {
      const newsletter = await newsletterRepository.create({
        title: 'Original Title',
        publish_date: '2024-01-15T09:00:00Z'
      });

      const updateData: UpdateNewsletterInputType = {
        title: 'Updated Title',
        subtitle: 'New subtitle',
        status: 'published'
      };

      const updated = await newsletterRepository.update(newsletter.id, updateData);

      expect(updated.title).toBe('Updated Title');
      expect(updated.subtitle).toBe('New subtitle');
      expect(updated.status).toBe('published');
      expect(updated.published_at).toBeDefined();
      expect(updated.updated_at).not.toBe(newsletter.updated_at);
    });

    it('should throw error for non-existent newsletter', async () => {
      await expect(
        newsletterRepository.update('00000000-0000-0000-0000-000000000000', { title: 'Test' })
      ).rejects.toThrow('Newsletter not found');
    });

    it('should set published_at when status changes to published', async () => {
      const newsletter = await newsletterRepository.create({
        title: 'Test Newsletter',
        publish_date: '2024-01-15T09:00:00Z'
      });

      const updated = await newsletterRepository.update(newsletter.id, { status: 'published' });

      expect(updated.status).toBe('published');
      expect(updated.published_at).toBeDefined();
    });

    it('should not update published_at if already published', async () => {
      const newsletter = await newsletterRepository.create({
        title: 'Test Newsletter',
        publish_date: '2024-01-15T09:00:00Z'
      });

      const firstUpdate = await newsletterRepository.update(newsletter.id, { status: 'published' });
      const secondUpdate = await newsletterRepository.update(firstUpdate.id, { title: 'Updated Title' });

      expect(secondUpdate.published_at).toBe(firstUpdate.published_at);
    });
  });

  describe('delete', () => {
    it('should delete newsletter', async () => {
      const newsletter = await newsletterRepository.create({
        title: 'To Delete',
        publish_date: '2024-01-15T09:00:00Z'
      });

      await newsletterRepository.delete(newsletter.id);

      const found = await newsletterRepository.findById(newsletter.id);
      expect(found).toBeNull();
    });

    it('should throw error for non-existent newsletter', async () => {
      await expect(
        newsletterRepository.delete('00000000-0000-0000-0000-000000000000')
      ).rejects.toThrow('Newsletter not found');
    });
  });

  describe('getNextIssueNumber', () => {
    it('should return 1 for first newsletter', async () => {
      const nextIssue = await newsletterRepository.getNextIssueNumber();
      expect(nextIssue).toBe(1);
    });

    it('should return incremented number', async () => {
      await newsletterRepository.create({
        title: 'Newsletter 1',
        publish_date: '2024-01-15T09:00:00Z'
      });
      await newsletterRepository.create({
        title: 'Newsletter 2',
        publish_date: '2024-01-16T09:00:00Z'
      });

      const nextIssue = await newsletterRepository.getNextIssueNumber();
      expect(nextIssue).toBe(3);
    });
  });
});