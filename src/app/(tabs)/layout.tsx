import { TabsNav } from '../../components/tabs-nav';

export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <TabsNav />
      <div className="flex flex-1">{children}</div>
    </div>
  );
}
