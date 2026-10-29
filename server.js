require('dotenv').config();

const http = require('node:http');
const mongoose = require('mongoose');
const app = require('./src/app');

const port = Number(process.env.PORT) || 3000;
const server = http.createServer(app);

async function start() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required to start CarePoint.');
  }
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must contain at least 32 characters.');
  }

  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000
  });
  server.listen(port, () => {
    console.log(`CarePoint listening on port ${port}`);
  });
}

function shutdown(signal) {
  console.log(`${signal} received; closing server.`);
  server.close(() => {
    mongoose.disconnect().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

if (require.main === module) {
  start().catch((error) => {
    console.error(`CarePoint startup failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { app, start, server };
