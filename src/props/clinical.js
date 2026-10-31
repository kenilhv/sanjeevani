// Every clinical prop in the catalog. The modelling lives in the clinical-* siblings, grouped by department.
import { registerBeds } from './clinical-bed.js';
import { registerCare } from './clinical-care.js';
import { registerImaging } from './clinical-imaging.js';
import { registerTheatre } from './clinical-theatre.js';
import { registerLab } from './clinical-lab.js';

export function registerClinicalProps() {
  registerBeds();
  registerCare();
  registerImaging();
  registerTheatre();
  registerLab();
}
