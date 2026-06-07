import api from "@/lib/axios";
import type { UpdateProfilePayload, User } from "@/types/user";

export const userService = {
  uploadAvatar: async (formData: FormData) => {
    const res = await api.post("/users/uploadAvatar", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    if (res.status === 400) {
      throw new Error(res.data.message);
    }

    return res.data;
  },

  updateProfile: async (payload: UpdateProfilePayload): Promise<User> => {
    const res = await api.patch("/users/me", payload);

    return res.data.user;
  },
};
