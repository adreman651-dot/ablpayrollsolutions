import { Navigate } from "react-router-dom";

// Root index just goes to the landing page
export default function Index() {
  return <Navigate to="/" replace />;
}
