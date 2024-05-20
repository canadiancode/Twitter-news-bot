// packages installed (npm install _______):
    // dotenv:             for keeping the API keys hidden
    // axios:              promise-based HTTPS requests using node.js
    // puppeteer:          headless browser controlled by code
    // openai:             post prompt to OpenAI to summerize articles 
    // twitter-api-v2:     twitter API
    // node-cron:          CronJob is for scheduling the code to automatically run
    // path:               set the cache path for Heroku

// Require dotenv to import API keys and run .config to load the API keys into the index.js file 
require('dotenv').config();
const axios = require('axios');
const puppeteer = require('puppeteer');
const path = require('path');
const os = require('os');
const { OpenAIApi, Configuration } = require('openai');
const { TwitterApi } = require('twitter-api-v2');
const cron = require('node-cron');

// strings and numbers holding the market cap % increase data
let name = 'Bitcoin';
let market_cap_change_24H = 27.12123;
let market_cap = 50000000;
let ticker = 'BTC';
let marketCapTweet = '';

/////////////////////////////////////////////////////////////////////////////
// SUMMERIZE WITH OPENAI -- SUMMERIZE WITH OPENAI -- SUMMERIZE WITH OPENAI //
/////////////////////////////////////////////////////////////////////////////

// 2 imports from the OpenAI package
    // Configuration = object for defining things like API
    // OpenAIApi = provides an easy interface for interacting with the OpenAI API

// fetch the API key for the first argument in the post request 
const OpenAPI_Key = process.env.OPEN_AI_API_KEY;
const configuration = new Configuration({
    apiKey: OpenAPI_Key
});

// Add the fethced API to the first argument of the post request
const openai = new OpenAIApi(configuration);

///////////////////////////////////////////////////////////
// POST ON TWITTER -- POST ON TWITTER -- POST ON TWITTER //
///////////////////////////////////////////////////////////

// V2 (without image) //

const client = new TwitterApi({
    appKey: process.env.API_KEY,
    appSecret: process.env.API_SECRET,
    accessToken: process.env.ACCESS_TOKEN,
    accessSecret: process.env.ACCESS_SECRET,
});
const twitterClient = client.readWrite;

async function tweet(tweetContent) {
    try {
        console.log('tweeting!');
        if (tweetContent) {
            await twitterClient.v2.tweet(`${tweetContent}`);
        };
    } catch (error) {
        console.log('In the tweet() function: ', error.message);
    }
};

// V1 (only tweet + image) //

const clientOne = new TwitterApi({
    appKey: process.env.API_KEY,
    appSecret: process.env.API_SECRET,
    accessToken: process.env.ACCESS_TOKEN,
    accessSecret: process.env.ACCESS_SECRET,
});
const twitterClientOne = clientOne.readWrite;

async function tweetWithPhoto(tweetContent, imagePath) {
    try {
        if (tweetContent && tweetContent != 'undefined') {
            const mediaId = await twitterClientOne.v1.uploadMedia(imagePath);
            console.log('Media uploaded, tweeting...');
    
            let tweetStatus = await twitterClientOne.v2.tweet({
                text: tweetContent,
                media: { media_ids: [mediaId] }
            });
    
            console.log('Tweet posted successfully:', tweetStatus);
            return tweetStatus;
        };
        
    } catch (error) {
        console.error('Failed to post tweet:', error);
    }
};
// Example: tweetWithPhoto(text,img)

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// FUNTION TO SCRAPE ARTICLE CONTENT -- FUNTION TO SCRAPE ARTICLE CONTENT -- FUNTION TO SCRAPE ARTICLE CONTENT //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// require axios to be used for the HTTPS request and puppeteer for scraping data

// for the API key
const X_RapidAPI_KEY = process.env.X_RapidAPI_KEY;

const options = {
  method: 'GET',
  url: 'https://crypto-news16.p.rapidapi.com/news/top/5',

  headers: {
    'X-RapidAPI-Key': X_RapidAPI_KEY,
    'X-RapidAPI-Host': 'crypto-news16.p.rapidapi.com'
  }
};

