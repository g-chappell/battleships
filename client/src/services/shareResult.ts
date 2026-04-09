const W = 600;
const H = 400;

interface ShareData {
  isVictory: boolean;
  turns: number;
  accuracy: number;
  shipsSunk: number;
  shipsLost: number;
  ratingDelta?: number;
}

export async function generateShareImage(data: ShareData): Promise<Blob | null> {
  const canvas = new OffscreenCanvas(W, H);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#1a0a0a');
  bg.addColorStop(1, '#2a1410');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Border
  ctx.strokeStyle = '#8b0000';
  ctx.lineWidth = 3;
  ctx.strokeRect(4, 4, W - 8, H - 8);

  // Title
  ctx.textAlign = 'center';
  ctx.fillStyle = data.isVictory ? '#c41e3a' : '#6b6b6b';
  ctx.font = 'bold 48px serif';
  ctx.fillText(data.isVictory ? 'VICTORY!' : 'DEFEAT', W / 2, 70);

  // Subtitle
  ctx.fillStyle = '#a06820';
  ctx.font = 'italic 16px serif';
  ctx.fillText('Ironclad Waters', W / 2, 100);

  // Stats grid
  const stats = [
    ['Turns', String(data.turns)],
    ['Accuracy', `${data.accuracy}%`],
    ['Ships Sunk', String(data.shipsSunk)],
    ['Ships Lost', String(data.shipsLost)],
  ];

  const startY = 140;
  const colW = 140;
  const startX = (W - colW * 2) / 2;

  stats.forEach(([label, value], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = startX + col * colW + colW / 2;
    const y = startY + row * 80;

    // Box
    ctx.fillStyle = 'rgba(61, 31, 23, 0.6)';
    ctx.beginPath();
    ctx.roundRect(x - 60, y, 120, 60, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(139, 0, 0, 0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Label
    ctx.fillStyle = '#a06820';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label.toUpperCase(), x, y + 18);

    // Value
    ctx.fillStyle = '#e8dcc8';
    ctx.font = 'bold 24px serif';
    ctx.fillText(value, x, y + 48);
  });

  // Rating delta
  if (data.ratingDelta !== undefined) {
    ctx.fillStyle = data.ratingDelta > 0 ? '#2ecc71' : '#c41e3a';
    ctx.font = 'bold 20px serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${data.ratingDelta > 0 ? '+' : ''}${data.ratingDelta} rating`, W / 2, 330);
  }

  // Footer
  ctx.fillStyle = '#d4c4a1';
  ctx.globalAlpha = 0.3;
  ctx.font = '12px sans-serif';
  ctx.fillText('ironclad-waters.com', W / 2, H - 20);
  ctx.globalAlpha = 1;

  return canvas.convertToBlob({ type: 'image/png' });
}
