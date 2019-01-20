# api
Internal GraphQL API endpoint for platform.

## Getting started

### Environment

Make sure you have npm installed.

The current list of dependencies is listed below, however, you can install them in the repository with `npm install`.

- `apollo-server` - the framework that the endpoint is built on
- `graphql` - supporting tools for graphql
- `mongodb` - to access the database
- `bcrypt` - password encryption
- `jsonwebtoken` - used for authentication in issuing tokens.

Within mongodb, whitelist your IP so that the api can access the database.

### Structure
The main parts of the api such as resolvers are in `index.js`. The database wrappers are in `db.js`.

### Testing
Run the program with `node index.js`.

This will create run the server on `localhost:4000`.
