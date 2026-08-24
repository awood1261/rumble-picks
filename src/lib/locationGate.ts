export const LOCATION_GATE_HIGH_ACCURACY_LIMIT_METERS = 500;
export const LOCATION_GATE_ACCURACY_TOLERANCE_CAP_METERS = 150;
export const LOCATION_GATE_MIN_VERIFICATION_MS = 6 * 60 * 60 * 1000;
export const LOCATION_GATE_SHOW_START_EXTENSION_MS = 2 * 60 * 60 * 1000;
export const LOCATION_GATE_MAX_VERIFICATION_MS = 12 * 60 * 60 * 1000;

const EARTH_RADIUS_METERS = 6371000;
const STORAGE_KEY_PREFIX = "boutpick:location-verification:v1";

export const LOCATION_GATE_GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 60000,
};

export type LocationGateConfig = {
  venueLatitude: number | null | undefined;
  venueLongitude: number | null | undefined;
  radiusMeters: number | null | undefined;
};

type ValidLocationGateConfig = {
  venueLatitude: number;
  venueLongitude: number;
  radiusMeters: number;
};

export type DeviceLocation = {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null | undefined;
};

export type LocationGateEvaluation =
  | {
      status: "inside" | "outside" | "inconclusive";
      distanceMeters: number;
      allowedRadiusMeters: number;
      accuracyMeters: number | null;
      toleranceMeters: number;
    }
  | {
      status: "invalid_config";
      distanceMeters: null;
      allowedRadiusMeters: null;
      accuracyMeters: number | null;
      toleranceMeters: null;
    };

export type StoredLocationVerification = {
  showId: string;
  userKey: string;
  verifiedAt: string;
  expiresAt: string;
};

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

export const isValidLatitude = (value: number | null | undefined) =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= -90 &&
  value <= 90;

export const isValidLongitude = (value: number | null | undefined) =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= -180 &&
  value <= 180;

export const isValidRadiusMeters = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

export const isValidLocationGateConfig = (
  config: LocationGateConfig
): config is ValidLocationGateConfig =>
  isValidLatitude(config.venueLatitude) &&
  isValidLongitude(config.venueLongitude) &&
  isValidRadiusMeters(config.radiusMeters);

export const calculateHaversineDistanceMeters = (
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number }
) => {
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const haversine =
    Math.sin(latitudeDelta / 2) * Math.sin(latitudeDelta / 2) +
    Math.cos(fromLatitude) *
      Math.cos(toLatitude) *
      Math.sin(longitudeDelta / 2) *
      Math.sin(longitudeDelta / 2);

  return (
    EARTH_RADIUS_METERS *
    2 *
    Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
};

export const evaluateLocationGate = (
  config: LocationGateConfig,
  deviceLocation: DeviceLocation
): LocationGateEvaluation => {
  const accuracyMeters =
    typeof deviceLocation.accuracyMeters === "number" &&
    Number.isFinite(deviceLocation.accuracyMeters)
      ? Math.max(deviceLocation.accuracyMeters, 0)
      : null;

  if (!isValidLocationGateConfig(config)) {
    return {
      status: "invalid_config",
      distanceMeters: null,
      allowedRadiusMeters: null,
      accuracyMeters,
      toleranceMeters: null,
    };
  }

  const distanceMeters = calculateHaversineDistanceMeters(
    {
      latitude: deviceLocation.latitude,
      longitude: deviceLocation.longitude,
    },
    {
      latitude: config.venueLatitude,
      longitude: config.venueLongitude,
    }
  );
  const toleranceMeters =
    accuracyMeters === null
      ? 0
      : Math.min(accuracyMeters, LOCATION_GATE_ACCURACY_TOLERANCE_CAP_METERS);
  const allowedRadiusMeters = config.radiusMeters + toleranceMeters;

  if (
    accuracyMeters !== null &&
    accuracyMeters > LOCATION_GATE_HIGH_ACCURACY_LIMIT_METERS
  ) {
    return {
      status: "inconclusive",
      distanceMeters,
      allowedRadiusMeters,
      accuracyMeters,
      toleranceMeters,
    };
  }

  return {
    status: distanceMeters <= allowedRadiusMeters ? "inside" : "outside",
    distanceMeters,
    allowedRadiusMeters,
    accuracyMeters,
    toleranceMeters,
  };
};

export const getLocationVerificationUserKey = (
  userId: string | null | undefined
) => userId || "anonymous";

export const getLocationVerificationStorageKey = (
  showId: string,
  userId: string | null | undefined
) =>
  `${STORAGE_KEY_PREFIX}:${encodeURIComponent(showId)}:${encodeURIComponent(
    getLocationVerificationUserKey(userId)
  )}`;

export const getLocationVerificationStorageKeys = (
  showId: string,
  userId: string | null | undefined
) => {
  const primaryKey = getLocationVerificationStorageKey(showId, userId);
  if (!userId) return [primaryKey];

  const anonymousKey = getLocationVerificationStorageKey(showId, null);
  return primaryKey === anonymousKey ? [primaryKey] : [primaryKey, anonymousKey];
};

export const getLocationVerificationExpiresAt = (
  verifiedAtMs: number,
  showStartsAt: string | null | undefined
) => {
  const minimumExpiresAtMs = verifiedAtMs + LOCATION_GATE_MIN_VERIFICATION_MS;
  const cappedExpiresAtMs = verifiedAtMs + LOCATION_GATE_MAX_VERIFICATION_MS;
  const showStartMs = showStartsAt ? Date.parse(showStartsAt) : Number.NaN;
  const showWindowExpiresAtMs = Number.isFinite(showStartMs)
    ? showStartMs + LOCATION_GATE_SHOW_START_EXTENSION_MS
    : minimumExpiresAtMs;

  return new Date(
    Math.min(
      Math.max(minimumExpiresAtMs, showWindowExpiresAtMs),
      cappedExpiresAtMs
    )
  ).toISOString();
};

const getBrowserStorage = () => {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage ?? null;
  } catch {
    return null;
  }
};