// retrieve the URL's from Rapid API
let article_Url_Array = [];
let used_Url_Array = [];
let descriptions = [];
function runTwitterBot() {

    axios.request(options).then(
        async function (response) {

            // loop through fetch data and push the URL's into an array
            console.log('Received data: ', response.data);
            response.data.forEach(data => {
                let url = data.url;

                // check to see if this is the issue
                // article_Url_Array.push(url);
                // used_Url_Array.push(url);

                // Check if we've already posted about this
                if (used_Url_Array.includes(url)) {
                    console.log(`Already used the story: ${url}`);
                } else {
                    article_Url_Array.push(url);
                    descriptions.push(data.description);
                    used_Url_Array.push(url);
                };
            });

            // Remove old articles that we've posted above to save on storage
            if (used_Url_Array.length > 50) {
                // let numberOfOldArticles = 50 - used_Url_Array.length;
                // used_Url_Array.splice(0, numberOfOldArticles);
                used_Url_Array.splice(0, used_Url_Array.length - 50);
            };
            
            let theTweets = [];
            // looping over articles for OpenAI to summarize 
            console.log('The descriptions: ', descriptions);
            for (const description of descriptions) {
                if (description) {
                    let theTweet = await summarizeArticle(description);
                    console.log('The finalized tweet: ', theTweet);
                    theTweets.push(theTweet);
                };
            };

            // Trigger the tweets
            console.log('List of tweets: ', theTweets);
            const oneHour = 3600000;
            let delayValue = 0;
            for (let i = 0; i < theTweets.length; i++) {
                if (theTweets[i]) {
                    console.log('Current delay: ', delayValue);
                    // use an Immediately Invoked Function Expression (IIFE) to capture the current value of i at each iteration
                    setTimeout(((tweetContent) => () => tweet(tweetContent))(theTweets[i].replace(/['"]/g, '')), delayValue);
                    delayValue += oneHour;
                    console.log('New delay: ', delayValue);
                };
            };
        }
    ).catch(
        function (error) {
        console.error(error.message);
        console.log('Could not tweet articles...');
    });
};
runTwitterBot();

// Scrape paragraph elements from URL via puppeteer //
async function scrapeArticle(url) {

    // Set the cache directory within the writable /tmp directory
    // AWS Lightsail: /home/bitnami/.cache/puppeteer
    const cacheDir = path.join(__dirname, '/tmp/cache/puppeteer');

    // set up the browser and navigate to URL
    const browser = await puppeteer.launch({
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--no-zygote',
            '--single-process',
            `--disk-cache-dir=${cacheDir}`
            ],
            executablePath: process.env.GOOGLE_CHROME_BIN || '',
            headless: true
    });

    try {

        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'networkidle0' });
        await page.setBypassCSP(true);

        console.log('I made it!');

        // Wait 1 second, and scroll down
        await new Promise(resolve => setTimeout(resolve, 1000));
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    
        console.log('AT THE BOTTOM DAWG');

        // Option 1
        await page.waitForSelector('.at-text', {timeout: 5000});
        const paragraphElements = await page.$$('.at-text');
        
        // console.log('paragraphElements: ', paragraphElements);
        
        // array to contain article content
        let articleContent = [];

        // Loop through all paragraph elements
        for await (const paragraph of paragraphElements) {
            // console.log('paragraph: ', paragraph);
            let textContent = await paragraph.evaluate(el => el.textContent);
            let formattedTextContent = await textContent.replace(/'|’/g, '');
            // console.log('formattedTextContent: ', formattedTextContent);
            articleContent.push(await formattedTextContent);
        };
        let formattedArticle = articleContent.join(' ');
        console.log('scraped the site!');
        return formattedArticle;
    } catch(error) {
        console.log('In the scrapeArticle() function:' , error.message);
        console.log('Could not scrape the site...')
    } finally {
        await browser.close();
    };
};

const callToAction = ['\n\nFollow for more real time news ❤️', '\n\nShow support and press the buttons👇🏻🥹', '\n\nStay updated, hit follow! 🔔✨', '\n\nFollow for daily insights! 🧠📊', '\n\nDont miss out, follow today! 📈🔥', '\n\nGet the latest, follow here! 🎯⚡', '\n\nShare the love, follow us! 💙🔄', '\n\nTap follow for trending news! 📣🌍', '\n\nKeep up with us, hit follow! 🏃💡', '\n\nJoin our growing community! 🌱👥', '\n\nStay ahead, follow for updates! 🚀📲', '\n\nBe in the loop, follow and share! 🔄⭕', '\n\nFollow for your daily dose! ☕📅', '\n\nStay informed, tap follow! 🎓🌐', '\n\nJoin us, follow for more! 🤝🔝', '\n\nGet the scoop, follow now! 🍦📰', '\n\nFollow for real-time updates! ⏰🌟', '\n\nYour news hub, follow us! 📌🗂️', '\n\nStay current, follow us today! 📆🔍', '\n\nFollow and stay tuned! 📺🔊'];

// Send the article to chatGPT, and construct the tweet //
async function summarizeArticle(scrapedArticle) {

    const callToAction = ['\n\nFollow for more real time news ❤️', '\n\nShow support and press the buttons👇🏻🥹', '\n\nStay updated, hit follow! 🔔✨', '\n\nFollow for daily insights! 🧠📊', '\n\nDont miss out, follow today! 📈🔥', '\n\nGet the latest, follow here! 🎯⚡', '\n\nShare the love, follow us! 💙🔄', '\n\nTap follow for trending news! 📣🌍', '\n\nKeep up with us, hit follow! 🏃💡', '\n\nJoin our growing community! 🌱👥', '\n\nStay ahead, follow for updates! 🚀📲', '\n\nBe in the loop, follow and share! 🔄⭕', '\n\nFollow for your daily dose! ☕📅', '\n\nStay informed, tap follow! 🎓🌐', '\n\nJoin us, follow for more! 🤝🔝', '\n\nGet the scoop, follow now! 🍦📰', '\n\nFollow for real-time updates! ⏰🌟', '\n\nYour news hub, follow us! 📌🗂️', '\n\nStay current, follow us today! 📆🔍', '\n\nFollow and stay tuned! 📺🔊'];

    try {

        const prompt = `Compose a viral-worthy tweet between 120-130 characters summarizing the article below. Include two relevant hashtags at the end. Ensure the tweet, including spaces, punctuation, and hashtags, stays within the specified character range of 120-130 characters:
        ${scrapedArticle}
        `;
    
        // find the different models here: https://platform.openai.com/docs/models
        const response = await openai.createCompletion({
            model: 'gpt-3.5-turbo-instruct',
            prompt: prompt,
            max_tokens: 100,
            temperature: 0
        });
        console.log('Response from GPT: ', response.data.choices[0].text);
        // get random call to action index
        const getRandomIndex = (arrayLength) => {
            return Math.floor(Math.random() * arrayLength);
        };
        const randomIndex = await getRandomIndex(callToAction.length);
        let summarizedTweet = response.data.choices[0].text;
        let formattedTweet = summarizedTweet.trim();
        let finalTweet = formattedTweet.concat(callToAction[randomIndex]);
        // console.log(`OpenAI made the tweet: ${finalTweet}`);
        return finalTweet;
    } catch(error) {
        console.log('Could not use ChatGPT to summarize the scraped content: ', error.message);
    };
};

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// FUNTION TO SCRAPE ARTICLE CONTENT -- FUNTION TO SCRAPE ARTICLE CONTENT -- FUNTION TO SCRAPE ARTICLE CONTENT //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// Small-Cap Market Capitalization Change //
async function fetchMarketCapData() {
    
    const priceDataEndpoint = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=volume_desc&per_page=500&page=1&sparkline=false&price_change_percentage=24h&locale=en';

    try {
        // Send axios request to fetch data:
        const response = await axios.get(priceDataEndpoint);
        const topAssetObject = await findMaxPriceChange(response.data);

        // Change values for the top asset:
        name = topAssetObject.name;
        market_cap_change_24H_unformatted = topAssetObject.market_cap_change_percentage_24h.toFixed(0);
        market_cap_change_24H = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 3 }).format(market_cap_change_24H_unformatted);
        market_cap_unformatted = topAssetObject.market_cap.toFixed(0);
        market_cap = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 3 }).format(market_cap_unformatted);
        ticker = topAssetObject.symbol.toUpperCase();

        // Tweet templates:
        const tweetTemplates = [
            `\`📈 The market cap of ${name} $${ticker} is up ${market_cap_change_24H}%, bringing the current value to $${market_cap}.\``,
        
            `\`🌟 As of today, ${name} $${ticker} has seen a ${market_cap_change_24H}% change in market cap over the last 24 hours, now standing at $${market_cap}.\``,
        
            `\`📊 ${name}'s $${ticker} market capitalization has adjusted by ${market_cap_change_24H}% in the past day, reaching a value of $${market_cap}.\``,
        
            `\`📊 In recent market activity, ${name} $${ticker} experienced a ${market_cap_change_24H}% shift in its market cap in 24 hours, which is currently $${market_cap}.\``,
        
            `\`💰 The latest update shows a ${market_cap_change_24H}% variation in the market cap of ${name} $${ticker}, now valued at $${market_cap}. in 24 hours.\``,
        
            `\`🔼 Trending now: ${name} $${ticker} with a ${market_cap_change_24H}% movement in market cap in 24 hours, which is presently at $${market_cap}.\``,
        
            `\`👀 Market update: The cap of ${name} $${ticker} changed by ${market_cap_change_24H}% in 24 hours, bringing its current market valuation to $${market_cap}.\``,

            `\`🔔 The market cap of ${name} $${ticker} has shifted by ${market_cap_change_24H}% in the last 24 hours, now totaling $${market_cap}.\``,
            
            `\`⛓️ #Crypto update: ${name} $${ticker} reports a market cap change of ${market_cap_change_24H}% over the past day, culminating in a market value of $${market_cap}.\``,

            `\`📰 Market brief: The market cap of ${name} $${ticker} has experienced a ${market_cap_change_24H}% change in the last 24 hours, now at $${market_cap}.\``,
            
            `\`📊 Market snapshot: ${name} $${ticker} shows a significant ${market_cap_change_24H}% change in market cap in the last day, with a new value of $${market_cap}.\``,

            `\`📋 Market update: ${name} $${ticker} has undergone a ${market_cap_change_24H}% change in market cap, now valued at $${market_cap}, over the last 24 hours.\``,

            `\`🌟 Big moves! ${name} $${ticker} market cap just jumped ${market_cap_change_24H}%, hitting $${market_cap}. Something's brewing!\``,

            `\`🔔 Market alert! ${name} $${ticker} is shaking things up with a ${market_cap_change_24H}% change in market cap. Current value: $${market_cap}.\``,

            `\`👀 Something to watch: ${name} $${ticker} market cap soared ${market_cap_change_24H}%, now at $${market_cap}.\``
        ];

        let randomIndex = Math.round(Math.random() * tweetTemplates.length) - 1;
        marketCapTweet = tweetTemplates[randomIndex];
        
        // Send the tweet to Twitter
        tweet(marketCapTweet.replace(/^`|`$/g, ''));

    } catch (error) {
        console.error('Error making HTTP request:', error);
    };
};
// Filter & find most appreciating asset within a 24H period containing the necessary info
function findMaxPriceChange(dataArray) {
    if (!dataArray || dataArray.length === 0) {
        return null;
    };
    let maxChangeObject = dataArray[0];
    for (let i = 1; i < dataArray.length; i++) {
        if ((dataArray[i].name) && (dataArray[i].symbol) && (dataArray[i].market_cap > 10000) && (dataArray[i].market_cap_change_24h) && (dataArray[i].price_change_percentage_24h) && (dataArray[i].price_change_percentage_24h > maxChangeObject.price_change_percentage_24h)) {
            maxChangeObject = dataArray[i];
        }
    };
    return maxChangeObject;
};

