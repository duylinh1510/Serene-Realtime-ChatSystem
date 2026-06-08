import type { Conversation } from "@/types/chat";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import UserAvatar from "./UserAvatar";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/useAuthStore";
import { useChatStore } from "@/stores/useChatStore";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useFriendStore } from "@/stores/useFriendStore";
import type { Friend } from "@/types/user";
import InviteSuggestionList from "../NewGroupChat/InviteSuggestionList";
import SelectedUserList from "../NewGroupChat/SelectedUserList";
import { toast } from "sonner";

interface GroupInfoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  convo: Conversation;
}

const GroupInfoDialog = ({
  open,
  onOpenChange,
  convo,
}: GroupInfoDialogProps) => {
  const creator = convo.participants.find(
    (participant) => participant._id === convo.group?.createdBy,
  );

  const { user } = useAuthStore();
  const { renameGroup, addGroupMembers } = useChatStore();
  const { friends, getFriends } = useFriendStore();

  useEffect(() => {
    if (!open) return;

    void getFriends();
  }, [open, getFriends]);

  const isCreator = user?._id === convo.group?.createdBy;
  const [editing, setEditing] = useState(false);
  const [groupName, setGroupName] = useState(convo.group?.name ?? "");

  const handleRename = async () => {
    if (!groupName.trim()) return;

    await renameGroup(convo._id, groupName.trim());
    setEditing(false);
  };

  //state thêm thành viên
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<Friend[]>([]);
  const [addingMembers, setAddingMembers] = useState(false);

  const handleSelectFriend = (friend: Friend) => {
    setSelectedUsers((prev) => [...prev, friend]);
    setMemberSearch("");
  };

  const handleRemoveSelectedFriend = (friend: Friend) => {
    setSelectedUsers((prev) => prev.filter((u) => u._id !== friend._id));
  };

  const currentMemberIds = convo.participants.map((p) => p._id);

  const normalizedSearch = memberSearch.trim().toLowerCase();

  const filteredFriends = friends.filter((friend) => {
    const displayName = friend.displayName.toLowerCase();
    const username = friend.username.toLowerCase();

    return (
      (displayName.includes(normalizedSearch) ||
        username.includes(normalizedSearch)) &&
      !currentMemberIds.includes(friend._id) &&
      !selectedUsers.some((u) => u._id === friend._id)
    );
  });

  const handleAddMembers = async () => {
    if (selectedUsers.length === 0) {
      toast.warning("Chọn ít nhất một thành viên để thêm vào nhóm");
      return;
    }

    try {
      setAddingMembers(true);

      await addGroupMembers(
        convo._id,
        selectedUsers.map((user) => user._id),
      );

      setSelectedUsers([]);
      setMemberSearch("");
      toast.success("Đã thêm thành viên vào nhóm");
    } catch (error) {
      console.error("Error while adding group members", error);
      toast.error("Không thể thêm thành viên vào nhóm");
    } finally {
      setAddingMembers(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Thông tin nhóm</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          <div className="flex flex-col items-center gap-2">
            {editing ? (
              <div className="flex w-full gap-2">
                <Input
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                />
                <Button onClick={handleRename}>Lưu</Button>
                <Button variant="outline" onClick={() => setEditing(false)}>
                  Hủy
                </Button>
              </div>
            ) : (
              <>
                <div className="text-lg font-semibold">{convo.group?.name}</div>

                {isCreator && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditing(true)}
                  >
                    Đổi tên
                  </Button>
                )}
              </>
            )}
            <div className="text-sm text-muted-foreground">
              {convo.participants.length} thành viên
            </div>
          </div>

          <div className="rounded-md border border-border/60 p-3 space-y-3">
            <p className="mb-2 text-sm font-medium">Người tạo nhóm</p>
            <div className="flex items-center gap-3">
              <UserAvatar
                type="chat"
                name={creator?.displayName ?? "Unknown"}
                avatarUrl={creator?.avatarUrl ?? undefined}
              />
              <span className="text-sm">
                {creator?.displayName ?? "Không xác định"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">Thêm thành viên</p>
              <Button
                type="button"
                size="sm"
                disabled={addingMembers || selectedUsers.length === 0}
                onClick={handleAddMembers}
              >
                {addingMembers ? "Đang thêm..." : "Thêm"}
              </Button>
            </div>

            <Input
              placeholder="Tìm bạn bè để thêm"
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
            />

            {memberSearch && filteredFriends.length > 0 && (
              <InviteSuggestionList
                filteredFriends={filteredFriends}
                onSelect={handleSelectFriend}
              />
            )}

            <SelectedUserList
              invitedUsers={selectedUsers}
              onRemove={handleRemoveSelectedFriend}
            />
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">
              Thành viên ({convo.participants.length})
            </p>

            <div className="max-h-72 space-y-2 overflow-y-2 overflow-y-auto pr-1">
              {convo.participants.map((participant) => (
                <div
                  key={participant._id}
                  className="flex items-center justify-between rounded-md px-2 py-2 hover:bg-muted/60"
                >
                  <div className="flex items-center gap-3">
                    <UserAvatar
                      type="chat"
                      name={participant.displayName}
                      avatarUrl={participant.avatarUrl ?? undefined}
                    />
                    <span className="text-sm font-medium">
                      {participant.displayName}
                    </span>
                  </div>
                  {participant._id === convo.group?.createdBy && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                      Chủ nhóm
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GroupInfoDialog;
