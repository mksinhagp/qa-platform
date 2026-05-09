import express, { Request, Response, NextFunction } from 'express';
import { Logger, generateCorrelationId } from '@qa-platform/shared-types';

const app = express();
const PORT = process.env.PORT || 4000;
const logger = new Logger('runner');

// Correlation ID middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const correlationId = req.headers['x-correlation-id'] as string || generateCorrelationId();
  req.headers['x-correlation-id'] = correlationId;
  res.setHeader('x-correlation-id', correlationId);
  next();
});

// Middleware
app.use(express.json());

// Health endpoint
app.get('/health', (req: Request, res: Response) => {
  const correlationId = req.headers['x-correlation-id'] as string;
  logger.info('Health check requested', undefined, correlationId);
  
  res.status(200).json({
    status: 'healthy',
    service: 'runner',
    timestamp: new Date().toISOString()
  });
});

// Stub run endpoint
app.post('/run', (req: Request, res: Response) => {
  const correlationId = req.headers['x-correlation-id'] as string;
  const config = req.body;
  
  logger.info('Run received (stub)', { config }, correlationId);
  
  res.status(200).json({
    message: 'Run received (stub)',
    config: config,
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  logger.info(`Runner service listening on port ${PORT}`);
});
