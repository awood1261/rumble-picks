import { NextResponse } from "next/server";

import { requirePromotionManagement } from "../../../../lib/serverPromotionAccess";

type GeoapifyGeocodeResponse = {
  features?: Array<{
    properties?: {
      formatted?: string;
      lat?: number;
      lon?: number;
    };
    geometry?: {
      coordinates?: [number, number];
    };
  }>;
};

type GeoapifyErrorResponse = {
  message?: string;
  error?: string;
};

const getGeoapifyLocation = (
  feature: NonNullable<GeoapifyGeocodeResponse["features"]>[number]
) => {
  const lon = feature.geometry?.coordinates?.[0] ?? feature.properties?.lon;
  const lat = feature.geometry?.coordinates?.[1] ?? feature.properties?.lat;
  if (
    typeof lat !== "number" ||
    typeof lon !== "number" ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lon)
  ) {
    return null;
  }
  return {
    latitude: lat,
    longitude: lon,
  };
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      promotionId?: string;
      address?: string;
    };
    const promotionId = body.promotionId?.trim() ?? "";
    const address = body.address?.trim() ?? "";
    if (!promotionId) {
      return NextResponse.json(
        { error: "Promotion is required." },
        { status: 400 }
      );
    }
    if (!address) {
      return NextResponse.json(
        { error: "Venue address is required." },
        { status: 400 }
      );
    }

    const access = await requirePromotionManagement(request, promotionId);
    if (!access.ok) return access.response;

    const apiKey = process.env.GEOAPIFY_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Geocoding is not configured." },
        { status: 503 }
      );
    }

    const url = new URL("https://api.geoapify.com/v1/geocode/search");
    url.searchParams.set("text", address);
    url.searchParams.set("format", "geojson");
    url.searchParams.set("limit", "1");
    url.searchParams.set("apiKey", apiKey);

    const response = await fetch(url);
    if (!response.ok) {
      let providerError = "Geocoding provider failed.";
      try {
        const errorPayload = (await response.json()) as GeoapifyErrorResponse;
        providerError = errorPayload.message || errorPayload.error || providerError;
      } catch {
        // Keep the generic provider error.
      }
      return NextResponse.json(
        { error: providerError },
        { status: 502 }
      );
    }

    const payload = (await response.json()) as GeoapifyGeocodeResponse;
    const result = payload.features?.[0];
    if (!result) {
      return NextResponse.json(
        { error: "No location found for that address." },
        { status: 404 }
      );
    }
    const location = getGeoapifyLocation(result);
    if (!location) {
      return NextResponse.json(
        { error: "No usable location found for that address." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      latitude: location.latitude,
      longitude: location.longitude,
      formattedAddress: result.properties?.formatted ?? address,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to geocode address.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
