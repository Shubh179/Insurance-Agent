import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import ChatInterface from './components/ChatInterface';
import BrandingPage from './components/BrandingPage';
import DemoPage from './components/DemoPage';

function AuthHandler() {
  const navigate = useNavigate();

  useEffect(() => {
    // Check for token in URL (Login flow)
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (token) {
      localStorage.setItem('session_token', token);
      // Remove query param
      window.history.replaceState({}, document.title, window.location.pathname);
      // Redirect to chat
      navigate('/chat');
    }
  }, [navigate]);

  return null;
}

function ProtectedRoute({ children }) {
  const token = localStorage.getItem('session_token');
  if (!token) {
    return <Navigate to="/" replace />;
  }
  return children;
}

function App() {
  return (
    <BrowserRouter>
      <AuthHandler />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/branding" element={<BrandingPage />} />
        <Route path="/demo" element={<DemoPage />} />
        <Route path="/chat" element={
          <ProtectedRoute>
            <ChatInterface />
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