// GOOD MORNING TWEETS //
let gmTweets = [
    'Gm',
    'gmgmᵍᵐ',
    'Gmᵍᵐ',
    'Grand rising my frens',
    'GM to all my $sol soldiers',
    'GM to everyone but $eth maxis',
    'Gm: get money.',
    'Gm - another day on a floating rock.',
    'GM (with rizz)',
    'gm: it is a lifestyle!🌞',
    'GM Frens🥳',
    'GM: say it back😡',
    'gm, go touch grass (with haste)',
    'Gm to everyone except @PeterSchiff',
    'GM - Daily reminder that $BTC and #Crypto are not the same.',
    'GM: remember to affirm that you are not exit liquidity today.',
    'GM: say it back (please)🥺',
    'gm degens, what we buyin today❓',
    'Gm.. any #airdrops that I should know about?🪂',
    'slept four hours, what are we buying fam?',
    'Gooooooooooooooooooooooooooood morning',
    'Goooooooooooooooooooooooood morning',
    'Gooooooooooooooooooooood morning',
    'Gooooooooooooooooooood morning',
    'Goooooooooooooooood morning',
    'Goooooooooood morning',
    'Goooooood morning',
    'Gooood morning',
    'Gm - lets crush it.',
    'Gm: do something your future will thank you for',
    'Gm, touch grass.',
    'gm 𝕏 fam',
    'Gm, may you be blessed with no liquidations',
    'AHHHHHH im going to GMMMMMM',
    'Profession: saying GM on X',
    'Gm. get after it.',
    'GM. You have a mission. Get to work.'
];  
function gmTweet() {
    // get random tweet
    let randomIndex = Math.round(Math.random() * gmTweets.length) - 1;
    let selectedGmTweet = gmTweets[randomIndex];
    console.log(selectedGmTweet)
    // tweet the content
    tweet(selectedGmTweet);
};

