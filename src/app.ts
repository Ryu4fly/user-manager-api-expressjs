import bcrypt from 'bcrypt';
import express, { type Request, type Response } from 'express';
import z from 'zod';
import { connectDB, usersDB } from './services/couchDB.js';

const app = express();
const port = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/ping', (req: Request, res: Response) => {
  res.send('Health Check');
});

app.get('/users', async (req: Request, res: Response) => {
  try {
    // TODO: also includes index docs -- make sure to filter out
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

const RegisterUser = z
  .object({
    email: z.string().nonempty(),
    password: z.string().nonempty(),
    password_confirm: z.string().nonempty(),
  })
  .superRefine(({ password, password_confirm }, ctx) => {
    if (password !== password_confirm) {
      ctx.addIssue({ code: 'custom', message: 'password must be matching' });
    }
  });

app.post('/register', async (req: Request, res: Response) => {
  const parsedBody = RegisterUser.safeParse(req.body);

  if (!parsedBody.success) {
    console.warn('Invalid Request Body', {
      error: parsedBody.error,
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

app.listen(port, async () => {
  try {
    await connectDB();
    console.log(`Listening to port: ${port}`);
  } catch (err) {
    console.error('Failed to connect to CouchDB:', err);
    process.exit(1);
  }
});
