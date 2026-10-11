// Local development server:  npm run api   (listens on http://localhost:4000)
const app = require('./app');
const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`API running on http://localhost:${port}`));
