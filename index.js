const { ApolloServer, gql } = require('apollo-server');

// Type definitions define the "shape" of your data and specify
// which ways the data can be fetched from the GraphQL server.
const typeDefs = gql`

type User {
  username: ID!
  pw: ID!
  email: String!
  gender: Gender
  birthday: Int!
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

}
type Mutation {
  newUser(input: NewUserInput): NewUserPayload
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

// Resolvers define the technique for fetching the types in the
// schema.  We'll retrieve books from the "books" array above.
const resolvers = {
  Query: {
    user: () => ({
      username: "harambe69420",
      pw: "123456",
      email: "god@gmail.com",
      birthday: 1,
      posts: [],
      votes: [],
    })
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
