import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    hashedPassword: {
        type: String,
        required: true
    },
    email: {
        type: String,
        unique: true,
        required: true,
        lowercase: true,
        trim: true
    },
    displayName: {
        type: String,
        required: true,
        trim: true
    },
    avatarUrl: {
        type: String, //link CDN để hiển thị hình
    },
    avatarId: {
        type: String, //Cloudinary public_id để xóa hình
    },
    bio: {
        type: String,
        maxLength: 500
    },
    phone: {
        type: String,
        sparse: true //cho phép null nhưng không được trùng
    }
}, {
    timestamps: true //mongoose tự động thêm 2 trường là createdAt và updatedAt
});

const User = mongoose.model("User", userSchema);
export default User;