// GOOD NIGHT TWEETS //
let gnTweets = [
    'GN🌝',
    'GN to all my $sol soldiers⚡',
    'GN to everyone but $eth maxis',
    'GN i pray for no liquidation email🥶',
    'Goodnight cryptocurrency enthusiasts⚡',
    'GN everyone except @GaryGensler 👿',
    'GN i hope you experience the cool side of the pillow tn🥶',
    'GN don’t let bed bugs bite🦋',
    'Sweet dreams my fellow degens',
    'GN: don’t forget $sol will flip $eth 🤓',
    'sleep tight online frens🚀',
    'time to teleport 8 hours, gn❤️',
    'may we wake up to a pump, gn📈',
    'Get your eight hours tn, gn.',
    'GN time to battle my sleep demons👺',
    'GN, may the pump be with you🥰',
    'Life is good when you’re excited to wake up. GN fam🥰',
    'GN: see yall in six hours'
];  
function gnTweet() {
    // get random tweet
    let randomIndex = Math.round(Math.random() * gnTweets.length) - 1;
    let selectedGnTweet = gnTweets[randomIndex];
    console.log(selectedGnTweet)
    // tweet the content
    tweet(selectedGnTweet);
};

// QUOTES & SHIT TWEETS //
const quotesTweets = [
    `$BTC and #Crypto are not the same. Never have been. Never will be`,
    `#BTC exists to shelter you from inflation. Crypto exists to enrich founders.`,
    `What is comfortable is rarely profitable.`,
    `Optimism and altruism go hand in hand.`,
    `Invest now. Investigate later. Wisdom from @georgesoros`,
    `You have to be comfortable losing before you can win`,
    `Long until wrong > shorting til right`,
    `Bulls make money. Bears make money. Pigs get slaughtered.`,
    `A turkey lives a great life for 1000 days. Then it's served for dinner.`,
    `Daily reminder: $BTC will become the global reserve asset.`,
    `$BTC is the soundest money to ever exist.`,
    `Don’t forget, our investing thesis is free: https://learn2earn.network/momentum-based-investing-a-thesis-for-cryptocurrency/`,
    `When you have conviction, go for the throat.`,
    `#Crypto is an asymmetric game of hot potato. Don’t get left holding the bag.`,
    `I’m here to get rich in terms of #satoshis and #dollars. Will openly admit it. Anyone else?`,
    `Tech is cool, but I’m here to get paid. Who else?`,
    `Daily reminder: $BTC is a green investment.`,
    `A fit body, a calm mind, a house full of love. These cannot be bough.`,
    `“You make your own luck if you stay at it long enough.”`,
    `The harder I work, the luckier I get.`,
    `Daily reminder that the stock market and the economy are different. Convergence is typically convex in opportunity.`,
    `First step: make money. Second step: don’t lose it.`,
    `May the wick ever be in your favor.`,
    `Making money is easy. Hard part is keeping it.`,
    `Don’t take yourself so seriously. You’re just a monkey with a plan.`,
    `Passion looks like hard work from the outside, but feels effortless.`,
    `The three most harmful addictions are heroin, carbohydrates, and a salary.`,
    `A Stoic is someone who transforms fear into prudence, pain into transformation, mistakes into initiation, and desire into undertaking`,
    `It's not whether you're right or wrong, but how much money you make when you're right and how much you lose when you're wrong.`,
    `Daily Reminder: the market has exhibited 0 preference to decentralized technology`,
    `You wouldn’t stand in front of a missing train. Don’t short a trending market because you’re bored. Hedge when you have a reason,`
];
function quotesTweet() {
    // get random tweet
    let randomIndex = Math.round(Math.random() * quotesTweets.length) - 1;
    let selectedQuoteTweet = quotesTweets[randomIndex];
    console.log(selectedQuoteTweet)
    // tweet the content
    tweet(selectedQuoteTweet);
};

