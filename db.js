const {MongoClient, ObjectID} = require('mongodb');
const assert = require('assert');
const fs = require('fs');

let config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

const url = config["MONGO_DB_URL"];
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

function find(db, table, query, options) {
  return db.collection(table).find(query, options).toArray();
}

function getPost(db, id, fields) {
  return db.collection("posts").findOne({_id: ObjectID(id)}, {projection: fields});
}

function getUser(db, id, fields) {
  return db.collection("users").findOne({_id: ObjectID(id)}, {projection: fields});
}

module.exports = {
  insertMany: function(table, docs, options) {
    return clientWrapper((db) => db.collection(table).insertMany(docs, options));
  },
  insertOne: function(table, doc, options) {
    return clientWrapper((db) => db.collection(table).insertOne(doc, options));
  },
  find: function(table, doc, options) {
    return clientWrapper((db) => find(db, table, doc, options));
  },
  findOne: function(table, doc, options) {
    return clientWrapper((db) => db.collection(table).findOne(doc, options));
  },
  getUser: function(id, fields) {
    return clientWrapper((db) => getUser(db, id, fields));
  },
  getPost: function(id, fields) {
    return clientWrapper((db) => getPost(db, id, fields));
  },
  updateOne: function(table, doc, update, options) {
    return clientWrapper((db) => db.collection(table).updateOne(doc, update, options));
  },
  findOneAndUpdate: function(table, doc, update, options) {
    return clientWrapper((db) => db.collection(table).findOneAndUpdate(doc, update, options));
  },
  bulkWrite: function(table, operations) {
    return clientWrapper((db) => db.collection(table).bulkWrite(operations));
  }
};
