import {
  FaHome,
  FaChartLine,
  FaCommentDots,
  FaUserCog,
} from 'react-icons/fa';

export const buildEstablishmentNavSections = estId => [
  {
    title: 'Overview',
    items: [
      {
        id: 'est-dashboard',
        label: 'Dashboard',
        icon: FaHome,
        path: `/establishment/${estId}/dashboard`,
      },
      {
        id: 'est-analytics',
        label: 'Analytics',
        icon: FaChartLine,
        path: `/establishment/${estId}/analytics`,
      },
      {
        id: 'est-feedback',
        label: 'Feedback',
        icon: FaCommentDots,
        path: `/establishment/${estId}/feedback`,
      },
    ],
  },
  {
    title: 'Settings',
    items: [
      {
        id: 'est-account',
        label: 'Establishment Info',
        icon: FaUserCog,
        path: `/establishment/${estId}/account`,
      },
      { id: 'my-account', label: 'My Account', icon: FaUserCog, path: '/account/settings' },
    ],
  },
];
