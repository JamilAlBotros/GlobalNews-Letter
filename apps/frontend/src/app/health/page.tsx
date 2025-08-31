import { FeedHealthMonitor } from '@/components/health/feed-health-monitor';
import { SystemLogs } from '@/components/health/system-logs';

export default function HealthPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">System Health</h1>
      </div>
      
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <p className="text-gray-600">System health overview will be available once the API endpoints are implemented.</p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FeedHealthMonitor />
        <SystemLogs />
      </div>
    </div>
  );
}