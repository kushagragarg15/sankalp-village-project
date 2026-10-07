// Photos from the club's weekend sessions, shown with the village photos on
// the login page's moving photo wall. Kept at 640px: wall tiles are small, so
// the full-size originals never need to be public.
import laughingKids from '../assets/login/laughing-kids.webp';
import bigGroup from '../assets/login/big-group.webp';
import brickWallGroup from '../assets/login/brick-wall-group.webp';
import streetClass from '../assets/login/street-class.webp';
import underTheTrees from '../assets/login/under-the-trees.webp';

export const LOGIN_PHOTOS = [
  { src: laughingKids, alt: 'Four children laughing on a red mat against a brick wall.' },
  { src: bigGroup, alt: 'Volunteers and a large group of children smiling for a photo under a tree.' },
  { src: brickWallGroup, alt: 'Volunteers standing behind rows of children seated on a red mat by a brick wall.' },
  { src: streetClass, alt: 'Children studying with notebooks on a red mat along a pavement wall.' },
  { src: underTheTrees, alt: 'Children gathering around volunteers under the trees for an activity.' },
];
