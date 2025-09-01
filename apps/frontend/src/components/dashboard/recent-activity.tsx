'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Clock, Globe, FileText, Languages } from 'lucide-react';

export function RecentActivity() {

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
        <div className="px-6 py-8 text-center">
          <div className="text-gray-500">
            <FileText className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No recent activity</h3>
            <p className="mt-1 text-sm text-gray-500">Activity will appear here once the system is in use.</p>
          </div>
        </div>
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