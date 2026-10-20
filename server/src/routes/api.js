import { Router } from 'express';
import healthRoutes from './health.js';
import authRoutes from './auth.js';
import profileRoutes from './profiles.js';
import verificationRoutes from './verification.js';
import tripRoutes from './trips.js';
import notificationRoutes from './notifications.js';
import blockRoutes from './blocks.js';
import reportRoutes from './reports.js';
import adminRoutes from './admin.js';

const apiRouter = Router();

// Sub-routes
apiRouter.use('/health', healthRoutes);
apiRouter.use('/auth', authRoutes);
apiRouter.use('/profiles', profileRoutes);
apiRouter.use('/verification', verificationRoutes);
apiRouter.use('/trips', tripRoutes);
apiRouter.use('/notifications', notificationRoutes);
apiRouter.use('/blocks', blockRoutes);
apiRouter.use('/reports', reportRoutes);
apiRouter.use('/admin', adminRoutes);

// Root /api endpoint information
apiRouter.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      name: 'TripZa API',
      version: '0.3.0',
      description: 'India-first travel community platform API',
      endpoints: {
        health: '/api/health',
        auth: {
          register: 'POST /api/auth/register',
          login: 'POST /api/auth/login',
          logout: 'POST /api/auth/logout',
          me: 'GET /api/auth/me',
          csrfToken: 'GET /api/auth/csrf-token',
        },
        profiles: {
          me: 'GET /api/profiles/me',
          updateMe: 'PATCH /api/profiles/me',
          public: 'GET /api/profiles/:id',
        },
        verification: {
          submit: 'POST /api/verification/submit',
          review: 'POST /api/verification/review (Admin)',
        },
        trips: {
          discovery: 'GET /api/trips',
          details: 'GET /api/trips/:id',
          create: 'POST /api/trips',
          update: 'PATCH /api/trips/:id',
          publish: 'POST /api/trips/:id/publish',
          cancel: 'POST /api/trips/:id/cancel',
          join: 'POST /api/trips/:id/join',
          requests: 'GET /api/trips/:id/requests',
          approveRequest: 'POST /api/trips/:id/requests/:requestId/approve',
          rejectRequest: 'POST /api/trips/:id/requests/:requestId/reject',
          leave: 'POST /api/trips/:id/leave',
          mineOrganized: 'GET /api/trips/mine/organized',
          mineJoined: 'GET /api/trips/mine/joined',
          mineRequests: 'GET /api/trips/mine/requests',
        },
        notifications: {
          list: 'GET /api/notifications',
          markRead: 'PATCH /api/notifications/:id/read',
        },
      },
    },
  });
});

export default apiRouter;
