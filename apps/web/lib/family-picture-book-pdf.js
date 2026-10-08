import sharp from 'sharp';
import { getFamilyPictureBook, readFamilyPictureBookPage } from './family-picture-books.js';

function pdfObject(id, body) {
  const prefix = Buffer.from(`${id} 0 obj\n`);
  const suffix = Buffer.from('\nendobj\n');
  return Buffer.concat([prefix, Buffer.isBuffer(body) ? body : Buffer.from(body), suffix]);
}

function pdfStream(dictionary, data) {
  return Buffer.concat([
    Buffer.from(`<< ${dictionary} /Length ${data.length} >>\nstream\n`),
    data,
    Buffer.from('\nendstream'),
  ]);
}

function assemblePdf(objects) {
  const header = Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'binary');
  const offsets = [0];
  let cursor = header.length;
  for (const object of objects) {
    offsets.push(cursor);
    cursor += object.length;
  }
  const xrefOffset = cursor;
  const xref = Buffer.from(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);
  return Buffer.concat([header, ...objects, xref]);
}

export async function createPdfFromImageBuffers(imageBuffers) {
  const images = [];
  for (const png of imageBuffers) {
    const { data, info } = await sharp(png).flatten({ background: '#ffffff' }).jpeg({ quality: 92 }).toBuffer({ resolveWithObject: true });
    const maxWidth = 792;
    const width = Math.min(maxWidth, info.width);
    const height = Math.round(width * info.height / info.width);
    images.push({ data, pixelWidth: info.width, pixelHeight: info.height, width, height });
  }

  const pageIds = images.map((_, index) => 3 + index * 3);
  const objects = [
    pdfObject(1, '<< /Type /Catalog /Pages 2 0 R >>'),
    pdfObject(2, `<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] >>`),
  ];
  images.forEach((image, index) => {
    const pageId = pageIds[index];
    const contentId = pageId + 1;
    const imageId = pageId + 2;
    const drawing = Buffer.from(`q\n${image.width} 0 0 ${image.height} 0 0 cm\n/Im0 Do\nQ`);
    objects.push(
      pdfObject(pageId, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${image.width} ${image.height}] /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`),
      pdfObject(contentId, pdfStream('', drawing)),
      pdfObject(imageId, pdfStream(`/Type /XObject /Subtype /Image /Width ${image.pixelWidth} /Height ${image.pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode`, image.data)),
    );
  });
  return assemblePdf(objects);
}

export async function createFamilyPictureBookPdf(current, bookId) {
  const book = await getFamilyPictureBook(current, bookId);
  const pages = [...book.pages].sort((a, b) => a.pageOrder - b.pageOrder);
  if (!pages.length || pages.some((page) => page.status !== 'ready' || !page.storagePath)) {
    const error = new Error('Finish every page before opening the whole book as a PDF.');
    error.code = 'INCOMPLETE';
    throw error;
  }
  const imageBuffers = [];
  for (const page of pages) imageBuffers.push(await readFamilyPictureBookPage(current, book.id, page.pageKey));
  return { book, data: await createPdfFromImageBuffers(imageBuffers) };
}
