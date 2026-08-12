import React, { useState, useEffect, useRef } from 'react';
import { useCRM } from '@/context/CRMContext';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  MessageSquare,
  X,
  Send,
  Paperclip,
  Maximize2,
  Minimize2,
  Hash,
  User as UserIcon,
  Search,
  ChevronRight
} from 'lucide-react';
import { formatDateTimeVi } from '@/lib/utils';
import { uploadFileToCRM } from '@/lib/supabase';

export function FloatingChatDrawer() {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const {
    profilesList = [],
    chatMessages = [],
    sendChatMessage,
    chatChannels = []
  } = useCRM();

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'channel' | 'direct'>('channel');
  const [selectedChannelId, setSelectedChannelId] = useState<string>('chung');
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | null>(null);

  const [messageInput, setMessageInput] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<{ url: string; name: string; type: 'image' | 'file' }[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  const currentUserName = profile?.full_name || user?.email?.split('@')[0] || 'Nhân viên';
  const currentUserRole = profile?.role || 'sale';
  const currentUserId = profile?.id || user?.id || 'guest';

  useEffect(() => {
    if (isOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isOpen, selectedChannelId, selectedRecipientId]);

  // Current active messages
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
      console.error('File upload error:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() && attachedFiles.length === 0) return;

    const payload: any = {
      sender_id: currentUserId,
      sender_name: currentUserName,
      sender_role: currentUserRole,
      content: messageInput.trim(),
      attachments: attachedFiles.length > 0 ? attachedFiles : undefined,
    };

    if (activeTab === 'channel') {
      payload.channel_id = selectedChannelId;
    } else if (selectedRecipientId) {
      payload.recipient_id = selectedRecipientId;
    }

    await sendChatMessage(payload);

    setMessageInput('');
    setAttachedFiles([]);
  };

  return (
    <>
      {/* Floating Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-20 z-40 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-xl flex items-center gap-2 font-bold text-xs transition-all hover:scale-105 active:scale-95 cursor-pointer border-2 border-white"
        >
          <div className="relative">
            <MessageSquare className="w-4 h-4" />
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
          </div>
          <span>Chat Nội Bộ</span>
        </button>
      )}

      {/* Floating Drawer */}
      {isOpen && (
        <div className="fixed bottom-4 right-4 z-50 w-96 h-[520px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200">
          
          {/* Header */}
          <div className="p-3 bg-slate-900 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold">
                <MessageSquare className="w-3.5 h-3.5" />
              </div>
              <div>
                <h4 className="text-xs font-black tracking-tight">Trò Chuyện CRM</h4>
                <p className="text-[10px] text-slate-300 font-medium">Nội bộ AD Luxury</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  setIsOpen(false);
                  navigate('/chat');
                }}
                className="p-1 hover:bg-slate-800 rounded text-slate-300 hover:text-white cursor-pointer"
                title="Mở toàn màn hình"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-slate-800 rounded text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Sub Navigation (Channels Quick Select) */}
          <div className="flex overflow-x-auto p-1.5 bg-slate-100 border-b border-slate-200 gap-1 shrink-0 no-scrollbar">
            {chatChannels.map(ch => (
              <button
                key={ch.id}
                onClick={() => {
                  setActiveTab('channel');
                  setSelectedChannelId(ch.id);
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 ${
                  activeTab === 'channel' && selectedChannelId === ch.id
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-white text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>{ch.icon || '💬'}</span>
                <span>#{ch.name}</span>
              </button>
            ))}
          </div>

          {/* Message Stream */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-slate-50/50">
            {currentMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-400">
                <p className="text-xs font-bold text-slate-600">Chưa có tin nhắn trong nhóm</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Nhập câu hỏi hoặc thông báo bên dưới</p>
              </div>
            ) : (
              currentMessages.map(msg => {
                const isMe = msg.sender_id === currentUserId;
                return (
                  <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-[10px] shrink-0 uppercase border border-slate-300">
                      {msg.sender_name ? msg.sender_name.substring(0, 2) : 'NV'}
                    </div>

                    <div className={`max-w-[80%] space-y-0.5 ${isMe ? 'text-right' : 'text-left'}`}>
                      <div className="text-[9px] text-slate-400 font-medium">
                        <span className="font-bold text-slate-700">{msg.sender_name}</span> • {formatDateTimeVi(msg.created_at)}
                      </div>

                      <div
                        className={`p-2.5 rounded-xl text-xs font-medium leading-normal ${
                          isMe ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'
                        }`}
                      >
                        {msg.content}

                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="mt-1 space-y-1">
                            {msg.attachments.map((a, i) => (
                              <a
                                key={i}
                                href={a.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block text-[11px] underline opacity-90 truncate"
                              >
                                📎 {a.name}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Form Input */}
          <form onSubmit={handleSendMessage} className="p-2 bg-white border-t border-slate-200 shrink-0">
            <div className="flex items-center gap-1.5">
              <label className="p-2 text-slate-400 hover:text-blue-600 rounded-lg cursor-pointer">
                <Paperclip className="w-3.5 h-3.5" />
                <input type="file" multiple onChange={handleFileUpload} className="hidden" />
              </label>

              <input
                type="text"
                placeholder="Nhập tin nhắn..."
                value={messageInput}
                onChange={e => setMessageInput(e.target.value)}
                className="flex-1 py-1.5 px-3 bg-slate-100 text-xs rounded-xl border border-transparent focus:bg-white focus:border-blue-500 focus:outline-none transition-all placeholder:text-slate-400"
              />

              <button
                type="submit"
                disabled={isUploading || (!messageInput.trim() && attachedFiles.length === 0)}
                className="p-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white rounded-xl transition-all cursor-pointer shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>

        </div>
      )}
    </>
  );
}
