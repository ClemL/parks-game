import { fill, line, pt, ring } from './ink';
import { sheet, tape } from './paper';
import * as p from './props';
import { clamp, ease, fbm, hash1, hash2, settle } from './rand';
import {
  beat,
  dashedTrail,
  flyResource,
  foreground,
  ground,
  H,
  hills,
  pack,
  Site,
  SITE_ROW,
  siteRow,
  trailPath,
  W,
  weather,
  type Frame,
} from './stage';

export interface Cue {
  /** Seconds into the scene. */
  at: number;
  text: string;
}

export interface Scene {
  id: string;
  /** Chapter name, shown on the scrubber. */
  title: string;
  seconds: number;
  cues: Cue[];
  draw: (ctx: CanvasRenderingContext2D, f: Frame) => void;
}

/** Paper the colour of the season. */
const SEASON_PAPER = ['#f3f0dd', '#f8eec6', '#f4e0c0', '#e9eef2'];
const SEASON_NAME = ['SPRING', 'SUMMER', 'AUTUMN', 'WINTER'];
const SEASON_INK = [p.FOREST, '#b8801f', p.RUST, '#46556b'];

/** A caption-safe note pinned to the paper, for labelling a beat. */
function note(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, show: number, seed = 60, colour = p.INK): void {
  if (show <= 0) return;
  const e = settle(show);
  ctx.save();
  ctx.globalAlpha = Math.min(1, show * 3);
  ctx.translate(x, y);
  ctx.rotate((hash1(1, seed) - 0.5) * 0.06 * e);
  ctx.scale(e, e);
  p.lettering(ctx, text, 0, 0, 30, { color: colour, seed });
  ctx.restore();
}

/** The little walking cycle that carries most of the film. */
function walkTo(from: number, to: number, progress: number): { x: number; stride: number } {
  const e = ease(progress);
  return { x: from + (to - from) * e, stride: progress > 0 && progress < 1 ? progress * 26 : 0 };
}

/* ------------------------------------------------------------- 1. title */

const title: Scene = {
  id: 'title',
  title: 'A year on the trail',
  seconds: 15,
  cues: [
    { at: 0.6, text: 'Every year, four seasons of walking.' },
    { at: 5.5, text: 'You take two hikers out along a trail…' },
    { at: 10, text: '…and bring home the national parks you can pay for.' },
  ],
  draw(ctx, { t, clock }) {
    ground(ctx, SEASON_PAPER[0], 1);
    const sunRise = ease(beat(t, 0.2, 3));
    p.sun(ctx, 1080, 250 - sunRise * 90, 46, 3, clock * 0.14);
    hills(ctx, 470, 11);

    const path = trailPath(540);
    dashedTrail(ctx, path, beat(t, 0.8, 4.2));

    const trees = [
      { x: 120, y: 540, s: 1.7, at: 1.6 },
      { x: 232, y: 566, s: 1.2, at: 2 },
      { x: 1090, y: 548, s: 1.5, at: 2.6 },
      { x: 1196, y: 574, s: 1.1, at: 2.9 },
    ];
    for (const [i, tree] of trees.entries()) {
      const grow = settle(beat(t, tree.at, 0.9));
      if (grow <= 0) continue;
      ctx.save();
      ctx.translate(tree.x, tree.y);
      ctx.scale(grow, grow);
      p.pine(ctx, 0, 0, tree.s, 70 + i * 3);
      ctx.restore();
    }
    p.mountain(ctx, 880, 508, 330, 196, 2);
    p.mountain(ctx, 420, 512, 250, 132, 26);

    // The title is stamped down a word at a time.
    const words = ['Trailside', 'Seasons'];
    words.forEach((word, i) => {
      const show = settle(beat(t, 4.2 + i * 0.5, 0.7));
      if (show <= 0) return;
      ctx.save();
      ctx.globalAlpha = Math.min(1, show * 2);
      ctx.translate(560, 224 + i * 74);
      ctx.scale(1 + (1 - show) * 0.25, 1 + (1 - show) * 0.25);
      ctx.rotate((1 - show) * (i ? 0.07 : -0.07));
      p.lettering(ctx, word, 0, 0, 84, { seed: 15 + i });
      ctx.restore();
    });
    note(ctx, 'a hiking game for one to five', 560, 350, beat(t, 5.6, 0.8), 61, p.FOREST);

    // A hiker sets off down the trail.
    foreground(ctx, { seed: 70, y: 636 });
    const walk = beat(t, 6.4, 8);
    if (walk > 0) {
      const x = -60 + walk * (W + 160);
      const y = 540 + Math.sin(x * 0.011) * 12 + fbm(x * 0.01, 5) * 6;
      p.hiker(ctx, x, y, 1.45, p.SEATS[0], { seed: 6, stride: clock * 8 });
    }

    p.bird(ctx, 300 + clock * 26, 150 + Math.sin(clock) * 10, 15, clock, 13);
    p.bird(ctx, 360 + clock * 24, 186 + Math.sin(clock + 1) * 9, 11, clock, 17);
    weather(ctx, 'blossom', clock, beat(t, 1, 3) * 0.5, 51);
  },
};

