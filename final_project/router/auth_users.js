// Modified from the IBM Skills Network starter: registration, login and owned reviews.
const express = require('express');
const jwt = require('jsonwebtoken');
const { randomBytes, scrypt, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');
const books = require('./booksdb');
const regd_users = express.Router();
const users = [];
const deriveKey = promisify(scrypt);
const jwtSecret = process.env.JWT_SECRET || randomBytes(32).toString('hex');

// Keep the starter's in-memory user array; never store plaintext passwords.
const isValid = (username) => users.some((user) => user.username === username);
const validCredentials = (username, password) =>
  typeof username === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(username) &&
  typeof password === 'string' && password.trim().length > 0 && password.length <= 128;

async function registerUser(username, password) {
  const salt = randomBytes(16).toString('hex');
  const passwordHash = (await deriveKey(password, salt, 64)).toString('hex');
  // Recheck after hashing so concurrent registrations cannot create duplicates.
  if (isValid(username)) return false;
  users.push({ username, salt, passwordHash });
  return true;
}

async function authenticatedUser(username, password) {
  const user = users.find((entry) => entry.username === username);
  if (!user) return false;
  const supplied = await deriveKey(password, user.salt, 64);
  return timingSafeEqual(supplied, Buffer.from(user.passwordHash, 'hex'));
}

function requireAuth(req, res, next) {
  const authorization = req.session.authorization;
  if (!authorization) return res.status(401).json({ message: 'Please log in first.' });
  try {
    const payload = jwt.verify(authorization.accessToken, jwtSecret, { algorithms: ['HS256'] });
    if (payload.sub !== authorization.username || !isValid(payload.sub)) {
      return res.status(401).json({ message: 'Invalid session. Please log in again.' });
    }
    req.username = payload.sub;
    return next();
  } catch {
    return res.status(401).json({ message: 'Session expired or invalid. Please log in again.' });
  }
}

regd_users.post('/login', async (req, res, next) => {
  const { username, password } = req.body || {};
  if (!validCredentials(username, password)) {
    return res.status(400).json({ message: 'A valid username and password are required.' });
  }
  try {
    if (!await authenticatedUser(username, password)) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }
    const accessToken = jwt.sign({}, jwtSecret, { subject: username, expiresIn: '1h', algorithm: 'HS256' });
    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.authorization = { accessToken, username };
      req.session.save((saveError) => {
        if (saveError) return next(saveError);
        return res.status(200).json({ message: 'User successfully logged in.', username });
      });
    });
  } catch (err) {
    next(err);
  }
});

// PUT creates or replaces only the signed-in user's review (IBM's original route).
regd_users.put('/auth/review/:isbn', (req, res) => {
  if (!Object.hasOwn(books, req.params.isbn)) {
    return res.status(404).json({ message: 'Book not found.' });
  }
  const review = req.body?.review ?? req.query.review;
  if (typeof review !== 'string' || !review.trim() || review.length > 5000) {
    return res.status(400).json({ message: 'Review must be a non-empty string of at most 5000 characters.' });
  }
  const book = books[req.params.isbn];
  const existed = Object.hasOwn(book.reviews, req.username);
  // Define an own key safely, even for a username such as '__proto__'.
  Object.defineProperty(book.reviews, req.username, {
    value: review.trim(), writable: true, enumerable: true, configurable: true
  });
  return res.status(existed ? 200 : 201).json({
    message: existed ? 'Review updated successfully.' : 'Review added successfully.',
    reviews: book.reviews
  });
});

regd_users.delete('/auth/review/:isbn', (req, res) => {
  if (!Object.hasOwn(books, req.params.isbn)) {
    return res.status(404).json({ message: 'Book not found.' });
  }
  const book = books[req.params.isbn];
  if (!Object.hasOwn(book.reviews, req.username)) {
    return res.status(404).json({ message: 'You have no review for this book.' });
  }
  delete book.reviews[req.username];
  return res.status(200).json({ message: 'Review deleted successfully.', reviews: book.reviews });
});

module.exports = {
  authenticated: regd_users, isValid, users, validCredentials,
  registerUser, authenticatedUser, requireAuth
};
