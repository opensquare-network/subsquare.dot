import { filterTabs } from "../../../data";

export const FILTER_PARAM = "status";

/** Reads the status filter from the URL, falling back to "All". */
export function readFilter(searchParams: URLSearchParams): string {
  const value = searchParams.get(FILTER_PARAM);
  return value && filterTabs.includes(value) ? value : "All";
}

const PASSED_STATES = ["Confirmed", "Approved", "Executed"];
const REJECTED_STATES = [
  "Rejected",
  "Cancelled",
  "Killed",
  "TimedOut",
  "ConfirmAborted",
];

/** Map the API's raw status names to filter groups. */
export function statusMatches(filter: string, status: string): boolean {
  switch (filter) {
    case "All":
      return true;
    case "Deciding":
      return status === "Deciding" || status === "Ongoing";
    case "Confirming":
      return status === "Confirming" || status === "Confirmed";
    case "Queueing":
      return (
        status === "Queueing" ||
        status === "Preparing" ||
        status === "Submitted"
      );
    case "Passed":
      return PASSED_STATES.includes(status);
    case "Rejected":
      return REJECTED_STATES.includes(status);
    default:
      return status === filter;
  }
}
