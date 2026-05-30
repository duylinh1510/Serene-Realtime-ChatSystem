import express from 'express'
import dotenv from 'dotenv'
import { connectDB } from '../libs/db.js';
import { protectedRoute } from '../middlewares/authMiddleware.js';
import authRoute from '../routes/authRoute.js';
import userRoute from '../routes/userRoute.js';
import cookieParser from 'cookie-parser';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

//middleware
app.use(express.json());
app.use(cookieParser());


// public routes
app.use('/api/auth', authRoute);

// private routes
app.use(protectedRoute)
app.use('/api/users', userRoute);

connectDB().then(() => {
    app.listen(PORT, () => {
        console.log(`Server started on port: ${PORT}`);
    });
});