/* -------------------------------------------------------------- 2. trail */

const trail: Scene = {
  id: 'trail',
  title: 'The trail',
  seconds: 17,
  cues: [
    { at: 0.5, text: 'A season is a row of sites, dealt face up.' },
    { at: 5.5, text: 'The trail runs one way. Hikers never walk back.' },
    { at: 10.5, text: 'Every season deals a fresh trail — one site longer than the last.' },
  ],
  draw(ctx, { t, clock }) {
    ground(ctx, SEASON_PAPER[0], 2);
    hills(ctx, 300, 12);
    foreground(ctx, { seed: 71, y: 628, sparse: true });
    const dealt = beat(t, 0.4, 4.5) * SITE_ROW.length;
    const places = siteRow(ctx, SITE_ROW, 320, dealt, { seed: 20 });

    const arrowShow = beat(t, 5.2, 1);
    if (arrowShow > 0) {
      ctx.save();
      ctx.globalAlpha = arrowShow;
      p.arrow(ctx, pt(places[0].x - 40, 456), pt(places[places.length - 1].x + 40, 456), { color: p.RUST, width: 4, seed: 14 });
      ctx.restore();
      note(ctx, 'one way, always forward', 640, 512, beat(t, 5.8, 0.8), 62, p.RUST);
    }

    // A new site joins the row for the next season.
    const grow = beat(t, 11, 2);
    if (grow > 0) {
      const last = places[places.length - 1];
      const x = last.x + 150;
      const drop = (1 - settle(grow)) * -260;
      ctx.save();
      ctx.globalAlpha = Math.min(1, grow * 3);
      ctx.translate(x - 90, 320 + drop);
      p.card(ctx, 0, 0, 132, 168, { title: 'Wildlife Hide', icon: '🦌', pips: [p.BERRY], tint: '#efe0c4' }, 88);
      ctx.restore();
      note(ctx, '+1 site each season', 940, 512, beat(t, 12.4, 0.8), 63, p.FOREST);
    }
    weather(ctx, 'blossom', clock, 0.3, 52);
  },
};

/* ------------------------------------------------------------ 3. hikers */

const hikers: Scene = {
  id: 'hikers',
  title: 'Two hikers',
  seconds: 17,
  cues: [
    { at: 0.5, text: 'You have two hikers.' },
    { at: 4, text: 'On your turn you move one of them forward — as far along as you like.' },
    { at: 10, text: 'Walk far and you get the good sites first. Walk short and you get more turns.' },
  ],
  draw(ctx, { t, clock }) {
    ground(ctx, SEASON_PAPER[0], 3);
    hills(ctx, 300, 13);
    const places = siteRow(ctx, SITE_ROW, 300, 99, { seed: 20 });
    foreground(ctx, { seed: 72, y: 636 });
    const ground_y = 520;

    const a = walkTo(places[0].x - 20, places[3].x, beat(t, 4.4, 2.6));
    const b = walkTo(places[0].x + 30, places[1].x + 24, beat(t, 10.4, 1.8));

    p.hiker(ctx, b.x, ground_y + 26, 1.4, p.SEATS[1], { seed: 90, stride: b.stride });
    p.hiker(ctx, a.x, ground_y, 1.45, p.SEATS[0], { seed: 6, stride: a.stride });

    note(ctx, 'both of them are yours', 300, 600, beat(t, 1, 0.8), 64, p.FOREST);
    const far = beat(t, 7.6, 0.8);
    if (far > 0) {
      ctx.save();
      ctx.globalAlpha = far;
      p.arrow(ctx, pt(places[0].x, 168), pt(places[3].x, 168), { color: p.RUST, seed: 22 });
      ctx.restore();
      note(ctx, 'as far as you like', (places[0].x + places[3].x) / 2, 134, beat(t, 8, 0.8), 65, p.RUST);
    }
    weather(ctx, 'blossom', clock, 0.25, 53);
  },
};

/* --------------------------------------------------------- 4. sites pay */

