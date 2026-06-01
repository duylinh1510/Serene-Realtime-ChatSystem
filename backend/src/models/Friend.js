import mongoose from "mongoose";

const friendSchema = new mongoose.Schema({
    userA: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    userB: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    }
}, { timestamps: true });

// sắp xếp cố định thứ tự 2 user
// tránh để MongoDB tạo 2 document, mặc dù 2 document đó là 1 (về quan hệ bạn bè)
friendSchema.pre('save', function () {
    const a = this.userA.toString();
    const b = this.userB.toString();

    if (a === b) {
        throw new Error('User cannot be friends with themselves');
    }

    if (a > b) {
        this.userA = new mongoose.Types.ObjectId(b);
        this.userB = new mongoose.Types.ObjectId(a);
    }
})

// tạo index unique cho cặp userA và userB
// Index này đảm bảo trong database không thể có 2 document trùng cùng cặp
friendSchema.index({ userA: 1, userB: 1 }, { unique: true });

const Friend = mongoose.model('Friend', friendSchema);

export default Friend;
