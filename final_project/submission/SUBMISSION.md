# Actual cURL submission evidence

Captured at 2026-11-07T09:10:14.183Z. Each output below came from the curl executable; expected statuses and key response data were asserted.

Run these commands from final_project after npm ci and npm start. Use a fresh server process before replaying registration. On Windows use curl.exe; on macOS/Linux use curl. Payload files are included under submission/. The password is a public demonstration credential, not a real account password.

The getbookreview request runs after reviewadded so it demonstrates persisted review data. reviewupdated and reviewafterdelete are extra verification beyond the ten requested submission files.

## githubrepo

Command:

```sh
curl.exe --silent --show-error --max-time 30 --location --output submission/githubrepo.html --write-out "HTTP_STATUS=%{http_code}\nURL=%{url_effective}\n" https://github.com/daniarulyabubakyr/expressBookRevie
```

Actual output:

```text
HTTP_STATUS=200
URL=https://github.com/daniarulyabubakyr/expressBookRevie
```

## getallbooks

Command:

```sh
curl.exe --silent --show-error --max-time 30 --write-out "\nHTTP_STATUS=%{http_code}\n" http://127.0.0.1:5000/
```

Actual output:

```text
{"1":{"author":"Chinua Achebe","title":"Things Fall Apart","reviews":{}},"2":{"author":"Hans Christian Andersen","title":"Fairy tales","reviews":{}},"3":{"author":"Dante Alighieri","title":"The Divine Comedy","reviews":{}},"4":{"author":"Unknown","title":"The Epic Of Gilgamesh","reviews":{}},"5":{"author":"Unknown","title":"The Book Of Job","reviews":{}},"6":{"author":"Unknown","title":"One Thousand and One Nights","reviews":{}},"7":{"author":"Unknown","title":"Njál's Saga","reviews":{}},"8":{"author":"Jane Austen","title":"Pride and Prejudice","reviews":{}},"9":{"author":"Honoré de Balzac","title":"Le Père Goriot","reviews":{}},"10":{"author":"Samuel Beckett","title":"Molloy, Malone Dies, The Unnamable, the trilogy","reviews":{}}}
HTTP_STATUS=200
```

## getbooksbyISBN

Command:

```sh
curl.exe --silent --show-error --max-time 30 --write-out "\nHTTP_STATUS=%{http_code}\n" http://127.0.0.1:5000/isbn/1
```

Actual output:

```text
{"author":"Chinua Achebe","title":"Things Fall Apart","reviews":{}}
HTTP_STATUS=200
```

## getbooksbyauthor

Command:

```sh
curl.exe --silent --show-error --max-time 30 --write-out "\nHTTP_STATUS=%{http_code}\n" "http://127.0.0.1:5000/author/Chinua%20Achebe"
```

Actual output:

```text
{"1":{"author":"Chinua Achebe","title":"Things Fall Apart","reviews":{}}}
HTTP_STATUS=200
```

## getbooksbytitle

Command:

```sh
curl.exe --silent --show-error --max-time 30 --write-out "\nHTTP_STATUS=%{http_code}\n" "http://127.0.0.1:5000/title/Things%20Fall%20Apart"
```

Actual output:

```text
{"1":{"author":"Chinua Achebe","title":"Things Fall Apart","reviews":{}}}
HTTP_STATUS=200
```

## register

Command:

```sh
curl.exe --silent --show-error --max-time 30 --write-out "\nHTTP_STATUS=%{http_code}\n" --request POST --header "Content-Type: application/json" --data-binary @submission/credentials.json http://127.0.0.1:5000/register
```

Actual output:

```text
{"message":"User successfully registered. You can now log in."}
HTTP_STATUS=201
```

## login

Command:

```sh
curl.exe --silent --show-error --max-time 30 --write-out "\nHTTP_STATUS=%{http_code}\n" --request POST --header "Content-Type: application/json" --data-binary @submission/credentials.json --cookie-jar submission/cookies.txt http://127.0.0.1:5000/customer/login
```

Actual output:

```text
{"message":"User successfully logged in.","username":"submission_user"}
HTTP_STATUS=200
```

## reviewadded

Command:

```sh
curl.exe --silent --show-error --max-time 30 --write-out "\nHTTP_STATUS=%{http_code}\n" --request PUT --cookie submission/cookies.txt --header "Content-Type: application/json" --data-binary @submission/review.json http://127.0.0.1:5000/customer/auth/review/1
```

Actual output:

```text
{"message":"Review added successfully.","reviews":{"submission_user":"An insightful and memorable novel."}}
HTTP_STATUS=201
```

## getbookreview

Command:

```sh
curl.exe --silent --show-error --max-time 30 --write-out "\nHTTP_STATUS=%{http_code}\n" http://127.0.0.1:5000/review/1
```

Actual output:

```text
{"submission_user":"An insightful and memorable novel."}
HTTP_STATUS=200
```

## reviewupdated

Command:

```sh
curl.exe --silent --show-error --max-time 30 --write-out "\nHTTP_STATUS=%{http_code}\n" --request PUT --cookie submission/cookies.txt --header "Content-Type: application/json" --data-binary @submission/updated-review.json http://127.0.0.1:5000/customer/auth/review/1
```

Actual output:

```text
{"message":"Review updated successfully.","reviews":{"submission_user":"Updated: a powerful story with memorable characters."}}
HTTP_STATUS=200
```

## deletereview

Command:

```sh
curl.exe --silent --show-error --max-time 30 --write-out "\nHTTP_STATUS=%{http_code}\n" --request DELETE --cookie submission/cookies.txt http://127.0.0.1:5000/customer/auth/review/1
```

Actual output:

```text
{"message":"Review deleted successfully.","reviews":{}}
HTTP_STATUS=200
```

## reviewafterdelete

Command:

```sh
curl.exe --silent --show-error --max-time 30 --write-out "\nHTTP_STATUS=%{http_code}\n" http://127.0.0.1:5000/review/1
```

Actual output:

```text
{}
HTTP_STATUS=200
```
