/**
 * RoomieMatch Matching Engine Service
 * Standalone pure-function module for candidate scoring and ranking.
 * Implements PRD §8 requirements, hard filters, weighted scoring, proxies, and fair normalization.
 */

// Default weights config object (tunable post-launch)
export const DEFAULT_WEIGHTS = {
  cleanliness: 25,
  sleepSchedule: 20,
  smokingDrinking: 20,
  foodPreference: 15,
  guestsFrequency: 10,
  cityProximity: 5,
  budgetCloseness: 5,
};

/**
 * 1. HARD FILTERS (PRD §8.1)
 * Disqualifies candidates prior to scoring.
 * Checks:
 * - Requester & Candidate ID exclusion (cannot match self)
 * - Candidate account active status & platform verification status
 * - Mutual gender preference match
 */
export function passesHardFilters(requester, candidate) {
  // Exclude self-match
  const requesterId = requester.userId || requester.id || requester._id;
  const candidateId = candidate.userId || candidate.landlordId || candidate.id || candidate._id;
  if (requesterId && candidateId && String(requesterId) === String(candidateId)) {
    return false;
  }

  // Active + Verified status check
  // Note: candidate user info can be attached to candidate object as candidate.user or candidate User fields
  const candidateUser = candidate.user || candidate;
  if (candidateUser.accountStatus && candidateUser.accountStatus !== "active") {
    return false;
  }
  if (candidateUser.platformVerification && candidateUser.platformVerification.status !== "verified") {
    return false;
  }

  // Gender preference match (Hard Filter)
  const reqGender = requester.gender;
  const reqPref = requester.genderPreference;

  const candGender = candidate.gender || candidateUser.gender;
  const candPref = candidate.genderPreference;

  // Requester checks candidate gender
  if (reqPref && reqPref !== "any" && reqPref !== "no_preference") {
    if (reqPref === "male_only" && candGender !== "male") return false;
    if (reqPref === "female_only" && candGender !== "female") return false;
  }

  // Candidate checks requester gender (if candidate has a preference)
  if (candPref && candPref !== "any" && candPref !== "no_preference") {
    if (candPref === "male_only" && reqGender !== "male") return false;
    if (candPref === "female_only" && reqGender !== "female") return false;
  }

  // Preferred Room Type Hard Filter (PRD §8.1)
  const reqRoomPref = requester.preferredRoomType || requester.roomTypePreference;
  const candRoomType = candidate.roomType;

  if (
    reqRoomPref &&
    reqRoomPref !== "any" &&
    reqRoomPref !== "no_preference" &&
    candRoomType
  ) {
    if (reqRoomPref !== candRoomType) {
      return false;
    }
  }

  return true;
}

/**
 * 2. SUB-FACTOR SCORING FUNCTIONS
 */

// Cleanliness (25 pts max)
export function scoreCleanliness(reqVal, candVal) {
  if (reqVal === undefined || candVal === undefined || reqVal === null || candVal === null) return null;
  const diff = Math.abs(Number(reqVal) - Number(candVal));
  if (diff === 0) return 1.0;
  if (diff === 1) return 0.5;
  return 0.0;
}

// Sleep Schedule (20 pts max)
export function scoreSleepSchedule(reqVal, candVal) {
  if (!reqVal || !candVal) return null;
  if (reqVal === candVal || reqVal === "flexible" || candVal === "flexible") return 1.0;
  if (
    (reqVal === "early_bird" && candVal === "night_owl") ||
    (reqVal === "night_owl" && candVal === "early_bird")
  ) {
    return 0.0;
  }
  return 0.5;
}

// Smoking / Drinking (20 pts max)
export function scoreSmokingDrinking(reqVal, candVal) {
  if (!reqVal || !candVal) return null;
  if (reqVal === candVal) return 1.0;
  if (reqVal === "opposed" || candVal === "opposed") {
    if (reqVal === "regular" || candVal === "regular") return 0.0;
    if (reqVal === "social" || candVal === "social") return 0.2;
    return 0.0;
  }
  return 0.5;
}

