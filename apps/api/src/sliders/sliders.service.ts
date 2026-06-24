import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@pl-cms/db';
import { PrismaService } from '../prisma/prisma.service';
import { CmsSliderStatus, CreateSliderDto, UpdateSliderDto } from './sliders.dto';

type SliderLayer = {
  id: string;
  type: string;
  text?: string;
  href?: string;
  x?: number;
  y?: number;
  width?: number;
  fontSize?: number;
  color?: string;
  background?: string;
};

type SliderSlide = {
  id: string;
  type: string;
  mediaId?: string;
  src?: string;
  videoUrl?: string;
  alt?: string;
  layers: SliderLayer[];
};

@Injectable()
export class SlidersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.cmsSlider.findMany({ orderBy: { updatedAt: 'desc' } });
  }

  async findOne(id: string) {
    const slider = await this.prisma.cmsSlider.findUnique({ where: { id } });
    if (!slider) throw new NotFoundException(`Slider ${id} not found`);
    return slider;
  }

  async findPublishedBySlug(slug: string) {
    const slider = await this.prisma.cmsSlider.findUnique({ where: { slug } });
    if (!slider || slider.status !== CmsSliderStatus.PUBLISHED) {
      throw new NotFoundException(`Slider ${slug} not found`);
    }
    return slider;
  }

  async create(dto: CreateSliderDto) {
    const slug = normalizeSlug(dto.slug);
    const existing = await this.prisma.cmsSlider.findUnique({ where: { slug } });
    if (existing) throw new ConflictException(`Slider slug "${slug}" already exists`);

    return this.prisma.cmsSlider.create({
      data: {
        slug,
        title: dto.title.trim(),
        description: normalizeNullableText(dto.description),
        status: dto.status ?? CmsSliderStatus.DRAFT,
        slides: normalizeSlides(dto.slides) as Prisma.InputJsonValue,
        settings: normalizeSettings(dto.settings) as Prisma.InputJsonValue,
      },
    });
  }

  async update(id: string, dto: UpdateSliderDto) {
    const current = await this.findOne(id);
    const slug = dto.slug ? normalizeSlug(dto.slug) : undefined;
    if (slug && slug !== current.slug) {
      const existing = await this.prisma.cmsSlider.findUnique({ where: { slug } });
      if (existing) throw new ConflictException(`Slider slug "${slug}" already exists`);
    }

    return this.prisma.cmsSlider.update({
      where: { id },
      data: {
        slug,
        title: dto.title?.trim(),
        description: dto.description === undefined ? undefined : normalizeNullableText(dto.description),
        status: dto.status,
        slides: dto.slides === undefined ? undefined : (normalizeSlides(dto.slides) as Prisma.InputJsonValue),
        settings: dto.settings === undefined ? undefined : (normalizeSettings(dto.settings) as Prisma.InputJsonValue),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.cmsSlider.delete({ where: { id } });
  }
}

function normalizeSlug(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function normalizeNullableText(value?: string | null) {
  const text = value?.trim();
  return text || null;
}

function normalizeSettings(settings?: Record<string, unknown>) {
  return {
    height: clampNumber(settings?.height, 180, 900, 480),
    autoPlay: settings?.autoPlay !== false,
    slideSeconds: clampNumber(settings?.slideSeconds, 2, 30, 5),
    transition: typeof settings?.transition === 'string' ? settings.transition : 'slide',
  };
}

function normalizeSlides(slides?: Record<string, unknown>[]): SliderSlide[] {
  const source: Record<string, unknown>[] = slides && slides.length > 0 ? slides : [defaultSlide()];
  return source.map((slide, index) => ({
    id: String(slide.id || `slide-${index + 1}`),
    type: String(slide.type || 'image') === 'video' ? 'video' : 'image',
    mediaId: typeof slide.mediaId === 'string' ? slide.mediaId : '',
    src: typeof slide.src === 'string' ? slide.src : '',
    videoUrl: typeof slide.videoUrl === 'string' ? slide.videoUrl : '',
    alt: typeof slide.alt === 'string' ? slide.alt : '',
    layers: normalizeLayers(Array.isArray(slide.layers) ? (slide.layers as Record<string, unknown>[]) : []),
  }));
}

function normalizeLayers(layers: Record<string, unknown>[]): SliderLayer[] {
  return layers.map((layer, index) => ({
    id: String(layer.id || `layer-${index + 1}`),
    type: ['button', 'text'].includes(String(layer.type)) ? String(layer.type) : 'text',
    text: typeof layer.text === 'string' ? layer.text : 'Layer text',
    href: typeof layer.href === 'string' ? layer.href : '#',
    x: clampNumber(layer.x, 0, 100, 12),
    y: clampNumber(layer.y, 0, 100, 35),
    width: clampNumber(layer.width, 10, 100, 36),
    fontSize: clampNumber(layer.fontSize, 10, 96, 32),
    color: typeof layer.color === 'string' ? layer.color : '#ffffff',
    background: typeof layer.background === 'string' ? layer.background : '#4f46e5',
  }));
}

function defaultSlide(): Record<string, unknown> {
  return {
    id: 'slide-1',
    type: 'image',
    src: '',
    layers: [
      {
        id: 'layer-1',
        type: 'text',
        text: 'New slider',
        x: 12,
        y: 34,
        width: 42,
        fontSize: 44,
        color: '#ffffff',
        background: 'transparent',
      },
    ],
  };
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}
