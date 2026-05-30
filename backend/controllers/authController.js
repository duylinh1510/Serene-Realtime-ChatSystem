import bcrypt from 'bcrypt'
import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import Session from '../models/Session.js';
import crypto from 'crypto';

const ACCESS_TOKEN_TTL = '30m';
const REFRESH_TOKEN_TTL = 14 * 24 * 60 * 60 * 1000; //14d

export const signUp = async (req, res) => {
    try {
        const { username, password, email, firstName, lastName } = req.body;

        if (!username || !password || !email || !firstName || !lastName) {
            return res.status(400).json({
                message: "Username, Password, Email, FirstName, LastName cannot be empty"
            });
        }

        // kiểm tra username tồn tại chưa
        const duplicate = await User.findOne({ username });

        if (duplicate) {
            return res.status(409).json({ message: "Username already existed" });
        }
        // mã hóa password
        const hashedPassword = await bcrypt.hash(password, 10); //salt = 10

        // tạo user mới
        await User.create({
            username,
            hashedPassword,
            email,
            displayName: `${firstName} ${lastName}`
        });

        // return
        return res.sendStatus(204);
    } catch (error) {
        console.error('Sign Up error:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};

export const signIn = async (req, res) => {
    try {
        // lấy input
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                message: "Username or Password cannot be empty"
            });
        }

        // lấy hashedPassword trong DB để so sánh với password input
        const user = await User.findOne({ username });

        if (!user) {
            return res.status(401).json({
                message: "Incorrect username or password"
            });
        }

        // kiểm tra password
        const passwordCorrect = await bcrypt.compare(password, user.hashedPassword);
        if (!passwordCorrect) {
            return res.status(401).json({
                message: "Incorrect username or password"
            })
        }
        // nếu khớp, tạo accessToken với JWT
        const accessToken = jwt.sign({ userId: user._id }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: ACCESS_TOKEN_TTL })

        // tạo refreshToken
        const refreshToken = crypto.randomBytes(64).toString('hex');

        // tạo session mới để lưu refreshToken
        await Session.create({
            userId: user._id,
            refreshToken,
            expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL)
        });

        // gửi refreshToken về client trong cookie
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true, // cookie không thể bị truy cập thông qua JS (tránh XSS)
            secure: true, // đảm bảo chỉ gửi qua https
            sameSite: 'none', // be và fe deploy riêng
            maxAge: REFRESH_TOKEN_TTL
        });

        // trả accessToken về trong response
        return res.status(200).json({ message: `User ${user.displayName} logged in`, accessToken });
    } catch (error) {
        console.error('Sign In error:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
}

export const signOut = async (req, res) => {
    try {
        // lấy refreshToken từ cookie
        const token = req.cookies?.refreshToken;

        if (token) {
            // xóa refreshToken trong Session
            await Session.deleteOne({ refreshToken: token });

            // xóa cookie
            res.clearCookie('refreshToken');
        }

        return res.sendStatus(204);

    } catch (error) {
        console.error('signOut Error', error);
        return res.status(500).json({ message: "Internal Server Error" })
    }
}