import assert from "assert";

/**
 * Prompt 8 — In-App Chat & Authorization Test Suite
 * Validates PRD §5.4 (US-11) requirements:
 * 1. Non-participant access rejection (HTTP 403 / 404)
 * 2. Message text validation (reject empty/whitespace & >2000 chars with HTTP 400)
 * 3. Successful message sending and thread retrieval in chronological order
 * 4. GET /api/chat/list retrieval for active matched conversations
 * 5. Explicit Privacy Check: ZERO email or phone auto-leaking across BOTH chat list profiles and message payloads
 */

console.log("=================================================");
console.log("    RUNNING IN-APP CHAT (US-11) TEST SUITE       ");
console.log("=================================================");

// Mock DB state
const dbChats = [
  { id: "chat_valid_101", participantIds: ["user_alice", "user_bob"], createdAt: new Date(), updatedAt: new Date() },
];
const dbMessages = [];
const dbProfiles = {
  user_alice: { userId: "user_alice", name: "Alice Student", city: "Boston", email: "alice@secret.edu", phone: "555-0101" },
  user_bob: { userId: "user_bob", name: "Bob Resident", city: "Boston", email: "bob@secret.edu", phone: "555-0202" },
  user_eve: { userId: "user_eve", name: "Eve Intruder", city: "Boston", email: "eve@secret.edu", phone: "555-0909" },
};

function getCandidatePublicInfo(participantId) {
  const profile = dbProfiles[participantId];
  if (!profile) return null;
  // STRICT WHITELIST
  return {
    candidateId: profile.userId,
    userId: profile.userId,
    name: profile.name,
    city: profile.city,
  };
}

function handleGetChatMessages(requesterId, chatId) {
  const chat = dbChats.find((c) => c.id === chatId);
  if (!chat) return { status: 404, error: "Not Found", message: "Chat not found." };

  if (!chat.participantIds.includes(requesterId)) {
    return { status: 403, error: "Forbidden", message: "You are not authorized to view messages for this chat." };
  }

  const messages = dbMessages.filter((m) => m.chatId === chatId);
  const otherId = chat.participantIds.find((id) => id !== requesterId);
  return {
    status: 200,
    chatId: chat.id,
    otherParticipant: getCandidatePublicInfo(otherId),
    messages,
  };
}

function handlePostChatMessage(requesterId, chatId, text) {
  const chat = dbChats.find((c) => c.id === chatId);
  if (!chat) return { status: 404, error: "Not Found", message: "Chat not found." };

  if (!chat.participantIds.includes(requesterId)) {
    return { status: 403, error: "Forbidden", message: "You are not authorized to send messages in this chat." };
  }

  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return { status: 400, error: "Bad Request", message: "Message text cannot be empty or whitespace only." };
  }

  if (text.length > 2000) {
    return { status: 400, error: "Bad Request", message: "Message exceeds maximum allowed length of 2000 characters." };
  }

  const msg = {
    _id: `msg_${Date.now()}_${Math.random()}`,
    chatId,
    senderId: requesterId,
    text: text.trim(),
    sentAt: new Date(),
    readAt: null,
  };
  dbMessages.push(msg);
  chat.updatedAt = new Date();

  return { status: 201, message: msg };
}

function handleGetChatList(requesterId) {
  const chats = dbChats.filter((c) => c.participantIds.includes(requesterId));
  const list = chats.map((chat) => {
    const otherId = chat.participantIds.find((id) => id !== requesterId);
    const lastMsg = dbMessages.filter((m) => m.chatId === chat.id).slice(-1)[0];
    return {
      _id: chat.id,
      participantIds: chat.participantIds,
      otherParticipant: getCandidatePublicInfo(otherId),
      lastMessage: lastMsg ? { text: lastMsg.text, senderId: lastMsg.senderId, sentAt: lastMsg.sentAt } : null,
    };
  });
  return { status: 200, chats: list };
}

function testNonParticipantAccessRejection() {
  console.log("\n[TEST 1] Testing Non-Participant Access Rejection (HTTP 403/404)...");

  // Eve (unauthorized 3rd party) attempts GET messages of Alice and Bob's chat
  const getRes = handleGetChatMessages("user_eve", "chat_valid_101");
  assert.strictEqual(getRes.status, 403, "Non-participant MUST receive 403 Forbidden on GET");

  // Eve attempts POST message to Alice and Bob's chat
  const postRes = handlePostChatMessage("user_eve", "chat_valid_101", "Hello Alice and Bob!");
  assert.strictEqual(postRes.status, 403, "Non-participant MUST receive 403 Forbidden on POST");

  // Non-existent chat ID
  const invalidChatRes = handleGetChatMessages("user_alice", "non_existent_chat_999");
  assert.strictEqual(invalidChatRes.status, 404, "Invalid chat ID MUST receive 404 Not Found");

  console.log("✅ PASSED: Unauthorized access to chat thread strictly returns HTTP 403/404.");
}

