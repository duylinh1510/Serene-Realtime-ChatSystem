import Conversation from "../models/Conversation.js"
import Message from "../models/Message.js"
import { io } from "../socket/index.js";
import mongoose from "mongoose";
import Friend from "../models/Friend.js";

//helper kiểm tra cặp bạn bè
const getFriendPair = (a, b) => {
    const userA = a.toString();
    const userB = b.toString();

    return userA < userB ? [userA, userB] : [userB, userA];
}

export const createConversation = async (req, res) => {
    try {
        const { type, name, memberIds } = req.body;
        const userId = req.user._id;

        if (!type
            || (type === 'group' && !name)
            || !memberIds
            || !Array.isArray(memberIds)
            || memberIds.length === 0) {
            return res.status(400).json({ message: "Group name and members are required" })
        }

        let conversation;
        if (type === 'direct') {
            const participantId = memberIds[0];

            conversation = await Conversation.findOne({ type: 'direct', "participants.userId": { $all: [userId, participantId] } })

            if (!conversation) {
                conversation = new Conversation({
                    type: 'direct',
                    participants: [{ userId }, { userId: participantId }],
                    lastMessageAt: new Date()
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
                lastMessageAt: new Date()
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
        ]);


        const participants = (conversation.participants || []).map((p) => ({
            _id: p.userId?._id,
            displayName: p.userId?.displayName,
            avatarUrl: p.userId?.avatarUrl ?? null,
            joinedAt: p.joinedAt
        }));

        const formatted = { ...conversation.toObject(), participants };

        if (type === "group") {
            memberIds.forEach((userId) => {
                io.to(userId).emit('new-group', formatted);
            })
        }

        return res.status(201).json({ conversation: formatted });
    } catch (error) {
        console.error("Error while creating conversation", error);
        return res.status(500).json({ message: "Internal server error" })
    }
}

export const getConversations = async (req, res) => {
    try {
        const userId = req.user._id;

        const conversations = await Conversation.find({
            'participants.userId': userId
        })
            .sort({ lastMessageAt: -1, updatedAt: -1 })
            .populate({
                path: 'participants.userId',
                select: 'displayName avatarUrl'
            })
            .populate({
                path: 'lastMessage.senderId',
                select: 'displayName avatarUrl'
            })
            .populate({
                path: 'seenBy',
                select: 'displayName avatarUrl'
            });

        const formatted = conversations.map((convo) => {
            const participants = (convo.participants || []).map((p) => ({
                _id: p.userId?._id,
                displayName: p.userId?.displayName,
                avatarUrl: p.userId?.avatarUrl ?? null,
                joinedAt: p.joinedAt
            }));

            return {
                ...convo.toObject(),
                unreadCounts: convo.unreadCounts || {},
                participants
            };
        });

        return res.status(200).json({ conversations: formatted })
    } catch (error) {
        console.error("Failed to get conversations", error);
        return res.status(500).json({ message: "Internal server error" })
    }
}

export const getMessages = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { limit = 50, cursor } = req.query;

        const query = { conversationId };

        if (cursor) {
            query.createdAt = { $lt: new Date(cursor) };
        }

        // lấy 51 tin nhắn mới nhất
        let messages = await Message.find(query).sort({ createdAt: -1 }).limit(Number(limit) + 1);

        let nextCursor = null;

        // nếu thật sự còn tin nhắn thì lấy tin nhắn cuối làm con trỏ để load messages phía sau
        // sau đó bỏ tin nhắn đã được làm con trỏ ra khỏi mảng messages
        if (messages.length > Number(limit)) {
            const nextMessage = messages[messages.length - 1];
            nextCursor = nextMessage.createdAt.toISOString();
            messages.pop();
        }

        messages = messages.reverse();

        return res.status(200).json({
            messages, nextCursor,
        });
    } catch (error) {
        console.error("Failed to get messages", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}

export const getUserConversationsForSocketIO = async (userId) => {
    try {
        const conversations = await Conversation.find({ 'participants.userId': userId }, { _id: 1 });

        return conversations.map((c) => c._id.toString());
    } catch (error) {
        console.error("Error while fetching conversations", error);
        return [];
    }
}

export const markAsSeen = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const userId = req.user._id.toString();

        const conversation = await Conversation.findById(conversationId).lean();

        if (!conversation) {
            return res.status(404).json({ message: "Conversation unexisted!" })
        }

        const last = conversation.lastMessage;
        if (!last) {
            return res.status(200).json({ message: "There is no message to mark as seen" })
        }

        if (last.senderId.toString() === userId) {
            return res.status(200).json({ message: "No need to mark as seen with sender" })
        }

        const updated = await Conversation.findByIdAndUpdate(
            conversationId,
            {
                $addToSet: { seenBy: userId }, //$addToSet dùng để thêm phần tử vào mảng nhưng không bị trùng.
                $set: { [`unreadCounts.${userId}`]: 0 }, //Dòng này set số tin nhắn chưa đọc của user hiện tại về 0.
            },
            {
                new: true
            }
        );

        io.to(conversationId).emit('read-message', {
            conversation: updated,
            lastMessage: {
                _id: updated?.lastMessage._id,
                content: updated?.lastMessage.content,
                createdAt: updated?.lastMessage.createdAt,
                sender: {
                    _id: updated?.lastMessage.senderId
                }
            }
        });

        return res.status(200).json({
            message: "Marked as seen",
            seenBy: updated?.seenBy || [],
            myUnreadCount: updated?.unreadCounts[userId] || 0
        });
    } catch (error) {
        console.error("Failed to mark as seen", error);
        return res.status(500).json({ message: "Internal server error" })
    }
}

