import { useAuthStore } from "@/stores/useAuthStore";
import type { Conversation } from "@/types/chat";
import { useEffect, useRef, useState } from "react";
import { Button } from "../ui/button";
import { ImagePlusIcon, Send } from "lucide-react";
import { Input } from "../ui/input";
import EmojiPicker from "./EmojiPicker";
import { toast } from "sonner";
import { useChatStore } from "@/stores/useChatStore";
import { useSocketStore } from "@/stores/useSocketStore";

const MessageInput = ({ selectedConvo }: { selectedConvo: Conversation }) => {
  const { user } = useAuthStore();
  const { sendDirectMessage, sendGroupMessage } = useChatStore();
  const [value, setValue] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { socket } = useSocketStore();
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const emitTypingStart = () => {
    if (!socket || !selectedConvo?._id) return;

    socket.emit("typing:start", {
      conversationId: selectedConvo._id,
    });
  };

  const emitTypingStop = () => {
    if (!socket || !selectedConvo?._id) return;

    socket.emit("typing:stop", {
      conversationId: selectedConvo._id,
    });
  };

  // cleanup useEffect, dùng để dọn dẹp typing timeout
  // và gửi trạng thái ngừng gõ khi đổi conversation hoặc khi component bị unmount.
  useEffect(() => {
    return () => {
      // Nếu user đang gõ ở conversation A, sau đó chuyển nhanh sang conversation B, timer cũ của conversation A vẫn có thể còn tồn tại.
      // Nếu không clear, sau 1.5 giây nó vẫn chạy và có thể emit sai trạng thái.
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current); //hủy timer cũ
        typingTimeoutRef.current = null;
      }

      emitTypingStop();
    };
  }, [selectedConvo._id]);

  if (!user) return;

  const sendMessage = async () => {
    if (!value.trim() && !selectedImage) return;
    const currValue = value;
    const currImage = selectedImage;

    setValue("");
    setSelectedImage(null);
    emitTypingStop();

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    try {
      if (selectedConvo.type === "direct") {
        const participants = selectedConvo.participants;
        const otherUser = participants.filter((p) => p._id !== user._id)[0];

        await sendDirectMessage(otherUser._id, currValue, currImage);
      } else {
        await sendGroupMessage(selectedConvo._id, currValue, currImage);
      }
    } catch (error) {
      console.error(error);
      toast.error("Error while sending message. Please try again");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = e.target.value;
    setValue(nextValue);

    if (!nextValue.trim()) {
      emitTypingStop();
      return;
    }

    emitTypingStart();

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      emitTypingStop();
    }, 1500);
  };

  const handleSelectImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Vui lòng chọn file ảnh");
      return;
    }

    const maxSize = 5 * 1024 * 1024;

    if (file.size > maxSize) {
      toast.error("Ảnh không được vượt quá 5MB");
      return;
    }

    setSelectedImage(file);
  };

  return (
    <>
      {selectedImage && (
        <div className="px-3 py-2 text-xs text-muted-foreground bg-background border-t">
          Đã chọn: {selectedImage.name}
          <Button
            type="button"
            variant={"ghost"}
            size={"sm"}
            onClick={() => {
              setSelectedImage(null);
              if (fileInputRef.current) {
                fileInputRef.current.value = "";
              }
            }}
            className="ml-2 h-6 px-2"
          >
            Xóa
          </Button>
        </div>
      )}
      <div className="flex items-center gap-2 p-3 min-h-[56px] bg-background">
        <Button
          type="button"
          variant={"ghost"}
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          className="hover:bg-primary/10 transition-smooth"
        >
          <ImagePlusIcon className="size-4" />
        </Button>
        <div className="flex-1 relative">
          <Input
            onKeyPress={handleKeyPress}
            value={value}
            onChange={handleInputChange}
            placeholder="Soạn tin nhắn"
            className="pr-20 h-9 bg-white border-border/50 focus:border-primary/50 transition-smooth resize-none"
          ></Input>
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
            <Button
              asChild
              variant="ghost"
              size={"icon"}
              className="size-8 hover:bg-primary/10 transition-smooth"
            >
              <div>
                <EmojiPicker
                  onChange={(emoji: string) => setValue(`${value}${emoji}`)}
                />
              </div>
            </Button>
          </div>
        </div>
        <Button
          onClick={sendMessage}
          className="bg-gradient-chat hover:shadow-glow transition-smooth hover:scale-105"
          disabled={!value.trim() && !selectedImage}
        >
          <Send className="size-4 text-white" />
        </Button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={handleSelectImage}
        />
      </div>
    </>
  );
};

export default MessageInput;
