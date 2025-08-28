'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { X } from 'lucide-react';
import { apiClient } from '@/lib/api';

const createFeedSourceSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  base_url: z.string().url('Must be a valid URL'),
  provider_type: z.enum(['rss', 'google_rss', 'api', 'scraper']),
  source_language: z.enum(['en', 'es', 'ar', 'pt', 'fr', 'zh', 'ja']),
  primary_region: z.string().optional(),
  content_category: z.enum(['finance', 'tech', 'health', 'general']),
  content_type: z.enum(['breaking', 'analysis', 'daily', 'weekly']),
  quality_score: z.number().min(0).max(1).default(0.5),
});

type CreateFeedSourceData = z.infer<typeof createFeedSourceSchema>;

interface CreateFeedSourceDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateFeedSourceDialog({ isOpen, onClose }: CreateFeedSourceDialogProps) {
  const queryClient = useQueryClient();
  
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateFeedSourceData>({
    resolver: zodResolver(createFeedSourceSchema),
    defaultValues: {
      provider_type: 'rss',
      source_language: 'en',
      content_category: 'general',
      content_type: 'daily',
      quality_score: 0.5,
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateFeedSourceData) => {
      const feedSourceData = {
        ...data,
        id: `${data.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
        is_active: true,
      };
      return apiClient.createFeedSource(feedSourceData, crypto.randomUUID());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed-sources'] });
      reset();
      onClose();
    },
  });

  const onSubmit = (data: CreateFeedSourceData) => {
    createMutation.mutate(data);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Create Feed Source</h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Name *
              </label>
              <input
                type="text"
                {...register('name')}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                placeholder="Reuters Finance"
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Base URL *
              </label>
              <input
                type="url"
                {...register('base_url')}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                placeholder="https://reuters.com"
              />
              {errors.base_url && (
                <p className="mt-1 text-sm text-red-600">{errors.base_url.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Provider Type *
              </label>
              <select
                {...register('provider_type')}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              >
                <option value="rss">RSS Feed</option>
                <option value="google_rss">Google RSS</option>
                <option value="api">API</option>
                <option value="scraper">Web Scraper</option>
              </select>
              {errors.provider_type && (
                <p className="mt-1 text-sm text-red-600">{errors.provider_type.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Source Language *
              </label>
              <select
                {...register('source_language')}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              >
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="pt">Portuguese</option>
                <option value="fr">French</option>
                <option value="ar">Arabic</option>
                <option value="zh">Chinese</option>
                <option value="ja">Japanese</option>
              </select>
              {errors.source_language && (
                <p className="mt-1 text-sm text-red-600">{errors.source_language.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Primary Region
              </label>
              <input
                type="text"
                {...register('primary_region')}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                placeholder="us, eu, es, etc."
                maxLength={10}
              />
              {errors.primary_region && (
                <p className="mt-1 text-sm text-red-600">{errors.primary_region.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Content Category *
              </label>
              <select
                {...register('content_category')}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              >
                <option value="general">General News</option>
                <option value="finance">Finance</option>
                <option value="tech">Technology</option>
                <option value="health">Health</option>
              </select>
              {errors.content_category && (
                <p className="mt-1 text-sm text-red-600">{errors.content_category.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Content Type *
              </label>
              <select
                {...register('content_type')}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              >
                <option value="daily">Daily News</option>
                <option value="breaking">Breaking News</option>
                <option value="analysis">Analysis</option>
                <option value="weekly">Weekly Summary</option>
              </select>
              {errors.content_type && (
                <p className="mt-1 text-sm text-red-600">{errors.content_type.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Quality Score (0-1)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="1"
                {...register('quality_score', { valueAsNumber: true })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              />
              {errors.quality_score && (
                <p className="mt-1 text-sm text-red-600">{errors.quality_score.message}</p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-md shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createMutation.isPending ? 'Creating...' : 'Create Source'}
            </button>
          </div>
        </form>

        {createMutation.error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">
              Failed to create feed source: {(createMutation.error as Error).message}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}