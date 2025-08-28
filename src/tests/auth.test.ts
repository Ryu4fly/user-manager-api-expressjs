import request from 'supertest';
import express from 'express';
import authRouter from '../routers/auth.router'; // wherever your router is
import * as couchDBModule from '../services/couchDB';
import bcrypt from 'bcrypt';

const app = express();
app.use(express.json());
app.use('/auth', authRouter); // mount the router

describe('auth routes', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  describe('registerHandler', () => {
    test('Successfully registers new user', async () => {
      // @ts-expect-error override for test mocking
      couchDBModule.usersDB = {
        find: jest.fn().mockResolvedValue({ docs: [] }),
        insert: jest.fn().mockResolvedValue({ id: 'mock-user-id' }),
      };
      // @ts-expect-error override for test mocking
      couchDBModule.logsDB = {
        insert: jest.fn(),
      };

      // Act
      const response = await request(app).post('/auth/register').send({
        email: 'test@gmail.com',
        password: 'password',
        password_confirm: 'password',
      });

      // Assert
      const data = JSON.parse(response.text);
      expect(response.status).toBe(201);
      expect(data.ok).toBe(true);
      expect(data.id).toBe('mock-user-id');
    });
  });

  describe('loginHandler', () => {
    test('Successfully logs in user', async () => {
      jest
        .spyOn(bcrypt, 'compare')
        .mockImplementation(async (input, hashed) => {
          return input === 'password' && hashed === 'hashed-password';
        });

      // @ts-expect-error override for test mocking
      couchDBModule.usersDB = {
        find: jest.fn().mockResolvedValue({
          docs: [
            {
              _id: 'mock-user-id',
              _rev: 'rev',
              email: 'test@example.com',
              password: 'hashed-password',
              role: 'user',
            },
          ],
        }),
      };
      // @ts-expect-error override for test mocking
      couchDBModule.logsDB = {
        insert: jest.fn(),
      };

      const response = await request(app).post('/auth/login').send({
        email: 'test@gmail.com',
        password: 'password',
      });

      // Assert
      const responseBody = JSON.parse(response.text);
      expect(response.status).toBe(200);
      expect(responseBody.ok).toBe(true);
      expect(responseBody.data.accessToken).toBeDefined();
      expect(responseBody.data.refreshToken).toBeDefined();
    });
  });
});
