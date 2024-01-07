import { get } from 'axios';
import { parse } from 'node-html-parser';
import { use, launch } from 'puppeteer-extra';
// Adblock setup
import { DEFAULT_INTERCEPT_RESOLUTION_PRIORITY } from 'puppeteer';
import AdblockerPlugin from 'puppeteer-extra-plugin-adblocker';
use(
  AdblockerPlugin({
    blockTrackers: true,
    interceptResolutionPriority: DEFAULT_INTERCEPT_RESOLUTION_PRIORITY,
  })
);
// Adblock setup end

export const search = async (query) => {
  const response = await get(`https://animego.org/search/all?q=${query}`);

  if (response.status !== 200) {
    return failureResponse('Can\'t load search page');
  }

  let result = [];

  const root = parse(response.data);
  const animeResultRoot = root.querySelector('.animes-grid');
  const animeItems = animeResultRoot.querySelectorAll('.animes-grid-item');

  animeItems.forEach((animeItem) => {
    let currentItemInfo = {};

    currentItemInfo.url = animeItem.querySelector('a').getAttribute('href');
    currentItemInfo.image = animeItem
      .querySelector('.lds-spinner')
      .parentNode.getAttribute('data-original');
    currentItemInfo.rate =
      animeItem.querySelector('.p-rate-flag__text').innerText;

    const textInfoItem = animeItem.querySelector('.animes-grid-item-body');
    currentItemInfo.originalTitle =
      textInfoItem.querySelector('.text-gray-dark-6')?.innerText;
    currentItemInfo.title = textInfoItem.querySelector('.card-title').innerText;
    currentItemInfo.year = textInfoItem.querySelector('.anime-year').innerText;

    result.push(currentItemInfo);
  });

  return successResponse(result);
};

export const info = async (url) => {
  const response = await get(url);

  if (response.status !== 200) {
    return failureResponse(`Can't load page ${url}`);
  }

  let result = {};

  const root = parse(response.data);
  result.rating = root.querySelector('.rating-value').innerText;
  result.ratingCount = root.querySelector('.rating-count').innerText;
  result.title = root
    .querySelector('.anime-title')
    .querySelector('h1').innerText;
  result.synonyms = [];

  const synonymsTitleElements = root
    .querySelector('.anime-title')
    .querySelector('ul')
    .querySelectorAll('li');
  synonymsTitleElements.forEach((el) => {
    result.synonyms.push(el.innerText);
  });

  result.animeInfo = [];

  const animeInfoElements = root
    .querySelector('.anime-info')
    .querySelectorAll('.col-6');
  let keys = [];

  for (const key in animeInfoElements) {
    const text = animeInfoElements[key].innerText.trim().replace(/\s+/g, ' ');

    if (text) {
      keys.push(text);
    }
  }

  for (let i = 0; i < keys.length; i += 2) {
    const key = keys[i];
    const value = keys[i + 1];

    result.animeInfo.push({ key, value });
  }

  result.description = root.querySelector('.description').innerText.trim();

  result.poster = root
    .querySelector('.anime-poster')
    .querySelector('img')
    .getAttribute('src');
  result.images = [];

  const imageElements = root
    .querySelector('.screenshots-block')
    .querySelectorAll('img');
  imageElements.forEach((el) => {
    result.images.push(el.getAttribute('src'));
  });

  result.trailer = root
    .querySelector('.video-block')
    .querySelector('a')
    .getAttribute('href');

  return successResponse(result);
};

export const streamInfo = async (
  url,
  proxyServer = null,
  emergencyCloseInMs = 10000,
  headless = 1
) => {
  try {
    const browser = await launch({
      args: proxyServer ? [`--proxy-server=${proxyServer}`] : [],
      headless,
    });
    const page = await browser.newPage();

    const emergencyClose = setupEmergencyClose(
      page,
      browser,
      emergencyCloseInMs
    );

    // Set screen size
    await page.setViewport({ width: 1920, height: 1080 });

    // Navigate the page to a URL
    await page.goto(url);
    await page.waitForFunction(() => {
      // eslint-disable-next-line no-undef
      document.querySelector('.video-player-online').scrollIntoView();
      // eslint-disable-next-line no-undef
      return !document.getElementById('loader-loading-player');
    });

    const translations = await page.evaluate(() => {
      let translations = [];
      // eslint-disable-next-line no-undef
      document
        .getElementById('video-dubbing')
        .querySelectorAll('.video-player-toggle-item')
        .forEach((el) => {
          translations.push(el.innerText.trim());
        });

      return translations;
    });

    const players = await page.evaluate(() => {
      let players = [];
      // eslint-disable-next-line no-undef
      document
        .getElementById('video-players')
        .querySelectorAll('.video-player-toggle-item')
        .forEach((el) => {
          if (!el.classList.contains('d-none')) {
            players.push(el.innerText.trim());
          }
        });

      return players;
    });

    await browser.close();

    clearTimeout(emergencyClose);

    return successResponse({ players, translations });
  } catch (e) {
    return failureResponse(e.message);
  }
};

