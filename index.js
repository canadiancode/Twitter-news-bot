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

// The arrays for holding the URL, article, and tweet 
let article_URL_Array = [];
let used_Url_Array = [];
let article_Title_Array = [];
let article_Content_Array = [];
let articleContent = [];
let tweet_Array = [];

// FUNTION TO SCRAPE ARTICLE CONTENT -- FUNTION TO SCRAPE ARTICLE CONTENT -- FUNTION TO SCRAPE ARTICLE CONTENT

const puppeteer = require('puppeteer');

// for the cache configuration
const path = require('path');

// function to scrape paragraph elements from URL
async function scrapeArticle(url) {

    try {

        // Set the cache directory within the writable /tmp directory
        const cacheDir = path.join(__dirname, '/tmp/cache/puppeteer');

        // set up the browser and navigate to URL
        const browser = await puppeteer.launch({
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--single-process',
                '--no-zygote',
                `--disk-cache-dir=${cacheDir}`
              ],
              executablePath: process.env.GOOGLE_CHROME_BIN || '',
              headless: true
        });
        const page = await browser.newPage();
        await page.goto(url);

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

        console.log('scraped the site!')

    } catch(error) {
        console.log(error);
        console.log('Could not scrape the site...')
    };
};

// SUMMERIZE WITH OPENAI -- SUMMERIZE WITH OPENAI -- SUMMERIZE WITH OPENAI

// 2 imports from the OpenAI package
    // Configuration = object for defining things like API
    // OpenAIApi = provides an easy interface for interacting with the OpenAI API
const { Configuration, OpenAIApi } = require('openai');

// fetch the API key for the first argument in the post request 
const OpenAPI_Key = process.env.OPEN_AI_API_KEY;
const configuration = new Configuration({
    apiKey: OpenAPI_Key,
});

// Add the fethced API to the first argument of the post request
const openai = new OpenAIApi(configuration);

// Function to request OpenAI to run prompt\

const callToAction = ['\n\nFollow for more real time news ❤️', '\n\nShow support and press the buttons👇🏻🥹', '\n\nStay updated, hit follow! 🔔✨', '\n\nFollow for daily insights! 🧠📊', '\n\nDont miss out, follow today! 📈🔥', '\n\nGet the latest, follow here! 🎯⚡', '\n\nShare the love, follow us! 💙🔄', '\n\nTap follow for trending news! 📣🌍', '\n\nKeep up with us, hit follow! 🏃💡', '\n\nJoin our growing community! 🌱👥', '\n\nStay ahead, follow for updates! 🚀📲', '\n\nBe in the loop, follow and share! 🔄⭕', '\n\nFollow for your daily dose! ☕📅', '\n\nStay informed, tap follow! 🎓🌐', '\n\nJoin us, follow for more! 🤝🔝', '\n\nGet the scoop, follow now! 🍦📰', '\n\nFollow for real-time updates! ⏰🌟', '\n\nYour news hub, follow us! 📌🗂️', '\n\nStay current, follow us today! 📆🔍', '\n\nFollow and stay tuned! 📺🔊'];

async function summarizeArticle(scrapedArticle) {

    try {

        const prompt = `Compose a viral-worthy tweet between 120-140 characters summarizing the article below. Include two relevant hashtags at the end. Ensure the tweet, including spaces, punctuation, and hashtags, stays within the specified character range:
        ${scrapedArticle}
        `;
    
        // find the different models here: https://platform.openai.com/docs/models
        const response = await openai.createCompletion({
            model: 'text-davinci-003',
            prompt: prompt,
            max_tokens: 100,
            temperature: 0
        });

        // get random call to action index
        const getRandomIndex = (arrayLength) => {
            return Math.floor(Math.random() * arrayLength);
        };
        const randomIndex = getRandomIndex(callToAction.length);
    
        let summarizedTweet = response.data.choices[0].text;
        let formattedTweet = summarizedTweet.trim();
        let finalTweet = formattedTweet.concat(callToAction[randomIndex]);
        tweet_Array.push(finalTweet);
        console.log(`OpenAI made the tweet: ${finalTweet}`);

    } catch(error) {
        console.log(error);
        console.log('Could not use ChatGPT to summarize the scraped content...')
    };
};

// POST ON TWITTER -- POST ON TWITTER -- POST ON TWITTER

const { TwitterApi } = require('twitter-api-v2');

const client = new TwitterApi({
    appKey: process.env.API_KEY,
    appSecret: process.env.API_SECRET,
    accessToken: process.env.ACCESS_TOKEN,
    accessSecret: process.env.ACCESS_SECRET,
});
const twitterClient = client.readWrite;

async function tweet(tweetContent) {
    try {
        console.log('tweeting!')
        await twitterClient.v2.tweet(`${tweetContent}`);
    } catch (error) {
        console.log(error);
    }
};

// APP WORKFLOW START --  APP WORKFLOW START  -- APP WORKFLOW START

// require axios to be used for the HTTPS request and puppeteer for scraping data
const axios = require("axios");

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

// running this function using CronJob

// retrieve the URL's from Rapid API

function runTwitterBot() {

    axios.request(options).then(

        async function (response) {
    
        // remove old Titles, URL's, Articles, and Tweets from the previous day
        article_Title_Array = [];   
        article_Content_Array = []; 
        tweet_Array = [];
        article_URL_Array = [];

    
        // loop through fetch data and push the URL's into an array
        response.data.forEach(data => {
            let title = data.title;
            let url = data.url;
            article_Title_Array.push(title);

            if (used_Url_Array.includes(url)) {
                console.log('already used the story');
            } else {
                article_URL_Array.push(url);
                used_Url_Array.push(url);
            };
        });

        if (used_Url_Array.length > 50) {
            let numberOfOldArticles = 50 - used_Url_Array.length;
            used_Url_Array.splice(0, numberOfOldArticles);
        };
    
        // looping over each URL to scrape
        for (let i = 0; i < article_URL_Array.length; i++) {
            await scrapeArticle(article_URL_Array[i]);
        };
    
        // looping over articles for OpenAI to summarize 
        for (const article of article_Content_Array) {
            await summarizeArticle(article);
        };
    
        // posting the tweets made fro OpenAI
        console.log('starting the for loop after summarizing all articles');
        for (const tweetPost of tweet_Array) {
            if (tweetPost === tweet_Array[0]) {
                await tweet(tweetPost)
                console.log(tweetPost)
            } else if (tweetPost === tweet_Array[1]) {
                setTimeout(await function() {
                    tweet(tweetPost)
                    console.log(tweetPost)
                }, 10800000)  // 10800000 = 3 hours // 300000 = 5 minutes
            } else if (tweetPost === tweet_Array[2]) {
                setTimeout(await function() {
                    tweet(tweetPost)
                    console.log(tweetPost)
                }, 21600000) // 21600000 = 6 hours  // 600000 = 10 minutes
            } else {
                console.log('No additional tweets to send out');
            }
        };
    
    }).catch(
        function (error) {
        console.error(error);
        console.log('Could not tweet articles...');
    });

};

runTwitterBot();


// SCHEDULE THE CRONJOB

const cron = require('node-cron');

// Schedule the task to run at 6 am PST every day
const scheduledTask = cron.schedule('0 6 * * *', runTwitterBot, {
  scheduled: true,
  timezone: 'America/Los_Angeles',
});

// Start the scheduled task
scheduledTask.start();


// Keep the process running with an empty asynchronous function
// (async () => {})();