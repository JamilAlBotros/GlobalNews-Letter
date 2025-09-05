'use client';

import { 
  Clock, 
  Globe, 
  ExternalLink, 
  FileText, 
  Language,
  Sparkles,
  Eye,
  Bookmark,
  Share2,
  MoreVertical
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
  // TODO: Add these fields when backend supports them
  // feed_name?: string;
  // feed_category?: string;
  // summary?: string;
  // reading_time_minutes?: number;
}

interface ArticleCardProps {
  article: Article;
  onPreview: (article: Article) => void;
  onTranslate?: (article: Article) => void;
  onSummarize?: (article: Article) => void;
  onBookmark?: (article: Article) => void;
}

export function ArticleCard({ article, onPreview, onTranslate, onSummarize, onBookmark }: ArticleCardProps) {
  const [showActions, setShowActions] = useState(false);

  // Calculate estimated reading time (rough calculation: 200 words per minute)
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

  // Format date relative to now
  const getRelativeDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`;
    return date.toLocaleDateString();
  };

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

  // Truncate text to specified length
  const truncateText = (text: string | null, maxLength: number) => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  return (
    <div className="group bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-lg hover:border-gray-200 transition-all duration-300 overflow-hidden">
      {/* Header */}
      <div className="p-6 pb-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <Globe className="h-4 w-4" />
            <span className="font-medium">{getDomain()}</span>
            {/* TODO: Show feed category when available */}
            {/* <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">{article.feed_category}</span> */}
          </div>
          
          <div className="flex items-center space-x-2">
            {article.detected_language && (
              <div className="flex items-center space-x-1 text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                <Language className="h-3 w-3" />
                <span>{getLanguageName(article.detected_language)}</span>
                {article.needs_manual_language_review && (
                  <div className="w-1 h-1 bg-amber-400 rounded-full" title="Needs manual review" />
                )}
              </div>
            )}
            
            {/* TODO: Show summary indicator when available */}
            {/* {article.summary && (
              <div className="p-1 bg-emerald-100 text-emerald-600 rounded">
                <Sparkles className="h-3 w-3" />
              </div>
            )} */}
            
            <div className="relative">
              <button
                onClick={() => setShowActions(!showActions)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
              
              {/* Actions Dropdown - TODO: Implement functionality */}
              {showActions && (
                <div className="absolute right-0 top-8 bg-white shadow-lg border rounded-lg py-1 z-10 w-40">
                  <button 
                    onClick={() => onPreview(article)}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center space-x-2"
                  >
                    <Eye className="h-4 w-4" />
                    <span>Preview</span>
                  </button>
                  
                  <button 
                    onClick={() => onTranslate?.(article)}
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center space-x-2 ${
                      onTranslate ? 'text-gray-700 hover:text-blue-600' : 'text-gray-400 cursor-not-allowed'
                    }`}
                    disabled={!onTranslate}
                  >
                    <Language className="h-4 w-4" />
                    <span>Translate</span>
                  </button>
                  <button 
                    onClick={() => onSummarize?.(article)}
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center space-x-2 ${
                      onSummarize ? 'text-gray-700 hover:text-blue-600' : 'text-gray-400 cursor-not-allowed'
                    }`}
                    disabled={!onSummarize}
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>Summarize</span>
                  </button>
                  <button 
                    onClick={() => onBookmark?.(article)}
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center space-x-2 ${
                      onBookmark ? 'text-gray-700 hover:text-blue-600' : 'text-gray-400 cursor-not-allowed'
                    }`}
                    disabled={!onBookmark}
                  >
                    <Bookmark className="h-4 w-4" />
                    <span>Bookmark</span>
                  </button>
                  <button className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center space-x-2 text-gray-400 cursor-not-allowed">
                    <Share2 className="h-4 w-4" />
                    <span>Share (Coming Soon)</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Title */}
        <h3 
          onClick={() => onPreview(article)}
          className="text-lg font-semibold text-gray-900 mb-3 line-clamp-2 cursor-pointer hover:text-blue-600 transition-colors group-hover:text-blue-700"
        >
          {article.title}
        </h3>

        {/* Description */}
        {article.description && (
          <p className="text-gray-600 text-sm mb-4 line-clamp-3 leading-relaxed">
            {truncateText(article.description, 200)}
          </p>
        )}

        {/* TODO: Show AI-generated summary when available */}
        {/* {article.summary && (
          <div className="bg-blue-50 border-l-4 border-blue-200 p-3 mb-4">
            <div className="flex items-center space-x-2 mb-2">
              <Sparkles className="h-4 w-4 text-blue-600" />
              <span className="text-xs font-medium text-blue-700">AI Summary</span>
            </div>
            <p className="text-sm text-blue-900 line-clamp-2">
              {truncateText(article.summary, 150)}
            </p>
          </div>
        )} */}

        {/* Content Preview */}
        {article.content && (
          <div className="border-t border-gray-100 pt-4">
            <div className="flex items-center space-x-2 mb-2">
              <FileText className="h-4 w-4 text-gray-400" />
              <span className="text-xs font-medium text-gray-500">Content Preview</span>
            </div>
            <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">
              {truncateText(article.content, 120)}
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1">
              <Clock className="h-3 w-3" />
              <span>{getReadingTime()} min read</span>
            </div>
            <div className="flex items-center space-x-1">
              <span>Published {getRelativeDate(article.published_at)}</span>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => window.open(article.url, '_blank')}
              className="flex items-center space-x-1 text-gray-500 hover:text-blue-600 transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              <span>Read Original</span>
            </button>
          </div>
        </div>
      </div>

      {/* Click overlay for mobile */}
      <div 
        className="md:hidden absolute inset-0 z-0"
        onClick={() => onPreview(article)}
      />
    </div>
  );
}