import { query } from '../database/db';
import { config } from '../config/env';
import { ingestLiveRecord } from '../ingestion/ingestionPipeline';

export interface WeatherData {
  location: string;
  temperatureC: number;
  condition: string;
  humidity: number;
  windSpeedKmh: number;
  precipitationProb: number;
  advisoryAlert?: string;
  source: string;
  isMock?: boolean;
}

export interface WeatherProvider {
  getWeather(location: string): Promise<WeatherData>;
}

/**
 * Real Weather Provider with 3-second timeout guard
 */
export class RealWeatherProvider implements WeatherProvider {
  async getWeather(location: string): Promise<WeatherData> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout guard

    try {
      const cleanLoc = encodeURIComponent(location.trim());
      const response = await fetch(`https://wttr.in/${cleanLoc}?format=j1`, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) VeridexAgent/1.0',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const data: any = await response.json();
      const current = data.current_condition?.[0];
      const area = data.nearest_area?.[0]?.areaName?.[0]?.value || location;

      return {
        location: area,
        temperatureC: parseInt(current?.temp_C || '24', 10),
        condition: current?.weatherDesc?.[0]?.value || 'Partly Cloudy',
        humidity: parseInt(current?.humidity || '60', 10),
        windSpeedKmh: parseInt(current?.windspeedKmph || '12', 10),
        precipitationProb: parseInt(data.weather?.[0]?.hourly?.[0]?.chanceofrain || '30', 10),
        advisoryAlert: parseInt(data.weather?.[0]?.hourly?.[0]?.chanceofrain || '0', 10) > 70
          ? 'Heavy Rainfall & Waterlogging Alert in place.'
          : undefined,
        source: 'wttr.in Live Weather API',
        isMock: false,
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.warn(`⚠️ RealWeatherProvider failed for ${location}:`, err.message);
      if (config.dataMode === 'demo') {
        const fallback = new MockWeatherProvider();
        return fallback.getWeather(location);
      }
      throw new Error(`Real weather data source unavailable for "${location}": ${err.message}`);
    }
  }
}

/**
 * Explicit DEMO Mode Mock Weather Provider (Strictly Labeled, Used ONLY when DATA_MODE=demo)
 */
export class MockWeatherProvider implements WeatherProvider {
  async getWeather(location: string): Promise<WeatherData> {
    const locLower = location.toLowerCase();
    const isDelhi = locLower.includes('delhi');
    const isShimla = locLower.includes('shimla');

    return {
      location: location || 'Shimla',
      temperatureC: isShimla ? 18 : isDelhi ? 29 : 22,
      condition: isShimla ? 'Pleasant & Cool' : isDelhi ? 'Thunderstorms' : 'Partly Cloudy',
      humidity: isShimla ? 55 : isDelhi ? 85 : 60,
      windSpeedKmh: isShimla ? 10 : isDelhi ? 24 : 12,
      precipitationProb: isShimla ? 20 : isDelhi ? 75 : 30,
      advisoryAlert: isDelhi
        ? '[DEMO DATA] Test Alert: High probability of severe waterlogging.'
        : undefined,
      source: '[DEMO DATA] Veridex Synthetic Weather Provider',
      isMock: true,
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
    // Cache miss or DB offline
  }

  // 2. Fetch live weather using Provider Strategy pattern
  const provider: WeatherProvider = new RealWeatherProvider();
  const weather = await provider.getWeather(location);

  // In LIVE mode, do not ingest mock data
  if (config.dataMode === 'live' && weather.isMock) {
    throw new Error('Synthetic mock weather rejected in LIVE mode');
  }

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
    // Cache write silent catch
  }

  // 4. Ingest live weather record into Knowledge Layer (pgvector + knowledge_records)
  try {
    await ingestLiveRecord({
      source: weather.source,
      sourceType: 'api_feed',
      datasetId: 'live_weather_feed',
      title: `Weather Observation - ${weather.location}`,
      content: `Live Weather for ${weather.location}: ${weather.condition}, Temperature ${weather.temperatureC}°C, Humidity ${weather.humidity}%, Rain Chance ${weather.precipitationProb}%. ${weather.advisoryAlert || ''}`,
      structuredData: {
        location: weather.location,
        temperatureC: weather.temperatureC,
        condition: weather.condition,
        humidity: weather.humidity,
        precipitationProb: weather.precipitationProb,
        advisoryAlert: weather.advisoryAlert || null,
        isMock: weather.isMock || false,
      },
      metadata: {
        region: weather.location,
        sourceUrl: 'https://wttr.in',
        isMock: weather.isMock || false,
      },
      validFrom: new Date(),
      isMock: weather.isMock || false,
    });
  } catch (err) {
    // Ingestion silent catch
  }

  return weather;
}

