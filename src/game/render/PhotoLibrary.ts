import Phaser from 'phaser';
import { PHOTO_DISTANCE } from '../constants';
import type { Hazard, Objective, Vec2 } from '../types';
import { hashString, seededRandom } from './random';

export type PhotoMotif =
  | 'spires'
  | 'arch'
  | 'ribcage'
  | 'eye'
  | 'facade'
  | 'face'
  | 'anomaly'
  | 'choir'
  | 'tower'
  | 'gate'
  | 'fleshman';

export interface PhotoTemplate {
  textureKey: string;
  label: string;
  signatures: string[];
  danger: number;
  motif: PhotoMotif;
  seed: number;
  clarity: number;
}

const SOURCE_W = 768;
const SOURCE_H = 768;
const TEXTURE_W = 352;
const TEXTURE_H = 352;
const VIEW_BUCKETS = 8;

const MOTIF_BY_LABEL: Record<string, PhotoMotif> = {
  CHOIR: 'choir',
  ALTAR: 'arch',
  TOWER: 'tower',
  SPINE: 'ribcage',
  GATE: 'gate',
  NEST: 'face',
  ORBIT: 'arch',
  VEIL: 'facade',
};

export class PhotoLibrary {
  public readonly viewBuckets = VIEW_BUCKETS;
  private readonly templates = new Map<string, PhotoTemplate>();
  private readonly scene: Phaser.Scene;

  public constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  public build(objectives: Objective[], hazards: Hazard[]): void {
    this.createFallbackPhoto('photo-unknown');

    objectives.forEach((objective) => {
      const signatures = [`SITE-${objective.label}`, 'STATIC', 'VOID'];
      const localDanger = estimateDanger(objective.position, hazards);
      const motif = MOTIF_BY_LABEL[objective.label] ?? 'facade';
      const clarity = objective.label === 'ALTAR' ? 1.58 : objective.label === 'GATE' ? 1.4 : 1.18;
      this.createDirectionalTemplates(`objective:${objective.id}`, objective.id, signatures, localDanger, motif, clarity);
    });

    hazards.forEach((hazard) => {
      const label = `CONTACT-${hazard.id}`;
      const signatures = [`${hazard.kind.toUpperCase()}-${hazard.radius.toFixed(0)}`, 'MOTION', 'BIO'];
      const danger = 0.6 + hazard.radius / 70;
      const motif = pickHazardMotif(hazard);
      this.createDirectionalTemplates(`hazard:${hazard.id}`, label, signatures, danger, motif, 0.98);
    });
  }

  public get(elementId: string): PhotoTemplate | undefined {
    return this.templates.get(elementId);
  }

  private createDirectionalTemplates(
    baseElementId: string,
    label: string,
    signatures: string[],
    danger: number,
    motif: PhotoMotif,
    clarity: number,
  ): void {
    for (let bucket = 0; bucket < this.viewBuckets; bucket += 1) {
      const elementId = `${baseElementId}:v${bucket}`;
      const template: PhotoTemplate = {
        textureKey: `photo-${elementId.replace(/[:]/g, '-')}`,
        label,
        signatures,
        danger,
        motif,
        seed: hashString(elementId),
        clarity,
      };
      this.templates.set(elementId, template);
      this.renderPhotoTemplate(template);
    }
  }

  private createFallbackPhoto(textureKey: string): void {
    const texture = this.scene.textures.createCanvas(textureKey, TEXTURE_W, TEXTURE_H);
    if (!texture) {
      return;
    }
    const ctx = texture.context;
    ctx.fillStyle = '#120709';
    ctx.fillRect(0, 0, TEXTURE_W, TEXTURE_H);
    ctx.strokeStyle = 'rgba(248,210,220,0.4)';
    ctx.lineWidth = 3;
    ctx.strokeRect(24, 24, 304, 304);
    ctx.fillStyle = 'rgba(255,220,230,0.45)';
    ctx.fillRect(140, 170, 72, 2);
    ctx.fillRect(175, 135, 2, 72);
    texture.refresh();
  }

