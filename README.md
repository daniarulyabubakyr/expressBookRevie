# Online Book Review Application

Completed IBM Skills Network Node.js and Express final project.

The target repository was empty when inspected. This implementation uses the original
[IBM starter](https://github.com/ibm-developer-skills-network/expressBookReviews),
commit `fa6bb07442d70a4ea72d26c6731d8ff57ed4f9d6`. Its `final_project/` structure,
router names, catalog, and public/authenticated route paths are preserved.
`booksdb.js` and `LICENSE` are unchanged. The starter's implementation files,
package manifest, and documentation have been completed or updated.

## Install and run

Use Node.js 20 or later (tested with Node.js 24.21.0 and npm 11.19.0).

```sh
git clone https://github.com/daniarulyabubakyr/expressBookRevie.git
cd expressBookRevie/final_project
npm ci
npm start
```

The default address is `http://127.0.0.1:5000`. `npm run dev` starts nodemon.
Optional environment variables: `PORT`, `SESSION_SECRET`, `JWT_SECRET`, and
`BOOK_API_URL` (the Axios demo/evidence client's target URL).

## API

| Method | Route | Behavior |
| --- | --- | --- |
| GET | `/` | All ten books, keyed by ISBN |
| GET | `/isbn/:isbn` | One book |
| GET | `/author/:author` | Books matching author, case-insensitive substring |
| GET | `/title/:title` | Books matching title, case-insensitive substring |
| GET | `/review/:isbn` | Reviews keyed by username |
| POST | `/register` | Register JSON `{ "username": "reader", "password": "secret" }` |
| POST | `/customer/login` | Log in with the same JSON; save the session cookie |
| PUT | `/customer/auth/review/:isbn` | Add or update the signed-in user's JSON `{ "review": "..." }` |
| DELETE | `/customer/auth/review/:isbn` | Delete only the signed-in user's review |

PUT returns **201** for creation and **200** for an update. Registration returns
**201**, duplicate usernames **409**, invalid input **400**, unauthenticated requests
or invalid login **401**, and missing books/reviews/search matches **404**.
Deletion returns **200** with the remaining reviews. An existing book without reviews
returns **200** with `{}`. The starter's `?review=...` query input is also supported.
Any username supplied with a review is ignored: ownership comes from the session.

Usernames are case-sensitive and accept 1-64 letters, digits, underscores, or hyphens.
Passwords must be nonblank strings of 1-128 characters. Reviews must be nonblank
strings of at most 5,000 characters. Passwords are salted and hashed using Node scrypt.
Login rotates the session ID, saves a one-hour JWT on the server, and returns an
HTTP-only session cookie. Protected requests verify the JWT and registered username.

## Axios tasks in general.js

[`final_project/router/general.js`](final_project/router/general.js) exports:

| IBM task | Method | Asynchronous implementation |
| --- | --- | --- |
| 10 | `getAllBooks(callback?)` | Axios + async/await, optional error-first callback |
| 11 | `getBookByISBN(isbn)` | Axios Promise `.then()` |
| 12 | `getBooksByAuthor(author)` | Axios + async/await |
| 13 | `getBooksByTitle(title)` | Axios Promise `.then()` |

These clients make real HTTP requests to the running public endpoints. The endpoints
read the original local catalog directly; they do not recursively call themselves.
URL parameters are encoded, requests have a five-second timeout, and errors propagate
to the caller or callback. `createBookClient(baseURL)` supports isolated test servers.

With the application running, execute in another terminal:

```sh
cd expressBookRevie/final_project
npm run demo:axios
```

## Tests and submission evidence

```sh
npm test
```

The tests start their own server on an available port and use real HTTP requests.
They cover all required functionality, validation, missing resources, session
tampering, concurrent duplicate registration, password hashing, ownership isolation,
prototype-property input, and every Axios method including error handling.

To regenerate cURL evidence, start a fresh application with `npm start`, then run
`npm run evidence` in another terminal. This performs real requests, asserts response
statuses/data, and saves the ten requested named `.txt` files, plus update/deletion
verification, under `final_project/submission/`.

See [all commands and actual outputs](final_project/submission/SUBMISSION.md),
[test results](final_project/submission/tests.txt), and
[Axios output](final_project/submission/axios-results.txt).
The included JSON payloads avoid shell-specific escaping problems. Session cookie
files are ignored by Git.

## Storage scope

Users, reviews, and sessions are in memory, as in the IBM starter. They reset when
the server restarts. This is a coursework application; it does not claim durable
database storage or a production session store. No external book service is needed.

## License

The original IBM Apache-2.0 license is retained in [LICENSE](LICENSE).
