import { type ReactNode } from "react";
import { Card } from "@/components/ui/card";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      {actions && <div className="flex gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

export function KpiCard({ title, value, icon: Icon, hint, trend, color = "primary" }: {
  title: string; value: string | number; icon?: React.ComponentType<{ className?: string }>;
  hint?: string; trend?: string; color?: "primary" | "success" | "warning" | "destructive" | "info";
}) {
  const colorMap = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    destructive: "bg-destructive/10 text-destructive",
    info: "bg-info/10 text-info",
  };
  return (
    <Card className="p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground mb-1">{title}</div>
          <div className="text-2xl font-bold text-foreground truncate">{value}</div>
          {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
          {trend && <div className="text-xs text-success mt-1">{trend}</div>}
        </div>
        {Icon && (
          <div className={`p-2.5 rounded-lg ${colorMap[color]} shrink-0`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
    </Card>
  );
}
