import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import Dashboard from "./pages/Dashboard";
import Inbox from "./pages/Inbox";
import CRM from "./pages/CRM";
import Agents from "./pages/Agents";
import Campaigns from "./pages/Campaigns";
import Marketplace from "./pages/Marketplace";
import AgentDetail from "./pages/AgentDetail";
import Analytics from "./pages/Analytics";
import Plans from "./pages/Plans";
import AppLayout from "./components/AppLayout";
import AuthPage from "./pages/AuthPage";
import Contacts from "./pages/Contacts";
import Tickets from "./pages/Tickets";
import Ombudsman from "./pages/Ombudsman";
import Automations from "./pages/Automations";
import Connections from "./pages/Connections";
import CalendarPage from "./pages/Calendar";
import SuperAdminLayout from "./pages/superadmin/SuperAdminLayout";
import SuperAdminDashboard from "./pages/superadmin/SuperAdminDashboard";
import SuperAdminTenants from "./pages/superadmin/SuperAdminTenants";
import SuperAdminPlans from "./pages/superadmin/SuperAdminPlans";
import SuperAdminUsers from "./pages/superadmin/SuperAdminUsers";
import SuperAdminWhitelabel from "./pages/superadmin/SuperAdminWhitelabel";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth" element={<AuthPage />} />

        {/* Super Admin Routes */}
        <Route path="/superadmin" element={<SuperAdminLayout />}>
          <Route index element={<SuperAdminDashboard />} />
          <Route path="tenants" element={<SuperAdminTenants />} />
          <Route path="plans" element={<SuperAdminPlans />} />
          <Route path="users" element={<SuperAdminUsers />} />
          <Route path="whitelabel" element={<SuperAdminWhitelabel />} />
        </Route>

        {/* App Protected Routes */}
        <Route path="/app" element={<AppLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="inbox" element={<Inbox />} />
          <Route path="connections" element={<Connections />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="contacts" element={<Contacts />} />
          <Route path="crm" element={<CRM />} />
          <Route path="tickets" element={<Tickets />} />
          <Route path="ombudsman" element={<Ombudsman />} />
          <Route path="agents" element={<Agents />} />
          <Route path="agents/:id" element={<AgentDetail />} />
          <Route path="automations" element={<Automations />} />
          <Route path="marketplace" element={<Marketplace />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="plans" element={<Plans />} />
          <Route path="campaigns" element={<Campaigns />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
