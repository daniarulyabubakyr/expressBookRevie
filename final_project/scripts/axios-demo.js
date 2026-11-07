const { getAllBooks, getBookByISBN, getBooksByAuthor, getBooksByTitle } = require('../router/general');

async function main() {
  await new Promise((resolve, reject) => {
    getAllBooks((err, books) => {
      if (err) return reject(err);
      console.log('Task 10 - all books:', JSON.stringify(books));
      resolve();
    });
  });
  console.log('Task 11 - ISBN 1:', JSON.stringify(await getBookByISBN('1')));
  console.log('Task 12 - author Unknown:', JSON.stringify(await getBooksByAuthor('Unknown')));
  console.log('Task 13 - title Things Fall Apart:', JSON.stringify(await getBooksByTitle('Things Fall Apart')));
}

main().catch((err) => {
  console.error('Axios request failed:', err.response?.status || err.code, err.message);
  process.exitCode = 1;
});
