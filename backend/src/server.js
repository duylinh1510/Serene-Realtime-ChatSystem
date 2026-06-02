import express from 'express'
import dotenv from 'dotenv'
import { connectDB } from './libs/db.js';
import { protectedRoute } from './middlewares/authMiddleware.js';
import authRoute from './routes/authRoute.js';
import userRoute from './routes/userRoute.js';
import friendRoute from './routes/friendRoute.js'
import messageRoute from './routes/messageRoute.js'
import conversationRoute from './routes/conversationRoute.js'
import cookieParser from 'cookie-parser';
import cors from "cors"
import swaggerUI from 'swagger-ui-express';
import fs from 'fs';


dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

//middleware
app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));

//swagger
//const swaggerDocument = JSON.parse(fs.readFileSync("./src/swagger.json", "utf-8"));
//app.use("/api-docs", swaggerUI.serve, swaggerUI.setup(swaggerDocument));


// public routes
app.use('/api/auth', authRoute);

// private routes
app.use(protectedRoute)
app.use('/api/users', userRoute);
app.use('/api/friends', friendRoute);
app.use('/api/messages', messageRoute);
app.use('/api/conversations', conversationRoute);

connectDB().then(() => {
    app.listen(PORT, () => {
        console.log(`Server started on port: ${PORT}`);
    });
});
