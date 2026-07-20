import { assertNever, type DomainError } from "@/server/services/result";
import { FORM_LEVEL_ISSUE_KEY } from "@/server/services/validation";

/**
 * `DomainError` → form errors.
 *
 * One mapping for every form in the app, so a given failure always reads the
 * same way and always lands on the same control. The `switch` is exhaustive:
 * adding a `DomainError` variant fails to compile here until someone decides
 * what the user should be told, which is the point — an unmapped error must
 * never reach a user as a blank failure.
 *
 * `"root"` is React Hook Form's key for form-level errors; the forms render it
 * in an `Alert` above the fields.
 */

export const ROOT_ERROR_FIELD = "root";

export interface FormError {
  /** A form field name, or `ROOT_ERROR_FIELD` for a form-level message. */
  field: string;
  message: string;
}

const GENERIC_RETRY = "Something went wrong. Please try again.";

export function domainErrorToFormErrors(error: DomainError): FormError[] {
  switch (error.type) {
    case "VALIDATION_FAILED":
      return Object.entries(error.issues).flatMap(([field, messages]) =>
        messages.map((message) => ({
          field: field === FORM_LEVEL_ISSUE_KEY ? ROOT_ERROR_FIELD : field,
          message,
        })),
      );

    case "SLUG_TAKEN":
      return [{ field: "slug", message: "That address is already taken. Try another." }];

    case "SLUG_RESERVED":
      return [{ field: "slug", message: "That address is reserved. Please choose another." }];

    case "SLUG_LOCKED":
      return [
        {
          field: "slug",
          message: "This address is locked because the site has been published.",
        },
      ];

    case "NOT_FOUND":
      return [{ field: ROOT_ERROR_FIELD, message: "That event no longer exists." }];

    case "FORBIDDEN":
      return [{ field: ROOT_ERROR_FIELD, message: "You don't have permission to do that." }];

    case "UNAUTHENTICATED":
      return [
        {
          field: ROOT_ERROR_FIELD,
          message: "Your session has expired. Sign in again to continue.",
        },
      ];

    case "LIMIT_EXCEEDED":
      return [
        {
          field: ROOT_ERROR_FIELD,
          message: `You can add at most ${error.limit} ${error.resource}.`,
        },
      ];

    case "PENDING_REQUEST_EXISTS":
      return [
        {
          field: ROOT_ERROR_FIELD,
          message: "This event already has a submission waiting for review.",
        },
      ];

    case "INCOMPLETE_CONTENT":
      return [
        {
          field: ROOT_ERROR_FIELD,
          message: `Still needed before submitting: ${error.fields.join(", ")}.`,
        },
      ];

    case "INVALID_STATE":
      return [
        {
          field: ROOT_ERROR_FIELD,
          message: "That action isn't available for this event right now.",
        },
      ];

    case "STALE_WRITE":
      return [
        {
          field: ROOT_ERROR_FIELD,
          message:
            "Someone else edited this event in another session. Reload to see their changes.",
        },
      ];

    case "RATE_LIMITED":
      return [
        {
          field: ROOT_ERROR_FIELD,
          message: "Too many attempts. Please wait a moment and try again.",
        },
      ];

    default:
      return assertNever(error);
  }
}

/** The single-line form of the above, for places with nowhere to put a field error. */
export function domainErrorMessage(error: DomainError): string {
  return domainErrorToFormErrors(error)[0]?.message ?? GENERIC_RETRY;
}
