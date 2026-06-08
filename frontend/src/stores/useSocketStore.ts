import { create } from "zustand";
import { io, type Socket } from "socket.io-client";
import { useAuthStore } from "./useAuthStore";
import type { SocketState } from "@/types/store";
import { useChatStore } from "./useChatStore";
import { useFriendStore } from "./useFriendStore";
import { toast } from "sonner";

const baseURL = import.meta.env.VITE_SOCKET_URL;

export const useSocketStore = create<SocketState>((set, get) => ({
  socket: null,
  onlineUsers: [],
  typingUsers: {},
  connectSocket: () => {
    const accessToken = useAuthStore.getState().accessToken;

    if (!accessToken) return;

    const existingSocket = get().socket;

    if (existingSocket?.connected) return;

    existingSocket?.disconnect();

    const socket: Socket = io(baseURL, {
      auth: { token: accessToken },
      transports: ["websocket"],
    });

    socket.on("connect", () => {
      console.log("Socket connected!");
    });

    //online users
    socket.on("online-users", (usersIds) => {
      set({ onlineUsers: usersIds });
    });

    //friend request
    socket.on("friend-request:new", ({ request }) => {
      useFriendStore.getState().addReceivedRequest(request);

      const senderName = request.from?.displayName ?? "Ai đó";

      toast.info(`${senderName} đã gửi lời mời kết bạn`);
    });

    //typing
    socket.on("typing:start", ({ conversationId, user }) => {
      set((state) => {
        const currentTypingUsers = state.typingUsers[conversationId] ?? [];

        //kiểm tra nếu đang typing rồi thì thôi
        //không emit sự kiện để tránh duplicate sự kiện
        const alreadyTyping = currentTypingUsers.some(
          (typingUser) => typingUser._id === user._id,
        );

        if (alreadyTyping) return state;

        return {
          typingUsers: {
            ...state.typingUsers,
            [conversationId]: [...currentTypingUsers, user],
          },
        };
      });
    });

    socket.on("typing:stop", ({ conversationId, user }) => {
      set((state) => {
        const currentTypingUsers = state.typingUsers[conversationId] ?? [];

        return {
          typingUsers: {
            ...state.typingUsers,
            [conversationId]: currentTypingUsers.filter(
              (typingUser) => typingUser._id !== user._id,
            ),
          },
        };
      });
    });

    //new message
    socket.on("new-message", ({ message, conversation, unreadCounts }) => {
      useChatStore.getState().addMessage(message);

      const lastMessage = {
        _id: conversation.lastMessage._id,
        content: conversation.lastMessage.content,
        createdAt: conversation.lastMessage.createdAt,
        sender: {
          _id: conversation.lastMessage.senderId,
          displayName: "",
          avatarUrl: null,
        },
      };

      const updatedConversation = {
        ...conversation,
        lastMessage,
        unreadCounts,
      };

      // nếu có tin nhắn mới và user mở cuộc hội thoại chứa tin nhắn đó lên
      // thì mark as seen ngay lập tức
      if (
        useChatStore.getState().activeConversationId === message.conversationId
      ) {
        useChatStore.getState().markAsSeen();
      }

      useChatStore.getState().updateConversation(updatedConversation);
    });

    //mark as seen
    socket.on("read-message", ({ conversation, lastMessage }) => {
      const updated = {
        _id: conversation._id,
        lastMessage,
        lastMessageAt: conversation.lastMessageAt,
        unreadCounts: conversation.unreadCounts,
        seenBy: conversation.seenBy,
      };

      useChatStore.getState().updateConversation(updated);
    });

    //new group
    socket.on("new-group", (conversation) => {
      useChatStore.getState().addConvo(conversation);
      socket.emit("join-conversation", conversation._id);
    });

    //rename group
    socket.on("group:updated", (conversation) => {
      useChatStore.getState().updateConversation(conversation);
    });

    socket.on("connect_error", (error) => {
      console.error("Socket connect error:", error.message);
    });

    socket.on("disconnect", (reason) => {
      console.log("Socket disconnected:", reason);
    });

    set({ socket });
  },
  disconnectSocket: () => {
    const socket = get().socket;
    if (socket) {
      socket.disconnect();
      set({ socket: null, typingUsers: {} });
    }
  },
}));