const payout: Scene = {
  id: 'payout',
  title: 'Sites pay',
  seconds: 18,
  cues: [
    { at: 0.5, text: 'Where a hiker stops, the site pays out.' },
    { at: 5, text: 'Water, trees, mountain and sun — the stuff parks are paid for.' },
    { at: 10.5, text: 'The first hiker to a site also takes the season token sitting on it.' },
  ],
  draw(ctx, { t, clock }) {
    ground(ctx, SEASON_PAPER[1], 4);
    hills(ctx, 320, 14);
    foreground(ctx, { seed: 73, y: 640 });

    const cardX = 400;
    const cardY = 300;
    p.card(ctx, cardX, cardY, 216, 272, { title: 'Valley', icon: '💧', pips: [p.WATER, p.WATER] }, 24);

    const tokenTaken = beat(t, 11, 1.2);
    if (tokenTaken < 1) {
      const bob = Math.sin(clock * 2) * 2;
      fill(ctx, ring(cardX + 74, cardY - 110 + bob, 20, 26), p.GOLD, { seed: 26 });
      line(ctx, ring(cardX + 74, cardY - 110 + bob, 20, 27), { color: p.INK, width: 1.8, close: true, passes: 1, alpha: 0.6, seed: 26 });
      ctx.save();
      ctx.font = '600 21px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('☀️', cardX + 74, cardY - 109 + bob);
      ctx.restore();
    }

    const arrive = beat(t, 1, 2);
    p.hiker(ctx, 120 + ease(arrive) * 90, 596, 1.8, p.SEATS[0], { seed: 6, stride: arrive > 0 && arrive < 1 ? arrive * 22 : 0 });

    pack(ctx, 940, 400, 1.75, Math.sin(clock * 3) * 0.2, 40);
    note(ctx, 'your pack', 940, 530, beat(t, 3, 0.8), 66, p.FOREST);

    const packAt = pt(940, 376);
    const source = pt(cardX + 40, cardY);
    flyResource(ctx, 'water', source, packAt, beat(t, 4.2, 1.4), 31);
    flyResource(ctx, 'water', source, packAt, beat(t, 4.7, 1.4), 32);
    flyResource(ctx, 'tree', source, packAt, beat(t, 6.4, 1.4), 33);
    flyResource(ctx, 'rock', source, packAt, beat(t, 7, 1.4), 34);
    flyResource(ctx, 'sun', source, packAt, beat(t, 7.6, 1.4), 35);
    flyResource(ctx, 'sun', pt(cardX + 74, cardY - 110), packAt, tokenTaken, 36);

    note(ctx, 'first one there takes it', 660, 176, beat(t, 11.6, 0.9), 67, p.RUST);
    weather(ctx, 'blossom', clock, 0.2, 54);
  },
};

/* --------------------------------------------------------- 5. campfires */

const campfire: Scene = {
  id: 'campfire',
  title: 'Campfires',
  seconds: 16,
  cues: [
    { at: 0.5, text: 'Two hikers cannot share a site.' },
    { at: 5, text: 'Walk into an occupied site and you are turned back.' },
    { at: 9, text: 'Unless you spend a campfire — one a season, re-lit when a hiker gets home.' },
  ],
  draw(ctx, { t, clock }) {
    ground(ctx, SEASON_PAPER[1], 5);
    hills(ctx, 320, 15);
    foreground(ctx, { seed: 74, y: 642 });
    const sites: Site[] = [SITE_ROW[2], SITE_ROW[3]];
    const places = siteRow(ctx, sites, 292, 99, { seed: 28, w: 200, h: 252, gap: 130 });

    p.hiker(ctx, places[1].x, 546, 1.6, p.SEATS[2], { seed: 95, stride: 0 });

    // The blocked attempt: walk up, bounce back, then in with a fire lit.
    const tryIn = beat(t, 4.2, 1.5);
    const bounce = beat(t, 5.7, 1.2);
    const lit = beat(t, 9.4, 0.8);
    const stepIn = beat(t, 10.6, 1.6);

    let x = places[0].x;
    if (tryIn > 0) x = places[0].x + ease(tryIn) * (places[1].x - places[0].x) * 0.62;
    if (bounce > 0) x = places[0].x + (1 - ease(bounce)) * (places[1].x - places[0].x) * 0.62;
    if (stepIn > 0) x = places[0].x + ease(stepIn) * (places[1].x - places[0].x - 46);
    const moving = (tryIn > 0 && tryIn < 1) || (bounce > 0 && bounce < 1) || (stepIn > 0 && stepIn < 1);
    p.hiker(ctx, x, 546, 1.6, p.SEATS[0], { seed: 6, stride: moving ? t * 22 : 0 });

    if (bounce > 0 && bounce < 1) {
      ctx.save();
      ctx.globalAlpha = 1 - bounce;
      p.lettering(ctx, 'taken!', places[1].x - 150, 430, 38, { color: p.RUST, seed: 68 });
      ctx.restore();
    }

    if (lit > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, lit * 2);
      const s = 34 * settle(lit);
      p.flame(ctx, 640, 470, s, clock, 8);
      ctx.restore();
      note(ctx, 'spend a campfire', 640, 172, beat(t, 10, 0.8), 69, p.RUST);
    }
    weather(ctx, 'blossom', clock, 0.16, 55);
  },
};

