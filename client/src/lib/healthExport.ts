/**
 * Wearable / Health export — privacy-first workout files users can import
 * into Apple Health, Google Fit, or Strava (no always-on cloud sync).
 */
export type HealthWorkout = {
  date: string; // YYYY-MM-DD
  minutes: number;
  label: string;
  notes?: string;
};

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** TCX activity file — widely importable. */
export function buildTcx(workout: HealthWorkout): string {
  const start = `${workout.date}T12:00:00.000Z`;
  const endMs = Date.parse(start) + workout.minutes * 60_000;
  const end = new Date(endMs).toISOString();
  const secs = Math.max(60, workout.minutes * 60);
  return `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
  <Activities>
    <Activity Sport="Other">
      <Id>${start}</Id>
      <Lap StartTime="${start}">
        <TotalTimeSeconds>${secs}</TotalTimeSeconds>
        <DistanceMeters>0</DistanceMeters>
        <Calories>0</Calories>
        <Intensity>Active</Intensity>
        <TriggerMethod>Manual</TriggerMethod>
        <Track>
          <Trackpoint>
            <Time>${start}</Time>
          </Trackpoint>
          <Trackpoint>
            <Time>${end}</Time>
          </Trackpoint>
        </Track>
        <Notes>${escapeXml(workout.label)}${workout.notes ? ` — ${escapeXml(workout.notes)}` : ""}</Notes>
      </Lap>
    </Activity>
  </Activities>
</TrainingCenterDatabase>
`;
}

/** Simple CSV for spreadsheets / manual Health logging. */
export function buildWorkoutCsv(workout: HealthWorkout): string {
  return `date,minutes,activity,notes\n${workout.date},${workout.minutes},"${workout.label.replace(/"/g, '""')}","${(workout.notes ?? "").replace(/"/g, '""')}"\n`;
}

export function downloadBlob(filename: string, contents: string, mime: string) {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadHealthWorkout(workout: HealthWorkout, format: "tcx" | "csv" = "tcx") {
  if (format === "csv") {
    downloadBlob(`sadhana-${workout.date}.csv`, buildWorkoutCsv(workout), "text/csv");
    return;
  }
  downloadBlob(`sadhana-${workout.date}.tcx`, buildTcx(workout), "application/vnd.garmin.tcx+xml");
}