// FEAR AND GREED DATA AND IMAGE //

// Take screenshot of Fear & Greed //
async function FearAndGreed() {

    const url = 'https://alternative.me/crypto/fear-and-greed-index/';
    const cacheDir = path.join(__dirname, '/tmp/cache/puppeteer');
    
    const browser = await puppeteer.launch({
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--no-zygote',
            '--single-process',
            `--disk-cache-dir=${cacheDir}`
        ],
        executablePath: process.env.GOOGLE_CHROME_BIN || '',
        headless: true
    });

    try {

        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 2 });
        await page.goto(url);
        await page.waitForSelector('.fng-value');

        const element = await page.$('.columns .box');
        if (element) {
            // Generate a temporary file path for the screenshot
            const tmpDir = os.tmpdir();
            const filePath = path.join(tmpDir, 'screenshot.png');

            await element.screenshot({
                path: filePath,
                quality: 100,
                type: 'jpeg'
            });

            console.log('Screenshot taken and saved to:', filePath);

            // Generate text
            let tweetText = await tweetCopyConstruction();
            console.log('The text of the tweet will be: ', tweetText);

            // Pass the path of the temporary file to tweetWithPhoto
            let statusOfTweet = await tweetWithPhoto(tweetText, filePath);

            console.log('Tweet status: ', statusOfTweet);
        } else {
            console.log('Element not found');
        };
    } catch (error) {
        console.error('Error taking screenshot or tweeting:', error);
    } finally {
        await browser.close();
    };
};
// FearAndGreed();

