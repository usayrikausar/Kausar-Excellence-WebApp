import { cn } from "@/lib/utils";
import { TRAFFIC_LIGHT_STYLES, type TrafficLightColor } from "@/lib/scoring";

/** The green/amber/red/black circle, reused wherever a traffic-light score is shown. */
export function TrafficLightDot({ color, size = "md", withLabel = false }: { color: TrafficLightColor; size?: "sm" | "md" | "lg"; withLabel?: boolean }) {
  const style = TRAFFIC_LIGHT_STYLES[color];
  const dimension = size === "lg" ? "h-6 w-6" : size === "sm" ? "h-3 w-3" : "h-4 w-4";
  return (
    <span className="inline-flex items-center gap-2">
      <span className={cn("inline-block shrink-0 rounded-full ring-2 ring-black/5", dimension, style.dotClassName)} aria-hidden />
      {withLabel && <span className="text-sm font-semibold text-ink">{style.label}</span>}
    </span>
  );
}
