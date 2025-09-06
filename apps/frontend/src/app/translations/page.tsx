'use client';

import { useState, useEffect } from 'react';
import { Languages, Clock, CheckCircle, XCircle, RefreshCw, Download, FileText, AlertCircle } from 'lucide-react';

interface TranslationJob {
  id: string;
  title: string;
  content: string;
  source_language: string;
  target_languages: string[];
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  original_articles: any[];
  translated_content: Record<string, string> | null;
  progress: number;
  assigned_worker: string | null;
  retry_count: number;
  max_retries: number;
  error_message: string | null;
  estimated_completion: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface TranslationJobsResponse {
  data: TranslationJob[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
  stats: {
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  };
}

export default function TranslationsPage() {
  const [jobs, setJobs] = useState<TranslationJob[]>([]);
  const [stats, setStats] = useState<TranslationJobsResponse['stats'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedJob, setSelectedJob] = useState<TranslationJob | null>(null);

  const fetchJobs = async (page: number = 1, status: string = '') => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10'
      });
      
      if (status) {
        params.append('status', status);
      }

      const response = await fetch(`/api/newsletter-translation-jobs?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch translation jobs');
      }
      
      const data: TranslationJobsResponse = await response.json();
      setJobs(data.data);
      setStats(data.stats);
      
    } catch (err) {
      setError('Failed to load translation jobs. Please try again.');
      console.error('Error fetching translation jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs(currentPage, selectedStatus);
    
    // Set up auto-refresh for pending/processing jobs
    const interval = setInterval(() => {
      if (jobs.some(job => job.status === 'pending' || job.status === 'processing')) {
        fetchJobs(currentPage, selectedStatus);
      }
    }, 10000); // Refresh every 10 seconds

    return () => clearInterval(interval);
  }, [currentPage, selectedStatus]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'processing':
        return <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />;
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'cancelled':
        return <AlertCircle className="h-5 w-5 text-gray-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  const retryJob = async (jobId: string) => {
    try {
      const response = await fetch(`/api/newsletter-translation-jobs/${jobId}/retry`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error('Failed to retry job');
      }
      
      fetchJobs(currentPage, selectedStatus);
    } catch (err) {
      console.error('Error retrying job:', err);
      alert('Failed to retry job. Please try again.');
    }
  };

  const cancelJob = async (jobId: string) => {
    try {
      const response = await fetch(`/api/newsletter-translation-jobs/${jobId}/cancel`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error('Failed to cancel job');
      }
      
      fetchJobs(currentPage, selectedStatus);
    } catch (err) {
      console.error('Error cancelling job:', err);
      alert('Failed to cancel job. Please try again.');
    }
  };

  const downloadTranslation = (job: TranslationJob, language: string) => {
    if (!job.translated_content || !job.translated_content[language]) {
      alert('Translation not available for this language.');
      return;
    }

    // Generate newsletter with Matrix template style
    const translatedContent = job.translated_content[language];
    const html = generateTranslatedNewsletter(job, translatedContent, language);
    
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `newsletter-${language}-${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const generateTranslatedNewsletter = (job: TranslationJob, translatedContent: string, language: string) => {
    const articles = job.original_articles || [];
    const languageNames: Record<string, string> = {
      'es': 'Spanish',
      'ar': 'Arabic', 
      'fr': 'French',
      'en': 'English'
    };

    // Parse the translated content to extract title, intro, articles, and footer
    const lines = translatedContent.split('\n').filter(line => line.trim());
    const title = lines[0] || job.title;
    
    return `
<!DOCTYPE html>
<html dir="${language === 'ar' ? 'rtl' : 'ltr'}">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    body {
      background: linear-gradient(180deg, #000000 0%, #001900 100%) !important;
      color: #00ff41;
      font-family: "Courier New", monospace;
      margin: 0;
      padding: 20px;
      direction: ${language === 'ar' ? 'rtl' : 'ltr'};
    }
    a {
      color: #00ff41;
      text-decoration: underline;
    }
    .container {
      max-width: 600px;
      margin: auto;
      padding: 20px;
      border: 1px solid #00ff41;
      border-radius: 8px;
      background: #000000;
    }
    h1, h2, h3 {
      color: #00ff41;
      text-align: center;
    }
    p {
      line-height: 1.6;
      font-size: 16px;
    }
    .divider {
      border-top: 1px dashed #00ff41;
      margin: 20px 0;
    }
    .footer {
      font-size: 12px;
      text-align: center;
      margin-top: 30px;
      color: #00aa33;
    }
    .btn {
      display: inline-block;
      background-color: #00ff41;
      color: #000;
      padding: 12px 20px;
      border-radius: 5px;
      text-decoration: none;
      font-weight: bold;
    }
    .language-badge {
      background: #00ff41;
      color: #000;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: bold;
      margin-bottom: 20px;
      display: inline-block;
    }
  </style>
</head>
<body style="background-color:#000000; margin:0; padding:0;">
  <div class="container">
    <div class="language-badge">${languageNames[language] || language.toUpperCase()}</div>
    <h1>${title}</h1>
    
    <div class="divider"></div>
    
    <pre style="white-space: pre-wrap; font-family: inherit;">${translatedContent}</pre>
    
    <div class="divider"></div>
    
    <h2>🔗 Original Articles</h2>
    <ul>
      ${articles.map(article => `
        <li>
          <strong><a href="${article.url}">${article.title}</a></strong>
        </li>
      `).join('')}
    </ul>

    <div class="footer">
      Newsletter translated using GlobalNewsLetter AI Translation System<br>
      Original content available at the links above.
    </div>
  </div>
</body>
</html>
    `;
  };

  if (loading && jobs.length === 0) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading translation jobs...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Translation Jobs</h1>
          <button
            onClick={() => fetchJobs(currentPage, selectedStatus)}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </button>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
              <div className="text-sm text-gray-500">Total</div>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg shadow">
              <div className="text-2xl font-bold text-yellow-800">{stats.pending}</div>
              <div className="text-sm text-yellow-600">Pending</div>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg shadow">
              <div className="text-2xl font-bold text-blue-800">{stats.processing}</div>
              <div className="text-sm text-blue-600">Processing</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg shadow">
              <div className="text-2xl font-bold text-green-800">{stats.completed}</div>
              <div className="text-sm text-green-600">Completed</div>
            </div>
            <div className="bg-red-50 p-4 rounded-lg shadow">
              <div className="text-2xl font-bold text-red-800">{stats.failed}</div>
              <div className="text-sm text-red-600">Failed</div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center space-x-4">
            <label className="text-sm font-medium text-gray-700">Filter by status:</label>
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Jobs List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {jobs.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Languages className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No translation jobs found</h3>
              <p>Create a newsletter and send it for translation from the Newsletter page.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {jobs.map((job) => (
                <div key={job.id} className="p-6 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3 mb-2">
                        {getStatusIcon(job.status)}
                        <h3 className="text-lg font-medium text-gray-900 truncate">
                          {job.title}
                        </h3>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>
                          {job.status}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-500 mb-3">
                        <div>
                          <strong>Languages:</strong> {job.target_languages.join(', ')}
                        </div>
                        <div>
                          <strong>Created:</strong> {formatDate(job.created_at)}
                        </div>
                        <div>
                          <strong>Progress:</strong> {job.progress}%
                        </div>
                      </div>

                      {job.status === 'processing' && (
                        <div className="mb-3">
                          <div className="bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${job.progress}%` }}
                            ></div>
                          </div>
                        </div>
                      )}

                      {job.error_message && (
                        <div className="mb-3 p-2 bg-red-50 rounded text-sm text-red-700">
                          <strong>Error:</strong> {job.error_message}
                        </div>
                      )}
                      
                      {job.status === 'pending' && (
                        <div className="mb-3 p-2 bg-yellow-50 rounded text-sm text-yellow-700">
                          <strong>Status:</strong> Waiting for local LLM to become available...
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {job.status === 'completed' && job.translated_content && (
                        <div className="flex space-x-1">
                          {job.target_languages.map((lang) => (
                            <button
                              key={lang}
                              onClick={() => downloadTranslation(job, lang)}
                              className="inline-flex items-center px-2 py-1 border border-green-300 rounded text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100"
                            >
                              <Download className="mr-1 h-3 w-3" />
                              {lang.toUpperCase()}
                            </button>
                          ))}
                        </div>
                      )}
                      
                      {job.status === 'failed' && job.retry_count < job.max_retries && (
                        <button
                          onClick={() => retryJob(job.id)}
                          className="inline-flex items-center px-2 py-1 border border-gray-300 rounded text-xs font-medium text-gray-700 bg-white hover:bg-gray-50"
                        >
                          <RefreshCw className="mr-1 h-3 w-3" />
                          Retry
                        </button>
                      )}
                      
                      {(job.status === 'pending' || job.status === 'processing') && (
                        <button
                          onClick={() => cancelJob(job.id)}
                          className="inline-flex items-center px-2 py-1 border border-red-300 rounded text-xs font-medium text-red-700 bg-white hover:bg-red-50"
                        >
                          Cancel
                        </button>
                      )}
                      
                      <button
                        onClick={() => setSelectedJob(job)}
                        className="inline-flex items-center px-2 py-1 border border-gray-300 rounded text-xs font-medium text-gray-700 bg-white hover:bg-gray-50"
                      >
                        <FileText className="mr-1 h-3 w-3" />
                        Details
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Job Details Modal */}
        {selectedJob && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
              </div>
              
              <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-900">
                      Translation Job Details
                    </h3>
                    <button
                      onClick={() => setSelectedJob(null)}
                      className="text-gray-400 hover:text-gray-600 text-2xl"
                    >
                      ×
                    </button>
                  </div>
                  
                  <div className="space-y-3 text-sm">
                    <div><strong>ID:</strong> {selectedJob.id}</div>
                    <div><strong>Title:</strong> {selectedJob.title}</div>
                    <div><strong>Status:</strong> 
                      <span className={`ml-2 px-2 py-1 rounded text-xs ${getStatusColor(selectedJob.status)}`}>
                        {selectedJob.status}
                      </span>
                    </div>
                    <div><strong>Source Language:</strong> {selectedJob.source_language}</div>
                    <div><strong>Target Languages:</strong> {selectedJob.target_languages.join(', ')}</div>
                    <div><strong>Articles:</strong> {selectedJob.original_articles.length}</div>
                    <div><strong>Created:</strong> {formatDate(selectedJob.created_at)}</div>
                    {selectedJob.started_at && (
                      <div><strong>Started:</strong> {formatDate(selectedJob.started_at)}</div>
                    )}
                    {selectedJob.completed_at && (
                      <div><strong>Completed:</strong> {formatDate(selectedJob.completed_at)}</div>
                    )}
                    {selectedJob.assigned_worker && (
                      <div><strong>Worker:</strong> {selectedJob.assigned_worker}</div>
                    )}
                  </div>
                  
                  {selectedJob.content && (
                    <div className="mt-4">
                      <strong>Original Content:</strong>
                      <div className="mt-2 p-3 bg-gray-100 rounded text-xs max-h-40 overflow-y-auto font-mono">
                        {selectedJob.content}
                      </div>
                    </div>
                  )}
                  
                  {selectedJob.original_articles && selectedJob.original_articles.length > 0 && (
                    <div className="mt-4">
                      <strong>Original Articles:</strong>
                      <div className="mt-2 space-y-2">
                        {selectedJob.original_articles.map((article, index) => (
                          <div key={index} className="p-2 bg-gray-50 rounded text-xs">
                            <div className="font-semibold">{article.title}</div>
                            <div className="text-gray-600">{article.description}</div>
                            <a href={article.url} target="_blank" rel="noopener noreferrer" 
                               className="text-blue-600 hover:underline">
                              {article.url}
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}