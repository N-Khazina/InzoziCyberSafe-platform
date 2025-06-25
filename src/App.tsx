import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './components/auth/LoginPage';
import RegisterPage from './components/auth/RegisterPage';
import AdminDashboard from './components/dashboards/AdminDashboard';
import InstructorDashboard from './components/dashboards/InstructorDashboard';
import StudentDashboard from './components/dashboards/StudentDashboard';
import EnrollmentTest from './components/test/EnrollmentTest';
import ProgressTest from './components/test/ProgressTest';

function DebugInfo() {
  const { user, isAuthenticated, loading, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  return (
    <div className="text-left bg-gray-100 p-4 rounded mt-4">
      <p><strong>Loading:</strong> {loading ? 'true' : 'false'}</p>
      <p><strong>Authenticated:</strong> {isAuthenticated ? 'true' : 'false'}</p>
      <p><strong>User:</strong> {user ? JSON.stringify(user, null, 2) : 'null'}</p>
      <button
        onClick={handleLogout}
        className="mt-4 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
      >
        Logout & Try Different User
      </button>
    </div>
  );
}

function UserDebugPage() {
  const { user, isAuthenticated, loading } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">User Debug Information</h1>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Authentication State</h2>
          <div className="space-y-2">
            <p><strong>Loading:</strong> <span className={loading ? 'text-orange-600' : 'text-green-600'}>{loading ? 'true' : 'false'}</span></p>
            <p><strong>Authenticated:</strong> <span className={isAuthenticated ? 'text-green-600' : 'text-red-600'}>{isAuthenticated ? 'true' : 'false'}</span></p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow mt-6">
          <h2 className="text-xl font-semibold mb-4">User Object</h2>
          {user ? (
            <div className="space-y-2">
              <p><strong>ID:</strong> {user.id}</p>
              <p><strong>Email:</strong> {user.email}</p>
              <p><strong>Name:</strong> {user.name}</p>
              <p><strong>Role:</strong> <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">{user.role}</span></p>
              <p><strong>Avatar:</strong> {user.avatar}</p>
            </div>
          ) : (
            <p className="text-gray-500">No user data available</p>
          )}
        </div>

        <div className="bg-white p-6 rounded-lg shadow mt-6">
          <h2 className="text-xl font-semibold mb-4">Raw User JSON</h2>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
            {user ? JSON.stringify(user, null, 2) : 'null'}
          </pre>
        </div>

        <div className="mt-6 space-x-4">
          <a href="/" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
            Go to Dashboard
          </a>
          <a href="/login" className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700">
            Go to Login
          </a>
        </div>
      </div>
    </div>
  );
}

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles: string[] }) {
  const { user, isAuthenticated, loading } = useAuth();

  console.log('ProtectedRoute - allowedRoles:', allowedRoles, 'userRole:', user?.role, 'isAuthenticated:', isAuthenticated);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    console.log('ProtectedRoute: User not authenticated');
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user?.role || '')) {
    console.log('ProtectedRoute: User role not allowed. User role:', user?.role, 'Allowed roles:', allowedRoles);
    return <Navigate to="/unauthorized" replace />;
  }

  console.log('ProtectedRoute: Access granted');
  return <>{children}</>;
}

function DashboardRouter() {
  const { user, isAuthenticated, loading } = useAuth();

  console.log('DashboardRouter - loading:', loading, 'isAuthenticated:', isAuthenticated, 'user:', user);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    console.log('User not authenticated, redirecting to login');
    return <Navigate to="/login" replace />;
  }

  console.log('User role:', user?.role);

  switch (user?.role) {
    case 'admin':
      console.log('Redirecting to admin dashboard');
      return <Navigate to="/admin" replace />;
    case 'instructor':
      console.log('Redirecting to instructor dashboard');
      return <Navigate to="/instructor" replace />;
    case 'student':
      console.log('Redirecting to student dashboard');
      return <Navigate to="/student" replace />;
    default:
      console.log('Unknown role or no role, redirecting to login. Role:', user?.role);
      return <Navigate to="/login" replace />;
  }
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="h-screen bg-gray-50 overflow-hidden">
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/debug-user" element={<UserDebugPage />} />
            <Route path="/test-enrollment" element={<EnrollmentTest />} />
            <Route path="/test-progress" element={<ProgressTest />} />
            <Route path="/" element={<DashboardRouter />} />
            
            <Route
              path="/admin/*"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="/instructor/*"
              element={
                <ProtectedRoute allowedRoles={['instructor']}>
                  <InstructorDashboard />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="/student/*"
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <StudentDashboard />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="/unauthorized"
              element={
                <div className="h-screen flex items-center justify-center bg-gray-50 overflow-y-auto">
                  <div className="text-center p-6">
                    <h1 className="text-2xl font-bold text-gray-900 mb-4">Unauthorized Access</h1>
                    <p className="text-gray-600 mb-4">You don't have permission to access this page.</p>
                    <div className="text-sm text-gray-500">
                      <p>Debug info:</p>
                      <DebugInfo />
                    </div>
                  </div>
                </div>
              }
            />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;