// Food Preference (15 pts max)
export function scoreFoodPreference(reqVal, candVal) {
  if (!reqVal || !candVal) return null;
  if (reqVal === candVal || reqVal === "any" || candVal === "any") return 1.0;
  if (
    (reqVal === "vegetarian" && (candVal === "eggetarian" || candVal === "vegan")) ||
    (candVal === "vegetarian" && (reqVal === "eggetarian" || reqVal === "vegan"))
  ) {
    return 0.7;
  }
  if (
    (reqVal === "vegan" && candVal === "non_vegetarian") ||
    (candVal === "vegan" && reqVal === "non_vegetarian")
  ) {
    return 0.0;
  }
  return 0.4;
}

// Guests Frequency (10 pts max)
export function scoreGuestsFrequency(reqVal, candVal) {
  if (!reqVal || !candVal) return null;
  if (reqVal === candVal || reqVal === "anytime" || candVal === "anytime") return 1.0;
  const order = ["never", "rarely", "weekends_only", "frequently", "anytime"];
  const i1 = order.indexOf(reqVal);
  const i2 = order.indexOf(candVal);
  if (i1 === -1 || i2 === -1) return 0.5;
  const diff = Math.abs(i1 - i2);
  if (diff === 1) return 0.5;
  return 0.0;
}

// City Proximity (5 pts max)
export function scoreCityProximity(reqCity, reqLoc, candCity, candLoc) {
  if (!reqCity || !candCity) return null;
  if (reqCity.toLowerCase().trim() !== candCity.toLowerCase().trim()) return 0.0;
  if (reqLoc && candLoc && reqLoc.toLowerCase().trim() === candLoc.toLowerCase().trim()) return 1.0;
  return 0.6; // Same city, different or unstated locality
}

/**
 * EXACT BUDGET CLOSENESS FORMULA (5 pts max)
 * percentDiff = abs(requesterTarget - candidateTarget) / requesterTarget
 * - percentDiff <= 0.10 (within 10%): 1.0 (5 pts)
 * - 0.10 < percentDiff <= 0.40: linear decay from 1.0 to 0.0
 * - percentDiff > 0.40: 0.0 (0 pts)
 */
export function scoreBudgetCloseness(requester, candidate) {
  let reqTarget;
  if (requester.rent !== undefined) {
    reqTarget = Number(requester.rent);
  } else if (requester.budgetMin !== undefined && requester.budgetMax !== undefined) {
    reqTarget = (Number(requester.budgetMin) + Number(requester.budgetMax)) / 2;
  } else {
    return null;
  }

  let candTarget;
  if (candidate.rent !== undefined) {
    candTarget = Number(candidate.rent);
  } else if (candidate.budgetMin !== undefined && candidate.budgetMax !== undefined) {
    candTarget = (Number(candidate.budgetMin) + Number(candidate.budgetMax)) / 2;
  } else {
    return null;
  }

  if (!reqTarget || reqTarget <= 0 || !candTarget || candTarget <= 0) return null;

  const percentDiff = Math.abs(reqTarget - candTarget) / reqTarget;

  if (percentDiff <= 0.10) {
    return 1.0;
  }
  if (percentDiff > 0.40) {
    return 0.0;
  }

  // Linear decay between 10% and 40%
  const decayFactor = 1.0 - (percentDiff - 0.10) / 0.30;
  return Math.max(0.0, Math.min(1.0, decayFactor));
}

/**
 * House Rules Proxy Mappings for Landlord Listings
 * Maps house rules to proxy lifestyle values.
 */
