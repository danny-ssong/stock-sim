import { Suspense } from 'react';
import { TabsNav } from '../../components/tabs-nav';

export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <Suspense fallback={<div className="h-[57px] border-b" />}>
        <TabsNav />
      </Suspense>
      <div className="flex flex-1">{children}</div>
    </div>
  );
}
