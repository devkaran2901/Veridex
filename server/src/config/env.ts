import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'veridex_user',
    password: process.env.DB_PASSWORD || 'veridex_password',
    name: process.env.DB_NAME || 'veridex_db',
  },
  openaiApiKey: process.env.OPENAI_API_KEY || 'mock-key',
  groqApiKey: process.env.GROQ_API_KEY || '',
  openRouterApiKey: process.env.OPENROUTER_API_KEY || '',
  weatherApiKey: process.env.WEATHER_API_KEY || 'mock-key',
};
