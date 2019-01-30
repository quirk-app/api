var DataLoader = require('dataloader');
const {MongoClient, ObjectID} = require('mongodb');

function toObjectID(key) {
  if(!(key instanceof ObjectID)) return ObjectID(key);
  return key;
}

function batchUsers(table, ids) {
  console.log("Searching for ", ids);
  return table.collection('users')
    .find({_id: {$in: ids}}, {projection: {"posts": false, "votes": false, "upvotes": false, "downvotes": false}})
    .toArray().then((docs) => ids.map(id => docs.find(({_id: k}) => id.equals(k))));
}

module.exports = async (url, db_name) => {
  console.log("Connecting!");
  const client = await MongoClient.connect(url, {useNewUrlParser: true}).then(client=>client);
  const table = client.db(db_name);

  return {
    users: new DataLoader(
      keys => batchUsers(table, keys.map(toObjectID)),
      {cacheKeyFn: toObjectID},
    ),
  };
};
