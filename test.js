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

// The arrays for holding the URL, article, and tweet 
let article_URL_Array = [];
let used_Url_Array = [];
let article_Content_Array = [];
let articleContent = [];
let tweet_Array = [];

/////////////////////////////////////////////////////////////////////////////
// SUMMERIZE WITH OPENAI -- SUMMERIZE WITH OPENAI -- SUMMERIZE WITH OPENAI //
/////////////////////////////////////////////////////////////////////////////

// fetch the API key for the first argument in the post request 
const OpenAPI_Key = process.env.OPEN_AI_API_KEY;
const configuration = new Configuration({
    apiKey: OpenAPI_Key,
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

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// FUNTION TO SCRAPE ARTICLE CONTENT -- FUNTION TO SCRAPE ARTICLE CONTENT -- FUNTION TO SCRAPE ARTICLE CONTENT //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////

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
function runTwitterBot() {
    axios.request(options).then(
        async function (response) {
        
            // remove old Titles, URL's, Articles, and Tweets from the previous day
            article_Content_Array = []; 
            tweet_Array = [];
            article_URL_Array = [];

            // loop through fetch data and push the URL's into an array
            console.log('Received data: ', response.data);
            response.data.forEach(data => {
                let url = data.url;

                // Check if we've already posted about this
                if (used_Url_Array.includes(url)) {
                    console.log(`Already used the story: ${url}`);
                } else {
                    article_URL_Array.push(url);
                    used_Url_Array.push(url);
                };
            });

            // Remove old articles that we've posted above to save on storage
            if (used_Url_Array.length > 50) {
                let numberOfOldArticles = 50 - used_Url_Array.length;
                used_Url_Array.splice(0, numberOfOldArticles);
            };
        
            // looping over each URL to scrape
            let formattedFullLengthArticles = [];
            console.log('article_URL_Array: ', article_URL_Array);
            for await (const url of article_URL_Array) {
                try {
                    if (url) {
                        let formattedFullLengthArticle = await scrapeArticle(url);
                        formattedFullLengthArticles.push(formattedFullLengthArticle);
                        console.log('The scraped article: ', formattedFullLengthArticle);
                    };
                } catch (error) {
                    console.log('Could not scarpe site: ', error.message);
                };
            };
            
            let theTweets = [];
            // looping over articles for OpenAI to summarize 
            for (const article of formattedFullLengthArticles) {
                if (article) {
                    let theTweet = await summarizeArticle(article);
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
                    // console.log('Current delay: ', delayValue);
                    // use an Immediately Invoked Function Expression (IIFE) to capture the current value of i at each iteration
                    setTimeout(((tweetContent) => () => tweet(tweetContent))(theTweets[i].replace(/['"]/g, '')), delayValue);
                    delayValue += oneHour;
                    // console.log('New delay: ', delayValue);
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

// function to scrape paragraph elements from URL
async function scrapeArticle(url) {
    
    console.log('Scraping the article with the URL of: ', url);

    // Set the cache directory within the writable /tmp directory
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
        await page.goto(url);

        // Wait 5 seconds, and scroll down
        await new Promise(resolve => setTimeout(resolve, 5000));
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

        // Wait a bit for any lazy-loaded content to load
        await new Promise(resolve => setTimeout(resolve, 2000));

        // select all the elements with the class of .at-text (Two Dollar Signs allows to fetch all elements, whereas one Dollar sign is the first element in the DOM)
        const paragraphElements = await page.$$('.at-text');

        // array to contain article content
        articleContent = [];

        // Loop through all paragraph elements
        for (const paragraph of paragraphElements) {
            let textContent = await paragraph.evaluate(el => el.textContent);
            let formattedTextContent = await textContent.replace(/'|’/g, '');
            articleContent.push(await formattedTextContent);
        };
        let formattedArticle = articleContent.join(' ');
        article_Content_Array.push(formattedArticle);

        await browser.close();

        console.log('scraped the site!');
        return formattedArticle;

    } catch(error) {
        console.log('In the scrapeArticle() function:' , error.message);
        await browser.close();
        console.log('Could not scrape the site...')
    };
};

const callToAction = ['\n\nFollow for more real time news ❤️', '\n\nShow support and press the buttons👇🏻🥹', '\n\nStay updated, hit follow! 🔔✨', '\n\nFollow for daily insights! 🧠📊', '\n\nDont miss out, follow today! 📈🔥', '\n\nGet the latest, follow here! 🎯⚡', '\n\nShare the love, follow us! 💙🔄', '\n\nTap follow for trending news! 📣🌍', '\n\nKeep up with us, hit follow! 🏃💡', '\n\nJoin our growing community! 🌱👥', '\n\nStay ahead, follow for updates! 🚀📲', '\n\nBe in the loop, follow and share! 🔄⭕', '\n\nFollow for your daily dose! ☕📅', '\n\nStay informed, tap follow! 🎓🌐', '\n\nJoin us, follow for more! 🤝🔝', '\n\nGet the scoop, follow now! 🍦📰', '\n\nFollow for real-time updates! ⏰🌟', '\n\nYour news hub, follow us! 📌🗂️', '\n\nStay current, follow us today! 📆🔍', '\n\nFollow and stay tuned! 📺🔊'];

async function summarizeArticle(scrapedArticle) {

    console.log('The article to summarize is: ', scrapedArticle);

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
        tweet_Array.push(finalTweet);
        // console.log(`OpenAI made the tweet: ${finalTweet}`);
        return finalTweet;
    } catch(error) {
        console.log('Could not use ChatGPT to summarize the scraped content: ', error.message);
    };
};
