import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { FeatherModule } from 'angular-feather';
import { allIcons } from 'angular-feather/icons';

import { PlayerRun, PlayerRunGroup, WorkoutPlayerComponent } from './workout-player.component';

/** Guided workout: one set at a time, validated by sliding, then the rest. */
describe('WorkoutPlayerComponent', () => {
  let fixture: ComponentFixture<WorkoutPlayerComponent>;
  let player: WorkoutPlayerComponent;
  let log: string[];

  const run = (name: string, key: string, shown: string, reps: number[], weight: number | null, rest: number, extra: Partial<PlayerRun> = {}): PlayerRun => ({
    key, displayLabel: shown, exercise: { id: key, name }, cardio: false, timed: false, hasVideo: false,
    sets: reps.map((value, index) => ({
      setNumber: index + 1, reps: value, duration: null, durationSec: extra.timed ? value : null, weight, restMin: 0, restSec: rest,
      type: 'REGULAR', status: 'PENDING',
    })),
    planned: reps.map(value => ({ reps: value, duration: null, durationSec: extra.timed ? value : null, weight })),
    ...extra,
  });
  const workout = (): PlayerRunGroup[] => [
    { grouped: false, circuit: false, restSec: null, exercises: [run('squat', '1', '1', [10, 10, 8], 20, 60)] },
    { grouped: true, circuit: false, restSec: 45, exercises: [run('pompes', '2.1', '2A', [10, 10], null, 45), run('tirage', '2.2', '2B', [10, 10], null, 45)] },
    { grouped: true, circuit: true, restSec: 30, exercises: [run('gainage', '3.1', '3A', [30, 30], null, 0, { timed: true }), run('fentes', '3.2', '3B', [12, 12], null, 30)] },
  ];
  const create = (groups: PlayerRunGroup[], startGroup: number | null = null, getReady = false) => {
    fixture = TestBed.createComponent(WorkoutPlayerComponent);
    player = fixture.componentInstance;
    Object.assign(player, { groups, startGroup, fr: true, time: '12:34', getReady });
    log = [];
    player.statusChange.subscribe(event => log.push(`${event.run.key}#${event.index}=${event.status}`));
    fixture.detectChanges();
  };
  const text = () => (fixture.nativeElement as HTMLElement).textContent || '';

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkoutPlayerComponent, HttpClientTestingModule, FeatherModule.pick(allIcons)],
    }).compileComponents();
  });

  afterEach(() => fixture.destroy());

  it('first start: a get-ready countdown, then the first set', async () => {
    create(workout(), null, true);
    expect(player.phase).toBe('ready');
    expect(text()).toContain('Préparez-vous !');
    expect(text()).toContain('10');
    expect(text()).toContain('PREMIER EXERCICE');
    expect(text()).toContain('Squat');

    player.finishGetReady();
    fixture.detectChanges();
    expect(text()).toContain('C’est parti !');
    expect(text()).toContain('GO');
    await new Promise(resolve => setTimeout(resolve, 800));
    fixture.detectChanges();
    expect(player.phase).toBe('work');
    expect(text()).toContain('Série 1 sur 3');
  });

  it('after the get-ready countdown, a timed first set counts down at once', async () => {
    create(workout(), 2, true);
    player.finishGetReady();
    await new Promise(resolve => setTimeout(resolve, 800));
    fixture.detectChanges();
    expect(player.count).toBe('timed');
    expect(text()).toContain('TENEZ');
  });

  it('logs a set, carries a changed weight to the next set, then rests', () => {
    const groups = workout();
    create(groups);
    expect(text()).toContain('Série 1 sur 3');
    expect(text()).toContain('Prévu : 10 rép. · 20 kg');

    player.bumpWeight(1);
    expect(groups[0].exercises[0].sets[0].weight).toBe(22.5);
    player.complete();
    fixture.detectChanges();
    expect(log).toEqual(['1#0=COMPLETED']);
    expect(groups[0].exercises[0].sets[1].weight).toBe(22.5);
    expect(player.phase).toBe('rest');
    expect(text()).toContain('Série 1 validée');
    expect(text()).toContain('01:00');

    player.skipRest();
    player.skip();
    fixture.detectChanges();
    expect(log[1]).toBe('1#1=MISSED');
    expect(text()).toContain('Série 3 sur 3');
  });

  it('superset: A then B without rest, rest after the pair', () => {
    create(workout(), 1);
    expect(text()).toContain('SUPERSET · 2A');
    expect(text()).toContain('Ensuite, sans repos : Tirage');
    player.complete();
    expect(player.phase).toBe('work');
    expect(player.run.key).toBe('2.2');
    player.complete();
    fixture.detectChanges();
    expect(player.phase).toBe('rest');
    expect(player.left).toBe(45);
    expect(text()).toContain('Tour 1 terminé');
  });

  it('circuit: a timed exercise gets ready, counts down, and keeps the time really held when stopped early', () => {
    const groups = workout();
    create(groups, 2);
    expect(player.count).toBe('ready');
    player.startNow();
    expect(player.count).toBe('timed');
    player.left = 18;
    player.complete();
    expect(groups[2].exercises[0].sets[0].durationSec).toBe(12);
    expect(player.run.key).toBe('3.2');
  });

  it('number fields: letters and signs are not written, the value stays a number', () => {
    const groups = workout();
    create(groups);
    const type = (id: string, value: string): HTMLInputElement => {
      const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(id)!;
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      fixture.detectChanges();
      return input;
    };
    expect(type('#wp-value', '1a2b-').value).toBe('12');
    expect(groups[0].exercises[0].sets[0].reps).toBe(12);
    expect(type('#wp-value', 'abc').value).toBe('');
    expect(groups[0].exercises[0].sets[0].reps).toBeNull();
    expect(type('#wp-weight', '2x2,5kg').value).toBe('22,5');
    expect(groups[0].exercises[0].sets[0].weight).toBe(22.5);
    expect(type('#wp-weight', '12345.678').value).toBe('1234.67');
  });

  it('asks to finish once every set is covered', () => {
    create([{ grouped: false, circuit: false, restSec: null, exercises: [run('squat', '1', '1', [10], null, 0)] }]);
    let finish: boolean | null = null;
    player.closed.subscribe(value => (finish = value));
    player.complete();
    fixture.detectChanges();
    expect(player.phase).toBe('done');
    (fixture.nativeElement.querySelector('.wp-done .wp-main') as HTMLButtonElement).click();
    expect(finish).toBeTrue();
  });

  it('lets the client write the workout note on the last screen', () => {
    create([{ grouped: false, circuit: false, restSec: null, exercises: [run('squat', '1', '1', [10], null, 0)] }]);
    let note = '';
    player.noteChange.subscribe(value => (note = value));
    expect(fixture.nativeElement.querySelector('#wp-note')).toBeNull();
    player.complete();
    fixture.detectChanges();
    const area = fixture.nativeElement.querySelector('#wp-note') as HTMLTextAreaElement;
    area.value = 'Tired today';
    area.dispatchEvent(new Event('input', { bubbles: true }));
    expect(note).toBe('Tired today');
  });
});
