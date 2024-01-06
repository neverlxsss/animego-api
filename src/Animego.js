const axios = require('axios');
const nodeHtmlParser = require('node-html-parser');
const {launch} = require("puppeteer");

const baseUrl = "https://animego.org";

const search = async (query) => {
    const response = await axios.get(`${baseUrl}/search/all?q=${query}`);

    if (response.status !== 200) {
        return failureResponse("Can't load search page");
    }

    let result = [];

    const root = nodeHtmlParser.parse(response.data);
    const animeResultRoot = root.querySelector(".animes-grid");
    const animeItems = animeResultRoot.querySelectorAll(".animes-grid-item");

    animeItems.forEach(animeItem => {
        let currentItemInfo = {};

        currentItemInfo.url = animeItem.querySelector("a").getAttribute("href");
        currentItemInfo.image = animeItem.querySelector(".lds-spinner").parentNode.getAttribute("data-original");
        currentItemInfo.rate = animeItem.querySelector(".p-rate-flag__text").innerText;

        const textInfoItem = animeItem.querySelector(".animes-grid-item-body");
        currentItemInfo.originalTitle = textInfoItem.querySelector(".text-gray-dark-6")?.innerText;
        currentItemInfo.title = textInfoItem.querySelector(".card-title").innerText;
        currentItemInfo.year = textInfoItem.querySelector(".anime-year").innerText;

        result.push(currentItemInfo);
    });

    return successResponse(result);
}

const info = async (url) => {
    const response = await axios.get(url);

    if (response.status !== 200) {
        return failureResponse(`Can't load page ${url}`);
    }

    let result = {};

    const root = nodeHtmlParser.parse(response.data);
    result.rating = root.querySelector(".rating-value").innerText;
    result.ratingCount = root.querySelector(".rating-count").innerText;
    result.title = root.querySelector(".anime-title").querySelector("h1").innerText;
    result.synonyms = [];

    const synonymsTitleElements = root.querySelector(".anime-title").querySelector("ul").querySelectorAll("li");
    synonymsTitleElements.forEach(el => {
        result.synonyms.push(el.innerText);
    });

    result.animeInfo = [];

    const animeInfoElements = root.querySelector(".anime-info").querySelectorAll(".col-6");
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

        result.animeInfo.push({key, value});
    }

    result.description = root.querySelector(".description").innerText.trim();

    result.poster = root.querySelector(".anime-poster").querySelector("img").getAttribute("src");
    result.images = [];

    const imageElements = root.querySelector(".screenshots-block").querySelectorAll("img");
    imageElements.forEach(el => {
        result.images.push(el.getAttribute("src"));
    });

    result.trailer = root.querySelector(".video-block").querySelector("a").getAttribute("href");


    return successResponse(result);
}

const streamInfo = async (url) => {
    const browser = await launch({headless: true});
    const page = await browser.newPage();

    // Set screen size
    await page.setViewport({width: 1920, height: 1080});

    // Navigate the page to a URL
    await page.goto(url);
    await page.waitForFunction(() => {
        document.querySelector('.video-player-online').scrollIntoView();
        return document.readyState === "complete" && !document.getElementById('loader-loading-player')
    });

    const translations = await page.evaluate(() => {
        let translations = [];
        document.getElementById('video-dubbing').querySelectorAll('.video-player-toggle-item').forEach(el => {
            translations.push(el.innerText.trim());
        });

        return translations;
    });

    const players = await page.evaluate(() => {
        let players = [];
        document.getElementById('video-players').querySelectorAll('.video-player-toggle-item').forEach(el => {
            if (!el.classList.contains("d-none")) {
                players.push(el.innerText.trim());
            }
        });

        return players;
    });

    await browser.close();

    return successResponse({players, translations})
}

const stream = async (url, player, translation) => {
    const browser = await launch({headless: true});
    const page = await browser.newPage();
    let stream = null;

    // Set screen size
    await page.setViewport({width: 1920, height: 1080});

    // Get stream url
    await page.setRequestInterception(true);

    // Listen to the 'request' event
    page.on('request', (request) => {
        // Allow all requests to continue
        request.continue();
    });

    // Listen to the 'response' event
    page.on('response', async (response) => {
        const url = response.url();
        const extension = url.split('.').pop(); // Extract file extension

        // Store the response
        if (extension === "mpd" || extension === "m3u8") {
            stream = url;
        }
    });

    // Navigate the page to a URL
    await page.goto(url);
    await page.waitForFunction(() => {
        document.querySelector('.video-player-online').scrollIntoView();
        return document.readyState === "complete" && !document.getElementById('loader-loading-player');
    });

    // Find iframe
    let frame = null;

    while (!frame) {
        frame = page.frames().find(frame => {
            return frame.url().includes("embed");
        });
        await sleep(100)
    }
    await frame.waitForSelector(".vjs-big-play-button");
    let playButton = await frame.$(".vjs-big-play-button");

    // Select translation
    const translationFound = await page.evaluate((translation) => {
        let found = false;
        document.getElementById('video-dubbing').querySelectorAll('.video-player-toggle-item').forEach(el => {
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

    await page.waitForFunction(() => {
        return !document.getElementById('loader-loading-player');
    });

    // Iframe updated, find new
    frame = null;
    while (!frame) {
        frame = page.frames().find(frame => {
            return frame.url().includes(player.toLowerCase());
        });
        await sleep(100)
    }

    // Select player
    const playerFound = await page.evaluate((player) => {
        document.getElementById("video-players-tab").click();

        let found = false;
        document.getElementById('video-players').querySelectorAll('.video-player-toggle-item').forEach(el => {
            if (!el.classList.contains("d-none")) {
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
        frame = page.frames().find(frame => {
            return frame.url().includes(player.toLowerCase());
        });
        await sleep(100)
    }

    playButton = await frame.$(".vjs-big-play-button");
    if (!playButton) {
        playButton = await frame.$(".play_button");
    }

    await playButton.click();

    let tries = 0;
    while (!stream && tries < 1000) {
        await sleep(100);
        tries++;
    }

    await browser.close();

    if (stream) {
        return successResponse(stream);
    } else {
        return failureResponse("Stream not found");
    }
}

const failureResponse = (message) => {
    return {success: false, message};
}

const successResponse = (data) => {
    return {success: true, data}
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

module.exports = {
    search,
    info,
    streamInfo,
    stream,
};