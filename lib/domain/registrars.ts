/** Contact addresses as printed on each registrar's e-dividend mandate form. */
export const REGISTRARS: { name: string; email: string }[] = [
  { name: "Africa Prudential Registrars", email: "info@africaprudentialregistrars.com" },
  { name: "Apel Capital Registrars", email: "registrars@apel.ng" },
  { name: "Atlas Registrars", email: "registrars@atlasregistrars.com" },
  { name: "CardinalStone Registrars", email: "registrars@cardinalstone.com" },
  { name: "Carnation Registrars", email: "info@carnationregistrars.com" },
  { name: "Centurion Registrars", email: "cusomercare@centurionregistrars.com" },
  { name: "Cordros Registrars", email: "contactcentre@cordros.com" },
  { name: "Coronation Registrars", email: "customercare@coronationregistrars.com" },
  { name: "Datamax Registrars", email: "datamax@datamaxregistrars.com" },
  { name: "EDC Registrars", email: "EdcRegComplaints@ecobank.com" },
  { name: "First Registrars", email: "info@firstregistrarsnigeria.com" },
  { name: "Flour Mills Registrars", email: "registrars@fmnregistrar.com" },
  { name: "Greenwich Registrars", email: "info@gtlregistrars.com" },
  { name: "Lancelot Registrars", email: "info@lancelotregistrars.com" },
  { name: "Lighthouse Registrars", email: "info@lighthousereg.com" },
  { name: "MainstreetBank Registrars", email: "mainstreetregistrars@yahoo.com" },
  { name: "Meristem Registrars", email: "info@meristemregistrars.com" },
  { name: "PAC Registrars", email: "info@pacregistrars.com" },
  { name: "Pace Registrars", email: "info@paceregistrars.com" },
  { name: "Unity Registrars", email: "info@unityregistrarsng.com" },
  { name: "Veritas Registrars", email: "enquiry@veritasregistrars.com" },
];

export function registrarEmail(name: string): string {
  const hit = REGISTRARS.find((r) => r.name.toLowerCase() === name.toLowerCase());
  return hit ? hit.email : "";
}
