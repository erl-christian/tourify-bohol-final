import {
  FaHome,
  FaUserCog,
  FaStoreAlt,
  FaCommentDots,
} from 'react-icons/fa';

export const lguNavSections = [
  {
    title: 'Overview',
    items: [
      { id: 'overview', label: 'Overview & Analytics', icon: FaHome, path: '/lgu/dashboard' },
      { id: 'accounts', label: 'Manage Accounts', icon: FaUserCog, path: '/lgu/accounts' },
    ],
  },
  {
    title: 'Operations',
    items: [
      { id: 'establishments', label: 'Establishments', icon: FaStoreAlt, path: '/lgu/establishments' },
      { id: 'feedback', label: 'Feedback', icon: FaCommentDots, path: '/lgu/feedback' },
      { id: 'my-account', label: 'My Account', icon: FaUserCog, path: '/account/settings' },
    ],
  },
];
