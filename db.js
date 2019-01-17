const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');

const url = 'mongodb+srv://quirkadmin:icdTdIRn7RuNJCM1@cluster0-allgm.mongodb.net/main?retryWrites=true'
const dbName = 'main';

function clientWrapper(operation) {
  return MongoClient.connect(url, {useNewUrlParser: true}).then(function(client) {
    console.log("Connected successfully to server");

    const db = client.db(dbName);

    return new Promise(function(resolve, reject) {
      return operation(db).then(function(result) {
        client.close();
        console.log("Client closed");
        console.log("Found result!");
        resolve(result);
      }, function(err) {
        client.close();
        console.log("Client closed");
        console.log("Operation failed");
        reject(err);
      });
    });
  }, function(err) {
    console.log("Encountered error", err);
    return new Promise((_, err) => { err(); });
  });
}

function insertDocuments(db, table, docs) {
  return db.collection(table).insertMany(docs);
}

function insertDocument(db, table, doc) {
  return db.collection(table).insertOne(doc);
}

function find(db, table, query) {
  return db.collection(table).find(query);
}

function findOne(db, table, query) {
  return db.collection(table).findOne(query);
}

module.exports = {
  insertDocuments: function(table, docs) {
    return clientWrapper((db) => insertDocuments(db, table, docs));
  },

  insertDocument: function(table, doc) {
    return clientWrapper((db) => insertDocument(db, table, doc));
  },

  findDocuments: function(table, doc) {
    return clientWrapper((db) => findDocuments(db, table, doc));
  },

  findOne: function(table, doc) {
    return clientWrapper((db) => findOne(db, table, doc));
  },
};
