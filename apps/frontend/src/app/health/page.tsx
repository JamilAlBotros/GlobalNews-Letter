import { SystemHealthOverview } from '@/components/dashboard/system-health-overview';
import { FeedHealthMonitor } from '@/components/health/feed-health-monitor';
import { SystemLogs } from '@/components/health/system-logs';

export default function HealthPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">System Health</h1>
      </div>
      
      <SystemHealthOverview />
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FeedHealthMonitor />
        <SystemLogs />
      </div>
    </div>
  );
}