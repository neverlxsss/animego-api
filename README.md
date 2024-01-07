<p align="center">
  <img width="40%" src="./.github/animego.jpeg" alt="...">
</p>
<p align="center">
  <b>animego-api</b>
</p>
<p align="center">API client for <a href="https://animego.org/" target="_blank">animego</a></p>

| 📖 [Documentation] |
| ------------------ |

<p align="center">
 <a href="https://npmjs.com/package/animego-api">
   <img src="https://img.shields.io/npm/v/animego-api?label=version&logo=npm&color=ligthgreen" alt="Version">
 </a>
 <a href="https://npmjs.com/package/animego-api">
   <img src="https://img.shields.io/npm/dt/animego-api?&logo=npm" alt="Version">
 </a>
</p>

## Install 📦

```bash
# using npm
npm i animego-api
# using yarn
yarn add animego-api
# using pnpm
pnpm add animego-api
```

## Usage 🔧

```js
import { search, info, streamInfo, stream } from 'animego-api';

(async () => {
  const searchResults = await search('tokyo ghoul');
  const animeInfo = await info(searchResults.data[0].url);
  const playerInfo = await streamInfo(searchResults.data[0].url);
  const streamUrl = await stream(
    searchResults.data[0].url,
    1, // Part
    playerInfo.data.players[0], // Kodik/aniboom...
    playerInfo.data.translations[0], // Anilibria/anidub...
    'http://192.168.0.1:1080' // Proxy if needed
  );
})();
```
