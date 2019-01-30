const { ApolloServer, gql, AuthenticationError } = require('apollo-server');
const { ObjectID } = require('mongodb');
const mongo = require('./db.js');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const config = require('./config.json');
const KEY_CUR = config["KEYS"][0];
const KEY_OLD = config["KEYS"][1];

const getDataLoaders = require('./dataloaders.js');

// Type definitions define the "shape" of your data and specify
// which ways the data can be fetched from the GraphQL server.
const typeDefs = gql(require('fs').readFileSync('schema.graphql', 'utf8'));

function getToken(data) {
  return jwt.sign(data, KEY_CUR, { expiresIn: '30d', issuer: 'api'});
}

// Resolvers define the technique for fetching the types in the
// schema.  We'll retrieve books from the "books" array above.
const resolvers = {
  Query: {
    user: (obj, args, {user}) => {
      if(!user) throw new AuthenticationError("You must be logged in!");
      return user;
    },
    login: (obj, { credentials }) => {
      return mongo.findOne("users", {username_lower: credentials.username.toLowerCase()}).then(
        (result) => {
          console.log(result);
          if(!result) return {success: false, error: "Username or password is incorrect."};
          return bcrypt.compare(credentials.password, result.password).then((res) => {
            if(res) {
              return {
                success: true,
                token: getToken({ id: result._id }),
              };
            } else {
              return {success: false, error: "Username or password is incorrect."};
            }});
        },
        (err) => {
          console.log(err);
          return {success: false, error: "Error encountered when attempting to login. Try again later."};
        }
      );
    },
    posts: (obj, args, {user}) => { // Do something with user
      let opt = {};
      if(args.first) opt.limit = args.first;
      if(args.skip) opt.skip = args.skip;
      return mongo.find("posts", {}, opt).then(
        (res) => {
          console.log(res);
          return {totalCount: res.length, posts: res};
        },
        (err) => {
          console.log(err); // TODO: Add error
          return {totalCount: 0};
        }
      );
    },
    postByID: (obj, {id}, {user}) => {
      return mongo.findOne("posts", {_id: ObjectID(id)}).then(
        (res) => {
          return res;
        },
        (err) => {
          console.log(err);
          throw err;
        }
      );
    },
  },
  Mutation: {
    newUser: (obj, { input }) => {
      input.posts = [];
      input.upvotes = [];
      input.downvotes = [];
      input.username_lower = input.username.toLowerCase(); // unique case-insensitive names

      return bcrypt.hash(input.password, 10).then((hash)=>{
        // Generated password hash
        input.password = hash;

        return mongo.findOne("users", {username_lower: input.username_lower}).then(
          (result) => {
            console.log(result);
            if(!result) {
              console.log(result);
              return mongo.insertOne("users", input).then(
                function(addeduser) {
                  console.log("added user id: " + addeduser.ops[0]._id);
                  return {
                    success: true,
                    token: getToken({ id: addeduser.ops[0]._id }),
                  };
                },
                function(err) {
                  console.log(err);
                  return {success: false, error: "Error encountered when attempting to create the account. Try again later."}; // ERROR
                }
              );
            } else return {success: false, error: "An account has already been created with the given username."};
          },
          (err) => {
            console.log(err);
            return null;
          });
      });

      // TODO: Error trapping
    },
    createPost: (obj, { post }, { user }) => {
      if(!user) throw new AuthenticationError("You must be logged in!");

      post.upvotes = [];
      post.downvotes = [];
      post.poster = user._id;
      post.posted = Date.now();
      return mongo.insertOne("posts", post).then(
        (postInserted) => {
          console.log(postInserted.ops[0]);
          return mongo.updateOne("users", {_id: user._id}, {$push: {posts: postInserted.ops[0]._id}}).then(
            (res) => ({success: true, post: postInserted.ops[0]}),
            (err) => ({success: true, error: "WAS NOT ABLE TO STORE POST TO USER.", post: postInserted.ops[0]})
          );
        },
        (err) => {
          return {success: false, error: `Server error: ${err}`};
        }
      );

    },
    updateVote: (obj, { vote }, { user }) => {
      if(!user) throw new AuthenticationError("You must be logged in!");

      let voteObj = {
        user: user._id,
        post: ObjectID(vote.postID),
        choice: vote.choice
      };

      let voteAction = {};
      voteAction[voteObj.choice.toLowerCase() + 's'] = voteObj;

      return mongo.bulkWrite("users", [
        { updateOne: {
          filter: {_id: user._id},
          update: {$pull: {upvotes: {post: voteObj.post}, downvotes: {post: voteObj.post}}}
        }},
        { updateOne: {
          filter: {_id: user._id},
          update: {$push: voteAction}
        }}
      ]).then(
        res => {
          return mongo.bulkWrite("posts", [
            { updateOne: {
              filter: {_id: ObjectID(voteObj.post)},
              update: {$pull: {upvotes: {user: voteObj.user}, downvotes: {user: voteObj.user}}}
            }},
            { updateOne: {
              filter: {_id: ObjectID(voteObj.post)},
              update: {$push: voteAction}
            }}
          ]).then(
            res2 => ({success: true, vote: voteObj}),
            err => ({success: false, error: `Couldn't update post votes: ${err}`})
          );
        },
        err => ({success: false, error: `Couldn't update user votes: ${err}`})
      );
    }
  },
  User: {
    id: (obj) => obj._id.toString()
  },
  Post: {
    id: (obj) => obj._id.toString(),
    voteByUser: (obj, args, {user}) => {
      if(!user) throw new AuthenticationError("You must be logged in!");

      console.log(obj);
      return mongo.findOne("posts", {_id: obj._id}, {projection: {upvoted: 0, downvoted: 0}}).then(
        (res) => {
          if (!res) return undefined;

          let voteRes = {
            user: user._id,
            post: obj._id,
            choice: undefined
          };

          return mongo.countDocuments("users", {_id: user._id, 'upvotes.post': obj._id}).then(
            upvoted => {
              if (upvoted) {
                voteRes.choice = 'UPVOTE';
                return voteRes;
              }
              else {
                return mongo.countDocuments("users", {_id: user._id, 'downvotes.post': obj._id}).then(
                  downvoted => {
                    if (downvoted) {
                      voteRes.choice = 'DOWNVOTE';
                    }
                    return voteRes;
                  },
                  err => {
                    console.log(err);
                    throw err;
                  }
                );
              }
            },
            (err) => {
              console.log(err);
              throw err;
            }
          );
        },
        (err) => {
          console.log(err);
          throw err;
        }
      );
    },
  },
};

function verify(token, key) {
  try {
    return jwt.verify(token, key);
  }
  catch(err) {
    return false;
  }
}

// In the most basic sense, the ApolloServer can be started
// by passing type definitions (typeDefs) and the resolvers
// responsible for fetching the data for those types.
const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: async ({ req }) => {
    let ctx = {};
    ctx.dataloaders = await getDataLoaders(config.MONGO_DB_URL, 'main');

    const token = req.headers.authorization || '';
    let res = verify(token, KEY_CUR) || verify(token, KEY_OLD);
    console.log(token);

    if (res) {
      console.log("AUTHENTICATED " + JSON.stringify(res));
      // TODO; add user to context
      let user = await ctx.dataloaders.users.load(res.id);
      console.log(user);
      if(user) ctx.user = user;
    }
    else {
      console.log("DENIED");
    }

    return ctx;
  }
});

// This `listen` method launches a web-server.  Existing apps
// can utilize middleware options, which we'll discuss later.
server.listen().then(({ url }) => {
  console.log(`🚀  Server ready at ${url}`);
});
