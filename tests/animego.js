import { describe, it, expect } from 'vitest';
import { search, info, streamInfo, stream } from '../src';

describe('testing Animego', () => {
  it('Search correctly', async () => {
    const searchResults = await search('tokyo ghoul');

    expect(searchResults.success).toBe(true);
    searchResults.data.forEach((result) => {
      expect(result.url).contains('https');
      expect(result.image).toBeDefined();
      expect(result.rate).toBeDefined();
      expect(result.originalTitle).toBeDefined();
      expect(result.title).toBeDefined();
      expect(result.year).toBeDefined();
    });
  });

  it('Gets info correctly', async () => {
    const infoResult = await info(
      'https://animego.org/anime/dobro-pozhalovat-v-klass-prevoshodstva-3-2465'
    );

    expect(infoResult.success).toBe(true);
  });

  it('Gets stream info correctly', async () => {
    const streamInfoResult = await streamInfo(
      'https://animego.org/anime/dobro-pozhalovat-v-klass-prevoshodstva-3-2465'
    );

    expect(streamInfoResult.success).toBe(true);
  });

  it('Gets stream correctly', async () => {
    const streamInfoResult = await streamInfo(
      'https://animego.org/anime/dobro-pozhalovat-v-klass-prevoshodstva-3-2465'
    );
    const streamResult = await stream(
      'https://animego.org/anime/dobro-pozhalovat-v-klass-prevoshodstva-3-2465',
      1,
      streamInfoResult.data.players[0],
      streamInfoResult.data.translations[0]
    );

    expect(streamResult.success).toBe(true);
  });
});
