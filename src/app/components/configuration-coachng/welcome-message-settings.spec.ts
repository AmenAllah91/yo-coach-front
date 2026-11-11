import { ConfigurationCoachngComponent } from './configuration-coachng.component';
import { CoachSettingsService, DEFAULT_WELCOME_MESSAGE } from 'app/service/coach-settings.service';

/** Settings › Automatic messages › Welcome message: the logic only (the page has many dependencies). */
describe('Welcome message settings', () => {
  function page(text = '', enabled = false): ConfigurationCoachngComponent {
    const component = Object.create(ConfigurationCoachngComponent.prototype) as ConfigurationCoachngComponent;
    (component as any).welcomeMaxLength = 1000;
    const defaults = CoachSettingsService.prototype.getDefaultConfig.call({});
    component.config = { ...defaults, welcomeMessage: { enabled, text } };
    return component;
  }

  it('is off by default and proposes the default text when turned on', () => {
    const component = page();
    expect(component.config.welcomeMessage.enabled).toBeFalse();
    component.toggleWelcome();
    expect(component.config.welcomeMessage.enabled).toBeTrue();
    expect(component.config.welcomeMessage.text).toBe(DEFAULT_WELCOME_MESSAGE);
  });

  it('keeps the coach text and previews it with a first name', () => {
    const component = page('Salut {prenom}, bienvenue !', false);
    component.toggleWelcome();
    expect(component.config.welcomeMessage.text).toBe('Salut {prenom}, bienvenue !');
    expect(component.welcomePreview).toBe('Salut Sami, bienvenue !');
  });

  it('inserts the first name at the cursor', () => {
    const component = page('Bonjour !', true);
    const field = { selectionStart: 8, selectionEnd: 8, focus: () => undefined, setSelectionRange: () => undefined } as any;
    component.insertFirstName(field);
    expect(component.config.welcomeMessage.text).toBe('Bonjour {prenom}!');
  });

  it('refuses a text longer than 1000 characters', () => {
    expect(page('x'.repeat(1001), true).welcomeTooLong).toBeTrue();
    expect(page('x'.repeat(1000), true).welcomeTooLong).toBeFalse();
  });
});
