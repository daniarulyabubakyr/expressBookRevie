// Modified from the IBM Skills Network starter: sessions, authentication and errors.
const express = require('express');
const session = require('express-session');
const { randomBytes } = require('node:crypto');
const { authenticated, requireAuth } = require('./router/auth_users');
const { general } = require('./router/general');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '16kb' }));
app.use('/customer', session({
  name: 'bookshop.sid',
  secret: process.env.SESSION_SECRET || randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 1000 }
}));
app.use('/customer/auth', requireAuth);
app.use('/customer', authenticated);
app.use('/', general);
app.use((req, res) => res.status(404).json({ message: 'Route not found.' }));
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Invalid JSON body.' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Request body is too large.' });
  }
  if (err instanceof URIError) {
    return res.status(400).json({ message: 'Invalid URL encoding.' });
  }
  console.error(err);
  return res.status(500).json({ message: 'Internal server error.' });
});

if (require.main === module) {
  const port = Number(process.env.PORT || 5000);
  const server = app.listen(port, () => console.log(`Book review server listening on port ${server.address().port}`));
  server.on('error', (err) => {
    console.error(`Unable to start server: ${err.message}`);
    process.exitCode = 1;
  });
}
module.exports = app;
