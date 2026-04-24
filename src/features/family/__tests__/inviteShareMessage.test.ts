import { buildInviteMailtoUrl, buildInviteShareMessage } from '../inviteShareMessage';

describe('inviteShareMessage', () => {
  it('buildInviteShareMessage includes token and invitee email', () => {
    const msg = buildInviteShareMessage('abc-123', 'friend@example.com');
    expect(msg).toContain('abc-123');
    expect(msg).toContain('friend@example.com');
    expect(msg).toContain('Have an invite code? Join your family');
  });

  it('buildInviteMailtoUrl encodes subject and uses same body as share message', () => {
    const url = buildInviteMailtoUrl('friend@example.com', 'tok');
    expect(url.startsWith('mailto:friend@example.com?')).toBe(true);
    expect(url).toContain('subject=');
    expect(url).toContain('body=');
    const bodyParam = url.match(/body=([^&]+)/)?.[1];
    expect(bodyParam).toBeDefined();
    expect(decodeURIComponent(bodyParam!)).toBe(buildInviteShareMessage('tok', 'friend@example.com'));
  });
});
