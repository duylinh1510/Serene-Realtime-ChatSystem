import Conversation from "../models/Conversation.js"
import Message from "../models/Message.js"

export const createConversation = async (req, res) => {
    try {
        const { type, name, memberIds } = req.body;
        const userId = req.user._id;

        if (!type
            || (type === 'group' && !name)
            || !memberIds
            || !Array.isArray(memberIds)
            || memberIds.length() === 0) {
            return res.status(400).json({ message: "Group name and members are required" })
        }

        let conversation;
        if (type === 'direct') {
            const participantId = memberIds[0];

            conversation = await Conversation.findOne({ type: 'direct', "participants.userId": { $all: [userId, participantId] } })

            if (!conversation) {
                conversation = new Conversation({
                    type: 'direct',
                    participants: [{ userId, userId: participantId }],
                    lassMessageAt: new Date()
                });

                await conversation.save();
            }
        }

        if (type === 'group') {
            conversation = new Conversation({
                type: 'group',
                participants: [
                    { userId },
                    ...memberIds.map((id) => ({ userId: id }))
                ],
                group: {
                    name,
                    createdBy: userId
                },
                lassMessageAt: new Date()
            });

            await conversation.save();
        }

        if (!conversation) {
            return res.status(400).json({ message: 'Invalid conversation type' })
        }

        await conversation.populate([
            { path: 'participants.userId', select: 'displayName avatarUrl' },
            { path: "seenBy", select: 'displayName avatarUrl' },
            { path: "lastMessage.senderId", select: 'displayName avatarUrl' }
        ])

        return res.status(201).json({ conversation });
    } catch (error) {
        console.error("Error while creating conversation", error);
        return res.status(500).json({ message: "Internal server error" })
    }
}

export const getConversations = async (req, res) => { }

export const getMessages = async (req, res) => { }