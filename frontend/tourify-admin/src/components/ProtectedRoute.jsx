import { Navigate } from 'react-router-dom';

function ProtectedRoute({ allowedRoles, children }) {
  const role = sessionStorage.getItem('mockRole');
  if (!role || !allowedRoles.includes(role)) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export default ProtectedRoute;