import { Routes, Route, Navigate} from "react-router-dom";
import Login from "./pages/Login"
import BtoDashboard from "./pages/BtoDashboard";
import Accounts from "./pages/admin/Accounts";
import Municipalities from "./pages/admin/Municipalities";
import Establishments from "./pages/admin/BusinessEstablishment";
import LguAccounts from "./pages/lgu/Accounts"
import LguDashboard from "./pages/lgu/LguDashboard";
import LguStaffDashboard from './pages/lguStaff/LguStaffDashboard';
import LguStaffApprovals from './pages/lguStaff/Approval';
import OwnerDashboard from './pages/owner/OwnerDashboard';
import OwnerEstablishments from './pages/owner/Establishment';
import ProtectedRoute from './components/ProtectedRoute';
import LguEstablishments from './pages/lgu/BusinesEstablishment.jsx';
import LguApprovals from './pages/lgu/Approvals.jsx';
import LguActivities from './pages/lguStaff/Activities.jsx'
import OwnerFeedback from './pages/owner/Feedback';
import LguFeedback from './pages/lgu/Feedback.jsx';
import AdminAnalytics from './pages/admin/Analytics.jsx';
import LguAnalytics from './pages/lgu/Analytics.jsx';
import AdminFeedback from './pages/admin/Feedback';
import LguStaffFeedback from './pages/lguStaff/Feedback.jsx';
import OwnerAnalytics from './pages/owner/Analytics.jsx'
import LguStaffAnalytics from './pages/lguStaff/Analytics.jsx';
import AccountSettings from './pages/AccountSettings.jsx'

function App() {
return (
  <Routes>
    <Route path="/" element={<Navigate to="/login" replace />} />
    <Route
      path="/account/settings"
      element={
        <ProtectedRoute allowedRoles={['bto_admin', 'bto_staff', 'lgu_admin', 'lgu_staff', 'business_establishment']}>
          <AccountSettings />
        </ProtectedRoute>
      }
    />
    <Route path="/login" element={<Login />} />
    {/* admin */}
    <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
    <Route
      path="/admin/dashboard"
      element={
        <ProtectedRoute allowedRoles={['bto_admin', 'bto_staff']}>

          <BtoDashboard />
        </ProtectedRoute>
      }
    />
    <Route
        path="/admin/analytics"
        element={
          <ProtectedRoute allowedRoles={['bto_admin', 'bto_staff']}>

            <AdminAnalytics />
          </ProtectedRoute>
        }
      />
    <Route
      path="/admin/accounts"
      element={
        <ProtectedRoute allowedRoles={['bto_admin', 'bto_staff']}>
          <Accounts />
        </ProtectedRoute>
      }
    />
    <Route
      path="/admin/municipalities"
      element={
        <ProtectedRoute allowedRoles={['bto_admin', 'bto_staff']}>
          <Municipalities />
        </ProtectedRoute>
      }
    />
    <Route
      path="/admin/establishments"
      element={
        <ProtectedRoute allowedRoles={['bto_admin', 'bto_staff']}>
          <Establishments />
        </ProtectedRoute>
      }
    />

        <Route
      path="/admin/feedback"
      element={
        <ProtectedRoute allowedRoles={['bto_admin', 'bto_staff']}>

          <AdminFeedback />
        </ProtectedRoute>
      }
    />
    {/* lgu admin*/}
    <Route path="/lgu" element={<Navigate to="/lgu/dashboard" replace />} />
    <Route path="/lgu/dashboard" element={<LguDashboard />} />
    <Route path="/lgu/accounts" element={<LguAccounts />} />
    <Route path="/lgu/establishments" element={<LguEstablishments />} />
    <Route path="/lgu/approvals" element={<LguApprovals />} />
    <Route path="/lgu/feedback" element={<LguFeedback />} />
    <Route
      path="/lgu/analytics"
      element={
        <ProtectedRoute allowedRoles={['lgu_admin', 'lgu_staff']}>
          <LguAnalytics />
        </ProtectedRoute>
      }
    />
    {/* lgu staff*/}
    <Route path="/lgu-staff" element={<Navigate to="/lgu-staff/dashboard" replace />} />
    <Route path="/lgu-staff/dashboard" element={<LguStaffDashboard />} />
    <Route path="/lgu-staff/approvals" element={<LguStaffApprovals />} />
    <Route path="/lgu-staff/activities" element={<LguActivities />} />
    <Route path="/lgu-staff/feedback" element={<LguStaffFeedback />} />
    <Route
      path="/lgu-staff/reports"
      element={
        <ProtectedRoute allowedRoles={['lgu_staff', 'lgu_admin']}>
          <LguStaffAnalytics />
        </ProtectedRoute>
      }
    />

    {/* owner*/}
    <Route path="/owner" element={<Navigate to="/owner/dashboard" replace />} />
    <Route path="/owner/dashboard" element={<OwnerDashboard />} />
    <Route path="/owner/establishments" element={<OwnerEstablishments />} />
    <Route path="/owner/feedback" element={<OwnerFeedback />} />
    <Route path="/owner/analytics" element={<OwnerAnalytics />} />
  </Routes>
)
}


export default App;