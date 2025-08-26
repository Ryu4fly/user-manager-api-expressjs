import bcrypt from 'bcrypt';
import express, { type Request, type Response } from 'express';
import nano from 'nano';
import z from 'zod';
import { authorizer } from './middlewares/authorizer.js';
import { LoginParams, RegisterParams, User } from './types.js';
import { isAdmin } from './utils/is-admin.js';
import { signAccessToken, signRefreshToken } from './utils/jwt/jwt.js';

const USERS_TABLE = 'users';

const app = express();
const port = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let usersDB: nano.DocumentScope<any>;
const connectDB = async (maxRetries = 5, delay = 3000) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const couch = nano('http://db:5984');
      usersDB = couch.db.use(USERS_TABLE);
      await usersDB.auth('user', 'pass');
      return;
    } catch {
      console.log(`CouchDB not ready, retrying... ${i + 1}/${maxRetries}`);
      await new Promise((res) => setTimeout(res, delay));
    }
  }

  throw new Error('CouchDB not reachable');
};

app.get('/ping', (req: Request, res: Response) => {
  res.send('Health Check');
});

app.get('/users', authorizer, async (req: Request, res: Response) => {
  if (!isAdmin(req)) {
    res.status(403).json({ ok: false, message: 'FORBIDDEN' });
    return;
  }

  try {
    const doclist = await usersDB.list({ include_docs: true });

    const users = doclist.rows.map((row) => ({
      id: row.id,
      email: row.doc?.email,
      role: row.doc?.role,
    }));

    res.status(200).json({ ok: true, users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: 'Unhandled Exception' });
  }
});

// TODO: user should not be able to access other users, unless admin
app.get('/users/:id', async (req: Request, res: Response) => {
  const id = req.params.id;
  if (!id) {
    res.status(400).json({ ok: false, message: 'Bad Request' });
    return;
  }

  try {
    const user = await usersDB.get(id);
    res.status(200).json({ ok: true, user });
  } catch (err) {
    if (typeof err === 'object' && err !== null && 'statusCode' in err) {
      if (err.statusCode === 404) {
        res.status(err.statusCode).json({ ok: false, message: 'Not Found' });
        return;
      }
    }

    console.error(err);
    res.status(500).json({ ok: false, message: 'Unhandled Exception' });
  }
});

// TODO: user should not be able to delete other accounts, unless admin
app.delete('/users/:id', async (req: Request, res: Response) => {
  const id = req.params.id;
  if (!id) {
    res.status(400).json({ ok: false, message: 'Bad Request' });
    return;
  }

  try {
    const user = await usersDB.get(id);
    if (!user) {
      res.status(404).json({ ok: false, message: 'Not Found' });
      return;
    }
    await usersDB.destroy(user._id, user._rev);
    res.status(200).json({ ok: true });
  } catch (err) {
    if (typeof err === 'object' && err !== null && 'statusCode' in err) {
      if (err.statusCode === 404) {
        res.status(err.statusCode).json({ ok: false, message: 'Not Found' });
        return;
      }
    }

    console.error(err);
    res.status(500).json({ ok: false, message: 'Unhandled Exception' });
  }
});

app.post('/register', async (req: Request, res: Response) => {
  const parsedBody = RegisterParams.safeParse(req.body);

  if (!parsedBody.success) {
    console.warn('Invalid Request Body', {
      error: z.treeifyError(parsedBody.error),
    });
    res.status(400).json({
      ok: false,
      message: 'Validation failed',
    });
    return;
  }

  const { email, password } = parsedBody.data;

  const query = {
    selector: {
      email: {
        $eq: email,
      },
    },
  };
  const response = await usersDB.find(query);
  const user = response.docs[0];

  if (user) {
    res.status(400).json({ ok: false, message: 'User already exists' });
    return;
  }

  try {
    const hashed = await bcrypt.hash(password, 10);
    const response = await usersDB.insert({
      email,
      password: hashed,
      role: 'user',
    });
    res.status(201).json({ ok: true, id: response.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: 'Unhandled Exception' });
  }
});

app.post('/login', async (req: Request, res: Response) => {
  const parsedBody = LoginParams.safeParse(req.body);
  if (!parsedBody.success) {
    console.warn('Invalid Request Body', {
      error: z.treeifyError(parsedBody.error),
    });
    res.status(400).json({ ok: false, message: 'Invalid request body' });
    return;
  }

  const { password, email } = parsedBody.data;

  const query = {
    selector: {
      email: {
        $eq: email,
      },
    },
  };

  const response = await usersDB.find(query);

  const document = response.docs[0];
  if (document === undefined) {
    res.status(401).json({ ok: false, message: 'Unauthorized' });
    return;
  }

  const parseResult = User.safeParse(document);
  if (!parseResult.success) {
    console.error('Fetched document is invalid', {
      email,
      error: z.treeifyError(parseResult.error),
    });
    res.status(500).json({ ok: false, message: 'FORBIDDEN' });
    return;
  }

  const user = parseResult.data;
  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    console.warn('Attempted login with invalid credentials', {
      email,
    });
    res.status(401).json({ ok: false, message: 'Unauthorized' });
    return;
  }

  console.log('User login successful:', {
    id: user._id,
    role: user.role,
  });
  res.status(200).json({
    ok: true,
    data: {
      accessToken: signAccessToken(user),
      refreshToken: signRefreshToken(user),
    },
  });
});

app.listen(port, async () => {
  try {
    await connectDB();
    console.log(`Listening to port: ${port}`);
  } catch (err) {
    console.error('Failed to connect to CouchDB:', err);
    process.exit(1);
  }
});
