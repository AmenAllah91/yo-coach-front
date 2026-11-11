import { hasWebsiteTexts, mergeWebsiteAiDraft, WebsiteAiTarget } from './website-ai';
import { WebsiteAiDraft } from 'app/service/website.service';

describe('AI website draft in the builder (IA-21)', () => {
  const draft: WebsiteAiDraft = {
    title: 'Coach musculation', slogan: 'Plus fort chaque semaine.', bio: 'Je t’accompagne pas à pas.',
    services: [{ title: 'En ligne', description: 'Programme et suivi.', price: '' }, { title: 'En salle', description: 'À Sousse.', price: '99 DT' }],
    ctaLabel: 'Commencer', descriptionBlocks: ['Ma méthode.'], preset: 'energy',
  };
  const current = (): WebsiteAiTarget => ({
    profile: { image: 'me.jpg', fullName: 'Sami', title: 'Old', slogan: '', bio: 'Old bio' },
    services: [{ image: 'gym.jpg', title: 'Old', price: '50', description: 'Old' }],
    cta: { enabled: false, label: 'Old', sticky: true },
    descriptionBlocks: [{ id: 'h', type: 'heading', content: 'Titre' }, { id: 't', type: 'text', content: 'Old' }, { id: 'i', type: 'image', content: 'x.jpg' }],
  });

  it('replaces the texts and keeps the photos, the name and the non-text blocks', () => {
    let n = 0;
    const merged = mergeWebsiteAiDraft(current(), draft, () => `new${++n}`);

    expect(merged.profile).toEqual({ image: 'me.jpg', fullName: 'Sami', title: 'Coach musculation', slogan: 'Plus fort chaque semaine.', bio: 'Je t’accompagne pas à pas.' });
    expect(merged.services.map(s => s.image)).toEqual(['gym.jpg', '']);
    expect(merged.services[1].price).toBe('99 DT');
    expect(merged.cta).toEqual({ enabled: true, label: 'Commencer', sticky: true });
    expect(merged.descriptionBlocks.map(b => b.id)).toEqual(['h', 'i', 'new1']);
  });

  it('knows when the coach already wrote texts', () => {
    expect(hasWebsiteTexts(current())).toBeTrue();
    expect(hasWebsiteTexts({ profile: { image: '', fullName: 'Sami', title: '', slogan: '', bio: ' ' }, services: [],
      cta: { enabled: true, label: 'Contact', sticky: false }, descriptionBlocks: [{ id: 'i', type: 'image', content: 'x' }] })).toBeFalse();
  });
});
