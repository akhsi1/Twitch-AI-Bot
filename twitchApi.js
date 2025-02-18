const { refreshAccessToken } = require('./auth');

let attempts = 0;

async function getViewerCount(channelName) {
    attempts++
    let accessToken = process.env.TWITCH_OAUTH_TOKEN;
    let clientId = process.env.CLIENT_ID;
    let data = null;

    try {
        // Get the stream details using the user_login parameter
        const response = await fetch(`https://api.twitch.tv/helix/streams?user_login=${channelName}`, {
            headers: {
                'Client-ID': clientId,
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (response.status === 401) {
            if (attempts < 3) {
                await refreshAccessToken();
                return await getViewerCount(channelName);
            }
            return;
        }

        if (response.ok) {
            data = await response.json();
            console.log(data?.data);
        }

        if (data.data?.length > 0) {
            const streamInfo = data.data[0];
            console.log(`Viewer count for ${channelName}: ${streamInfo.viewer_count}`);
            attempts = 0
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