export function mapHouseRulesToProxies(houseRules) {
  if (!houseRules) return {};
  const proxies = {};

  // Smoking / Drinking Proxy
  if (houseRules.smokingAllowed === false && houseRules.drinkingAllowed === false) {
    proxies.smokingDrinking = "none";
  } else if (houseRules.smokingAllowed === false) {
    proxies.smokingDrinking = "social";
  } else {
    proxies.smokingDrinking = "regular";
  }

  // Guests Frequency Proxy
  if (houseRules.guestPolicy === "no_guests") {
    proxies.guestsFrequency = "never";
  } else if (houseRules.guestPolicy === "daytime_only") {
    proxies.guestsFrequency = "rarely";
  } else if (houseRules.guestPolicy === "overnight_allowed") {
    proxies.guestsFrequency = "weekends_only";
  } else if (houseRules.guestPolicy === "flexible") {
    proxies.guestsFrequency = "anytime";
  }

  // Sleep Schedule Proxy (from Curfew rule)
  if (houseRules.curfew === "10_pm" || houseRules.curfew === "11_pm") {
    proxies.sleepSchedule = "early_bird";
  } else if (houseRules.curfew === "no_curfew") {
    proxies.sleepSchedule = "flexible";
  }

  return proxies;
}

/**
 * Core Candidate Scoring Engine
 * Computes raw weighted scores, max applicable weights, and normalized final score (0-100).
 */
export function scoreCandidate(requester, candidate, weights = DEFAULT_WEIGHTS) {
  let candFactorValues = { ...candidate };

  // If candidate is a Landlord Listing without lifestyle fields, extract proxies
  if (candidate.houseRules && !candidate.cleanliness) {
    const proxies = mapHouseRulesToProxies(candidate.houseRules);
    candFactorValues = { ...candidate, ...proxies };
  }

  let reqFactorValues = { ...requester };
  if (requester.houseRules && !requester.cleanliness) {
    const proxies = mapHouseRulesToProxies(requester.houseRules);
    reqFactorValues = { ...requester, ...proxies };
  }

  const factorEvaluations = [];

  // Evaluate Cleanliness
  const cleanlinessRatio = scoreCleanliness(reqFactorValues.cleanliness, candFactorValues.cleanliness);
  if (cleanlinessRatio !== null) {
    factorEvaluations.push({ factor: "cleanliness", weight: weights.cleanliness, ratio: cleanlinessRatio });
  }

  // Evaluate Sleep Schedule
  const sleepRatio = scoreSleepSchedule(reqFactorValues.sleepSchedule, candFactorValues.sleepSchedule);
  if (sleepRatio !== null) {
    factorEvaluations.push({ factor: "sleepSchedule", weight: weights.sleepSchedule, ratio: sleepRatio });
  }

  // Evaluate Smoking/Drinking
  const smokeRatio = scoreSmokingDrinking(reqFactorValues.smokingDrinking, candFactorValues.smokingDrinking);
  if (smokeRatio !== null) {
    factorEvaluations.push({ factor: "smokingDrinking", weight: weights.smokingDrinking, ratio: smokeRatio });
  }

  // Evaluate Food Preference
  const foodRatio = scoreFoodPreference(reqFactorValues.foodPreference, candFactorValues.foodPreference);
  if (foodRatio !== null) {
    factorEvaluations.push({ factor: "foodPreference", weight: weights.foodPreference, ratio: foodRatio });
  }

  // Evaluate Guests Frequency
  const guestsRatio = scoreGuestsFrequency(reqFactorValues.guestsFrequency, candFactorValues.guestsFrequency);
  if (guestsRatio !== null) {
    factorEvaluations.push({ factor: "guestsFrequency", weight: weights.guestsFrequency, ratio: guestsRatio });
  }

  // Evaluate City Proximity
  const cityRatio = scoreCityProximity(reqFactorValues.city, reqFactorValues.locality, candFactorValues.city, candFactorValues.locality);
  if (cityRatio !== null) {
    factorEvaluations.push({ factor: "cityProximity", weight: weights.cityProximity, ratio: cityRatio });
  }

  // Evaluate Budget Closeness
  const budgetRatio = scoreBudgetCloseness(reqFactorValues, candFactorValues);
  if (budgetRatio !== null) {
    factorEvaluations.push({ factor: "budgetCloseness", weight: weights.budgetCloseness, ratio: budgetRatio });
  }

  let rawScoreSum = 0;
  let maxApplicablePoints = 0;
  const breakdown = {};

  for (const ev of factorEvaluations) {
    const earned = ev.weight * ev.ratio;
    rawScoreSum += earned;
    maxApplicablePoints += ev.weight;
    breakdown[ev.factor] = Math.round(earned * 10) / 10;
  }

  // Hybrid Confidence-Weighted Normalization
  // Applies shrinkage toward prior mean (50.0) based on factor coverage ratio
  let normalizedScore = 0;
  let finalScore = 0;
  const totalPossiblePoints = 100;
  const confidenceFactor = Math.min(1.0, maxApplicablePoints / totalPossiblePoints);

  if (maxApplicablePoints > 0) {
    normalizedScore = (rawScoreSum / maxApplicablePoints) * 100;
    // Shrinkage toward prior mean (50.0) based on factor coverage
    finalScore = confidenceFactor * normalizedScore + (1 - confidenceFactor) * 50.0;
  }

  const factorCoverage = {
    evaluatedFactorsCount: factorEvaluations.length,
    totalFactorsCount: 7,
    maxApplicablePoints,
    totalPossiblePoints,
    coveragePercentage: Math.round(confidenceFactor * 100),
    confidenceLabel: confidenceFactor >= 0.9 ? "High" : confidenceFactor >= 0.5 ? "Medium" : "Low",
  };

  // Landlord Linked Tenant Score Blending (50/50 default)
  if (candidate.linkedTenantProfiles && Array.isArray(candidate.linkedTenantProfiles) && candidate.linkedTenantProfiles.length > 0) {
    let totalTenantScore = 0;
    let tenantCount = 0;
    for (const tenantProf of candidate.linkedTenantProfiles) {
      const tenantRes = scoreCandidate(requester, tenantProf, weights);
      totalTenantScore += tenantRes.score;
      tenantCount++;
    }

    if (tenantCount > 0) {
      const avgTenantScore = totalTenantScore / tenantCount;
      // 50/50 Blending with house rules score
      finalScore = 0.5 * finalScore + 0.5 * avgTenantScore;
      breakdown.linkedTenantsAverage = Math.round(avgTenantScore * 10) / 10;
    }
  }

  return {
    score: Math.round(finalScore * 10) / 10,
    normalizedScore: Math.round(normalizedScore * 10) / 10,
    rawScoreSum: Math.round(rawScoreSum * 10) / 10,
    maxApplicablePoints,
    factorCoverage,
    breakdown,
  };
}