/* ----------------------------------------------------------- 6. camera */

const cameraScene: Scene = {
  id: 'camera',
  title: 'The camera',
  seconds: 15,
  cues: [
    { at: 0.5, text: 'One camera exists in the whole game.' },
    { at: 4.5, text: 'Carry it and photographs cost half as much — each one scores.' },
    { at: 9.5, text: 'The next hiker to the Camera Point takes it straight off you.' },
  ],
  draw(ctx, { t, clock }) {
    ground(ctx, SEASON_PAPER[1], 6);
    hills(ctx, 320, 16);
    foreground(ctx, { seed: 75, y: 644, sparse: true });
    p.card(ctx, 380, 300, 206, 260, { title: 'Camera Point', icon: '📷', pips: [] }, 29);

    const pickUp = beat(t, 2.6, 1.4);
    const cameraX = 380 + ease(pickUp) * 300;
    const cameraY = 300 + ease(pickUp) * 160 - Math.sin(ease(pickUp) * Math.PI) * 130;
    p.camera(ctx, cameraX, cameraY, 38 + pickUp * 10, 10);

    p.hiker(ctx, 700, 560, 1.7, p.SEATS[0], { seed: 6, stride: 0 });

    // A shutter flash, and a print that slides out and dries.
    const shot = beat(t, 5.2, 0.35);
    if (shot > 0 && shot < 1) {
      ctx.save();
      ctx.globalAlpha = (1 - shot) * 0.85;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    const print = beat(t, 5.5, 1.4);
    if (print > 0) {
      const y = 250 + settle(print) * 150;
      ctx.save();
      ctx.translate(1030, y);
      ctx.rotate((1 - settle(print)) * 0.4 - 0.06);
      sheet(ctx, [pt(-70, -80), pt(70, -80), pt(70, 82), pt(-70, 82)], { fill: '#fdfaf2', seed: 33, roughness: 1.6, shadow: 14 });
      hills(ctx, -10, 17);
      ctx.save();
      ctx.beginPath();
      ctx.rect(-60, -70, 120, 110);
      ctx.clip();
      fill(ctx, [pt(-60, -70), pt(60, -70), pt(60, 40), pt(-60, 40)], '#cfe0e8', { seed: 34 });
      p.mountain(ctx, 0, 40, 110, 70, 35);
      p.sun(ctx, 36, -40, 12, 36, clock * 0.2);
      ctx.restore();
      p.lettering(ctx, '1 VP', 0, 66, 20, { color: p.INK, seed: 37 });
      ctx.restore();
      tape(ctx, 1030, 330, 70, 20, -0.14, 5);
    }

    const steal = beat(t, 10.4, 1.6);
    if (steal > 0) {
      const sx = 120 + ease(steal) * 180;
      p.hiker(ctx, sx, 566, 1.55, p.SEATS[3], { seed: 97, stride: steal < 1 ? t * 20 : 0 });
      note(ctx, 'and off it goes again', 330, 180, beat(t, 11.4, 0.8), 70, p.RUST);
    }
    weather(ctx, 'blossom', clock, 0.14, 56);
  },
};

/* ------------------------------------------------------------ 7. flasks */

const flaskScene: Scene = {
  id: 'flask',
  title: 'Flasks',
  seconds: 13,
  cues: [
    { at: 0.5, text: 'A flask turns water into something else.' },
    { at: 5, text: 'Only water your last stop paid out will fill one — never what is already packed.' },
  ],
  draw(ctx, { t, clock }) {
    ground(ctx, SEASON_PAPER[1], 7);
    hills(ctx, 330, 18);
    foreground(ctx, { seed: 76, y: 640, sparse: true });
    const shake = Math.sin(clock * 22) * clamp((t - 4.6) / 0.6) * (1 - clamp((t - 5.6) / 0.5)) * 5;

    ctx.save();
    ctx.translate(640 + shake, 370);
    ctx.scale(3, 3);
    p.flask(ctx, 0, 0, 46, 11);
    ctx.restore();

    flyResource(ctx, 'water', pt(300, 230), pt(640, 280), beat(t, 2, 1.6), 41);
    flyResource(ctx, 'water', pt(280, 310), pt(640, 280), beat(t, 2.6, 1.6), 42);

    const out = beat(t, 5.8, 1.6);
    flyResource(ctx, 'sun', pt(640, 300), pt(1000, 260), out, 43);
    flyResource(ctx, 'sun', pt(640, 300), pt(1020, 360), beat(t, 6.2, 1.6), 44);
    if (out > 0.9) note(ctx, 'two sun', 1010, 460, beat(t, 7.4, 0.8), 71, p.GOLD);
    note(ctx, 'one water', 280, 420, beat(t, 1.4, 0.8), 72, p.WATER);
    weather(ctx, 'blossom', clock, 0.12, 57);
  },
};

/* --------------------------------------------------------- 8. trail end */

const trailEnd: Scene = {
  id: 'end',
  title: 'The Trail End',
  seconds: 18,
  cues: [
    { at: 0.5, text: 'Reach the Trail End and that hiker is home for the season.' },
    { at: 5, text: 'It gets one thing on the way out: gear…' },
    { at: 9, text: '…a park reserved for later, taking the first player token…' },
    { at: 13, text: '…or a park claimed outright, paid for on the spot.' },
  ],
  draw(ctx, { t, clock }) {
    ground(ctx, SEASON_PAPER[2], 8);
    hills(ctx, 320, 19);
    foreground(ctx, { seed: 77, y: 642 });
    p.tent(ctx, 176, 552, 70, 9);
    p.flame(ctx, 292, 566, 22, clock, 21);

    const arrive = beat(t, 0.8, 2);
    p.hiker(ctx, 96 + ease(arrive) * 90, 588, 1.6, p.SEATS[0], { seed: 6, stride: arrive > 0 && arrive < 1 ? t * 20 : 0 });

    const choices = [
      { at: 5.2, x: 540, title: 'Buy gear', icon: '🎒', tint: '#f1e4c8' },
      { at: 9.2, x: 790, title: 'Reserve', icon: '🔖', tint: '#eadfc6' },
      { at: 13.2, x: 1040, title: 'Claim a park', icon: '🏞️', tint: '#efe3c6' },
    ];
    choices.forEach((choice, i) => {
      const show = settle(beat(t, choice.at, 0.8));
      if (show <= 0) return;
      ctx.save();
      ctx.translate(choice.x, 300 - show * 6);
      ctx.rotate((1 - show) * 0.3 - 0.02);
      ctx.scale(show, show);
      p.card(ctx, 0, 0, 196, 250, { title: choice.title, icon: choice.icon, tint: choice.tint }, 50 + i * 7);
      ctx.restore();
    });

    const token = beat(t, 11, 1);
    if (token > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, token * 2);
      p.stamp(ctx, 790, 486, '1st PLAYER', -0.08, p.RUST, 52);
      ctx.restore();
    }
    weather(ctx, 'leaves', clock, 0.4, 58);
  },
};

