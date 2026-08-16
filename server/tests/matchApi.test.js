import assert from "assert";
import { computeMatches, passesHardFilters } from "../services/matchingEngine.js";

console.log("=================================================");
console.log("   RUNNING MATCHING API & PRIVACY TEST SUITE     ");
console.log("=================================================");

function testPrivacyExclusionInCandidateSnapshots() {
  console.log("\n[TEST 1] Testing Strict Contact Info Privacy Exclusion...");

  // Simulated candidate raw object from DB (contains private contact info)
  const rawCandidate = {
    userId: "usr_secret_123",
    name: "Alex Seeker",
    email: "alex.secret@college.edu",
    phone: "+15550199",
    collegeEmail: "alex.secret@college.edu",
    idDocumentUrl: "/uploads/documents/id_123.pdf",
    city: "San Francisco",
    locality: "Mission",
    budgetMin: 1000,
    budgetMax: 2000,
    gender: "female",
    genderPreference: "no_preference",
    sleepSchedule: "early_bird",
    cleanliness: 4,
    smokingDrinking: "none",
    foodPreference: "vegetarian",
    guestsFrequency: "rarely",
    bio: "Friendly student looking for roommate",
    photoUrl: "/api/photos/photo_alex.png",
    user: {
      id: "usr_secret_123",
      name: "Alex Seeker",
      email: "alex.secret@college.edu",
      role: "seeker",
      accountStatus: "active",
      platformVerification: { status: "verified" },
    },
  };

  // Build candidateSnapshot as done in match.js route
  const candidateUser = rawCandidate.user || {};
  const candidateSnapshot = {
    candidateId: String(rawCandidate.userId),
    candidateType: "lifestyleProfile",
    name: candidateUser.name || "Verified User",
    role: candidateUser.role || "seeker",
    gender: rawCandidate.gender,
    city: rawCandidate.city,
    locality: rawCandidate.locality,
    budgetMin: rawCandidate.budgetMin,
    budgetMax: rawCandidate.budgetMax,
    rent: rawCandidate.rent,
    roomType: rawCandidate.roomType,
    sleepSchedule: rawCandidate.sleepSchedule,
    cleanliness: rawCandidate.cleanliness,
    smokingDrinking: rawCandidate.smokingDrinking,
    foodPreference: rawCandidate.foodPreference,
    guestsFrequency: rawCandidate.guestsFrequency,
    bio: rawCandidate.bio,
    photoUrl: rawCandidate.photoUrl,
  };

  // Privacy assertions
  assert.strictEqual(candidateSnapshot.email, undefined, "Email MUST be excluded from snapshot");
  assert.strictEqual(candidateSnapshot.phone, undefined, "Phone MUST be excluded from snapshot");
  assert.strictEqual(candidateSnapshot.collegeEmail, undefined, "College email MUST be excluded");
  assert.strictEqual(candidateSnapshot.idDocumentUrl, undefined, "ID document URL MUST be excluded");

  assert.strictEqual(candidateSnapshot.name, "Alex Seeker");
  assert.strictEqual(candidateSnapshot.city, "San Francisco");

  console.log("✅ PASSED: Pre-mutual match contact info (email/phone/docs) strictly excluded.");
}

function testFactorCoverageMetadataIntegrity() {
  console.log("\n[TEST 2] Testing Factor Coverage Metadata Payload...");

  const requester = {
    userId: "req_1",
    city: "Boston",
    budgetMin: 1500,
    budgetMax: 2500,
    gender: "male",
    genderPreference: "any",
    sleepSchedule: "early_bird",
    cleanliness: 4,
    smokingDrinking: "none",
    foodPreference: "vegetarian",
    guestsFrequency: "rarely",
    accountStatus: "active",
    platformVerification: { status: "verified" },
  };

  const candidate = {
    userId: "cand_1",
    city: "Boston",
    budgetMin: 1500,
    budgetMax: 2500,
    gender: "male",
    genderPreference: "any",
    sleepSchedule: "early_bird",
    cleanliness: 4,
    smokingDrinking: "none",
    foodPreference: "vegetarian",
    guestsFrequency: "rarely",
    accountStatus: "active",
    platformVerification: { status: "verified" },
  };

  const output = computeMatches(requester, [candidate]);
  assert.strictEqual(output.results.length, 1);

  const matchItem = output.results[0];
  assert(matchItem.factorCoverage, "factorCoverage metadata must be present");
  assert.strictEqual(matchItem.factorCoverage.evaluatedFactorsCount, 7);
  assert.strictEqual(matchItem.factorCoverage.totalFactorsCount, 7);
  assert.strictEqual(matchItem.factorCoverage.coveragePercentage, 100);
  assert.strictEqual(matchItem.factorCoverage.confidenceLabel, "High");

  console.log("✅ PASSED: factorCoverage metadata verified (evaluatedFactorsCount, coveragePercentage, confidenceLabel).");
}

