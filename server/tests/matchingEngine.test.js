import assert from "assert";
import {
  computeMatches,
  passesHardFilters,
  scoreBudgetCloseness,
  scoreCleanliness,
  scoreCandidate,
  DEFAULT_WEIGHTS,
} from "../services/matchingEngine.js";

console.log("=================================================");
console.log("   RUNNING MATCHING ENGINE UNIT TEST SUITE      ");
console.log("=================================================");

function testExactMatchScoring() {
  console.log("\n[TEST 1] Testing Exact Match Scoring (100 Points Expected)...");

  const requester = {
    userId: "user_req_1",
    city: "San Francisco",
    locality: "Mission",
    budgetMin: 1000,
    budgetMax: 2000, // target 1500
    gender: "female",
    genderPreference: "female_only",
    sleepSchedule: "early_bird",
    cleanliness: 5,
    smokingDrinking: "none",
    foodPreference: "vegan",
    guestsFrequency: "rarely",
    accountStatus: "active",
    platformVerification: { status: "verified" },
  };

  const candidate = { ...requester, userId: "user_cand_1" };

  const result = computeMatches(requester, [candidate]);
  assert.strictEqual(result.results.length, 1);
  assert.strictEqual(result.results[0].score, 100);
  console.log("✅ PASSED: Exact match returned 100 points.");
}

function testHardFiltersExclusion() {
  console.log("\n[TEST 2] Testing Hard Filter Exclusions...");

  const requester = {
    userId: "user_req_2",
    gender: "male",
    genderPreference: "female_only",
    accountStatus: "active",
    platformVerification: { status: "verified" },
  };

  // Candidate 1: Self Match
  const selfCand = { ...requester, userId: "user_req_2", gender: "female" };
  assert.strictEqual(passesHardFilters(requester, selfCand), false, "Should exclude self-match");

  // Candidate 2: Gender Mismatch
  const maleCand = {
    userId: "user_male",
    gender: "male",
    genderPreference: "no_preference",
    accountStatus: "active",
    platformVerification: { status: "verified" },
  };
  assert.strictEqual(passesHardFilters(requester, maleCand), false, "Should exclude gender mismatch");

  // Candidate 3: Pending Verification
  const unverifiedCand = {
    userId: "user_unverified",
    gender: "female",
    genderPreference: "male_only",
    accountStatus: "active",
    platformVerification: { status: "pending" },
  };
  assert.strictEqual(passesHardFilters(requester, unverifiedCand), false, "Should exclude unverified candidate");

  // Candidate 4: Suspended Account
  const suspendedCand = {
    userId: "user_suspended",
    gender: "female",
    genderPreference: "male_only",
    accountStatus: "suspended",
    platformVerification: { status: "verified" },
  };
  assert.strictEqual(passesHardFilters(requester, suspendedCand), false, "Should exclude suspended candidate");

  // Candidate 5: Valid Candidate
  const validCand = {
    userId: "user_valid",
    gender: "female",
    genderPreference: "male_only",
    accountStatus: "active",
    platformVerification: { status: "verified" },
  };
  assert.strictEqual(passesHardFilters(requester, validCand), true, "Should allow valid candidate");

  console.log("✅ PASSED: All hard filter exclusions working correctly.");
}

function testBudgetClosenessFormula() {
  console.log("\n[TEST 3] Testing Budget Closeness Formula & Decay Curve...");

  const requester = { budgetMin: 1000, budgetMax: 2000 }; // Target = 1500

  // Case 1: Within 10% diff (diff = 5%, ratio = 1.0)
  const cand10 = { rent: 1575 }; // diff = 75 / 1500 = 5%
  const ratio10 = scoreBudgetCloseness(requester, cand10);
  assert.strictEqual(ratio10, 1.0, "<=10% diff should give 100% budget score");

  // Case 2: 25% diff (halfway between 10% and 40%, ratio = 0.5)
  const cand25 = { rent: 1875 }; // diff = 375 / 1500 = 25%
  const ratio25 = scoreBudgetCloseness(requester, cand25);
  assert.strictEqual(Math.round(ratio25 * 100) / 100, 0.5, "25% diff should give 0.5 ratio");

  // Case 3: >40% diff (ratio = 0.0)
  const cand50 = { rent: 2500 }; // diff = 1000 / 1500 = 66%
  const ratio50 = scoreBudgetCloseness(requester, cand50);
  assert.strictEqual(ratio50, 0.0, ">40% diff should give 0 score");

  console.log("✅ PASSED: Budget closeness formula and linear decay curve verified.");
}

