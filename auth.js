require('dotenv').config(); // Load environment variables from .env

const fs = require('fs');
const { google } = require('googleapis');
const readline = require('readline');

const credentials = {
  client_id: process.env.YOUTUBE_CLIENT_ID,
  client_secret: process.env.YOUTUBE_CLIENT_SECRET,
  redirect_uris: [process.env.YOUTUBE_REDIRECT_URIS],
};

console.log('Using client_id:', credentials.client_id); // Log client_id for debugging
console.log('Using redirect_uris:', credentials.redirect_uris); // Log redirect_uris for debugging

const TOKEN_PATH = 'youtube_token.json'; // Path to save the token

const oAuth2Client = new google.auth.OAuth2(
  credentials.client_id,
  credentials.client_secret,
  credentials.redirect_uris[0]
);

const SCOPES = ['https://www.googleapis.com/auth/youtube.upload'];

function getAccessToken(oAuth2Client) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    client_id: credentials.client_id, // Explicitly include client_id
    redirect_uri: credentials.redirect_uris[0],
  });
  console.log('Authorize this app by visiting this URL:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error retrieving access token', err);
      oAuth2Client.setCredentials(token);
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(token));
      console.log('Token stored to', TOKEN_PATH);
    });
  });
}

getAccessToken(oAuth2Client);