/* ------------------------------------------------------------- 9. parks */

const parks: Scene = {
  id: 'parks',
  title: 'The parks',
  seconds: 17,
  cues: [
    { at: 0.5, text: 'A park has a price in water, trees and mountain.' },
    { at: 5, text: 'Pay it and the card is yours, points and all.' },
    { at: 10.5, text: 'Every park is a real one — forty-five of them, and more with the expansions.' },
  ],
  draw(ctx, { t, clock }) {
    ground(ctx, SEASON_PAPER[2], 9);
    hills(ctx, 330, 20);
    foreground(ctx, { seed: 78, y: 646, sparse: true });
    pack(ctx, 190, 320, 1.6, 0, 40);

    const paid = beat(t, 4.4, 2.6);
    const taken = beat(t, 7.6, 1.6);
    const cardY = 288 + settle(taken) * 190;
    const cardX = 660 + settle(taken) * 330;

    ctx.save();
    ctx.translate(cardX, cardY);
    ctx.scale(1 - settle(taken) * 0.35, 1 - settle(taken) * 0.35);
    ctx.rotate(settle(taken) * 0.08);
    p.card(ctx, 0, 0, 232, 296, { title: 'Glacier', icon: '⛰️', score: 5, pips: [p.WATER, p.WATER, p.MOSS, p.SLATE], tint: '#efe3c6' }, 55);
    ctx.restore();

    const costAt = pt(660, 388);
    flyResource(ctx, 'water', pt(190, 300), costAt, beat(t, 4.4, 1.3), 45);
    flyResource(ctx, 'water', pt(190, 312), costAt, beat(t, 4.8, 1.3), 46);
    flyResource(ctx, 'tree', pt(190, 324), costAt, beat(t, 5.2, 1.3), 47);
    flyResource(ctx, 'rock', pt(190, 336), costAt, beat(t, 5.6, 1.3), 48);

    if (paid > 0.9) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, beat(t, 7.2, 0.5));
      p.stamp(ctx, 856, 250, '5 VP', -0.14, p.RUST, 56);
      ctx.restore();
    }

    // Other parks waiting on offer.
    const row = beat(t, 10.6, 1.6);
    if (row > 0) {
      ['Zion', 'Acadia', 'Denali'].forEach((name, i) => {
        const show = settle(clamp((row - i * 0.12) * 1.4));
        if (show <= 0) return;
        ctx.save();
        ctx.globalAlpha = Math.min(1, show * 2);
        ctx.translate(300 + i * 168, 540 - show * 4);
        ctx.scale(show, show);
        p.card(ctx, 0, 0, 130, 166, { title: name, icon: i === 1 ? '🌲' : i === 2 ? '🏔️' : '🏜️', score: 3 + i, tint: '#efe3c6' }, 57 + i * 4);
        ctx.restore();
      });
    }
    weather(ctx, 'leaves', clock, 0.5, 59);
  },
};

