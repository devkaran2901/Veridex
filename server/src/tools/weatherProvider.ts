import { query } from '../database/db';
import { config } from '../config/env';

export interface WeatherData {
  location: string;
  temperatureC: number;
  condition: string;
  humidity: number;
  windSpeedKmh: number;
  precipitationProb: number;
  advisoryAlert?: string;
  source: string;
}

export interface WeatherProvider {
  getWeather(location: string): Promise<WeatherData>;
}

/**
 * Real Weather Provider using wttr.in JSON service or OpenWeather API
 */
export class RealWeatherProvider implements WeatherProvider {
  async getWeather(location: string): Promise<WeatherData> {
    try {
      const cleanLoc = encodeURIComponent(location.trim());
      const response = await fetch(`https://wttr.in/${cleanLoc}?format=j1`);
      
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const data: any = await response.json();
      const current = data.current_condition?.[0];
      const area = data.nearest_area?.[0]?.areaName?.[0]?.value || location;

      return {
        location: area,
        temperatureC: parseInt(current?.temp_C || '28', 10),
        condition: current?.weatherDesc?.[0]?.value || 'Partly Cloudy',
        humidity: parseInt(current?.humidity || '65', 10),
        windSpeedKmh: parseInt(current?.windspeedKmph || '15', 10),
        precipitationProb: parseInt(data.weather?.[0]?.hourly?.[0]?.chanceofrain || '40', 10),
        advisoryAlert: parseInt(data.weather?.[0]?.hourly?.[0]?.chanceofrain || '0', 10) > 70
          ? 'Heavy Rainfall & Waterlogging Alert in place.'
          : undefined,
        source: 'wttr.in Live Weather API',
      };
    } catch (err: any) {
      console.warn(`⚠️ RealWeatherProvider failed for ${location}, switching to MockWeatherProvider:`, err.message);
      const fallback = new MockWeatherProvider();
      return fallback.getWeather(location);
    }
  }
}

/**
 * Mock Weather Provider for offline development & Viva demos
 */
export class MockWeatherProvider implements WeatherProvider {
  async getWeather(location: string): Promise<WeatherData> {
    const locLower = location.toLowerCase();
    const isDelhi = locLower.includes('delhi');

    return {
      location: location || 'Delhi',
      temperatureC: isDelhi ? 29 : 26,
      condition: isDelhi ? 'Thunderstorms & Heavy Rain' : 'Partly Cloudy',
      humidity: isDelhi ? 85 : 60,
      windSpeedKmh: isDelhi ? 24 : 12,
      precipitationProb: isDelhi ? 75 : 20,
      advisoryAlert: isDelhi
        ? 'IMD Red Alert: High probability of severe waterlogging and transit disruption.'
        : undefined,
      source: 'Veridex Mock Weather Adapter',
    };
  }
}

/**
 * Weather Tool Executor with PostgreSQL Caching (`live_data_cache`)
 */
export async function getLiveWeather(location: string): Promise<WeatherData> {
  const cacheKey = `weather_${location.toLowerCase().trim()}`;
  
  // 1. Check PostgreSQL live_data_cache
  try {
    const cacheRes = await query(
      `SELECT data FROM live_data_cache WHERE cache_key = $1 AND expires_at > CURRENT_TIMESTAMP`,
      [cacheKey]
    );
    if (cacheRes.rows.length > 0) {
      return cacheRes.rows[0].data as WeatherData;
    }
  } catch (err) {
    console.warn('Cache query failed:', err);
  }

  // 2. Fetch live weather using Provider Strategy pattern
  const provider: WeatherProvider = new RealWeatherProvider();
  const weather = await provider.getWeather(location);

  // 3. Store in PostgreSQL cache for 10 minutes
  try {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await query(
      `INSERT INTO live_data_cache (cache_key, data, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (cache_key) DO UPDATE SET data = $2, expires_at = $3`,
      [cacheKey, JSON.stringify(weather), expiresAt]
    );
  } catch (err) {
    console.warn('Cache write failed:', err);
  }

  return weather;
}