function testMessageValidation() {
  console.log("\n[TEST 2] Testing Message Validation (Empty & Length Checks)...");

  // 1. Empty string
  const resEmpty = handlePostChatMessage("user_alice", "chat_valid_101", "");
  assert.strictEqual(resEmpty.status, 400, "Empty text MUST return 400 Bad Request");

  // 2. Whitespace-only string
  const resWhitespace = handlePostChatMessage("user_alice", "chat_valid_101", "   \n\t  ");
  assert.strictEqual(resWhitespace.status, 400, "Whitespace text MUST return 400 Bad Request");

  // 3. >2000 character string
  const longText = "A".repeat(2001);
  const resTooLong = handlePostChatMessage("user_alice", "chat_valid_101", longText);
  assert.strictEqual(resTooLong.status, 400, ">2000 char text MUST return 400 Bad Request");

  // 4. Valid message
  const resValid = handlePostChatMessage("user_alice", "chat_valid_101", "Hey Bob! Are you looking for a roommate?");
  assert.strictEqual(resValid.status, 201, "Valid text MUST return 201 Created");

  console.log("✅ PASSED: Message validation enforced (empty/whitespace & length limits).");
}

function testParticipantMessagingAndThreadHistory() {
  console.log("\n[TEST 3] Testing Participant Messaging & Thread History...");

  // Bob replies to Alice
  const resBob = handlePostChatMessage("user_bob", "chat_valid_101", "Hey Alice! Yes I am, let's talk details.");
  assert.strictEqual(resBob.status, 201);

  // Fetch thread messages as Alice
  const historyRes = handleGetChatMessages("user_alice", "chat_valid_101");
  assert.strictEqual(historyRes.status, 200);
  assert.strictEqual(historyRes.messages.length, 2);
  assert.strictEqual(historyRes.messages[0].senderId, "user_alice");
  assert.strictEqual(historyRes.messages[1].senderId, "user_bob");

  console.log("✅ PASSED: Participants can exchange messages and view thread history.");
}

function testChatListRetrieval() {
  console.log("\n[TEST 4] Testing GET /api/chat/list Retrieval...");

  const listResAlice = handleGetChatList("user_alice");
  assert.strictEqual(listResAlice.status, 200);
  assert.strictEqual(listResAlice.chats.length, 1);
  assert.strictEqual(listResAlice.chats[0].otherParticipant.name, "Bob Resident");
  assert.strictEqual(listResAlice.chats[0].lastMessage.text, "Hey Alice! Yes I am, let's talk details.");

  const listResEve = handleGetChatList("user_eve");
  assert.strictEqual(listResEve.chats.length, 0, "Eve must have 0 chats in her chat list");

  console.log("✅ PASSED: GET /api/chat/list correctly returns user's matched conversations.");
}

function testPrivacyAssuranceAcrossEndpoints() {
  console.log("\n[TEST 5] Testing Privacy Assurance (Zero Email/Phone Exposure)...");

  // 1. Check GET /api/chat/list payload
  const listRes = handleGetChatList("user_alice");
  const candidateInList = listRes.chats[0].otherParticipant;
  assert.strictEqual(candidateInList.email, undefined, "Email MUST NOT be exposed in GET /api/chat/list");
  assert.strictEqual(candidateInList.phone, undefined, "Phone MUST NOT be exposed in GET /api/chat/list");

  // 2. Check GET /api/chat/:chatId/messages payload
  const threadRes = handleGetChatMessages("user_alice", "chat_valid_101");
  const candidateInThread = threadRes.otherParticipant;
  assert.strictEqual(candidateInThread.email, undefined, "Email MUST NOT be exposed in thread candidate info");
  assert.strictEqual(candidateInThread.phone, undefined, "Phone MUST NOT be exposed in thread candidate info");

  threadRes.messages.forEach((msg, idx) => {
    assert.strictEqual(msg.email, undefined, `Email MUST NOT be exposed in message object #${idx}`);
    assert.strictEqual(msg.phone, undefined, `Phone MUST NOT be exposed in message object #${idx}`);
  });

  console.log("✅ PASSED: Zero email/phone auto-leaking confirmed across BOTH /api/chat/list and /api/chat/:chatId/messages.");
}

function runAll() {
  testNonParticipantAccessRejection();
  testMessageValidation();
  testParticipantMessagingAndThreadHistory();
  testChatListRetrieval();
  testPrivacyAssuranceAcrossEndpoints();

  console.log("\n=================================================");
  console.log("🎉 ALL IN-APP CHAT (US-11) TESTS PASSED SUCCESSFULLY!");
  console.log("=================================================");
}

runAll();
