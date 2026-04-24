import { Clock, Coffee, LogOut } from 'lucide-react';

interface AttendanceStatusBadgeProps {
  status: 'online' | 'on_break' | 'offline';
  size?: 'sm' | 'md' | 'lg';
}

export default function AttendanceStatusBadge({ status, size = 'md' }: AttendanceStatusBadgeProps) {
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  const config = {
    online: {
      icon: Clock,
      label: 'Working',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/30',
      textColor: 'text-emerald-300',
    },
    on_break: {
      icon: Coffee,
      label: 'On Break',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/30',
      textColor: 'text-amber-300',
    },
    offline: {
      icon: LogOut,
      label: 'Not Clocked In',
      bgColor: 'bg-slate-500/10',
      borderColor: 'border-slate-500/30',
      textColor: 'text-slate-300',
    },
  };

  const { icon: Icon, label, bgColor, borderColor, textColor } = config[status];

  return (
    <div className={`inline-flex items-center gap-2 rounded-full border ${bgColor} ${borderColor} ${textColor} ${sizeClasses[size]}`}>
      <Icon className="w-4 h-4" />
      <span className="font-medium">{label}</span>
    </div>
  );
}
