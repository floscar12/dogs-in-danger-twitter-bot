require("dotenv").config({ path: __dirname + "/.env" });

const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const { promisify } = require("util");
const writeFileAsync = promisify(fs.writeFile);
const CronJob = require("cron").CronJob;

const express = require('express')
const app = express()
const port = process.env.PORT || 4000;

app.listen(port, () => {
    console.log(`Listening on port ${port}`)
})

const { twitterClient } = require("./twitterClient.js");

// Since there is only one way to fetch memorials, it grabs the latest one. If the latest one
// has already been posted, it does not post until next time to tweet
let lastMemorialDogName = "bennie";

const heartEmojis = ["❤️", "🧡", "💛", "💚", "💙", "💜"];
const getStateName = (state) => {
    let stateName;

    switch (state) {
        case "CA":
            stateName = "california";
            break;
        case "FL":
            stateName = "florida";
            break;
        case "GA":
            stateName = "georgia";
            break;
        case "IL":
            stateName = "illinois";
            break;
        case "MS":
            stateName = "mississippi";
            break;
        case "NM":
            stateName = "newmexico";
            break;
        case "NY":
            stateName = "newyork";
            break;
        case "OH":
            stateName = "ohio";
            break;
        case "TX":
            stateName = "texas";
            break;
        default:
            stateName = "";
    }

    return stateName;
}

const scrapeAndTweetLatestMemorial = async () => {
    try {
        // Fetch the webpage
        const response = await axios.get("https://www.dogsindanger.com/memorial.jsp");
        const html = response.data;

        // Use cheerio to parse the HTML
        const $ = cheerio.load(html);
        // Find the first memorial div
        const memorialDiv = $(".memorial").first();

        // Extract the image URL
        const imageUrl = memorialDiv.find(".memorialPic").attr("src");

        // Download the image
        const imageResponse = await axios.get(imageUrl, { responseType: "arraybuffer" });
        const imageBuffer = Buffer.from(imageResponse.data);

        // Save the image locally
        await writeFileAsync("fallenDog.jpg", imageBuffer);

        // Extract the dog name and death date
        const dogName = memorialDiv.find("strong a").text()
        if (dogName == lastMemorialDogName) {
            console.log("Dog memorial already posted :(")
            return null
        }

        const deathDateElement = memorialDiv.find("div").last();
        const deathDateText = deathDateElement.text();
        const deathDate = deathDateText.replace(/^Killed\s+/, "");

        // Get random heart
        const randomHeartEmoji = heartEmojis[Math.floor(Math.random() * heartEmojis.length)];

        // Tweet the information with the image
        const mediaId = await twitterClient.v1.uploadMedia("./fallenDog.jpg");
        await twitterClient.v2.tweet({
            text: `🌹 Memorial 🌹\n${dogName} ${randomHeartEmoji}\n${deathDate} 🕊️\n #memorial #rememberme`,
            media: {
                media_ids: [mediaId],
            },
        });

        console.log("Tweet created successfully!");
        lastMemorialDogName = dogName;
    } catch (e) {
        console.log(e);
    }
};

const scrapeAndTweetRandomDogInDanger = async () => {
    try {
        // Fetch the webpage
        const response = await axios.get("https://www.dogsindanger.com/pet.jsp?did=1200976026977");
        const html = response.data;

        // Use cheerio to parse the HTML
        const $ = cheerio.load(html);

        // Extract the image URL
        const imageUrl = $(".pet img").attr("src");

        // Download the image
        const imageResponse = await axios.get(imageUrl, { responseType: "arraybuffer" });
        const imageBuffer = Buffer.from(imageResponse.data);

        // Save the image locally
        await writeFileAsync("dog.jpg", imageBuffer);

        // Extract the dog's name, remaining time, and location
        const dogName = $(".dogname a").text();
        const remainingTime = $('strong:contains("Time Remaining:")')[0].next.data.trim();

        const daysLeft = parseInt(remainingTime.match(/\d+/)[0]);
        const isUrgent = daysLeft <= 5 ? true : false;

        // Get full location, grab state abreviation from location and get full state name for hashtag (ex. #california)
        const location = $('strong:contains("Location:")')[0].next.data
        const state = location.split(',')[1].trim();
        const stateName = getStateName(state)

        // Get link to adoption page
        const saveMeLink = $("a:contains('save me')").attr("href");

        // Get the dog's ID from the image alt attribute
        const dogId = $("img[alt='Save this Dog Now']").parent().attr("href").match(/did=(\d+)/)[1];

        // Get random heart
        const randomHeartEmoji = heartEmojis[Math.floor(Math.random() * heartEmojis.length)];

        // Tweet the information with the image
        const mediaId = await twitterClient.v1.uploadMedia("./dog.jpg");
        await twitterClient.v2.tweet({
            text: `${isUrgent ? "⚠️ Urgent ⚠️" : ""}\n🐶 Name: ${dogName} ${randomHeartEmoji}\n🕐 Time Remaining: ${remainingTime}\n📍Location: ${location}\nSave me: https://www.dogsindanger.com${saveMeLink}\n#${stateName} #dog #adoption`,
            media: {
                media_ids: [mediaId],
            },
        });

        console.log("Tweet created successfully!");
    } catch (e) {
        console.log(e);
    }
}

// Post a dog in danger every hour
const cronTweetRandomDogInDanger = new CronJob("0 * * * *", async () => {
    scrapeAndTweetRandomDogInDanger()
});
cronTweetRandomDogInDanger.start();

// Post a dog memorial every 2 hours
const cronTweetLatestMemorial = new CronJob("0 */2 * * *", async () => {
    scrapeAndTweetLatestMemorial()
});
cronTweetLatestMemorial.start();