  private renderPhotoTemplate(template: PhotoTemplate): void {
    if (this.scene.textures.exists(template.textureKey)) {
      this.scene.textures.remove(template.textureKey);
    }
    const texture = this.scene.textures.createCanvas(template.textureKey, TEXTURE_W, TEXTURE_H);
    if (!texture) {
      return;
    }
    const ctx = texture.context;
    const random = seededRandom(template.seed);
    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = SOURCE_W;
    sourceCanvas.height = SOURCE_H;
    const sourceCtx = sourceCanvas.getContext('2d');
    if (!sourceCtx) {
      return;
    }

    const ambient = sourceCtx.createLinearGradient(0, 0, 0, SOURCE_H);
    ambient.addColorStop(0, 'rgba(18, 20, 24, 1)');
    ambient.addColorStop(0.55, 'rgba(10, 12, 16, 1)');
    ambient.addColorStop(1, 'rgba(2, 3, 5, 1)');
    sourceCtx.fillStyle = ambient;
    sourceCtx.fillRect(0, 0, SOURCE_W, SOURCE_H);

    const coneLight = sourceCtx.createRadialGradient(
      SOURCE_W * (0.48 + (random() - 0.5) * 0.08),
      SOURCE_H * 0.22,
      18,
      SOURCE_W * 0.5,
      SOURCE_H * 0.34,
      SOURCE_W * 0.62,
    );
    coneLight.addColorStop(0, 'rgba(250, 250, 255, 0.24)');
    coneLight.addColorStop(1, 'rgba(250, 250, 255, 0)');
    sourceCtx.fillStyle = coneLight;
    sourceCtx.fillRect(0, 0, SOURCE_W, SOURCE_H);

    drawBathymetryBands(sourceCtx, SOURCE_W, SOURCE_H, random);
    drawTemplateMotif3D(sourceCtx, template, SOURCE_W, SOURCE_H);
    addWaterScattering(sourceCtx, SOURCE_W, SOURCE_H, random);
    addSeabedHaze(sourceCtx, SOURCE_W, SOURCE_H, random, template.danger / template.clarity);
    addFineNoise(sourceCtx, SOURCE_W, SOURCE_H, random, 2200);
    addScanlines(sourceCtx, SOURCE_W, SOURCE_H, random);
    applyMonochromeGrade(sourceCtx, SOURCE_W, SOURCE_H, 1.22 * template.clarity);
    posterizeAndDither(sourceCtx, SOURCE_W, SOURCE_H, random, template.clarity > 1.3 ? 40 : 32);
    applySharpen(sourceCtx, SOURCE_W, SOURCE_H, 0.72);
    addLensVignette(sourceCtx, SOURCE_W, SOURCE_H, template.danger);
    addDeterministicStatic(sourceCtx, SOURCE_W, SOURCE_H, random, template.danger * 0.35);
    ctx.clearRect(0, 0, TEXTURE_W, TEXTURE_H);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(sourceCanvas, 0, 0, SOURCE_W, SOURCE_H, 0, 0, TEXTURE_W, TEXTURE_H);
    applySharpen(ctx, TEXTURE_W, TEXTURE_H, 0.4);
    addFineNoise(ctx, TEXTURE_W, TEXTURE_H, random, 160);
    addDeterministicStatic(ctx, TEXTURE_W, TEXTURE_H, random, template.danger * 0.12);
    drawPhotoStamp(ctx, template, TEXTURE_H);

    texture.refresh();
  }
}

function estimateDanger(position: Vec2, hazards: Hazard[]): number {
  const nearby = hazards.filter(
    (hazard) => Phaser.Math.Distance.Between(position.x, position.y, hazard.position.x, hazard.position.y) < PHOTO_DISTANCE * 2.3,
  );
  return nearby.reduce((sum, hazard) => sum + hazard.radius, 0) / 170;
}

