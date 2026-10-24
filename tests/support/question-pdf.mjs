// Small real PDF fixture, with xref offsets, text operators and optional multiple pages.
export function questionPdf(pages) {
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
 const refs=[];
 for(const lines of pages){
  const page=objects.length+1,content=page+1;refs.push(`${page} 0 R`);
  const stream='BT\n/F1 12 Tf\n50 790 Td\n16 TL\n'+lines.map(line=>'('+line.replace(/([\\()])/g,'\\$1')+') Tj\nT*').join('\n')+'\nET';
  objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${content} 0 R >>`,`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
 }
 objects[1]=`<< /Type /Pages /Kids [${refs.join(' ')}] /Count ${pages.length} >>`;
 let pdf='%PDF-1.4\n';const offsets=[0];
 for(const [i,obj] of objects.entries()){offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${obj}\nendobj\n`;}
 const xref=Buffer.byteLength(pdf);pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`+offsets.slice(1).map(n=>`${String(n).padStart(10,'0')} 00000 n \n`).join('')+`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
 return Buffer.from(pdf);
}
