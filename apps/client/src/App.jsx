import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./store/auth.store";
import Landing from "./pages/Landing";
import Match from "./pages/Match";
import Call from "./pages/Call";
import Chat from "./pages/Chat";
import Ended from "./pages/Ended";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Safety from "./pages/Safety";
import Contact from "./pages/Contact";

const Guard = ({ children }) => {
  const { accessToken } = useAuthStore();
  return accessToken ? children : <Navigate to="/" replace />;
};

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/"                  element={<Landing />} />
        <Route path="/match"             element={<Guard><Match /></Guard>} />
        <Route path="/call/:sessionId"   element={<Guard><Call /></Guard>} />
        <Route path="/chat/:sessionId"   element={<Guard><Chat /></Guard>} />
        <Route path="/ended"             element={<Guard><Ended /></Guard>} />
        <Route path="/terms"             element={<Terms />} />
        <Route path="/privacy"           element={<Privacy />} />
        <Route path="/safety"            element={<Safety />} />
        <Route path="/contact"           element={<Contact />} />
        <Route path="*"                  element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
