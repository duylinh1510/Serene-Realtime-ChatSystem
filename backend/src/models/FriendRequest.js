import mongoose from "mongoose";

const friendRequestSchema = new mongoose.Schema({
    from: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    to: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    message: {
        type: String,
        maxLength: 300
    },
}, { timestamps: true });

// đảm bảo chỉ có duy nhất 1 lời mời kết bạn được gửi từ người này đến 1 người khác
friendRequestSchema.index({ from: 1, to: 1 }, { unique: true });

// truy vấn nhanh các lời mới kết bạn đã gửi
friendRequestSchema.index({ from: 1 });

// truy vấn nhanh các lời mời kết bạn đã nhận
friendRequestSchema.index({ to: 1 });

const FriendRequest = mongoose.model('FriendRequest', friendRequestSchema);

export default FriendRequest;