export const renameGroup = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { name } = req.body;
        const userId = req.user._id.toString();

        if (!mongoose.isValidObjectId(conversationId)) {
            return res.status(400).json({ message: "Invalid conversation ID" });
        }

        if (!name || !name.trim()) {
            return res.status(400).json({ message: "Group name cannot be empty" });
        }

        const conversation = await Conversation.findById(conversationId);

        if (!conversation) {
            return res.status(404).json({ message: "Conversation not found" });
        }

        if (conversation.type !== "group") {
            return res.status(400).json({ message: "Only group conversations can be renamed" });
        }

        if (conversation.group.createdBy.toString() !== userId) {
            return res.status(403).json({ message: "Only group creator can rename this group" });
        }

        conversation.group.name = name.trim();

        await conversation.save();

        const updatedConversation = {
            _id: conversation._id,
            group: conversation.group,
            updatedAt: conversation.updatedAt
        };

        io.to(conversationId).emit("group:updated", updatedConversation);

        return res.status(200).json({ conversation: updatedConversation });
    } catch (error) {
        console.error("Failed to rename group", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}

export const addGroupMembers = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { memberIds } = req.body;
        const userId = req.user._id.toString();

        if (!mongoose.isValidObjectId(conversationId)) {
            return res.status(400).json({ message: "Invalid conversation ID" });
        }

        if (!Array.isArray(memberIds) || memberIds.length === 0) {
            return res.status(400).json({ message: "memberIds must be a non-empty array" });
        }

        const invalidMemberId = memberIds.find((id) => !mongoose.isValidObjectId(id));

        if (invalidMemberId) {
            return res.status(400).json({ message: "Invalid member ID" });
        }

        const conversation = await Conversation.findById(conversationId);

        if (!conversation) {
            return res.status(404).json({ message: "Conversation not found" });
        }

        if (conversation.type !== "group") {
            return res.status(400).json({ message: "Only group conversation can add members" });
        }

        const isCurrentUserMember = conversation.participants.some(
            (participant) => participant.userId.toString() === userId
        );

        if (!isCurrentUserMember) {
            return res.status(403).json({ message: "You are not a member of this group" });
        }

        const currentMemberIds = conversation.participants.map((participant) => participant.userId.toString());

        //lấy ra id riêng biệt của tất cả thành viên trong nhóm
        const uniqueMemberIds = [...new Set(memberIds.map((id) => id.toString()))];

        // Loại bỏ user đã có trong nhóm.
        const newMemberIds = uniqueMemberIds.filter(
            (memberId) => !currentMemberIds.includes(memberId)
        )

        if (newMemberIds.length === 0) {
            return res.status(400).json({ message: "All selected users are already in this group" });
        }

        const friendChecks = await Promise.all(
            newMemberIds.map(async (memberId) => {
                const [userA, userB] = getFriendPair(userId, memberId);
                const isFriend = await Friend.exists({ userA, userB });

                return isFriend ? null : memberId;
            })
        )

        //lấy ra mảng các thành viên không phải là bạn của userId đang thêm thành viên hiện tại
        const notFriends = friendChecks.filter(Boolean);

        if (notFriends.length > 0) {
            return res.status(403).json({
                message: "You can only add your friend to the group",
                notFriends
            });
        }


        //thêm các thành viên mới làm participants trong group đó
        newMemberIds.forEach((memberId) => {
            conversation.participants.push({
                userId: memberId,
                joinedAt: new Date(),
            });

            conversation.unreadCounts.set(memberId, 0);
        })

        await conversation.save();

        await conversation.populate([
            { path: "participants.userId", select: "displayName avatarUrl" },
            { path: "seenBy", select: "displayName avatarUrl" },
            { path: "lastMessage.senderId", select: "displayName avatarUrl" },
        ]);

        const participants = conversation.participants.map((participant) => ({
            _id: participant.userId?._id,
            displayName: participant.userId?.displayName,
            avatarUrl: participant.userId?.avatarUrl ?? null,
            joinedAt: participant.joinedAt
        }));

        const formatted = {
            ...conversation.toObject(),
            participants
        };

        io.to(conversationId).emit("group:updated", formatted);

        newMemberIds.forEach((memberId) => {
            io.to(memberId).emit("new-group", formatted);
        });

        return res.status(200).json({ conversation: formatted });
    } catch (error) {
        console.error("Failed to add group members", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}