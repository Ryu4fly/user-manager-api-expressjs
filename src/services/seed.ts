import { faker } from '@faker-js/faker';
import bcrypt from 'bcrypt';

export const createRandomUser = async () => {
  const users = [
    {
      email: 'admin@test.com',
      password: await bcrypt.hash('admin', 10),
      role: 'admin',
    },
  ];

  for (let i = 0; i < 10; i++) {
    users.push({
      email: faker.internet.email(),
      password: await bcrypt.hash(faker.internet.password(), 10),
      role: 'user',
    });
  }

  return users;
};

export const createRandomLogs = () => {
  const date = faker.date.anytime({ refDate: Date.now() });
  const levels = ['INFO', 'WARN', 'ERROR'];
  const paths = ['/login', '/register', '/users'];
  return {
    level: faker.helpers.arrayElement(levels),
    resourceType: 'USERS',
    message: faker.hacker.phrase(),
    timestamp: date.getTime(),
    path: faker.helpers.arrayElement(paths),
    method: faker.internet.httpMethod(),
    ip: faker.internet.ipv4(),
    userAgent: faker.internet.userAgent(),
  };
};
