const { ApolloServer, gql } = require('apollo-server');
const { ObjectID } = require('mongodb');
const mongo = require('./db.js');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const config = require('./config.json');
const KEY_CUR = config["KEYS"][0];
const KEY_OLD = config["KEYS"][1];

// Type definitions define the "shape" of your data and specify
// which ways the data can be fetched from the GraphQL server.
const typeDefs = gql`
  type Query {
    user: User # Login, get current user info
    login(credentials: LoginInput!): LoginPayload
    posts(
      first: Int
      skip: Int
    ): PostsConnection
    postByID(id: ID!): Post
  }
  type User {
    id: ID!
    username: ID!
    email: String!
    gender: Gender
    birthday: Date!
    posts: [Post!]!
    votes: [Vote!]!
  }

  scalar Date
  scalar Time

  enum Gender {
    MALE
    FEMALE
    OTHER
  }
  type Post {
    id: ID!
    body: String!
    # votes: [Vote]
    voteByUser: Vote
    up: Int!
    down: Int!
    posted: Time!
  }
  type Vote {
    user: User!
    post: Post!
    choice: Choice!
  }
  enum Choice { # Change later
    UPVOTE
    DOWNVOTE
  }
  input LoginInput {
    username: ID!
    password: ID!
  }
  type LoginPayload {
    success: Boolean!
    error: String
    token: ID
  }
  type PostsConnection {
    totalCount: Int
    edges: [PostEdge]
    posts: [Post] # A convenience
    cursor: ID!
  }
  type PostEdge {
    cursor: ID!
    post: Post
  }
  type Mutation {
    newUser(input: NewUserInput!): NewUserPayload
    createPost(post: CreatePostInput!): CreatePostPayload!
    updateVote(vote: UpdateVoteInput!): UpdateVotePayload!
  }
  input NewUserInput {
    username: ID!
    password: ID!
    email: String!
    gender: Gender
    birthday: Date!
  }
  type NewUserPayload {
    success: Boolean!
    error: String
    token: ID
  }
  input CreatePostInput {
    body: String!
    # TODO tags
  }
  type CreatePostPayload {
    success: Boolean!
    error: String
    post: Post
  }
  input UpdateVoteInput {
    postID: ID!
    choice: Choice!
  }
  type UpdateVotePayload {
    success: Boolean!
    error: String
    vote: Vote
  }
`;

function getToken(data) {
  return jwt.sign(data, KEY_CUR, { expiresIn: '30d', issuer: 'api'});
}

// Resolvers define the technique for fetching the types in the
// schema.  We'll retrieve books from the "books" array above.
const resolvers = {
  Query: {
    user: (obj, args, {user}) => {
      if(!user) return null;
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
    posts: (obj, args, {user}) => {
      let opt = {};
      if(args.first) opt.limit = args.first;
      if(args.skip) opt.skip = args.skip;
      return mongo.find("posts", {}, opt).then(
        (res) => {
          console.log(res);
          return {posts: res};
        },
        (err) => {
          console.log(err); // TODO: Add error
          return null;
        }
      );
    },
  },
  Mutation: {
    newUser: (obj, { input }) => {
      input.posts = [];
      input.votes = [];
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
      post.votes = [];
      post.up = 0;
      post.down = 0;
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
    /*
    updateVote(vote: UpdateVoteInput!): UpdateVotePayload!
      input UpdateVoteInput {
    postID: ID!
    choice: Choice!
  }
  type UpdateVotePayload {
    success: Boolean!
    error: String
  }

    type Post {
    id: ID!
    body: String!
    # votes: [Vote]
    voteByUser: Vote
    up: Int!
    down: Int!
    posted: Date!
  }
  type Vote {
    user: User!
    post: Post!
    choice: Choice!
  }
  enum Choice { # Change later
    UPVOTE
    DOWNVOTE
  }

  type User {
    id: ID!
    username: ID!
    email: String!
    gender: Gender
    birthday: Date!
    posts: [Post!]!
    votes: [Vote!]!
  }
    */
    updateVote: (obj, { vote }, { user }) => {
      // TODO: need to check if user already voted
      if(!user) return null;

      let voteObj = {
        user: user._id,
        post: ObjectID(vote.postID),
        choice: vote.choice
      };
      return mongo.findOne("users", {_id: user._id, votes: {$elemMatch: {post: voteObj.post}}}, {projection: {"votes.$": 1}}).then(
        res => {
          console.log("foau", res);
          if(res) {

          } else {

          }
          return mongo.updateOne("users", {_id: user._id}, {$push: {votes: voteObj}}, {projection: {"votes.$": 1}}).then(
            insertedVote => {
              let userUpvoted = (voteObj.choice === 'UPVOTE' ? 1 : 0);
              let userDownvoted = (voteObj.choice === 'DOWNVOTE' ? 1 : 0);
              return mongo.updateOne("posts", {_id: ObjectID(voteObj.post)}, {$inc: {up: userUpvoted, down: userDownvoted}, $push: {votes: voteObj}}).then(
                res => {console.log(res); return {success: true, error: `${res}`};},
                err => ({success: false, error: `Couldn't update vote on post: ${err}`})
              );
            },
            err => ({success: false, error: `Couldn't update user votes: ${err}`})
          );
        },
        err => {
          console.log(err);
          return {success: false, error: err.toString()};
        }
      );
      // return mongo.updateOne("users", {_id: user._id}, {$push: {votes: voteObj}}).then(
      //   insertedVote => {
      //     let userUpvoted = (voteObj.choice === 'UPVOTE' ? 1 : 0);
      //     let userDownvoted = (voteObj.choice === 'DOWNVOTE' ? 1 : 0);
      //     return mongo.updateOne("posts", {_id: ObjectID(voteObj.post)}, {$inc: {up: userUpvoted, down: userDownvoted}, $push: {votes: voteObj}}).then(
      //       res => {console.log(res); return {success: true, error: `${res}`};},
      //       err => ({success: false, error: `Couldn't update vote on post: ${err}`})
      //     );
      //   },
      //   err => ({success: false, error: `Couldn't update user votes: ${err}`})
      // );
    }
  },
  Post: {
    id: (obj) => obj._id.toString()
  },
  User: {
    id: (obj) => obj._id.toString()
  }
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
    const token = req.headers.authorization || '';
    let res = verify(token, KEY_CUR) || verify(token, KEY_OLD);
    console.log(token);

    if (res) {
      console.log("AUTHENTICATED " + JSON.stringify(res));
      // TODO; add user to context
      let user = await mongo.getUser(res.id, {"posts": false, "votes": false}).then((result) => result);
      console.log("Context: ", user);
      return {user: user};
    }
    else {
      console.log("DENIED");
    }
  }
});

// This `listen` method launches a web-server.  Existing apps
// can utilize middleware options, which we'll discuss later.
server.listen().then(({ url }) => {
  console.log(`🚀  Server ready at ${url}`);
});
