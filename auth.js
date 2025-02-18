require('dotenv').config();
const tmi = require('tmi.js');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

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

// Define Twitch OAuth token URL
const TOKEN_URL = 'https://id.twitch.tv/oauth2/token';
    
// Create a Twitch client
const client = new tmi.Client(opts);

// Function to connect the client with error handling
async function connectClient() {
    try {
        await client.connect();
    } catch (error) {
        console.error('Error connecting to Twitch:', error);
    }

    return client;
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

    // OAuth token variables
    let accessToken = process.env.TWITCH_OAUTH_TOKEN;
    let refreshToken = process.env.TWITCH_REFRESH_TOKEN;

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

module.exports = {
    connectClient,
    refreshAccessToken,
    client
}