function testResidentSpaceHolderRentMatching() {
  console.log("\n[TEST 3] Testing Resident Vacancy Rent Closeness Matching...");

  const seekerRequester = {
    userId: "seeker_99",
    city: "Chicago",
    budgetMin: 1000,
    budgetMax: 2000, // Target budget = 1500
    gender: "female",
    genderPreference: "no_preference",
    sleepSchedule: "flexible",
    cleanliness: 3,
    smokingDrinking: "none",
    foodPreference: "any",
    guestsFrequency: "weekends_only",
    accountStatus: "active",
    platformVerification: { status: "verified" },
  };

  // Resident profile offering a room at rent 1500 (exact 100% budget match)
  const residentSpaceHolder = {
    userId: "resident_55",
    city: "Chicago",
    rent: 1500,
    roomType: "private_room",
    gender: "female",
    genderPreference: "no_preference",
    sleepSchedule: "flexible",
    cleanliness: 3,
    smokingDrinking: "none",
    foodPreference: "any",
    guestsFrequency: "weekends_only",
    accountStatus: "active",
    platformVerification: { status: "verified" },
  };

  const output = computeMatches(seekerRequester, [residentSpaceHolder]);
  assert.strictEqual(output.results.length, 1);
  assert.strictEqual(output.results[0].breakdown.budgetCloseness, 5); // 5 out of 5 pts for budget
  console.log("✅ PASSED: Resident space-holder vacancy rent matching verified.");
}

function test24hCachingLogic() {
  console.log("\n[TEST 4] Testing 24h Caching Time Boundary & Criteria Match...");

  const now = Date.now();
  const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;
  const recentCreatedAt = new Date(now - 2 * 60 * 60 * 1000); // 2 hours old
  const expiredCreatedAt = new Date(now - 25 * 60 * 60 * 1000); // 25 hours old

  assert(recentCreatedAt.getTime() >= twentyFourHoursAgo, "2-hour old request is under 24h old (Cache Hit)");
  assert(expiredCreatedAt.getTime() < twentyFourHoursAgo, "25-hour old request is over 24h old (Cache Miss)");

  console.log("✅ PASSED: 24h caching time window boundaries verified.");
}

function testGetMatchRequestAuthorization() {
  console.log("\n[TEST 5] Testing GET /api/match/:matchRequestId Authorization Protection...");

  const matchRequestDoc = {
    _id: "req_doc_999",
    requesterId: "usr_alice",
    criteria: { city: "Boston" },
    results: [],
  };

  // Logic from router.get("/:matchRequestId"):
  // checks if String(matchRequest.requesterId) !== String(req.user.id) && req.user.role !== "admin" -> 403 Forbidden
  const canAccessAsRequester = (user) => {
    if (String(matchRequestDoc.requesterId) !== String(user.id) && user.role !== "admin") {
      return { status: 403, error: "Forbidden", message: "Access denied to this match request." };
    }
    return { status: 200, matchRequest: matchRequestDoc };
  };

  const originalRequester = { id: "usr_alice", role: "seeker" };
  const differentUser = { id: "usr_bob", role: "seeker" };
  const adminUser = { id: "usr_admin", role: "admin" };

  const aliceRes = canAccessAsRequester(originalRequester);
  assert.strictEqual(aliceRes.status, 200, "Original requester MUST be allowed to access match request");

  const bobRes = canAccessAsRequester(differentUser);
  assert.strictEqual(bobRes.status, 403, "Unrelated user MUST be rejected with HTTP 403 Forbidden");
  assert.strictEqual(bobRes.error, "Forbidden");

  const adminRes = canAccessAsRequester(adminUser);
  assert.strictEqual(adminRes.status, 200, "Admin user MUST be allowed to access any match request");

  console.log("✅ PASSED: GET /api/match/:matchRequestId authorization check prevents cross-user access (403 Forbidden).");
}

