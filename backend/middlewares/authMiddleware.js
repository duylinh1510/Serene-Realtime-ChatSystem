import jwt from 'jsonwebtoken';
import User from '../models/User.js'

export const protectedRoute = (req, res, next) => {
    try {
        // lây accessToken từ header
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ message: "Access token not found" })
        }

        // xác nhận token hợp lệ
        jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, async (err, decodedUser) => {
            if (err) {
                console.log(err);

                return res.status(403).json({ message: "Invalid access token" })
            }

            // tìm user trong DB
            const user = await User.findById(decodedUser.userId).select('-hashedPassword');

            if (!user) {
                return res.status(404).json({ message: "User not found" })
            }
            //trả user về trong req
            req.user = user;
            next();
        });
    } catch (error) {
        console.error('Error verify JWT in authMiddleware', error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
}