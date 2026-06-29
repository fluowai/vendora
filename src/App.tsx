import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import AppLayout from "./components/AppLayout";

const LandingPage = lazy(() => import("./pages/LandingPage"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Inbox = lazy(() => import("./pages/Inbox"));
const CRM = lazy(() => import("./pages/CRM"));
const Agents = lazy(() => import("./pages/Agents"));
const Campaigns = lazy(() => import("./pages/Campaigns"));
const Marketplace = lazy(() => import("./pages/Marketplace"));
const AgentDetail = lazy(() => import("./pages/AgentDetail"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Plans = lazy(() => import("./pages/Plans"));
const Contacts = lazy(() => import("./pages/Contacts"));
const Tickets = lazy(() => import("./pages/Tickets"));
const Ombudsman = lazy(() => import("./pages/Ombudsman"));
const Automations = lazy(() => import("./pages/Automations"));
const Connections = lazy(() => import("./pages/Connections"));
const CalendarPage = lazy(() => import("./pages/Calendar"));
const SuperAdminLayout = lazy(() => import("./pages/superadmin/SuperAdminLayout"));
const SuperAdminDashboard = lazy(() => import("./pages/superadmin/SuperAdminDashboard"));
const SuperAdminTenants = lazy(() => import("./pages/superadmin/SuperAdminTenants"));
const SuperAdminPlans = lazy(() => import("./pages/superadmin/SuperAdminPlans"));
const SuperAdminUsers = lazy(() => import("./pages/superadmin/SuperAdminUsers"));
const SuperAdminWhitelabel = lazy(() => import("./pages/superadmin/SuperAdminWhitelabel"));

function PageLoader() {
  return (
    <div className="h-full flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Suspense fallback={<PageLoader />}><LandingPage /></Suspense>} />
        <Route path="/auth" element={<Suspense fallback={<PageLoader />}><AuthPage /></Suspense>} />

        {/* Super Admin Routes */}
        <Route path="/superadmin" element={<Suspense fallback={<PageLoader />}><SuperAdminLayout /></Suspense>}>
          <Route index element={<Suspense fallback={<PageLoader />}><SuperAdminDashboard /></Suspense>} />
          <Route path="tenants" element={<Suspense fallback={<PageLoader />}><SuperAdminTenants /></Suspense>} />
          <Route path="plans" element={<Suspense fallback={<PageLoader />}><SuperAdminPlans /></Suspense>} />
          <Route path="users" element={<Suspense fallback={<PageLoader />}><SuperAdminUsers /></Suspense>} />
          <Route path="whitelabel" element={<Suspense fallback={<PageLoader />}><SuperAdminWhitelabel /></Suspense>} />
        </Route>

        {/* App Protected Routes */}
        <Route path="/app" element={<AppLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<Suspense fallback={<PageLoader />}><Dashboard /></Suspense>} />
          <Route path="inbox" element={<Suspense fallback={<PageLoader />}><Inbox /></Suspense>} />
          <Route path="connections" element={<Suspense fallback={<PageLoader />}><Connections /></Suspense>} />
          <Route path="calendar" element={<Suspense fallback={<PageLoader />}><CalendarPage /></Suspense>} />
          <Route path="contacts" element={<Suspense fallback={<PageLoader />}><Contacts /></Suspense>} />
          <Route path="crm" element={<Suspense fallback={<PageLoader />}><CRM /></Suspense>} />
          <Route path="tickets" element={<Suspense fallback={<PageLoader />}><Tickets /></Suspense>} />
          <Route path="ombudsman" element={<Suspense fallback={<PageLoader />}><Ombudsman /></Suspense>} />
          <Route path="agents" element={<Suspense fallback={<PageLoader />}><Agents /></Suspense>} />
          <Route path="agents/:id" element={<Suspense fallback={<PageLoader />}><AgentDetail /></Suspense>} />
          <Route path="automations" element={<Suspense fallback={<PageLoader />}><Automations /></Suspense>} />
          <Route path="marketplace" element={<Suspense fallback={<PageLoader />}><Marketplace /></Suspense>} />
          <Route path="analytics" element={<Suspense fallback={<PageLoader />}><Analytics /></Suspense>} />
          <Route path="plans" element={<Suspense fallback={<PageLoader />}><Plans /></Suspense>} />
          <Route path="campaigns" element={<Suspense fallback={<PageLoader />}><Campaigns /></Suspense>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
