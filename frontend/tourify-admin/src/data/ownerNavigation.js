import {
  FaHome,
  FaBuilding,
  FaClipboardList,
  FaCommentDots,
  FaChartLine,
} from 'react-icons/fa';

export const ownerNavSections = [
  {
    title: 'Overview',
    items: [
      { id: 'overview', label: 'Overview', icon: FaHome, path: '/owner/dashboard' },
      { id: 'listings', label: 'My Establishments', icon: FaBuilding, path: '/owner/establishments' },
    ],
  },
  {
    title: 'Operations',
    items: [
      { id: 'submissions', label: 'Submit New Listing', icon: FaClipboardList, path: '/owner/establishments' },
      { id: 'feedback', label: 'Feedback & Replies', icon: FaCommentDots, path: '/owner/feedback' },
      { id: 'analytics', label: 'Performance Analytics', icon: FaChartLine, path: '/owner/analytics' },
    ],
  },
];
