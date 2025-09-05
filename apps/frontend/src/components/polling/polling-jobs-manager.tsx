'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { PollingJobType } from '@/lib/api';
import { 
  Plus, 
  Play, 
  Pause, 
  Settings, 
  Trash2, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Loader2,
  Calendar,
  Filter,
  Eye
} from 'lucide-react';

interface CreatePollingJobModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function CreatePollingJobModal({ isOpen, onClose, onSuccess }: CreatePollingJobModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    interval_minutes: 60,
    is_active: true,
    feed_filters: {
      feed_ids: [] as string[],
      categories: [] as string[],
      languages: [] as string[],
      regions: [] as string[],
      types: [] as string[]
    }
  });

  const { data: feeds } = useQuery({
    queryKey: ['feeds'],
    queryFn: () => apiClient.getFeeds(),
  });

  const createJobMutation = useMutation({
    mutationFn: (data: typeof formData) => apiClient.createPollingJob(data),
    onSuccess: () => {
      onSuccess();
      onClose();
      setFormData({
        name: '',
        description: '',
        interval_minutes: 60,
        is_active: true,
        feed_filters: {
          feed_ids: [],
          categories: [],
          languages: [],
          regions: [],
          types: []
        }
      });
    },
  });

  if (!isOpen) return null;

  const categories = ['News', 'Technology', 'Finance', 'Science', 'Sports', 'Entertainment', 'Health', 'Travel', 'Education', 'Business', 'Politics', 'Gaming', 'Crypto', 'Lifestyle'];
  const languages = ['English', 'Spanish', 'Arabic', 'Portuguese', 'French', 'Chinese', 'Japanese'];
  const types = ['News', 'Analysis', 'Blog', 'Tutorial', 'Recipe', 'Review', 'Research'];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Create Polling Job</h3>
        </div>

        <div className="p-6 space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Job Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="e.g., Tech News - Hourly"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="Optional description..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Polling Interval (minutes)</label>
              <input
                type="number"
                min="1"
                max="1440"
                value={formData.interval_minutes}
                onChange={(e) => setFormData({ ...formData, interval_minutes: parseInt(e.target.value) || 60 })}
                className="mt-1 block w-32 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Feed Filters */}
          <div className="space-y-4">
            <h4 className="text-md font-medium text-gray-900">Feed Filters</h4>

            {/* Categories */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Categories</label>
              <div className="grid grid-cols-3 gap-2">
                {categories.map((category) => (
                  <label key={category} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.feed_filters.categories.includes(category)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({
                            ...formData,
                            feed_filters: {
                              ...formData.feed_filters,
                              categories: [...formData.feed_filters.categories, category]
                            }
                          });
                        } else {
                          setFormData({
                            ...formData,
                            feed_filters: {
                              ...formData.feed_filters,
                              categories: formData.feed_filters.categories.filter(c => c !== category)
                            }
                          });
                        }
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">{category}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Languages */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Languages</label>
              <div className="grid grid-cols-3 gap-2">
                {languages.map((language) => (
                  <label key={language} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.feed_filters.languages.includes(language)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({
                            ...formData,
                            feed_filters: {
                              ...formData.feed_filters,
                              languages: [...formData.feed_filters.languages, language]
                            }
                          });
                        } else {
                          setFormData({
                            ...formData,
                            feed_filters: {
                              ...formData.feed_filters,
                              languages: formData.feed_filters.languages.filter(l => l !== language)
                            }
                          });
                        }
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">{language}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-700">Start job immediately</span>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => createJobMutation.mutate(formData)}
            disabled={createJobMutation.isPending || !formData.name}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {createJobMutation.isPending ? 'Creating...' : 'Create Job'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function PollingJobsManager() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState<PollingJobType | null>(null);
  const queryClient = useQueryClient();

  const { data: jobs, isLoading } = useQuery({
    queryKey: ['polling-jobs'],
    queryFn: () => apiClient.getPollingJobs(),
    refetchInterval: 10000,
  });

  const executeJobMutation = useMutation({
    mutationFn: (jobId: string) => apiClient.executePollingJob(jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['polling-jobs'] });
    },
  });

  const deleteJobMutation = useMutation({
    mutationFn: (jobId: string) => apiClient.deletePollingJob(jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['polling-jobs'] });
    },
  });

  const formatInterval = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const formatLastRun = (timestamp: string | null) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const hours = Math.floor(diffMinutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Polling Jobs</h3>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Job
            </button>
          </div>
        </div>

        <div className="p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : jobs && jobs.length > 0 ? (
            <div className="space-y-4">
              {jobs.map((job) => (
                <div key={job.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="text-md font-medium text-gray-900">{job.name}</h4>
                      {job.description && (
                        <p className="text-sm text-gray-600 mt-1">{job.description}</p>
                      )}
                    </div>
                    <div className="flex items-center space-x-1">
                      <div className={`h-2 w-2 rounded-full ${
                        job.is_active ? 'bg-green-500' : 'bg-gray-400'
                      }`} />
                      <span className={`text-sm font-medium ${
                        job.is_active ? 'text-green-600' : 'text-gray-500'
                      }`}>
                        {job.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <div className="flex items-center text-sm text-gray-600">
                      <Clock className="h-4 w-4 mr-2" />
                      {formatInterval(job.interval_minutes)} interval
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <Calendar className="h-4 w-4 mr-2" />
                      Last: {formatLastRun(job.last_run_time)}
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <Filter className="h-4 w-4 mr-2" />
                      {job.feed_filters.categories?.length || 0} filters
                    </div>
                    <div className="flex items-center text-sm">
                      {job.total_runs > 0 && job.failed_runs === 0 ? (
                        <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                      ) : job.total_runs > 0 ? (
                        <XCircle className="h-4 w-4 text-red-500 mr-2" />
                      ) : (
                        <Clock className="h-4 w-4 text-gray-400 mr-2" />
                      )}
                      <span className={
                        job.total_runs > 0 && job.failed_runs === 0 
                          ? 'text-green-600' 
                          : job.total_runs > 0 
                            ? 'text-red-600' 
                            : 'text-gray-500'
                      }>
                        {job.total_runs > 0 && job.failed_runs === 0 
                          ? 'Success' 
                          : job.total_runs > 0 
                            ? 'Failed' 
                            : 'Never run'
                        }
                      </span>
                    </div>
                  </div>

                  {job.last_run_stats && (
                    <div className="bg-gray-50 rounded p-3 mb-3">
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Feeds:</span>
                          <span className="ml-1 font-medium">{job.last_run_stats.feeds_processed}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Articles:</span>
                          <span className="ml-1 font-medium">{job.last_run_stats.articles_found}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Time:</span>
                          <span className="ml-1 font-medium">
                            {Math.round(job.last_run_stats.execution_time_ms)}ms
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-end space-x-3">
                    <button
                      onClick={() => setSelectedJob(job)}
                      className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Details
                    </button>
                    <button
                      onClick={() => executeJobMutation.mutate(job.id)}
                      disabled={executeJobMutation.isPending}
                      className="inline-flex items-center px-3 py-1 border border-green-300 rounded text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 disabled:opacity-50"
                    >
                      {executeJobMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : (
                        <Play className="h-3 w-3 mr-1" />
                      )}
                      Run Now
                    </button>
                    <button
                      onClick={() => deleteJobMutation.mutate(job.id)}
                      disabled={deleteJobMutation.isPending}
                      className="inline-flex items-center px-3 py-1 border border-red-300 rounded text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-50"
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Settings className="h-6 w-6 text-gray-400" />
              </div>
              <h3 className="text-sm font-medium text-gray-900 mb-2">No polling jobs</h3>
              <p className="text-sm text-gray-600 mb-4">
                Create your first polling job to schedule automatic RSS polling with custom filters.
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Polling Job
              </button>
            </div>
          )}
        </div>
      </div>

      <CreatePollingJobModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['polling-jobs'] })}
      />

      {selectedJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Job Details</h3>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Name</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedJob.name}</p>
                </div>
                {selectedJob.description && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Description</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedJob.description}</p>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700">Filters</label>
                  <div className="mt-1 space-y-2">
                    {selectedJob.feed_filters.categories && selectedJob.feed_filters.categories.length > 0 && (
                      <p className="text-sm text-gray-900">
                        <span className="font-medium">Categories:</span> {selectedJob.feed_filters.categories.join(', ')}
                      </p>
                    )}
                    {selectedJob.feed_filters.languages && selectedJob.feed_filters.languages.length > 0 && (
                      <p className="text-sm text-gray-900">
                        <span className="font-medium">Languages:</span> {selectedJob.feed_filters.languages.join(', ')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setSelectedJob(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}