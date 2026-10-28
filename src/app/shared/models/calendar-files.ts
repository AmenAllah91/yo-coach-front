/**
 * PDF / Excel programs on the client's calendar (backlog-programmes.md K4): a file reads as one program, one band of
 * one color from its first to its last day, « Début » on its first day, « Fin » on its last, going on from week to
 * week without a new card. Dates are `yyyy-MM-dd`.
 */

export const FILE_TONES = 6;

export interface CalendarFile {
  programId: string;
  name: string;
  resourceType: 'PDF' | 'EXCEL';
  start: string;
  end: string;
  /** One color per program, the same on every week it covers. */
  tone: number;
  /** Its row when two files overlap, the same on every week. */
  lane: number;
  /** Workout or nutrition program (the month shows both). */
  kind?: 'workout' | 'nutrition';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  plan?: any;
}

/** The part of a file band on one week row. */
export interface FileBand {
  file: CalendarFile;
  /** First column (0 = Monday) and number of days covered on the row. */
  col: number;
  span: number;
  /** Its row on this week (the files of the week only, in the order they keep on the others). */
  lane: number;
  /** The program starts / ends on this row (« Début » / « Fin »), else it goes on from / to another week. */
  starts: boolean;
  ends: boolean;
  /** First piece of the program on the screen: it carries the dates. */
  first: boolean;
}

/**
 * The files by start, each with the next color of the palette and the first free row: two files that overlap never
 * share a row, a file keeps its color and its row on all its weeks.
 */
export function arrangeFiles<T extends CalendarFile>(files: T[]): T[] {
  const sorted = [...files].sort((a, b) => a.start.localeCompare(b.start) || a.name.localeCompare(b.name));
  const laneEnds: string[] = [];
  sorted.forEach((file, index) => {
    file.tone = index % FILE_TONES;
    let lane = laneEnds.findIndex((end) => end < file.start);
    if (lane < 0) lane = laneEnds.length;
    laneEnds[lane] = file.end;
    file.lane = lane;
  });
  return sorted;
}

/**
 * The bands of one row of 7 days (null: a day outside the month). `seen` holds the files already drawn above on the
 * screen; it gets the files of this row. Returns the bands, the number of band rows and the columns they cover.
 */
export function weekBands(days: (string | null)[], files: CalendarFile[], seen: Set<string>):
  { bands: FileBand[]; lanes: number; covered: boolean[] } {
  const bands: FileBand[] = [];
  const covered = days.map(() => false);
  for (const file of files) {
    const cols = days
      .map((day, col) => (day && file.start <= day && day <= file.end ? col : -1))
      .filter((col) => col >= 0);
    if (!cols.length) continue;
    const col = cols[0];
    const last = cols[cols.length - 1];
    cols.forEach((index) => (covered[index] = true));
    bands.push({
      file,
      col,
      span: last - col + 1,
      lane: file.lane,
      starts: days[col] === file.start,
      ends: days[last] === file.end,
      first: !seen.has(file.programId),
    });
    seen.add(file.programId);
  }
  const lanes = [...new Set(bands.map((band) => band.lane))].sort((a, b) => a - b);
  bands.forEach((band) => (band.lane = lanes.indexOf(band.lane)));
  return { bands, lanes: lanes.length, covered };
}
