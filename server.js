const db = require('./db/database');

const PORT = process.env.PORT || 3000;

db.init().then(() => {
  const app = require('./app');
  app.listen(PORT, () => {
    console.log(`Galilee MBC running at http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});
