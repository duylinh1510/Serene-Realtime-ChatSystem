import mongoose from "mongoose";
import Friend from "../models/Friend.js";
import Conversation from "../models/Conversation.js";

const pair = (a, b) => {
    const userA = a.toString();
    const userB = b.toString();

    return userA < userB ? [userA, userB] : [userB, userA];
}

export const checkFriendship = async (req, res, next) => {
    try {
        const me = req.user._id.toString();
        const recipientId = req.body?.recipientId ?? null; //dùng cho chat direct 1-1.
        const rawMemberIds = req.body?.memberIds;
        const memberIds = Array.isArray(rawMemberIds) ? rawMemberIds : []; // dùng cho group chat.

        if (rawMemberIds && !Array.isArray(rawMemberIds)) {
            return res.status(400).json({ message: "memberIds must be an array" });
        }

        if (!recipientId && memberIds.length === 0) {
            return res.status(400).json({ message: "recipientId or memberIds are required" });
        }

        if (recipientId) {
            if (!mongoose.isValidObjectId(recipientId)) {
                return res.status(400).json({ message: "Invalid recipient ID" });
            }

            const [userA, userB] = pair(me, recipientId);
            const isFriend = await Friend.exists({ userA, userB });

            if (!isFriend) {
                return res.status(403).json({ message: "You can only start a conversation with a friend" });
            }

            return next();
        }

        const invalidMemberId = memberIds.find((memberId) => !mongoose.isValidObjectId(memberId));

        if (invalidMemberId) {
            return res.status(400).json({ message: "Invalid member ID" });
        }

        // map(async) trả về 1 mảng Promise
        const friendChecks = memberIds.map(async (memberId) => {
            const [userA, userB] = pair(me, memberId);
            const friend = await Friend.exists({ userA, userB });

            return friend ? null : memberId;
        });

        const results = await Promise.all(friendChecks); //trả về mảng  có dạng [null, User B, null]
        const notFriends = results.filter(Boolean); //lọc mảng results để trả về mảng Id của những User không phải là bảng

        if (notFriends.length > 0) {
            return res.status(403).json({
                message: "You can only add your friends to the group",
                notFriends
            });
        }

        return next();
    } catch (error) {
        console.error("Error while checking friendship", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}

export const checkGroupMembership = async (req, res, next) => {
    try {
        const { conversationId } = req.body;
        const userId = req.user._id;

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
            return res.status(404).json({ message: "No conversation found" })
        }

        const isMember = conversation.participants.some((p) => p.userId.toString() === userId.toString());

        if (!isMember) {
            return res.status(403).json({ message: "You are not in this group" })
        }

        // lưu conversation vào request để controller không phải query lại
        req.conversation = conversation;

        next();
    } catch (error) {
        console.log("Error checkGroupMembership", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}
