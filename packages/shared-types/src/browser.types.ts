/**
 * State captured during browser flow execution, used by Phase 6 API cross-validation.
 * Flow steps call runner.captureState() to record values observed in the browser,
 * and the cross-validator compares these against API response data.
 */
export interface BrowserCapturedState {
  /** Booking/registration confirmation ID seen on the confirmation page */
  confirmation_id?: string;
  /** Email address used in the form submission */
  email_used?: string;
  /** Full name used in the form submission */
  name_used?: string;
  /** Phone number used */
  phone_used?: string;
  /** Order total displayed on checkout page */
  order_total?: string;
  /** Payment status observed (e.g., 'confirmed', 'pending') */
  payment_status?: string;
  /** Session/camp name selected */
  session_name?: string;
  /** Number of attendees registered */
  attendee_count?: number;
  /** Any confirmation URL seen on the page */
  confirmation_url?: string;
  /** Arbitrary key-value pairs for site-specific state */
  custom: Record<string, string>;
}
