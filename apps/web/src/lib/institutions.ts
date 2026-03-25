export const INSTITUTIONS = [
  { full: 'Hebrew University of Jerusalem', abbr: 'HUJI' },
  { full: 'Technion - Israel Institute of Technology', abbr: 'IIT' },
  { full: 'Weizmann Institute of Science', abbr: 'WIS' },
  { full: 'Bar-Ilan University', abbr: 'BIU' },
  { full: 'Tel Aviv University', abbr: 'TAU' },
  { full: 'University of Haifa', abbr: 'HU' },
  { full: 'Ben-Gurion University of the Negev', abbr: 'BGU' },
  { full: 'Open University of Israel', abbr: 'OPENU' },
  { full: 'Ariel University', abbr: 'AU' },
  { full: 'Reichman University', abbr: 'RU' },
  { full: 'Kiryat Shmona University', abbr: 'UKS' },
] as const;

/** Returns the full name for a known abbreviation, or the input unchanged. */
export function getFullName(abbr: string): string {
  return INSTITUTIONS.find((i) => i.abbr === abbr)?.full ?? abbr;
}
