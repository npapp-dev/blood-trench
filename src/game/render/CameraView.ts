import Phaser from 'phaser';
import { hashString, seededRandom } from './random';

export interface PhotoData {
  label: string;
  signatures: string[];
  danger: number;
  elementId: string;
  textureKey: string;
}

interface CameraViewState {
  photoDevelopMs: number;
  photoData: PhotoData | null;
  targetInFrame: boolean;
}

export class CameraView {
  public readonly rect = new Phaser.Geom.Rectangle(864, 120, 388, 388);
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly overlayGraphics: Phaser.GameObjects.Graphics;
  private readonly photoSprite: Phaser.GameObjects.Image;
  private readonly cameraText: Phaser.GameObjects.Text;
  private readonly targetStatusText: Phaser.GameObjects.Text;

  public constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics();
    this.overlayGraphics = scene.add.graphics();
    this.photoSprite = scene.add
      .image(this.rect.centerX, this.rect.centerY, 'photo-unknown')
      .setDisplaySize(this.rect.width - 24, this.rect.height - 24)
      .setVisible(false);
    this.cameraText = scene.add.text(866, 76, 'EXTERNAL CAMERA // MONOCHROME', {
      fontFamily: 'Courier New',
      fontSize: '16px',
      color: '#e9b8b8',
    });
    this.targetStatusText = scene.add.text(866, 98, 'NO TARGET', {
      fontFamily: 'Courier New',
      fontSize: '14px',
      color: '#ff9ca8',
    });
  }

  public render(state: CameraViewState): void {
    if (state.targetInFrame) {
      this.targetStatusText.setText('TARGET IN FRAME').setColor('#9fe9b6');
    } else {
      this.targetStatusText.setText('NO TARGET').setColor('#ff9ca8');
    }

    this.graphics.clear();
    this.overlayGraphics.clear();
    this.graphics.fillStyle(0x060202, 1);
    this.graphics.fillRectShape(this.rect);

    if (state.photoDevelopMs > 0) {
      const remaining = Math.ceil(state.photoDevelopMs / 1000);
      this.cameraText.setText(`DEVELOPING IMAGE // ${remaining}s`);
      this.photoSprite.setVisible(false);
      this.drawOverlay();
      return;
    }

    this.cameraText.setText('EXTERNAL CAMERA // MONOCHROME');
    if (!state.photoData) {
      this.photoSprite.setVisible(false);
      this.drawOverlay();
      return;
    }

    this.photoSprite.setTexture(state.photoData.textureKey).setVisible(true);
    this.drawOverlay(hashString(state.photoData.elementId), true);
    this.cameraText.setText(`PHOTO: ${state.photoData.label} // danger ${state.photoData.danger.toFixed(2)}`);
  }

  private drawOverlay(seed?: number, photoVisible = false): void {
    const random = seed === undefined ? Math.random : seededRandom(seed);
    this.overlayGraphics.lineStyle(1, 0xeb9ead, 0.8);
    this.overlayGraphics.strokeRect(this.rect.x + 18, this.rect.y + 18, this.rect.width - 36, this.rect.height - 36);
    this.overlayGraphics.lineStyle(1, 0xe4a8b4, 0.28);
    this.overlayGraphics.strokeLineShape(
      new Phaser.Geom.Line(this.rect.centerX - 20, this.rect.centerY, this.rect.centerX + 20, this.rect.centerY),
    );
    this.overlayGraphics.strokeLineShape(
      new Phaser.Geom.Line(this.rect.centerX, this.rect.centerY - 20, this.rect.centerX, this.rect.centerY + 20),
    );

    const scanlineStep = photoVisible ? 5 : 3;
    const scanlineAlpha = photoVisible ? 0.006 : 0.012;
    for (let y = this.rect.y + 20; y < this.rect.bottom - 20; y += scanlineStep) {
      this.overlayGraphics.fillStyle(0xffe5ea, scanlineAlpha + random() * 0.01);
      this.overlayGraphics.fillRect(this.rect.x + 18, y, this.rect.width - 36, 1);
    }
    const noiseCount = photoVisible ? 28 : 160;
    for (let index = 0; index < noiseCount; index += 1) {
      const x = this.rect.x + 18 + random() * (this.rect.width - 36);
      const y = this.rect.y + 18 + random() * (this.rect.height - 36);
      this.overlayGraphics.fillStyle(0xffffff, (photoVisible ? 0.018 : 0.05) + random() * 0.06);
      this.overlayGraphics.fillRect(x, y, 1, 1);
    }
  }
}
