import { DatabaseManagement } from '@/components/database/database-management';

export default function DatabasePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Database Management</h1>
      </div>
      
      <DatabaseManagement />
    </div>
  );
}