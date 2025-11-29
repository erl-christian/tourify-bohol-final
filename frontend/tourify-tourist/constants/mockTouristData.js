export const quickActions = [
  { id: 'explore', label: 'Explore', icon: 'compass-outline' },
  { id: 'plan', label: 'Plan Trip', icon: 'calendar' },
  { id: 'destinations', label: 'Destinations', icon: 'map' },
  { id: 'feedback', label: 'Feedback', icon: 'chatbubbles' },
  { id: 'history', label: 'History', icon: 'time' },
  { id: 'saved-itineraries', label: 'Community Itineraries', icon: 'bookmark' },
];

export const featuredDestinations = [
  {
    id: 'pamalican',
    title: 'Alona Beach',
    municipality: 'Panglao',
    image: require('../assets/auth-tiles.jpg'),
    tags: ['Beach', 'Family-friendly'],
    rating: 4.8,
  },
  {
    id: 'chocolate-hills',
    title: 'Chocolate Hills',
    municipality: 'Carmen',
    image: require('../assets/auth-hero.jpg'),
    tags: ['Heritage', 'Must-see'],
    rating: 4.9,
  },
];

export const activeItinerary = {
  title: 'Weekend Escape',
  days: 3,
  nextStop: 'Hinagdanan Cave',
  departure: 'Today • 2:00 PM',
};

export const recentFeedback = [
  {
    id: 'fbx1',
    place: 'Bilar Man-Made Forest',
    highlight: 'Loved the serenity and well-maintained trails.',
    score: 5,
  },
  {
    id: 'fbx2',
    place: 'Anda White Beach',
    highlight: 'Crystal-clear water and friendly locals!',
    score: 4.5,
  },
];
