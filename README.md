# http-streaming-audio

## Usage

### Prerequisites

- `youtube-dl` is installed
- Update `MP3_DIR` in `src/config.js` to a directory that is readable/writable by the user running the server

### Caveats

- There is no automatic method to clear `MP3_DIR/` so it will grow unbounded. This is only a proof-of-concept, so I won't be adding any way to do that. If this was used heavily, `MP3_DIR/` would grow very quickly and you'll have some sad times when your disk fills up.

### What it does

A request to `/mp3?id=ID` will:

- Check if `MP3_DIR/ID.mp3` exists
- If not, then try to download an mp3 version from `youtube.com/watch?v=ID` to `MP3_DIR/ID.mp3`
- Then it will stream the file from the appropriate start time based on the `range` header

### Development

```
npm run dev
```

This will use `nodemon` to start the server and listen for any changes to the src files.

### Production

```
NODE_ENV=production npm start
```

This will start the server with the production config values.
