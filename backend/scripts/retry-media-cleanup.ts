import 'dotenv/config';
import { mediaService } from '../src/services/media.service';
import { prisma } from '../src/config/prisma';
mediaService.cleanup().catch(() => { console.error('Media cleanup failed; queued jobs retained'); process.exitCode = 1; }).finally(() => prisma.$disconnect());
