import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { ComplianceLineage } from "@/pages/ComplianceLineage";
import { CrossFunctionalTasks } from "@/pages/CrossFunctionalTasks";
import { Dashboard } from "@/pages/Dashboard";
import { HndlAnalysis } from "@/pages/HndlAnalysis";
import { IntakeReport } from "@/pages/IntakeReport";
import { PqcIntake } from "@/pages/PqcIntake";
import { Settings } from "@/pages/Settings";
import { VendorReadiness } from "@/pages/VendorReadiness";
import { ExecutiveStoryboard } from "@/pages/ExecutiveStoryboard";
import "@/index.css";

const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: "pqc-intake", element: <PqcIntake /> },
      { path: "hndl", element: <HndlAnalysis /> },
      { path: "vendors", element: <VendorReadiness /> },
      { path: "tasks", element: <CrossFunctionalTasks /> },
      { path: "lineage", element: <ComplianceLineage /> },
      { path: "report", element: <IntakeReport /> },
      { path: "settings", element: <Settings /> },
      { path: "storyboard", element: <ExecutiveStoryboard /> },
    ]
  }
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
