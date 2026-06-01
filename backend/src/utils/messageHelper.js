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