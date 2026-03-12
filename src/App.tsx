import { Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import Dashboard from "@/pages/Dashboard";

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-muted-foreground mt-2">Coming soon</p>
      </div>
    </div>
  );
}

function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      {/* Protected routes with layout */}
      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/jobs" element={<PlaceholderPage title="Jobs" />} />
        <Route path="/jobs/new" element={<PlaceholderPage title="New Job" />} />
        <Route path="/jobs/:id" element={<PlaceholderPage title="Job Detail" />} />
        <Route path="/clients" element={<PlaceholderPage title="Clients" />} />
        <Route path="/clients/:id" element={<PlaceholderPage title="Client Detail" />} />
        <Route path="/estimates/:jobId" element={<PlaceholderPage title="Estimate Builder" />} />
        <Route path="/estimates" element={<PlaceholderPage title="Estimates" />} />
        <Route path="/settings" element={<PlaceholderPage title="Settings" />} />
        <Route path="/ai/logo" element={<PlaceholderPage title="AI Logo Regeneration" />} />
      </Route>
    </Routes>
  );
}

export default App;
