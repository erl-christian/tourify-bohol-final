import {
  FaTachometerAlt,
  FaChartLine,
  FaUsers,
  FaLandmark,
  FaBuilding,
  FaComments,
  FaFileInvoice,
  FaUserCog
} from 'react-icons/fa';

export const adminNavSections = [
  {
    title: 'Overview',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: FaTachometerAlt, path: '/admin/dashboard' },
      { id: 'analytics', label: 'Analytics', icon: FaChartLine, path: '/admin/analytics' },
    ],
  },
  {
    title: 'Administration',
    items: [
      { id: 'accounts', label: 'Accounts', icon: FaUsers, path: '/admin/accounts' },
      { id: 'municipalities', label: 'Municipalities', icon: FaLandmark, path: '/admin/municipalities' },
      { id: 'establishments', label: 'Establishments', icon: FaBuilding, path: '/admin/establishments' },
      { id: 'feedback', label: 'Feedback & Moderation', icon: FaComments, path: '/admin/feedback' },
      { id: 'my-account', label: 'My Account', icon: FaUserCog, path: '/account/settings' },
    ],
  },
];
