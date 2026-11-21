// Zooming the receipt picture keeps the spot you pointed at under your pointer. Run with: npm test
import { scrollForAnchor, ZOOMS } from '../src/components/receipt/PictureViewer.jsx';

describe('scrollForAnchor', () => {
  it('puts the spot you pointed at back under the pointer', () => {
    // Pointer 300px from the left and 200px from the top of the box, over the middle of the picture (0.5, 0.5).
    // The picture is now 1600 x 2400 px, so its middle is at 800, 1200. To keep that under the pointer, scroll to 500, 1000.
    expect(scrollForAnchor({ fx: 0.5, fy: 0.5, px: 300, py: 200 }, 1600, 2400)).toEqual({ left: 500, top: 1000 });
  });

  it('never scrolls to a negative spot (a point near the top-left corner stays at 0)', () => {
    expect(scrollForAnchor({ fx: 0.05, fy: 0.02, px: 300, py: 200 }, 1600, 2400)).toEqual({ left: 0, top: 0 });
  });

  it('a point at the bottom-right scrolls to the far corner', () => {
    expect(scrollForAnchor({ fx: 1, fy: 1, px: 400, py: 300 }, 1000, 1500)).toEqual({ left: 600, top: 1200 });
  });
});

describe('zoom steps', () => {
  it('start at fit and grow to 4x', () => {
    expect(ZOOMS[0]).toBe(1);
    expect(ZOOMS[ZOOMS.length - 1]).toBe(4);
  });
});
