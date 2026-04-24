import {
  shouldFireRefillBecameLow,
} from '../medicationRefillNotifications';

describe('shouldFireRefillBecameLow', () => {
  it('fires for new row when already low', () => {
    expect(
      shouldFireRefillBecameLow(null, { quantity_remaining: 3, refill_threshold: 5 }),
    ).toBe(true);
  });
  it('does not fire when not low', () => {
    expect(
      shouldFireRefillBecameLow(null, { quantity_remaining: 10, refill_threshold: 5 }),
    ).toBe(false);
  });
  it('fires when crossing into low', () => {
    expect(
      shouldFireRefillBecameLow(
        { quantity_remaining: 6, refill_threshold: 5 },
        { quantity_remaining: 5, refill_threshold: 5 },
      ),
    ).toBe(true);
  });
  it('does not fire when already low', () => {
    expect(
      shouldFireRefillBecameLow(
        { quantity_remaining: 5, refill_threshold: 5 },
        { quantity_remaining: 4, refill_threshold: 5 },
      ),
    ).toBe(false);
  });
});
