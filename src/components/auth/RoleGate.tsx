import { useAuth } from "@/hooks/useAuth";

interface RoleGateProps {
  requiredRole: "admin" | "client";
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RoleGate({ requiredRole, children, fallback = null }: RoleGateProps) {
  const { profile } = useAuth();

  if (profile?.role !== requiredRole) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
