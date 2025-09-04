'use client';

import { 
  X, 
  ExternalLink, 
  Clock, 
  Globe, 
  Language,
  FileText,
  Sparkles,
  BookOpen,
  AlertTriangle,
  Copy,
  Check
} from 'lucide-react';
import { useState } from 'react';

interface Article {
  id: string;
  title: string;
  description: string | null;
  content: string | null;
  url: string;
  detected_language: string | null;
  needs_manual_language_review: boolean;
  published_at: string;
  scraped_at: string;
  created_at: string;
  feed_id: string;
}

interface ArticlePreviewModalProps {
  article: Article | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ArticlePreviewModal({ article, isOpen, onClose }: ArticlePreviewModalProps) {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [activeTab, setActiveTab] = useState<'content' | 'metadata'>('content');

  if (!isOpen || !article) return null;

  // Get language display name
  const getLanguageName = (code: string | null) => {
    const languages: Record<string, string> = {
      'en': 'English',
      'es': 'Español', 
      'pt': 'Português',
      'fr': 'Français',
      'ar': 'العربية',
      'zh': '中文',
      'ja': '日本語'
    };
    return languages[code || ''] || 'Unknown';
  };

  // Calculate reading time
  const getReadingTime = () => {
    const text = (article.title + ' ' + (article.description || '') + ' ' + (article.content || '')).trim();
    const wordCount = text.split(/\s+/).length;
    const minutes = Math.ceil(wordCount / 200);
    return minutes > 0 ? minutes : 1;
  };

  // Extract domain from URL
  const getDomain = () => {
    try {
      return new URL(article.url).hostname.replace('www.', '');
    } catch {
      return 'Unknown source';
    }
  };

  // Copy URL to clipboard
  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(article.url);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch (error) {
      console.error('Failed to copy URL:', error);
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0 pr-4">
              <div className="flex items-center space-x-3 mb-2">
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <Globe className="h-4 w-4" />
                  <span className="font-medium">{getDomain()}</span>
                </div>
                
                {article.detected_language && (
                  <div className="flex items-center space-x-2">
                    <div className="flex items-center space-x-1 text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded-full">
                      <Language className="h-3 w-3" />
                      <span>{getLanguageName(article.detected_language)}</span>
                    </div>
                    {article.needs_manual_language_review && (
                      <div className="flex items-center space-x-1 text-xs text-amber-600 bg-amber-100 px-2 py-1 rounded-full">
                        <AlertTriangle className="h-3 w-3" />
                        <span>Review needed</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              <h1 className="text-xl font-bold text-gray-900 line-clamp-2">
                {article.title}
              </h1>
            </div>
            
            <button
              onClick={onClose}
              className="flex-shrink-0 p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          {/* Action Buttons */}
          <div className="flex items-center space-x-3 mt-4">
            <button
              onClick={() => window.open(article.url, '_blank')}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              <span>Read Original</span>
            </button>
            
            <button
              onClick={copyUrl}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              {copiedUrl ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              <span>{copiedUrl ? 'Copied!' : 'Copy URL'}</span>
            </button>
            
            {/* TODO: Implement these actions when backend supports them */}
            <button className="inline-flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-400 rounded-lg cursor-not-allowed">
              <Language className="h-4 w-4" />
              <span>Translate</span>
            </button>
            
            <button className="inline-flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-400 rounded-lg cursor-not-allowed">
              <Sparkles className="h-4 w-4" />
              <span>Summarize</span>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('content')}
              className={`py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'content'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center space-x-2">
                <BookOpen className="h-4 w-4" />
                <span>Content</span>
              </div>
            </button>
            
            <button
              onClick={() => setActiveTab('metadata')}
              className={`py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'metadata'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center space-x-2">
                <FileText className="h-4 w-4" />
                <span>Details</span>
              </div>
            </button>
          </nav>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[60vh]">
          {activeTab === 'content' && (
            <div className="p-6 space-y-6">
              {/* Reading Info */}
              <div className="flex items-center space-x-4 text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
                <div className="flex items-center space-x-1">
                  <Clock className="h-4 w-4" />
                  <span>{getReadingTime()} min read</span>
                </div>
                <div className="w-1 h-1 bg-gray-400 rounded-full" />
                <span>Published {formatDate(article.published_at)}</span>
              </div>

              {/* Description */}
              {article.description && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Description</h3>
                  <p className="text-gray-700 leading-relaxed">{article.description}</p>
                </div>
              )}

              {/* TODO: Show AI Summary when available */}
              {/* {article.summary && (
                <div className="bg-blue-50 border-l-4 border-blue-200 p-4 rounded-r-lg">
                  <div className="flex items-center space-x-2 mb-3">
                    <Sparkles className="h-5 w-5 text-blue-600" />
                    <h3 className="text-sm font-semibold text-blue-900">AI Summary</h3>
                  </div>
                  <p className="text-blue-800 leading-relaxed">{article.summary}</p>
                </div>
              )} */}

              {/* Content */}
              {article.content && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Article Content</h3>
                  <div className="prose max-w-none">
                    <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {article.content}
                    </p>
                  </div>
                </div>
              )}

              {!article.content && !article.description && (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Content Available</h3>
                  <p className="text-gray-500">
                    This article only contains a title. Click "Read Original" to view the full article.
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'metadata' && (
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Article Info */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">Article Information</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Article ID</label>
                      <p className="mt-1 text-sm text-gray-900 font-mono">{article.id}</p>
                    </div>
                    
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Source URL</label>
                      <p className="mt-1 text-sm text-blue-600 break-all hover:underline cursor-pointer" onClick={() => window.open(article.url, '_blank')}>
                        {article.url}
                      </p>
                    </div>
                    
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Feed ID</label>
                      <p className="mt-1 text-sm text-gray-900 font-mono">{article.feed_id}</p>
                    </div>
                  </div>
                </div>

                {/* Processing Info */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">Processing Information</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Detected Language</label>
                      <p className="mt-1 text-sm text-gray-900">
                        {article.detected_language ? getLanguageName(article.detected_language) : 'Not detected'}
                      </p>
                    </div>
                    
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Language Review Status</label>
                      <p className="mt-1 text-sm">
                        {article.needs_manual_language_review ? (
                          <span className="text-amber-600">Manual review needed</span>
                        ) : (
                          <span className="text-green-600">Automatically processed</span>
                        )}
                      </p>
                    </div>
                    
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Content Stats</label>
                      <div className="mt-1 text-sm text-gray-900 space-y-1">
                        <p>Title: {article.title.length} characters</p>
                        <p>Description: {article.description?.length || 0} characters</p>
                        <p>Content: {article.content?.length || 0} characters</p>
                        <p>Estimated reading time: {getReadingTime()} minutes</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Timestamps */}
                <div className="md:col-span-2">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">Timeline</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Published</label>
                      <p className="mt-1 text-sm text-gray-900">{formatDate(article.published_at)}</p>
                    </div>
                    
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Scraped</label>
                      <p className="mt-1 text-sm text-gray-900">{formatDate(article.scraped_at)}</p>
                    </div>
                    
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Added to Database</label>
                      <p className="mt-1 text-sm text-gray-900">{formatDate(article.created_at)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div className="flex items-center space-x-4">
              <span>Source: {getDomain()}</span>
              {article.detected_language && (
                <span>Language: {getLanguageName(article.detected_language)}</span>
              )}
            </div>
            
            <div className="text-xs text-gray-500">
              Added {formatDate(article.created_at)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}