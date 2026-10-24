import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.hoisted(() => { process.env.IMAGE_MAX_BYTES = '4194304'; });

import { imageUpload } from '../middleware/upload.middleware';
import { errorHandler } from '../middleware/error.middleware';

const app = express();
app.post('/upload', imageUpload, (req, res) => { res.json({ size: req.file?.size }); });
app.use(errorHandler);

describe('configured upload size', () => {
  it('accepts a file at the Vercel-safe 4 MiB limit, including multipart overhead', async () => {
    const response = await request(app).post('/upload').attach('image', Buffer.alloc(4194304), { filename: 'photo.png', contentType: 'image/png' });
    expect(response.status).toBe(200);
    expect(response.body.size).toBe(4194304);
  });

  it('rejects a larger file with the configured limit in the error', async () => {
    const response = await request(app).post('/upload').attach('image', Buffer.alloc(4194305), { filename: 'photo.png', contentType: 'image/png' });
    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Uploaded image exceeds the 4 MB limit');
  });
});
