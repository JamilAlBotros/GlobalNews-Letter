import { SystemHealthOverview } from '@/components/dashboard/system-health-overview';
import { FeedMetrics } from '@/components/dashboard/feed-metrics';
import { TranslationMetrics } from '@/components/dashboard/translation-metrics';
import { RecentActivity } from '@/components/dashboard/recent-activity';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
      </div>
      
      <SystemHealthOverview />
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FeedMetrics />
        <TranslationMetrics />
      </div>
      
      <RecentActivity />
    </div>
  );
}