import express from 'express';
import {
  deleteUserHandler,
  getUserHandler,
  getUsersHandler,
} from '../handlers/users';
import { authorizer } from '../middlewares/authorizer';

const router = express.Router();

router.get('/', authorizer, getUsersHandler);
router.get('/:id', authorizer, getUserHandler);
router.delete('/:id', authorizer, deleteUserHandler);

export default router;
