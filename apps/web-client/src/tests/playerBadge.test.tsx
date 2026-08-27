import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PlayerBadge } from '../features/multiplayer/PlayerBadge';

describe('PlayerBadge Component', () => {
  it('should render player slot index and color accurately', () => {
    const html0 = renderToStaticMarkup(<PlayerBadge playerIndex={0} playerColor="#00E5FF" />);
    expect(html0).toContain('P1');
    expect(html0).toContain('#00E5FF');

    const html1 = renderToStaticMarkup(<PlayerBadge playerIndex={1} playerColor="#FF007F" />);
    expect(html1).toContain('P2');
    expect(html1).toContain('#FF007F');

    const html2 = renderToStaticMarkup(<PlayerBadge playerIndex={2} playerColor="#FFE600" />);
    expect(html2).toContain('P3');
    expect(html2).toContain('#FFE600');

    const html3 = renderToStaticMarkup(<PlayerBadge playerIndex={3} playerColor="#00FF66" />);
    expect(html3).toContain('P4');
    expect(html3).toContain('#00FF66');
  });

  it('should render battery telemetry when present', () => {
    const htmlWithBattery = renderToStaticMarkup(
      <PlayerBadge playerIndex={0} batteryLevel={88} isCharging={true} />,
    );
    expect(htmlWithBattery).toContain('88%');
    expect(htmlWithBattery).toContain('⚡');

    const htmlNotCharging = renderToStaticMarkup(
      <PlayerBadge playerIndex={1} batteryLevel={45} isCharging={false} />,
    );
    expect(htmlNotCharging).toContain('45%');
    expect(htmlNotCharging).toContain('🔋');
  });
});
