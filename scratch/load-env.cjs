/**
 * Loads the store's own env file before anything else, so an instrument can build the production
 * modules the way the server builds them. Registered with `node -r`, which runs it before the main
 * module — the order matters because the modules read their credentials at call time.
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env.local") });
