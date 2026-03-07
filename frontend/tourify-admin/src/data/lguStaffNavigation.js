import {
  FaHome,
  FaClipboardCheck,
  FaLeaf,
  FaCommentDots,
  FaUserCog
} from 'react-icons/fa';

export const lguStaffNavSections = [
  {
    title: 'Overview',
    items: [
      { id: 'overview', label: 'Overview & Analytics', icon: FaHome, path: '/lgu-staff/dashboard' },
    ],
  },
  {
    title: 'Tasks',
    items: [
      { id: 'approvals', label: 'Validate Submissions', icon: FaClipboardCheck, path: '/lgu-staff/approvals' },
      { id: 'activities', label: 'Tourism Activity Log', icon: FaLeaf, path: '/lgu-staff/activities' },
      { id: 'feedback', label: 'Feedback & Comments', icon: FaCommentDots, path: '/lgu-staff/feedback' },
      { id: 'my-account', label: 'My Account', icon: FaUserCog, path: '/account/settings' },
    ],
  },
];
