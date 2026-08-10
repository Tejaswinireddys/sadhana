import { UTM_KEYS, type UtmProps } from "./events";

export type Attribution = UtmProps & {
  ref?: string;
  flow_id?: string;
};

/** Pull ref + utm_* from a querystring (URLSearchParams or plain object). */
export function parseAttribution(
  params: URLSearchParams | Record<string, string | null | undefined>,
): Attribution {
  const get = (key: string): string | undefined => {
    if (params instanceof URLSearchParams) {
      const v = params.get(key);
      return v && v.trim() ? v.trim().slice(0, 64) : undefined;
    }
    const v = params[key];
    return v && String(v).trim() ? String(v).trim().slice(0, 64) : undefined;
  };

  const out: Attribution = {};
  const ref = get("ref");
  if (ref) out.ref = ref;
  const flow = get("flow_id") || get("flow");
  if (flow) out.flow_id = flow;
  for (const key of UTM_KEYS) {
    const v = get(key);
    if (v) out[key] = v;
  }
  return out;
}

/** Flatten attribution onto an event property bag (omit empties). */
export function attributionProps(attr: Attribution): Record<string, string> {
  const out: Record<string, string> = {};
  if (attr.ref) out.ref = attr.ref;
  for (const key of UTM_KEYS) {
    const v = attr[key];
    if (v) out[key] = v;
  }
  return out;
}

/** Stable traffic-source label for paywall conversion breakdowns. */
export function trafficSource(attr: Attribution): string {
  return attr.utm_source || attr.ref || "direct";
}
