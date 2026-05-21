const app = require('./app');
const { initDb } = require('./db');

const PORT = process.env.PORT || 3001;

(async () => {
  await initDb();

  app.listen(PORT, () => {
    console.log(`MalaPronta API running on http://localhost:${PORT}`);
  });
})().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
