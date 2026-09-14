export interface TextChunk {
  chunkIndex: number;
  content: string;
  pageNumber?: number;
  metadata: Record<string, any>;
}

interface ChunkOptions {
  chunkSize?: number;
  chunkOverlap?: number;
}

/**
 * Split text content into recursive overlapping chunks with metadata.
 */
export function chunkText(
  text: string,
  options: ChunkOptions = {},
  baseMetadata: Record<string, any> = {}
): TextChunk[] {
  const chunkSize = options.chunkSize || 500;
  const chunkOverlap = options.chunkOverlap || 50;

  // Clean raw text whitespace
  const cleanedText = text.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ');

  // Split on double newlines or single newlines
  const paragraphs = cleanedText.split(/\n+/);
  const chunks: TextChunk[] = [];
  let currentChunk = '';
  let chunkIndex = 0;
  let pageNumber = 1;

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    // Estimate page number transitions if page markers are present
    if (trimmed.toLowerCase().includes('page ') || trimmed.match(/^---\s*\d+\s*---$/)) {
      const pageMatch = trimmed.match(/\d+/);
      if (pageMatch) {
        pageNumber = parseInt(pageMatch[0], 10);
      }
    }

    if ((currentChunk + ' ' + trimmed).length > chunkSize && currentChunk.length > 0) {
      chunks.push({
        chunkIndex: chunkIndex++,
        content: currentChunk.trim(),
        pageNumber,
        metadata: {
          ...baseMetadata,
          pageNumber,
          characterCount: currentChunk.trim().length,
        },
      });

      // Keep overlap from previous chunk
      const overlapStart = Math.max(0, currentChunk.length - chunkOverlap);
      currentChunk = currentChunk.slice(overlapStart) + ' ' + trimmed;
    } else {
      currentChunk = currentChunk ? `${currentChunk} ${trimmed}` : trimmed;
    }
  }

  // Push remaining chunk
  if (currentChunk.trim().length > 0) {
    chunks.push({
      chunkIndex: chunkIndex++,
      content: currentChunk.trim(),
      pageNumber,
      metadata: {
        ...baseMetadata,
        pageNumber,
        characterCount: currentChunk.trim().length,
      },
    });
  }

  return chunks;
}
