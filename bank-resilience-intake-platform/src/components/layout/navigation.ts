import {
  BarChart3,
  ClipboardList,
  DatabaseZap,
  FileText,
  GitBranch,
  Lightbulb,
  Settings,
  ShieldCheck,
  Users
} from "lucide-react";

export const navigation = [
  { title: "Executive Storyboard", path: "/storyboard", icon: Lightbulb },
  { title: "Dashboard", path: "/", icon: BarChart3 },
  { title: "PQC Intake", path: "/pqc-intake", icon: ClipboardList },
  { title: "HNDL Analysis", path: "/hndl", icon: DatabaseZap },
  { title: "Vendor Readiness", path: "/vendors", icon: ShieldCheck },
  { title: "Cross-functional Tasks", path: "/tasks", icon: Users },
  { title: "Compliance Lineage", path: "/lineage", icon: GitBranch },
  { title: "Evidence Pack", path: "/report", icon: FileText },
  { title: "Settings", path: "/settings", icon: Settings },
];
