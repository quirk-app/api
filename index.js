const { ApolloServer, gql } = require('apollo-server');
mongo = require('./db.js');
bcrypt = require('bcrypt');

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
    user: User
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
    user: User
    # TODO: possibly return auth token on new account (or just make them login again)
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
      return mongo.findOne("users", {username: credentials.username}).then(
        (result) => {
          console.log(result);
          if(!result) return {success: false, error: "Username or password is incorrect.", user: null};
          return bcrypt.compare(credentials.password, result.password).then((res) => {
            if(res) {
              return {success: true, user: result};
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
      return bcrypt.hash(input.password, 10).then((hash)=>{
        // Generated password hash
        input.password = hash;

        return mongo.findOne("users", {username: input.username}).then(
          (result) => {
            if(!result) {
              return mongo.insertDocument("users", input).then(
                function(result) {
                  return {success:true, user: result.ops[0]};
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

// In the most basic sense, the ApolloServer can be started
// by passing type definitions (typeDefs) and the resolvers
// responsible for fetching the data for those types.
const server = new ApolloServer({ typeDefs, resolvers });

// This `listen` method launches a web-server.  Existing apps
// can utilize middleware options, which we'll discuss later.
server.listen().then(({ url }) => {
  console.log(`🚀  Server ready at ${url}`);
});
