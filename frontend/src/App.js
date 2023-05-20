import "./App.css";
import { Routes, Route } from "react-router-dom";
import Dashboard from "./components/dashboard/dashboard";
import Template from "./components/templates/templates";
import NotFound from "./components/notfound";
import Accounts from "./components/accounts";
import Profile from "./components/profile";
import Login from "./components/authentication/login";
import Navbar from "./components/navbar";
import GlobalProvider from "./context/GlobalContext";
import Register from "./components/authentication/register";
import ToastProvider from "./context/ToastContext";
import ConfirmProvider from "./context/ConfirmContext";

function App() {
  return (
    <GlobalProvider>
      <ConfirmProvider>
        <ToastProvider>
          <Navbar />
          <Routes>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/templates" element={<Template />} />
            <Route path="/" element={<Dashboard />} />
            <Route path="/accounts" element={<Accounts />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="" element={<Register />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </ToastProvider>
      </ConfirmProvider>
    </GlobalProvider>
  );
}

export default App;
