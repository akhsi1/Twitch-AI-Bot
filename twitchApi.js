let accessToken = process.env.TWITCH_OAUTH_TOKEN;
let clientId = process.env.CLIENT_ID;

async function getViewerCount(channelName) {
    try {
        // Get the stream details using the user_login parameter
        const response = await fetch(`https://api.twitch.tv/helix/streams?user_login=${channelName}`, {
            headers: {
                'Client-ID': clientId,
                'Authorization': `Bearer ${accessToken}`
            }
        });

        const data = await response.json();

        if (data.data.length > 0) {
            const streamInfo = data.data[0];
            console.log(`Viewer count for ${channelName}: ${streamInfo.viewer_count}`);
            return streamInfo.viewer_count;
        } else {
            console.log(`${channelName} is not live right now.`);
        }
    } catch (error) {
        console.error('Error fetching viewer count:', error);
    }
    return 0;
}

module.exports = {
    getViewerCount
};
