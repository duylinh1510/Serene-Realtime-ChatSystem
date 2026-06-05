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