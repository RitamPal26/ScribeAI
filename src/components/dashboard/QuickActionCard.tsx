import { Card } from '@/components/ui/card';
import { ArrowRight, LucideIcon } from 'lucide-react';

interface QuickActionCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  iconColor?: string;
  onClick: () => void;
}

export function QuickActionCard({ 
  title, 
  description, 
  icon: Icon,
  iconColor = 'text-primary bg-primary/10',
  onClick 
}: QuickActionCardProps) {
  return (
    <Card 
      className="p-6 cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02]"
      onClick={onClick}
    >
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${iconColor}`}>
          <Icon className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-lg mb-1">
            {title}
          </h3>
          <p className="text-sm text-muted-foreground">
            {description}
          </p>
        </div>
        <ArrowRight className="w-5 h-5 text-muted-foreground" />
      </div>
    </Card>
  );
}
