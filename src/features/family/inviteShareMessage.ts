/** Single source for share sheet, clipboard, and mailto body text. */
export function buildInviteShareMessage(token: string, invitee: string): string {
  return (
    `You're invited to Kin (family care app).\n\n` +
    `Use this invite code in the app under "Have an invite code? Join your family":\n${token}\n\n` +
    `Sign up or sign in with this same email address: ${invitee}`
  );
}

export function buildInviteMailtoUrl(invitee: string, token: string): string {
  const subject = encodeURIComponent('Invitation to join Kin');
  const body = encodeURIComponent(buildInviteShareMessage(token, invitee));
  return `mailto:${invitee}?subject=${subject}&body=${body}`;
}