const parseStoredVerification = (
  value: string | null
): StoredLocationVerification | null => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<StoredLocationVerification>;
    if (
      typeof parsed.showId !== "string" ||
      typeof parsed.userKey !== "string" ||
      typeof parsed.verifiedAt !== "string" ||
      typeof parsed.expiresAt !== "string"
    ) {
      return null;
    }
    return {
      showId: parsed.showId,
      userKey: parsed.userKey,
      verifiedAt: parsed.verifiedAt,
      expiresAt: parsed.expiresAt,
    };
  } catch {
    return null;
  }
};

export const saveLocationVerification = ({
  showId,
  userId,
  showStartsAt,
  verifiedAtMs = Date.now(),
  storage = getBrowserStorage(),
}: {
  showId: string;
  userId?: string | null;
  showStartsAt?: string | null;
  verifiedAtMs?: number;
  storage?: Storage | null;
}): StoredLocationVerification | null => {
  if (!storage) return null;

  const verification: StoredLocationVerification = {
    showId,
    userKey: getLocationVerificationUserKey(userId),
    verifiedAt: new Date(verifiedAtMs).toISOString(),
    expiresAt: getLocationVerificationExpiresAt(verifiedAtMs, showStartsAt),
  };

  storage.setItem(
    getLocationVerificationStorageKey(showId, userId),
    JSON.stringify(verification)
  );
  return verification;
};

export const getStoredLocationVerification = ({
  showId,
  userId,
  nowMs = Date.now(),
  storage = getBrowserStorage(),
}: {
  showId: string;
  userId?: string | null;
  nowMs?: number;
  storage?: Storage | null;
}) => {
  if (!storage) return null;

  for (const storageKey of getLocationVerificationStorageKeys(showId, userId)) {
    const verification = parseStoredVerification(storage.getItem(storageKey));
    if (!verification || verification.showId !== showId) {
      continue;
    }

    const expiresAtMs = Date.parse(verification.expiresAt);
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= nowMs) {
      storage.removeItem(storageKey);
      continue;
    }

    return verification;
  }

  return null;
};

export const clearLocationVerification = ({
  showId,
  userId,
  storage = getBrowserStorage(),
}: {
  showId: string;
  userId?: string | null;
  storage?: Storage | null;
}) => {
  if (!storage) return;
  storage.removeItem(getLocationVerificationStorageKey(showId, userId));
};
