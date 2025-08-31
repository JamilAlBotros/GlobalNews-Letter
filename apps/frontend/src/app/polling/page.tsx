import { PollingDashboard } from '@/components/polling/polling-dashboard';
import { PollingControls } from '@/components/polling/polling-controls';
import { ActiveFeedsMonitor } from '@/components/polling/active-feeds-monitor';

export default function PollingPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">RSS Polling System</h1>
      </div>
      
      <PollingControls />
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ActiveFeedsMonitor />
        </div>
        <div>
          <PollingDashboard />
        </div>
      </div>
    </div>
  );
}