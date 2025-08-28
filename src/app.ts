import express from 'express';
import auth from './routers/auth.router';
import logs from './routers/logs.router';
import users from './routers/users.router';
import { connectDB } from './services/couchDB';

const app = express();
const port = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/auth', auth);
app.use('/users', users);
app.use('/logs', logs);

app.listen(port, async () => {
  try {
    await connectDB();
    console.log(`Listening to port: ${port}`);
  } catch (err) {
    console.error('Failed to connect to CouchDB:', err);
    process.exit(1);
  }
});
