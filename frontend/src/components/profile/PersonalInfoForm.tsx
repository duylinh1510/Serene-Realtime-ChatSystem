import { Heart } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { User, UpdateProfilePayload } from "@/types/user";
import { useEffect, useState } from "react";
import { useUserStore } from "@/stores/useUserStore";

type EditableField = {
  key: keyof Pick<User, "displayName" | "username" | "email" | "phone">;
  label: string;
  type?: string;
};

const PERSONAL_FIELDS: EditableField[] = [
  { key: "displayName", label: "Tên hiển thị" },
  { key: "username", label: "Tên người dùng" },
  { key: "email", label: "Email", type: "email" },
  { key: "phone", label: "Số điện thoại" },
];

type Props = {
  userInfo: User | null;
};

const PersonalInfoForm = ({ userInfo }: Props) => {
  const { updateProfile } = useUserStore();

  const [formData, setFormData] = useState<UpdateProfilePayload>({
    displayName: "",
    username: "",
    email: "",
    phone: "",
    bio: "",
  });

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!userInfo) return;

    setFormData({
      displayName: userInfo.displayName ?? "",
      username: userInfo.username ?? "",
      email: userInfo.email ?? "",
      phone: userInfo.phone ?? "",
      bio: userInfo.bio ?? "",
    });
  }, [userInfo]);

  if (!userInfo) return null;

  const handleChange = (key: keyof UpdateProfilePayload, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setSubmitting(true);

      await updateProfile({
        displayName: formData.displayName,
        username: formData.username,
        email: formData.email,
        phone: formData.phone,
        bio: formData.bio,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="glass-strong border-border/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Heart className="size-5 text-primary" />
          Thông tin cá nhân
        </CardTitle>
        <CardDescription>
          Cập nhật chi tiết cá nhân và thông tin hồ sơ của bạn
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PERSONAL_FIELDS.map(({ key, label, type }) => (
              <div key={key} className="space-y-2">
                <Label htmlFor={key}>{label}</Label>
                <Input
                  id={key}
                  type={type ?? "text"}
                  value={formData[key] ?? ""}
                  onChange={(e) => handleChange(key, e.target.value)}
                  className="glass-light border-border/30"
                />
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">Giới thiệu</Label>
            <Textarea
              id="bio"
              rows={3}
              value={formData.bio ?? ""}
              onChange={(e) => handleChange("bio", e.target.value)}
              className="glass-light border-border/30 resize-none"
            />
          </div>

          <Button className="w-full md:w-auto bg-gradient-primary hover:opacity-90 transition-opacity">
            {submitting ? "Đang lưu..." : "Lưu thay đổi"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default PersonalInfoForm;