function pickHazardMotif(hazard: Hazard): PhotoMotif {
  if (hazard.id.startsWith('MN-')) {
    return 'eye';
  }
  if (hazard.kind === 'flesh') {
    return 'fleshman';
  }
  return 'anomaly';
}

function drawTemplateMotif3D(ctx: CanvasRenderingContext2D, template: PhotoTemplate, width: number, height: number): void {
  const layers = 6;
  for (let layer = 0; layer < layers; layer += 1) {
    const depth = layer / (layers - 1);
    const scale = 0.82 + depth * 0.24;
    const yOffset = (1 - depth) * 62 - 18;
    const xOffset = (depth - 0.5) * 18;
    const alpha = 0.12 + depth * 0.2;
    const blur = 9 - depth * 7;

    ctx.save();
    ctx.translate(width * 0.5 + xOffset, height * 0.5 + yOffset);
    ctx.scale(scale, scale);
    ctx.translate(-width * 0.5, -height * 0.5);
    ctx.globalAlpha = alpha;
    ctx.filter = `blur(${blur.toFixed(2)}px)`;
    drawTemplateMotif(ctx, template, seededRandom(template.seed + layer * 1777), width, height);
    ctx.restore();
  }

  // Sharp foreground pass to keep identifiable silhouette.
  ctx.save();
  ctx.globalAlpha = 0.9;
  drawTemplateMotif(ctx, template, seededRandom(template.seed + 99991), width, height);
  ctx.restore();
}

