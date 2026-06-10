import { Badge } from "@/components/ui/badge";
import { systemStatusLabel } from "@/lib/labels";

type SystemStatus = keyof typeof systemStatusLabel;

interface StatusBadgeProps {
  status: SystemStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const variant =
    status === "completed" ? "success" :
    status === "security_review" || status === "procurement_followup" ? "warning" :
    "secondary";
  return (
    <Badge variant={variant} className={className}>
      {systemStatusLabel[status]}
    </Badge>
  );
}
