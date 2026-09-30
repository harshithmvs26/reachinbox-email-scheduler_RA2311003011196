import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import Dashboard from './pages/Dashboard';
import api from './lib/api';

function App() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const handleLoginSuccess = async (credentialResponse: any) => {
    // Ideally we decode the JWT to get email/name or send to backend to verify
    // For simplicity without a library like jwt-decode, we assume backend does it or we mock here
    // A real app would decode the token to get email and name.
    
    // We'll mock the user info here for the assignment scope if jwt-decode isn't added
    // To do it properly, install jwt-decode. For now, let's simulate a call to backend with a fake email
    // since we can't easily parse the JWT payload without a lib here.
    
    // In a real scenario:
    const decoded: any = jwtDecode(credentialResponse.credential);
    const email = decoded.email;
    const name = decoded.name;

    try {
      const res = await api.post('/auth/login', { email, name });
      setUser(res.data);
      localStorage.setItem('user', JSON.stringify(res.data));
    } catch (error) {
      console.error('Login failed', error);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  return (
    <Router>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Header */}
        <header className="bg-white border-b px-6 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-indigo-600">ReachInbox</h1>
          {user ? (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                  {user.name ? user.name[0] : 'U'}
                </div>
                <span className="font-medium">{user.name || user.email}</span>
              </div>
              <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-700">Logout</button>
            </div>
          ) : null}
        </header>

        {/* Main Content */}
        <main className="flex-1 p-6">
          <Routes>
            <Route 
              path="/" 
              element={user ? <Navigate to="/dashboard" /> : (
                <div className="max-w-md mx-auto mt-20 p-6 bg-white rounded-lg shadow-sm border text-center">
                  <h2 className="text-xl font-semibold mb-6">Login to ReachInbox</h2>
                  <div className="flex justify-center">
                    <GoogleLogin
                      onSuccess={handleLoginSuccess}
                      onError={() => console.log('Login Failed')}
                    />
                  </div>
                </div>
              )} 
            />
            <Route 
              path="/dashboard" 
              element={user ? <Dashboard user={user} /> : <Navigate to="/" />} 
            />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
