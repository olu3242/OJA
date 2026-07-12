import { cn } from "@/lib/cn";
import { Card } from "./card";

/**
 * KPI tile — an uppercase label over a large value. `accent` renders the value
 * in orange for call-out metrics. Used by the admin and warehouse dashboards.
 */
export interface StatTileProps {
  label: string;
  value: string | number;
  accent?: boolean;
}

export function StatTile({ label, value, accent }: StatTileProps) {
  return (
    <Card padding="sm">
      <div className="text-xs font-bold tracking-wide text-oja-green-deep/60 uppercase">
        {label}
      </div>
      <div
        className={cn(
          "text-2xl font-extrabold",
          accent ? "text-oja-orange" : "text-oja-green-deep",
        )}
      >
        {value}
      </div>
    </Card>
  );
}
