import { setupServer } from './syn-server.js';
import { language as simplmapLanguage, scoring as simplmapScoring } from './languages/simplmaplang.js';
import { language as stringLanguage, scoring as stringScoring } from './languages/stringlang.js';
import { language as csgLanguage, scoring as csgScoring } from './languages/csglang.js';

const languages = {
    simplmap: simplmapLanguage,
    stringlang: stringLanguage,
    csglang: csgLanguage
};

const scorings = {
    simplmap: simplmapScoring,
    stringlang: stringScoring,
    csglang: csgScoring
};

const port = process.argv[2] ? parseInt(process.argv[2], 10) : 3000;
setupServer(languages, scorings, port); 