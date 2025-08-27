import nano from 'nano';

const user = process.env.COUCHDB_USER;
const password = process.env.COUCHDB_PASSWORD;

if (!user || !password) {
  throw new Error('user or password not defined in env file');
}

const USERS_TABLE = 'users';
const AUDIT_LOG_TABLE = 'logs';

export let usersDB: nano.DocumentScope<any>;
export let logsDB: nano.DocumentScope<any>;

export const connectDB = async (maxRetries = 5, delay = 3000) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const couch = nano('http://db:5984');
      usersDB = couch.db.use(USERS_TABLE);
      logsDB = couch.db.use(AUDIT_LOG_TABLE);
      await usersDB.auth(user, password);
      await logsDB.auth(user, password);
      return;
    } catch {
      console.log(`CouchDB not ready, retrying... ${i + 1}/${maxRetries}`);
      await new Promise((res) => setTimeout(res, delay));
    }
  }

  throw new Error('CouchDB not reachable');
};
