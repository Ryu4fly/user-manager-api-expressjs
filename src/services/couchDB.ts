import { faker } from '@faker-js/faker';
import nano from 'nano';
import { createRandomLogs, createRandomUser } from './seed';

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
  const users = await createRandomUser();

  for (let i = 0; i < maxRetries; i++) {
    try {
      const couch = nano('http://db:5984');

      usersDB = couch.db.use(USERS_TABLE);
      logsDB = couch.db.use(AUDIT_LOG_TABLE);

      await usersDB.auth(user, password);
      console.info('Seeding users database...');
      await usersDB.bulk({
        docs: users,
      });
      console.info('Seeding users complete!');

      console.info('Creating email index');
      await usersDB.createIndex({
        index: { fields: ['email'] },
        name: 'email-index',
      });
      console.info('Email index complete');

      await logsDB.auth(user, password);
      console.info('Seeding logs database...');
      await logsDB.bulk({
        docs: faker.helpers.multiple(createRandomLogs, {
          count: 100,
        }),
      });
      console.info('Seeding logs complete!');

      console.info('Creating log index');
      await usersDB.createIndex({
        index: { fields: ['level', 'timestamp', 'resourceType'] },
        name: 'log-index',
      });
      console.info('log index complete');
      return;
    } catch {
      console.log(`CouchDB not ready, retrying... ${i + 1}/${maxRetries}`);
      await new Promise((res) => setTimeout(res, delay));
    }
  }

  throw new Error('CouchDB not reachable');
};
