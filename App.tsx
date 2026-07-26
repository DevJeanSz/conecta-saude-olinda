import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Schedule } from './pages/Schedule';
import { Patients } from './pages/Patients';
import { Reports } from './pages/Reports';
import { Users } from './pages/Users';
import { Units } from './pages/Units';
import { Specialties } from './pages/Specialties';
import { PatientPortal } from './pages/PatientPortal';
import { PatientDashboard } from './pages/PatientDashboard';
import { LandingPage } from './pages/LandingPage';
import { Register } from './pages/Register';
import { Reception } from './pages/Reception';
import { DisplayTV } from './pages/DisplayTV';
import { Profile } from './pages/Profile';
import { PatientLayout } from './components/PatientLayout';
import { User, UserRole } from './types';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verifica se existe sessao salva localmente.
    const savedUser = localStorage.getItem('health_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const handleLogin = (newUser: User) => {
    setUser(newUser);
    localStorage.setItem('health_user', JSON.stringify(newUser));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('health_user');
    localStorage.removeItem('auth_token');
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-50">Carregando...</div>;

  const isProfessional = (currentUser: User) => currentUser.role !== UserRole.PATIENT;

  const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode, allowedRoles: UserRole[] }) => {
    if (!user) {
      return <Navigate to="/" replace />;
    }

    if (!allowedRoles.includes(user.role)) {
      return <Navigate to={user.role === UserRole.PATIENT ? '/' : '/admin'} replace />;
    }

    return <>{children}</>;
  };

  const LandingRoute = () => {
    if (user) {
      return isProfessional(user) ? <Navigate to="/admin" replace /> : <Navigate to="/patient-portal" replace />;
    }
    return <LandingPage />;
  };

  const LoginRoute = () => {
    if (user) {
      return isProfessional(user) ? <Navigate to="/admin" replace /> : <Navigate to="/patient-portal" replace />;
    }
    return <Login onLogin={handleLogin} lockedMode="PATIENT" />;
  };

  const PatientRouteWrapper = ({ children }: { children: React.ReactNode }) => {
    if (!user) {
      return <Navigate to="/login" replace />;
    }

    if (isProfessional(user)) {
      return <Navigate to="/admin" replace />;
    }

    return (
      <PatientLayout user={user} onLogout={handleLogout}>
        {children}
      </PatientLayout>
    );
  };

  const AdminRoute = ({ children }: { children: React.ReactNode }) => {
    if (!user) {
      return <Navigate to="/login" replace />;
    }

    if (!isProfessional(user)) {
      return <Navigate to="/" replace />;
    }

    return (
      <Layout user={user} onLogout={handleLogout}>
        {children}
      </Layout>
    );
  };

  return (
    <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingRoute />} />
          <Route path="/login" element={<LoginRoute />} />
          <Route path="/cadastro" element={<Register />} />
          
          <Route path="/patient-portal" element={
            <PatientRouteWrapper>
              <PatientDashboard user={user as User} />
            </PatientRouteWrapper>
          } />

          <Route path="/perfil" element={
             user && isProfessional(user) ? (
                <AdminRoute>
                   <Profile user={user as User} />
                </AdminRoute>
             ) : (
                <PatientRouteWrapper>
                   <Profile user={user as User} />
                </PatientRouteWrapper>
             )
          } />

          <Route path="/patient-portal/schedule" element={
            <PatientRouteWrapper>
              <PatientPortal />
            </PatientRouteWrapper>
          } />

          <Route path="/admin" element={
            <AdminRoute>
              <Dashboard user={user as User} />
            </AdminRoute>
          } />

          <Route path="/admin/schedule" element={
            <AdminRoute>
              <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.GENERAL_SUPERVISOR, UserRole.ATTENDANT, UserRole.DOCTOR]}>
                <Schedule user={user as User} />
              </ProtectedRoute>
            </AdminRoute>
          } />
          
          <Route path="/admin/patients" element={
            <AdminRoute>
              <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.GENERAL_SUPERVISOR, UserRole.ATTENDANT, UserRole.SOCIAL_WORKER]}>
                <Patients />
              </ProtectedRoute>
            </AdminRoute>
          } />

          <Route path="/admin/users" element={
            <AdminRoute>
              <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.GENERAL_SUPERVISOR]}>
                <Users />
              </ProtectedRoute>
            </AdminRoute>
          } />

          <Route path="/admin/units" element={
            <AdminRoute>
              <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.GENERAL_SUPERVISOR]}>
                <Units />
              </ProtectedRoute>
            </AdminRoute>
          } />

          <Route path="/admin/specialties" element={
            <AdminRoute>
              <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.GENERAL_SUPERVISOR]}>
                <Specialties />
              </ProtectedRoute>
            </AdminRoute>
          } />

          <Route path="/admin/reports" element={
            <AdminRoute>
              <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.GENERAL_SUPERVISOR]}>
                <Reports />
              </ProtectedRoute>
            </AdminRoute>
          } />

          <Route path="/admin/reception" element={
            <AdminRoute>
              <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.GENERAL_SUPERVISOR, UserRole.ATTENDANT]}>
                <Reception user={user as User} />
              </ProtectedRoute>
            </AdminRoute>
          } />

          <Route path="/tv" element={
             <DisplayTV user={user} />
          } />

          <Route path="/admin/social-assistance" element={
            <AdminRoute>
              <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.SOCIAL_WORKER]}>
                <div className="p-8 text-slate-500">Módulo de Assistência Social em construção...</div>
              </ProtectedRoute>
            </AdminRoute>
          } />
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    </BrowserRouter>
  );
};

export default App;
