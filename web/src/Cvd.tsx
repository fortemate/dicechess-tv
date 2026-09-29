// Colour-vision simulation: SVG filters the stage is drawn through.
//
// Protanopia, deuteranopia and tritanopia are the severity-1 matrices of
// Machado, Oliveira and Fernandes, "A Physiologically-based Model for
// Simulation of Color Vision Deficiency" (IEEE TVCG 15(6), 2009), which apply
// to linear RGB. SVG filters work in linear RGB unless told otherwise, so the
// matrices are used as published. Achromatopsia keeps only relative luminance
// (Rec. 709 weights).
//
// A simulation shows where colours collapse into each other. It is not a
// colour-blind viewer, and it is not a television panel.
import React from 'react';
import type { Cvd } from './marks';

const MATRICES: Record<Exclude<Cvd, 'none'>, readonly number[]> = {
  protanopia: [
    0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882,
    -0.048116, 1.051998,
  ],
  deuteranopia: [
    0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182,
    0.04294, 0.968881,
  ],
  tritanopia: [
    1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733,
    0.691367, 0.3039,
  ],
  achromatopsia: [
    0.2126, 0.7152, 0.0722, 0.2126, 0.7152, 0.0722, 0.2126, 0.7152, 0.0722,
  ],
};

// A 3 x 3 matrix as feColorMatrix's 4 x 5, alpha untouched.
const values = (m: readonly number[]) =>
  [
    [m[0], m[1], m[2], 0, 0],
    [m[3], m[4], m[5], 0, 0],
    [m[6], m[7], m[8], 0, 0],
    [0, 0, 0, 1, 0],
  ]
    .map((row) => row.join(' '))
    .join(' ');

export const filterOf = (cvd: Cvd): string =>
  cvd === 'none' ? 'none' : `url(#cvd-${cvd})`;

export const CvdFilters = () => (
  <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
    <defs>
      {Object.entries(MATRICES).map(([name, matrix]) => (
        <filter key={name} id={`cvd-${name}`}>
          <feColorMatrix type="matrix" values={values(matrix)} />
        </filter>
      ))}
    </defs>
  </svg>
);
