# GAARII Ops Runbooks (task 3.5)

Living documents — drill quarterly, update after every incident.

## Receiving day

1. Open `/warehouse` → "Receive against PO". Verify PO id + supplier against the delivery manifest.
2. QC each pallet against the garri quality spec (moisture, sourness grade, grit, packaging integrity). Sample 1 bag per 20.
3. Enter quantity, **lot code from the supplier bag print**, and best-by date. Check "QC pass" only if the sample passes; otherwise leave unchecked and note the failure — rejected units never enter stock and stay outstanding on the PO.
4. Photograph any failed pallet; email supplier same day (fast-pay clock only starts on accepted units).

## Delivery day (pick/pack/ship)

1. `/warehouse` → "Generate wave & pick". The system allocates FEFO (first-expired-first-out) automatically — never hand-pick around it.
2. Pack to the plan weight (Starter 3–5 lb / Family 10–15 lb / Stock-Up 20–25 lb), include the batch card, seal.
3. "Ship" each packed order — tracking is issued and the subscriber is notified automatically.
4. Mark delivered on carrier confirmation (until the carrier webhook lands, this is manual at end of day).

## Recall drill (target: < 5 minutes lot → households)

1. Admin → recall query with the lot code (or `caller.admin.recall({ lotCode })`).
2. Output = every order and subscriber email that received units from the lot.
3. Notify affected subscribers via the notification template, process refunds (below), quarantine remaining lot stock with an ADJUST txn (reason: `recall-<lotCode>`).
4. Drill this quarterly with a dummy lot; record the stopwatch time here: ______

## Quality-guarantee refund (refund without return)

1. Admin → refund with the order id + reason code (`quality-*`, `damaged-parcel`, `late-*`). Full amount, no return shipping — the guarantee is the brand.
2. Reason codes feed the spoilage/quality dashboard; 3+ refunds on one lot triggers the recall drill above.
3. Refund events are demand signal — never delete them.
