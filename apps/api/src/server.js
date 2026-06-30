const { app } = require('./app');
const { prisma } = require('./config/prisma');
const { env } = require('./config/env');

const server = app.listen(env.PORT, () => {
  console.log(`HFMS API listening on http://localhost:${env.PORT}`);
});

async function shutdown(signal) {
  console.log(`${signal} received. Shutting down gracefully...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});
