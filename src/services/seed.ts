import { faker } from '@faker-js/faker';
import bcrypt from 'bcrypt';

export const createRandomUser = async () => {
  return {
    userId: faker.string.uuid(),
    email: faker.internet.email(),
    password: await bcrypt.hash(faker.internet.password(), 10),
    role: 'user',
  };
};

export function createRandomLogs() {
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
}
