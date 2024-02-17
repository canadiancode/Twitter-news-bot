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

///////////////////////////////////////////////////////////
// POST ON TWITTER -- POST ON TWITTER -- POST ON TWITTER //
///////////////////////////////////////////////////////////

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
        console.log('tweeting!');
        await twitterClient.v2.tweet(`${tweetContent}`);
    } catch (error) {
        console.log(error);
    }
};

////////////////////////////////
// APP WORKFLOW FOR THE TWEET // 
////////////////////////////////

// GOOD MORNING TWEETS //
let testTweets = [`There's #Bitcoin, and then there's everything else`, `what's comfortable is rarely profitable`, `Rule No.1: Never lose money. Rule No.2: Never forget rule No.1.`];
function testTweet() {
    // get random tweet
    let randomIndex = Math.round(Math.random() * testTweets.length) - 1;
    let selectedTweet = testTweets[randomIndex];
    console.log(selectedTweet)
    // tweet the content
    tweet(selectedTweet);
};
testTweet();

//////////////////////////
// SCHEDULE THE CRONJOB //
//////////////////////////

const cron = require('node-cron');

// '0 6,12 * * *'
    // 0 = minutes
    // 6,12 = should run at 6am and 12pm
    // * = The day of the month when the task should run. The asterisk * means every day of the month.
    // * = he month when the task should run. The asterisk * here means every month.
    // * = The day of the week when the task should run

// Good morning //
const scheduledTestTweets = cron.schedule('0 7 * * *', testTweet, {
    scheduled: true,
    timezone: 'America/Los_Angeles',
});
scheduledTestTweets.start();