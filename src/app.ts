import bcrypt from 'bcrypt';
import express, { type Response } from 'express';
import z from 'zod';
import { authorizer } from './middlewares/authorizer.js';
import { LoginParams, LogQueryParams, RegisterParams, User } from './types.js';
import { isAdmin } from './utils/is-admin.js';
import { signAccessToken, signRefreshToken } from './utils/jwt/jwt.js';
import { connectDB, logsDB, usersDB } from './services/couchDB.js';
import { logger } from './utils/logger.js';
import { type Request } from './types.js';
import { buildLogQuery } from './utils/build-log-query.js';

const app = express();
const port = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/ping', (req: Request, res: Response) => {
  res.send('Health Check');
});

// USERS
app.get('/users', authorizer, async (req: Request, res: Response) => {
  if (!isAdmin(req)) {
    logger.warn('Unauthorized attempt made', 'USERS', req);
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

    logger.info('Users successfully fetched', 'USERS', req);
    res.status(200).json({ ok: true, users });
  } catch (err) {
    logger.error('Unable to fetch users from database', 'USERS', req, {
      cause: err,
    });
    res.status(500).json({ ok: false, message: 'Unhandled Exception' });
  }
});

// TODO: user should not be able to access other users, unless admin
app.get('/users/:id', async (req: Request, res: Response) => {
  const id = req.params.id;
  if (!id) {
    logger.warn('Request made with missing param', 'USERS', req);
    res.status(400).json({ ok: false, message: 'Bad Request' });
    return;
  }

  try {
    const user = await usersDB.get(id);
    logger.info('User successfully fetched', 'USERS', req);
    res.status(200).json({ ok: true, user });
  } catch (err) {
    if (typeof err === 'object' && err !== null && 'statusCode' in err) {
      if (err.statusCode === 404) {
        logger.error('User does not exist', 'USERS', req, {
          cause: err,
        });
        res.status(403).json({ ok: false, message: 'FORBIDDEN' });
        return;
      }
    }

    logger.error('Failed to fetch user by ID', 'USERS', req, {
      cause: err,
    });
    res.status(500).json({ ok: false, message: 'Unhandled Exception' });
  }
});

// TODO: user should not be able to delete other accounts, unless admin
app.delete('/users/:id', async (req: Request, res: Response) => {
  const id = req.params.id;
  if (!id) {
    logger.warn('Missing ID param', 'USERS', req);
    res.status(400).json({ ok: false, message: 'Bad Request' });
    return;
  }

  try {
    const user = await usersDB.get(id);
    await usersDB.destroy(user._id, user._rev);
    logger.info('User successfully deleted', 'USERS', req, {
      userID: id,
      resourceType: 'userS',
    });
    res.status(200).json({ ok: true });
  } catch (err) {
    if (typeof err === 'object' && err !== null && 'statusCode' in err) {
      if (err.statusCode === 404) {
        logger.warn('Attempted delet on non-existent user', 'USERS', req, {
          cause: err,
        });
        res.status(403).json({ ok: false, message: 'FORBIDDEN' });
        return;
      }
    }

    logger.error('Failed to delete user', 'USERS', req, {
      userID: id,
      cause: err,
    });
    res.status(500).json({ ok: false, message: 'Unhandled Exception' });
  }
});

// AUTH
app.post('/register', async (req: Request, res: Response) => {
  const parsedBody = RegisterParams.safeParse(req.body);

  if (!parsedBody.success) {
    logger.warn('Register Validation failed', 'REGISTER', req, {
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
    logger.warn('User already exists', 'REGISTER', req);
    res.status(400).json({ ok: false, message: 'User already exists' });
    return;
  }

  try {
    const hashed = await bcrypt.hash(password, 10);
    const response = await usersDB.insert({
      email,
      password: hashed,
      role: 'userS',
    });

    logger.info('User sucessfully created', 'REGISTER', req, {
      userID: response.id,
      resourceType: 'userS',
      resourceId: response.id,
    });

    res.status(201).json({ ok: true, id: response.id });
  } catch (err) {
    logger.error(
      'Unhandled Exception: REGISTER failed to register user',
      'REGISTER',
      req,
      {
        cause: err,
      }
    );

    res.status(500).json({ ok: false, message: 'Unhandled Exception' });
  }
});

app.post('/login', async (req: Request, res: Response) => {
  const parsedBody = LoginParams.safeParse(req.body);
  if (!parsedBody.success) {
    logger.warn('Invalid Request Body', 'LOGIN', req, {
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
    logger.warn('Attempted login of non-existent user', 'LOGIN', req);
    res.status(401).json({ ok: false, message: 'Unauthorized' });
    return;
  }

  const parseResult = User.safeParse(document);
  if (!parseResult.success) {
    logger.error('Fetched document is invalid', 'LOGIN', req, {
      email,
      cause: z.treeifyError(parseResult.error),
    });
    res.status(500).json({ ok: false, message: 'FORBIDDEN' });
    return;
  }

  const user = parseResult.data;
  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    logger.warn('Attempted login with invalid credentials', 'LOGIN', req, {
      email,
    });
    res.status(401).json({ ok: false, message: 'Unauthorized' });
    return;
  }

  logger.info('User login successful:', 'LOGIN', req, {
    resourceType: 'userS',
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

// Logs
app.get('/logs', authorizer, async (req: Request, res: Response) => {
  if (!isAdmin(req)) {
    logger.warn('Unauthorized attempt made', 'LOGS', req);
    res.status(403).json({ ok: false, message: 'FORBIDDEN' });
    return;
  }

  const parsedResult = LogQueryParams.safeParse(req.query);
  if (!parsedResult.success) {
    logger.warn('Invalid query params for /logs', 'LOGS', req, {
      cause: z.treeifyError(parsedResult.error),
    });
    res.status(400).json({ ok: false, message: 'Invalid query parameters' });
    return;
  }
  const query = parsedResult.data;
  const isEmpty = Object.values(query).every((v) => v === undefined);

  try {
    const logs = [];
    if (isEmpty) {
      const doclist = await logsDB.list({ include_docs: true });
      for (let doc of doclist.rows) {
        if (!doc.id.startsWith('_design')) {
          logs.push({
            ...doc,
          });
        }
      }
    } else {
      const docList = await logsDB.find(buildLogQuery(query));
      logs.push(...docList.docs);
    }
    res.status(200).json({
      ok: true,
      logs,
    });
  } catch (err) {
    logger.error('Failed to fetch logs', 'LOGS', req, { cause: err });
    res.status(500).json({ ok: false, message: 'Unhandled Exception' });
  }
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
