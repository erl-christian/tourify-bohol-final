import {
  FaHome,
  FaUserCog,
  FaStoreAlt,
  FaClipboardCheck,
  FaCommentDots,
  FaChartBar,
} from 'react-icons/fa';

export const lguNavSections = [
  {
    title: 'Overview',
    items: [
      { id: 'overview', label: 'Overview', icon: FaHome, path: '/lgu/dashboard' },
      { id: 'accounts', label: 'Manage Accounts', icon: FaUserCog, path: '/lgu/accounts' },
    ],
  },
  {
    title: 'Operations',
    items: [
      { id: 'establishments', label: 'Establishments', icon: FaStoreAlt, path: '/lgu/establishments' },
      { id: 'approvals', label: 'Approvals', icon: FaClipboardCheck, path: '/lgu/approvals' },
      { id: 'feedback', label: 'Feedback', icon: FaCommentDots, path: '/lgu/feedback' },
      { id: 'reports', label: 'Analytics', icon: FaChartBar, path: '/lgu/analytics' },
      { id: 'my-account', label: 'My Account', icon: FaUserCog, path: '/account/settings' },
    ],
  },
];
