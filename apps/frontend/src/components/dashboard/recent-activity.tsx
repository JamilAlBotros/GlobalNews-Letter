'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Clock, Globe, FileText, Languages } from 'lucide-react';

export function RecentActivity() {
  // Mock recent activity data
  const mockActivity = [
    {
      id: '1',
      type: 'feed_fetch',
      icon: Globe,
      title: 'Reuters Finance feed processed',
      description: '15 new articles fetched successfully',
      timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      status: 'success',
    },
    {
      id: '2',
      type: 'translation',
      icon: Languages,
      title: 'Translation job completed',
      description: 'English → Spanish: "Tech Market Analysis"',
      timestamp: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
      status: 'success',
    },
    {
      id: '3',
      type: 'article_processing',
      icon: FileText,
      title: 'Article processing completed',
      description: '8 articles processed and categorized',
      timestamp: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
      status: 'success',
    },
    {
      id: '4',
      type: 'feed_fetch',
      icon: Globe,
      title: 'TechCrunch feed warning',
      description: 'Feed returned fewer articles than expected',
      timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
      status: 'warning',
    },
    {
      id: '5',
      type: 'translation',
      icon: Languages,
      title: 'Translation job queued',
      description: 'Portuguese → English: "Health Innovation Report"',
      timestamp: new Date(Date.now() - 32 * 60 * 1000).toISOString(),
      status: 'pending',
    },
    {
      id: '6',
      type: 'feed_fetch',
      icon: Globe,
      title: 'El País Health feed processed',
      description: '6 new articles fetched successfully',
      timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      status: 'success',
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'text-green-600 bg-green-100';
      case 'warning':
        return 'text-yellow-600 bg-yellow-100';
      case 'error':
        return 'text-red-600 bg-red-100';
      case 'pending':
        return 'text-blue-600 bg-blue-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const formatRelativeTime = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">Recent Activity</h3>
          <button className="text-sm text-primary-600 hover:text-primary-500">
            View all
          </button>
        </div>
      </div>
      
      <div className="divide-y divide-gray-200">
        {mockActivity.map((activity) => {
          const Icon = activity.icon;
          
          return (
            <div key={activity.id} className="px-6 py-4 hover:bg-gray-50">
              <div className="flex items-start space-x-4">
                <div className={`p-2 rounded-lg ${getStatusColor(activity.status)}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900">
                      {activity.title}
                    </p>
                    <div className="flex items-center space-x-2">
                      <Clock className="h-3 w-3 text-gray-400" />
                      <p className="text-xs text-gray-500">
                        {formatRelativeTime(activity.timestamp)}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {activity.description}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
        <div className="flex items-center justify-center">
          <button className="text-sm text-primary-600 hover:text-primary-500 font-medium">
            Load more activity
          </button>
        </div>
      </div>
    </div>
  );
}