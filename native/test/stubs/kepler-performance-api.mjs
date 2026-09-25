// The Time To Fully Drawn marker. The real hook reports to the platform's
// performance tracing; this one counts, so a test can see when it was called.
let reports = 0;

export function useReportFullyDrawn() {
  return reportFullyDrawn;
}

function reportFullyDrawn() {
  reports += 1;
}

// Test-only.
export function fullyDrawnReports() {
  return reports;
}

export function resetFullyDrawnReports() {
  reports = 0;
}
