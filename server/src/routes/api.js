import { Router } from 'express';
import healthRoutes from './health.js';

const apiRouter = Router();

// Base API endpoints
apiRouter.use('/health', healthRoutes);

// Root /api info endpoint
apiRouter.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      name: 'TripZa API',
      version: '0.1.0',
      description: 'India-first travel community platform API foundation',
      endpoints: {
        health: '/api/health',
      },
    },
  });
});

export default apiRouter;
