import { friendService } from "@/services/friendService";
import type { FriendState } from "@/types/store";
import { create } from "zustand";

export const useFriendStore = create<FriendState>((set, get) => ({
  loading: false,
  searchByUsername: async (username) => {
    try {
      set({ loading: true });

      const user = await friendService.searchByUsername(username);

      return user;
    } catch (error) {
      console.error("Error while searching user by username", error);
      return null;
    } finally {
      set({ loading: false });
    }
  },
  addFriend: async (to, message) => {
    try {
      set({ loading: true });

      const resultMessage = await friendService.sendFriendRequest(to, message);

      return resultMessage;
    } catch (error) {
      console.error("Error happened when addFriend", error);
      return "Lỗi xảy ra khi gửi kết bạn, hãy thử lại";
    } finally {
      set({ loading: false });
    }
  },
}));