function drawTemplateMotif(
  ctx: CanvasRenderingContext2D,
  template: PhotoTemplate,
  random: () => number,
  width: number,
  height: number,
): void {
  const light = `rgba(238, 238, 245, ${0.36 + random() * 0.22})`;
  const mid = `rgba(156, 164, 178, ${0.35 + random() * 0.22})`;
  const dark = `rgba(44, 48, 59, ${0.6 + random() * 0.24})`;

  if (template.motif === 'choir') {
    const baseY = height * 0.72;
    const centerX = width * (0.5 + (random() - 0.5) * 0.08);
    const pillarCount = 7;

    ctx.strokeStyle = 'rgba(220, 230, 246, 0.85)';
    ctx.lineWidth = 4;
    for (let i = 0; i < pillarCount; i += 1) {
      const t = i / (pillarCount - 1);
      const x = centerX - 140 + t * 280 + (random() - 0.5) * 8;
      const h = 70 + Math.sin(t * Math.PI) * 110 + random() * 14;
      ctx.beginPath();
      ctx.moveTo(x, baseY);
      ctx.lineTo(x, baseY - h);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(150, 165, 188, 0.62)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 7, baseY - h + 4);
      ctx.lineTo(x + 7, baseY - h + 4);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(220, 230, 246, 0.85)';
      ctx.lineWidth = 4;
    }

    ctx.strokeStyle = 'rgba(198, 212, 234, 0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(centerX - 150, baseY - 20);
    ctx.quadraticCurveTo(centerX, baseY - 130, centerX + 150, baseY - 20);
    ctx.stroke();
    return;
  }

  if (template.motif === 'tower') {
    const cx = width * (0.5 + (random() - 0.5) * 0.07);
    const baseY = height * 0.8;
    const topY = height * 0.16;
    const bodyW = 88 + random() * 18;

    ctx.fillStyle = 'rgba(58, 66, 82, 0.88)';
    ctx.beginPath();
    ctx.moveTo(cx - bodyW * 0.52, baseY);
    ctx.lineTo(cx - bodyW * 0.42, topY + 40);
    ctx.lineTo(cx + bodyW * 0.42, topY + 40);
    ctx.lineTo(cx + bodyW * 0.52, baseY);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(22, 25, 34, 0.94)';
    ctx.beginPath();
    ctx.moveTo(cx - 24, topY + 40);
    ctx.lineTo(cx, topY - 24);
    ctx.lineTo(cx + 24, topY + 40);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(220, 230, 246, 0.75)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - bodyW * 0.34, baseY - 16);
    ctx.lineTo(cx - 4, topY + 52);
    ctx.lineTo(cx + bodyW * 0.34, baseY - 16);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(170, 186, 210, 0.42)';
    ctx.lineWidth = 2;
    for (let y = topY + 62; y < baseY - 10; y += 20) {
      ctx.beginPath();
      ctx.moveTo(cx - bodyW * 0.28, y);
      ctx.lineTo(cx + bodyW * 0.28, y);
      ctx.stroke();
    }
    return;
  }

  if (template.motif === 'spires') {
    const baseY = height * (0.65 + random() * 0.12);
    for (let i = 0; i < 6; i += 1) {
      const px = width * (0.08 + i * 0.15 + random() * 0.05);
      const h = 95 + random() * 140;
      const tw = 22 + random() * 16;
      ctx.fillStyle = dark;
      ctx.beginPath();
      ctx.moveTo(px + (random() - 0.5) * 10, baseY - h);
      ctx.lineTo(px - tw - random() * 14, baseY - random() * 16);
      ctx.lineTo(px + tw + random() * 14, baseY);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = light;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px + (random() - 0.5) * 6, baseY - h + 8);
      ctx.lineTo(px - tw * 0.24, baseY - h * 0.42);
      ctx.stroke();
    }
    return;
  }
  if (template.motif === 'arch') {
    const cx = width * (0.5 + (random() - 0.5) * 0.08);
    const cy = height * 0.58;
    const baseY = cy + 110;

    // Old demonic altar body
    ctx.fillStyle = 'rgba(74, 30, 38, 0.85)';
    ctx.beginPath();
    ctx.moveTo(cx - 90, baseY);
    ctx.lineTo(cx - 62, cy + 18);
    ctx.lineTo(cx + 62, cy + 18);
    ctx.lineTo(cx + 90, baseY);
    ctx.closePath();
    ctx.fill();

    // Top slab
    ctx.fillStyle = 'rgba(120, 44, 56, 0.86)';
    ctx.fillRect(cx - 76, cy - 2, 152, 24);

    // Ritual ring and occult mark
    ctx.strokeStyle = 'rgba(214, 126, 142, 0.92)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(cx, cy - 28, 62, 28, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(236, 174, 188, 0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 62);
    ctx.lineTo(cx, cy + 6);
    ctx.moveTo(cx - 28, cy - 28);
    ctx.lineTo(cx + 28, cy - 28);
    ctx.moveTo(cx - 20, cy - 48);
    ctx.lineTo(cx + 20, cy - 8);
    ctx.moveTo(cx + 20, cy - 48);
    ctx.lineTo(cx - 20, cy - 8);
    ctx.stroke();

    // Horn pillars behind altar
    ctx.strokeStyle = 'rgba(170, 72, 88, 0.86)';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(cx - 84, cy + 14);
    ctx.quadraticCurveTo(cx - 140, cy - 30, cx - 92, cy - 108);
    ctx.moveTo(cx + 84, cy + 14);
    ctx.quadraticCurveTo(cx + 140, cy - 30, cx + 92, cy - 108);
    ctx.stroke();

    // Hanging drips to make it horror-like
    ctx.strokeStyle = 'rgba(130, 38, 48, 0.64)';
    ctx.lineWidth = 2;
    for (let i = -2; i <= 2; i += 1) {
      const x = cx + i * 20;
      const yTop = cy + 20 + Math.abs(i) * 4;
      ctx.beginPath();
      ctx.moveTo(x, yTop);
      ctx.lineTo(x + (random() - 0.5) * 3, yTop + 18 + random() * 14);
      ctx.stroke();
    }
    return;
  }
  if (template.motif === 'ribcage') {
    const sx = width * (0.5 + (random() - 0.5) * 0.08);
    const top = height * 0.18;
    const bottom = height * 0.86;
    const ribCount = 9;

    ctx.save();
    ctx.shadowBlur = 16;
    ctx.shadowColor = 'rgba(220, 235, 255, 0.5)';
    ctx.strokeStyle = 'rgba(210, 226, 250, 0.86)';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(sx, top);
    ctx.lineTo(sx, bottom);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = 'rgba(230, 240, 255, 0.58)';
    for (let vertebra = 0; vertebra < 10; vertebra += 1) {
      const py = top + ((bottom - top) / 10) * vertebra;
      const vw = 8 + Math.max(0, 5 - Math.abs(vertebra - 5));
      const vh = 5 + random() * 3;
      ctx.fillRect(sx - vw * 0.5, py - vh * 0.5, vw, vh);
    }

    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(190, 212, 244, 0.9)';
    for (let r = 0; r < ribCount; r += 1) {
      const t = r / (ribCount - 1);
      const py = top + (bottom - top) * (0.06 + t * 0.76);
      const spread = 22 + Math.sin(t * Math.PI) * 70 + random() * 7;
      const drop = 8 + t * 20 + random() * 5;

      ctx.beginPath();
      ctx.moveTo(sx - 5, py);
      ctx.quadraticCurveTo(sx - spread * 0.5, py - 8, sx - spread, py + drop);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(sx + 5, py);
      ctx.quadraticCurveTo(sx + spread * 0.5, py - 8, sx + spread, py + drop);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(235, 245, 255, 0.42)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx, top - 8);
    ctx.lineTo(sx, bottom + 4);
    ctx.stroke();
    return;
  }
  if (template.motif === 'eye') {
    const cx = width * (0.5 + (random() - 0.5) * 0.08);
    const cy = height * (0.54 + (random() - 0.5) * 0.06);
    ctx.strokeStyle = mid;
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.ellipse(cx, cy, width * 0.24, height * 0.12, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(150, 160, 178, 0.88)';
    ctx.beginPath();
    ctx.arc(cx, cy, 34 + random() * 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(10, 12, 16, 0.98)';
    ctx.beginPath();
    ctx.arc(cx + (random() - 0.5) * 10, cy + (random() - 0.5) * 10, 12 + random() * 7, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  if (template.motif === 'facade') {
    const ox = width * 0.17;
    const oy = height * 0.26;
    const fw = width * 0.66;
    const fh = height * 0.58;
    ctx.strokeStyle = dark;
    ctx.lineWidth = 10;
    ctx.strokeRect(ox, oy, fw, fh);
    ctx.lineWidth = 4;
    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 4; col += 1) {
        const wx = ox + 18 + col * (fw / 4);
        const wy = oy + 18 + row * (fh / 3);
        const ww = 28 + random() * 16;
        const wh = 18 + random() * 12;
        ctx.strokeStyle = `rgba(166, 176, 194, ${0.28 + random() * 0.26})`;
        ctx.strokeRect(wx, wy, ww, wh);
      }
    }
    return;
  }

  if (template.motif === 'gate') {
    const cx = width * (0.5 + (random() - 0.5) * 0.07);
    const baseY = height * 0.82;
    const gateW = 248;
    const gateH = 274;
    const leftX = cx - gateW * 0.5;
    const rightX = cx + gateW * 0.5;
    const topY = baseY - gateH;

    // Outer stone frame
    ctx.strokeStyle = 'rgba(210, 224, 244, 0.86)';
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(leftX, baseY);
    ctx.lineTo(leftX, topY + 26);
    ctx.quadraticCurveTo(cx, topY - 36, rightX, topY + 26);
    ctx.lineTo(rightX, baseY);
    ctx.stroke();

    // Inner opening
    ctx.strokeStyle = 'rgba(90, 102, 124, 0.72)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(leftX + 26, baseY);
    ctx.lineTo(leftX + 26, topY + 46);
    ctx.quadraticCurveTo(cx, topY - 4, rightX - 26, topY + 46);
    ctx.lineTo(rightX - 26, baseY);
    ctx.stroke();

    // Vertical bars
    ctx.strokeStyle = 'rgba(154, 172, 200, 0.84)';
    ctx.lineWidth = 4;
    for (let i = 0; i < 9; i += 1) {
      const x = leftX + 32 + i * ((gateW - 64) / 8);
      const yTop = topY + 52 + Math.sin(i * 0.4) * 6;
      ctx.beginPath();
      ctx.moveTo(x, baseY - 6);
      ctx.lineTo(x, yTop);
      ctx.stroke();
    }

    // Center seam for double doors
    ctx.strokeStyle = 'rgba(226, 238, 252, 0.62)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, baseY - 6);
    ctx.lineTo(cx, topY + 34);
    ctx.stroke();

    // Lock sigil plate
    ctx.strokeStyle = 'rgba(236, 246, 255, 0.58)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, baseY - 38, 16, 0, Math.PI * 2);
    ctx.stroke();
    return;
  }

  if (template.motif === 'anomaly') {
    const cx = width * (0.5 + (random() - 0.5) * 0.1);
    const cy = height * (0.56 + (random() - 0.5) * 0.08);
    ctx.strokeStyle = 'rgba(220, 90, 90, 0.9)';
    ctx.lineWidth = 4;
    for (let i = 0; i < 11; i += 1) {
      const a = (Math.PI * 2 * i) / 11 + random() * 0.1;
      const r1 = 16 + random() * 18;
      const r2 = 58 + random() * 48;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(235, 120, 120, 0.55)';
    ctx.beginPath();
    ctx.arc(cx, cy, 24 + random() * 12, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  if (template.motif === 'fleshman') {
    const cx = width * (0.5 + (random() - 0.5) * 0.08);
    const cy = height * (0.56 + (random() - 0.5) * 0.05);

    // Bloated humanoid torso
    ctx.fillStyle = 'rgba(124, 58, 68, 0.82)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 28, 84, 118, 0, 0, Math.PI * 2);
    ctx.fill();

    // Distended head
    ctx.fillStyle = 'rgba(150, 74, 86, 0.85)';
    ctx.beginPath();
    ctx.ellipse(cx, cy - 66, 46, 56, 0, 0, Math.PI * 2);
    ctx.fill();

    // Swollen shoulder/arm sacs
    ctx.fillStyle = 'rgba(170, 88, 102, 0.68)';
    ctx.beginPath();
    ctx.ellipse(cx - 58, cy + 16, 32, 48, -0.45, 0, Math.PI * 2);
    ctx.ellipse(cx + 58, cy + 16, 32, 48, 0.45, 0, Math.PI * 2);
    ctx.fill();

    // Belly folds / stretched skin lines
    ctx.strokeStyle = 'rgba(234, 158, 174, 0.54)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx - 36, cy - 2);
    ctx.quadraticCurveTo(cx, cy + 16, cx + 36, cy - 2);
    ctx.moveTo(cx - 28, cy + 34);
    ctx.quadraticCurveTo(cx, cy + 54, cx + 28, cy + 34);
    ctx.moveTo(cx - 18, cy + 62);
    ctx.quadraticCurveTo(cx, cy + 78, cx + 18, cy + 62);
    ctx.stroke();

    // Hollow eyes + split mouth cavity
    ctx.fillStyle = 'rgba(46, 14, 20, 0.84)';
    ctx.beginPath();
    ctx.ellipse(cx - 13, cy - 74, 7, 5, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + 13, cy - 74, 7, 5, 0, 0, Math.PI * 2);
    ctx.ellipse(cx, cy - 46, 14, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Leg stumps
    ctx.fillStyle = 'rgba(114, 48, 58, 0.86)';
    ctx.fillRect(cx - 36, cy + 118, 20, 26);
    ctx.fillRect(cx + 16, cy + 118, 20, 26);
    return;
  }

  const cx = width * (0.5 + (random() - 0.5) * 0.08);
  const cy = height * (0.54 + (random() - 0.5) * 0.07);
  ctx.strokeStyle = dark;
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.ellipse(cx, cy, width * 0.18, height * 0.23, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(10, 11, 15, 0.9)';
  ctx.beginPath();
  ctx.ellipse(cx - width * 0.06, cy - height * 0.04, 16, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + width * 0.06, cy - height * 0.04, 16, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx, cy + height * 0.07, 24, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = light;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 30, cy + 32);
  ctx.lineTo(cx + 26, cy + 28);
  ctx.stroke();
}

function drawBathymetryBands(ctx: CanvasRenderingContext2D, width: number, height: number, random: () => number): void {
  for (let layer = 0; layer < 4; layer += 1) {
    const yBase = height * (0.42 + layer * 0.12);
    ctx.fillStyle = `rgba(24, 28, 36, ${0.24 - layer * 0.04})`;
    ctx.beginPath();
    ctx.moveTo(0, height);
    for (let x = 0; x <= width; x += 18) {
      const ridge = yBase + Math.sin((x / width) * Math.PI * (1.7 + layer * 0.5) + random() * 0.9) * (14 + layer * 10);
      ctx.lineTo(x, ridge + random() * 10);
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();
  }
}

function addWaterScattering(ctx: CanvasRenderingContext2D, width: number, height: number, random: () => number): void {
  const beam = ctx.createRadialGradient(width * 0.5, height * 0.22, 6, width * 0.5, height * 0.44, width * 0.7);
  beam.addColorStop(0, 'rgba(220, 240, 255, 0.22)');
  beam.addColorStop(1, 'rgba(220, 240, 255, 0)');
  ctx.fillStyle = beam;
  ctx.fillRect(0, 0, width, height);

  // Volumetric streaks to mimic underwater particles lit by an x-ray-like beam.
  ctx.strokeStyle = 'rgba(195, 218, 255, 0.12)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 45; i += 1) {
    const x = random() * width;
    const y = random() * height;
    const len = 10 + random() * 32;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (random() - 0.5) * 8, y + len);
    ctx.stroke();
  }
}

function addSeabedHaze(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  random: () => number,
  danger: number,
): void {
  const haze = ctx.createLinearGradient(0, height * 0.45, 0, height);
  haze.addColorStop(0, 'rgba(190, 184, 192, 0)');
  haze.addColorStop(1, `rgba(190, 184, 192, ${0.18 + Math.min(0.2, danger * 0.08)})`);
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, width, height);

  for (let i = 0; i < 8; i += 1) {
    const x = random() * width;
    const y = height * (0.45 + random() * 0.45);
    const r = 26 + random() * 70;
    const cloud = ctx.createRadialGradient(x, y, 2, x, y, r);
    cloud.addColorStop(0, `rgba(205, 198, 206, ${0.08 + random() * 0.06})`);
    cloud.addColorStop(1, 'rgba(205, 198, 206, 0)');
    ctx.fillStyle = cloud;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

function addFineNoise(ctx: CanvasRenderingContext2D, width: number, height: number, random: () => number, dots: number): void {
  for (let i = 0; i < dots; i += 1) {
    const x = random() * width;
    const y = random() * height;
    const a = 0.02 + random() * 0.05;
    const v = 110 + Math.floor(random() * 120);
    ctx.fillStyle = `rgba(${v}, ${v}, ${v}, ${a})`;
    ctx.fillRect(x, y, 1, 1);
  }
}

function addScanlines(ctx: CanvasRenderingContext2D, width: number, height: number, random: () => number): void {
  for (let y = 0; y < height; y += 2) {
    ctx.fillStyle = `rgba(0, 0, 0, ${0.05 + random() * 0.03})`;
    ctx.fillRect(0, y, width, 1);
  }
  for (let y = 0; y < height; y += 6) {
    ctx.fillStyle = `rgba(220, 220, 220, ${0.015 + random() * 0.03})`;
    ctx.fillRect(0, y, width, 1);
  }
}

function applyMonochromeGrade(ctx: CanvasRenderingContext2D, width: number, height: number, contrast: number): void {
  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;
  const factor = (259 * (contrast * 60 + 255)) / (255 * (259 - contrast * 60));
  for (let i = 0; i < data.length; i += 4) {
    const lum = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    const c = Math.max(0, Math.min(255, factor * (lum - 128) + 128));
    const xray = c * 0.9;
    data[i] = xray * 0.78;
    data[i + 1] = xray * 0.98;
    data[i + 2] = xray * 1.12;
  }
  ctx.putImageData(image, 0, 0);
}

function addLensVignette(ctx: CanvasRenderingContext2D, width: number, height: number, danger: number): void {
  const vignette = ctx.createRadialGradient(width * 0.5, height * 0.5, width * 0.2, width * 0.5, height * 0.5, width * 0.78);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, `rgba(0,0,0,${0.58 + Math.min(0.24, danger * 0.08)})`);
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
}

function posterizeAndDither(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  random: () => number,
  levels: number,
): void {
  const bayer = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
  ];
  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;
  const step = 255 / Math.max(2, levels - 1);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const value = data[index];
      const threshold = (bayer[y % 4][x % 4] / 16 - 0.5) * step * 0.25 + (random() - 0.5) * 0.6;
      const q = Math.max(0, Math.min(255, Math.round((value + threshold) / step) * step));
      data[index] = q;
      data[index + 1] = q;
      data[index + 2] = q;
    }
  }

  ctx.putImageData(image, 0, 0);
}

function applySharpen(ctx: CanvasRenderingContext2D, width: number, height: number, amount: number): void {
  const source = ctx.getImageData(0, 0, width, height);
  const output = ctx.createImageData(width, height);
  const src = source.data;
  const dst = output.data;
  const centerWeight = 4 + amount;
  dst.set(src);

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = (y * width + x) * 4;
      for (let c = 0; c < 3; c += 1) {
        const value =
          src[i + c] * centerWeight -
          src[i + c - 4] -
          src[i + c + 4] -
          src[i + c - width * 4] -
          src[i + c + width * 4];
        dst[i + c] = Math.max(0, Math.min(255, value));
      }
      dst[i + 3] = src[i + 3];
    }
  }

  ctx.putImageData(output, 0, 0);
}

