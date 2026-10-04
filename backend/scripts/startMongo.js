const { spawn } = require('child_process');
const net = require('net');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '../..');
const BIN = path.join(ROOT, '.mongo', 'bin', 'mongod.exe');
const DATA = path.join(ROOT, '.mongo', 'data');
const LOG = path.join(ROOT, '.mongo', 'mongod.log');
const PORT = Number(process.env.MONGO_PORT) || 27017;

const checkPort = () =>
  new Promise((resolve) => {
    const socket = net.connect({ port: PORT, host: '127.0.0.1' });
    socket.setTimeout(1200);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => resolve(false));
  });

const start = async () => {
  if (await checkPort()) {
    console.log(`MongoDB is already running on port ${PORT}.`);
    process.exit(0);
  }
  if (!fs.existsSync(BIN)) {
    console.error(`Portable mongod not found at:\n  ${BIN}\nInstall MongoDB Community Server (see README) or place mongod.exe there.`);
    process.exit(1);
  }
  fs.mkdirSync(DATA, { recursive: true });

  const child = spawn(BIN, ['--dbpath', DATA, '--port', String(PORT), '--bind_ip', '127.0.0.1', '--logpath', LOG], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();

  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 400));
    if (await checkPort()) {
      console.log(`MongoDB started on port ${PORT} (data: ${DATA})`);
      process.exit(0);
    }
  }
  console.error(`MongoDB did not start. Check the log at ${LOG}`);
  process.exit(1);
};

start();
