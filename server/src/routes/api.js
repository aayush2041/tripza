import { Router } from 'express';
import healthRoutes from './health.js';
import authRoutes from './auth.js';
import profileRoutes from './profiles.js';
import verificationRoutes from './verification.js';

const apiRouter = Router();

// Sub-routes
apiRouter.use('/health', healthRoutes);
apiRouter.use('/auth', authRoutes);
apiRouter.use('/profiles', profileRoutes);
apiRouter.use('/verification', verificationRoutes);

// Root /api endpoint information
apiRouter.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      name: 'TripZa API',
      version: '0.2.0',
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
      },
    },
  });
});

export default apiRouter;
