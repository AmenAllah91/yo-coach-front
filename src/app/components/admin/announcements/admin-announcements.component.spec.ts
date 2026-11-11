import { AdminAnnouncementsComponent, AnnouncementForm } from './admin-announcements.component';
import { announcementText } from 'app/service/platform-announcement.service';

describe('AdminAnnouncementsComponent (rules)', () => {
  const base = (): AnnouncementForm => ({ ...AdminAnnouncementsComponent.emptyForm(), messageFr: 'Mise à jour ce soir à 00h' });

  it('accepts a simple announcement for every coach', () => {
    expect(AdminAnnouncementsComponent.validate(base())).toBe('');
  });

  it('refuses a missing French text, a bad link, wrong dates and a missing email', () => {
    expect(AdminAnnouncementsComponent.validate({ ...base(), messageFr: '  ' })).toBe('ANNOUNCEMENT_ERR_FR');
    expect(AdminAnnouncementsComponent.validate({ ...base(), messageEn: 'x'.repeat(301) })).toBe('ANNOUNCEMENT_ERR_TOO_LONG');
    for (const link of ['javascript:alert(1)', 'http://x.tn', '//evil.tn', 'billing']) {
      expect(AdminAnnouncementsComponent.validate({ ...base(), linkUrl: link })).withContext(link).toBe('ANNOUNCEMENT_ERR_LINK');
    }
    expect(AdminAnnouncementsComponent.validate({ ...base(), linkUrl: '/my-subscription' })).toBe('');
    expect(AdminAnnouncementsComponent.validate({ ...base(), linkUrl: 'https://yocoach.tn' })).toBe('');
    expect(AdminAnnouncementsComponent.validate({ ...base(), startAt: '2026-11-05T10:00', endAt: '2026-11-05T09:00' })).toBe('ANNOUNCEMENT_ERR_DATES');
    expect(AdminAnnouncementsComponent.validate({ ...base(), target: 'ONE' })).toBe('ANNOUNCEMENT_ERR_EMAIL');
  });

  it('sends empty optional fields as null and drops the email for every coach', () => {
    const r = AdminAnnouncementsComponent.toRequest({ ...base(), coachEmail: 'sami@x.tn', startAt: '2026-11-05T00:00' });
    expect(r.messageEn).toBeNull();
    expect(r.linkUrl).toBeNull();
    expect(r.endAt).toBeNull();
    expect(r.coachEmail).toBeNull();
    expect(r.startAt).toBe(new Date('2026-11-05T00:00').toISOString());
  });

  it('shows the coach text in their language, French when missing', () => {
    const a = { messageFr: 'Bonjour', messageEn: 'Hello', messageAr: null };
    expect(announcementText(a, 'en')).toBe('Hello');
    expect(announcementText(a, 'ar')).toBe('Bonjour');
    expect(announcementText(a, 'fr')).toBe('Bonjour');
  });

  it('turns a date back into the datetime-local format', () => {
    const iso = new Date('2026-11-05T00:30').toISOString();
    expect(AdminAnnouncementsComponent.toLocalInput(iso)).toBe('2026-11-05T00:30');
    expect(AdminAnnouncementsComponent.toLocalInput(null)).toBe('');
  });
});