/**
 * Main Pure-Function Entrypoint (PRD §8.3)
 * Given requester criteria and candidate list, returns top-3 scored & sorted results.
 */
export function computeMatches(requester, candidates, weights = DEFAULT_WEIGHTS) {
  if (!requester || !Array.isArray(candidates)) {
    return { results: [], totalEligibleCount: 0 };
  }

  // 1. Filter out ineligible candidates via Hard Filters
  const eligibleCandidates = candidates.filter((cand) => passesHardFilters(requester, cand));

  // 2. Score each candidate
  const scored = eligibleCandidates.map((candidate) => {
    const { score, normalizedScore, breakdown, maxApplicablePoints, factorCoverage } = scoreCandidate(requester, candidate, weights);
    return {
      candidateId: candidate.userId || candidate.landlordId || candidate.id || candidate._id,
      candidate,
      score,
      normalizedScore,
      maxApplicablePoints,
      factorCoverage,
      breakdown,
    };
  });

  // 3. Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // 4. Truncate to Top 3
  const topResults = scored.slice(0, 3);

  return {
    results: topResults,
    totalEligibleCount: eligibleCandidates.length,
    message:
      eligibleCandidates.length < 3
        ? `Found ${eligibleCandidates.length} eligible match(es) in launch city.`
        : undefined,
  };
}

export default computeMatches;
