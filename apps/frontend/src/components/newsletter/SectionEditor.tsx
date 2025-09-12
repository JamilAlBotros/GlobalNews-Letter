'use client';

import { useState, useEffect } from 'react';
import { X, Save, Eye, Code, Type } from 'lucide-react';

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

interface SectionEditorProps {
  section: NewsletterSection;
  onSave: (updates: Partial<NewsletterSection>) => void;
  onClose: () => void;
}

export function SectionEditor({ section, onSave, onClose }: SectionEditorProps) {
  const [editedSection, setEditedSection] = useState<NewsletterSection>({ ...section });
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setEditedSection({ ...section });
  }, [section]);

  const handleSave = () => {
    // Validate required fields
    const newErrors: Record<string, string> = {};
    
    if (!editedSection.display_name.trim()) {
      newErrors.display_name = 'Display name is required';
    }
    
    if (!editedSection.template_content.trim()) {
      newErrors.template_content = 'Template content is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    onSave({
      display_name: editedSection.display_name,
      template_content: editedSection.template_content,
      metadata: editedSection.metadata
    });
  };

  const renderPreview = () => {
    // Simple HTML content preview with sample data
    let preview = editedSection.template_content;
    preview = preview.replace(/\{\{newsletter_title\}\}/g, 'Sample Newsletter Title');
    preview = preview.replace(/\{\{subtitle\}\}/g, 'Weekly Industry Updates');
    preview = preview.replace(/\{\{publish_date\}\}/g, new Date().toLocaleDateString());
    preview = preview.replace(/\{\{issue_number\}\}/g, '42');
    preview = preview.replace(/\{\{generation_date\}\}/g, new Date().toLocaleDateString());
    preview = preview.replace(/\{\{section_title\}\}/g, 'Sample Section Title');
    preview = preview.replace(/\{\{footer_text\}\}/g, 'Thank you for reading our newsletter!');
    preview = preview.replace(/\{\{custom_content\}\}/g, 'This is sample custom content that will be replaced with actual content.');
    
    // Replace article loops with sample content
    if (preview.includes('{{#each articles}}')) {
      const sampleArticles = [
        { 
          title: 'Sample Article: Breaking Industry News', 
          description: 'This is a sample article description that demonstrates how your newsletter content will appear to readers.', 
          url: '#' 
        },
        { 
          title: 'Market Analysis: Current Trends', 
          description: 'Another sample article showing how multiple articles will be displayed in your newsletter section.', 
          url: '#' 
        }
      ];
      
      let articleHtml = '';
      sampleArticles.forEach((article, index) => {
        let articleTemplate = preview.match(/\{\{#each articles\}\}(.*?)\{\{\/each\}\}/s)?.[1] || '';
        articleTemplate = articleTemplate.replace(/\{\{title\}\}/g, article.title);
        articleTemplate = articleTemplate.replace(/\{\{description\}\}/g, article.description);
        articleTemplate = articleTemplate.replace(/\{\{url\}\}/g, article.url);
        articleTemplate = articleTemplate.replace(/\{\{@index\}\}/g, index.toString());
        articleTemplate = articleTemplate.replace(/\{\{#unless @last\}\}/g, index < sampleArticles.length - 1 ? '' : '<!--');
        articleTemplate = articleTemplate.replace(/\{\{\/unless\}\}/g, index < sampleArticles.length - 1 ? '' : '-->');
        articleHtml += articleTemplate;
      });
      
      preview = preview.replace(/\{\{#each articles\}\}.*?\{\{\/each\}\}/s, articleHtml);
    }
    
    return { __html: preview };
  };

  const commonVariables = [
    'newsletter_title',
    'subtitle', 
    'publish_date',
    'issue_number',
    'generation_date',
    'footer_text',
    'section_title',
    'custom_content'
  ];

  const insertVariable = (variable: string) => {
    const textarea = document.getElementById('template-content') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const content = editedSection.template_content;
      const newContent = content.substring(0, start) + `{{${variable}}}` + content.substring(end);
      
      setEditedSection(prev => ({
        ...prev,
        template_content: newContent
      }));
      
      // Restore cursor position
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + variable.length + 4, start + variable.length + 4);
      }, 0);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Edit Section</h2>
            <p className="text-gray-600 mt-1">
              {section.display_name} ({section.section_type.replace('_', ' ')} section)
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('edit')}
                className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  viewMode === 'edit'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Code className="w-4 h-4 mr-1 inline" />
                Edit
              </button>
              <button
                onClick={() => setViewMode('preview')}
                className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  viewMode === 'preview'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Eye className="w-4 h-4 mr-1 inline" />
                Preview
              </button>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {viewMode === 'edit' ? (
            <>
              {/* Edit Panel */}
              <div className="w-2/3 p-6 overflow-y-auto">
                <div className="space-y-6">
                  {/* Basic Information */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={editedSection.display_name}
                      onChange={(e) => setEditedSection(prev => ({
                        ...prev,
                        display_name: e.target.value
                      }))}
                      className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                        errors.display_name ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Section display name"
                    />
                    {errors.display_name && (
                      <p className="mt-1 text-sm text-red-600">{errors.display_name}</p>
                    )}
                  </div>

                  {/* Template Content */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Template Content
                    </label>
                    <textarea
                      id="template-content"
                      value={editedSection.template_content}
                      onChange={(e) => setEditedSection(prev => ({
                        ...prev,
                        template_content: e.target.value
                      }))}
                      rows={20}
                      className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm ${
                        errors.template_content ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Enter HTML template content with variables like {{newsletter_title}}"
                    />
                    {errors.template_content && (
                      <p className="mt-1 text-sm text-red-600">{errors.template_content}</p>
                    )}
                    <p className="mt-2 text-sm text-gray-600">
                      Use HTML markup and variables like <code className="bg-gray-100 px-1 rounded">
                        {`{{newsletter_title}}`}
                      </code> for dynamic content.
                    </p>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <input
                      type="text"
                      value={editedSection.metadata.description || ''}
                      onChange={(e) => setEditedSection(prev => ({
                        ...prev,
                        metadata: {
                          ...prev.metadata,
                          description: e.target.value
                        }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Brief description of this section"
                    />
                  </div>
                </div>
              </div>

              {/* Variable Helper Panel */}
              <div className="w-1/3 border-l border-gray-200 bg-gray-50 p-6">
                <div className="sticky top-0">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    <Type className="w-5 h-5 inline mr-2" />
                    Template Variables
                  </h3>
                  
                  <p className="text-sm text-gray-600 mb-4">
                    Click to insert variables into your template content:
                  </p>
                  
                  <div className="space-y-2">
                    {commonVariables.map((variable) => (
                      <button
                        key={variable}
                        onClick={() => insertVariable(variable)}
                        className="w-full text-left px-3 py-2 bg-white border border-gray-200 rounded-md hover:bg-gray-50 hover:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                      >
                        <code className="text-indigo-600">{`{{${variable}}}`}</code>
                        <div className="text-gray-600 text-xs mt-1 capitalize">
                          {variable.replace('_', ' ')}
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                    <h4 className="text-sm font-medium text-blue-900 mb-2">Article Loops</h4>
                    <p className="text-xs text-blue-700 mb-2">
                      For displaying multiple articles:
                    </p>
                    <button
                      onClick={() => insertVariable('#each articles')}
                      className="w-full text-left p-2 bg-white border rounded text-xs hover:bg-gray-50"
                    >
                      <code>{`{{#each articles}}`}</code><br/>
                      <code className="text-gray-600 ml-2">{`{{title}}`}</code><br/>
                      <code className="text-gray-600 ml-2">{`{{description}}`}</code><br/>
                      <code>{`{{/each}}`}</code>
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Preview Panel */
            <div className="w-full p-6 overflow-y-auto">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Preview</h3>
              <div className="border border-gray-200 rounded-lg bg-white p-6 shadow-sm">
                <div
                  className="newsletter-preview"
                  dangerouslySetInnerHTML={renderPreview()}
                  style={{
                    fontFamily: 'Arial, sans-serif',
                    lineHeight: '1.6',
                    color: '#374151'
                  }}
                />
              </div>
              <div className="mt-4 p-4 bg-yellow-50 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <strong>Note:</strong> This preview shows sample data. Actual newsletter content 
                  will replace the template variables when the newsletter is generated.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Changes will be applied to this section in your newsletter draft.
            </p>
            <div className="flex items-center space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}