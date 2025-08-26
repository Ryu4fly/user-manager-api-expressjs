import bcrypt from 'bcrypt';
import express, { type Request, type Response } from 'express';
import z from 'zod';
import { authorizer } from './middlewares/authorizer.js';
import { LoginParams, RegisterParams, User } from './types.js';
import { isAdmin } from './utils/is-admin.js';
import { signAccessToken, signRefreshToken } from './utils/jwt/jwt.js';
import { connectDB, usersDB } from './services/couchDB.js';
import { logger } from './utils/logger.js';

const app = express();
const port = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/ping', (req: Request, res: Response) => {
  res.send('Health Check');
});

app.get('/users', authorizer, async (req: Request, res: Response) => {
  if (!isAdmin(req)) {
    logger.warn('Unauthorized attempt made', req);
    res.status(403).json({ ok: false, message: 'FORBIDDEN' });
    return;
  }

  try {
    // TODO: also includes index docs -- make sure to filter out
    const doclist = await usersDB.list({ include_docs: true });

    const users = doclist.rows.map((row) => ({
      id: row.id,
      email: row.doc?.email,
      role: row.doc?.role,
    }));

    logger.info('Users successfully fetched', req);
    res.status(200).json({ ok: true, users });
  } catch (err) {
    logger.error('Unable to fetch users from database', req, {
      cause: err,
    });
    res.status(500).json({ ok: false, message: 'Unhandled Exception' });
  }
});

// TODO: user should not be able to access other users, unless admin
app.get('/users/:id', async (req: Request, res: Response) => {
  const id = req.params.id;
  if (!id) {
    logger.warn('Request made with missing param', req);
    res.status(400).json({ ok: false, message: 'Bad Request' });
    return;
  }

  try {
    const user = await usersDB.get(id);
    logger.info('User successfully fetched', req);
    res.status(200).json({ ok: true, user });
  } catch (err) {
    if (typeof err === 'object' && err !== null && 'statusCode' in err) {
      if (err.statusCode === 404) {
        logger.error('User does not exist', req, {
          cause: err,
        });
        res.status(403).json({ ok: false, message: 'FORBIDDEN' });
        return;
      }
    }

    logger.error('Failed to fetch user by ID', req, {
      cause: err,
    });
    res.status(500).json({ ok: false, message: 'Unhandled Exception' });
  }
});

// TODO: user should not be able to delete other accounts, unless admin
app.delete('/users/:id', async (req: Request, res: Response) => {
  const id = req.params.id;
  if (!id) {
    logger.warn('Missing ID param', req);
    res.status(400).json({ ok: false, message: 'Bad Request' });
    return;
  }

  try {
    const user = await usersDB.get(id);
    await usersDB.destroy(user._id, user._rev);
    logger.info('User successfully deleted', req, {
      userID: id,
      resourceType: 'user',
    });
    res.status(200).json({ ok: true });
  } catch (err) {
    if (typeof err === 'object' && err !== null && 'statusCode' in err) {
      if (err.statusCode === 404) {
        logger.warn('Attempted delet on non-existent user', req, {
          cause: err,
        });
        res.status(403).json({ ok: false, message: 'FORBIDDEN' });
        return;
      }
    }

    logger.error('Failed to delete user', req, {
      userID: id,
      cause: err,
    });
    res.status(500).json({ ok: false, message: 'Unhandled Exception' });
  }
});

app.post('/register', async (req: Request, res: Response) => {
  const parsedBody = RegisterParams.safeParse(req.body);

  if (!parsedBody.success) {
    logger.warn('Register Validation failed', req, {
      cause: z.treeifyError(parsedBody.error),
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
    logger.warn('User already exists', req);
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

    logger.info('User sucessfully created', req, {
      userID: response.id,
      resourceType: 'user',
      resourceId: response.id,
    });

    res.status(201).json({ ok: true, id: response.id });
  } catch (err) {
    logger.error('Unhandled Exception: REGISTER failed to register user', req, {
      cause: err,
    });

    res.status(500).json({ ok: false, message: 'Unhandled Exception' });
  }
});

app.post('/login', async (req: Request, res: Response) => {
  const parsedBody = LoginParams.safeParse(req.body);
  if (!parsedBody.success) {
    logger.warn('Invalid Request Body', req, {
      cause: z.treeifyError(parsedBody.error),
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
    logger.warn('Attempted login of non-existent user', req);
    res.status(401).json({ ok: false, message: 'Unauthorized' });
    return;
  }

  const parseResult = User.safeParse(document);
  if (!parseResult.success) {
    logger.error('Fetched document is invalid', req, {
      email,
      cause: z.treeifyError(parseResult.error),
    });
    res.status(500).json({ ok: false, message: 'FORBIDDEN' });
    return;
  }

  const user = parseResult.data;
  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    logger.warn('Attempted login with invalid credentials', req, {
      email,
    });
    res.status(401).json({ ok: false, message: 'Unauthorized' });
    return;
  }

  logger.info('User login successful:', req, {
    resourceType: 'user',
    userID: user._id,
    userRole: user.role,
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
