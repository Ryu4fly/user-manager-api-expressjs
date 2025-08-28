import express from 'express';
import { authorizer } from '../middlewares/authorizer';
import { logsHandler } from '../handlers/logs';
const router = express.Router();

router.post('/', authorizer, logsHandler);

export default router;
