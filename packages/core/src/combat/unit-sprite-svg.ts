import {
  getUnitSprite,
  getUnitSpriteDisplayBounds,
  getUnitSpriteDimensions,
  getUnitSpriteFitScale,
  getUnitSpritePlacement,
  getUnitSpriteUrl,
  hasUnitSprite,
  UNIT_SPRITE_CANVAS_SIZE,
} from './unit-sprite.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';

export { hasUnitSprite };

/** Raster unit sprite in canvas space (512×512), scaled to visible content bounds. */
export function createUnitSpriteGroup(unitKey: string): SVGGElement | null {
  const sprite = getUnitSprite(unitKey);
  if (!sprite) {
    return null;
  }

  const bounds = getUnitSpriteDisplayBounds(sprite.id);
  const fitScale = getUnitSpriteFitScale(sprite.id);
  const { width, height } = getUnitSpriteDimensions(sprite.id);
  const { x, y } = getUnitSpritePlacement(sprite);
  const spriteUrl = getUnitSpriteUrl(sprite.id);

  const root = document.createElementNS(SVG_NS, 'g');
  root.setAttribute('class', 'unit-sprite');

  const wrapper = document.createElementNS(SVG_NS, 'g');
  wrapper.setAttribute(
    'transform',
    `translate(${UNIT_SPRITE_CANVAS_SIZE / 2} ${UNIT_SPRITE_CANVAS_SIZE / 2}) scale(${fitScale}) translate(${-bounds.centerX} ${-bounds.centerY})`,
  );

  const image = document.createElementNS(SVG_NS, 'image');
  image.setAttribute('href', spriteUrl);
  image.setAttributeNS(XLINK_NS, 'href', spriteUrl);
  image.setAttribute('class', 'unit-sprite-image');
  image.setAttribute('x', String(x));
  image.setAttribute('y', String(y));
  image.setAttribute('width', String(width));
  image.setAttribute('height', String(height));

  wrapper.appendChild(image);
  root.appendChild(wrapper);
  return root;
}

export function mountUnitSpriteIcon(
  svg: SVGSVGElement,
  unitKey: string,
  scale: number,
  cx = UNIT_SPRITE_CANVAS_SIZE / 2,
  cy = UNIT_SPRITE_CANVAS_SIZE / 2,
): boolean {
  const spriteGroup = createUnitSpriteGroup(unitKey);
  if (!spriteGroup) {
    return false;
  }
  const wrapper = document.createElementNS(SVG_NS, 'g');
  wrapper.setAttribute('transform', `translate(${cx} ${cy}) scale(${scale}) translate(${-cx} ${-cy})`);
  wrapper.appendChild(spriteGroup);
  svg.appendChild(wrapper);
  return true;
}
