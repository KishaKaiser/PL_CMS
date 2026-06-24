import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@pl-cms/db';
import { Role } from '@pl-cms/shared';
import * as bcrypt from 'bcryptjs';
import { normalizeEmailInput } from '../common/input-normalization.util';
import { PrismaService } from '../prisma/prisma.service';
import {
  CmsFormStatus,
  CmsFormType,
  CreateCmsFormDto,
  SubmitCmsFormDto,
  UpdateCmsFormDto,
} from './forms.dto';

type FormField = {
  id: string;
  label: string;
  type: string;
  required?: boolean;
  placeholder?: string;
  options?: string[];
};

@Injectable()
export class FormsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.cmsForm.findMany({
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { submissions: true } } },
    });
  }

  async findOne(id: string) {
    const form = await this.prisma.cmsForm.findUnique({
      where: { id },
      include: { _count: { select: { submissions: true } } },
    });
    if (!form) throw new NotFoundException(`Form ${id} not found`);
    return form;
  }

  async findPublishedBySlug(slug: string) {
    const form = await this.prisma.cmsForm.findUnique({ where: { slug } });
    if (!form || form.status !== CmsFormStatus.PUBLISHED) {
      throw new NotFoundException(`Form ${slug} not found`);
    }
    return form;
  }

  async create(dto: CreateCmsFormDto) {
    const slug = normalizeSlug(dto.slug);
    const existing = await this.prisma.cmsForm.findUnique({ where: { slug } });
    if (existing) throw new ConflictException(`Form slug "${slug}" already exists`);

    return this.prisma.cmsForm.create({
      data: {
        slug,
        title: dto.title.trim(),
        description: normalizeNullableText(dto.description),
        type: dto.type,
        status: dto.status ?? CmsFormStatus.DRAFT,
        fields: normalizeFields(dto.fields, dto.type) as Prisma.InputJsonValue,
        settings: normalizeSettings(dto.settings, dto.type) as Prisma.InputJsonValue,
        successMessage: dto.successMessage?.trim() || defaultSuccessMessage(dto.type),
      },
    });
  }

  async update(id: string, dto: UpdateCmsFormDto) {
    const existingForm = await this.findOne(id);
    const slug = dto.slug ? normalizeSlug(dto.slug) : undefined;
    if (slug && slug !== existingForm.slug) {
      const existing = await this.prisma.cmsForm.findUnique({ where: { slug } });
      if (existing) throw new ConflictException(`Form slug "${slug}" already exists`);
    }

    const type = dto.type ?? (existingForm.type as CmsFormType);

    return this.prisma.cmsForm.update({
      where: { id },
      data: {
        slug,
        title: dto.title?.trim(),
        description:
          dto.description === undefined ? undefined : normalizeNullableText(dto.description),
        type: dto.type,
        status: dto.status,
        fields:
          dto.fields === undefined
            ? undefined
            : (normalizeFields(dto.fields, type) as Prisma.InputJsonValue),
        settings:
          dto.settings === undefined
            ? undefined
            : (normalizeSettings(dto.settings, type) as Prisma.InputJsonValue),
        successMessage: dto.successMessage?.trim(),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.cmsForm.delete({ where: { id } });
  }

  async listSubmissions(formId: string) {
    await this.findOne(formId);
    return this.prisma.cmsFormSubmission.findMany({
      where: { formId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async submit(slug: string, dto: SubmitCmsFormDto, meta: { ipAddress?: string; userAgent?: string }) {
    const form = await this.findPublishedBySlug(slug);
    const fields = normalizeFields(form.fields as Record<string, unknown>[], form.type as CmsFormType);
    const data = sanitizeSubmissionData(dto.data, fields);
    validateRequiredFields(data, fields);

    if (form.type === CmsFormType.REGISTRATION && shouldCreateUser(form.settings)) {
      return this.createRegistrationSubmission(form, data, meta);
    }

    await this.prisma.cmsFormSubmission.create({
      data: {
        formId: form.id,
        data: data as Prisma.InputJsonObject,
        status: 'NEW',
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
    });

    return { message: form.successMessage };
  }

  private async createRegistrationSubmission(
    form: { id: string; successMessage: string; settings: Prisma.JsonValue },
    data: Record<string, unknown>,
    meta: { ipAddress?: string; userAgent?: string },
  ) {
    const email = normalizeEmailInput(readText(data, 'email'));
    const password = readText(data, 'password');
    const username = normalizeUsername(readText(data, 'username'));
    const name = readText(data, 'name') || email;

    if (!email) throw new BadRequestException('Email is required');
    if (password.length < 8) throw new BadRequestException('Password must be at least 8 characters');

    const existingEmail = await this.prisma.user.findUnique({ where: { email } });
    if (existingEmail) throw new ConflictException(`User with email "${email}" already exists`);
    if (username) {
      const existingUsername = await this.prisma.user.findUnique({ where: { username } });
      if (existingUsername) throw new ConflictException(`Username "${username}" already exists`);
    }

    const role = resolveRegistrationRole(form.settings);
    const passwordHash = await bcrypt.hash(password, 12);

    await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email, username, name, role, passwordHash },
        select: { id: true, name: true, role: true },
      });

      if (role === Role.CLIENT) {
        await tx.clientProfile.create({ data: { userId: user.id, displayName: user.name } });
      }

      if (role === Role.ADVISOR) {
        await tx.advisorProfile.create({ data: { userId: user.id, displayName: user.name } });
      }

      await tx.cmsFormSubmission.create({
        data: {
          formId: form.id,
          data: { ...data, password: '[hidden]' } as Prisma.InputJsonObject,
          status: 'ACCOUNT_CREATED',
          userId: user.id,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
        },
      });
    });

    return { message: form.successMessage };
  }
}

function normalizeSlug(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function normalizeNullableText(value?: string | null) {
  const text = value?.trim();
  return text || null;
}

function defaultSuccessMessage(type: CmsFormType) {
  return type === CmsFormType.REGISTRATION
    ? 'Your account has been created.'
    : 'Thank you. Your submission has been received.';
}

function normalizeFields(fields: Record<string, unknown>[] | undefined, type: string): FormField[] {
  const source =
    fields && fields.length > 0
      ? fields
      : type === CmsFormType.REGISTRATION
        ? defaultRegistrationFields()
        : defaultContactFields();

  return source.map((field, index) => ({
    id: String(field.id || `field-${index + 1}`),
    label: String(field.label || `Field ${index + 1}`).trim(),
    type: String(field.type || 'text'),
    required: Boolean(field.required),
    placeholder: typeof field.placeholder === 'string' ? field.placeholder : '',
    options: Array.isArray(field.options) ? field.options.map(String) : [],
  }));
}

function normalizeSettings(settings: Record<string, unknown> | undefined, type: CmsFormType) {
  if (type !== CmsFormType.REGISTRATION) return settings ?? {};
  return {
    createUser: settings?.createUser !== false,
    defaultRole: isRole(settings?.defaultRole) ? settings.defaultRole : Role.CLIENT,
  };
}

function defaultContactFields(): FormField[] {
  return [
    { id: 'name', label: 'Name', type: 'text', required: true },
    { id: 'email', label: 'Email', type: 'email', required: true },
    { id: 'message', label: 'Message', type: 'textarea', required: true },
  ];
}

function defaultRegistrationFields(): FormField[] {
  return [
    { id: 'name', label: 'Name', type: 'text', required: true },
    { id: 'username', label: 'Username', type: 'text', required: false },
    { id: 'email', label: 'Email', type: 'email', required: true },
    { id: 'password', label: 'Password', type: 'password', required: true },
  ];
}

function sanitizeSubmissionData(data: Record<string, unknown>, fields: FormField[]) {
  return fields.reduce<Record<string, unknown>>((result, field) => {
    const value = data[field.id];
    if (typeof value === 'string') result[field.id] = value.trim();
    else if (Array.isArray(value)) result[field.id] = value.map(String);
    else if (typeof value === 'boolean') result[field.id] = value;
    else result[field.id] = '';
    return result;
  }, {});
}

function validateRequiredFields(data: Record<string, unknown>, fields: FormField[]) {
  const missing = fields.find((field) => field.required && !String(data[field.id] ?? '').trim());
  if (missing) throw new BadRequestException(`${missing.label} is required`);
}

function shouldCreateUser(settings: Prisma.JsonValue) {
  return !settings || typeof settings !== 'object' || Array.isArray(settings)
    ? true
    : settings.createUser !== false;
}

function resolveRegistrationRole(settings: Prisma.JsonValue) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return Role.CLIENT;
  const defaultRole = settings.defaultRole;
  return isRole(defaultRole) ? defaultRole : Role.CLIENT;
}

function isRole(value: unknown): value is Role {
  return Object.values(Role).includes(value as Role);
}

function readText(data: Record<string, unknown>, key: string) {
  return typeof data[key] === 'string' ? data[key].trim() : '';
}

function normalizeUsername(value: string) {
  const username = value.trim().toLowerCase();
  return username || null;
}