/* ---------------------------------------------------------- 10. seasons */

const seasons: Scene = {
  id: 'seasons',
  title: 'Four seasons',
  seconds: 19,
  cues: [
    { at: 0.5, text: 'When every hiker is home, the season ends.' },
    { at: 5, text: 'A new season card changes the rules for the whole trail…' },
    { at: 10, text: '…the trail is dealt again, one site longer…' },
    { at: 14.5, text: '…and you walk it all over again. Four times in all.' },
  ],
  draw(ctx, { t, clock }) {
    const phase = clamp(t / 18) * 3.999;
    const index = Math.floor(phase);
    const blend = phase - index;
    const paper = SEASON_PAPER[index];
    ground(ctx, paper, 10 + index);
    hills(ctx, 330, 21 + index, index * 2);
    foreground(ctx, { seed: 79, y: 644, colour: ['#cbd6bd', '#c3d3ae', '#d7c9a6', '#dfe6e8'][index] });

    // The trail grows a card per season.
    const sites = SITE_ROW.slice(0, 4 + index);
    siteRow(ctx, sites, 300, 99, { seed: 20, w: 120, h: 152, gap: 16 });

    for (let i = 0; i < 3; i++) {
      const x = 640 + (i - 1) * 440 + Math.sin(clock * 0.3 + i) * 6;
      p.pine(ctx, x, 596, 1.35 - index * 0.05, 80 + i);
    }

    const kinds = ['blossom', 'blossom', 'leaves', 'snow'] as const;
    weather(ctx, kinds[index], clock, 0.5 + blend * 0.4, 60 + index);
    if (index === 3) weather(ctx, 'snow', clock + 4, 0.5, 66);

    ctx.save();
    ctx.translate(1060, 150);
    ctx.scale(1.45, 1.45);
    p.stamp(ctx, 0, 0, SEASON_NAME[index], -0.06 + index * 0.02, SEASON_INK[index], 70 + index);
    ctx.restore();

    // The season card, dealt at the start of each.
    const cardIn = settle(clamp((blend - 0.08) * 5));
    if (cardIn > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, cardIn * 2) * (1 - clamp((blend - 0.75) * 4));
      ctx.translate(256, 520);
      ctx.rotate(-0.05 + (1 - cardIn) * 0.3);
      ctx.scale(cardIn * 1.5, cardIn * 1.5);
      p.card(ctx, 0, 0, 168, 104, { title: ['Bloom', 'Long Days', 'Chance', 'Nightfall'][index], icon: '🍃', tint: '#f6ead0' }, 90 + index);
      ctx.restore();
    }

    const homeward = clamp((blend - 0.55) * 3);
    if (homeward > 0 && homeward < 1) {
      p.hiker(ctx, 1150 - ease(homeward) * 900, 556, 1.45, p.SEATS[0], { seed: 6, stride: clock * 9, facing: -1 });
    }
  },
};

/* --------------------------------------------------------- 11. scoring */

const scoring: Scene = {
  id: 'scoring',
  title: 'Scoring',
  seconds: 15,
  cues: [
    { at: 0.5, text: 'At the end, everything counts up.' },
    { at: 4, text: 'Parks, photographs, gear, the first player token…' },
    { at: 8, text: '…and the two bonus cards you have been hiding all year.' },
  ],
  draw(ctx, { t, clock }) {
    ground(ctx, SEASON_PAPER[3], 11);
    hills(ctx, 320, 22);
    foreground(ctx, { seed: 80, y: 646, colour: '#dfe6e8', sparse: true });

    const fan = beat(t, 0.4, 2);
    ['Glacier', 'Zion', 'Arches'].forEach((name, i) => {
      const show = settle(clamp((fan - i * 0.15) * 1.5));
      if (show <= 0) return;
      ctx.save();
      ctx.translate(330 + i * 38, 288);
      ctx.rotate((-0.18 + i * 0.16) * show);
      ctx.scale(show, show);
      p.card(ctx, 0, 0, 168, 216, { title: name, icon: '🏞️', score: 4 + i, tint: '#efe3c6' }, 60 + i * 3);
      ctx.restore();
    });

    const flip = beat(t, 8.2, 1.6);
    [0, 1].forEach((i) => {
      const show = settle(clamp((flip - i * 0.2) * 1.4));
      if (show <= 0) return;
      const turn = Math.cos(Math.min(1, show) * Math.PI);
      ctx.save();
      ctx.translate(800 + i * 210, 288);
      ctx.scale(Math.abs(turn) < 0.02 ? 0.02 : Math.abs(turn), 1);
      p.card(ctx, 0, 0, 168, 216, turn > 0 ? { back: true } : { title: i ? 'River Runner' : 'Big Ticket', icon: '⭐', tint: '#f3e3d0' }, 66 + i * 3);
      ctx.restore();
    });

    const tally = beat(t, 10.6, 2.4);
    if (tally > 0) {
      const total = Math.round(ease(tally) * 68);
      ctx.save();
      ctx.globalAlpha = Math.min(1, tally * 3);
      p.lettering(ctx, `${total}`, 640, 530, 96, { color: p.RUST, seed: 73 });
      p.lettering(ctx, 'points', 640, 572, 28, { color: p.INK, seed: 74 });
      ctx.restore();
    }
    weather(ctx, 'snow', clock, 0.45, 61);
  },
};

