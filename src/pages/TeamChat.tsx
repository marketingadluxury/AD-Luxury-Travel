import React, { useState, useEffect, useRef } from 'react';
import { useCRM } from '@/context/CRMContext';
import { useAuth } from '@/context/AuthContext';
import {
  MessageSquare,
  Send,
  Paperclip,
  Smile,
  Hash,
  User as UserIcon,
  Search,
  Plus,
  Image as ImageIcon,
  X,
  Tag,
  CheckCheck,
  ChevronRight,
  Reply,
  Shield,
  FileText,
  MapPin,
  FileCheck,
  Users,
  Settings,
  Trash2,
  Check,
  Edit3,
  UserPlus,
  UserMinus,
  Sparkles
} from 'lucide-react';
import { formatDateVi, formatDateTimeVi } from '@/lib/utils';
import { uploadFileToCRM } from '@/lib/supabase';
import { ChatMessage, ChatChannel } from '@/types';
import toast from 'react-hot-toast';

const AVAILABLE_ICONS = ['💬', '👥', '🚀', '🎯', '✈️', '💰', '📑', '📸', '🌟', '🔥', '🧭', '📈', '🛡️', '❤️', '🏆'];

export default function TeamChat() {
  const { profile, user } = useAuth();
  const {
    profilesList = [],
    tours = [],
    orders = [],
    paymentProposals = [],
    chatMessages = [],
    chatChannels = [],
    sendChatMessage,
    addChatReaction,
    createChatChannel,
    updateChatChannel,
    deleteChatChannel
  } = useCRM();

  const [activeTab, setActiveTab] = useState<'channel' | 'direct'>('channel');
  const [selectedChannelId, setSelectedChannelId] = useState<string>('chung');
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | null>(null);

  const [messageInput, setMessageInput] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<{ url: string; name: string; type: 'image' | 'file' }[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Tagging entities (Tour, Order, Proposal)
  const [showTagModal, setShowTagModal] = useState(false);
  const [tagType, setTagType] = useState<'tour' | 'order' | 'proposal'>('tour');
  const [selectedTagCode, setSelectedTagCode] = useState<string>('');

  // Channel Creation Modal State
  const [showCreateChannelModal, setShowCreateChannelModal] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelDesc, setNewChannelDesc] = useState('');
  const [newChannelIcon, setNewChannelIcon] = useState('💬');
  const [newChannelMembers, setNewChannelMembers] = useState<string[]>([]);
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);

  // Manage Group Modal State
  const [showManageGroupModal, setShowManageGroupModal] = useState(false);
  const [editingChannelName, setEditingChannelName] = useState('');
  const [editingChannelDesc, setEditingChannelDesc] = useState('');
  const [editingChannelIcon, setEditingChannelIcon] = useState('💬');
  const [selectedMemberToAdd, setSelectedMemberToAdd] = useState('');

  // Reply state
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);

  // Search filter for sidebar
  const [sidebarSearch, setSidebarSearch] = useState('');

  // Auto scroll
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, selectedChannelId, selectedRecipientId]);

  // Current active user profile
  const currentUserName = profile?.full_name || user?.email?.split('@')[0] || 'Nhân viên';
  const currentUserRole = profile?.role || 'sale';
  const currentUserId = profile?.id || user?.id || 'guest';
  const isAdminOrBod = currentUserRole === 'admin' || currentUserRole === 'bod';

  // Selected channel object
  const selectedChannel = chatChannels.find(c => c.id === selectedChannelId) || {
    id: 'chung',
    name: 'Kênh Chung',
    description: 'Kênh thảo luận chung toàn công ty',
    icon: '💬',
    type: 'preset'
  };

  const isCurrentChannelCustom = selectedChannel.type === 'custom';

  // Check if current user is member of selected channel
  const currentChannelMembersList = (selectedChannel.members && selectedChannel.members.length > 0)
    ? profilesList.filter(p => selectedChannel.members?.includes(p.id))
    : profilesList; // If members is empty/null, it's public to all

  // Populate manage group form when opening
  const handleOpenManageGroup = () => {
    setEditingChannelName(selectedChannel.name || '');
    setEditingChannelDesc(selectedChannel.description || '');
    setEditingChannelIcon(selectedChannel.icon || '💬');
    setShowManageGroupModal(true);
  };

  // Filter messages for current channel or DM
  const currentMessages = chatMessages.filter(msg => {
    if (activeTab === 'channel') {
      return msg.channel_id === selectedChannelId;
    } else {
      return (
        (msg.sender_id === currentUserId && msg.recipient_id === selectedRecipientId) ||
        (msg.sender_id === selectedRecipientId && msg.recipient_id === currentUserId)
      );
    }
  });

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      const newAttachments: { url: string; name: string; type: 'image' | 'file' }[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const res = await uploadFileToCRM(file, 'crm-attachments', 'chat');
        if (res && res.url) {
          const isImg = file.type.startsWith('image/');
          newAttachments.push({
            url: res.url,
            name: file.name,
            type: isImg ? 'image' : 'file'
          });
        }
      }
      setAttachedFiles(prev => [...prev, ...newAttachments]);
    } catch (err) {
      console.error('File upload failed:', err);
      toast.error('Tải file đính kèm thất bại');
    } finally {
      setIsUploading(false);
    }
  };

  // Create Channel Action
  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim()) {
      toast.error('Vui lòng nhập tên nhóm trò chuyện!');
      return;
    }

    setIsCreatingChannel(true);
    try {
      const created = await createChatChannel({
        name: newChannelName.trim(),
        description: newChannelDesc.trim(),
        icon: newChannelIcon,
        members: newChannelMembers.length > 0 ? newChannelMembers : profilesList.map(p => p.id)
      });

      toast.success(`Đã tạo nhóm trò chuyện "${created.name}" thành công!`);
      setSelectedChannelId(created.id);
      setActiveTab('channel');

      // Reset Form
      setNewChannelName('');
      setNewChannelDesc('');
      setNewChannelIcon('💬');
      setNewChannelMembers([]);
      setShowCreateChannelModal(false);
    } catch (err) {
      console.error('Lỗi khi tạo nhóm:', err);
      toast.error('Không thể tạo nhóm trò chuyện. Vui lòng thử lại!');
    } finally {
      setIsCreatingChannel(false);
    }
  };

  // Update Group Info
  const handleUpdateGroup = async () => {
    if (!editingChannelName.trim()) {
      toast.error('Tên nhóm không được để trống!');
      return;
    }

    try {
      await updateChatChannel(selectedChannel.id, {
        name: editingChannelName.trim(),
        description: editingChannelDesc.trim(),
        icon: editingChannelIcon
      });

      toast.success('Đã cập nhật thông tin nhóm thành công!');
      setShowManageGroupModal(false);
    } catch (err) {
      toast.error('Cập nhật thất bại. Vui lòng thử lại!');
    }
  };

  // Add Member to Current Group
  const handleAddMemberToGroup = async (userIdToAdd: string) => {
    if (!userIdToAdd) return;
    const currentMembers = selectedChannel.members || profilesList.map(p => p.id);
    if (currentMembers.includes(userIdToAdd)) {
      toast.error('Thành viên này đã có trong nhóm!');
      return;
    }

    const updatedMembers = [...currentMembers, userIdToAdd];
    await updateChatChannel(selectedChannel.id, { members: updatedMembers });
    setSelectedMemberToAdd('');
    toast.success('Đã thêm thành viên vào nhóm!');
  };

  // Remove Member from Current Group
  const handleRemoveMemberFromGroup = async (userIdToRemove: string) => {
    const currentMembers = selectedChannel.members || profilesList.map(p => p.id);
    const updatedMembers = currentMembers.filter(id => id !== userIdToRemove);
    await updateChatChannel(selectedChannel.id, { members: updatedMembers });
    toast.success('Đã xóa thành viên khỏi nhóm!');
  };

  // Delete Custom Channel
  const handleDeleteChannel = async () => {
    if (!isCurrentChannelCustom) {
      toast.error('Không thể xóa kênh mặc định của hệ thống!');
      return;
    }

    if (window.confirm(`Bạn có chắc chắn muốn xóa nhóm trò chuyện "${selectedChannel.name}"?`)) {
      await deleteChatChannel(selectedChannel.id);
      toast.success('Đã xóa nhóm trò chuyện!');
      setSelectedChannelId('chung');
      setShowManageGroupModal(false);
    }
  };

  // Send Message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() && attachedFiles.length === 0 && !selectedTagCode) return;

    const payload: Omit<ChatMessage, 'id' | 'created_at'> = {
      sender_id: currentUserId,
      sender_name: currentUserName,
      sender_role: currentUserRole,
      content: messageInput.trim(),
      attachments: attachedFiles.length > 0 ? attachedFiles : undefined,
      reply_to: replyingTo ? { id: replyingTo.id, sender_name: replyingTo.sender_name, content: replyingTo.content } : undefined,
    };

    if (activeTab === 'channel') {
      payload.channel_id = selectedChannelId;
    } else if (selectedRecipientId) {
      payload.recipient_id = selectedRecipientId;
    }

    if (selectedTagCode) {
      if (tagType === 'tour') payload.tour_code = selectedTagCode;
      if (tagType === 'order') payload.order_code = selectedTagCode;
      if (tagType === 'proposal') payload.proposal_code = selectedTagCode;
    }

    await sendChatMessage(payload);

    // Reset input
    setMessageInput('');
    setAttachedFiles([]);
    setSelectedTagCode('');
    setReplyingTo(null);
  };

  // Filter profiles for DM
  const filteredProfiles = profilesList.filter(p => p.id !== currentUserId && (
    p.full_name?.toLowerCase().includes(sidebarSearch.toLowerCase()) ||
    p.role?.toLowerCase().includes(sidebarSearch.toLowerCase()) ||
    p.phone?.includes(sidebarSearch)
  ));

  // Filter channels for current user visibility
  const visibleChannels = chatChannels.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(sidebarSearch.toLowerCase()) ||
      (c.description && c.description.toLowerCase().includes(sidebarSearch.toLowerCase()));
    
    if (!matchesSearch) return false;

    // Preset channel role access check
    if (c.role_access && c.role_access.length > 0) {
      if (!isAdminOrBod && !c.role_access.includes(currentUserRole)) {
        return false;
      }
    }

    // Custom group members check
    if (c.type === 'custom' && c.members && c.members.length > 0) {
      if (!isAdminOrBod && !c.members.includes(currentUserId) && c.created_by !== currentUserId) {
        return false;
      }
    }

    return true;
  });

  const selectedRecipient = profilesList.find(p => p.id === selectedRecipientId);

  return (
    <div className="w-full h-[calc(100vh-4.5rem)] flex flex-col md:flex-row bg-slate-50 border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs">
      
      {/* SIDEBAR: Channels & Direct Messages */}
      <div className="w-full md:w-80 lg:w-88 shrink-0 bg-white border-r border-slate-200/80 flex flex-col h-full">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-500/20">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-black text-slate-800 tracking-tight">Trò Chuyện Nội Bộ</h2>
                <p className="text-[11px] text-slate-500 font-medium">AD Luxury Travel Team</p>
              </div>
            </div>

            {/* Create Group Button */}
            <button
              onClick={() => setShowCreateChannelModal(true)}
              className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer border border-blue-200/60 shadow-2xs"
              title="Tạo nhóm trò chuyện mới"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tạo nhóm</span>
            </button>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Tìm nhóm hoặc đồng nghiệp..."
              value={sidebarSearch}
              onChange={e => setSidebarSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-100 hover:bg-slate-200/60 focus:bg-white text-xs rounded-xl border border-transparent focus:border-blue-500 focus:outline-none transition-all font-medium placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-100 px-3 pt-2 gap-1 bg-slate-50/30">
          <button
            onClick={() => setActiveTab('channel')}
            className={`flex-1 py-2 text-xs font-bold rounded-t-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'channel'
                ? 'bg-white text-blue-600 border-t-2 border-blue-600 shadow-xs'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100/50'
            }`}
          >
            <Hash className="w-3.5 h-3.5" />
            <span>Kênh & Nhóm ({visibleChannels.length})</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('direct');
              if (!selectedRecipientId && filteredProfiles.length > 0) {
                setSelectedRecipientId(filteredProfiles[0].id);
              }
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-t-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'direct'
                ? 'bg-white text-blue-600 border-t-2 border-blue-600 shadow-xs'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100/50'
            }`}
          >
            <UserIcon className="w-3.5 h-3.5" />
            <span>Cá nhân (1-1)</span>
          </button>
        </div>

        {/* List Area */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {activeTab === 'channel' ? (
            visibleChannels.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">Không tìm thấy nhóm phù hợp</div>
            ) : (
              visibleChannels.map(ch => {
                const isSelected = selectedChannelId === ch.id;
                return (
                  <button
                    key={ch.id}
                    onClick={() => {
                      setSelectedChannelId(ch.id);
                      setActiveTab('channel');
                    }}
                    className={`w-full p-2.5 rounded-xl text-left transition-all flex items-center justify-between group cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200/60 shadow-2xs'
                        : 'hover:bg-slate-100/70 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-base">{ch.icon || '💬'}</span>
                      <div className="truncate">
                        <div className="text-xs font-bold truncate flex items-center gap-1.5">
                          <span>#{ch.name}</span>
                          {ch.type === 'custom' && (
                            <span className="px-1.5 py-0.2 text-[9px] bg-purple-100 text-purple-700 rounded-md font-extrabold uppercase">
                              Nhóm
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 font-normal truncate mt-0.5">{ch.description || 'Kênh nội bộ CRM'}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 shrink-0" />
                  </button>
                );
              })
            )
          ) : (
            filteredProfiles.map(p => {
              const roleLabels: Record<string, string> = {
                admin: 'Quản trị viên',
                bod: 'Ban Giám Đốc',
                sale_leader: 'Sale Leader',
                sale: 'Sale',
                operator: 'Điều hành',
                accounting: 'Kế toán',
                visa: 'Visa',
                tour_guide: 'HDV',
                CTV: 'CTV / Đại lý'
              };
              const isSelected = selectedRecipientId === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedRecipientId(p.id)}
                  className={`w-full p-2.5 rounded-xl text-left transition-all flex items-center gap-2.5 group cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200/60 shadow-2xs'
                      : 'hover:bg-slate-100/70 text-slate-700'
                  }`}
                >
                  <div className="relative shrink-0">
                    <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-black uppercase border border-slate-300">
                      {p.full_name ? p.full_name.substring(0, 2) : 'NV'}
                    </div>
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white absolute bottom-0 right-0"></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 truncate">{p.full_name}</span>
                      <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 uppercase">
                        {roleLabels[p.role] || p.role}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-normal truncate mt-0.5">{p.phone || 'Nội bộ'}</p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* CHAT MAIN CONTENT PANEL (FULL WIDTH) */}
      <div className="flex-1 min-w-0 flex flex-col h-full bg-white overflow-hidden">
        
        {/* Active Chat Header */}
        <div className="p-3.5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between shadow-2xs shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {activeTab === 'channel' ? (
              <>
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-lg shrink-0">
                  {selectedChannel?.icon || '#'}
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5 truncate">
                    <span>#{selectedChannel?.name}</span>
                    {isCurrentChannelCustom && (
                      <span className="px-2 py-0.5 text-[10px] bg-purple-100 text-purple-700 border border-purple-200 rounded-lg font-bold">
                        Nhóm tùy chỉnh
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium truncate">{selectedChannel?.description || 'Kênh trao đổi công việc nội bộ'}</p>
                </div>
              </>
            ) : (
              <>
                <div className="w-9 h-9 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-black text-xs uppercase border border-slate-300 shrink-0">
                  {selectedRecipient?.full_name?.substring(0, 2) || 'NV'}
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-black text-slate-800 truncate">{selectedRecipient?.full_name || 'Đồng nghiệp'}</h3>
                  <p className="text-xs text-slate-500 font-medium flex items-center gap-2 truncate">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                    <span>Đang hoạt động</span>
                    {selectedRecipient?.phone && <span className="text-slate-400">| {selectedRecipient.phone}</span>}
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Header Right Quick Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {activeTab === 'channel' && (
              <button
                onClick={handleOpenManageGroup}
                className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Users className="w-3.5 h-3.5 text-blue-600" />
                <span>Thành viên ({currentChannelMembersList.length})</span>
                <Settings className="w-3 h-3 text-slate-400 ml-1" />
              </button>
            )}

            <button
              onClick={() => setShowTagModal(true)}
              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/60 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Tag className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden sm:inline">Gắn mã CRM</span>
            </button>
          </div>
        </div>

        {/* Messages Stream Container */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/30">
          {currentMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-500 flex items-center justify-center mb-2 shadow-2xs">
                <MessageSquare className="w-6 h-6" />
              </div>
              <h4 className="text-xs font-bold text-slate-700">Chưa có tin nhắn nào trong nhóm này</h4>
              <p className="text-[11px] text-slate-400 max-w-xs mt-1">Hãy trao đổi công việc với đồng nghiệp bằng cách gửi tin nhắn đầu tiên bên dưới.</p>
            </div>
          ) : (
            currentMessages.map(msg => {
              const isMe = msg.sender_id === currentUserId;
              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 group ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs uppercase shrink-0 mt-0.5 border border-slate-300 shadow-2xs">
                    {msg.sender_name ? msg.sender_name.substring(0, 2) : 'NV'}
                  </div>

                  {/* Message Bubble Container */}
                  <div className={`max-w-[75%] space-y-1 ${isMe ? 'items-end text-right' : 'items-start'}`}>
                    {/* Sender Info & Time */}
                    <div className={`flex items-center gap-2 text-[10px] text-slate-400 ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <span className="font-bold text-slate-700">{msg.sender_name}</span>
                      <span className="px-1 py-0.2 rounded bg-slate-100 text-slate-500 text-[9px] uppercase font-extrabold">{msg.sender_role}</span>
                      <span>•</span>
                      <span>{formatDateTimeVi(msg.created_at)}</span>
                    </div>

                    {/* Reply header if present */}
                    {msg.reply_to && (
                      <div className="p-2 rounded-lg bg-slate-200/60 border-l-3 border-blue-500 text-[11px] text-slate-600 mb-1 text-left">
                        <span className="font-bold text-blue-700">@{msg.reply_to.sender_name}: </span>
                        <span className="italic">{msg.reply_to.content}</span>
                      </div>
                    )}

                    {/* Main Text Bubble */}
                    <div
                      className={`p-3 rounded-2xl text-xs font-medium leading-relaxed shadow-2xs ${
                        isMe
                          ? 'bg-blue-600 text-white rounded-tr-xs'
                          : 'bg-white text-slate-800 border border-slate-200/80 rounded-tl-xs'
                      }`}
                    >
                      <div className="whitespace-pre-wrap break-words">{msg.content}</div>

                      {/* Attached Tag Embed (Tour / Order / Proposal) */}
                      {msg.tour_code && (
                        <div className={`mt-2 p-2 rounded-xl text-xs font-bold flex items-center gap-2 ${isMe ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-800 border border-slate-200'}`}>
                          <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                          <div className="text-left">
                            <div className="text-[10px] opacity-80 uppercase tracking-wider font-semibold">Mã Tour liên kết:</div>
                            <div className="font-mono font-black text-sm">{msg.tour_code}</div>
                          </div>
                        </div>
                      )}

                      {msg.order_code && (
                        <div className={`mt-2 p-2 rounded-xl text-xs font-bold flex items-center gap-2 ${isMe ? 'bg-blue-700 text-white' : 'bg-purple-50 text-purple-900 border border-purple-200'}`}>
                          <FileText className="w-4 h-4 text-purple-500 shrink-0" />
                          <div className="text-left">
                            <div className="text-[10px] opacity-80 uppercase tracking-wider font-semibold">Mã Booking liên kết:</div>
                            <div className="font-mono font-black text-sm">{msg.order_code}</div>
                          </div>
                        </div>
                      )}

                      {msg.proposal_code && (
                        <div className={`mt-2 p-2 rounded-xl text-xs font-bold flex items-center gap-2 ${isMe ? 'bg-blue-700 text-white' : 'bg-amber-50 text-amber-900 border border-amber-200'}`}>
                          <FileCheck className="w-4 h-4 text-amber-500 shrink-0" />
                          <div className="text-left">
                            <div className="text-[10px] opacity-80 uppercase tracking-wider font-semibold">Mã ĐNTT liên kết:</div>
                            <div className="font-mono font-black text-sm">{msg.proposal_code}</div>
                          </div>
                        </div>
                      )}

                      {/* Attachments */}
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="mt-2 space-y-1.5">
                          {msg.attachments.map((att, idx) => (
                            <div key={idx}>
                              {att.type === 'image' ? (
                                <a href={att.url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-xl border border-slate-200/50 max-w-xs">
                                  <img src={att.url} alt={att.name} className="max-h-48 w-full object-cover hover:scale-105 transition-all" />
                                </a>
                              ) : (
                                <a
                                  href={att.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`p-2 rounded-xl text-xs flex items-center gap-2 underline ${isMe ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-700'}`}
                                >
                                  <Paperclip className="w-3.5 h-3.5 shrink-0" />
                                  <span className="truncate">{att.name}</span>
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Reactions & Action bar */}
                    <div className={`flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <button
                        onClick={() => setReplyingTo(msg)}
                        className="p-1 hover:bg-slate-200 rounded text-[10px] text-slate-500 font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Reply className="w-3 h-3" />
                        <span>Trả lời</span>
                      </button>

                      {['👍', '❤️', '🎉', '😂'].map(emoji => (
                        <button
                          key={emoji}
                          onClick={() => addChatReaction(msg.id, emoji, currentUserName)}
                          className="px-1.5 py-0.5 hover:bg-slate-200 rounded text-xs transition-transform active:scale-125 cursor-pointer"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>

                    {/* Display active reactions */}
                    {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                      <div className={`flex flex-wrap gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                        {Object.entries(msg.reactions).map(([emoji, users]) => (
                          <span key={emoji} className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-white border border-slate-200 rounded-full text-[10px] font-bold text-slate-700 shadow-2xs">
                            <span>{emoji}</span>
                            <span>{users.length}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Reply Banner if replying */}
        {replyingTo && (
          <div className="px-4 py-2 bg-blue-50 border-t border-blue-200 flex items-center justify-between text-xs font-medium text-blue-800 shrink-0">
            <div className="flex items-center gap-1.5 truncate">
              <Reply className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>Đang trả lời <strong>@{replyingTo.sender_name}</strong>: </span>
              <span className="italic truncate">{replyingTo.content}</span>
            </div>
            <button onClick={() => setReplyingTo(null)} className="p-1 hover:bg-blue-100 rounded-full cursor-pointer">
              <X className="w-3.5 h-3.5 text-blue-600" />
            </button>
          </div>
        )}

        {/* Attached Files Banner */}
        {attachedFiles.length > 0 && (
          <div className="px-4 py-2 bg-slate-100 border-t border-slate-200 flex flex-wrap gap-2 shrink-0">
            {attachedFiles.map((file, idx) => (
              <div key={idx} className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl text-xs font-bold border border-slate-200 shadow-2xs">
                <Paperclip className="w-3 h-3 text-blue-600" />
                <span className="truncate max-w-[150px]">{file.name}</span>
                <button onClick={() => setAttachedFiles(prev => prev.filter((_, i) => i !== idx))} className="hover:text-rose-600 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Selected Tag Badge */}
        {selectedTagCode && (
          <div className="px-4 py-1.5 bg-emerald-50 border-t border-emerald-200 flex items-center justify-between text-xs font-bold text-emerald-800 shrink-0">
            <div className="flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-emerald-600" />
              <span>Thẻ đính kèm: <strong>[{selectedTagCode}]</strong></span>
            </div>
            <button onClick={() => setSelectedTagCode('')} className="hover:text-rose-600 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Input Form Footer */}
        <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-slate-200/80 shrink-0">
          <div className="flex items-center gap-2">
            {/* File Attachment Button */}
            <label className="p-2.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-xl cursor-pointer transition-all shrink-0">
              <Paperclip className="w-4 h-4" />
              <input
                type="file"
                multiple
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>

            {/* Tag entity button */}
            <button
              type="button"
              onClick={() => setShowTagModal(true)}
              className="p-2.5 text-slate-500 hover:text-emerald-600 hover:bg-slate-100 rounded-xl cursor-pointer transition-all shrink-0"
              title="Gắn mã Tour / Booking / DNTT"
            >
              <Tag className="w-4 h-4" />
            </button>

            {/* Main Text Input */}
            <input
              type="text"
              placeholder={
                activeTab === 'channel'
                  ? `Nhập tin nhắn vào #${selectedChannel?.name}...`
                  : `Nhập tin nhắn gửi ${selectedRecipient?.full_name || 'đồng nghiệp'}...`
              }
              value={messageInput}
              onChange={e => setMessageInput(e.target.value)}
              className="flex-1 py-2.5 px-3.5 bg-slate-100 focus:bg-white text-xs font-medium rounded-xl border border-transparent focus:border-blue-500 focus:outline-none transition-all placeholder:text-slate-400"
            />

            {/* Send Button */}
            <button
              type="submit"
              disabled={isUploading || (!messageInput.trim() && attachedFiles.length === 0 && !selectedTagCode)}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 shadow-xs active:scale-95 cursor-pointer shrink-0"
            >
              <span>Gửi</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>

      </div>

      {/* MODAL 1: Create Custom Chat Channel / Group */}
      {showCreateChannelModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]">
            <div className="p-4 bg-gradient-to-r from-blue-600 to-indigo-700 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-200" />
                <h3 className="text-sm font-black">Tạo Nhóm Trò Chuyện Mới</h3>
              </div>
              <button
                onClick={() => setShowCreateChannelModal(false)}
                className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateChannel} className="p-5 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tên nhóm trò chuyện <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Team Châu Âu T8, Nhóm Sale Leader..."
                  value={newChannelName}
                  onChange={e => setNewChannelName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:outline-none transition-all font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mô tả ngắn nhóm
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Trao đổi lịch khởi hành & danh sách khách tour Châu Âu"
                  value={newChannelDesc}
                  onChange={e => setNewChannelDesc(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:outline-none transition-all font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Biểu tượng nhóm</label>
                <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded-xl">
                  {AVAILABLE_ICONS.map(ic => (
                    <button
                      type="button"
                      key={ic}
                      onClick={() => setNewChannelIcon(ic)}
                      className={`w-8 h-8 rounded-lg text-base flex items-center justify-center transition-all cursor-pointer ${
                        newChannelIcon === ic ? 'bg-blue-600 text-white shadow-2xs scale-110' : 'hover:bg-slate-200'
                      }`}
                    >
                      {ic}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Thành viên nhóm ({newChannelMembers.length > 0 ? `${newChannelMembers.length} được chọn` : 'Tất cả thành viên'})
                </label>
                <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl p-2 space-y-1 bg-slate-50">
                  {profilesList.map(p => {
                    const isChecked = newChannelMembers.includes(p.id);
                    return (
                      <label
                        key={p.id}
                        className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all ${
                          isChecked ? 'bg-blue-50 border border-blue-200/80 font-bold' : 'hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center justify-center uppercase">
                            {p.full_name?.substring(0, 2) || 'NV'}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-800">{p.full_name}</div>
                            <div className="text-[10px] text-slate-400">{p.role}</div>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setNewChannelMembers(prev => prev.filter(id => id !== p.id));
                            } else {
                              setNewChannelMembers(prev => [...prev, p.id]);
                            }
                          }}
                          className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateChannelModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isCreatingChannel}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  {isCreatingChannel ? 'Đang tạo...' : 'Tạo nhóm ngay'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Manage Group / Edit Members */}
      {showManageGroupModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-400" />
                <h3 className="text-sm font-black">Quản Lý Nhóm #{selectedChannel.name}</h3>
              </div>
              <button
                onClick={() => setShowManageGroupModal(false)}
                className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Group Basic Info Edit */}
              <div className="space-y-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                  <span>Thông tin cơ bản</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-600 mb-0.5">Tên nhóm</label>
                    <input
                      type="text"
                      value={editingChannelName}
                      onChange={e => setEditingChannelName(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-0.5">Biểu tượng</label>
                    <select
                      value={editingChannelIcon}
                      onChange={e => setEditingChannelIcon(e.target.value)}
                      className="w-full h-9 px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 font-semibold text-slate-800 outline-none transition-all cursor-pointer"
                    >
                      {AVAILABLE_ICONS.map(ic => (
                        <option key={ic} value={ic}>{ic} {ic}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-0.5">Mô tả nhóm</label>
                  <input
                    type="text"
                    value={editingChannelDesc}
                    onChange={e => setEditingChannelDesc(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={handleUpdateGroup}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                  >
                    Lưu thông tin nhóm
                  </button>
                </div>
              </div>

              {/* Members Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <UserPlus className="w-3.5 h-3.5 text-blue-600" />
                    <span>Thành viên nhóm ({currentChannelMembersList.length})</span>
                  </h4>
                </div>

                {/* Add member select box */}
                <div className="flex gap-2">
                  <select
                    value={selectedMemberToAdd}
                    onChange={e => setSelectedMemberToAdd(e.target.value)}
                    className="flex-1 h-9 px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 font-semibold text-slate-800 outline-none cursor-pointer transition-all"
                  >
                    <option value="">-- Chọn đồng nghiệp để thêm vào nhóm --</option>
                    {profilesList
                      .filter(p => !currentChannelMembersList.some(m => m.id === p.id))
                      .map(p => (
                        <option key={p.id} value={p.id}>
                          {p.full_name} ({p.role}) - {p.phone || p.email}
                        </option>
                      ))}
                  </select>
                  <button
                    onClick={() => handleAddMemberToGroup(selectedMemberToAdd)}
                    disabled={!selectedMemberToAdd}
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0"
                  >
                    Thêm vào nhóm
                  </button>
                </div>

                {/* Current Members List */}
                <div className="max-h-52 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-white">
                  {currentChannelMembersList.map(m => (
                    <div key={m.id} className="p-2.5 flex items-center justify-between hover:bg-slate-50 transition-all">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center uppercase">
                          {m.full_name?.substring(0, 2) || 'NV'}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-800">{m.full_name}</div>
                          <div className="text-[10px] text-slate-400">{m.email || m.phone} • <span className="uppercase font-semibold">{m.role}</span></div>
                        </div>
                      </div>

                      {/* Remove member button */}
                      {currentChannelMembersList.length > 1 && (
                        <button
                          onClick={() => handleRemoveMemberFromGroup(m.id)}
                          className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-all cursor-pointer"
                          title="Xóa khỏi nhóm"
                        >
                          <UserMinus className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              {isCurrentChannelCustom ? (
                <button
                  onClick={handleDeleteChannel}
                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa nhóm này</span>
                </button>
              ) : (
                <span className="text-[11px] text-slate-400 font-medium">Kênh phòng ban mặc định</span>
              )}

              <button
                onClick={() => setShowManageGroupModal(false)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Select Entity Tag (Tour / Order / Proposal) */}
      {showTagModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <Tag className="w-4 h-4 text-blue-600" />
                <span>Gắn Thẻ Liên Kết Vào Tin Nhắn</span>
              </h3>
              <button onClick={() => setShowTagModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Selector Tabs */}
            <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
              <button
                onClick={() => setTagType('tour')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  tagType === 'tour' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-500'
                }`}
              >
                Mã Tour
              </button>
              <button
                onClick={() => setTagType('order')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  tagType === 'order' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-500'
                }`}
              >
                Mã Booking
              </button>
              <button
                onClick={() => setTagType('proposal')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  tagType === 'proposal' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-500'
                }`}
              >
                Mã ĐNTT
              </button>
            </div>

            {/* List selector */}
            <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
              {tagType === 'tour' &&
                tours.map(t => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setSelectedTagCode(t.code);
                      setShowTagModal(false);
                    }}
                    className="w-full p-2.5 rounded-xl hover:bg-slate-100 text-left transition-all flex items-center justify-between cursor-pointer border border-transparent hover:border-slate-200"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-800 font-mono">[{t.code}]</div>
                      <div className="text-[11px] text-slate-500 truncate">{t.name}</div>
                    </div>
                    <span className="text-[10px] font-bold text-blue-600">Chọn</span>
                  </button>
                ))}

              {tagType === 'order' &&
                orders.map(o => (
                  <button
                    key={o.id}
                    onClick={() => {
                      setSelectedTagCode(o.id.substring(0, 8).toUpperCase());
                      setShowTagModal(false);
                    }}
                    className="w-full p-2.5 rounded-xl hover:bg-slate-100 text-left transition-all flex items-center justify-between cursor-pointer border border-transparent hover:border-slate-200"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-800 font-mono">#{o.id.substring(0, 8).toUpperCase()}</div>
                      <div className="text-[11px] text-slate-500 truncate">{o.customer_name} - {o.customer_phone}</div>
                    </div>
                    <span className="text-[10px] font-bold text-blue-600">Chọn</span>
                  </button>
                ))}

              {tagType === 'proposal' &&
                paymentProposals.map(p => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelectedTagCode(p.code);
                      setShowTagModal(false);
                    }}
                    className="w-full p-2.5 rounded-xl hover:bg-slate-100 text-left transition-all flex items-center justify-between cursor-pointer border border-transparent hover:border-slate-200"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-800 font-mono">[{p.code}]</div>
                      <div className="text-[11px] text-slate-500 truncate">{p.title}</div>
                    </div>
                    <span className="text-[10px] font-bold text-blue-600">Chọn</span>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