const setupEmergencyClose = (page, browser, emergencyCloseInMs) => {
  return setTimeout(async () => {
    await page.close();
    await browser.close();
  }, emergencyCloseInMs);
};

export const stream = async (
  url,
  part,
  player,
  translation,
  proxyServer = null,
  headless = 1,
  emergencyCloseInMs = 10000
) => {
  try {
    const browser = await launch({
      args: proxyServer ? [`--proxy-server=${proxyServer}`] : [],
      headless,
    });
    const page = await browser.newPage();

    const emergencyClose = setupEmergencyClose(
      page,
      browser,
      emergencyCloseInMs
    );

    let stream = null;

    // Set screen size
    await page.setViewport({ width: 1920, height: 1080 });

    // Get stream url
    await page.setRequestInterception(true);

    // Listen to the 'response' event
    page.on('response', async (response) => {
      const url = response.url();
      const extension = url.split('.').pop(); // Extract file extension

      // Store the response
      if (extension === 'mpd' || extension === 'm3u8') {
        stream = url;
      }
    });

    // Navigate the page to a URL
    await page.goto(url);
    await page.waitForFunction(() => {
      // eslint-disable-next-line no-undef
      document.querySelector('.video-player-online').scrollIntoView();
      // eslint-disable-next-line no-undef
      return !document.getElementById('loader-loading-player');
    });

    await page.evaluate((part) => {
      // eslint-disable-next-line no-undef
      document.querySelector(`[data-episode="${part}"]`).click();
    }, part);

    await sleep(100);

    const players = await page.evaluate(() => {
      let players = [];
      // eslint-disable-next-line no-undef
      document
        .getElementById('video-players')
        .querySelectorAll('.video-player-toggle-item')
        .forEach((el) => {
          if (!el.classList.contains('d-none')) {
            players.push(el.innerText.trim().toLowerCase());
          }
        });

      return players;
    });

    // Find iframe
    let frame = null;

    while (!frame) {
      page.frames().find((f) => {
        players.forEach((p) => {
          if (f.url().includes(p)) {
            frame = f;
          }
        });
      });
      await sleep(100);
    }

    // Select translation
    const translationFound = await page.evaluate((translation) => {
      let found = false;
      // eslint-disable-next-line no-undef
      document
        .getElementById('video-dubbing')
        .querySelectorAll('.video-player-toggle-item')
        .forEach((el) => {
          if (el.innerText.trim().toLowerCase() === translation.toLowerCase()) {
            el.click();
            found = true;
          }
        });

      return found;
    }, translation);

    if (!translationFound) {
      await browser.close();
      return failureResponse(`Translation ${translation} not found`);
    }

    // Iframe updated, find new
    frame = null;
    while (!frame) {
      page.frames().find((f) => {
        players.forEach((p) => {
          if (f.url().includes(p)) {
            frame = f;
          }
        });
      });
      await sleep(100);
    }

    // Select player
    const playerFound = await page.evaluate((player) => {
      // eslint-disable-next-line no-undef
      document.getElementById('video-players-tab').click();

      let found = false;
      // eslint-disable-next-line no-undef
      document
        .getElementById('video-players')
        .querySelectorAll('.video-player-toggle-item')
        .forEach((el) => {
          if (!el.classList.contains('d-none')) {
            if (el.innerText.trim().toLowerCase() === player.toLowerCase()) {
              el.click();
              found = true;
            }
          }
        });

      return found;
    }, player);

    if (!playerFound) {
      await browser.close();
      return failureResponse(`Player ${player} not found`);
    }

    // Iframe updated, find new
    frame = null;
    while (!frame) {
      page.frames().find((f) => {
        players.forEach((p) => {
          if (f.url().includes(p)) {
            frame = f;
          }
        });
      });
      await sleep(100);
    }

    await sleep(250);

    // Remove 18+ confirmation
    try {
      await page.$eval('.overlay-censored', (el) => el.remove());
    } catch (e) {
      // pass
    }

    await sleep(100);

    let playButton = await frame.$('.vjs-big-play-button');
    if (!playButton) {
      playButton = await frame.$('.play_button');
    }

    await playButton.click();

    let tries = 0;
    while (!stream && tries < 100) {
      await sleep(100);
      tries++;
    }

    await browser.close();

    clearTimeout(emergencyClose);

    if (stream) {
      return successResponse(stream);
    } else {
      return failureResponse('Stream not found');
    }
  } catch (e) {
    return failureResponse(e.message);
  }
};

const failureResponse = (message) => {
  return { success: false, message };
};

const successResponse = (data) => {
  return { success: true, data };
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
