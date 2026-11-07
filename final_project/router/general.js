// Modified from the IBM Skills Network starter: public routes and Axios tasks 10-13.
const express = require('express');
const axios = require('axios');
const books = require('./booksdb');
const { isValid, validCredentials, registerUser } = require('./auth_users');
const public_users = express.Router();

public_users.post('/register', async (req, res, next) => {
  const { username, password } = req.body || {};
  if (!validCredentials(username, password)) {
    return res.status(400).json({
      message: 'Username must be 1-64 letters, numbers, underscores or hyphens; password must be 1-128 characters and not blank.'
    });
  }
  try {
    if (isValid(username) || !await registerUser(username, password)) {
      return res.status(409).json({ message: 'Username already exists.' });
    }
    return res.status(201).json({ message: 'User successfully registered. You can now log in.' });
  } catch (err) {
    next(err);
  }
});

public_users.get('/', (req, res) => res.status(200).json(books));
public_users.get('/isbn/:isbn', (req, res) => {
  if (!Object.hasOwn(books, req.params.isbn)) {
    return res.status(404).json({ message: 'Book not found.' });
  }
  return res.status(200).json(books[req.params.isbn]);
});

function searchBooks(field) {
  return (req, res) => {
    const term = req.params[field].trim().toLowerCase();
    if (!term) return res.status(400).json({ message: `A non-empty ${field} is required.` });
    const matches = Object.fromEntries(Object.entries(books).filter(
      ([, book]) => book[field].toLowerCase().includes(term)
    ));
    if (Object.keys(matches).length === 0) {
      return res.status(404).json({ message: `No books found for this ${field}.` });
    }
    return res.status(200).json(matches);
  };
}

public_users.get('/author/:author', searchBooks('author'));
public_users.get('/title/:title', searchBooks('title'));
public_users.get('/review/:isbn', (req, res) => {
  if (!Object.hasOwn(books, req.params.isbn)) {
    return res.status(404).json({ message: 'Book not found.' });
  }
  return res.status(200).json(books[req.params.isbn].reviews);
});

// Real HTTP clients for IBM tasks 10-13. Public handlers above read the catalog;
// these clients call those handlers without recursive self-requests.
function createBookClient(baseURL = process.env.BOOK_API_URL || `http://127.0.0.1:${process.env.PORT || 5000}`) {
  const client = axios.create({ baseURL, timeout: 5000 });
  return {
    // Task 10: async/await, with an optional Node-style callback.
    async getAllBooks(callback) {
      let data;
      try {
        data = (await client.get('/')).data;
      } catch (err) {
        if (typeof callback === 'function') return callback(err);
        throw err;
      }
      if (typeof callback === 'function') callback(null, data);
      return data;
    },
    // Task 11: Promise callback; Axios errors remain rejected for the caller.
    getBookByISBN(isbn) {
      return client.get(`/isbn/${encodeURIComponent(isbn)}`).then((response) => response.data);
    },
    // Task 12: async/await.
    async getBooksByAuthor(author) {
      const response = await client.get(`/author/${encodeURIComponent(author)}`);
      return response.data;
    },
    // Task 13: Promise callback.
    getBooksByTitle(title) {
      return client.get(`/title/${encodeURIComponent(title)}`).then((response) => response.data);
    }
  };
}

module.exports = { general: public_users, createBookClient, ...createBookClient() };
