require('dotenv').config();
const tmi = require('tmi.js');
const axios = require('axios');
const ai = require('./ai');

// OAuth token variables
let accessToken = process.env.TWITCH_OAUTH_TOKEN;
let refreshToken = process.env.TWITCH_REFRESH_TOKEN;

// Define configuration options
let opts = {
    identity: {
        username: process.env.TWITCH_USERNAME,
        password: `oauth:${accessToken}` // Use dynamic access token
    },
    channels: [process.env.TWITCH_CHANNEL, process.env.TWITCH_CHANNEL2],
    // channels: [process.env.TWITCH_CHANNEL2],
    options: { debug: true } // Enable debug logs
};

// Create a Twitch client
const client = new tmi.Client(opts);

// Register event handlers
client.on('message', onMessageHandler);
client.on('connected', onConnectedHandler);

// Connect to Twitch:
connectClient();

// Define Twitch OAuth token URL
const TOKEN_URL = 'https://id.twitch.tv/oauth2/token';

// Function to connect the client with error handling
async function connectClient() {
    try {
        await client.connect();
    } catch (error) {
        console.error('Error connecting to Twitch:', error);
    }
}

// Check if the token is valid (using client connection error handling)
client.on('disconnected', async (reason) => {
    console.error('Disconnected:', reason);
    if (reason === 'Login authentication failed') {
        console.log('Refreshing token...');
        try {
            await refreshAccessToken();
            opts.identity.password = `oauth:${accessToken}`;
            await connectClient(); // Reconnect after refreshing token
        } catch (error) {
            console.error('Failed to refresh token and reconnect:', error);
        }
    }
});

// Refresh token function
async function refreshAccessToken() {
    try {
        const response = await axios.post(TOKEN_URL, null, {
            params: {
                client_id: process.env.CLIENT_ID,
                client_secret: process.env.CLIENT_SECRET,
                grant_type: 'refresh_token',
                refresh_token: refreshToken
            }
        });

        accessToken = response.data.access_token;
        refreshToken = response.data.refresh_token;

        // Save new tokens in .env
        const fs = require('fs');
        const envFilePath = '.env';
        let envContent = fs.readFileSync(envFilePath, 'utf8');

        // Replace old tokens with new ones
        envContent = envContent.replace(/TWITCH_OAUTH_TOKEN=.*/, `TWITCH_OAUTH_TOKEN=${accessToken}`);
        envContent = envContent.replace(/TWITCH_REFRESH_TOKEN=.*/, `TWITCH_REFRESH_TOKEN=${refreshToken}`);
        fs.writeFileSync(envFilePath, envContent);

        console.log('New access token:', accessToken);
        console.log('New refresh token:', refreshToken);
    } catch (error) {
        console.error('Error refreshing access token:', error.response.data);
    }
}

class MessageList {
    constructor(maxSize) {
        this.maxSize = maxSize;
        this.messages = [];
    }

    addMessage(message) {
        // Add the new message
        this.messages.push(message);

        // If the list exceeds the maximum size, remove the oldest message
        if (this.messages.length > this.maxSize) {
            this.messages.shift(); // Remove the first (oldest) message
        }
    }

    getMessages() {
        return this.messages;
    }
}

// Rate limiting variables
let lastMessageTime = 0; // Keep track of the last message time
let lastSubTime = 0;

started = true;
const messageList = new MessageList(30);

