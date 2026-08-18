import { useState, useEffect, useRef } from "react";

export function ChatView({ user, initialChatId = null, onBackToMatching }) {
  const [chatList, setChatList] = useState([]);
  const [activeChatId, setActiveChatId] = useState(initialChatId);
  const [activeChatData, setActiveChatData] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [errorAlert, setErrorAlert] = useState(null);

  const messagesEndRef = useRef(null);

  const currentUserId = String(user?.id);

  // Scroll to bottom of message thread
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // 1. Fetch active matched chats list
  const fetchChatList = async (showLoading = false) => {
    if (showLoading) setLoadingList(true);
    try {
      const res = await fetch("/api/chat/list");
      if (res.ok) {
        const data = await res.json();
        const chats = data.chats || [];
        setChatList(chats);

        // Auto-select first chat if no activeChatId is set and chats exist
        if (!activeChatId && chats.length > 0 && !initialChatId) {
          setActiveChatId(chats[0]._id);
        }
      }
    } catch (err) {
      console.error("[ChatView] Error fetching chat list:", err);
    } finally {
      if (showLoading) setLoadingList(false);
    }
  };

  // 2. Fetch messages for active chat thread
  const fetchMessages = async (chatId, isPolling = false) => {
    if (!chatId) return;
    if (!isPolling) setLoadingMessages(true);
    try {
      const res = await fetch(`/api/chat/${chatId}/messages`);
      const data = await res.json();

      if (res.ok) {
        setMessages(data.messages || []);
        setActiveChatData(data.otherParticipant);
        setErrorAlert(null);
      } else {
        setErrorAlert(data.message || "Failed to load chat thread.");
      }
    } catch (err) {
      console.error("[ChatView] Error fetching messages:", err);
    } finally {
      if (!isPolling) setLoadingMessages(false);
    }
  };

  // Initial load of chat list
  useEffect(() => {
    fetchChatList(true);
  }, []);

  // Set initial chat ID if provided as prop
  useEffect(() => {
    if (initialChatId) {
      setActiveChatId(initialChatId);
    }
  }, [initialChatId]);

  // Load messages whenever activeChatId changes
  useEffect(() => {
    if (activeChatId) {
      fetchMessages(activeChatId, false);
    } else {
      setMessages([]);
      setActiveChatData(null);
    }
  }, [activeChatId]);

  // Scroll to bottom when messages update
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 3. Polling for near-real-time updates while a chat is open (PRD US-11 requirement #2)
  useEffect(() => {
    if (!activeChatId) return;

    // Poll active chat thread every 3 seconds
    const messageInterval = setInterval(() => {
      fetchMessages(activeChatId, true);
    }, 3000);

    // Poll chat list every 8 seconds for list activity & unread status
    const listInterval = setInterval(() => {
      fetchChatList(false);
    }, 8000);

    return () => {
      clearInterval(messageInterval);
      clearInterval(listInterval);
    };
  }, [activeChatId]);

  // Handle message sending
  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    const trimmed = inputText.trim();

    if (!trimmed) {
      setErrorAlert("Message text cannot be empty or whitespace only.");
      return;
    }

    if (trimmed.length > 2000) {
      setErrorAlert(`Message exceeds max limit of 2000 characters (${trimmed.length} chars).`);
      return;
    }

    setSendingMessage(true);
    setErrorAlert(null);

    try {
      const res = await fetch(`/api/chat/${activeChatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });

      const data = await res.json();

      if (res.ok) {
        setInputText("");
        // Append new message locally immediately
        setMessages((prev) => [...prev, data.message]);
        // Refresh chat list to update last message preview
        fetchChatList(false);
      } else {
        setErrorAlert(data.message || "Failed to send message.");
      }
    } catch (err) {
      setErrorAlert("Network error sending message.");
    } finally {
      setSendingMessage(false);
    }
  };

  const formatTimestamp = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const activeChatObj = chatList.find((c) => c._id === activeChatId);
  const otherParticipant = activeChatData || activeChatObj?.otherParticipant;

  return (
    <div style={{ maxWidth: "850px", margin: "1rem auto", textAlign: "left" }}>
      {/* Header Bar */}
      <div
        className="card"
        style={{
          display: "flex",
          justify: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
          padding: "0.85rem 1.25rem",
        }}
      >
        <div>
          <h3 style={{ margin: 0, color: "#f8fafc" }}>💬 Active Matched Chats</h3>
          <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
            Near-Real-Time In-App Messaging • PRD §5.4 (US-11)
          </span>
        </div>
        {onBackToMatching && (
          <button onClick={onBackToMatching} style={{ fontSize: "0.85rem", padding: "0.4rem 0.8rem" }}>
            ← Back to Matching
          </button>
        )}
      </div>

      {errorAlert && (
        <div className="error-alert" style={{ marginBottom: "1rem", display: "flex", justifyContent: "space-between" }}>
          <span>{errorAlert}</span>
          <button
            onClick={() => setErrorAlert(null)}
            style={{ background: "transparent", border: "none", color: "#ef4444", fontWeight: "bold", cursor: "pointer" }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Grid Container: Chat List (Left) + Message Thread (Right) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: chatList.length > 0 ? "260px 1fr" : "1fr",
          gap: "1rem",
          minHeight: "520px",
        }}
      >
        {/* Chat List Sidebar */}
        <div
          className="card"
          style={{
            padding: "0.75rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
            backgroundColor: "#0f172a",
            borderRight: "1px solid #334155",
            borderRadius: "12px",
          }}
        >
          <div style={{ fontWeight: "bold", color: "#94a3b8", fontSize: "0.85rem", marginBottom: "0.4rem" }}>
            CONVERSATIONS ({chatList.length})
          </div>

          {loadingList ? (
            <div style={{ color: "#94a3b8", fontSize: "0.85rem", padding: "1rem 0" }}>
              Loading matched chats...
            </div>
          ) : chatList.length === 0 ? (
            <div style={{ color: "#94a3b8", fontSize: "0.85rem", padding: "1.5rem 0.5rem", textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: "1.5rem" }}>💬</p>
              <p style={{ margin: "0.5rem 0", fontWeight: "600" }}>No active chats yet</p>
              <p style={{ fontSize: "0.75rem", color: "#64748b", margin: 0 }}>
                When you and another candidate express mutual interest, your private chat will unlock here automatically!
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", overflowY: "auto" }}>
              {chatList.map((chat) => {
                const isSelected = chat._id === activeChatId;
                const candidate = chat.otherParticipant || {};
                const lastMsg = chat.lastMessage;

                return (
                  <div
                    key={chat._id}
                    onClick={() => setActiveChatId(chat._id)}
                    style={{
                      padding: "0.65rem 0.85rem",
                      borderRadius: "8px",
                      cursor: "pointer",
                      backgroundColor: isSelected ? "#1e293b" : "transparent",
                      border: isSelected ? "1px solid #38bdf8" : "1px solid transparent",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: "bold", fontSize: "0.9rem", color: isSelected ? "#38bdf8" : "#f8fafc" }}>
                        {candidate.name || "Matched User"}
                      </span>
                      {chat.unreadCount > 0 && (
                        <span className="badge badge-success" style={{ fontSize: "0.7rem", padding: "1px 6px" }}>
                          {chat.unreadCount} new
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: "0.75rem", color: "#a5b4fc", marginTop: "2px", textTransform: "capitalize" }}>
                      {candidate.role || "User"} • {candidate.city || "Launch City"}
                    </div>

                    {lastMsg && (
                      <div
                        style={{
                          fontSize: "0.75rem",
                          color: "#94a3b8",
                          marginTop: "4px",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {lastMsg.senderId === currentUserId ? "You: " : ""}{lastMsg.text}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Message Thread View */}
        <div
          className="card"
          style={{
            display: "flex",
            flexDirection: "column",
            justify: "space-between",
            padding: 0,
            borderRadius: "12px",
            overflow: "hidden",
            backgroundColor: "#0f172a",
          }}
        >
          {activeChatId && otherParticipant ? (
            <>
              {/* Thread Top Bar */}
              <div
                style={{
                  padding: "0.85rem 1.25rem",
                  backgroundColor: "#1e293b",
                  borderBottom: "1px solid #334155",
                  display: "flex",
                  justify: "space-between",
                  alignItems: "center",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  {otherParticipant.photoUrl ? (
                    <img
                      src={otherParticipant.photoUrl}
                      alt={otherParticipant.name}
                      style={{ width: "40px", height: "40px", borderRadius: "50%", objectFit: "cover" }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "40px",
                        height: "40px",
                        borderRadius: "50%",
                        background: "#3b82f6",
                        display: "flex",
                        alignItems: "center",
                        justify: "center",
                        fontWeight: "bold",
                        color: "#fff",
                      }}
                    >
                      {(otherParticipant.name || "RM").charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div>
                    <h4 style={{ margin: 0, color: "#f8fafc", fontSize: "1.05rem" }}>
                      {otherParticipant.name || "Matched Candidate"}
                    </h4>
                    <span style={{ fontSize: "0.75rem", color: "#38bdf8", textTransform: "capitalize" }}>
                      {otherParticipant.role} • 📍 {otherParticipant.locality ? `${otherParticipant.locality}, ` : ""}{otherParticipant.city || "Launch City"}
                    </span>
                  </div>
                </div>

                <div style={{ fontSize: "0.75rem", color: "#22c55e", fontWeight: "600" }}>
                  ● Matched & Active
                </div>
              </div>

              {/* Privacy Notice Banner */}
              <div
                style={{
                  backgroundColor: "#0284c715",
                  borderBottom: "1px solid #0284c730",
                  padding: "0.4rem 1rem",
                  fontSize: "0.75rem",
                  color: "#38bdf8",
                  textAlign: "center",
                }}
              >
                🔒 Contact info is never auto-shared. You can voluntarily share contact details inside messages if you choose.
              </div>

              {/* Messages Container */}
              <div
                style={{
                  flex: 1,
                  padding: "1rem",
                  overflowY: "auto",
                  maxHeight: "360px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                }}
              >
                {loadingMessages ? (
                  <div style={{ color: "#94a3b8", fontSize: "0.85rem", textAlign: "center", margin: "auto" }}>
                    Loading message history...
                  </div>
                ) : messages.length === 0 ? (
                  <div style={{ color: "#94a3b8", fontSize: "0.85rem", textAlign: "center", margin: "auto" }}>
                    👋 Say hi to {otherParticipant.name}! Start the conversation below.
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMe = String(msg.senderId) === currentUserId;
                    return (
                      <div
                        key={msg._id}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: isMe ? "flex-end" : "flex-start",
                        }}
                      >
                        <div
                          style={{
                            maxWidth: "75%",
                            padding: "0.65rem 0.95rem",
                            borderRadius: isMe ? "14px 14px 2px 14px" : "14px 14px 14px 2px",
                            backgroundColor: isMe ? "#2563eb" : "#1e293b",
                            color: "#f8fafc",
                            fontSize: "0.9rem",
                            lineHeight: "1.4",
                            wordBreak: "break-word",
                            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                          }}
                        >
                          {msg.text}
                        </div>
                        <div
                          style={{
                            fontSize: "0.7rem",
                            color: "#64748b",
                            marginTop: "3px",
                            padding: "0 4px",
                          }}
                        >
                          {isMe ? "You • " : `${otherParticipant.name} • `}
                          {formatTimestamp(msg.sentAt)}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Text Input Form */}
              <form
                onSubmit={handleSendMessage}
                style={{
                  padding: "0.75rem 1rem",
                  backgroundColor: "#1e293b",
                  borderTop: "1px solid #334155",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.4rem",
                }}
              >
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <input
                    type="text"
                    placeholder="Type your message..."
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    maxLength={2000}
                    disabled={sendingMessage}
                    style={{
                      flex: 1,
                      padding: "0.6rem 0.85rem",
                      borderRadius: "8px",
                      border: "1px solid #334155",
                      backgroundColor: "#0f172a",
                      color: "#f8fafc",
                      fontSize: "0.9rem",
                    }}
                  />
                  <button
                    type="submit"
                    disabled={sendingMessage || !inputText.trim()}
                    style={{
                      padding: "0.6rem 1.25rem",
                      backgroundColor: "#2563eb",
                      fontWeight: "bold",
                      borderRadius: "8px",
                    }}
                  >
                    {sendingMessage ? "Sending..." : "Send 📤"}
                  </button>
                </div>

                <div
                  style={{
                    display: "flex",
                    justify: "space-between",
                    fontSize: "0.7rem",
                    color: inputText.length > 1800 ? "#f59e0b" : "#64748b",
                    padding: "0 2px",
                  }}
                >
                  <span>Press Enter to send</span>
                  <span>{inputText.length} / 2000 characters</span>
                </div>
              </form>
            </>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                padding: "2rem",
                color: "#94a3b8",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>💬</div>
              <h4>Select a Matched Conversation</h4>
              <p style={{ fontSize: "0.85rem", maxWidth: "320px", color: "#64748b" }}>
                Choose a matched chat from the left panel to view messages or start chatting.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
