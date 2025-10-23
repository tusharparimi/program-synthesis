import { setupServer } from '../syn-server.js';
import { language as maplanguage , scoring} from '../languages/simplmaplang.js';

const port = process.argv[2] ? parseInt(process.argv[2], 10) : 3000;
setupServer(maplanguage, scoring, port); 