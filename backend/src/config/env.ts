import 'dotenv/config';

export const env = {
  port: Number(process.env.PORT) || 4000,
  mlServiceUrl: process.env.ML_SERVICE_URL || 'http://localhost:8000',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
};
