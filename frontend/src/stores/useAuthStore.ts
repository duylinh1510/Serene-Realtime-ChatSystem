import { create } from "zustand";
import { toast } from "sonner";
import { authService } from "@/services/authService";
import type { AuthState } from "@/types/store";
import { persist } from "zustand/middleware";
import { useChatStore } from "./useChatStore";

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      user: null,
      loading: false,

      setAccessToken: (accessToken) => {
        set({ accessToken });
      },

      clearState: () => {
        set({ accessToken: null, user: null, loading: false });
        localStorage.clear();
        useChatStore.getState().reset(); // đảm bảo user khi logout hay đăng nhập lại sẽ có state từ chatStore
      },

      signUp: async (username, password, email, firstName, lastName) => {
        try {
          set({ loading: true });

          // gọi api
          await authService.signUp(
            username,
            password,
            email,
            firstName,
            lastName,
          );

          toast.success(
            "Register successfully! You will be directed to Login page.",
          );
        } catch (error) {
          console.error(error);
          toast.error("Register failed");
        } finally {
          set({ loading: false });
        }
      },

      signIn: async (username, password) => {
        try {
          set({ loading: true });

          localStorage.clear();
          useChatStore.getState().reset();

          const { accessToken } = await authService.signIn(username, password);
          get().setAccessToken(accessToken);

          // sau khi đăng nhập xong app tự gọi fetchMe để lấy thông tin người dùng
          // và lưu vào store
          await get().fetchMe();

          // ngay sau khi đăng nhập là có dữ liệu của conversations từ store
          useChatStore.getState().fetchConversations();

          toast.success("Welcome back!");
        } catch (error) {
          console.error(error);
          toast.error("Login failed");
        } finally {
          set({ loading: false });
        }
      },

      signOut: async () => {
        try {
          get().clearState();

          await authService.signOut();
          toast.success("Logged out successfully!");
        } catch (error) {
          console.error(error);
          toast.error("Error while logging out. Please try again!");
        }
      },

      fetchMe: async () => {
        try {
          set({ loading: true });
          const user = await authService.fetchMe();

          set({ user });
        } catch (error) {
          console.error();
          set({ user: null, accessToken: null });
          toast.error(
            "An error occurred when fetching user data. Please try again!",
          );
        } finally {
          set({ loading: false });
        }
      },

      refresh: async () => {
        try {
          set({ loading: true });
          const { user, fetchMe } = get();
          const accessToken = await authService.refresh();

          get().setAccessToken(accessToken);

          if (!user) {
            await fetchMe();
          }
        } catch (error) {
          console.error(error);
          toast.error(
            "Your login session has expired. Please login again to continue!",
          );
          get().clearState();
        } finally {
          set({ loading: false });
        }
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({ user: state.user }), //chỉ persist user
    },
  ),
);
