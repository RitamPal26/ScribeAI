import { Card } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: number | string;
  subtitle: string;
  icon: LucideIcon;
  iconColor?: string;
}

export function StatsCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon,
  iconColor = 'text-primary bg-primary/10'
}: StatsCardProps) {
  return (
    <Card className="p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground mb-1">
            {title}
          </p>
          <h3 className="text-3xl font-bold">
            {value}
          </h3>
          <p className="text-sm text-muted-foreground mt-2">
            {subtitle}
          </p>
        </div>
        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${iconColor}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </Card>
  );
}
