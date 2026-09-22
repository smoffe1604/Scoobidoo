const LABELS: Record<string, string> = {
  agricultural: "landbrug",
  commercial: "erhverv",
  industrial: "industri",
  public: "offentlig",
  residential: "bolig",
  fire: "brand",
  flood: "oversvømmelse",
  hail: "hagl",
  storm: "storm",
  subsidence: "sætning",
  settled: "afsluttet",
  open: "åben",
  withdrawn: "trukket tilbage",
  declined: "afvist",
};

export function danishLabel(value: string): string {
  return LABELS[value] ?? value;
}