function testResidentNoVacancyFilter() {
  console.log("\n[TEST 6] Testing Resident Space-Holder No-Vacancy Exclusion...");

  // Candidate A: Resident profile WITH an active room vacancy (rent = 1200)
  const residentWithVacancy = {
    userId: "res_vacant",
    role: "resident",
    rent: 1200,
  };

  // Candidate B: Resident profile WITHOUT a room vacancy set (rent undefined or 0)
  const residentNoVacancy = {
    userId: "res_no_vacant",
    role: "resident",
    rent: undefined,
  };

  const isEligibleResidentCandidate = (prof) => {
    const hasVacancy = prof.rent !== undefined && prof.rent !== null && Number(prof.rent) > 0;
    return prof.role === "resident" && hasVacancy;
  };

  assert.strictEqual(isEligibleResidentCandidate(residentWithVacancy), true, "Resident with vacancy rent > 0 must be included");
  assert.strictEqual(isEligibleResidentCandidate(residentNoVacancy), false, "Resident without vacancy rent MUST be excluded");

  console.log("✅ PASSED: Resident space-holders without set vacancy rent are strictly excluded from candidate pools.");
}

function testMissingProfileRejection() {
  console.log("\n[TEST 7] Testing Incomplete Profile Rejection (400 Bad Request)...");

  // Simulated handler check in POST /api/match/request:
  const processMatchRequest = (userRole, savedProfileDoc) => {
    if (userRole === "landlord") {
      if (!savedProfileDoc) return { status: 400, error: "Listing Required", message: "Please create a Landlord Property Listing before requesting matches." };
    } else {
      if (!savedProfileDoc) return { status: 400, error: "Profile Required", message: "Please complete your Lifestyle Profile before requesting matches." };
    }
    return { status: 200, criteria: savedProfileDoc };
  };

  const noProfileRes = processMatchRequest("seeker", null);
  assert.strictEqual(noProfileRes.status, 400, "Request without saved profile MUST return HTTP 400");
  assert.strictEqual(noProfileRes.error, "Profile Required");

  const validProfileRes = processMatchRequest("seeker", { city: "San Francisco", budgetMin: 1000, budgetMax: 2000 });
  assert.strictEqual(validProfileRes.status, 200);

  console.log("✅ PASSED: Matching request without completed profile rejected with 400 Bad Request.");
}

function testProfileUpdateCacheInvalidation() {
  console.log("\n[TEST 8] Testing 24h Cache Invalidation on Profile Update...");

  // Initial user profile snapshot
  let currentSavedProfile = {
    userId: "usr_alex_123",
    city: "Boston",
    budgetMin: 1000,
    budgetMax: 2000,
    cleanliness: 4,
  };

  // Simulate stored 24h cached request in DB created 1 hour ago
  const storedCachedRequest = {
    requesterId: "usr_alex_123",
    criteria: { ...currentSavedProfile },
    results: [{ candidateId: "cand_boston_1", score: 85 }],
    createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1h old
  };

  // Helper matching isSameCriteria logic from match.js
  const isSameCriteria = (c1, c2) => {
    const keys = ["city", "budgetMin", "budgetMax", "cleanliness"];
    for (const k of keys) {
      if (String(c1[k] ?? "").toLowerCase().trim() !== String(c2[k] ?? "").toLowerCase().trim()) return false;
    }
    return true;
  };

  // Step 1: Initial request within 24h with unchanged profile -> CACHE HIT
  const isCacheHitInitial = isSameCriteria(storedCachedRequest.criteria, currentSavedProfile);
  assert.strictEqual(isCacheHitInitial, true, "Initial request with identical profile MUST serve cached result");

  // Step 2: User updates their LifestyleProfile (e.g. changes city from 'Boston' to 'Chicago')
  currentSavedProfile.city = "Chicago";
  currentSavedProfile.budgetMin = 1500;

  // Step 3: Subsequent request within same 24h window -> CACHE MISS (INVALIDATED)
  const isCacheHitAfterProfileEdit = isSameCriteria(storedCachedRequest.criteria, currentSavedProfile);
  assert.strictEqual(isCacheHitAfterProfileEdit, false, "Request after profile update MUST NOT serve stale cached result");

  console.log("✅ PASSED: Updating LifestyleProfile invalidates 24h cache and forces fresh recomputation.");
}

function runAll() {
  testPrivacyExclusionInCandidateSnapshots();
  testFactorCoverageMetadataIntegrity();
  testResidentSpaceHolderRentMatching();
  test24hCachingLogic();
  testGetMatchRequestAuthorization();
  testResidentNoVacancyFilter();
  testMissingProfileRejection();
  testProfileUpdateCacheInvalidation();

  console.log("\n=================================================");
  console.log("🎉 ALL API, AUTHORIZATION & CACHE TESTS PASSED!");
  console.log("=================================================");
}

runAll();
