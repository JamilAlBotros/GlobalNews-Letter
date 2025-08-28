'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Languages, Clock, CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';

export function TranslationJobsList() {
  const { data: jobs, isLoading, error, refetch } = useQuery({
    queryKey: ['translation-jobs'],
    queryFn: () => apiClient.getTranslationJobs(),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Mock data for development
  const mockJobs = [
    {
      id: 'job-1',
      original_article_id: 'art-1',
      target_languages: 'es,pt',
      priority: 'normal',
      status: 'completed',
      assigned_worker: 'worker-1',
      started_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      completed_at: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
      estimated_completion: null,
      translation_config: '{"model": "gpt-4", "quality": "high"}',
      max_retries: 3,
      retry_count: 0,
      created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
      article_title: 'Global Markets Rally as Tech Stocks Surge',
      source_language: 'en',
    },
    {
      id: 'job-2',
      original_article_id: 'art-2',
      target_languages: 'es,fr,pt',
      priority: 'high',
      status: 'processing',
      assigned_worker: 'worker-2',
      started_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      completed_at: null,
      estimated_completion: new Date(Date.now() + 3 * 60 * 1000).toISOString(),
      translation_config: '{"model": "gpt-4", "quality": "high"}',
      max_retries: 3,
      retry_count: 0,
      created_at: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
      article_title: 'New AI Framework Promises Breakthrough in Language Understanding',
      source_language: 'en',
    },
    {
      id: 'job-3',
      original_article_id: 'art-3',
      target_languages: 'en',
      priority: 'normal',
      status: 'queued',
      assigned_worker: null,
      started_at: null,
      completed_at: null,
      estimated_completion: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      translation_config: '{"model": "gpt-3.5-turbo", "quality": "standard"}',
      max_retries: 3,
      retry_count: 0,
      created_at: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
      article_title: 'Nuevas Regulaciones Financieras en España',
      source_language: 'es',
    },
  ];

  const jobsData = jobs || mockJobs;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'processing':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'queued':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4 text-gray-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-700 bg-green-100';
      case 'processing':
        return 'text-blue-700 bg-blue-100';
      case 'queued':
        return 'text-yellow-700 bg-yellow-100';
      case 'failed':
        return 'text-red-700 bg-red-100';
      case 'cancelled':
        return 'text-gray-700 bg-gray-100';
      default:
        return 'text-gray-700 bg-gray-100';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'text-red-700 bg-red-100';
      case 'high':
        return 'text-orange-700 bg-orange-100';
      case 'normal':
        return 'text-green-700 bg-green-100';
      case 'low':
        return 'text-gray-700 bg-gray-100';
      default:
        return 'text-gray-700 bg-gray-100';
    }
  };

  const getLanguageLabel = (code: string) => {
    const languages: Record<string, string> = {
      en: 'English', es: 'Spanish', pt: 'Portuguese',
      fr: 'French', ar: 'Arabic', zh: 'Chinese', ja: 'Japanese',
    };
    return languages[code] || code.toUpperCase();
  };

  const formatDuration = (startTime: string, endTime?: string) => {
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    const diffInMinutes = Math.floor((end.getTime() - start.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just started';
    if (diffInMinutes < 60) return `${diffInMinutes}m`;
    return `${Math.floor(diffInMinutes / 60)}h ${diffInMinutes % 60}m`;
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">Translation Jobs</h3>
          <div className="text-sm text-gray-600">
            {jobsData.length} jobs
          </div>
        </div>
      </div>
      
      <div className="divide-y divide-gray-200">
        {jobsData.map((job) => (
          <div key={job.id} className="px-6 py-4 hover:bg-gray-50">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-4 flex-1">
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Languages className="h-5 w-5 text-purple-600" />
                  </div>
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-3">
                    <h4 className="text-sm font-medium text-gray-900 truncate">
                      {job.article_title}
                    </h4>
                  </div>
                  
                  <div className="mt-1 text-sm text-gray-600">
                    <span className="font-medium">{getLanguageLabel(job.source_language)}</span>
                    <span className="mx-2">→</span>
                    <span>
                      {job.target_languages.split(',').map(lang => getLanguageLabel(lang.trim())).join(', ')}
                    </span>
                  </div>
                  
                  <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
                    <span className="flex items-center space-x-1">
                      <Clock className="h-3 w-3" />
                      <span>
                        {job.status === 'completed' && job.started_at && job.completed_at
                          ? `Completed in ${formatDuration(job.started_at, job.completed_at)}`
                          : job.status === 'processing' && job.started_at
                          ? `Running for ${formatDuration(job.started_at)}`
                          : job.status === 'queued'
                          ? 'Waiting in queue'
                          : 'Unknown'
                        }
                      </span>
                    </span>
                    
                    {job.assigned_worker && (
                      <span>Worker: {job.assigned_worker}</span>
                    )}
                    
                    {job.retry_count > 0 && (
                      <span className="text-orange-600">
                        Retry {job.retry_count}/{job.max_retries}
                      </span>
                    )}
                    
                    <span>Created: {new Date(job.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col items-end space-y-2 ml-4">
                <div className="flex items-center space-x-2">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(job.priority)}`}>
                    {job.priority}
                  </span>
                  
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>
                    {getStatusIcon(job.status)}
                    <span className="ml-1 capitalize">{job.status}</span>
                  </span>
                </div>
                
                {job.estimated_completion && job.status === 'queued' && (
                  <div className="text-xs text-gray-500">
                    ETA: {new Date(job.estimated_completion).toLocaleTimeString()}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {jobsData.length === 0 && (
        <div className="px-6 py-8 text-center">
          <Languages className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No translation jobs</h3>
          <p className="mt-1 text-sm text-gray-500">
            Translation jobs will appear here when articles need to be translated.
          </p>
        </div>
      )}
    </div>
  );
}