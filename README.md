# Tourify Bohol Final

Tourify Bohol Final is our capstone project: a smart tourism platform that helps tourists discover verified destinations in Bohol, build optimized itineraries, and interact with local tourism services through one connected system.

The project combines a tourist mobile application, an admin web dashboard, and a backend API. Its strongest point is that it does not only show destinations. It supports smarter travel decisions through personalized recommendations, route optimization, weather-aware planning, QR-based check-ins, shared itineraries, and feedback insights for both tourists and tourism stakeholders.

## Why This Project Stands Out

- Smart destination recommendations based on tourist preferences, budget, proximity, and recommendation logic already integrated in the platform
- Weather-aware and multi-road route planning for better itinerary decisions
- Verified destination information supported by LGUs and Bohol tourism stakeholders
- AI-generated feedback summaries on public destination detail pages
- QR-based itinerary check-in flow for guided travel and visit tracking
- Shared itinerary and community travel features
- Role-based dashboards for BTO, LGU admins, LGU staff, and establishment owners
- Analytics, feedback monitoring, and establishment management in one system

## System Components

- `backend` - Express + MongoDB API for authentication, recommendations, itineraries, analytics, feedback, and public tourism data
- `frontend/tourify-admin` - React + Vite web dashboard for BTO, LGUs, staff, and establishment owners
- `frontend/tourify-tourist` - Expo React Native mobile app for tourists

## Core Features

- Tourist registration, login, and profile setup
- Destination browsing with maps and detailed public destination pages
- Smart recommendation generation for tourists
- Itinerary building, saving, route preview, and live itinerary flow
- QR code scanning for itinerary check-ins
- Feedback posting, review tracking, and stakeholder responses
- Community/shared itinerary viewing
- Establishment approvals, verification workflows, and tourism analytics dashboards

## Required Environment Keys

Backend:

- `OPENROUTESERVICE_API_KEY` or `ORS_API_KEY` for route matrix and multi-road routing
- `OPENWEATHER_API_KEY` for weather-aware route scoring
- `OPENAI_API_KEY` for AI feedback summaries on public destination details

Tourist frontend:

- `EXPO_PUBLIC_API_URL` pointing to your backend `/api` base URL

## Other Common Environment Variables

Depending on the features you want to run locally, the backend may also need:

- `MONGO_URI` for the MongoDB connection
- `JWT_SECRET` for authentication
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` for media uploads and QR assets
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` for email-related flows

The tourist frontend may also use:

- `EXPO_PUBLIC_ORS_API_KEY` for direct OpenRouteService requests in mobile route features

## Installation

Clone the repository and install dependencies for each project:

```bash
npm install --prefix backend
npm install --prefix frontend/tourify-admin
npm install --prefix frontend/tourify-tourist
```

## Running the Project

### Backend API

```bash
npm run dev --prefix backend
```

### Admin Dashboard

```bash
npm run dev --prefix frontend/tourify-admin
```

### Tourist Mobile App

```bash
npm run start --prefix frontend/tourify-tourist
```

To run the tourist side on a phone, install **Expo Go** on your mobile device, start the Expo project, and scan the QR code shown in the terminal or browser. Make sure your phone and development machine are on the same network.

## Suggested Local Setup

1. Create your local `.env` files for the backend and frontend apps.
2. Start the backend first.
3. Start the admin dashboard if you need the web management side.
4. Start the tourist mobile app through Expo.
5. Open Expo Go and scan the generated QR code to launch the tourist app.

## Tech Stack

- Backend: Node.js, Express, MongoDB, Mongoose
- Admin frontend: React, Vite, Recharts, Leaflet
- Tourist frontend: Expo, React Native, Expo Router, React Native Maps
- Integrations: OpenRouteService, OpenWeather, OpenAI, Cloudinary

## Notes

- Do not commit `.env` files to GitHub.
- Keep API keys and database credentials only in local environment files or secure deployment settings.
- If you plan to share this repository publicly, provide sample configuration through `.env.example` files instead of real secrets.
