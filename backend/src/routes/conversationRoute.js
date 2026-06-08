import express from 'express'
import { createConversation, getConversations, getMessages, markAsSeen, renameGroup, addGroupMembers } from '../controllers/conversationController.js'
import { checkFriendship } from '../middlewares/isFriendMiddleware.js'

const router = express.Router();

router.post("/", checkFriendship, createConversation);
router.get("/", getConversations);
router.get("/:conversationId/messages", getMessages);
router.patch("/:conversationId/seen", markAsSeen);
router.patch("/:conversationId/group/name", renameGroup);
router.patch("/:conversationId/group/members", addGroupMembers);

export default router;