// Message handler
async function onMessageHandler(channel, tags, message, self) {
    if (self) return; // Ignore echoed messages.

    let isMentioned = false;
    const trimmedMessage = message.trim().toLowerCase();

    if (trimmedMessage.includes('whelpsai') || trimmedMessage.includes('whelps ai')) {
        isMentioned = true;
    }
    if (tags.badges?.broadcaster || tags.badges?.moderator) {
        console.log('message is from a mod');
        if (message.toLowerCase() == '!stopai') {
            client.say(channel, 'stopped');
            started = false;
        } else if (message.toLowerCase() == '!startai') {
            started = true;
            client.say(channel, 'started');
            return;
        } else if (message.toLowerCase() == '!testfiresub') {
            client.emit('subscription', 'whelpsAI', 'alston321', { prime: true }, null, {}); 
        } else if (message.toLowerCase() == '!testresub') {
            client.emit('resub', 'whelpsAI', 'alston321', null, null, null,{ prime: true }, {}); 
        } else if (message.toLowerCase() == '!testgiftsub') {
            client.emit('submysterygift', 'whelpsAI', 'alston321', 5, null, null, {}); 
        }
    } else if (message.toLowerCase() == '!startai' || message.toLowerCase() == '!stopai') {
        client.say(channel, 'nice try ;)');
        return;
    } else {
        //check duplicated messages
        if (messageList.getMessages().includes(message)) {
            return;
        }
        messageList.addMessage(message);
    }

    if (!started) {
        console.log("bot is stopped")
        return;
    }

    const user = tags.username;


    //const isQuestion = await ai.isQuestion(trimmedMessage);
    function containsLink(message) {
        const urlPattern = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/g;
        return urlPattern.test(message);
    }

    // Check if message meets criteria
    if (['?', 'why ', 'when', 'what ', 'how ', 'where ', 'should i', 'can you', 'can u', 'do the', 'do you'].some(item => trimmedMessage.includes(item))
        || isMentioned
        && !containsLink(trimmedMessage)) 
        { }
    else {
        let generalChat = true;
        // await ai.processMessage(user, tags.subscriber, message, isMentioned, generalChat);
        console.log('Message does not meet filter criteria. Ignoring message.');
        return;
    }

    // Rate limit responses
    const currentTime = Date.now();
    const rateLimitInterval = parseInt(process.env.RATE_LIMIT_INTERVAL, 10);
    if (currentTime - lastMessageTime < rateLimitInterval && !isMentioned) {
        console.log('Rate limit exceeded. Ignoring message.');
        return;
    }

    // add to processed messages list
    const mentions = trimmedMessage.match(/@\w+/g);
    console.log(mentions);
    if (mentions && !mentions.some(user => user.includes('whelps'))) {
        console.log(message + " - message is directed to another user");
        //talking to another user
        return;
    }

    try {
        lastMessageTime = currentTime;

        var aiResponse = await ai.processMessage(user, tags.subscriber, message, isMentioned);

        let number = (aiResponse.match(/\[(\d+)\]/) || [])[1];
        console.log('confidence score = ' + number);
        aiResponse = aiResponse.replace(/\[\d+\]/g, '');
        aiResponse = aiResponse.replace(/<think>[\s\S]*?<\/think>/g, '');
        aiResponse = aiResponse.replace(/(\*\*|__)(.*?)\1/g, '$2'); // Remove bold
        aiResponse = aiResponse.replace(/(\*|_)(.*?)\1/g, '$2');   // Remove italics
        aiResponse = aiResponse.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$2'); // Keep the URL but remove formatting

        if (started && (number >= 90 || isMentioned)) {
            client.say(channel, aiResponse);
            // Update the last message time
            lastMessageTime = currentTime;
        }

    } catch (error) {
        console.error('Error processing message with AI:', error);
    }
}

client.on("subscription", async (channel, username, methods, message, userstate) => {
    try {
        await processSub(username, methods, channel);
    } catch {
        console.error('error processing sub');
    }
});

client.on("resub", async (channel, username, months, message, userstate, methods) => {
    try {
        await processSub(username, methods, channel);
    } catch {
        console.error('error processing sub');
    }
});

client.on("submysterygift", async (channel, username, numbOfSubs, methods, userstate) => {
    try {
        await processSub(username, methods, channel, numbOfSubs);
    } catch {
        console.error('error processing gift sub');
    }
});


async function processSub(user, methods, channel, giftCount) {
    // Rate limit responses
    const time = Date.now();
    const rateLimitInterval = 10000;

    if (giftCount) {
        console.log('subs gifted: ' + giftCount)
    } else {
        console.log(`${user} subbed`);
    }

    if (time - lastSubTime < rateLimitInterval && !giftCount) {
        console.log('Sub rate limit. Ignoring message.');
        return;
    }

    try {
        if (!started){
            console.log("AI not started");
            return;
        }
        lastSubTime = time
        const aiResponse = await ai.processSubscription(user, methods?.prime, giftCount);
        lastSubTime = time
        if (started){ 
            client.say(channel, aiResponse);
        }
    } catch (error) {
        console.error("Error handling subscription:", error);
    }
}

// Connected handler
function onConnectedHandler(addr, port) {
    console.log(`Connected to ${addr}:${port}`);
}