/* ------------------------------------------------------ 12. how to play */

const table: Scene = {
  id: 'table',
  title: 'Round a table',
  seconds: 19,
  cues: [
    { at: 0.5, text: 'Play it on your own against three opponents…' },
    { at: 5.5, text: '…or put a tablet in the middle of the table.' },
    { at: 10, text: 'Everyone scans a seat and plays from their own phone.' },
    { at: 15, text: 'Seats nobody takes are played by the game.' },
  ],
  draw(ctx, { t, clock }) {
    ground(ctx, SEASON_PAPER[0], 12);
    hills(ctx, 320, 23);
    foreground(ctx, { seed: 82, y: 648, sparse: true });

    // Solo first, on its own, then it clears out for the table.
    const solo = settle(beat(t, 0.6, 1));
    const soloGone = clamp((t - 5) / 1);
    if (solo > 0 && soloGone < 1) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, solo * 2) * (1 - soloGone);
      ctx.translate(0, soloGone * 40);
      p.hiker(ctx, 470, 470, 1.9, p.SEATS[0], { seed: 6, stride: clock * 5 });
      [1, 2, 3].forEach((i) => p.pawn(ctx, 640 + i * 78, 452, 1.6, p.SEATS[i], { seed: 100 + i * 4 }));
      note(ctx, 'you, and three the game plays', 640, 580, beat(t, 1.6, 0.8), 75, p.FOREST);
      ctx.restore();
    }

    // The tablet, laid flat in the middle of the table.
    const tablet = settle(beat(t, 5.8, 1.2));
    if (tablet > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, tablet * 2);
      ctx.translate(640, 286);
      ctx.scale(tablet, tablet);
      sheet(ctx, [pt(-320, -168), pt(320, -168), pt(320, 168), pt(-320, 168)], { fill: '#2b3a31', seed: 70, roughness: 2, shadow: 20 });
      sheet(ctx, [pt(-300, -148), pt(300, -148), pt(300, 148), pt(-300, 148)], { fill: '#f6eeda', seed: 71, roughness: 1.4, shadow: 0 });
      ctx.restore();

      // Its screen: the same board, drawn small and in place.
      ctx.save();
      ctx.globalAlpha = Math.min(1, tablet * 2);
      siteRow(ctx, SITE_ROW.slice(0, 5), 250 + (1 - tablet) * 30, 99, {
        seed: 20,
        w: 96,
        h: 122,
        gap: 12,
        cx: 640,
      });
      p.lettering(ctx, 'everyone can see the board', 640, 400, 26, { color: p.FOREST, seed: 76 });
      ctx.restore();
    }

    // Phones around the edge, each with its own code and seat colour.
    const phones = beat(t, 10.4, 2.2);
    [
      { x: 150, y: 470, turn: -0.14 },
      { x: 330, y: 626, turn: 0.08 },
      { x: 950, y: 626, turn: -0.06 },
      { x: 1130, y: 470, turn: 0.15 },
    ].forEach((phone, i) => {
      const show = settle(clamp((phones - i * 0.12) * 1.5));
      if (show <= 0) return;
      ctx.save();
      ctx.globalAlpha = Math.min(1, show * 2);
      ctx.translate(phone.x, phone.y);
      ctx.rotate(phone.turn);
      ctx.scale(show, show);
      sheet(ctx, [pt(-54, -88), pt(54, -88), pt(54, 88), pt(-54, 88)], { fill: '#26332c', seed: 72 + i, roughness: 1.4, shadow: 14 });
      sheet(ctx, [pt(-45, -75), pt(45, -75), pt(45, 66), pt(-45, 66)], { fill: '#f6eeda', seed: 76 + i, roughness: 1, shadow: 0 });
      for (let gx = 0; gx < 7; gx++) {
        for (let gy = 0; gy < 7; gy++) {
          if (hash2(gx, gy, 90 + i) > 0.52) {
            ctx.fillStyle = p.INK;
            ctx.fillRect(-31 + gx * 9, -56 + gy * 9, 8, 8);
          }
        }
      }
      fill(ctx, ring(0, 42, 11, 80 + i), p.SEATS[i % p.SEATS.length], { seed: 80 + i });
      ctx.restore();
    });

    if (phones > 0.5) note(ctx, 'scan a seat, play your own hand', 640, 172, beat(t, 12, 0.9), 77, p.RUST);

    const cpus = beat(t, 15.6, 1.2);
    if (cpus > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, cpus * 2);
      p.stamp(ctx, 1050, 240, 'CPU', 0.1, p.FOREST, 78);
      p.stamp(ctx, 240, 250, 'CPU', -0.12, p.FOREST, 79);
      ctx.restore();
    }
  },
};

