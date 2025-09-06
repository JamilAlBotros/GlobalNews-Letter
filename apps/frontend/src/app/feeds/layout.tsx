'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { name: 'Feed Sources', href: '/feeds/sources', current: false },
  { name: 'Google RSS', href: '/feeds/google-rss', current: false },
  { name: 'Feed Instances', href: '/feeds/instances', current: false }
];

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

export default function FeedsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const updatedTabs = tabs.map(tab => ({
    ...tab,
    current: pathname === tab.href
  }));

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {updatedTabs.map((tab) => (
            <Link
              key={tab.name}
              href={tab.href}
              className={classNames(
                tab.current
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700',
                'whitespace-nowrap border-b-2 py-2 px-1 text-sm font-medium'
              )}
            >
              {tab.name}
            </Link>
          ))}
        </nav>
      </div>
      
      <div>{children}</div>
    </div>
  );
}