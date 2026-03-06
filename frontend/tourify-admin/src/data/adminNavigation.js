import {
  FaTachometerAlt,
  FaUsers,
  FaLandmark,
  FaBuilding,
  FaComments,
  FaUserCog,
} from 'react-icons/fa';

export const adminNavSections = [
  {
    title: 'Overview',
    items: [
      {
        id: 'dashboard',
        label: 'Dashboard & Analytics',
        icon: FaTachometerAlt,
        path: '/admin/dashboard',
      },
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