function addDeterministicStatic(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  random: () => number,
  intensity: number,
): void {
  const flecks = 360 + Math.floor(intensity * 170);
  for (let i = 0; i < flecks; i += 1) {
    const x = Math.floor(random() * width);
    const y = Math.floor(random() * height);
    const bright = 150 + Math.floor(random() * 105);
    const alpha = 0.02 + random() * (0.05 + intensity * 0.02);
    ctx.fillStyle = `rgba(${bright}, ${bright}, ${bright}, ${alpha})`;
    ctx.fillRect(x, y, 1, 1);
  }

  const dropoutLines = 2 + Math.floor(random() * 3);
  for (let line = 0; line < dropoutLines; line += 1) {
    const y = Math.floor(random() * height);
    const h = 1 + Math.floor(random() * 2);
    const alpha = 0.03 + random() * 0.06;
    ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
    ctx.fillRect(0, y, width, h);
  }
}

function drawPhotoStamp(ctx: CanvasRenderingContext2D, template: PhotoTemplate, height: number): void {
  ctx.save();
  ctx.font = '11px Courier New';
  ctx.fillStyle = 'rgba(230, 230, 235, 0.42)';
  ctx.fillText(`SM13-CAM // ${template.label}`, 10, height - 22);
  ctx.fillStyle = 'rgba(230, 230, 235, 0.32)';
  ctx.fillText(`SIG ${template.signatures[0] ?? 'UNKNOWN'}`, 10, height - 9);
  ctx.restore();
}
