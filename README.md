# yt-streaming-audio-server

## Usage

### Prerequisites

- `youtube-dl` is installed
- Update `MP3_DIR` in `src/config.js` to a directory that is readable/writable by the user running the server

### What it does

On start the server will:

- Get the list of files at `MP3_DIR/<ID>.mp3`
- If an entry with that `ID` does not exist in `db.json`, seed a new entry with its `contentLength` and `lastRead` timestamp
- Start an interval that will run every `DELETE_LRU_INTERVAL` which will check if `MP3_DIR` is larger than `MAX_DIR_SIZE`
- If it is larger, then the least recently used files to get it under the threshold will be deleted

A request to `/mp3?id=ID` will:

- Check if `MP3_DIR/ID.mp3` exists
- If not, then try to download an mp3 version from `youtube.com/watch?v=ID` to `MP3_DIR/ID.mp3`
- Then it will stream the file from the appropriate start time based on the `range` header

### Caveats

- On the initial request for an `ID` that does not exist, the full file will be downloaded and transcoded to an mp3 _BEFORE_ any stream to the client begins. This has a negative effect on performance especially on large files. A different approach should be possible that would only transcode a portion based on the `range` header, since transcoding takes up a lot more time than downloading the file. The that portion could be streamed earlier, while the rest of the file is being transcoded.

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
