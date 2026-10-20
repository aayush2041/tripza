import React from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { RootLayout } from '../layouts/RootLayout.jsx';
import { HomePage } from '../pages/HomePage.jsx';
import { LoginPage } from '../pages/LoginPage.jsx';
import { RegisterPage } from '../pages/RegisterPage.jsx';
import { ProfilePage } from '../pages/ProfilePage.jsx';
import { ComingSoonPage } from '../pages/ComingSoonPage.jsx';
import { SystemStatusPage } from '../pages/SystemStatusPage.jsx';
import { NotFoundPage } from '../pages/NotFoundPage.jsx';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      {
        path: 'login',
        element: <LoginPage />,
      },
      {
        path: 'register',
        element: <RegisterPage />,
      },
      {
        path: 'profile',
        element: <ProfilePage />,
      },
      {
        path: 'find-trips',
        element: (
          <ComingSoonPage
            featureName="Find Trips"
            description="Discover upcoming road trips, treks, and group journeys across India. Search by region, travel dates, cost splits, and group size."
            plannedPrompt="Prompt 3 (Trip Discovery & Filtering)"
          />
        ),
      },
      {
        path: 'list-trip',
        element: (
          <ComingSoonPage
            featureName="List a Trip"
            description="Publish your planned route, itinerary, transport type, and member preferences once your profile is verified."
            plannedPrompt="Prompt 3 (Trip Creation & Publishing)"
          />
        ),
      },
      {
        path: 'my-trips',
        element: (
          <ComingSoonPage
            featureName="My Trips"
            description="Track your active join requests, hosted trips, and access private Trip Rooms for upcoming departures."
            plannedPrompt="Prompt 4 (Trip Membership & Requests)"
          />
        ),
      },
      {
        path: 'system-status',
        element: <SystemStatusPage />,
      },
      {
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
]);
