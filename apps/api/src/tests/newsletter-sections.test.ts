import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { newsletterSectionRepository } from '../repositories/newsletter-section-repository.js';
import { newsletterTemplateService } from '../services/newsletter-template-service.js';
import { getDatabase, closeDatabase } from '../database/connection.js';
import { initializeDatabase } from '../database/init.js';

describe('Newsletter Section Repository', () => {
  beforeEach(async () => {
    await initializeDatabase();
  });

  afterEach(async () => {
    const db = getDatabase();
    await db.exec('DELETE FROM newsletter_sections');
  });

  describe('create', () => {
    it('should create a new newsletter section', async () => {
      const sectionData = {
        name: 'test_header',
        display_name: 'Test Header',
        section_type: 'header' as const,
        template_content: '<h1>{{title}}</h1>',
        is_recurring: true,
        display_order: 1,
        metadata: { description: 'Test header section' }
      };

      const section = await newsletterSectionRepository.create(sectionData);

      expect(section.id).toBeDefined();
      expect(section.name).toBe('test_header');
      expect(section.display_name).toBe('Test Header');
      expect(section.section_type).toBe('header');
      expect(section.is_recurring).toBe(true);
      expect(section.display_order).toBe(1);
    });

    it('should handle JSON serialization of metadata', async () => {
      const metadata = { 
        variables: ['title', 'subtitle'],
        description: 'Test metadata'
      };

      const sectionData = {
        name: 'test_section',
        display_name: 'Test Section',
        section_type: 'custom' as const,
        template_content: '<div>{{content}}</div>',
        is_recurring: false,
        display_order: 1,
        metadata
      };

      const section = await newsletterSectionRepository.create(sectionData);

      expect(section.metadata).toEqual(metadata);
    });
  });

  describe('findMany', () => {
    beforeEach(async () => {
      // Create test data
      await newsletterSectionRepository.create({
        name: 'header_1',
        display_name: 'Header 1',
        section_type: 'header',
        template_content: '<h1>Header</h1>',
        is_recurring: true,
        display_order: 1,
        metadata: {}
      });

      await newsletterSectionRepository.create({
        name: 'news_1',
        display_name: 'News 1',
        section_type: 'top_news',
        template_content: '<div>News</div>',
        is_recurring: true,
        display_order: 2,
        metadata: {}
      });

      await newsletterSectionRepository.create({
        name: 'custom_1',
        display_name: 'Custom 1',
        section_type: 'custom',
        template_content: '<div>Custom</div>',
        is_recurring: false,
        display_order: 3,
        metadata: {}
      });
    });

    it('should find all sections without filters', async () => {
      const sections = await newsletterSectionRepository.findMany({});

      expect(sections).toHaveLength(3);
    });

    it('should filter by section type', async () => {
      const sections = await newsletterSectionRepository.findMany({
        section_type: 'header'
      });

      expect(sections).toHaveLength(1);
      expect(sections[0].section_type).toBe('header');
    });

    it('should filter by is_recurring', async () => {
      const sections = await newsletterSectionRepository.findMany({
        is_recurring: true
      });

      expect(sections).toHaveLength(2);
      sections.forEach(section => {
        expect(section.is_recurring).toBe(true);
      });
    });

    it('should sort by display_order ascending', async () => {
      const sections = await newsletterSectionRepository.findMany({
        sortBy: 'display_order',
        sortOrder: 'ASC'
      });

      expect(sections[0].display_order).toBeLessThan(sections[1].display_order);
      expect(sections[1].display_order).toBeLessThan(sections[2].display_order);
    });

    it('should apply limit and offset', async () => {
      const sections = await newsletterSectionRepository.findMany({
        limit: 2,
        offset: 1
      });

      expect(sections).toHaveLength(2);
    });
  });

  describe('findById', () => {
    it('should find section by ID', async () => {
      const created = await newsletterSectionRepository.create({
        name: 'test_section',
        display_name: 'Test Section',
        section_type: 'custom',
        template_content: '<div>Test</div>',
        is_recurring: false,
        display_order: 1,
        metadata: {}
      });

      const found = await newsletterSectionRepository.findById(created.id);

      expect(found).toBeDefined();
      expect(found!.id).toBe(created.id);
      expect(found!.name).toBe('test_section');
    });

    it('should return null for non-existent ID', async () => {
      const found = await newsletterSectionRepository.findById('non-existent-id');

      expect(found).toBeNull();
    });
  });

  describe('update', () => {
    it('should update section fields', async () => {
      const created = await newsletterSectionRepository.create({
        name: 'original_name',
        display_name: 'Original Display Name',
        section_type: 'custom',
        template_content: '<div>Original</div>',
        is_recurring: false,
        display_order: 1,
        metadata: {}
      });

      const updated = await newsletterSectionRepository.update(created.id, {
        display_name: 'Updated Display Name',
        template_content: '<div>Updated</div>',
        is_recurring: true
      });

      expect(updated.display_name).toBe('Updated Display Name');
      expect(updated.template_content).toBe('<div>Updated</div>');
      expect(updated.is_recurring).toBe(true);
      expect(updated.name).toBe('original_name'); // Should not change
    });

    it('should throw error for non-existent section', async () => {
      await expect(
        newsletterSectionRepository.update('non-existent-id', { display_name: 'Test' })
      ).rejects.toThrow('Newsletter section not found');
    });
  });

  describe('delete', () => {
    it('should delete existing section', async () => {
      const created = await newsletterSectionRepository.create({
        name: 'to_delete',
        display_name: 'To Delete',
        section_type: 'custom',
        template_content: '<div>Delete me</div>',
        is_recurring: false,
        display_order: 1,
        metadata: {}
      });

      await newsletterSectionRepository.delete(created.id);

      const found = await newsletterSectionRepository.findById(created.id);
      expect(found).toBeNull();
    });

    it('should throw error for non-existent section', async () => {
      await expect(
        newsletterSectionRepository.delete('non-existent-id')
      ).rejects.toThrow('Newsletter section not found');
    });
  });

  describe('findByType', () => {
    beforeEach(async () => {
      await newsletterSectionRepository.create({
        name: 'header_1',
        display_name: 'Header 1',
        section_type: 'header',
        template_content: '<h1>Header 1</h1>',
        is_recurring: true,
        display_order: 1,
        metadata: {}
      });

      await newsletterSectionRepository.create({
        name: 'header_2',
        display_name: 'Header 2',
        section_type: 'header',
        template_content: '<h1>Header 2</h1>',
        is_recurring: true,
        display_order: 2,
        metadata: {}
      });

      await newsletterSectionRepository.create({
        name: 'news_1',
        display_name: 'News 1',
        section_type: 'top_news',
        template_content: '<div>News</div>',
        is_recurring: true,
        display_order: 1,
        metadata: {}
      });
    });

    it('should find sections by type', async () => {
      const headers = await newsletterSectionRepository.findByType('header');
      const news = await newsletterSectionRepository.findByType('top_news');

      expect(headers).toHaveLength(2);
      expect(news).toHaveLength(1);
      
      headers.forEach(section => {
        expect(section.section_type).toBe('header');
      });
      
      expect(news[0].section_type).toBe('top_news');
    });
  });

  describe('reorderSections', () => {
    let section1: any, section2: any, section3: any;

    beforeEach(async () => {
      section1 = await newsletterSectionRepository.create({
        name: 'section_1',
        display_name: 'Section 1',
        section_type: 'custom',
        template_content: '<div>1</div>',
        is_recurring: false,
        display_order: 1,
        metadata: {}
      });

      section2 = await newsletterSectionRepository.create({
        name: 'section_2',
        display_name: 'Section 2',
        section_type: 'custom',
        template_content: '<div>2</div>',
        is_recurring: false,
        display_order: 2,
        metadata: {}
      });

      section3 = await newsletterSectionRepository.create({
        name: 'section_3',
        display_name: 'Section 3',
        section_type: 'custom',
        template_content: '<div>3</div>',
        is_recurring: false,
        display_order: 3,
        metadata: {}
      });
    });

    it('should reorder sections correctly', async () => {
      const updates = [
        { id: section1.id, display_order: 3 },
        { id: section2.id, display_order: 1 },
        { id: section3.id, display_order: 2 }
      ];

      await newsletterSectionRepository.reorderSections(updates);

      const reordered1 = await newsletterSectionRepository.findById(section1.id);
      const reordered2 = await newsletterSectionRepository.findById(section2.id);
      const reordered3 = await newsletterSectionRepository.findById(section3.id);

      expect(reordered1!.display_order).toBe(3);
      expect(reordered2!.display_order).toBe(1);
      expect(reordered3!.display_order).toBe(2);
    });
  });

  describe('getMaxDisplayOrder', () => {
    beforeEach(async () => {
      await newsletterSectionRepository.create({
        name: 'header_1',
        display_name: 'Header 1',
        section_type: 'header',
        template_content: '<h1>Header</h1>',
        is_recurring: true,
        display_order: 5,
        metadata: {}
      });

      await newsletterSectionRepository.create({
        name: 'header_2',
        display_name: 'Header 2',
        section_type: 'header',
        template_content: '<h1>Header 2</h1>',
        is_recurring: true,
        display_order: 3,
        metadata: {}
      });

      await newsletterSectionRepository.create({
        name: 'news_1',
        display_name: 'News 1',
        section_type: 'top_news',
        template_content: '<div>News</div>',
        is_recurring: true,
        display_order: 2,
        metadata: {}
      });
    });

    it('should return max display_order for given type', async () => {
      const maxHeader = await newsletterSectionRepository.getMaxDisplayOrder('header');
      const maxNews = await newsletterSectionRepository.getMaxDisplayOrder('top_news');

      expect(maxHeader).toBe(5);
      expect(maxNews).toBe(2);
    });

    it('should return 0 for type with no sections', async () => {
      const maxCustom = await newsletterSectionRepository.getMaxDisplayOrder('custom');

      expect(maxCustom).toBe(0);
    });
  });
});