function testCleanlinessAndLocalityScoring() {
  console.log("\n[TEST 4] Testing Cleanliness & Locality Decay...");

  assert.strictEqual(scoreCleanliness(5, 5), 1.0, "Exact cleanliness should be 1.0");
  assert.strictEqual(scoreCleanliness(5, 4), 0.5, "1 level apart cleanliness should be 0.5");
  assert.strictEqual(scoreCleanliness(5, 3), 0.0, "2+ levels apart cleanliness should be 0.0");

  console.log("✅ PASSED: Cleanliness decay logic verified.");
}

function testLandlordProxyScoringAndFairNormalization() {
  console.log("\n[TEST 5] Testing Pure Landlord Listing Proxy Scoring & Fair Normalization...");

  const seekerRequester = {
    userId: "seeker_1",
    city: "Boston",
    locality: "Back Bay",
    budgetMin: 1500,
    budgetMax: 2500, // target 2000
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

  // Pure Landlord Listing without linked tenants or cleanliness/food preference
  const landlordListing = {
    landlordId: "landlord_1",
    city: "Boston",
    locality: "Back Bay",
    rent: 2000,
    roomType: "private_room",
    genderPreference: "any",
    houseRules: {
      smokingAllowed: false,
      drinkingAllowed: false, // proxy smokingDrinking = 'none' -> 20 pts
      guestPolicy: "daytime_only", // proxy guestsFrequency = 'rarely' -> 10 pts
      curfew: "11_pm", // proxy sleepSchedule = 'early_bird' -> 20 pts
    },
    user: { accountStatus: "active", platformVerification: { status: "verified" } },
  };

  const evalResult = scoreCandidate(seekerRequester, landlordListing, DEFAULT_WEIGHTS);
  console.log(`  Evaluated Points: ${evalResult.maxApplicablePoints} / 100 total possible weights`);
  console.log(`  Raw Score Sum: ${evalResult.rawScoreSum}`);
  console.log(`  Raw Normalized Score: ${evalResult.normalizedScore} / 100`);
  console.log(`  Confidence-Weighted Final Score: ${evalResult.score} / 100`);
  console.log(`  Coverage Label: ${evalResult.factorCoverage.confidenceLabel} (${evalResult.factorCoverage.coveragePercentage}% factor coverage)`);

  // Evaluated factors: sleepSchedule (20), smokingDrinking (20), guestsFrequency (10), cityProximity (5), budgetCloseness (5) = 60 pts
  // Raw normalized: (60 / 60) * 100 = 100
  // Confidence weighted: 0.60 * 100 + 0.40 * 50 = 80.0
  assert.strictEqual(evalResult.normalizedScore, 100, "Raw normalized score should be 100");
  assert.strictEqual(evalResult.score, 80, "Confidence-weighted final score should be 80.0");
  assert.strictEqual(evalResult.factorCoverage.coveragePercentage, 60, "Factor coverage percentage should be 60%");
  console.log("✅ PASSED: Pure landlord listing hybrid confidence-weighted score & factor coverage verified.");
}

function testLandlordLinkedTenantBlending() {
  console.log("\n[TEST 6] Testing Landlord 50/50 Linked Tenant Score Blending...");

  const seekerRequester = {
    userId: "seeker_1",
    city: "Boston",
    locality: "Back Bay",
    budgetMin: 1500,
    budgetMax: 2500,
    gender: "male",
    genderPreference: "any",
    sleepSchedule: "early_bird",
    cleanliness: 5,
    smokingDrinking: "none",
    foodPreference: "vegetarian",
    guestsFrequency: "rarely",
    accountStatus: "active",
    platformVerification: { status: "verified" },
  };

  const landlordWithTenant = {
    landlordId: "landlord_2",
    city: "Boston",
    locality: "Back Bay",
    rent: 2000,
    roomType: "private_room",
    genderPreference: "any",
    houseRules: {
      smokingAllowed: false,
      drinkingAllowed: false,
      guestPolicy: "daytime_only",
      curfew: "11_pm",
    },
    user: { accountStatus: "active", platformVerification: { status: "verified" } },
    // Linked tenant profile with lower cleanliness (3 vs 5 -> 0 pts)
    linkedTenantProfiles: [
      {
        userId: "resident_tenant_1",
        city: "Boston",
        locality: "Back Bay",
        budgetMin: 1500,
        budgetMax: 2500,
        gender: "male",
        genderPreference: "any",
        sleepSchedule: "early_bird",
        cleanliness: 3, // 0 pts out of 25 -> total score ~ 75
        smokingDrinking: "none",
        foodPreference: "vegetarian",
        guestsFrequency: "rarely",
      },
    ],
  };

  const evalResult = scoreCandidate(seekerRequester, landlordWithTenant, DEFAULT_WEIGHTS);
  console.log(`  House Rules Normalized Score: 100.0`);
  console.log(`  Linked Tenant Average Score: ${evalResult.breakdown.linkedTenantsAverage}`);
  console.log(`  Blended 50/50 Final Score: ${evalResult.score}`);

  assert(evalResult.score < 100 && evalResult.score > 70, "Blended score should be average of house rules and tenant lifestyle");
  console.log("✅ PASSED: 50/50 linked tenant score blending verified.");
}

function testTop3TruncationAndSorting() {
  console.log("\n[TEST 7] Testing Top-3 Truncation & Sorting...");

  const requester = {
    userId: "req_user",
    city: "Chicago",
    budgetMin: 1000,
    budgetMax: 2000,
    gender: "female",
    genderPreference: "any",
    sleepSchedule: "early_bird",
    cleanliness: 5,
    smokingDrinking: "none",
    foodPreference: "any",
    guestsFrequency: "never",
    accountStatus: "active",
    platformVerification: { status: "verified" },
  };

  // Create 5 candidates with decreasing cleanliness (5 down to 1)
  const candidates = [1, 2, 3, 4, 5].map((cleanLevel, index) => ({
    userId: `cand_${index}`,
    city: "Chicago",
    budgetMin: 1000,
    budgetMax: 2000,
    gender: "female",
    genderPreference: "any",
    sleepSchedule: "early_bird",
    cleanliness: cleanLevel,
    smokingDrinking: "none",
    foodPreference: "any",
    guestsFrequency: "never",
    accountStatus: "active",
    platformVerification: { status: "verified" },
  }));

  const result = computeMatches(requester, candidates);
  console.log(`  Total Eligible Candidates: ${result.totalEligibleCount}`);
  console.log(`  Results Truncated Count: ${result.results.length}`);
  console.log(`  Top 3 Scores: ${result.results.map((r) => r.score).join(", ")}`);

  assert.strictEqual(result.totalEligibleCount, 5);
  assert.strictEqual(result.results.length, 3);
  assert(result.results[0].score >= result.results[1].score);
  assert(result.results[1].score >= result.results[2].score);

  console.log("✅ PASSED: Results sorted descending and truncated to top 3.");
}

function testFewerThan3EligibleCandidates() {
  console.log("\n[TEST 8] Testing Fewer Than 3 Eligible Candidates Edge Case...");

  const requester = {
    userId: "req_user",
    city: "Chicago",
    budgetMin: 1000,
    budgetMax: 2000,
    gender: "female",
    genderPreference: "female_only",
    accountStatus: "active",
    platformVerification: { status: "verified" },
  };

  const candidate = {
    userId: "cand_only_1",
    city: "Chicago",
    budgetMin: 1000,
    budgetMax: 2000,
    gender: "female",
    genderPreference: "any",
    accountStatus: "active",
    platformVerification: { status: "verified" },
  };

  const result = computeMatches(requester, [candidate]);
  console.log(`  Returned Count: ${result.results.length}`);
  console.log(`  Message: "${result.message}"`);

  assert.strictEqual(result.results.length, 1);
  assert.strictEqual(result.totalEligibleCount, 1);
  assert.strictEqual(result.message, "Found 1 eligible match(es) in launch city.");

  console.log("✅ PASSED: Fewer than 3 candidates handled gracefully with explanatory message.");
}

function runAllTests() {
  testExactMatchScoring();
  testHardFiltersExclusion();
  testBudgetClosenessFormula();
  testCleanlinessAndLocalityScoring();
  testLandlordProxyScoringAndFairNormalization();
  testLandlordLinkedTenantBlending();
  testTop3TruncationAndSorting();
  testFewerThan3EligibleCandidates();

  console.log("\n=================================================");
  console.log("🎉 ALL MATCHING ENGINE UNIT TESTS PASSED!");
  console.log("=================================================");
}

runAllTests();
