# ERROR.EXE — Office Runner

A mobile-responsive, three-lane 3D endless runner built with Three.js. The employee cube now has a visible bobbing run cycle with swinging arms and legs.

## Run it locally

Because the game imports Three.js as an ES module, serve the folder over HTTP rather than opening `index.html` as a `file://` URL.

### Option 1: Python
```bash
python -m http.server 8000
```
Then open http://localhost:8000

### Option 2: Node
```bash
npx serve .
```

## Controls
- Desktop: Left/Right arrows or A/D to change lanes; Space/Up/W to jump.
- Mobile: Use the on-screen arrow and jump buttons. You can also tap the left/right edges to change lanes and the center to jump.
- Coffee lowers error rate by 12%.
- Colliding with office obstacles adds 22% error rate.
- At 85% error rate, the shift ends.
- Personal best is saved locally in the browser.

## Deploy
Upload `index.html` to Netlify Drop, or push this folder to a GitHub repository and import it into Netlify. The Three.js module is loaded from jsDelivr, so the deployed page needs an internet connection.

## Notes
This is a frontend-only prototype. Scores and personal bests are stored in the current browser only; there is no shared leaderboard or server.

## Music Credits
🎵 **Background Music:** "Le Grand Chase" by Kevin MacLeod ([incompetech.com](https://incompetech.com))
📄 **License:** Licensed under [Creative Commons: By Attribution 4.0](http://creativecommons.org)