// Generate fear and and greed text //
async function generateText() {

    const url = 'https://alternative.me/crypto/fear-and-greed-index/';

    console.log('Starting the scrape process for the text..');

    // Set the cache directory within the writable /tmp directory
    // Use this for AWS: /home/bitnami/.cache/puppeteer
    const cacheDir = path.join(__dirname, '/tmp/cache/puppeteer');
    
    // set up the browser and navigate to URL
    const browser = await puppeteer.launch({
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--no-zygote',
            '--single-process',
            `--disk-cache-dir=${cacheDir}`
            ],
            executablePath: process.env.GOOGLE_CHROME_BIN || '', // local
            // executablePath: '/usr/bin/google-chrome-stable', // AWS
            headless: true
    });

    try {

        const page = await browser.newPage();
        await page.goto(url);

        // attempt to fix AWS:h
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });  // Wait until no new network connections are made within 500ms

        // Wait for lazy-loaded content to load
        await page.waitForSelector('.fng-value');

        console.log('Waited for the fng-value class to load');

        const fearAndGreedValues = await page.evaluate(() => {
            const values = [];
            const divs = document.querySelectorAll('.fng-value');

            divs.forEach(div => {
                const nowValue = div.querySelector('.gray').textContent.trim();
                const sentimentValue = div.querySelector('.status').textContent.trim();
                const numberValue = div.querySelector('.fng-circle').textContent.trim();
                values.push({ nowValue, sentimentValue, numberValue });
            });

            return values;
        });

        console.log('extracted the text from the site');
        return fearAndGreedValues;

    } catch(error) {
        console.log(error.message);
        console.log('Could not scrape the site...')
    } finally {
        await browser.close();
    };
};

