'use client';

import { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { 
  GripVertical, 
  Plus, 
  Save, 
  Eye, 
  Download, 
  Type, 
  FileText, 
  Trash2, 
  Edit3,
  ExternalLink,
  Calendar
} from 'lucide-react';

interface Article {
  id: string;
  title: string;
  url: string;
  description: string | null;
  feed_name: string;
  detected_language: string | null;
  published_at: string;
  created_at: string;
}

interface NewsletterItem {
  id: string;
  type: 'article' | 'text';
  content: Article | { text: string; htmlContent?: string };
  order: number;
}

interface NewsletterDraft {
  id?: string;
  title: string;
  items: NewsletterItem[];
  created_at?: string;
  updated_at?: string;
}

export default function NewsletterEditorPage() {
  const [availableArticles, setAvailableArticles] = useState<Article[]>([]);
  const [newsletterItems, setNewsletterItems] = useState<NewsletterItem[]>([]);
  const [newsletterTitle, setNewsletterTitle] = useState('My Newsletter');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);

  // Fetch available articles
  useEffect(() => {
    fetchArticles();
  }, []);

  const fetchArticles = async () => {
    try {
      const response = await fetch('/api/articles?limit=100');
      if (response.ok) {
        const data = await response.json();
        setAvailableArticles(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching articles:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter articles based on search
  const filteredArticles = availableArticles.filter(article =>
    article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (article.description && article.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Handle drag end
  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const { source, destination, draggableId } = result;

    // Moving from articles to newsletter
    if (source.droppableId === 'articles' && destination.droppableId === 'newsletter') {
      const article = availableArticles.find(a => a.id === draggableId);
      if (article) {
        const newItem: NewsletterItem = {
          id: `article-${Date.now()}-${article.id}`,
          type: 'article',
          content: article,
          order: destination.index
        };
        
        const newItems = [...newsletterItems];
        newItems.splice(destination.index, 0, newItem);
        updateItemOrders(newItems);
      }
    }

    // Reordering within newsletter
    if (source.droppableId === 'newsletter' && destination.droppableId === 'newsletter') {
      const newItems = [...newsletterItems];
      const [removed] = newItems.splice(source.index, 1);
      newItems.splice(destination.index, 0, removed);
      updateItemOrders(newItems);
    }
  };

  // Update item orders after reordering
  const updateItemOrders = (items: NewsletterItem[]) => {
    const updatedItems = items.map((item, index) => ({
      ...item,
      order: index
    }));
    setNewsletterItems(updatedItems);
  };

  // Add text block
  const addTextBlock = () => {
    const newTextItem: NewsletterItem = {
      id: `text-${Date.now()}`,
      type: 'text',
      content: { text: 'Add your custom text here...' },
      order: newsletterItems.length
    };
    setNewsletterItems([...newsletterItems, newTextItem]);
  };

  // Remove item
  const removeItem = (itemId: string) => {
    const filteredItems = newsletterItems.filter(item => item.id !== itemId);
    updateItemOrders(filteredItems);
  };

  // Update text content
  const updateTextContent = (itemId: string, newText: string) => {
    const updatedItems = newsletterItems.map(item => {
      if (item.id === itemId && item.type === 'text') {
        return {
          ...item,
          content: { ...item.content as { text: string }, text: newText }
        };
      }
      return item;
    });
    setNewsletterItems(updatedItems);
  };

  // Save newsletter draft
  const saveNewsletter = async () => {
    setSaving(true);
    try {
      const draftData: NewsletterDraft = {
        id: currentDraftId || undefined,
        title: newsletterTitle,
        items: newsletterItems
      };

      const response = await fetch('/api/newsletter/drafts', {
        method: currentDraftId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(draftData),
      });

      if (response.ok) {
        const result = await response.json();
        setCurrentDraftId(result.id);
        alert('Newsletter saved successfully!');
      } else {
        throw new Error('Failed to save newsletter');
      }
    } catch (error) {
      console.error('Error saving newsletter:', error);
      alert('Failed to save newsletter. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Export as HTML
  const exportAsHTML = async () => {
    try {
      const response = await fetch('/api/newsletter/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: newsletterTitle,
          items: newsletterItems
        }),
      });

      if (response.ok) {
        const htmlContent = await response.text();
        
        // Create download
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${newsletterTitle.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        throw new Error('Failed to export newsletter');
      }
    } catch (error) {
      console.error('Error exporting newsletter:', error);
      alert('Failed to export newsletter. Please try again.');
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading articles...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-3xl font-bold text-gray-900">Newsletter Editor</h1>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={newsletterTitle}
                onChange={(e) => setNewsletterTitle(e.target.value)}
                className="text-xl font-medium px-3 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Newsletter Title"
              />
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsPreviewMode(!isPreviewMode)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              <Eye className="mr-2 h-4 w-4" />
              {isPreviewMode ? 'Edit Mode' : 'Preview Mode'}
            </button>
            <button
              onClick={exportAsHTML}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              <Download className="mr-2 h-4 w-4" />
              Export HTML
            </button>
            <button
              onClick={saveNewsletter}
              disabled={saving}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
            >
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Saving...' : 'Save Draft'}
            </button>
          </div>
        </div>

        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Articles Panel */}
            {!isPreviewMode && (
              <div className="lg:col-span-1">
                <div className="bg-white rounded-lg shadow p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Available Articles</h3>
                  
                  {/* Search */}
                  <div className="mb-4">
                    <input
                      type="text"
                      placeholder="Search articles..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Articles List */}
                  <Droppable droppableId="articles" isDropDisabled>
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className="space-y-2 max-h-96 overflow-y-auto"
                      >
                        {filteredArticles.map((article, index) => (
                          <Draggable key={article.id} draggableId={article.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={`p-3 border rounded-lg cursor-move hover:shadow-md transition-shadow ${
                                  snapshot.isDragging ? 'shadow-lg ring-2 ring-indigo-500' : ''
                                }`}
                              >
                                <div className="flex items-start space-x-2">
                                  <GripVertical className="h-4 w-4 text-gray-400 mt-1" />
                                  <div className="flex-1 min-w-0">
                                    <h4 className="text-sm font-medium text-gray-900 line-clamp-2">
                                      {article.title}
                                    </h4>
                                    <div className="flex items-center space-x-2 mt-1">
                                      <span className="text-xs text-gray-500">
                                        {formatDate(article.published_at)}
                                      </span>
                                      {article.feed_name && (
                                        <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                                          {article.feed_name}
                                        </span>
                                      )}
                                    </div>
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
                </div>
              </div>
            )}

            {/* Newsletter Editor Panel */}
            <div className={`${isPreviewMode ? 'lg:col-span-3' : 'lg:col-span-2'}`}>
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {isPreviewMode ? 'Newsletter Preview' : 'Newsletter Content'}
                  </h3>
                  {!isPreviewMode && (
                    <button
                      onClick={addTextBlock}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Text Block
                    </button>
                  )}
                </div>

                {isPreviewMode ? (
                  /* Preview Mode */
                  <div className="max-w-2xl mx-auto bg-gray-50 p-8 rounded-lg">
                    <h1 className="text-3xl font-bold text-gray-900 mb-6 text-center">
                      {newsletterTitle}
                    </h1>
                    
                    <div className="space-y-6">
                      {newsletterItems.map((item) => (
                        <div key={item.id}>
                          {item.type === 'article' ? (
                            <div className="bg-white p-6 rounded-lg shadow-sm border">
                              <h3 className="text-xl font-bold text-gray-900 mb-3">
                                {(item.content as Article).title}
                              </h3>
                              {(item.content as Article).description && (
                                <p className="text-gray-700 mb-4 leading-relaxed">
                                  {(item.content as Article).description}
                                </p>
                              )}
                              <div className="flex items-center justify-between">
                                <a
                                  href={(item.content as Article).url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center text-indigo-600 hover:text-indigo-800 font-medium"
                                >
                                  Read Full Article
                                  <ExternalLink className="ml-1 h-4 w-4" />
                                </a>
                                <div className="text-sm text-gray-500 flex items-center">
                                  <Calendar className="mr-1 h-4 w-4" />
                                  {formatDate((item.content as Article).published_at)}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="text-gray-800 leading-relaxed">
                              <div 
                                dangerouslySetInnerHTML={{ 
                                  __html: (item.content as { text: string; htmlContent?: string }).htmlContent || 
                                          (item.content as { text: string }).text.replace(/\n/g, '<br>') 
                                }} 
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* Edit Mode */
                  <Droppable droppableId="newsletter">
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className="min-h-96 space-y-4"
                      >
                        {newsletterItems.length === 0 ? (
                          <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
                            <div className="text-gray-500">
                              <FileText className="mx-auto h-12 w-12 mb-4" />
                              <p className="text-lg font-medium mb-2">Start building your newsletter</p>
                              <p className="text-sm">Drag articles from the left panel or add text blocks</p>
                            </div>
                          </div>
                        ) : (
                          newsletterItems.map((item, index) => (
                            <Draggable key={item.id} draggableId={item.id} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  className={`border rounded-lg p-4 ${
                                    snapshot.isDragging ? 'shadow-lg ring-2 ring-indigo-500' : 'hover:shadow-md'
                                  } transition-shadow`}
                                >
                                  <div className="flex items-start space-x-3">
                                    <div {...provided.dragHandleProps} className="cursor-move">
                                      <GripVertical className="h-5 w-5 text-gray-400 mt-1" />
                                    </div>
                                    
                                    <div className="flex-1">
                                      {item.type === 'article' ? (
                                        <div>
                                          <div className="flex items-center space-x-2 mb-2">
                                            <FileText className="h-4 w-4 text-indigo-600" />
                                            <span className="text-xs font-medium text-indigo-600 uppercase tracking-wide">
                                              Article
                                            </span>
                                          </div>
                                          <h4 className="text-lg font-medium text-gray-900 mb-2">
                                            {(item.content as Article).title}
                                          </h4>
                                          {(item.content as Article).description && (
                                            <p className="text-gray-600 text-sm mb-2 line-clamp-2">
                                              {(item.content as Article).description}
                                            </p>
                                          )}
                                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                                            <span className="flex items-center">
                                              <Calendar className="mr-1 h-4 w-4" />
                                              {formatDate((item.content as Article).published_at)}
                                            </span>
                                            {(item.content as Article).feed_name && (
                                              <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">
                                                {(item.content as Article).feed_name}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      ) : (
                                        <div>
                                          <div className="flex items-center space-x-2 mb-2">
                                            <Type className="h-4 w-4 text-green-600" />
                                            <span className="text-xs font-medium text-green-600 uppercase tracking-wide">
                                              Text Block
                                            </span>
                                          </div>
                                          {editingTextId === item.id ? (
                                            <textarea
                                              value={(item.content as { text: string }).text}
                                              onChange={(e) => updateTextContent(item.id, e.target.value)}
                                              onBlur={() => setEditingTextId(null)}
                                              onKeyDown={(e) => {
                                                if (e.key === 'Escape') {
                                                  setEditingTextId(null);
                                                }
                                              }}
                                              className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-24"
                                              autoFocus
                                              placeholder="Enter your text here..."
                                            />
                                          ) : (
                                            <div
                                              onClick={() => setEditingTextId(item.id)}
                                              className="p-3 bg-gray-50 rounded-md cursor-text min-h-12 flex items-center"
                                            >
                                              <p className="text-gray-700 whitespace-pre-wrap flex-1">
                                                {(item.content as { text: string }).text || 'Click to edit...'}
                                              </p>
                                              <Edit3 className="h-4 w-4 text-gray-400 ml-2" />
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                    
                                    <button
                                      onClick={() => removeItem(item.id)}
                                      className="text-red-500 hover:text-red-700 p-1"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          ))
                        )}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                )}
              </div>
            </div>
          </div>
        </DragDropContext>
      </div>
    </div>
  );
}