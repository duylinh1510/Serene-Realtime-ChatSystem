import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import { io } from '../socket/index.js';
import { emitNewMessage, updateConversationAfterCreateMessage } from '../utils/messageHelper.js';
import mongoose from 'mongoose';

export const sendDirectMessage = async (req, res) => {
    try {
        const { recipientId, content, conversationId } = req.body;
        const senderId = req.user._id;

        if (!content) {
            return res.status(400).json({ message: "No content provided" })
        }

        let conversation;

        if (conversationId) {
            if (!mongoose.isValidObjectId(conversationId)) {
                return res.status(400).json({ message: "Invalid conversation ID" });
            }

            conversation = await Conversation.findById(conversationId);

            if (!conversation) {
                return res.status(404).json({ message: "Conversation not found" });
            }
        }

        if (!conversation) {
            if (!recipientId) {
                return res.status(400).json({ message: "Recipient is required" });
            }

            if (!mongoose.isValidObjectId(recipientId)) {
                return res.status(400).json({ message: "Invalid recipient ID" });
            }

            conversation = await Conversation.create({
                type: "direct",
                participants: [
                    { userId: senderId, joinedAt: new Date() },
                    { userId: recipientId, joinedAt: new Date() }
                ],
                lastMessageAt: new Date(),
                unreadCounts: new Map()
            })
        }

        const message = await Message.create({
            conversationId: conversation._id,
            senderId,
            content
        });

        updateConversationAfterCreateMessage(conversation, message, senderId);

        await conversation.save();

        emitNewMessage(io, conversation, message);

        return res.status(201).json({ message })
    } catch (error) {
        console.error("Failed to send direct message", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}

export const sendGroupMessage = async (req, res) => {
    try {
        const { conversationId, content } = req.body;
        const senderId = req.user._id;
        const conversation = req.conversation;

        if (!content) {
            return res.status(400).json({ message: "No content provided" })
        }

        if (!conversation) {
            return res.status(404).json({ message: "Conversation not found" });
        }

        const message = await Message.create({
            conversationId: conversation._id,
            senderId,
            content
        });

        updateConversationAfterCreateMessage(conversation, message, senderId);

        await conversation.save();
        emitNewMessage(io, conversation, message);

        return res.status(201).json({ message });
    } catch (error) {
        console.log("Failed to send group message", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}