// Generate Hashtags //
function generateHashtags() {

    let hashtagArray = ['#crypto', '#Bitcoin', '#fearandgreed', '#blockchain', '#btc', '#cryptocurrency', '#btcsentiment', '#bitcoinsentiment'];

    try {
    
        let previousIndexes = [];
    
        let firstIndex = generateRandomIndex();
    
        previousIndexes.push(firstIndex);
    
        for (let i = 0; i < 1000; i++) {
    
            let secondIndex = generateRandomIndex();
    
            if (secondIndex != firstIndex) {
    
                for (let j = 0; j < 1000; j++) {
                    let thirdIndex = generateRandomIndex();
                    if (thirdIndex != secondIndex && thirdIndex != firstIndex) {
                        console.log(`${hashtagArray[firstIndex]} ${hashtagArray[secondIndex]} ${hashtagArray[thirdIndex]}`);
                        return `${hashtagArray[firstIndex]} ${hashtagArray[secondIndex]} ${hashtagArray[thirdIndex]}`;
                    };
                };
    
            };
        };
    } catch (error) {
        console.log('Could not generate hashtags: ', error.message);
    };

    function generateRandomIndex() {
        let randomIndexValue = Math.floor(Math.random() * hashtagArray.length);
        return randomIndexValue;
    };
};

// Construct the Tweet copy //
async function tweetCopyConstruction() {

    try {

        // scrape site
        let fearAndGreedValues = await generateText();
        console.log('Fear and greed vals:', fearAndGreedValues);

        // generate related hashtags
        let hashtags = await generateHashtags();

        // add scraped values to tweet template
        const tweetTemplate = 
            `#CRYPTO FEAR & GREED UPDATE 🚨 
${fearAndGreedValues[0].nowValue}: ${fearAndGreedValues[0].numberValue} (${fearAndGreedValues[0].sentimentValue})
${fearAndGreedValues[1].nowValue}: ${fearAndGreedValues[1].numberValue} (${fearAndGreedValues[1].sentimentValue})
${fearAndGreedValues[2].nowValue}: ${fearAndGreedValues[2].numberValue} (${fearAndGreedValues[2].sentimentValue})
${fearAndGreedValues[3].nowValue}: ${fearAndGreedValues[3].numberValue} (${fearAndGreedValues[3].sentimentValue})

${hashtags}
`;
        // Return the generated text
        return tweetTemplate;
    } catch (error) {
        console.log('Failed to construct tweet: ', error.message);
    };
};


//////////////////////////
// SCHEDULE THE CRONJOB //
//////////////////////////

// '0 6,12 * * *'
    // 0 = minutes
    // 6,12 = should run at 6am and 12pm
    // * = The day of the month when the task should run. The asterisk * means every day of the month.
    // * = he month when the task should run. The asterisk * here means every month.
    // * = The day of the week when the task should run

// Crypto News //
const scheduledNewsTweets = cron.schedule('0 6 * * *', runTwitterBot, {
    scheduled: true,
    timezone: 'America/Los_Angeles',
});
scheduledNewsTweets.start();

// Market Cap Data //
const scheduledMarketCapTweets = cron.schedule('0 8,14,19 * * *', fetchMarketCapData, {
    scheduled: true,
    timezone: 'America/Los_Angeles',
});
scheduledMarketCapTweets.start();

// Good Morning //
const scheduledGmTweets = cron.schedule('0 7 * * *', gmTweet, {
    scheduled: true,
    timezone: 'America/Los_Angeles',
});
scheduledGmTweets.start();

// Good Night //
const scheduledGnTweets = cron.schedule('0 1 * * *', gnTweet, {
    scheduled: true,
    timezone: 'America/Los_Angeles',
});
scheduledGnTweets.start();

// Quote Tweet //
const scheduledQuoteTweets = cron.schedule('0 9,15 * * *', quotesTweet, {
    scheduled: true,
    timezone: 'America/Los_Angeles',
});
scheduledQuoteTweets.start();

// Fear & Greed Screenshot //
const scheduledFearAndGreedTweets = cron.schedule('0 12 * * 2,4', FearAndGreed, {
    scheduled: true,
    timezone: 'America/Los_Angeles',
});
scheduledFearAndGreedTweets.start();