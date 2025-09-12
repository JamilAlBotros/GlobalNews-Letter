'use client';

import { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Plus, Trash2, Edit3, Save, Eye, Settings, ArrowUp, ArrowDown } from 'lucide-react';
import { SectionTemplatePicker } from '@/components/newsletter/SectionTemplatePicker';
import { SectionEditor } from '@/components/newsletter/SectionEditor';

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

interface Newsletter {
  id?: string;
  issue_number?: number;
  title: string;
  subtitle?: string;
  publish_date: string;
  status: 'draft' | 'published' | 'archived';
  language: string;
  content_metadata?: Record<string, any>;
}

interface NewsletterDraft extends Newsletter {
  sections: NewsletterSection[];
}

export default function NewsletterEditor() {
  const [draft, setDraft] = useState<NewsletterDraft>({
    title: 'New Newsletter',
    subtitle: '',
    publish_date: new Date().toISOString().split('T')[0],
    status: 'draft',
    language: 'en',
    sections: []
  });

  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [editingSection, setEditingSection] = useState<NewsletterSection | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedDrafts, setSavedDrafts] = useState<Newsletter[]>([]);

  // Load saved drafts on component mount
  useEffect(() => {
    loadSavedDrafts();
  }, []);

  const loadSavedDrafts = async () => {
    try {
      const response = await fetch('/api/newsletters?status=draft&limit=10');
      if (response.ok) {
        const data = await response.json();
        setSavedDrafts(data.data || []);
      }
    } catch (err) {
      console.error('Failed to load drafts:', err);
    }
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(draft.sections);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update display_order for all sections
    const updatedSections = items.map((section, index) => ({
      ...section,
      display_order: index + 1
    }));

    setDraft(prev => ({
      ...prev,
      sections: updatedSections
    }));
  };

  const addSection = (templateSection: NewsletterSection) => {
    const newSection: NewsletterSection = {
      ...templateSection,
      id: `temp_${Date.now()}`, // Temporary ID for new sections
      display_order: draft.sections.length + 1,
      is_recurring: false // New sections are not recurring by default
    };

    setDraft(prev => ({
      ...prev,
      sections: [...prev.sections, newSection]
    }));
    setShowTemplatePicker(false);
  };

  const removeSection = (sectionId: string) => {
    setDraft(prev => ({
      ...prev,
      sections: prev.sections
        .filter(s => s.id !== sectionId)
        .map((section, index) => ({
          ...section,
          display_order: index + 1
        }))
    }));
  };

  const updateSection = (sectionId: string, updates: Partial<NewsletterSection>) => {
    setDraft(prev => ({
      ...prev,
      sections: prev.sections.map(section =>
        section.id === sectionId ? { ...section, ...updates } : section
      )
    }));
  };

  const moveSection = (sectionId: string, direction: 'up' | 'down') => {
    const currentIndex = draft.sections.findIndex(s => s.id === sectionId);
    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= draft.sections.length) return;

    const sections = [...draft.sections];
    [sections[currentIndex], sections[newIndex]] = [sections[newIndex], sections[currentIndex]];

    // Update display_order
    const updatedSections = sections.map((section, index) => ({
      ...section,
      display_order: index + 1
    }));

    setDraft(prev => ({
      ...prev,
      sections: updatedSections
    }));
  };

  const saveDraft = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/newsletters', {
        method: draft.id ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...draft,
          content_metadata: {
            sections: draft.sections,
            last_modified: new Date().toISOString()
          }
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save draft');
      }

      const savedNewsletter = await response.json();
      setDraft(prev => ({
        ...prev,
        id: savedNewsletter.id,
        issue_number: savedNewsletter.issue_number
      }));

      await loadSavedDrafts();
      alert('Draft saved successfully!');
    } catch (err) {
      setError('Failed to save draft. Please try again.');
      console.error('Error saving draft:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadDraft = async (draftId: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/newsletters/${draftId}`);
      if (!response.ok) {
        throw new Error('Failed to load draft');
      }

      const newsletter = await response.json();
      setDraft({
        ...newsletter,
        sections: newsletter.content_metadata?.sections || []
      });
    } catch (err) {
      setError('Failed to load draft');
      console.error('Error loading draft:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const generatePreview = () => {
    // Generate HTML preview of the newsletter
    let html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${draft.title}</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
            .newsletter-container { background: #ffffff; }
          </style>
        </head>
        <body>
          <div class="newsletter-container">
    `;

    draft.sections
      .sort((a, b) => a.display_order - b.display_order)
      .forEach(section => {
        // Replace template variables with actual values
        let content = section.template_content;
        content = content.replace(/\{\{newsletter_title\}\}/g, draft.title);
        content = content.replace(/\{\{subtitle\}\}/g, draft.subtitle || '');
        content = content.replace(/\{\{publish_date\}\}/g, new Date(draft.publish_date).toLocaleDateString());
        content = content.replace(/\{\{issue_number\}\}/g, draft.issue_number?.toString() || 'Draft');
        content = content.replace(/\{\{generation_date\}\}/g, new Date().toLocaleDateString());
        
        html += content;
      });

    html += `
          </div>
        </body>
      </html>
    `;

    // Open preview in new window
    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write(html);
      newWindow.document.close();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900">Newsletter Editor</h1>
            <div className="flex items-center space-x-3">
              <button
                onClick={generatePreview}
                disabled={draft.sections.length === 0}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                <Eye className="mr-2 h-4 w-4" />
                Preview
              </button>
              <button
                onClick={saveDraft}
                disabled={isLoading}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                <Save className="mr-2 h-4 w-4" />
                {isLoading ? 'Saving...' : 'Save Draft'}
              </button>
            </div>
          </div>

          {/* Newsletter Metadata */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title
              </label>
              <input
                type="text"
                value={draft.title}
                onChange={(e) => setDraft(prev => ({ ...prev, title: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Subtitle
              </label>
              <input
                type="text"
                value={draft.subtitle || ''}
                onChange={(e) => setDraft(prev => ({ ...prev, subtitle: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Publish Date
              </label>
              <input
                type="date"
                value={draft.publish_date}
                onChange={(e) => setDraft(prev => ({ ...prev, publish_date: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          {draft.id && (
            <div className="mt-4 p-3 bg-green-50 rounded-md">
              <p className="text-sm text-green-800">
                <strong>Draft saved</strong> - Issue #{draft.issue_number} | Last modified: {new Date().toLocaleString()}
              </p>
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-50 rounded-md">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Saved Drafts Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Saved Drafts</h3>
              <div className="space-y-2">
                {savedDrafts.map((savedDraft) => (
                  <button
                    key={savedDraft.id}
                    onClick={() => loadDraft(savedDraft.id!)}
                    className={`w-full text-left p-3 rounded-md border text-sm hover:bg-gray-50 ${
                      draft.id === savedDraft.id ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="font-medium text-gray-900 truncate">
                      {savedDraft.title}
                    </div>
                    <div className="text-gray-500 text-xs">
                      Issue #{savedDraft.issue_number}
                    </div>
                  </button>
                ))}
              </div>
              
              <button
                onClick={() => setDraft({
                  title: 'New Newsletter',
                  subtitle: '',
                  publish_date: new Date().toISOString().split('T')[0],
                  status: 'draft',
                  language: 'en',
                  sections: []
                })}
                className="w-full mt-4 px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <Plus className="inline mr-2 h-4 w-4" />
                New Newsletter
              </button>
            </div>
          </div>

          {/* Main Editor */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900">Newsletter Sections</h3>
                  <button
                    onClick={() => setShowTemplatePicker(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Section
                  </button>
                </div>
              </div>

              <div className="p-6">
                {draft.sections.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-gray-400 mb-4">
                      <Settings className="mx-auto h-12 w-12" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No sections added yet</h3>
                    <p className="text-gray-500 mb-4">
                      Start building your newsletter by adding sections from our template library.
                    </p>
                    <button
                      onClick={() => setShowTemplatePicker(true)}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Your First Section
                    </button>
                  </div>
                ) : (
                  <DragDropContext onDragEnd={handleDragEnd}>
                    <Droppable droppableId="newsletter-sections">
                      {(provided) => (
                        <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-4">
                          {draft.sections
                            .sort((a, b) => a.display_order - b.display_order)
                            .map((section, index) => (
                              <Draggable key={section.id} draggableId={section.id} index={index}>
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    className={`border rounded-lg p-4 ${
                                      snapshot.isDragging ? 'shadow-lg' : 'shadow-sm'
                                    } bg-white`}
                                  >
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center space-x-3">
                                        <div
                                          {...provided.dragHandleProps}
                                          className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
                                        >
                                          <div className="flex flex-col space-y-1">
                                            <div className="w-3 h-0.5 bg-current"></div>
                                            <div className="w-3 h-0.5 bg-current"></div>
                                            <div className="w-3 h-0.5 bg-current"></div>
                                          </div>
                                        </div>
                                        <div>
                                          <h4 className="text-lg font-medium text-gray-900">
                                            {section.display_name}
                                          </h4>
                                          <p className="text-sm text-gray-500 capitalize">
                                            {section.section_type.replace('_', ' ')} Section
                                          </p>
                                        </div>
                                      </div>
                                      
                                      <div className="flex items-center space-x-2">
                                        <button
                                          onClick={() => moveSection(section.id, 'up')}
                                          disabled={index === 0}
                                          className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                        >
                                          <ArrowUp className="h-4 w-4" />
                                        </button>
                                        <button
                                          onClick={() => moveSection(section.id, 'down')}
                                          disabled={index === draft.sections.length - 1}
                                          className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                        >
                                          <ArrowDown className="h-4 w-4" />
                                        </button>
                                        <button
                                          onClick={() => setEditingSection(section)}
                                          className="p-2 text-gray-400 hover:text-indigo-600"
                                        >
                                          <Edit3 className="h-4 w-4" />
                                        </button>
                                        <button
                                          onClick={() => removeSection(section.id)}
                                          className="p-2 text-gray-400 hover:text-red-600"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </button>
                                      </div>
                                    </div>

                                    {/* Section Preview */}
                                    <div className="mt-3 p-3 bg-gray-50 rounded border">
                                      <div className="text-sm text-gray-600 max-h-20 overflow-hidden">
                                        {section.template_content.replace(/<[^>]*>/g, '').substring(0, 150)}
                                        {section.template_content.length > 150 && '...'}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </Draggable>
                            ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </DragDropContext>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Section Template Picker Modal */}
        {showTemplatePicker && (
          <SectionTemplatePicker
            onSelect={addSection}
            onClose={() => setShowTemplatePicker(false)}
          />
        )}

        {/* Section Editor Modal */}
        {editingSection && (
          <SectionEditor
            section={editingSection}
            onSave={(updates) => {
              updateSection(editingSection.id, updates);
              setEditingSection(null);
            }}
            onClose={() => setEditingSection(null)}
          />
        )}
      </div>
    </div>
  );
}