import { TranslationJobsList } from '@/components/translations/translation-jobs-list';
import { TranslationMetrics } from '@/components/dashboard/translation-metrics';

export default function TranslationsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Translation System</h1>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <TranslationJobsList />
        </div>
        <div>
          <TranslationMetrics />
        </div>
      </div>
    </div>
  );
}