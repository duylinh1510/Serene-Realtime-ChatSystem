import { uploadImageFromBuffer } from '../middlewares/uploadMiddleware.js';
import User from '../models/User.js'

export const authMe = async (req, res) => {
    try {
        const user = req.user; // lấy từ authMiddleware

        return res.status(200).json({ user })
    } catch (error) {
        console.error('Error AuthMe', error);
        return res.status(500).json({ message: 'Internal Server Error' })
    }
}

export const searchUserByUsername = async (req, res) => {
    try {
        const { username } = req.query;

        if (!username || username.trim() === "") {
            return res.status(400).json({ message: "username not provided" })
        }

        const user = await User.findOne({ username }).select("_id displayName avatarUrl");

        return res.status(200).json({ user });
    } catch (error) {
        console.error("Errow while searchUserByUsername", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}

export const uploadAvatar = async (req, res) => {
    try {
        //req.file là do middleware cung cấp
        const file = req.file;
        const userId = req.user;

        if (!file) {
            return res.status(400).json({ message: "No file uploaded" })
        }

        const result = await uploadImageFromBuffer(file.buffer);

        const updatedUser = await User.findByIdAndUpdate(userId, {
            avatarUrl: result.secure_url,
            avatarId: result.public_id,
        }, { new: true }).select("avatarUrl");

        if (!updatedUser.avatarUrl) {
            return res.status(400).json({ message: "Avatar return null" })
        }

        return res.status(200).json({ avatarUrl: updatedUser.avatarUrl });

    } catch (error) {
        console.error("Error while uploading avatar to Cloudinary", error);
        return res.status(500).json({ message: "Failed to upload avatar" })
    }
}

export const updateProfile = async (req, res) => {
    try {
        const userId = req.user._id;

        const { displayName, username, email, bio, phone } = req.body;

        const updateData = {};

        if (displayName !== undefined) {
            if (!displayName.trim()) {
                return res.status(400).json({ message: "Display name cannot be empty" });
            }

            updateData.displayName = displayName.trim();
        }

        if (username !== undefined) {
            if (!username.trim()) {
                return res.status(400).json({ message: "Username cannot be empty" });
            }

            updateData.username = username.trim().toLowerCase();
        }

        if (email !== undefined) {
            if (!email.trim()) {
                return res.status(400).json({ message: "Email cannot be empty" });
            }

            updateData.email = email.trim().toLowerCase();
        }

        if (bio !== undefined) {
            if (bio.length > 500) {
                return res.status(400).json({ message: "Bio must be at most 500 characters" });
            }

            updateData.bio = bio.trim();
        }

        if (phone !== undefined) {
            updateData.phone = phone.trim();
        }

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            updateData,
            {
                new: true,
                runValidators: true,
            }
        ).select("-hashedPassword");

        return res.status(200).json({ user: updatedUser });
    } catch (error) {
        console.error("Error while updating profile", error);

        if (error.code === 11000) {
            return res.status(409).json({
                message: "Username or email already exists",
            });
        }

        return res.status(500).json({ message: "Internal server error" });
    }
}