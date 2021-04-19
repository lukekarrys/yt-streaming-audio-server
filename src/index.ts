import server from './server'
import { MAX_DIR_SIZE, DELETE_LRU_INTERVAL } from './config'

server({ maxDirSize: MAX_DIR_SIZE, deleteLRUInterval: DELETE_LRU_INTERVAL })
  .then(({ port }) => console.log('[init]', `Listening on ${port}`))
  .catch((err) => console.error('[error]', 'Server could not be started', err))
