// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { evaluate, formatNumber, type AngleMode } from './scientific-calculator';

const val = (e: string, angle: AngleMode = 'deg', ans = 0) => {
  const r = evaluate(e, { angle, ans });
  return r.ok ? r.value : `err:${r.error}`;
};

describe('operazioni di base', () => {
  it('precedenza e parentesi', () => {
    expect(val('2+3*4')).toBe(14);
    expect(val('(2+3)*4')).toBe(20);
    expect(val('10-4-3')).toBe(3);
    expect(val('100/10/5')).toBe(2);
  });
  it('potenza associativa a destra e meno unario sotto la potenza', () => {
    expect(val('2^3^2')).toBe(512);
    expect(val('-2^2')).toBe(-4);
    expect(val('2^-2')).toBe(0.25);
    expect(val('2**10')).toBe(1024);
  });
  it('decimali con virgola o punto e senza errori di binario', () => {
    expect(val('0,1+0,2')).toBe(0.3);
    expect(val('0.1+0.2')).toBe(0.3);
    expect(val('1,5*2')).toBe(3);
  });
  it('simboli × ÷ − π √ e spazi', () => {
    expect(val('6 × 7')).toBe(42);
    expect(val('8 ÷ 2')).toBe(4);
    expect(val('5 − 8')).toBe(-3);
    expect(val('2π')).toBeCloseTo(6.283185307179586, 12);
    expect(val('√(16)')).toBe(4);
  });
  it('moltiplicazione implicita', () => {
    expect(val('2(3+1)')).toBe(8);
    expect(val('(1+1)(2+2)')).toBe(8);
    expect(val('3pi')).toBeCloseTo(9.42477796076938, 12);
    expect(val('2e')).toBeCloseTo(5.43656365691809, 12); // 2 × e, non un esponente
    expect(val('2e3')).toBe(2000);
    expect(val('1,5e-3')).toBe(0.0015);
  });
});

describe('percentuale, fattoriale, ans', () => {
  it('il % dopo + o - è la percentuale del primo termine', () => {
    expect(val('200+10%')).toBe(220);
    expect(val('200-10%')).toBe(180);
    expect(val('50%')).toBe(0.5);
    expect(val('200*10%')).toBe(20);
    expect(val('100+10%+10%')).toBe(121);
  });
  it('fattoriale', () => {
    expect(val('5!')).toBe(120);
    expect(val('0!')).toBe(1);
    expect(val('3!!')).toBe(720);
    expect(val('2.5!')).toBe('err:domain');
    expect(val('171!')).toBe('err:overflow');
  });
  it('ans è il risultato precedente', () => {
    expect(val('ans*2', 'deg', 21)).toBe(42);
    expect(val('ans', 'deg')).toBe(0);
  });
});

describe('funzioni', () => {
  it('trigonometria in gradi, senza residui di virgola mobile', () => {
    expect(val('sin(30)')).toBe(0.5);
    expect(val('cos(60)')).toBe(0.5);
    expect(val('sin(180)')).toBe(0);
    expect(val('cos(90)')).toBe(0);
    expect(val('tan(45)')).toBe(1);
    expect(val('asin(1)')).toBe(90);
  });
  it('trigonometria in radianti', () => {
    expect(val('sin(pi/2)', 'rad')).toBe(1);
    expect(val('acos(0)', 'rad')).toBeCloseTo(Math.PI / 2, 12);
  });
  it('logaritmi, radici e altre', () => {
    expect(val('log(1000)')).toBe(3);
    expect(val('log2(8)')).toBe(3);
    expect(val('ln(e)')).toBe(1);
    expect(val('sqrt(2)^2')).toBe(2);
    expect(val('cbrt(-27)')).toBe(-3);
    expect(val('abs(-4)')).toBe(4);
    expect(val('round(2.5)')).toBe(3);
    expect(val('floor(-1.5)')).toBe(-2);
  });
});

describe('errori', () => {
  it('casi che non devono dare un numero', () => {
    expect(val('')).toBe('err:empty');
    expect(val('1/0')).toBe('err:div0');
    expect(val('sqrt(-1)')).toBe('err:domain');
    expect(val('ln(0)')).toBe('err:domain');
    expect(val('tan(90)')).toBe('err:domain');
    expect(val('asin(2)')).toBe('err:domain');
    expect(val('(-8)^0.5')).toBe('err:domain');
    expect(val('10^400')).toBe('err:overflow');
    expect(val('2+')).toBe('err:syntax');
    expect(val('*3')).toBe('err:syntax');
    expect(val('(1+2')).toBe('err:parens');
    expect(val('1+2)')).toBe('err:parens');
    expect(val('foo(3)')).toBe('err:unknown');
    expect(val('sin 30')).toBe('err:syntax');
    expect(val('2 # 3')).toBe('err:syntax');
    expect(val('1'.repeat(301))).toBe('err:tooLong');
  });
  it('annidamento eccessivo: errore, non crash', () => {
    expect(val('('.repeat(100) + '1' + ')'.repeat(100))).toBe('err:syntax');
  });
  it('niente codice eseguito', () => {
    expect(val('constructor')).toBe('err:unknown');
    expect(val('__proto__')).toMatch(/^err:/);
    expect(val('toString(1)')).toBe('err:unknown');
  });
});

describe('formatNumber', () => {
  it('virgola in italiano, punto in inglese', () => {
    expect(formatNumber(0.5, 'it')).toBe('0,5');
    expect(formatNumber(0.5, 'en')).toBe('0.5');
    expect(formatNumber(-0, 'en')).toBe('0');
  });
  it('12 cifre significative e notazione scientifica agli estremi', () => {
    expect(formatNumber(Math.PI, 'en')).toBe('3.14159265359');
    expect(formatNumber(1e21, 'en')).toBe('1e+21');
    expect(formatNumber(1.5e-12, 'it')).toBe('1,5e-12');
    expect(formatNumber(123456789012345, 'en')).toBe('123456789012000');
  });
});
