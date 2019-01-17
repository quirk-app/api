const { ApolloServer, gql } = require('apollo-server');
const mongo = require('./db.js');
const bcrypt = require('bcrypt');
const fs = require('fs');
const jwt = require('jsonwebtoken');

let config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
const KEY_1 = config["KEYS"][0];
const KEY_2 = config["KEYS"][1];

// Type definitions define the "shape" of your data and specify
// which ways the data can be fetched from the GraphQL server.
const typeDefs = gql`
  type User {
    username: ID!
    email: String!
    gender: Gender
    birthday: Date!
    posts: [Post!]!
    votes: [Vote!]!
  }

  scalar Date

  enum Gender {
    MALE
    FEMALE
    OTHER
  }
  type Post {
    body: String!
    votes: [Vote]
    up: Int!
    down: Int!
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
  type Query {
    user: User # Login, get current user info
    login(credentials: LoginInput!): LoginPayload
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
  type Mutation {
    newUser(input: NewUserInput!): NewUserPayload
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
`;

const harambe = {
  username: "harambe69420",
  pw: "123456",
  email: "god@gmail.com",
  birthday: 1,
  posts: [],
  votes: [],
};

// Resolvers define the technique for fetching the types in the
// schema.  We'll retrieve books from the "books" array above.
const resolvers = {
  Query: {
    user: () => harambe,
    login: (_, { credentials }) => {
      return mongo.findOne("users", {username_lower: credentials.username.toLowerCase()}).then(
        (result) => {
          console.log(result);
          if(!result) return {success: false, error: "Username or password is incorrect.", user: null};
          return bcrypt.compare(credentials.password, result.password).then((res) => {
            if(res) {
              return {
                success: true,
                token: jwt.sign({
                  id: result._id
                }, KEY_1, { expiresIn: '30d', issuer: 'justin\'s BIG 🍆'})
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
    }
  },
  Mutation: {
    newUser: (_, { input }) => {
      input.posts = [];
      input.votes = [];
<<<<<<< HEAD
      input.username_lower = input.username.toLowerCase(); // unique case-insensitive names
=======
      input.username_lower = username.toLowerCase(); // unique case-insensitive names
>>>>>>> 5f94fb7281fa3b1ef4c56df74f90af2c75baf178

      return bcrypt.hash(input.password, 10).then((hash)=>{
        // Generated password hash
        input.password = hash;

        return mongo.findOne("users", {username_lower: input.username_lower}).then(
          (result) => {
            console.log(result);
            if(!result) {
              console.log(result);
              return mongo.insertDocument("users", input).then(
                function(addeduser) {
                  console.log("added user id: " + addeduser.ops[0]._id);
                  return {
                    success: true,
                    token: jwt.sign({
                      id: addeduser.ops[0]._id
                    }, KEY_1, { expiresIn: '30d', issuer: 'justin\'s BIG 🍆'})
                  };
                },
                function(err) {
                  console.log(err);
                  return {success: false, user: null, error: "Error encountered when attempting to create the account. Try again later."}; // ERROR
                }
              );
            } else return {success: false, user: null, error: "An account has already been created with the given username."};
          },
          (err) => {
            console.log(err);
            return null;
          });
      });

      // TODO: Error trapping
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
  context: ({ req }) => {
    const token = req.headers.authorization || '';
    let res = verify(token, KEY_1) || verify(token, KEY_2);
    console.log(token);
    
    if (res) {
      console.log("AUTHENTICATED " + JSON.stringify(res));
      // TODO; add user to context
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
