import { useChatStore } from "@/stores/useChatStore";
import type { Conversation } from "@/types/chat";
import { SidebarTrigger } from "../ui/sidebar";
import { useAuthStore } from "@/stores/useAuthStore";
import { Separator } from "../ui/separator";
import UserAvatar from "./UserAvatar";
import StatusBadge from "./StatusBadge";
import GroupChatAvatar from "./GroupChatAvatar";
import { useSocketStore } from "@/stores/useSocketStore";
import { useState } from "react";
import GroupInfoDialog from "./GroupInfoDialog";

const ChatWindowHeader = ({ chat }: { chat?: Conversation }) => {
  const { conversations, activeConversationId } = useChatStore();
  const { user } = useAuthStore();
  const { onlineUsers } = useSocketStore();
  const [groupInfoOpen, setGroupInfoOpen] = useState(false);
  let otherUser;

  chat = chat ?? conversations.find((c) => c._id === activeConversationId);

  if (!chat) {
    return (
      <header className="md:hidden sticky top-0 z-10 flex items-center gap-2 px-4 py-2 w-full">
        <SidebarTrigger className="-ml-1 text-foreground" />
      </header>
    );
  }

  if (chat.type === "direct") {
    // Lấy tất cả participant có _id khác với user hiện tại
    const otherUsers = chat.participants.filter((p) => p._id !== user?._id);

    //trong trường hợp direct thì mảng trả về 1 phần tử là bạn của user hiện tại đang chat
    otherUser = otherUsers.length > 0 ? otherUsers[0] : null;

    if (!user || !otherUser) return;
  }

  return (
    <>
      <header className="sticky top-0 z-10 px-4 py-2 flex items-center bg-background">
        <div className="flex items-center gap-2 w-full">
          <SidebarTrigger className="-ml-1 text-foreground" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />

          <div
            onClick={() => {
              if (chat.type === "group") {
                setGroupInfoOpen(true);
              }
            }}
            className="p-2 w-full flex items-center gap-3 cursor-pointer"
          >
            {/* avatar */}
            <div className="relative">
              {chat.type === "direct" ? (
                <>
                  <UserAvatar
                    type={"sidebar"}
                    name={otherUser?.displayName ?? "Serene"}
                    avatarUrl={otherUser?.avatarUrl || undefined}
                  />
                  {/* socket.io */}
                  <StatusBadge
                    status={
                      onlineUsers.includes(otherUser?._id ?? "")
                        ? "online"
                        : "offline"
                    }
                  />
                </>
              ) : (
                <GroupChatAvatar
                  participants={chat.participants}
                  type="sidebar"
                />
              )}
            </div>

            {/* name */}
            <h2 className="font-semibold text-foreground">
              {chat.type === "direct"
                ? otherUser?.displayName
                : chat.group?.name}
            </h2>
          </div>
        </div>
      </header>

      {chat.type === "group" && (
        <GroupInfoDialog
          open={groupInfoOpen}
          onOpenChange={setGroupInfoOpen}
          convo={chat}
        />
      )}
    </>
  );
};

export default ChatWindowHeader;
