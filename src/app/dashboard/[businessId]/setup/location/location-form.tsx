"use client";

import { valueOf } from "@/lib/form-values";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, SelectField, TextAreaField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import type { FormState } from "@/server/actions";
import { saveLocationAction } from "../../actions";

type City = { id: string; name: string; regionName: string; areas: { id: string; name: string }[] };
type Values = {
  cityId: string;
  areaId: string;
  localityText: string;
  addressLine: string;
  landmark: string;
  directions: string;
  lat: number | null;
  lng: number | null;
};

export function LocationForm({ businessId, cities, values }: { businessId: string; cities: City[]; values: Values }) {
  const [state, formAction] = useActionState<FormState, FormData>(saveLocationAction, {});
  const [cityId, setCityId] = useState(values.cityId || (values.localityText ? "other" : ""));
  const [coords, setCoords] = useState(
    values.lat !== null && values.lng !== null ? { lat: values.lat, lng: values.lng } : null,
  );
  const [geoMessage, setGeoMessage] = useState<string | null>(null);
  const city = cities.find((c) => c.id === cityId);

  const regions = [...new Set(cities.map((c) => c.regionName))].sort();

  function pinCurrentLocation() {
    if (!("geolocation" in navigator)) {
      setGeoMessage("Your browser can't share its location. You can skip this.");
      return;
    }
    setGeoMessage("Finding your location…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          lat: Number(position.coords.latitude.toFixed(6)),
          lng: Number(position.coords.longitude.toFixed(6)),
        });
        setGeoMessage("Location pinned. Save to keep it.");
      },
      () => setGeoMessage("Couldn't get your location. Check location permission, or skip this."),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  return (
    <form action={formAction} noValidate className="rounded-card bg-card p-5 border border-border">
      <input type="hidden" name="businessId" value={businessId} />
      <input type="hidden" name="lat" value={coords?.lat ?? ""} />
      <input type="hidden" name="lng" value={coords?.lng ?? ""} />
      <FormMessage tone="error" message={state.fieldErrors ? undefined : state.message} />

      <SelectField
        id="cityId"
        name="cityId"
        label="Town or city"
        value={cityId}
        onChange={(e) => setCityId(e.target.value)}
        error={state.fieldErrors?.cityId}
      >
        <option value="" disabled>
          Choose your town or city
        </option>
        {regions.map((region) => (
          <optgroup key={region} label={region}>
            {cities
              .filter((c) => c.regionName === region)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </optgroup>
        ))}
        <option value="other">My town isn&apos;t listed</option>
      </SelectField>

      {cityId === "other" ? (
        <Field
          id="localityText"
          name="localityText"
          label="Town name"
          defaultValue={valueOf(state.values, "localityText", values.localityText)}
          maxLength={80}
          error={state.fieldErrors?.localityText}
        />
      ) : null}

      {city && city.areas.length > 0 ? (
        <SelectField
          key={city.id}
          id="areaId"
          name="areaId"
          label="Area or neighbourhood"
          defaultValue={valueOf(state.values, "areaId", city.id === values.cityId ? values.areaId : "")}
          hint="Optional, but it helps people nearby find you."
          error={state.fieldErrors?.areaId}
        >
          <option value="">Not listed / skip</option>
          {city.areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </SelectField>
      ) : null}

      <Field
        id="addressLine"
        name="addressLine"
        label="Street address"
        defaultValue={valueOf(state.values, "addressLine", values.addressLine)}
        maxLength={200}
        placeholder="e.g. Lagos Avenue, 1st floor"
        hint="Optional."
        error={state.fieldErrors?.addressLine}
      />
      <Field
        id="landmark"
        name="landmark"
        label="Nearest landmark"
        defaultValue={valueOf(state.values, "landmark", values.landmark)}
        maxLength={200}
        placeholder="e.g. Opposite the Shell filling station"
        hint="Helps customers find you. Strongly recommended."
        error={state.fieldErrors?.landmark}
      />
      <TextAreaField
        id="directions"
        name="directions"
        label="Directions"
        rows={3}
        defaultValue={valueOf(state.values, "directions", values.directions)}
        maxLength={500}
        placeholder="e.g. Enter through the blue gate, we're upstairs."
        hint="Optional."
        error={state.fieldErrors?.directions}
      />

      <div className="mb-5 rounded-control bg-fill p-3">
        <p className="text-small font-medium">Map pin</p>
        <p className="mb-2 text-small text-ink-muted">
          {coords
            ? `Pinned at ${coords.lat}, ${coords.lng}.`
            : "Optional. Tap while you're at your shop to pin it on the map."}
        </p>
        <div className="flex flex-wrap gap-x-5">
          <Button type="button" variant="plain" onClick={pinCurrentLocation} className="px-0">
            {coords ? "Update pin to where I am" : "Use my current location"}
          </Button>
          {coords ? (
            <Button type="button" variant="plain" onClick={() => setCoords(null)} className="px-0 text-danger">
              Remove pin
            </Button>
          ) : null}
        </div>
        {geoMessage ? (
          <p className="mt-1 text-small text-ink-muted" role="status">
            {geoMessage}
          </p>
        ) : null}
      </div>

      <SubmitButton pendingLabel="Saving…">Save and continue</SubmitButton>
    </form>
  );
}
