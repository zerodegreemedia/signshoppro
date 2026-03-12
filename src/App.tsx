import { Routes, Route } from "react-router-dom";

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
      <Route path="/" element={<PlaceholderPage title="Dashboard" />} />
      <Route path="/login" element={<PlaceholderPage title="Login" />} />
      <Route path="/jobs" element={<PlaceholderPage title="Jobs" />} />
      <Route path="/jobs/new" element={<PlaceholderPage title="New Job" />} />
      <Route path="/jobs/:id" element={<PlaceholderPage title="Job Detail" />} />
      <Route path="/clients" element={<PlaceholderPage title="Clients" />} />
      <Route
        path="/clients/:id"
        element={<PlaceholderPage title="Client Detail" />}
      />
      <Route
        path="/estimates/:jobId"
        element={<PlaceholderPage title="Estimate Builder" />}
      />
      <Route path="/settings" element={<PlaceholderPage title="Settings" />} />
      <Route
        path="/ai/logo"
        element={<PlaceholderPage title="AI Logo Regeneration" />}
      />
    </Routes>
  );
}

export default App;
