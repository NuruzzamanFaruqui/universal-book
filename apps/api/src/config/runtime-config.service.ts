import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

/**
 * Resolves configuration from the database first, then the environment.
 *
 * Until now the admin settings page wrote keys to the `Setting` table that
 * nothing ever read — AiService and PaymentsService went straight to
 * process.env, so entering a key in the admin panel had no effect at all.
 * Everything that needs a key now goes through here, which makes that page
 * actually work while keeping env vars as the bootstrap path.
 */

export interface ManagedKeyDef {
  key: string;
  label: string;
  group: 'ai' | 'stripe' | 'google' | 'email';
  secret: boolean;
  hint?: string;
  placeholder?: string;
  /** Without this the corresponding feature is unavailable. */
  required?: boolean;
}

export const MANAGED_KEYS: ManagedKeyDef[] = [
  { key: 'ANTHROPIC_API_KEY', label: 'Anthropic API key', group: 'ai', secret: true,
    required: true, placeholder: 'sk-ant-...', hint: 'Book generation, writing assistance, diagrams.' },
  { key: 'AI_MODEL', label: 'Model', group: 'ai', secret: false,
    placeholder: 'claude-sonnet-4-20250514', hint: 'Leave blank for the built-in default.' },

  { key: 'STRIPE_PUBLISHABLE_KEY', label: 'Publishable key', group: 'stripe', secret: false, placeholder: 'pk_live_...' },
  { key: 'STRIPE_SECRET_KEY', label: 'Secret key', group: 'stripe', secret: true, required: true, placeholder: 'sk_live_...' },
  { key: 'STRIPE_WEBHOOK_SECRET', label: 'Webhook signing secret', group: 'stripe', secret: true,
    required: true, placeholder: 'whsec_...', hint: 'From the endpoint at /api/payments/webhook.' },

  { key: 'GOOGLE_CLOUD_PROJECT', label: 'GCP project id', group: 'google', secret: false,
    placeholder: 'universal-book-365', hint: 'Imagen and Veo run in this project.' },
  { key: 'GOOGLE_VERTEX_LOCATION', label: 'Vertex region', group: 'google', secret: false, placeholder: 'us-central1' },
  { key: 'GCS_BUCKET', label: 'Media bucket', group: 'google', secret: false,
    placeholder: 'universal-book-media', hint: 'Covers, illustrations, video and profile photos.' },

  { key: 'RESEND_API_KEY', label: 'Resend API key', group: 'email', secret: true,
    placeholder: 're_...', hint: 'Password reset. Leave blank if using SMTP below.' },
  { key: 'SMTP_HOST', label: 'SMTP host', group: 'email', secret: false, placeholder: 'mail.privateemail.com' },
  { key: 'SMTP_PORT', label: 'SMTP port', group: 'email', secret: false, placeholder: '587' },
  { key: 'SMTP_USER', label: 'SMTP username', group: 'email', secret: false },
  { key: 'SMTP_PASSWORD', label: 'SMTP password', group: 'email', secret: true },
];

const CACHE_TTL_MS = 30_000;

@Injectable()
export class RuntimeConfigService {
  private readonly logger = new Logger(RuntimeConfigService.name);
  private cache = new Map<string, string | null>();
  private loadedAt = 0;

  constructor(private prisma: PrismaService) {}

  private async load() {
    if (Date.now() - this.loadedAt < CACHE_TTL_MS && this.cache.size) return;
    try {
      const rows = await this.prisma.setting.findMany();
      this.cache = new Map(rows.map((r) => [r.key, r.value]));
      this.loadedAt = Date.now();
    } catch (err: any) {
      // Keep serving the last known values rather than failing the request.
      this.logger.error(`Could not refresh settings: ${err.message}`);
    }
  }

  /** Database value if set, otherwise the environment. */
  async get(key: string): Promise<string | undefined> {
    await this.load();
    const stored = this.cache.get(key);
    if (stored && stored.trim()) return stored.trim();
    const env = process.env[key];
    return env && env.trim() ? env.trim() : undefined;
  }

  async require(key: string): Promise<string> {
    const value = await this.get(key);
    if (!value) throw new Error(`${key} is not configured. Set it in Admin → API Management.`);
    return value;
  }

  /** Called after a write so the next read is fresh. */
  invalidate() {
    this.loadedAt = 0;
    this.cache.clear();
  }

  /** Where a value is coming from, for the admin UI. Never returns the value. */
  async describe() {
    await this.load();
    return MANAGED_KEYS.map((def) => {
      const stored = this.cache.get(def.key)?.trim();
      const env = process.env[def.key]?.trim();
      const value = stored || env;
      return {
        ...def,
        configured: !!value,
        source: stored ? 'database' : env ? 'environment' : 'unset',
        preview: value ? RuntimeConfigService.mask(value, def.secret) : '',
      };
    });
  }

  static mask(value: string, secret: boolean): string {
    if (!secret) return value;
    if (value.length <= 8) return '••••';
    return `${value.slice(0, 6)}••••${value.slice(-4)}`;
  }
}
