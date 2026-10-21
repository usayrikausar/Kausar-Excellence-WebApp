// Stamps every new sale with the unit its daie belongs to AT THE TIME OF THE
// SALE (sales/{id}.unitId). Unit totals follow when a sale happened, not where
// the daie sits today — the Konvensyen sheet's rule: a daie who was under
// Kausar Wealth before Kausar Nusrah split off keeps those earlier sales in
// Kausar Wealth's figures. See lib/data.ts's loadSalesWithUnit().
//
// Imported sales already carry unitId (the sheet tab they came from); this
// covers everything entered in the app (sales forms, closing a prospect).

import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { getFirestore } from 'firebase-admin/firestore';

export const stampSaleUnitOnCreate = onDocumentCreated(
  { document: 'sales/{saleId}', region: 'asia-southeast1' },
  async (event) => {
    const sale = event.data?.data();
    if (!sale || sale.unitId || !sale.uid) return;
    const user = await getFirestore().collection('users').doc(sale.uid).get();
    const unitId = user.exists ? user.data().unitId : null;
    if (unitId) await event.data.ref.set({ unitId }, { merge: true });
  },
);
