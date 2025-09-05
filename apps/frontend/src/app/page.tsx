import { StatsOverview } from '@/components/dashboard/stats-overview';
import { PollingStatus } from '@/components/dashboard/polling-status';
import { RecentActivity } from '@/components/dashboard/recent-activity';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <div className="text-sm text-gray-500">
          Real-time overview of your news aggregation system
        </div>
      </div>
      
      {/* Statistics Overview */}
      <StatsOverview />
      
      {/* Polling Status */}
      <PollingStatus />
      
      {/* Recent Activity */}
      <RecentActivity />
    </div>
  );
}