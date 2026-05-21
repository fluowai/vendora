/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import Dashboard from "./pages/Dashboard";
import Inbox from "./pages/Inbox";
import CRM from "./pages/CRM";
import Agents from "./pages/Agents";
import Campaigns from "./pages/Campaigns";
import AppLayout from "./components/AppLayout";
import AuthPage from "./pages/AuthPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth" element={<AuthPage />} />
        
        {/* App Protected Routes */}
        <Route path="/app" element={<AppLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="inbox" element={<Inbox />} />
          <Route path="crm" element={<CRM />} />
          <Route path="agents" element={<Agents />} />
          <Route path="campaigns" element={<Campaigns />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

