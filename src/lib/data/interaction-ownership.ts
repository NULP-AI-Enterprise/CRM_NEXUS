/** An Interaction has no userId of its own — ownership is via whichever of
 * its four optional parents (Contact, ContactConnection, Company, Community)
 * is set. Every read/write that resolves "is this the user's own interaction"
 * needs all four arms, so this is the one place that invariant is spelled
 * out — every call site imports this instead of re-typing the OR clause. */
export function interactionOwnerConditions(userId: string) {
  return [
    { contact: { userId } },
    { connection: { userId } },
    { company: { userId } },
    { community: { userId } },
  ];
}
