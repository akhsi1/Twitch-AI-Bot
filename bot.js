require('dotenv').config();
const tmi = require('tmi.js');
const axios = require('axios');
const ai = require('./ai');
const { questionWords} = require('./const');
const { getViewerCount } = require('./twitchApi');
const { connectClient, client } = require('./auth.js');
const fs = require('fs');
const path = require('path');

// Custom log function
function log(message, score, response) {
  const logFilePath = path.join(__dirname, 'logs.txt');
  const timestamp = new Date().toISOString(); // Add timestamp
  var logMessage = `${timestamp} - ${message}-${score}\n${response}\n\n`; // Format message
  if (!message) logMessage = `${timestamp} - ${response}\n\n`;

  // Append log message to file
  fs.appendFile(logFilePath, logMessage, (err) => {
    if (err) {
      console.error('Failed to write log:', err);
    }
  });
}

connectClient();

// Register event handlers
client.on('message', onMessageHandler);
client.on('connected', onConnectedHandler);

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

let started = true;
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
        } else if (message.toLowerCase() == '!testsubgift') {
            client.emit('subgift', 'whelpsAI', 'alston321', 5, "puck", null, {}); 
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

    function containsLink(message) {
        const urlPattern = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/g;
        return urlPattern.test(message);
    }

    // Check if message meets criteria
    if (
        (questionWords.some(item => trimmedMessage.includes(item))
        && !containsLink(trimmedMessage))
        || isMentioned)
        { }
    else {
        let generalChat = true;
        // await ai.processMessage(user, tags.subscriber, message, isMentioned, generalChat);
        console.log('Message does not meet filter criteria. Ignoring message.');
        return;
    }

    // Return if it's not a question
    var isQuestion = false;
    try {
        if (!isMentioned) {
            isQuestion = await ai.isQuestion(trimmedMessage);
        }
    } catch {
        console.log("error processing isQuestion")
    }
    if (!isQuestion && !isMentioned) {
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

        if (!aiResponse) return;

        let rscore = (aiResponse.match(/\[(\d+)\]/) || [])[1];
        let pscore = (aiResponse.match(/{(\d+)}/) || [])[1];
        console.log(`RSCORE= ${rscore}\nPSCORE= ${pscore}`);
        let totalscore = parseInt(pscore ? pscore : 0)+parseInt(rscore ? rscore : 0);
        console.log(`TOTAL=${totalscore}`);
        aiResponse = aiResponse.replace(/(\*\*|__)(.*?)\1/g, '$2'); // Remove bold
        aiResponse = aiResponse.replace(/(\*|_)(.*?)\1/g, '$2');   // Remove italics
        aiResponse = aiResponse.replace(/{\d+}.*/, '').trim(); // Remove everything after {num}
        aiResponse = aiResponse.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$2'); // Keep the URL but remove formatting
        aiResponse = aiResponse.replace(/\[\d+\]/g, ''); // Remove [num]
        aiResponse = aiResponse.replace(/\{\d+\}/g, ''); // Remove {num}
        aiResponse = aiResponse.replace(/<think>[\s\S]*?<\/think>/g, '');
        aiResponse = aiResponse.replace(/\(.*?\)/g, '').trim(); // Remove everything including () from "(some text)"

        if (aiResponse.length > 260 && !isMentioned){
            console.log(`character limit reached: ${aiResponse.length}`);
            return;
        }

        function sendResponse(){ 
            if (!started) return;
            client.say(channel, aiResponse);
            // Update the last message time
            lastMessageTime = currentTime;
            log(trimmedMessage, totalscore, aiResponse);
        }

        if (isMentioned) {
            sendResponse();
            return;
        }

        if (totalscore < 130){
            return;
        }
        
        try { 
            var viewCount = await getViewerCount('thewhelps');
        } catch {
            console.log('error fetching viewcount');
            var viewCount = 0;
        }
        let validscore = viewCount > 1000 ? 130 : 140;
        if ( totalscore >= validscore) {
            sendResponse();
            return;
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

client.on("subgift", async (channel, username, streakMonths, recipient, methods, userstate) => {
    try {
        await processSub(username, methods, channel, null, recipient);
    } catch {
        console.error('error processing gift subgift');
    }
});

async function processSub(user, methods, channel, giftCount, recipient) {
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
        const aiResponse = await ai.processSubscription(user, methods?.prime, giftCount, recipient);
        lastSubTime = time
        if (started){ 
            client.say(channel, aiResponse);
            log(undefined, undefined, aiResponse);
        }
    } catch (error) {
        console.error("Error handling subscription:", error);
    }
}

// Connected handler
function onConnectedHandler(addr, port) {
    console.log(`Connected to ${addr}:${port}`);
}