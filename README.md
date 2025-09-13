# Overlayfy

A lightweight **desktop overlay for Spotify** that displays synced lyrics on top of any window.  
Built with **Electron + Express + Spotify Web API**.

### Motivation
I wanted a simple way to see synced Spotify lyrics while working or studying. Spotify doesn’t provide a floating overlay, so I decided to make my own!
I also wanted to get some hands-on experience with the Spotify Web API and try to build features on top of an existing app. 
Most importantly, it makes learning how to sing along my favorite songs a lot easier 🙂

---

## Features
- **Floating overlay** – always on top, draggable
- **Synced lyrics** – real-time updates with your Spotify playback
- **Spotify OAuth 2.0 PKCE** – secure authentication flow
- **Lightweight & minimal** – small window with close button
- **Cross-platform** – runs on Windows, macOS, and Linux

---

## Tech Stack
- [Electron](https://www.electronjs.org/) – desktop client  
- [Express.js](https://expressjs.com/) – backend for auth & API proxy  
- [Spotify Web API](https://developer.spotify.com/documentation/web-api/) – playback state + tokens  
- [Node.js](https://nodejs.org/) – runtime  

---

## Getting Started

### 1. Clone the repo
```bash
git clone https://github.com/gzjiayi/overlayfy.git
cd overlayfy
npm install
```
### 2. Set up environment variables
Create a .env file in the root directory:
```env
CLIENT_ID=your_spotify_client_id
REDIRECT_URI=http://127.0.0.1:8888/callback
```
You’ll need a [Spotify Developer App](https://developer.spotify.com/dashboard/)
 to get your own Client ID and register the redirect URI above.
### 3. Run the backend
```bash
node auth-server.js
```
### 4. Start the Electron app
```bash
npm start
```
---
## Limitations
- You’ll need your own **Spotify Developer account** and app to get a `CLIENT_ID` and set a redirect URI
- The backend isn’t hosted anywhere. You have to run `auth-server.js` locally for login and playback to work
- There’s no installer yet. The app runs from `npm start`

---


## Upcoming Features
- Configurable themes (fonts, colors, transparency)
- Show romanization (pinyin, romaji, etc.) for non-Latin lyrics (e.g. Chinese, Japanese, Korean)
- Option to resize the overlay window to display multiple lines
- Support for other music services

--- 

## Screenshots / Demo
