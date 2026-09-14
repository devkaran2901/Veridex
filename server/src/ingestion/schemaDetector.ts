export interface SchemaField {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array';
  nullable: boolean;
  sampleValue?: any;
}

export interface DetectionResult {
  valid: boolean;
  error?: string;
  dataPath?: string; // e.g. 'root' or 'data' or 'records'
  recordCount: number;
  schema: SchemaField[];
  recordsPreview: Record<string, any>[];
}

/**
 * Infer data type of a single value
 */
function inferType(val: any): SchemaField['type'] {
  if (val === null || val === undefined) return 'string';
  if (typeof val === 'number') return 'number';
  if (typeof val === 'boolean') return 'boolean';
  if (Array.isArray(val)) return 'array';
  if (typeof val === 'object') return 'object';

  if (typeof val === 'string') {
    // Check if valid ISO date or date string
    if (val.length >= 10 && !isNaN(Date.parse(val)) && /^\d{4}-\d{2}-\d{2}/.test(val)) {
      return 'date';
    }
  }
  return 'string';
}

/**
 * Detect array payload structure and schema from JSON data
 */
export function detectJsonStructure(json: any): DetectionResult {
  if (!json) {
    return { valid: false, error: 'Empty response body.', recordCount: 0, schema: [], recordsPreview: [] };
  }

  let dataArray: any[] | null = null;
  let dataPath = 'root';

  // 1. Direct array
  if (Array.isArray(json)) {
    dataArray = json;
    dataPath = 'root';
  } else if (typeof json === 'object') {
    // 2. Common wrapper keys
    const candidateKeys = ['data', 'results', 'records', 'items', 'payload', 'list', 'observations'];
    for (const key of candidateKeys) {
      if (Array.isArray(json[key])) {
        dataArray = json[key];
        dataPath = key;
        break;
      }
    }

    // 3. Fallback: find any array property with object records
    if (!dataArray) {
      for (const [key, val] of Object.entries(json)) {
        if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object') {
          dataArray = val;
          dataPath = key;
          break;
        }
      }
    }
  }

  if (!dataArray) {
    return {
      valid: false,
      error: 'Unsupported or ambiguous JSON structure. Response must be a JSON array or contain a wrapper key (e.g. data, results, records).',
      recordCount: 0,
      schema: [],
      recordsPreview: [],
    };
  }

  // Filter object records
  const objectRecords = dataArray.filter((r) => r !== null && typeof r === 'object');
  if (objectRecords.length === 0) {
    return {
      valid: false,
      error: 'JSON array contained zero record objects.',
      recordCount: 0,
      schema: [],
      recordsPreview: [],
    };
  }

  // Schema inference over up to first 50 records
  const sampleSet = objectRecords.slice(0, 50);
  const fieldMap = new Map<string, { types: Set<SchemaField['type']>; nullCount: number; sampleVal?: any }>();

  for (const item of sampleSet) {
    for (const [k, v] of Object.entries(item)) {
      if (!fieldMap.has(k)) {
        fieldMap.set(k, { types: new Set(), nullCount: 0 });
      }
      const entry = fieldMap.get(k)!;
      if (v === null || v === undefined) {
        entry.nullCount++;
      } else {
        const t = inferType(v);
        entry.types.add(t);
        if (entry.sampleVal === undefined) {
          entry.sampleVal = v;
        }
      }
    }
  }

  const schema: SchemaField[] = [];
  for (const [name, info] of fieldMap.entries()) {
    const typeArr = Array.from(info.types);
    const primaryType = typeArr.length > 0 ? typeArr[0] : 'string';
    schema.push({
      name,
      type: primaryType,
      nullable: info.nullCount > 0,
      sampleValue: info.sampleVal,
    });
  }

  const preview = objectRecords.slice(0, 5);

  return {
    valid: true,
    dataPath,
    recordCount: objectRecords.length,
    schema,
    recordsPreview: preview,
  };
}

/**
 * Format a structured record object into clean, searchable plain text for embeddings & hybrid search
 */
export function formatRecordToSearchableText(sourceName: string, record: Record<string, any>): string {
  const parts: string[] = [];

  // If title/name/location exists, put first
  const keyTitle = record.title || record.name || record.location || record.district || record.city;
  if (keyTitle) {
    parts.push(`${sourceName} observation for ${keyTitle}.`);
  } else {
    parts.push(`${sourceName} record.`);
  }

  for (const [k, v] of Object.entries(record)) {
    if (v === null || v === undefined) continue;
    if (typeof v === 'object') {
      parts.push(`${k}: ${JSON.stringify(v)}.`);
    } else {
      parts.push(`${k}: ${v}.`);
    }
  }

  return parts.join(' ');
}
