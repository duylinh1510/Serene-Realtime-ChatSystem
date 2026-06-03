import type { ThemeState } from "@/types/store";
import { create } from "zustand";
import { persist } from "zustand/middleware";

// tạo một Zustand store để quản lý theme dark/light
// và lưu trạng thái vào localStorage bằng persist.
export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      isDark: false,
      toggleTheme: () => {
        const newValue = !get().isDark;

        set({ isDark: newValue });

        if (newValue) {
          document.documentElement.classList.add("dark"); //document.documentElement chính là thẻ <html>.
        } else {
          document.documentElement.classList.remove("dark");
        }
      },
      // setTheme dùng để gán trực tiếp theme theo giá trị mình muốn
      // thay vì chỉ đảo qua lại như toggleTheme
      setTheme: (dark: boolean) => {
        set({ isDark: dark });

        if (dark) {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
        }
      },
    }),
    {
      name: "theme-storage",
    },
  ),
);
