'use client';

import { useState, useEffect } from 'react';
import { X, Search, Layout, TrendingUp, FileText, Mail, Plus } from 'lucide-react';

interface NewsletterSection {
  id: string;
  name: string;
  display_name: string;
  section_type: 'header' | 'top_news' | 'market_trends' | 'footer' | 'custom';
  template_content: string;
  is_recurring: boolean;
  display_order: number;
  metadata: Record<string, any>;
}

interface TemplateCategory {
  type: string;
  display_name: string;
  description: string;
  sections: NewsletterSection[];
}

interface TemplateLibrary {
  categories: TemplateCategory[];
  total_sections: number;
}

interface SectionTemplatePickerProps {
  onSelect: (section: NewsletterSection) => void;
  onClose: () => void;
}

const categoryIcons = {
  header: Layout,
  top_news: TrendingUp,
  market_trends: TrendingUp,
  custom: FileText,
  footer: Mail
};

export function SectionTemplatePicker({ onSelect, onClose }: SectionTemplatePickerProps) {
  const [library, setLibrary] = useState<TemplateLibrary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [previewSection, setPreviewSection] = useState<NewsletterSection | null>(null);

  useEffect(() => {
    loadTemplateLibrary();
  }, []);

  const loadTemplateLibrary = async () => {
    try {
      const response = await fetch('/api/newsletter-sections/template-library');
      if (!response.ok) {
        throw new Error('Failed to load template library');
      }
      const data = await response.json();
      setLibrary(data);
    } catch (err) {
      setError('Failed to load section templates');
      console.error('Error loading templates:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredCategories = library?.categories.filter(category => {
    if (selectedCategory !== 'all' && category.type !== selectedCategory) {
      return false;
    }
    
    if (searchTerm) {
      return category.sections.some(section =>
        section.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        section.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (section.metadata.description && 
         section.metadata.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    
    return true;
  }) || [];

  const getFilteredSections = (category: TemplateCategory) => {
    if (!searchTerm) return category.sections;
    
    return category.sections.filter(section =>
      section.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      section.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (section.metadata.description && 
       section.metadata.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  };

  const renderSectionPreview = (section: NewsletterSection) => {
    // Simple HTML content preview
    let preview = section.template_content;
    preview = preview.replace(/\{\{newsletter_title\}\}/g, 'Sample Newsletter');
    preview = preview.replace(/\{\{subtitle\}\}/g, 'Weekly Industry Updates');
    preview = preview.replace(/\{\{publish_date\}\}/g, new Date().toLocaleDateString());
    preview = preview.replace(/\{\{issue_number\}\}/g, '42');
    preview = preview.replace(/\{\{generation_date\}\}/g, new Date().toLocaleDateString());
    preview = preview.replace(/\{\{section_title\}\}/g, 'Custom Section Title');
    preview = preview.replace(/\{\{footer_text\}\}/g, 'Stay informed with our curated news updates.');
    preview = preview.replace(/\{\{custom_content\}\}/g, 'This is where your custom content will appear.');
    
    // Replace article loops with sample content
    if (preview.includes('{{#each articles}}')) {
      const sampleArticles = [
        { title: 'Breaking: Major Industry Development', description: 'This is a sample article description that shows how your content will look.', url: '#' },
        { title: 'Market Analysis: Q4 Trends', description: 'Another sample article with engaging content preview.', url: '#' }
      ];
      
      let articleHtml = '';
      sampleArticles.forEach(article => {
        let articleTemplate = preview.match(/\{\{#each articles\}\}(.*?)\{\{\/each\}\}/s)?.[1] || '';
        articleTemplate = articleTemplate.replace(/\{\{title\}\}/g, article.title);
        articleTemplate = articleTemplate.replace(/\{\{description\}\}/g, article.description);
        articleTemplate = articleTemplate.replace(/\{\{url\}\}/g, article.url);
        articleHtml += articleTemplate;
      });
      
      preview = preview.replace(/\{\{#each articles\}\}.*?\{\{\/each\}\}/s, articleHtml);
    }
    
    return { __html: preview };
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading templates...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-96">
          <div className="text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Section Template Library</h2>
            <p className="text-gray-600 mt-1">
              Choose from {library?.total_sections} pre-built section templates
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Search and Filter */}
        <div className="p-6 border-b border-gray-200 bg-gray-50">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Search templates by name or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="all">All Categories</option>
              {library?.categories.map((category) => (
                <option key={category.type} value={category.type}>
                  {category.display_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Template List */}
          <div className="w-1/2 overflow-y-auto p-6">
            <div className="space-y-6">
              {filteredCategories.map((category) => {
                const sections = getFilteredSections(category);
                if (sections.length === 0) return null;

                const IconComponent = categoryIcons[category.type as keyof typeof categoryIcons] || FileText;

                return (
                  <div key={category.type}>
                    <div className="flex items-center mb-4">
                      <IconComponent className="h-5 w-5 text-indigo-600 mr-2" />
                      <h3 className="text-lg font-semibold text-gray-900">
                        {category.display_name}
                      </h3>
                      <span className="ml-2 text-sm text-gray-500">
                        ({sections.length})
                      </span>
                    </div>
                    
                    <p className="text-gray-600 text-sm mb-4">{category.description}</p>
                    
                    <div className="grid gap-3">
                      {sections.map((section) => (
                        <div
                          key={section.id}
                          className={`border rounded-lg p-4 cursor-pointer transition-all hover:shadow-md ${
                            previewSection?.id === section.id
                              ? 'border-indigo-500 ring-2 ring-indigo-200 bg-indigo-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                          onClick={() => setPreviewSection(section)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="text-lg font-medium text-gray-900 mb-1">
                                {section.display_name}
                              </h4>
                              {section.metadata.description && (
                                <p className="text-sm text-gray-600 mb-2">
                                  {section.metadata.description}
                                </p>
                              )}
                              <div className="flex items-center space-x-2 text-xs text-gray-500">
                                {section.is_recurring && (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full bg-blue-100 text-blue-800">
                                    Recurring
                                  </span>
                                )}
                                {section.metadata.variables && (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                                    {section.metadata.variables.length} variables
                                  </span>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelect(section);
                              }}
                              className="ml-4 inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Add
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {filteredCategories.length === 0 && (
                <div className="text-center py-12">
                  <FileText className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-lg font-medium text-gray-900">No templates found</h3>
                  <p className="mt-1 text-gray-500">
                    Try adjusting your search terms or category filter.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Preview Panel */}
          <div className="w-1/2 border-l border-gray-200 bg-gray-50">
            {previewSection ? (
              <div className="h-full flex flex-col">
                <div className="p-6 border-b border-gray-200 bg-white">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">
                        {previewSection.display_name}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1 capitalize">
                        {previewSection.section_type.replace('_', ' ')} Section
                      </p>
                      {previewSection.metadata.description && (
                        <p className="text-sm text-gray-700 mt-2">
                          {previewSection.metadata.description}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => onSelect(previewSection)}
                      className="ml-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add to Newsletter
                    </button>
                  </div>
                </div>
                
                <div className="flex-1 p-6 overflow-y-auto">
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Preview</h4>
                  <div className="border border-gray-200 rounded-lg bg-white p-4 shadow-sm">
                    <div
                      className="newsletter-preview"
                      dangerouslySetInnerHTML={renderSectionPreview(previewSection)}
                      style={{
                        fontFamily: 'Arial, sans-serif',
                        lineHeight: '1.6',
                        color: '#374151'
                      }}
                    />
                  </div>
                  
                  {previewSection.metadata.variables && previewSection.metadata.variables.length > 0 && (
                    <div className="mt-6">
                      <h4 className="text-lg font-medium text-gray-900 mb-3">Template Variables</h4>
                      <div className="bg-gray-100 rounded-lg p-4">
                        <div className="grid grid-cols-1 gap-2">
                          {previewSection.metadata.variables.map((variable: string) => (
                            <div key={variable} className="flex items-center">
                              <code className="text-sm bg-white px-2 py-1 rounded border">
                                {`{{${variable}}}`}
                              </code>
                              <span className="ml-2 text-sm text-gray-600 capitalize">
                                {variable.replace('_', ' ')}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <FileText className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-lg font-medium text-gray-900">Select a template</h3>
                  <p className="mt-1 text-gray-500">
                    Click on a template to see a preview here.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Select a template to add to your newsletter. You can customize it after adding.
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}