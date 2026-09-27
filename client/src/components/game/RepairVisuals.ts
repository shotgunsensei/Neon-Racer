import type { RepairState } from "./RepairRoutine";

// A maintenance crew on the forward service deck, seen through the canopy.
export function drawRepairBay(ctx: CanvasRenderingContext2D, repair: RepairState, now: number, width: number, reducedMotion: boolean) {
  const fixed = reducedMotion ? 0 : now / 1000;
  const restored = ["success", "depart"].includes(repair.phase);
  const energy = restored ? "#67ede0" : "#ffae64";
  ctx.save();
  const background = ctx.createLinearGradient(0, 0, 0, 1000);
  background.addColorStop(0, "#040914"); background.addColorStop(.65, "#182735"); background.addColorStop(1, "#060c16");
  ctx.fillStyle = background; ctx.fillRect(0, 0, width, 1000);
  ctx.strokeStyle = "#2a4050"; ctx.lineWidth = 2;
  for (let x = 70; x < width; x += 150) {
    ctx.beginPath(); ctx.moveTo(x, 60); ctx.lineTo(x, 560); ctx.lineTo(width / 2 + (x - width / 2) * 2, 1000); ctx.stroke();
    ctx.fillStyle = "#56847f"; ctx.fillRect(x + 12, 240, 3, 80);
  }
  ctx.strokeStyle = "#355462";
  ctx.beginPath(); ctx.moveTo(0, 560); ctx.lineTo(width, 560); ctx.stroke();
  const glow = ctx.createRadialGradient(width / 2, 490, 10, width / 2, 490, 400);
  glow.addColorStop(0, restored ? "#67ede01e" : "#ffae6419"); glow.addColorStop(1, "#00000000");
  ctx.fillStyle = glow; ctx.fillRect(0, 100, width, 700);

  ctx.translate(width / 2 - 400, 0);
  // Engine cradle and cutaway turbine housing.
  ctx.fillStyle = "#080e16"; ctx.beginPath(); ctx.ellipse(423, 626, 260, 23, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#273c49"; ctx.fillRect(305, 510, 16, 108); ctx.fillRect(578, 510, 16, 108);
  ctx.fillStyle = "#5a7080"; ctx.fillRect(272, 606, 92, 10); ctx.fillRect(547, 606, 81, 10);
  const housing = ctx.createLinearGradient(0, 365, 0, 537);
  housing.addColorStop(0, "#718596"); housing.addColorStop(.27, "#2b4255"); housing.addColorStop(.56, "#172b3c"); housing.addColorStop(1, "#071320");
  ctx.fillStyle = housing; ctx.strokeStyle = "#8196a3"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(330, 360); ctx.lineTo(576, 386); ctx.lineTo(652, 416); ctx.lineTo(652, 484); ctx.lineTo(576, 522); ctx.lineTo(330, 542); ctx.closePath(); ctx.fill(); ctx.stroke();
  for (let x = 370; x < 602; x += 28) {
    ctx.strokeStyle = x < 500 ? "#72919f" : "#3a5266";
    ctx.beginPath(); ctx.moveTo(x, 372 + (x - 370) * .13); ctx.lineTo(x, 531 - (x - 370) * .1); ctx.stroke();
  }
  ctx.fillStyle = "#101c28"; ctx.strokeStyle = "#7b99a7"; ctx.lineWidth = 8;
  ctx.beginPath(); ctx.ellipse(330, 450, 76, 95, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.save(); ctx.translate(330, 450); ctx.scale(.78, 1); ctx.rotate(fixed * (restored ? 3 : .18));
  for (let blade = 0; blade < 12; blade++) {
    ctx.rotate(Math.PI / 6); ctx.fillStyle = blade % 2 ? "#395467" : "#577485";
    ctx.beginPath(); ctx.moveTo(15, -4); ctx.quadraticCurveTo(45, -37, 76, -12); ctx.lineTo(80, 6); ctx.quadraticCurveTo(47, -3, 19, 14); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = "#c3d1d5"; ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = energy; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(403, 398); ctx.lineTo(447, 371); ctx.lineTo(556, 387); ctx.stroke();
  ctx.fillStyle = "#081320"; ctx.fillRect(439, 423, 104, 58); ctx.strokeStyle = "#526977"; ctx.lineWidth = 2; ctx.strokeRect(439, 423, 104, 58);
  ctx.fillStyle = energy; ctx.font = "12px monospace"; ctx.textAlign = "left"; ctx.fillText("ION DRIVE", 452, 444);
  for (let i = 0; i < 5; i++) { ctx.fillStyle = i <= repair.round || restored ? energy : "#293b47"; ctx.fillRect(452 + i * 16, 457, 10, 6); }

  // Mechanic: boots, reinforced suit, helmet visor, articulated wrench arm.
  const work = Math.sin(fixed * 7) * (restored ? 0 : 9);
  ctx.lineCap = "round";
  const limb = (points: [number, number][], color: string, size: number) => {
    ctx.strokeStyle = color; ctx.lineWidth = size; ctx.beginPath(); points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
  };
  limb([[215, 501], [201, 548], [195, 606]], "#365060", 29);
  limb([[244, 501], [265, 550], [277, 606]], "#293e50", 29);
  limb([[183, 613], [207, 613]], "#070e17", 20); limb([[269, 613], [294, 613]], "#070e17", 20);
  ctx.fillStyle = "#d79048"; ctx.beginPath(); ctx.moveTo(207, 403); ctx.lineTo(246, 397); ctx.lineTo(267, 498); ctx.quadraticCurveTo(225, 521, 195, 497); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#344a59"; ctx.fillRect(208, 437, 32, 44); ctx.fillStyle = "#a7d6d5"; ctx.fillRect(214, 443, 20, 5);
  limb([[246, 418], [267, 459], [292, 467]], "#7f5c3b", 20);
  limb([[213, 420], [253, 404 + work], [292, 379 + work]], "#e2a654", 23);
  limb([[286, 381 + work], [299, 377 + work]], "#d5e1df", 17);
  // The wrench remains a clear open-jaw silhouette at the bolt.
  ctx.save(); ctx.translate(301, 377 + work); ctx.rotate(-.48 + work * .013);
  limb([[-6, 17], [26, -33]], "#b9d2d9", 9);
  ctx.strokeStyle = "#d7e8e9"; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(31, -41, 12, -.05, Math.PI * 1.45); ctx.stroke(); ctx.restore();
  ctx.fillStyle = "#cb8e49"; ctx.beginPath(); ctx.ellipse(220, 372, 28, 33, -.24, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#081f2f"; ctx.beginPath(); ctx.ellipse(230, 370, 23, 14, -.13, 0, Math.PI * 2); ctx.fill();
  limb([[216, 365], [242, 364]], "#78eee2", 3);
  // Small work sparks; no flashing when reduced motion is requested.
  if (!reducedMotion && !restored && repair.phase !== "failure") {
    for (let i = 0; i < 5; i++) {
      const life = (fixed * 2 + i * .2) % 1;
      ctx.globalAlpha = 1 - life; ctx.strokeStyle = "#ffd99b"; ctx.lineWidth = 2;
      const x = 335 + Math.cos(i * 1.7) * life * 55, y = 343 + life * life * 67;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 3, y + 6); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = "#86a3b3"; ctx.font = "12px monospace"; ctx.textAlign = "center"; ctx.fillText("FORWARD SERVICE DECK  /  ENGINE 01", 420, 655);
  ctx.restore();
}
