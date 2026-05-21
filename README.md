# competitive-exile
Currency per hour tracking for friends

[Website link](https://competitive-exile.ngrok.app/)

Competitive exile
Feature list
- dynamically shows personal assets vs.time played. Include pieces of gear in asset calculation. No need to break down stash tab, raw number is enough. Wealthy exile already breaks down stash tab
- dynamically show a leaderboard of assets accumulated per hour (based off of auth’d data and stored locally. Is this against tos?)
- static section describing basic trades you can make for making currency, as well as timing, + links for the trades
- section of site for live tracking possible up and coming builds/hot items that will increase in price based on twitch stream scraping of jungroan, palsteron, fubgun etc popular streamers

## Usage
1. Download [ngrok](https://ngrok.com/) and set up desired domain
2. Download nvm + npm
3. `npm run dev` (runs both backend + frontend via concurrently)
4. Or individually: `cd backend && npm run dev` / `cd frontend && npm run dev`
5. Tunnel: `http --url=competitive-exile.ngrok.app 5173`