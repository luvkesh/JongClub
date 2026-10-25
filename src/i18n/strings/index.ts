// String tables: one row per English source string, then its translation in
// each language, in the column order of COLUMNS in ../index.ts:
//   [English, 简体中文, 繁體中文, 日本語, العربية, हिन्दी]
// A plural row starts with [one, other] English forms; a translation is then a
// string (no plural forms, as in Chinese and Japanese) or the forms by
// Intl plural category ({ one, two, few, many, other }), as Arabic needs.
// An empty cell falls back to English. test/i18n.test.ts checks every table
// covers every string the code passes to tr() and trn().


import type { Row } from './types';
import { MATCH } from './match';
import { APP } from './app';
import { VARIATIONS } from './variations';
import { RULES } from './rules';
import { COSMETICS } from './cosmetics';
import { CLUB } from './club';
import { COMPETE } from './compete';
import { LEARN } from './learn';
import { AUTH } from './auth';
import { SCREENS } from './screens';
import { PROFILE } from './profile';
import { GUIDE } from './guide';
import { RACKS } from './racks';
import { TEA } from './tea';
import { OPENING } from './opening';
import { HAND_SCORE } from './handScore';
import { MINIGAMES } from './minigames';
import { ROUNDS } from './rounds';
import { LOBBY } from './lobby';
import { CCP } from './ccp';
import { EXPANSION } from './expansion';
import { SCREENS2 } from './screens2';
import { TIPS } from './tips';
import { NAMES } from './names';
import { TARGETS } from './targets';

export type { Cell, Forms, Row } from './types';

export const TABLES: Row[][] = [MATCH, APP, VARIATIONS, RULES, COSMETICS, CLUB, COMPETE, LEARN, AUTH, SCREENS, PROFILE, GUIDE, RACKS, TEA, MINIGAMES, ROUNDS, LOBBY, SCREENS2, CCP, EXPANSION, TIPS, NAMES, TARGETS, OPENING, HAND_SCORE];
