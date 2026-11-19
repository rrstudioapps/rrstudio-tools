// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools

/** Esempi pronti: documento JSON (dati inventati) e alcune espressioni da provare. */
export interface QueryExample {
  id: 'books' | 'users';
  json: string;
  exprs: string[];
}

const books = {
  store: {
    book: [
      { category: 'reference', author: 'Nigel Rees', title: 'Sayings of the Century', price: 8.95 },
      { category: 'fiction', author: 'Evelyn Waugh', title: 'Sword of Honour', price: 12.99 },
      { category: 'fiction', author: 'Herman Melville', title: 'Moby Dick', isbn: '0-553-21311-3', price: 8.99 },
      { category: 'fiction', author: 'J. R. R. Tolkien', title: 'The Lord of the Rings', isbn: '0-395-19395-8', price: 22.99 },
    ],
    bicycle: { color: 'red', price: 399 },
  },
  expensive: 10,
};

const users = {
  users: [
    { id: 1, name: 'Giulia Rossi', active: true, roles: ['admin', 'dev'], address: { city: 'Milano', zip: '20121' }, score: 8.5 },
    { id: 2, name: 'Marco Bianchi', active: false, roles: ['dev'], address: { city: 'Torino', zip: '10121' }, score: 6 },
    { id: 3, name: 'Sara Conti', active: true, roles: [], address: { city: 'Roma' }, score: 9.25, nickname: 'sarac' },
  ],
  total: 3,
  generatedAt: '2026-01-15T10:30:00Z',
};

export const EXAMPLES: readonly QueryExample[] = [
  {
    id: 'books',
    json: JSON.stringify(books, null, 2),
    exprs: ['$.store.book[*].author', '$..book[?(@.price < 10)].title', "$..book[?(@.category == 'fiction' && @.price > 10)]", '$..book[-1:]', '$..price', '$..book[?(@.isbn)].title'],
  },
  {
    id: 'users',
    json: JSON.stringify(users, null, 2),
    exprs: ['$.users[*].name', '$.users[?(@.active)].name', "$.users[?(@.address.city =~ /^(Mi|To)/)].id", '$.users[?(length(@.roles) > 0)].name', '$..zip', '$.users[0:2].score'],
  },
];
