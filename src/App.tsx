import { Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <h1 className="text-2xl font-bold">{title}</h1>
    </div>
  );
}

function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      {/* Protected routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <PlaceholderPage title="Dashboard" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/jobs"
        element={
          <ProtectedRoute>
            <PlaceholderPage title="Jobs" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/jobs/new"
        element={
          <ProtectedRoute>
            <PlaceholderPage title="New Job" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/jobs/:id"
        element={
          <ProtectedRoute>
            <PlaceholderPage title="Job Detail" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/clients"
        element={
          <ProtectedRoute>
            <PlaceholderPage title="Clients" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/clients/:id"
        element={
          <ProtectedRoute>
            <PlaceholderPage title="Client Detail" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/estimates/:jobId"
        element={
          <ProtectedRoute>
            <PlaceholderPage title="Estimate Builder" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <PlaceholderPage title="Settings" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/ai/logo"
        element={
          <ProtectedRoute>
            <PlaceholderPage title="AI Logo Regeneration" />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;
