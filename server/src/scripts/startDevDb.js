import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { MongoMemoryServer } from 'mongodb-memory-server';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

process.env.MONGOMS_DOWNLOAD_DIR = path.resolve(__dirname, '../../node_modules/.cache/mongodb-memory-server');

const dataDir = path.resolve(__dirname, '../../../.data/db');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

console.log('[TripZa Dev DB] Starting local MongoDB on port 27017...');

try {
  const mongod = await MongoMemoryServer.create({
    instance: {
      port: 27017,
      dbPath: dataDir,
      storageEngine: 'wiredTiger',
    },
  });

  console.log(`[TripZa Dev DB] MongoDB is running at: ${mongod.getUri()}`);
  console.log(`[TripZa Dev DB] Data directory: ${dataDir}`);

  // Keep process alive
  setInterval(() => {}, 10000);

  const shutdown = async () => {
    console.log('[TripZa Dev DB] Shutting down MongoDB...');
    await mongod.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
} catch (err) {
  console.error('[TripZa Dev DB] Failed to start local MongoDB:', err.message);
  process.exit(1);
}
