import React from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { RootLayout } from '../layouts/RootLayout.jsx';
import { HomePage } from '../pages/HomePage.jsx';
import { LoginPage } from '../pages/LoginPage.jsx';
import { RegisterPage } from '../pages/RegisterPage.jsx';
import { ProfilePage } from '../pages/ProfilePage.jsx';
import { TripsDiscoveryPage } from '../pages/TripsDiscoveryPage.jsx';
import { TripDetailPage } from '../pages/TripDetailPage.jsx';
import { TripRoomPage } from '../pages/TripRoomPage.jsx';
import { TripCreatePage } from '../pages/TripCreatePage.jsx';
import { TripEditPage } from '../pages/TripEditPage.jsx';
import { MyTripsPage } from '../pages/MyTripsPage.jsx';
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
        path: 'trips',
        element: <TripsDiscoveryPage />,
      },
      {
        path: 'find-trips',
        element: <TripsDiscoveryPage />,
      },
      {
        path: 'trips/create',
        element: <TripCreatePage />,
      },
      {
        path: 'list-trip',
        element: <TripCreatePage />,
      },
      {
        path: 'trips/:id',
        element: <TripDetailPage />,
      },
      {
        path: 'trips/:id/room',
        element: <TripRoomPage />,
      },
      {
        path: 'trips/:id/edit',
        element: <TripEditPage />,
      },
      {
        path: 'my-trips',
        element: <MyTripsPage />,
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
