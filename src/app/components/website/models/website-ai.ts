import { WebsiteAiDraft } from 'app/service/website.service';

/** IA-21: the parts of the builder the AI may fill (the rest of the site is never touched). */
export interface WebsiteAiTarget {
  profile: { image: string; fullName: string; title: string; slogan: string; bio: string };
  services: { image: string; title: string; price: string; description: string }[];
  cta: { enabled: boolean; label: string; sticky: boolean };
  descriptionBlocks: { id: string; type: 'text' | 'heading' | 'image'; content: string }[];
}

/** Has the coach already written texts the AI would replace (the coach is asked first)? */
export function hasWebsiteTexts(t: WebsiteAiTarget): boolean {
  return !!(t.profile.title?.trim() || t.profile.slogan?.trim() || t.profile.bio?.trim()
    || t.services.some(s => s.title?.trim() || s.description?.trim())
    || t.descriptionBlocks.some(b => b.type === 'text' && b.content?.trim()));
}

/**
 * IA-21: puts the AI texts in the builder. Kept as they were: photo and name of the profile, the photo of each service
 * (same position), the sticky option of the button, the headings and images of the description. Replaced: titles,
 * bio, services texts, button label, text paragraphs.
 */
export function mergeWebsiteAiDraft(t: WebsiteAiTarget, d: WebsiteAiDraft, newId: () => string): WebsiteAiTarget {
  return {
    profile: { ...t.profile, title: d.title, slogan: d.slogan, bio: d.bio },
    services: d.services.map((s, i) => ({ image: t.services[i]?.image || '', title: s.title, price: s.price || '',
      description: s.description })),
    cta: { ...t.cta, enabled: true, label: d.ctaLabel },
    descriptionBlocks: [
      ...t.descriptionBlocks.filter(b => b.type !== 'text'),
      ...d.descriptionBlocks.map(content => ({ id: newId(), type: 'text' as const, content })),
    ],
  };
}
