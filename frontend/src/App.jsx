import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import CrepidDashboard from "./crepiddashboard";
import Login from "./Login";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

function PrivateRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" />;
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Toaster position="top-center" richColors />
        <Routes>
          <Route
            path="/"
            element={
              <PrivateRoute>
                <CrepidDashboard />
              </PrivateRoute>
            }
          />
          <Route path="/login" element={<Login />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
