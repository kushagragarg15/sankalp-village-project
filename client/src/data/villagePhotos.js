// Photos from the club's weekend sessions. Each has a full-size file (the
// lightbox) and a small one (cards, grids), both WebP, resized from the
// originals. `alt` says what is in the frame; `caption` is what the gallery
// shows under it.
import volunteerNotebook from '../assets/village/volunteer-notebook.webp';
import volunteerNotebookSm from '../assets/village/volunteer-notebook-sm.webp';
import girlsTreeGuards from '../assets/village/girls-tree-guards.webp';
import girlsTreeGuardsSm from '../assets/village/girls-tree-guards-sm.webp';
import verandahLesson from '../assets/village/verandah-lesson.webp';
import verandahLessonSm from '../assets/village/verandah-lesson-sm.webp';
import girlDiary from '../assets/village/girl-diary.webp';
import girlDiarySm from '../assets/village/girl-diary-sm.webp';
import friends from '../assets/village/friends.webp';
import friendsSm from '../assets/village/friends-sm.webp';
import countingTogether from '../assets/village/counting-together.webp';
import countingTogetherSm from '../assets/village/counting-together-sm.webp';
import goldenHour from '../assets/village/golden-hour.webp';
import goldenHourSm from '../assets/village/golden-hour-sm.webp';
import sunsetGroup from '../assets/village/sunset-group.webp';
import sunsetGroupSm from '../assets/village/sunset-group-sm.webp';
import laughingLesson from '../assets/village/laughing-lesson.webp';
import laughingLessonSm from '../assets/village/laughing-lesson-sm.webp';
import handpumpReading from '../assets/village/handpump-reading.webp';
import handpumpReadingSm from '../assets/village/handpump-reading-sm.webp';
import volunteerToddler from '../assets/village/volunteer-toddler.webp';
import volunteerToddlerSm from '../assets/village/volunteer-toddler-sm.webp';

const photo = (id, src, small, shape, alt, caption) => ({ id, src, small, shape, alt, caption });

export const PHOTOS = {
  girlDiary: photo('girl-diary', girlDiary, girlDiarySm, 'portrait',
    'A girl in a red T-shirt pauses over her open diary, pencil in hand.',
    'Halfway through a sum'),
  goldenHour: photo('golden-hour', goldenHour, goldenHourSm, 'portrait',
    'A volunteer sits cross-legged on the verandah beside a smiling boy with his notebook, late-afternoon light behind them.',
    'Late light on the verandah'),
  countingTogether: photo('counting-together', countingTogether, countingTogetherSm, 'portrait',
    'Two volunteers lean in over a sheet of paper as a young girl points to her answer.',
    'Checking the answer together'),
  verandahLesson: photo('verandah-lesson', verandahLesson, verandahLessonSm, 'portrait',
    'Volunteers and girls read and write together against a school wall painted with a tree and a monkey.',
    'Reading under the painted tree'),
  volunteerNotebook: photo('volunteer-notebook', volunteerNotebook, volunteerNotebookSm, 'portrait',
    'A volunteer reads a boy’s notebook while two other boys look on.',
    'Going over the homework'),
  laughingLesson: photo('laughing-lesson', laughingLesson, laughingLessonSm, 'square',
    'A volunteer and a girl laugh together mid-lesson, notebooks open.',
    'The good part of a lesson'),
  handpumpReading: photo('handpump-reading', handpumpReading, handpumpReadingSm, 'square',
    'A volunteer reads from a notebook with two girls beside a hand pump in the school yard.',
    'By the hand pump'),
  girlsTreeGuards: photo('girls-tree-guards', girlsTreeGuards, girlsTreeGuardsSm, 'portrait',
    'Five girls laugh beside a new tree guard in the school yard.',
    'The new tree guards'),
  friends: photo('friends', friends, friendsSm, 'portrait',
    'Two girls hug and smile at the camera in the school yard.',
    'Friends'),
  sunsetGroup: photo('sunset-group', sunsetGroup, sunsetGroupSm, 'square',
    'Volunteers talk with small children in the field at sunset.',
    'Staying until sunset'),
  volunteerToddler: photo('volunteer-toddler', volunteerToddler, volunteerToddlerSm, 'square',
    'A volunteer smiles, holding a toddler in the school ground.',
    'The youngest visitor'),
};

// Gallery order: alternate portrait and square, and keep teaching scenes and
// candid ones mixed so no column reads as one kind of picture.
export const GALLERY = [
  PHOTOS.girlDiary,
  PHOTOS.laughingLesson,
  PHOTOS.countingTogether,
  PHOTOS.girlsTreeGuards,
  PHOTOS.handpumpReading,
  PHOTOS.goldenHour,
  PHOTOS.volunteerToddler,
  PHOTOS.verandahLesson,
  PHOTOS.friends,
  PHOTOS.sunsetGroup,
  PHOTOS.volunteerNotebook,
];

// The prints pinned to the login board.
export const LOGIN_PRINTS = [PHOTOS.goldenHour, PHOTOS.girlDiary, PHOTOS.countingTogether, PHOTOS.girlsTreeGuards];
