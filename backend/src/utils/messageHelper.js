export const updateConversationAfterCreateMessage = (conversation, message, senderId) => {
    conversation.set({
        seenBy: [],
        lastMessageAt: message.createdAt,
        lastMessage: {
            _id: message._id,
            content: message.content,
            senderId,
            createdAt: message.createdAt
        }
    });

    //cập nhật số lượng tin nhắn chưa đọc cho từng thành viên trong cuộc trò chuyện.
    conversation.participants.forEach((p) => {
        const memberId = p.userId.toString(); // Lấy id của từng participant.
        const isSender = memberId === senderId.toString(); //Kiểm tra participant hiện tại có phải người gửi tin nhắn không.
        const prevCount = conversation.unreadCounts.get(memberId) || 0; // Lấy số tin nhắn chưa đọc hiện tại của user đó.
        conversation.unreadCounts.set(memberId, isSender ? 0 : prevCount + 1)
    })
}



// Khi user gửi một tin nhắn mới, backend sẽ:
// 1. Lưu message vào database
// 2. Cập nhật conversation.lastMessage
// 3. Cập nhật conversation.lastMessageAt
// 4. Cập nhật unreadCounts
// 5. Emit sự kiện "new-message" cho các user trong conversation
export const emitNewMessage = (io, conversation, message) => {
    io.to(conversation._id.toString()).emit("new-message", {
        message,
        conversation: {
            _id: conversation._id,
            lastMessage: conversation.lastMessage,
            lastMessageAt: conversation.lastMessageAt,
        },
        unreadCounts: conversation.unreadCounts
    });
};