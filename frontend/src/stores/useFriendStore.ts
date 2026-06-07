import { friendService } from "@/services/friendService";
import type { FriendState } from "@/types/store";
import { create } from "zustand";

export const useFriendStore = create<FriendState>((set) => ({
  friends: [],
  loading: false,
  receivedList: [],
  sentList: [],
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
  getAllFriendRequests: async () => {
    try {
      set({ loading: true });

      const result = await friendService.getAllFriendRequests();

      if (!result) return;

      const { received, sent } = result;

      set({ receivedList: received, sentList: sent });
    } catch (error) {
      console.error("Error while getAllFriendRequests");
    } finally {
      set({ loading: false });
    }
  },
  acceptRequest: async (requestId) => {
    try {
      set({ loading: true });
      await friendService.acceptRequest(requestId);

      set((state) => ({
        receivedList: state.receivedList.filter((r) => r._id !== requestId),
      }));
    } catch (error) {
      console.error("Error while acceptRequest", error);
    } finally {
      set({ loading: false });
    }
  },
  declineRequest: async (requestId) => {
    try {
      set({ loading: true });
      await friendService.declineRequest(requestId);

      //lọc receivedList và xóa đi request có requestId
      //Duyệt qua danh sách receivedList và tạo ra một mảng mới.
      //Chỉ giữ lại những request có id khác requestId.
      set((state) => ({
        receivedList: state.receivedList.filter((r) => r._id !== requestId),
      }));
    } catch (error) {
      console.error("Error while declineRequest", error);
    } finally {
      set({ loading: false });
    }
  },
  getFriends: async () => {
    try {
      set({ loading: true });
      const friends = await friendService.getFriendList();

      set({ friends: friends });
    } catch (error) {
      console.error("Error while load friends", error);
      set({ friends: [] });
    } finally {
      set({ loading: false });
    }
  },
  addReceivedRequest: (request) => {
    set((state) => {
      const existed = state.receivedList.some((r) => r._id === request._id);

      if (existed) return state;

      return {
        receivedList: [request, ...state.receivedList],
      };
    });
  },
  removeReceivedRequest: (requestId) => {
    set((state) => ({
      receivedList: state.receivedList.filter((r) => r._id !== requestId),
    }));
  },
}));
