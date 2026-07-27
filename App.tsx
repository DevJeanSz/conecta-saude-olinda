import React, { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { PatientLayout } from './components/PatientLayout';
import { Dashboard } from './pages/Dashboard';
import { DisplayTV } from './pages/DisplayTV';
import { LandingPage } from './pages/LandingPage';
import { Login } from './pages/Login';
import {
  NotFoundPage,
  PatientAppointmentsPage,
  PatientCareHistoryPage,
  PatientExamSchedulePage,
  PatientExamsPage,
  PatientInformationPage,
  PatientRemindersPage,
  PatientUnitsPage,
} from './pages/PatientModules';
import { PatientDashboard } from './pages/PatientDashboard';
import { PatientPortal } from './pages/PatientPortal';
import { Patients } from './pages/Patients';
import { Profile } from './pages/Profile';
import { Reception } from './pages/Reception';
import { Register } from './pages/Register';
import { Reports } from './pages/Reports';
import { Schedule } from './pages/Schedule';
import { Specialties } from './pages/Specialties';
import { Units } from './pages/Units';
import { Users } from './pages/Users';
import { User, UserRole } from './types';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-[#EAF6FF] font-bold text-[#06296F]">Carregando...</div>;
  }

  const isProfessional = (currentUser: User) => currentUser.role !== UserRole.PATIENT;

  const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode; allowedRoles: UserRole[] }) => {
    if (!user) return <Navigate to="/login" replace />;
    if (!allowedRoles.includes(user.role)) {
      return <Navigate to={user.role === UserRole.PATIENT ? '/patient-portal' : '/admin'} replace />;
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
    return <Login onLogin={handleLogin} />;
  };

  const PatientRouteWrapper = ({ children }: { children: React.ReactNode }) => {
    if (!user) return <Navigate to="/login" replace />;
    if (isProfessional(user)) return <Navigate to="/admin" replace />;

    return (
      <PatientLayout user={user} onLogout={handleLogout}>
        {children}
      </PatientLayout>
    );
  };

  const AdminRoute = ({ children }: { children: React.ReactNode }) => {
    if (!user) return <Navigate to="/login" replace />;
    if (!isProfessional(user)) return <Navigate to="/patient-portal" replace />;

    return (
      <Layout user={user} onLogout={handleLogout}>
        {children}
      </Layout>
    );
  };

  return (
    <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <Routes>
        <Route path="/" element={<LandingRoute />} />
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/register" element={<Register />} />
        <Route path="/cadastro" element={<Navigate to="/register" replace />} />

        <Route
          path="/patient-portal"
          element={(
            <PatientRouteWrapper>
              <PatientDashboard user={user as User} />
            </PatientRouteWrapper>
          )}
        />
        <Route
          path="/patient-portal/schedule"
          element={(
            <PatientRouteWrapper>
              <PatientPortal user={user as User} />
            </PatientRouteWrapper>
          )}
        />
        <Route
          path="/patient-portal/appointments"
          element={(
            <PatientRouteWrapper>
              <PatientAppointmentsPage user={user as User} />
            </PatientRouteWrapper>
          )}
        />
        <Route
          path="/patient-portal/care-history"
          element={(
            <PatientRouteWrapper>
              <PatientCareHistoryPage user={user as User} />
            </PatientRouteWrapper>
          )}
        />
        <Route
          path="/patient-portal/units"
          element={(
            <PatientRouteWrapper>
              <PatientUnitsPage />
            </PatientRouteWrapper>
          )}
        />
        <Route
          path="/patient-portal/exams/schedule"
          element={(
            <PatientRouteWrapper>
              <PatientExamSchedulePage user={user as User} />
            </PatientRouteWrapper>
          )}
        />
        <Route
          path="/patient-portal/exams"
          element={(
            <PatientRouteWrapper>
              <PatientExamsPage user={user as User} />
            </PatientRouteWrapper>
          )}
        />
        <Route
          path="/patient-portal/reminders"
          element={(
            <PatientRouteWrapper>
              <PatientRemindersPage user={user as User} />
            </PatientRouteWrapper>
          )}
        />
        <Route
          path="/patient-portal/information"
          element={(
            <PatientRouteWrapper>
              <PatientInformationPage />
            </PatientRouteWrapper>
          )}
        />

        <Route
          path="/perfil"
          element={(
            user && isProfessional(user)
              ? (
                <AdminRoute>
                  <Profile user={user as User} />
                </AdminRoute>
              )
              : (
                <PatientRouteWrapper>
                  <Profile user={user as User} />
                </PatientRouteWrapper>
              )
          )}
        />

        <Route
          path="/admin"
          element={(
            <AdminRoute>
              <Dashboard user={user as User} />
            </AdminRoute>
          )}
        />
        <Route
          path="/admin/schedule"
          element={(
            <AdminRoute>
              <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.GENERAL_SUPERVISOR, UserRole.ATTENDANT, UserRole.DOCTOR]}>
                <Schedule user={user as User} />
              </ProtectedRoute>
            </AdminRoute>
          )}
        />
        <Route
          path="/admin/patients"
          element={(
            <AdminRoute>
              <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.GENERAL_SUPERVISOR, UserRole.ATTENDANT, UserRole.SOCIAL_WORKER]}>
                <Patients />
              </ProtectedRoute>
            </AdminRoute>
          )}
        />
        <Route
          path="/admin/users"
          element={(
            <AdminRoute>
              <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.GENERAL_SUPERVISOR]}>
                <Users />
              </ProtectedRoute>
            </AdminRoute>
          )}
        />
        <Route
          path="/admin/units"
          element={(
            <AdminRoute>
              <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.GENERAL_SUPERVISOR]}>
                <Units />
              </ProtectedRoute>
            </AdminRoute>
          )}
        />
        <Route
          path="/admin/specialties"
          element={(
            <AdminRoute>
              <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.GENERAL_SUPERVISOR]}>
                <Specialties />
              </ProtectedRoute>
            </AdminRoute>
          )}
        />
        <Route
          path="/admin/reports"
          element={(
            <AdminRoute>
              <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.GENERAL_SUPERVISOR]}>
                <Reports />
              </ProtectedRoute>
            </AdminRoute>
          )}
        />
        <Route
          path="/admin/reception"
          element={(
            <AdminRoute>
              <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.GENERAL_SUPERVISOR, UserRole.ATTENDANT]}>
                <Reception user={user as User} />
              </ProtectedRoute>
            </AdminRoute>
          )}
        />
        <Route path="/admin/social-assistance" element={<Navigate to="/admin/patients" replace />} />

        <Route path="/display-tv" element={<DisplayTV user={user} />} />
        <Route path="/tv" element={<Navigate to="/display-tv" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
