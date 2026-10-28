import { describe,it,expect } from 'vitest';
import { chunkPages,extractPdf,validatePdf } from '../services/ai-knowledge/pdf';
import { makePdf } from './fixtures/pdf';
import { reviewSchema } from '../services/ai-knowledge/service';
import { searchTerms } from '../services/chatbot-retrieval';
const file=(buffer:Buffer,name='school.pdf',mime='application/pdf')=>({buffer,originalname:name,mimetype:mime,size:buffer.length}) as Express.Multer.File;
describe('bounded, genuine PDF extraction',()=>{
 it('validates signatures, MIME, extensions, filename safety and hashes',()=>{
  const good=makePdf(['Public school history recorded for the alumni knowledge library.']);
  expect(validatePdf(file(good,'../../records.pdf')).originalFilename).toBe('records.pdf');
  expect(validatePdf(file(good)).fileHash).toMatch(/^[a-f0-9]{64}$/);
  for(const bad of [file(Buffer.from('not a PDF')),file(good,'school.exe'),file(good,'school.pdf','text/plain')])expect(()=>validatePdf(bad)).toThrow();
  expect(()=>validatePdf({...file(good),size:11*1024*1024})).toThrow('limit');
 });
 it('actually extracts text with distinct page numbers',async()=>{
  const result=await extractPdf(makePdf(['The parade archive records the public falconparade award in this fixture.','The alumni homecoming program welcomes graduates at the school campus.']));
  expect(result).toHaveLength(2);expect(result[0]).toMatchObject({pageNumber:1});expect(result[0].text).toContain('falconparade');expect(result[1].text).toContain('homecoming');
 },30000);
 it('detects blank scanned pages without inventing OCR text',async()=>{const pages=await extractPdf(makePdf(['']));expect(chunkPages(pages,1)).toEqual([]);},30000);
 it('rejects active PDF scripts safely',async()=>{await expect(extractPdf(makePdf(['Public school information for a parser security test.'],'/OpenAction << /S /JavaScript /JS (app.alert\\(1\\)) >>'))).rejects.toThrow('active content');},30000);
 it('keeps chunks coherent, bounded, overlapping and tied to page and edition',()=>{
  const text='A verified paragraph about school history and the alumni association. '.repeat(60);
  const chunks=chunkPages([{pageNumber:7,text}],3);expect(chunks.length).toBeGreaterThan(1);expect(chunks.every(c=>c.text.length<=1200&&c.pageNumber===7&&c.edition===3)).toBe(true);expect(chunks[0].ordering).toBe(0);expect(chunks[1].text.slice(0,80)).toBe(chunks[0].text.slice(-150).trim().slice(0,80));
 });
 it('requires explicit safety review and restricts review states',()=>{expect(reviewSchema.safeParse({version:0,decision:'APPROVED',confirmedPublicAndSafe:'yes'}).success).toBe(false);expect(reviewSchema.safeParse({version:0,decision:'SUPERSEDED'}).success).toBe(false);expect(searchTerms('How do I register for school?')).toContain('register');});
});
