import express from 'express';
import { upload } from '../middlewares/uploadMiddleware.js';

import {
    sendDirectMessage,
    sendGroupMessage
} from '../controllers/messageController.js'
import { checkFriendship, checkGroupMembership } from '../middlewares/isFriendMiddleware.js';

const router = express.Router();

router.post('/direct', upload.single("image"), checkFriendship, sendDirectMessage);
router.post('/group', upload.single("image"), checkGroupMembership, sendGroupMessage);

export default router;