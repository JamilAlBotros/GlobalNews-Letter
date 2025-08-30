import { TranslationJobsList } from '@/components/translations/translation-jobs-list';

export default function TranslationsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Translation System</h1>
      </div>
      
      <div className="grid grid-cols-1 gap-6">
        <TranslationJobsList />
      </div>
    </div>
  );
}