/* ----------------------------------------------------------- 13. outro */

const outro: Scene = {
  id: 'outro',
  title: 'Start walking',
  seconds: 13,
  cues: [
    { at: 0.6, text: 'Pick a hiker. Start walking.' },
    { at: 6, text: 'Trailside Seasons — a fan-made game, free to play in your browser.' },
  ],
  draw(ctx, { t, clock }) {
    ground(ctx, '#f7ead0', 13);
    const dusk = ctx.createLinearGradient(0, 120, 0, 520);
    dusk.addColorStop(0, 'rgba(240, 189, 120, 0.55)');
    dusk.addColorStop(1, 'rgba(246, 232, 206, 0)');
    ctx.fillStyle = dusk;
    ctx.fillRect(0, 120, W, 400);

    p.sun(ctx, 990, 410, 64, 3, clock * 0.1);
    hills(ctx, 470, 24);
    foreground(ctx, { seed: 81, y: 640, colour: '#c6cfae' });
    const path = trailPath(548);
    dashedTrail(ctx, path, 1);
    p.pine(ctx, 118, 574, 1.7, 70);
    p.pine(ctx, 1192, 588, 1.35, 73);

    const walk = clamp(t / 11);
    const x = 180 + walk * 640;
    const y = 548 + Math.sin(x * 0.011) * 12 + fbm(x * 0.01, 5) * 6;
    p.hiker(ctx, x, y, 1.55, p.SEATS[0], { seed: 6, stride: clock * 7 });

    const show = settle(beat(t, 0.4, 1));
    ctx.save();
    ctx.globalAlpha = Math.min(1, show * 2);
    p.lettering(ctx, 'Pick a hiker.', 400, 200, 66, { seed: 15 });
    ctx.restore();
    const show2 = settle(beat(t, 1.4, 1));
    ctx.save();
    ctx.globalAlpha = Math.min(1, show2 * 2);
    p.lettering(ctx, 'Start walking.', 480, 278, 66, { color: p.FOREST, seed: 16 });
    ctx.restore();

    p.bird(ctx, 400 + clock * 20, 140 + Math.sin(clock) * 8, 14, clock, 13);
    p.bird(ctx, 452 + clock * 19, 172 + Math.sin(clock + 1) * 7, 10, clock, 17);
    weather(ctx, 'leaves', clock, 0.22, 62);
  },
};

export const SCENES: Scene[] = [
  title,
  trail,
  hikers,
  payout,
  campfire,
  cameraScene,
  flaskScene,
  trailEnd,
  parks,
  seasons,
  scoring,
  table,
  outro,
];

/** Where each scene starts, and how long the whole film runs. */
export const STARTS: number[] = SCENES.reduce<number[]>((acc, _scene, i) => {
  acc.push(i === 0 ? 0 : acc[i - 1] + SCENES[i - 1].seconds);
  return acc;
}, []);

export const DURATION = STARTS[STARTS.length - 1] + SCENES[SCENES.length - 1].seconds;

/** The caption showing at a given moment, as a flat track. */
export interface Caption {
  from: number;
  to: number;
  text: string;
  scene: number;
}

export const CAPTIONS: Caption[] = SCENES.flatMap((scene, i): Caption[] =>
  scene.cues.map((cue, j) => ({
    from: STARTS[i] + cue.at,
    to: STARTS[i] + (scene.cues[j + 1]?.at ?? scene.seconds),
    text: cue.text,
    scene: i,
  })),
);

export function captionAt(clock: number): Caption | null {
  return CAPTIONS.find((c) => clock >= c.from && clock < c.to) ?? null;
}

export function sceneAt(clock: number): { index: number; scene: Scene; t: number } {
  let index = STARTS.findIndex((start, i) => clock >= start && clock < start + SCENES[i].seconds);
  if (index < 0) index = clock < 0 ? 0 : SCENES.length - 1;
  return { index, scene: SCENES[index], t: clamp(clock - STARTS[index], 0, SCENES[index].seconds) };
}
