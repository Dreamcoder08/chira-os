/**
 * Pure planning for a field session: which accounts to create and which
 * synthetic parcels each technician needs. Kept separate from the database work
 * so the naming and numbering rules can be tested without a pool.
 *
 * Names are deliberately generic ("Técnico 1"). The real names belong on the
 * signed session record, not in a database that a demo resets.
 */
export type SessionAccount = {
  email: string;
  name: string;
  role: 'technician' | 'coordinator';
};

export type SessionParcel = {
  name: string;
  producerName: string;
  crop: string;
  hectares: number;
  longitude: number;
  latitude: number;
  /** Index of the technician this parcel is assigned to, 1-based. */
  technician: number;
};

export type SessionPlan = {
  accounts: SessionAccount[];
  parcels: SessionParcel[];
};

/** Center of the Chira valley used by the demo fixtures. */
const base = { longitude: -80.65, latitude: -4.84 };

export function validateSessionInput(input: {
  slug: string;
  technicians: number;
}): string[] {
  const errors: string[] = [];
  if (!/^[a-z0-9][a-z0-9-]{2,39}$/.test(input.slug))
    errors.push(
      `--slug must be 3 to 40 lowercase letters, digits or hyphens, got "${input.slug}"`,
    );
  if (!Number.isInteger(input.technicians) || input.technicians < 1)
    errors.push('--technicians must be a whole number of at least 1');
  if (input.technicians > 8) errors.push('--technicians must be 8 or fewer');
  return errors;
}

export function buildSessionPlan(input: {
  slug: string;
  technicians: number;
}): SessionPlan {
  const errors = validateSessionInput(input);
  if (errors.length > 0) throw new Error(errors.join('\n'));
  const accounts: SessionAccount[] = [
    {
      email: `${input.slug}-coordinador@chira.local`,
      name: 'Coordinador',
      role: 'coordinator',
    },
  ];
  const parcels: SessionParcel[] = [];
  for (let index = 1; index <= input.technicians; index += 1) {
    accounts.push({
      email: `${input.slug}-tec${index}@chira.local`,
      name: `Técnico ${index}`,
      role: 'technician',
    });
    parcels.push({
      name: `Lote ${index} · Demostración`,
      producerName: 'Productor sintético',
      crop: 'Banano orgánico',
      hectares: 2.4,
      // One hundredth of a degree apart, about 1.1 km, so the parcels do not
      // overlap on the local map.
      longitude: base.longitude - index * 0.01,
      latitude: base.latitude + index * 0.01,
      technician: index,
    });
  }
  return { accounts, parcels };
}
