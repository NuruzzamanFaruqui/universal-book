import { EmailService, esc } from './email.service';
import { RuntimeConfigService } from '../config/runtime-config.service';

const mockSend = jest.fn();
jest.mock('@sendgrid/mail', () => ({
  MailService: jest.fn().mockImplementation(() => ({
    setApiKey: jest.fn(),
    setTimeout: jest.fn(),
    send: mockSend,
  })),
}));

/** An EmailService whose configuration is exactly `values`. */
function serviceWith(values: Record<string, string>) {
  const config = { get: jest.fn(async (key: string) => values[key]) } as unknown as RuntimeConfigService;
  return new EmailService(config);
}

const SENDGRID = { SENDGRID_API_KEY: 'SG.test', APP_URL: 'https://app.test/' };

describe('EmailService', () => {
  beforeEach(() => mockSend.mockReset());

  it('escapes user-supplied values', () => {
    expect(esc(`<script>"x" & 'y'</script>`)).toBe(
      '&lt;script&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/script&gt;',
    );
  });

  describe('sendEmail', () => {
    const msg = { to: 'a@test.dev', subject: 'S', html: '<p>H</p>', text: 'H', category: 'test' };

    it('does not send when no transport is configured', async () => {
      const ok = await serviceWith({}).sendEmail(msg);
      expect(mockSend).not.toHaveBeenCalled();
      expect(ok).toBe(true); // console fallback reports success outside production
    });

    it('sends through SendGrid with tracking off and a text part', async () => {
      mockSend.mockResolvedValue([{ statusCode: 202 }, {}]);
      const ok = await serviceWith(SENDGRID).sendEmail(msg);
      expect(ok).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'a@test.dev',
          text: 'H',
          categories: ['test'],
          trackingSettings: {
            clickTracking: { enable: false, enableText: false },
            openTracking: { enable: false },
          },
        }),
      );
    });

    it('returns false instead of throwing when SendGrid fails', async () => {
      mockSend.mockRejectedValue(
        Object.assign(new Error('Forbidden'), {
          response: { body: { errors: [{ message: 'sender not verified' }] } },
        }),
      );
      await expect(serviceWith(SENDGRID).sendEmail(msg)).resolves.toBe(false);
    });

    it('skips a message with no recipient', async () => {
      await expect(serviceWith(SENDGRID).sendEmail({ ...msg, to: '' })).resolves.toBe(false);
      expect(mockSend).not.toHaveBeenCalled();
    });
  });

  describe('notification templates', () => {
    let svc: EmailService;
    beforeEach(() => {
      mockSend.mockResolvedValue([{ statusCode: 202 }, {}]);
      svc = serviceWith(SENDGRID);
    });
    const sent = () => mockSend.mock.calls[0][0];

    it('new follower: names both people, escapes them, links to the follower', async () => {
      await svc.sendNewFollower({
        to: 'writer@test.dev', recipientName: 'Wren', followerName: '<b>Bo</b>', followerId: 'u-2',
      });
      const m = sent();
      expect(m.subject).toBe('<b>Bo</b> started following you');
      expect(m.html).toContain('Hi Wren,');
      expect(m.html).toContain('&lt;b&gt;Bo&lt;/b&gt;');
      expect(m.html).not.toContain('<b>Bo</b>');
      expect(m.html).toContain('href="https://app.test/profile/u-2"');
      expect(m.text).toContain('View profile: https://app.test/profile/u-2');
      expect(m.categories).toEqual(['new-follower']);
    });

    it('connection request: links to where it can be accepted', async () => {
      await svc.sendConnectionRequest({ to: 'r@test.dev', recipientName: 'Rae', senderName: 'Sam' });
      const m = sent();
      expect(m.subject).toBe('Sam wants to connect on Universal Book');
      expect(m.html).toContain('Hi Rae,');
      expect(m.html).toContain('href="https://app.test/notifications"');
    });

    it('connection accepted: links to the accepter', async () => {
      await svc.sendConnectionAccepted({
        to: 's@test.dev', recipientName: 'Sam', accepterName: 'Rae', accepterId: 'u-9',
      });
      const m = sent();
      expect(m.subject).toBe('Rae accepted your connection request');
      expect(m.html).toContain('href="https://app.test/profile/u-9"');
    });

    it('purchase receipt: title, amount and method, links to the library', async () => {
      await svc.sendBookPurchased({
        to: 'b@test.dev', recipientName: 'Bea', bookTitle: 'Tides', authorName: 'Ann',
        amount: 10, paymentMethod: 'credits',
      });
      const m = sent();
      expect(m.subject).toBe('Your copy of "Tides" is ready');
      expect(m.html).toContain('Paid: $10.00 (credits)');
      expect(m.html).toContain('href="https://app.test/library"');
    });

    it('sale notice: earning, links to earnings, does not name the buyer', async () => {
      await svc.sendBookSold({ to: 'a@test.dev', recipientName: 'Ann', bookTitle: 'Tides', earning: 7 });
      const m = sent();
      expect(m.subject).toBe('You made a sale: "Tides"');
      expect(m.html).toContain('$7.00 has been added');
      expect(m.html).toContain('href="https://app.test/dashboard/earnings"');
    });

    it('falls back to "there" when the recipient has no name', async () => {
      await svc.sendBookSold({ to: 'a@test.dev', recipientName: null, bookTitle: 'Tides', earning: 7 });
      expect(sent().html).toContain('Hi there,');
    });
  });
});
