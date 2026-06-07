import Friend from '../models/Friend.js';
import User from '../models/User.js';
import FriendRequest from '../models/FriendRequest.js';
import mongoose from 'mongoose';
import { io } from '../socket/index.js';


export const sendFriendRequest = async (req, res) => {
    try {
        const { to, message } = req.body;

        const from = req.user._id;

        if (from.toString() === to.toString()) {
            return res.status(400).json({ message: "Cannot send friend request to themselves" })
        }

        const userExists = await User.exists({ _id: to });

        if (!userExists) {
            return res.status(404).json({ message: "User not found" })
        }

        let userA = from.toString();
        let userB = to.toString();

        if (userA > userB) {
            [userA, userB] = [userB, userA];
        }

        const [alreadyFriends, existingRequest] = await Promise.all([
            Friend.findOne({ userA, userB }),
            FriendRequest.findOne({
                $or: [
                    { from, to },
                    { from: to, to: from }
                ]
            })
        ])

        if (alreadyFriends) {
            return res.status(400).json({ message: "Already friends" })
        }

        if (existingRequest) {
            return res.status(400).json({ message: "Friend request existed" })
        }

        const request = await FriendRequest.create({
            from,
            to,
            message
        });

        //phát realtime event khi có lời mời mới.
        await request.populate("from", "_id username displayName avatarUrl");
        await request.populate("to", "_id username displayName avatarUrl");

        io.to(to.toString()).emit("friend-request:new", {
            request,
        });

        return res.status(201).json({ message: "Friend request sent successfully", request })
    } catch (error) {
        console.error("Failed to send friend request", error);
        return res.status(500).json({ message: "Unable to send friend request. Please try again later." });
    }
}

export const acceptFriendRequest = async (req, res) => {
    try {
        const { requestId } = req.params;
        const userId = req.user._id; //user đang đăng nhập

        const request = await FriendRequest.findById(requestId);

        if (!request) {
            return res.status(404).json({ message: "Cannot find friend request" })
        }

        // Vì sao cần kiểm tra logic này?
        // Vì ai đó có thể gửi lời mời kết bạn cho 1 user
        // Sau đó gửi thêm 1 API request để accept lời mời kết bạn đó
        // Thì không cần phải thông qua user hiện tại để user kia có thể kết bạn được
        if (request.to.toString() !== userId.toString()) {
            return res.status(403).json({ message: "You are unauthorized to accept this friend request" })
        }

        await Friend.create({
            userA: request.from,
            userB: request.to
        })

        await FriendRequest.findByIdAndDelete(requestId);

        const from = await User.findById(request.from).select('_id displayName avatarUrl').lean();

        return res.status(200).json({
            message: "Accepted friend request successfully",
            newFriend: {
                _id: from?._id,
                displayName: from?.displayName,
                avatarUrl: from?.avatarUrl
            },
        });
    } catch (error) {
        console.error("Failed to accept friend request", error);

        if (error.code === 11000) {
            return res.status(409).json({
                message: "You are already friends",
            });
        }

        return res.status(500).json({ message: "Unable to accept friend request. Please try again later." });
    }
}

export const declineFriendRequest = async (req, res) => {
    try {
        const { requestId } = req.params;
        const userId = req.user._id;

        if (!mongoose.isValidObjectId(requestId)) {
            return res.status(400).json({ message: "Invalid friend request ID" });
        }

        const request = await FriendRequest.findById(requestId);

        if (!request) {
            return res.status(404).json({ message: "Cannot find friend request" })
        }

        if (request.to.toString() !== userId.toString()) {
            return res.status(403).json({ message: "You are unauthorized to decline this friend request" })
        }

        await FriendRequest.findByIdAndDelete(requestId);

        return res.sendStatus(204);
    } catch (error) {
        console.error("Failed to decline friend request", error);
        return res.status(500).json({ message: "Unable to decline friend request. Please try again later." });
    }
}

export const getAllFriends = async (req, res) => {
    try {
        const userId = req.user._id;

        const friendships = await Friend.find({
            $or: [
                { userA: userId }, { userB: userId }
            ]
        })
            .populate("userA", "_id displayName username avatarUrl")
            .populate("userB", "_id displayName username avatarUrl")
            .lean();
        if (!friendships.length) {
            return res.status(200).json({ friends: [] })
        }

        // lấy những người bạn từ friendship
        const friends = friendships.map((f) =>
            f.userA._id.toString() === userId.toString() ? f.userB : f.userA
        );

        return res.status(200).json({ friends });
    } catch (error) {
        console.error("Failed to fetch friends", error);
        return res.status(500).json({ message: "Unable to load friends. Please try again later." });
    }
}

export const getFriendRequests = async (req, res) => {
    try {
        const userId = req.user._id;

        const populateFields = '_id username displayName avatarUrl';

        const [sent, received] = await Promise.all([
            FriendRequest.find({ from: userId }).populate("to", populateFields),
            FriendRequest.find({ to: userId }).populate("from", populateFields)
        ])

        return res.status(200).json({ sent, received });
    } catch (error) {
        console.error("Failed to fetch friend requests", error);
        return res.status(500).json({ message: "Unable to load friend requests. Please try again later." });
    }
}
