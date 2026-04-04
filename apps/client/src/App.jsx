import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./store/auth.store";
import Landing from "./pages/Landing";
import Register from "./pages/Register";
import Login from "./pages/Login";
import Preferences from "./pages/Preferences";
import Match from "./pages/Match";
import Call from "./pages/Call";
import Chat from "./pages/Chat";
import Ended from "./pages/Ended";
import Profile from "./pages/Profile";

const Guard = ({ children }) => {
  const { accessToken } = useAuthStore();
  return accessToken ? children : <Navigate to="/login" replace />;
};

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/"                  element={<Landing />} />
        <Route path="/register"          element={<Register />} />
        <Route path="/login"             element={<Login />} />
        <Route path="/preferences"       element={<Guard><Preferences /></Guard>} />
        <Route path="/match"             element={<Guard><Match /></Guard>} />
        <Route path="/call/:sessionId"   element={<Guard><Call /></Guard>} />
        <Route path="/chat/:sessionId"   element={<Guard><Chat /></Guard>} />
        <Route path="/ended"             element={<Guard><Ended /></Guard>} />
        <Route path="/profile"            element={<Guard><Profile /></Guard>} />
        <Route path="*"                  element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
