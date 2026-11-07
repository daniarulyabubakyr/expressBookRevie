const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const app = require('../index');
const { createBookClient } = require('../router/general');
const { users } = require('../router/auth_users');

test('Book review application over real HTTP', async (t) => {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseURL = `http://127.0.0.1:${server.address().port}`;
  const client = createBookClient(baseURL);
  let aliceCookie;
  let bobCookie;

  async function request(path, { method = 'GET', body, cookie, raw } = {}) {
    const headers = {};
    if (body !== undefined || raw !== undefined) headers['Content-Type'] = 'application/json';
    if (cookie) headers.Cookie = cookie;
    const response = await fetch(baseURL + path, {
      method, headers, body: raw ?? (body === undefined ? undefined : JSON.stringify(body))
    });
    return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
  }

  await t.test('GET / returns all ten original books', async () => {
    const result = await request('/');
    assert.equal(result.status, 200);
    assert.equal(Object.keys(result.body).length, 10);
    assert.equal(result.body['1'].title, 'Things Fall Apart');
  });
  await t.test('GET ISBN returns exact book', async () => {
    assert.deepEqual(await request('/isbn/1'), { status: 200, body: {
      author: 'Chinua Achebe', title: 'Things Fall Apart', reviews: {}
    }, cookie: undefined });
  });
  await t.test('author search supports multiple matches and case-insensitive substrings', async () => {
    const result = await request('/author/unknown');
    assert.equal(result.status, 200);
    assert.deepEqual(Object.keys(result.body), ['4', '5', '6', '7']);
    assert.equal((await request('/author/CHINUA')).body['1'].author, 'Chinua Achebe');
  });
  await t.test('title search decodes spaces and supports case-insensitive substrings', async () => {
    const result = await request('/title/Things%20Fall%20Apart');
    assert.equal(result.status, 200);
    assert.equal(result.body['1'].title, 'Things Fall Apart');
    assert.equal((await request('/title/pride')).body['8'].author, 'Jane Austen');
  });
  await t.test('existing book initially has no reviews', async () => {
    const result = await request('/review/1');
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, {});
  });
  await t.test('missing books and unmatched searches return 404', async () => {
    for (const path of ['/isbn/999', '/review/999', '/author/nobody-here', '/title/no-such-book']) {
      assert.equal((await request(path)).status, 404, path);
    }
  });
  await t.test('prototype property names are not book IDs', async () => {
    for (const path of ['/isbn/__proto__', '/isbn/constructor', '/review/toString']) {
      assert.equal((await request(path)).status, 404, path);
    }
  });
  await t.test('blank search and malformed URL return 400', async () => {
    for (const path of ['/author/%20', '/title/%20', '/isbn/%ZZ']) {
      assert.equal((await request(path)).status, 400, path);
    }
  });
  await t.test('registration rejects missing, blank and wrongly typed credentials', async () => {
    for (const body of [{}, { username: 'alice', password: ' ' }, { username: {}, password: 'x' }, { username: 'a', password: 5 }]) {
      assert.equal((await request('/register', { method: 'POST', body })).status, 400);
    }
  });
  await t.test('registration creates user with hashed password', async () => {
    const result = await request('/register', { method: 'POST', body: { username: 'alice', password: 'alice-pass' } });
    assert.equal(result.status, 201);
    const user = users.find((entry) => entry.username === 'alice');
    assert.equal(user.password, undefined);
    assert.notEqual(user.passwordHash, 'alice-pass');
    assert.equal(user.passwordHash.length, 128);
  });
  await t.test('duplicate and concurrent duplicate registrations return 409', async () => {
    assert.equal((await request('/register', { method: 'POST', body: { username: 'alice', password: 'other' } })).status, 409);
    const results = await Promise.all([1, 2].map(() => request('/register', {
      method: 'POST', body: { username: 'race', password: 'secret' }
    })));
    assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  });
  await t.test('login rejects missing and invalid credentials', async () => {
    assert.equal((await request('/customer/login', { method: 'POST', body: {} })).status, 400);
    for (const username of ['alice', 'not-registered']) {
      assert.equal((await request('/customer/login', { method: 'POST', body: { username, password: 'wrong' } })).status, 401);
    }
  });
  await t.test('unauthenticated review creation, update and deletion are rejected', async () => {
    for (const method of ['PUT', 'DELETE']) {
      assert.equal((await request('/customer/auth/review/1', { method, body: { review: 'Bad' } })).status, 401);
    }
    assert.deepEqual((await request('/review/1')).body, {});
  });
  await t.test('login issues a usable session cookie', async () => {
    const result = await request('/customer/login', { method: 'POST', body: { username: 'alice', password: 'alice-pass' } });
    assert.equal(result.status, 200);
    assert.match(result.cookie, /^bookshop\.sid=/);
    aliceCookie = result.cookie;
  });
  await t.test('tampered session cookie is rejected', async () => {
    assert.equal((await request('/customer/auth/review/1', {
      method: 'PUT', cookie: aliceCookie + 'tampered', body: { review: 'Bad' }
    })).status, 401);
  });
  await t.test('review validation rejects empty, invalid and oversized review text', async () => {
    for (const review of ['', '  ', 7, {}, ['bad'], 'a'.repeat(5001)]) {
      assert.equal((await request('/customer/auth/review/1', { method: 'PUT', cookie: aliceCookie, body: { review } })).status, 400);
    }
    assert.equal((await request('/customer/auth/review/1', { method: 'PUT', cookie: aliceCookie })).status, 400);
  });
  await t.test('review mutations reject missing books and inherited keys', async () => {
    for (const isbn of ['999', '__proto__']) {
      for (const method of ['PUT', 'DELETE']) {
        assert.equal((await request(`/customer/auth/review/${isbn}`, { method, cookie: aliceCookie, body: { review: 'Test' } })).status, 404);
      }
    }
  });
  await t.test('adding review persists it and ignores spoofed username', async () => {
    const result = await request('/customer/auth/review/1', { method: 'PUT', cookie: aliceCookie, body: { review: 'Excellent book.', username: 'bob' } });
    assert.equal(result.status, 201);
    assert.deepEqual(result.body.reviews, { alice: 'Excellent book.' });
    assert.deepEqual((await request('/review/1')).body, { alice: 'Excellent book.' });
  });
  await t.test('updating review replaces only the current user entry', async () => {
    const result = await request('/customer/auth/review/1', { method: 'PUT', cookie: aliceCookie, body: { review: 'Updated review.' } });
    assert.equal(result.status, 200);
    assert.deepEqual((await request('/review/1')).body, { alice: 'Updated review.' });
  });
  await t.test('second user cannot delete another user review', async () => {
    assert.equal((await request('/register', { method: 'POST', body: { username: 'bob', password: 'bob-pass' } })).status, 201);
    const login = await request('/customer/login', { method: 'POST', body: { username: 'bob', password: 'bob-pass' } });
    assert.equal(login.status, 200);
    bobCookie = login.cookie;
    assert.equal((await request('/customer/auth/review/1?username=alice', { method: 'DELETE', cookie: bobCookie })).status, 404);
    assert.deepEqual((await request('/review/1')).body, { alice: 'Updated review.' });
  });
  await t.test('IBM query-string review input and user isolation both work', async () => {
    assert.equal((await request('/customer/auth/review/1?review=Bob%20review&username=alice', { method: 'PUT', cookie: bobCookie })).status, 201);
    assert.deepEqual((await request('/review/1')).body, { alice: 'Updated review.', bob: 'Bob review' });
  });
  await t.test('delete removes only the signed-in user review', async () => {
    const result = await request('/customer/auth/review/1', { method: 'DELETE', cookie: aliceCookie });
    assert.equal(result.status, 200);
    assert.deepEqual(result.body.reviews, { bob: 'Bob review' });
    assert.deepEqual((await request('/review/1')).body, { bob: 'Bob review' });
    assert.equal((await request('/customer/auth/review/1', { method: 'DELETE', cookie: aliceCookie })).status, 404);
  });
  await t.test('prototype-like username is stored and deleted as an ordinary own key', async () => {
    const body = { username: '__proto__', password: 'test-password' };
    assert.equal((await request('/register', { method: 'POST', body })).status, 201);
    const { cookie } = await request('/customer/login', { method: 'POST', body });
    assert.equal((await request('/customer/auth/review/2', { method: 'PUT', cookie, body: { review: 'Safe key' } })).status, 201);
    assert.equal(Object.hasOwn((await request('/review/2')).body, '__proto__'), true);
    assert.equal((await request('/customer/auth/review/2', { method: 'DELETE', cookie })).status, 200);
    assert.deepEqual((await request('/review/2')).body, {});
  });
  await t.test('malformed JSON, large bodies and missing routes return JSON errors', async () => {
    assert.equal((await request('/register', { method: 'POST', raw: '{invalid' })).status, 400);
    assert.equal((await request('/register', { method: 'POST', body: { value: 'a'.repeat(17000) } })).status, 413);
    assert.deepEqual((await request('/missing')).body, { message: 'Route not found.' });
    assert.equal((await request('/missing')).status, 404);
  });
  await t.test('Axios async/await retrieves all books over HTTP', async () => {
    assert.equal(Object.keys(await client.getAllBooks()).length, 10);
  });
  await t.test('Axios callback retrieves all books over HTTP', async () => {
    await new Promise((resolve, reject) => client.getAllBooks((err, books) => {
      if (err) return reject(err);
      try { assert.equal(Object.keys(books).length, 10); resolve(); } catch (error) { reject(error); }
    }));
  });
  await t.test('Axios Promise retrieves ISBN and propagates missing book rejection', async () => {
    assert.equal((await client.getBookByISBN('1')).title, 'Things Fall Apart');
    await assert.rejects(client.getBookByISBN('999'), (err) => err.response.status === 404);
  });
  await t.test('Axios author method retrieves multiple books and handles unicode', async () => {
    assert.equal(Object.keys(await client.getBooksByAuthor('Unknown')).length, 4);
    assert.equal((await client.getBooksByAuthor('Honoré de Balzac'))['9'].title, 'Le Père Goriot');
    await assert.rejects(client.getBooksByAuthor('missing'), (err) => err.response.status === 404);
  });
  await t.test('Axios title Promise encodes spaces and unicode and propagates errors', async () => {
    assert.equal((await client.getBooksByTitle('Things Fall Apart'))['1'].author, 'Chinua Achebe');
    assert.equal((await client.getBooksByTitle("Njál's Saga"))['7'].author, 'Unknown');
    await assert.rejects(client.getBooksByTitle('missing'), (err) => err.response.status === 404);
  });
  await t.test('Axios callback and Promise report HTTP failures', async () => {
    const badClient = createBookClient(baseURL + '/missing');
    await assert.rejects(badClient.getAllBooks(), (err) => err.response.status === 404);
    await new Promise((resolve, reject) => badClient.getAllBooks((err, data) => {
      try { assert.equal(err.response.status, 404); assert.equal(data, undefined); resolve(); } catch (error) { reject(error); }
    }));
  });
});
