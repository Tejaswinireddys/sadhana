import { SUPPORT_EMAIL } from "@/lib/publicConfig";
/** Never send private account data to an unverified placeholder mailbox. */
export function SupportContact() {
  return SUPPORT_EMAIL
    ? <a href={`mailto:${SUPPORT_EMAIL}`} className="underline underline-offset-2">{SUPPORT_EMAIL}</a>
    : <span>Private email support is not configured yet. Account export and deletion are available in Settings.</span>;
}
