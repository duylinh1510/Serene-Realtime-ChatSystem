import Conversation from "../models/Conversation.js";
import Friend from "../models/Friend.js";

const pair = (a, b) => (a < b ? [a, b] : [b, a]);

export const checkFriendship = async (req, res, next) => {
    try {
        const me = req.user._id.toString();
        const recipientId = req.body?.recipientId ?? null;
        const memberIds = req.body?.memberIds ?? [];

        if (!recipientId && memberIds.length === 0) {
            return res.status(400).json({ message: "recipientId or memberIds are not provided yet" })
        }

        if (recipientId) {
            const [userA, userB] = pair(me, recipientId);

            const isFriend = await Friend.findOne({ userA, userB });

            if (!isFriend) {
                return res.status(403).json({ message: "You are not friend with this user" })
            }

            return next();
        }

        // map(async...) trả về một mảng Promise
        const friendChecks = memberIds.map(async (memberId) => {
            const [userA, userB] = pair(me, memberId);
            const friend = await Friend.findOne({ userA, userB });
            return friend ? null : memberId;
        });

        const results = await Promise.all(friendChecks); //results sẽ có dạng [null, "C", null]
        const notFriends = results.filter(Boolean); //filter(Boolean) sẽ loại bỏ các giá trị falsy như: null, undefined, false, 0

        // chỉ cần ít nhất 1 người không là bạn thì trả lỗi
        if (notFriends.length > 0) {
            return res.status(403).json({ message: "You can only add your friends to the group", notFriends });
        }

        next();
    } catch (error) {
        console.error("Error while checking friendship", error);
        return res.status(500).json({ message: "Internal server error" })
    }
}