describe('Newsletter Template Service', () => {
  beforeEach(async () => {
    await initializeDatabase();
  });

  afterEach(async () => {
    const db = getDatabase();
    await db.exec('DELETE FROM newsletter_sections');
  });

  describe('seedDefaultSections', () => {
    it('should seed default sections', async () => {
      await newsletterTemplateService.seedDefaultSections();

      const sections = await newsletterSectionRepository.findMany({});
      expect(sections.length).toBeGreaterThan(0);

      // Check that we have sections of each type
      const headerSections = sections.filter(s => s.section_type === 'header');
      const newsSections = sections.filter(s => s.section_type === 'top_news');
      const marketSections = sections.filter(s => s.section_type === 'market_trends');
      const customSections = sections.filter(s => s.section_type === 'custom');
      const footerSections = sections.filter(s => s.section_type === 'footer');

      expect(headerSections.length).toBeGreaterThan(0);
      expect(newsSections.length).toBeGreaterThan(0);
      expect(marketSections.length).toBeGreaterThan(0);
      expect(customSections.length).toBeGreaterThan(0);
      expect(footerSections.length).toBeGreaterThan(0);
    });

    it('should not duplicate sections on multiple calls', async () => {
      await newsletterTemplateService.seedDefaultSections();
      const firstCount = (await newsletterSectionRepository.findMany({})).length;

      await newsletterTemplateService.seedDefaultSections();
      const secondCount = (await newsletterSectionRepository.findMany({})).length;

      expect(firstCount).toBe(secondCount);
    });
  });

  describe('getSectionTemplateLibrary', () => {
    beforeEach(async () => {
      await newsletterTemplateService.seedDefaultSections();
    });

    it('should return categorized template library', async () => {
      const library = await newsletterTemplateService.getSectionTemplateLibrary();

      expect(library.categories).toBeDefined();
      expect(library.total_sections).toBeGreaterThan(0);

      // Check category structure
      const headerCategory = library.categories.find(c => c.type === 'header');
      expect(headerCategory).toBeDefined();
      expect(headerCategory!.display_name).toBe('Headers');
      expect(headerCategory!.sections.length).toBeGreaterThan(0);

      const newsCategory = library.categories.find(c => c.type === 'top_news');
      expect(newsCategory).toBeDefined();
      expect(newsCategory!.display_name).toBe('Top News');
      expect(newsCategory!.sections.length).toBeGreaterThan(0);
    });

    it('should have sections sorted by display_order', async () => {
      const library = await newsletterTemplateService.getSectionTemplateLibrary();
      
      library.categories.forEach(category => {
        if (category.sections.length > 1) {
          for (let i = 0; i < category.sections.length - 1; i++) {
            expect(category.sections[i].display_order)
              .toBeLessThanOrEqual(category.sections[i + 1].display_order);
          }
        }
      });
    });
  });

  describe('createCustomSection', () => {
    it('should create a custom section', async () => {
      const section = await newsletterTemplateService.createCustomSection(
        'custom_test',
        'Custom Test Section',
        '<div class="custom">{{content}}</div>',
        'custom',
        { description: 'A test custom section' }
      );

      expect(section.name).toBe('custom_test');
      expect(section.display_name).toBe('Custom Test Section');
      expect(section.section_type).toBe('custom');
      expect(section.is_recurring).toBe(false);
      expect(section.metadata).toEqual({ description: 'A test custom section' });
    });

    it('should auto-assign display_order', async () => {
      // Create a section with display_order 5
      await newsletterSectionRepository.create({
        name: 'existing',
        display_name: 'Existing',
        section_type: 'custom',
        template_content: '<div>Existing</div>',
        is_recurring: false,
        display_order: 5,
        metadata: {}
      });

      const section = await newsletterTemplateService.createCustomSection(
        'new_custom',
        'New Custom',
        '<div>New</div>',
        'custom'
      );

      expect(section.display_order).toBe(6);
    });
  });
});